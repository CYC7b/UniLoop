package admin

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"uniloop/backend/pkg/cache"
)

type Repository struct {
	db    *pgxpool.Pool
	cache *cache.Client
}

func NewRepository(db *pgxpool.Pool, cacheClient *cache.Client) *Repository {
	return &Repository{db: db, cache: cacheClient}
}

func (r *Repository) Stats(ctx context.Context) map[string]int {
	stats := make(map[string]int)
	queries := map[string]string{
		"total_users":           "SELECT COUNT(*) FROM users",
		"total_products":        "SELECT COUNT(*) FROM products",
		"active_products":       "SELECT COUNT(*) FROM products WHERE status='active'",
		"total_reports":         "SELECT COUNT(*) FROM reports",
		"pending_reports":       "SELECT COUNT(*) FROM reports WHERE resolved=FALSE",
		"pending_verifications": "SELECT COUNT(*) FROM profiles WHERE verification_status='pending'",
		"total_conversations":   "SELECT COUNT(*) FROM conversations",
	}

	for key, q := range queries {
		var count int
		_ = r.db.QueryRow(ctx, q).Scan(&count)
		stats[key] = count
	}
	return stats
}

func (r *Repository) UpdateUserVerification(ctx context.Context, id uuid.UUID, status string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE profiles SET verification_status=$1, updated_at=NOW() WHERE id=$2`, status, id)
	if err == nil {
		r.cache.Delete(ctx, cache.ProfileKey(id))
	}
	return err
}

func (r *Repository) DeleteUser(ctx context.Context, id uuid.UUID) error {
	unreadKeys := []string{cache.UnreadKey(id)}
	rows, err := r.db.Query(ctx, `
		SELECT buyer_id FROM conversations WHERE seller_id=$1
		UNION
		SELECT seller_id FROM conversations WHERE buyer_id=$1`, id)
	if err == nil {
		for rows.Next() {
			var participantID uuid.UUID
			if scanErr := rows.Scan(&participantID); scanErr == nil {
				unreadKeys = append(unreadKeys, cache.UnreadKey(participantID))
			}
		}
		rows.Close()
	}

	_, err = r.db.Exec(ctx, `DELETE FROM users WHERE id=$1`, id)
	if err != nil {
		return err
	}
	r.cache.Delete(ctx, cache.ProfileKey(id))
	r.cache.Delete(ctx, unreadKeys...)
	r.cache.DeleteByPattern(ctx, cache.ProductListPattern)
	r.cache.DeleteByPattern(ctx, cache.LocationsPattern)
	return nil
}

func (r *Repository) UpdateProductStatus(ctx context.Context, id uuid.UUID, status string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE products SET status=$1, updated_at=NOW() WHERE id=$2`, status, id)
	if err == nil {
		r.cache.DeleteByPattern(ctx, cache.ProductListPattern)
		r.cache.DeleteByPattern(ctx, cache.LocationsPattern)
	}
	return err
}

func (r *Repository) DeleteProduct(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `DELETE FROM products WHERE id=$1`, id)
	if err == nil {
		r.cache.DeleteByPattern(ctx, cache.ProductListPattern)
		r.cache.DeleteByPattern(ctx, cache.LocationsPattern)
	}
	return err
}

func (r *Repository) ResolveReport(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx,
		`UPDATE reports SET resolved=TRUE, resolved_at=NOW() WHERE id=$1`, id)
	return err
}

func (r *Repository) DeleteReport(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `DELETE FROM reports WHERE id=$1`, id)
	return err
}
