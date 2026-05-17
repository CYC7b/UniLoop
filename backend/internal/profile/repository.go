package profile

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"uniloop/backend/internal/models"
	"uniloop/backend/pkg/cache"
)

const profileTTL = 30 * time.Minute

type Repository struct {
	db    *pgxpool.Pool
	cache *cache.Client
}

func NewRepository(db *pgxpool.Pool, c *cache.Client) *Repository {
	return &Repository{db: db, cache: c}
}

func (r *Repository) GetByID(ctx context.Context, id uuid.UUID) (*models.Profile, error) {
	// Cache-Aside: try cache first
	var cached models.Profile
	if r.cache.GetJSON(ctx, cache.ProfileKey(id), &cached) {
		return &cached, nil
	}

	// Cache miss: query DB
	p := &models.Profile{}
	err := r.db.QueryRow(ctx, `
		SELECT id, email, full_name, school, avatar_url, verification_status,
		       last_seen_at, created_at, updated_at
		FROM profiles WHERE id = $1`, id,
	).Scan(&p.ID, &p.Email, &p.FullName, &p.School, &p.AvatarURL,
		&p.VerificationStatus, &p.LastSeenAt, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("profile not found")
	}

	r.cache.SetJSON(ctx, cache.ProfileKey(id), p, profileTTL)
	return p, nil
}

func (r *Repository) Update(ctx context.Context, id uuid.UUID, name, school string) error {
	sets := []string{"updated_at=NOW()"}
	args := []any{}
	n := 1
	if name != "" {
		sets = append(sets, fmt.Sprintf("full_name=$%d", n))
		args = append(args, name)
		n++
	}
	if school != "" {
		sets = append(sets, fmt.Sprintf("school=$%d", n))
		args = append(args, school)
		n++
	}
	args = append(args, id)
	_, err := r.db.Exec(ctx,
		fmt.Sprintf("UPDATE profiles SET %s WHERE id=$%d", joinSets(sets), n),
		args...)
	if err == nil {
		r.cache.Delete(ctx, cache.ProfileKey(id))
	}
	return err
}

func (r *Repository) UpdateAvatar(ctx context.Context, id uuid.UUID, url string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE profiles SET avatar_url=$1, updated_at=NOW() WHERE id=$2`, url, id)
	if err == nil {
		r.cache.Delete(ctx, cache.ProfileKey(id))
	}
	return err
}

func (r *Repository) SetVerificationStatus(ctx context.Context, id uuid.UUID, status string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE profiles SET verification_status=$1, updated_at=NOW() WHERE id=$2`, status, id)
	if err == nil {
		r.cache.Delete(ctx, cache.ProfileKey(id))
	}
	return err
}

func (r *Repository) SetVerificationDoc(ctx context.Context, id uuid.UUID, docURL string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE profiles SET verification_status='pending', verification_doc_url=$1, updated_at=NOW() WHERE id=$2`,
		docURL, id)
	if err == nil {
		r.cache.Delete(ctx, cache.ProfileKey(id))
	}
	return err
}

func (r *Repository) TouchLastSeen(ctx context.Context, id uuid.UUID) {
	_, _ = r.db.Exec(ctx, `UPDATE profiles SET last_seen_at=NOW() WHERE id=$1`, id)
	// Invalidate so next read reflects updated last_seen_at
	r.cache.Delete(ctx, cache.ProfileKey(id))
}

func joinSets(sets []string) string {
	result := ""
	for i, s := range sets {
		if i > 0 {
			result += ","
		}
		result += s
	}
	return result
}
