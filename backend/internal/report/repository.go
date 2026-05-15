package report

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"uniloop/backend/internal/models"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, reporterID uuid.UUID, req models.CreateReportRequest) error {
	_, err := r.db.Exec(ctx,
		`INSERT INTO reports (reporter_id, target_type, target_id, reason)
		 VALUES ($1, $2, $3, $4)`,
		reporterID, req.TargetType, req.TargetID, req.Reason,
	)
	return err
}
