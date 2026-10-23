package product

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"uniloop/backend/internal/storage"
)

// ErrUnknownImages means a listing referenced an image that is not an
// unclaimed upload of the same user.
var ErrUnknownImages = errors.New("images must be uploaded by you before they can be used")

const janitorBatch = 200

// RecordUploads registers freshly saved files as unclaimed uploads of ownerID.
func (r *Repository) RecordUploads(ctx context.Context, ownerID uuid.UUID, urls []string) error {
	if len(urls) == 0 {
		return nil
	}
	_, err := r.db.Exec(ctx,
		`INSERT INTO uploads (url, owner_id) SELECT unnest($1::text[]), $2`, urls, ownerID)
	return err
}

// claimUploads attaches unclaimed uploads of ownerID to productID. Every URL
// must match, otherwise the caller's transaction must be rolled back.
func claimUploads(ctx context.Context, tx pgx.Tx, ownerID, productID uuid.UUID, urls []string) error {
	if len(urls) == 0 {
		return nil
	}
	tag, err := tx.Exec(ctx, `
		UPDATE uploads SET product_id = $1
		WHERE owner_id = $2 AND product_id IS NULL AND url = ANY($3)`,
		productID, ownerID, urls)
	if err != nil {
		return fmt.Errorf("claim uploads: %w", err)
	}
	if tag.RowsAffected() != int64(len(urls)) {
		return ErrUnknownImages
	}
	return nil
}

// releaseUploads detaches images a listing no longer uses; the janitor then
// deletes them. Untracked (legacy) URLs are simply not matched.
func releaseUploads(ctx context.Context, tx pgx.Tx, productID uuid.UUID, urls []string) error {
	if len(urls) == 0 {
		return nil
	}
	_, err := tx.Exec(ctx,
		`UPDATE uploads SET product_id = NULL WHERE product_id = $1 AND url = ANY($2)`, productID, urls)
	if err != nil {
		return fmt.Errorf("release uploads: %w", err)
	}
	return nil
}

// imageURLs returns the distinct non-empty URLs across the given lists.
func imageURLs(lists ...[]string) []string {
	seen := map[string]bool{}
	var out []string
	for _, list := range lists {
		for _, u := range list {
			if u != "" && !seen[u] {
				seen[u] = true
				out = append(out, u)
			}
		}
	}
	return out
}

// without returns the elements of a that are not in b.
func without(a, b []string) []string {
	drop := map[string]bool{}
	for _, u := range b {
		drop[u] = true
	}
	var out []string
	for _, u := range a {
		if !drop[u] {
			out = append(out, u)
		}
	}
	return out
}

// CleanupOrphanedUploads deletes uploads that no listing has claimed for
// longer than grace, file first, then row. It returns how many were removed.
func (r *Repository) CleanupOrphanedUploads(ctx context.Context, store storage.Service, grace time.Duration) (int, error) {
	total := 0
	for {
		selected, deleted, err := r.cleanupBatch(ctx, store, grace)
		total += deleted
		if err != nil || selected < janitorBatch || deleted == 0 {
			return total, err
		}
	}
}

func (r *Repository) cleanupBatch(ctx context.Context, store storage.Service, grace time.Duration) (selected, deleted int, err error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return 0, 0, err
	}
	defer tx.Rollback(ctx)

	// SKIP LOCKED lets several instances run the janitor at once. A listing
	// claiming one of these rows blocks on its lock and, once the row is
	// gone, matches nothing and fails with ErrUnknownImages.
	rows, err := tx.Query(ctx, `
		SELECT id, url FROM uploads
		WHERE product_id IS NULL AND created_at < NOW() - make_interval(secs => $1)
		ORDER BY created_at
		LIMIT $2
		FOR UPDATE SKIP LOCKED`, grace.Seconds(), janitorBatch)
	if err != nil {
		return 0, 0, err
	}
	var ids []uuid.UUID
	var urls []string
	for rows.Next() {
		var id uuid.UUID
		var url string
		if err := rows.Scan(&id, &url); err != nil {
			rows.Close()
			return 0, 0, err
		}
		ids = append(ids, id)
		urls = append(urls, url)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return 0, 0, err
	}

	var removed []uuid.UUID
	for i, url := range urls {
		if err := store.Delete(ctx, url); err != nil {
			log.Printf("upload janitor: delete %s: %v", url, err)
			continue
		}
		removed = append(removed, ids[i])
	}
	if len(removed) > 0 {
		if _, err := tx.Exec(ctx, `DELETE FROM uploads WHERE id = ANY($1)`, removed); err != nil {
			return len(ids), 0, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return len(ids), 0, err
	}
	return len(ids), len(removed), nil
}

// RunUploadJanitor runs CleanupOrphanedUploads now and then every interval
// until ctx is cancelled.
func (r *Repository) RunUploadJanitor(ctx context.Context, store storage.Service, every, grace time.Duration) {
	ticker := time.NewTicker(every)
	defer ticker.Stop()
	for {
		if n, err := r.CleanupOrphanedUploads(ctx, store, grace); err != nil && ctx.Err() == nil {
			log.Printf("upload janitor: %v", err)
		} else if n > 0 {
			log.Printf("upload janitor: removed %d orphaned uploads", n)
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
