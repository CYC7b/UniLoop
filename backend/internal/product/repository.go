package product

import (
	"context"
	"crypto/md5"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"uniloop/backend/internal/models"
	"uniloop/backend/internal/pagination"
	"uniloop/backend/pkg/cache"
)

const (
	locationsTTL = 30 * time.Minute
	productsTTL  = 5 * time.Minute
)

type Repository struct {
	db    *pgxpool.Pool
	cache *cache.Client
}

func NewRepository(db *pgxpool.Pool, c *cache.Client) *Repository {
	return &Repository{db: db, cache: c}
}

type ListParams struct {
	Category          string
	ExcludeCategories []string
	Location          string
	Search            string
	Cursor            *pagination.Cursor
	Limit             int
	UserLat           *float64
	UserLng           *float64
	MaxDist           *float64 // km
}

type LocationParams struct {
	Category          string
	ExcludeCategories []string
}

// ListPage is one page of listings; NextCursor is empty on the last page.
type ListPage struct {
	Items      []models.Product `json:"items"`
	NextCursor string           `json:"next_cursor"`
}

// listCacheKey returns a deterministic key for the given params.
// Geo-filtered queries are not cached (infinite lat/lng combinations).
func listCacheKey(p ListParams) (string, bool) {
	if p.UserLat != nil || p.UserLng != nil || p.MaxDist != nil {
		return "", false // skip geo queries
	}
	cursor := ""
	if p.Cursor != nil {
		cursor = p.Cursor.Encode()
	}
	raw := fmt.Sprintf("cat=%s:exclude=%s:loc=%s:q=%s:cursor=%s:limit=%d",
		p.Category, strings.Join(p.ExcludeCategories, ","), p.Location, p.Search, cursor, p.Limit)
	h := md5.Sum([]byte(raw))
	return fmt.Sprintf("products:%x", h), true
}

func locationsCacheKey(p LocationParams) string {
	if p.Category == "" && len(p.ExcludeCategories) == 0 {
		return cache.LocationsKey
	}
	raw := fmt.Sprintf("cat=%s:exclude=%s", p.Category, strings.Join(p.ExcludeCategories, ","))
	h := md5.Sum([]byte(raw))
	return fmt.Sprintf("locations:%x", h)
}

func (r *Repository) List(ctx context.Context, p ListParams) (*ListPage, error) {
	p.Limit = pagination.ClampLimit(p.Limit, 20, 50)

	// Cache-Aside (only for non-geo queries)
	if key, ok := listCacheKey(p); ok {
		var cached ListPage
		if r.cache.GetJSON(ctx, key, &cached) {
			return &cached, nil
		}

		page, err := r.listFromDB(ctx, p)
		if err != nil {
			return nil, err
		}
		r.cache.SetJSON(ctx, key, page, productsTTL)
		return page, nil
	}

	return r.listFromDB(ctx, p)
}

