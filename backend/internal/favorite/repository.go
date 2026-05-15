package favorite

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Add(ctx context.Context, userID, productID uuid.UUID) error {
	_, err := r.db.Exec(ctx,
		`INSERT INTO favorites (user_id, product_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		userID, productID)
	return err
}

func (r *Repository) Remove(ctx context.Context, userID, productID uuid.UUID) error {
	_, err := r.db.Exec(ctx,
		`DELETE FROM favorites WHERE user_id=$1 AND product_id=$2`, userID, productID)
	return err
}

func (r *Repository) ListIDs(ctx context.Context, userID uuid.UUID) ([]uuid.UUID, error) {
	rows, err := r.db.Query(ctx, `SELECT product_id FROM favorites WHERE user_id=$1`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}
