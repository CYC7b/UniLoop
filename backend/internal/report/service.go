package report

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"uniloop/backend/internal/models"
	"uniloop/backend/pkg/messaging"
)

type Service struct {
	repo       *Repository
	publisher  messaging.EventPublisher
	adminEmail string
}

func NewService(repo *Repository, pub messaging.EventPublisher, adminEmail string) *Service {
	return &Service{repo: repo, publisher: pub, adminEmail: adminEmail}
}

func (s *Service) Create(ctx context.Context, reporterID uuid.UUID, req models.CreateReportRequest) error {
	if err := s.repo.Create(ctx, reporterID, req); err != nil {
		return err
	}

	if s.publisher != nil && s.adminEmail != "" {
		_ = s.publisher.Publish(ctx, messaging.EmailEvent{
			EventType: "report.created",
			To:        s.adminEmail,
			Subject:   "UniLoop — 新举报待处理",
			Body: fmt.Sprintf(
				"收到一条新举报：\n\n类型：%s\n目标 ID：%s\n原因：%s\n\n请登录后台管理系统处理。",
				req.TargetType, req.TargetID, req.Reason,
			),
		})
	}

	return nil
}