func (r *Repository) listFromDB(ctx context.Context, p ListParams) (*ListPage, error) {
	where := []string{"status = 'active'"}
	args := []any{}
	n := 1

	if p.Category != "" && p.Category != "All" {
		where = append(where, fmt.Sprintf("category = $%d", n))
		args = append(args, p.Category)
		n++
	}
	for _, category := range p.ExcludeCategories {
		category = strings.TrimSpace(category)
		if category == "" {
			continue
		}
		where = append(where, fmt.Sprintf("category <> $%d", n))
		args = append(args, category)
		n++
	}
	if p.Location != "" && p.Location != "All Locations" {
		where = append(where, fmt.Sprintf("location_short = $%d", n))
		args = append(args, p.Location)
		n++
	}
	if p.Search != "" {
		escaped := escapeILIKE(p.Search)
		where = append(where, fmt.Sprintf(
			`(search_vector @@ plainto_tsquery('english', $%d)
			 OR title ILIKE $%d
			 OR location_short ILIKE $%d)`,
			n, n+1, n+2))
		args = append(args, p.Search, "%"+escaped+"%", "%"+escaped+"%")
		n += 3
	}
	if p.UserLat != nil && p.UserLng != nil && p.MaxDist != nil {
		where = append(where, fmt.Sprintf(
			`lat IS NOT NULL AND lng IS NOT NULL AND
			(6371 * acos(LEAST(1.0,
				cos(radians($%d)) * cos(radians(lat)) *
				cos(radians(lng) - radians($%d)) +
				sin(radians($%d)) * sin(radians(lat))
			))) <= $%d`, n, n+1, n+2, n+3))
		args = append(args, *p.UserLat, *p.UserLng, *p.UserLat, *p.MaxDist)
		n += 4
	}
	if p.Cursor != nil {
		where = append(where, fmt.Sprintf("(created_at, id) < ($%d, $%d)", n, n+1))
		args = append(args, p.Cursor.CreatedAt, p.Cursor.ID)
		n += 2
	}

	query := fmt.Sprintf(`
		SELECT id, title, price, currency, description, images, thumbnails, category, tags,
		       location_name, lat, lng, owner_id, contact_info, status, created_at, updated_at
		FROM products
		WHERE %s
		ORDER BY created_at DESC, id DESC
		LIMIT $%d`,
		strings.Join(where, " AND "), n)
	// Fetch one extra row to learn whether another page exists.
	args = append(args, p.Limit+1)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	page := &ListPage{Items: []models.Product{}}
	for rows.Next() {
		prod, err := scanProduct(rows)
		if err != nil {
			return nil, err
		}
		page.Items = append(page.Items, *prod)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(page.Items) > p.Limit {
		page.Items = page.Items[:p.Limit]
		last := page.Items[p.Limit-1]
		page.NextCursor = pagination.Cursor{CreatedAt: last.CreatedAt, ID: last.ID}.Encode()
	}
	return page, nil
}

func (r *Repository) GetByID(ctx context.Context, id uuid.UUID) (*models.Product, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, title, price, currency, description, images, thumbnails, category, tags,
		       location_name, lat, lng, owner_id, contact_info, status, created_at, updated_at
		FROM products WHERE id = $1`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	if !rows.Next() {
		return nil, fmt.Errorf("product not found")
	}
	return scanProduct(rows)
}

// Create inserts a listing and claims its uploaded images in one transaction,
// so a failure leaves no listing and the images stay unclaimed for the janitor.
// With an idempotency key, a repeated request returns the listing created by
// the first one and replayed=true instead of inserting a duplicate.
func (r *Repository) Create(ctx context.Context, req models.CreateProductRequest, ownerID uuid.UUID, idemKey *uuid.UUID) (p *models.Product, replayed bool, err error) {
	currency := req.Currency
	if currency == "" {
		currency = "MYR"
	}
	tags := req.Tags
	if tags == nil {
		tags = []string{}
	}
	contactJSON := contactToMap(req.ContactInfo)
	thumbs := req.Thumbnails
	if thumbs == nil {
		thumbs = []string{}
	}

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, false, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// A concurrent request with the same key blocks on the unique index until
	// the first one commits or rolls back, then gets DO NOTHING or proceeds.
	var id uuid.UUID
	err = tx.QueryRow(ctx, `
		INSERT INTO products
			(title, price, currency, description, images, thumbnails, category, tags,
			 location_name, lat, lng, owner_id, contact_info, idempotency_key)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
		ON CONFLICT (owner_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
		RETURNING id`,
		req.Title, req.Price, currency, req.Description, req.Images, thumbs,
		req.Category, tags, req.LocationName, req.Lat, req.Lng, ownerID, contactJSON, idemKey,
	).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		_ = tx.Rollback(ctx)
		if err := r.db.QueryRow(ctx,
			`SELECT id FROM products WHERE owner_id = $1 AND idempotency_key = $2`, ownerID, idemKey,
		).Scan(&id); err != nil {
			return nil, false, fmt.Errorf("load idempotent product: %w", err)
		}
		p, err := r.GetByID(ctx, id)
		return p, true, err
	}
	if err != nil {
		return nil, false, fmt.Errorf("create product: %w", err)
	}

	if err := claimUploads(ctx, tx, ownerID, id, imageURLs(req.Images, thumbs)); err != nil {
		return nil, false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, false, fmt.Errorf("commit: %w", err)
	}

	// Invalidate product list and locations caches
	r.cache.DeleteByPattern(ctx, cache.ProductListPattern)
	r.cache.DeleteByPattern(ctx, cache.LocationsPattern)
	p, err = r.GetByID(ctx, id)
	return p, false, err
}

// Update applies the provided fields. When the image set changes, newly added
// images are claimed and dropped ones released for the janitor, atomically
// with the row update.
func (r *Repository) Update(ctx context.Context, id, ownerID uuid.UUID, req models.UpdateProductRequest) (*models.Product, error) {
	sets := []string{"updated_at=NOW()"}
	args := []any{}
	n := 1

	field := func(col string, val any) {
		sets = append(sets, fmt.Sprintf("%s=$%d", col, n))
		args = append(args, val)
		n++
	}

	if req.Title != nil {
		field("title", *req.Title)
	}
	if req.Price != nil {
		field("price", *req.Price)
	}
	if req.Currency != nil {
		field("currency", *req.Currency)
	}
	if req.Description != nil {
		field("description", *req.Description)
	}
	if req.Images != nil {
		field("images", req.Images)
	}
	if req.Thumbnails != nil {
		field("thumbnails", req.Thumbnails)
	}
	if req.Category != nil {
		field("category", *req.Category)
	}
	if req.Tags != nil {
		field("tags", req.Tags)
	}
	if req.LocationName != nil {
		field("location_name", *req.LocationName)
	}
	if req.Lat != nil {
		field("lat", *req.Lat)
	}
	if req.Lng != nil {
		field("lng", *req.Lng)
	}
	if req.ContactInfo != nil {
		field("contact_info", contactToMap(*req.ContactInfo))
	}

	if len(args) == 0 {
		return r.GetByID(ctx, id)
	}

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	if req.Images != nil || req.Thumbnails != nil {
		// Lock the row so concurrent edits compute image diffs one at a time.
		var curImages, curThumbs []string
		if err := tx.QueryRow(ctx,
			`SELECT images, thumbnails FROM products WHERE id = $1 FOR UPDATE`, id,
		).Scan(&curImages, &curThumbs); err != nil {
			return nil, fmt.Errorf("load product images: %w", err)
		}
		nextImages, nextThumbs := curImages, curThumbs
		if req.Images != nil {
			nextImages = req.Images
		}
		if req.Thumbnails != nil {
			nextThumbs = req.Thumbnails
		}
		before := imageURLs(curImages, curThumbs)
		after := imageURLs(nextImages, nextThumbs)
		if err := claimUploads(ctx, tx, ownerID, id, without(after, before)); err != nil {
			return nil, err
		}
		if err := releaseUploads(ctx, tx, id, without(before, after)); err != nil {
			return nil, err
		}
	}

	args = append(args, id)
	if _, err := tx.Exec(ctx,
		fmt.Sprintf("UPDATE products SET %s WHERE id=$%d", strings.Join(sets, ","), n),
		args...); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}
	r.cache.DeleteByPattern(ctx, cache.ProductListPattern)
	r.cache.DeleteByPattern(ctx, cache.LocationsPattern)
	return r.GetByID(ctx, id)
}

func (r *Repository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `DELETE FROM products WHERE id = $1`, id)
	if err == nil {
		r.cache.DeleteByPattern(ctx, cache.ProductListPattern)
		r.cache.DeleteByPattern(ctx, cache.LocationsPattern)
	}
	return err
}

func (r *Repository) GetOwner(ctx context.Context, id uuid.UUID) (uuid.UUID, error) {
	var ownerID uuid.UUID
	err := r.db.QueryRow(ctx, `SELECT owner_id FROM products WHERE id = $1`, id).Scan(&ownerID)
	return ownerID, err
}

func (r *Repository) GetByOwner(ctx context.Context, ownerID uuid.UUID, activeOnly bool) ([]models.Product, error) {
	q := `
		SELECT id, title, price, currency, description, images, thumbnails, category, tags,
		       location_name, lat, lng, owner_id, contact_info, status, created_at, updated_at
		FROM products WHERE owner_id = $1`
	if activeOnly {
		q += ` AND status = 'active'`
	}
	q += ` ORDER BY created_at DESC`
	rows, err := r.db.Query(ctx, q, ownerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results []models.Product
	for rows.Next() {
		p, err := scanProduct(rows)
		if err != nil {
			return nil, err
		}
		results = append(results, *p)
	}
	return results, rows.Err()
}

func (r *Repository) GetFavorited(ctx context.Context, userID uuid.UUID) ([]models.Product, error) {
	rows, err := r.db.Query(ctx, `
		SELECT p.id, p.title, p.price, p.currency, p.description, p.images, p.thumbnails, p.category, p.tags,
		       p.location_name, p.lat, p.lng, p.owner_id, p.contact_info, p.status, p.created_at, p.updated_at
		FROM products p
		JOIN favorites f ON f.product_id = p.id
		WHERE f.user_id = $1 AND p.status = 'active'
		ORDER BY f.created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results []models.Product
	for rows.Next() {
		p, err := scanProduct(rows)
		if err != nil {
			return nil, err
		}
		results = append(results, *p)
	}
	return results, rows.Err()
}

func (r *Repository) ListLocations(ctx context.Context, p LocationParams) ([]string, error) {
	// Cache-Aside for locations (changes rarely)
	cacheKey := locationsCacheKey(p)
	var cached []string
	if r.cache.GetJSON(ctx, cacheKey, &cached) {
		return cached, nil
	}

	where := []string{"status = 'active'", "location_short <> ''"}
	args := []any{}
	n := 1

	if p.Category != "" && p.Category != "All" {
		where = append(where, fmt.Sprintf("category = $%d", n))
		args = append(args, p.Category)
		n++
	}
	for _, category := range p.ExcludeCategories {
		category = strings.TrimSpace(category)
		if category == "" {
			continue
		}
		where = append(where, fmt.Sprintf("category <> $%d", n))
		args = append(args, category)
		n++
	}

	query := fmt.Sprintf(`
		SELECT location_short
		FROM products
		WHERE %s
		GROUP BY location_short
		ORDER BY COUNT(*) DESC`, strings.Join(where, " AND "))
	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var locs []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		locs = append(locs, name)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	r.cache.SetJSON(ctx, cacheKey, locs, locationsTTL)
	return locs, nil
}

// --- internal helpers ---

type scanner interface {
	Scan(dest ...any) error
}

func scanProduct(s scanner) (*models.Product, error) {
	var p models.Product
	var contactJSON map[string]string
	err := s.Scan(
		&p.ID, &p.Title, &p.Price, &p.Currency, &p.Description,
		&p.Images, &p.Thumbnails, &p.Category, &p.Tags, &p.LocationName,
		&p.Lat, &p.Lng, &p.OwnerID, &contactJSON,
		&p.Status, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if contactJSON != nil {
		p.ContactInfo = models.ContactInfo{
			WhatsApp:  contactJSON["whatsapp"],
			WeChat:    contactJSON["wechat"],
			Instagram: contactJSON["instagram"],
		}
	}
	if p.Images == nil {
		p.Images = []string{}
	}
	if p.Thumbnails == nil {
		p.Thumbnails = []string{}
	}
	if p.Tags == nil {
		p.Tags = []string{}
	}
	return &p, nil
}

func contactToMap(c models.ContactInfo) map[string]string {
	return map[string]string{
		"whatsapp":  c.WhatsApp,
		"wechat":    c.WeChat,
		"instagram": c.Instagram,
	}
}

func escapeILIKE(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	s = strings.ReplaceAll(s, `%`, `\%`)
	s = strings.ReplaceAll(s, `_`, `\_`)
	return s
}
