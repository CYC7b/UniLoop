package favorite

import (
	"context"

	"github.com/google/uuid"
	"uniloop/backend/internal/models"
	"uniloop/backend/internal/product"
)

type Service struct {
	repo        *Repository
	productRepo *product.Repository
}

func NewService(repo *Repository, productRepo *product.Repository) *Service {
	return &Service{repo: repo, productRepo: productRepo}
}

func (s *Service) List(ctx context.Context, userID uuid.UUID) ([]models.Product, []uuid.UUID, error) {
	items, err := s.productRepo.GetFavorited(ctx, userID)
	if err != nil {
		return nil, nil, err
	}
	ids := make([]uuid.UUID, len(items))
	for i, p := range items {
		ids[i] = p.ID
	}
	return items, ids, nil
}

func (s *Service) ListIDs(ctx context.Context, userID uuid.UUID) ([]uuid.UUID, error) {
	return s.repo.ListIDs(ctx, userID)
}

func (s *Service) Add(ctx context.Context, userID, productID uuid.UUID) error {
	return s.repo.Add(ctx, userID, productID)
}

func (s *Service) Remove(ctx context.Context, userID, productID uuid.UUID) error {
	return s.repo.Remove(ctx, userID, productID)
}
