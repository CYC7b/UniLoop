package conversation

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"uniloop/backend/internal/models"
	"uniloop/backend/internal/product"
	"uniloop/backend/internal/profile"
	"uniloop/backend/internal/ws"
	"uniloop/backend/pkg/messaging"
)

var (
	ErrForbidden            = errors.New("forbidden")
	ErrProductNotFound      = errors.New("product not found")
	ErrConversationNotFound = errors.New("conversation not found")
	ErrSelfMessage          = errors.New("cannot message yourself")
)

type Service struct {
	repo        *Repository
	productRepo *product.Repository
	profileRepo *profile.Repository
	hub         *ws.Hub
	publisher   messaging.EventPublisher
}

func NewService(repo *Repository, productRepo *product.Repository, profileRepo *profile.Repository, hub *ws.Hub, pub messaging.EventPublisher) *Service {
	return &Service{repo: repo, productRepo: productRepo, profileRepo: profileRepo, hub: hub, publisher: pub}
}

func (s *Service) ListForUser(ctx context.Context, userID uuid.UUID) ([]models.Conversation, error) {
	return s.repo.ListForUser(ctx, userID)
}

func (s *Service) Create(ctx context.Context, userID uuid.UUID, req models.CreateConversationRequest) (*models.Conversation, error) {
	p, err := s.productRepo.GetByID(ctx, req.ProductID)
	if err != nil {
		return nil, ErrProductNotFound
	}
	if p.OwnerID == userID {
		return nil, ErrSelfMessage
	}

	buyerProfile, err := s.profileRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	sellerProfile, err := s.profileRepo.GetByID(ctx, p.OwnerID)
	if err != nil {
		return nil, err
	}

	productImage := ""
	if len(p.Images) > 0 {
		productImage = p.Images[0]
	}

	convID, msg, err := s.repo.CreateWithMessage(ctx,
		req.ProductID, p.Title, productImage,
		userID, buyerProfile.FullName,
		p.OwnerID, sellerProfile.FullName,
		req.Message,
	)
	if err != nil {
		return nil, err
	}

	s.broadcastMessage(ctx, convID, msg)

	conv, err := s.repo.GetByID(ctx, convID)
	if err != nil {
		return nil, err
	}
	conv.OtherUserID, conv.OtherName, conv.UnreadCount = convPOV(*conv, userID)
	return conv, nil
}

func (s *Service) GetOne(ctx context.Context, userID, id uuid.UUID) (*models.Conversation, error) {
	if err := s.ensureParticipant(ctx, id, userID); err != nil {
		return nil, err
	}
	conv, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, ErrConversationNotFound
	}
	conv.OtherUserID, conv.OtherName, conv.UnreadCount = convPOV(*conv, userID)
	return conv, nil
}

func (s *Service) SendMessage(ctx context.Context, userID, id uuid.UUID, content string) (*models.Message, error) {
	if err := s.ensureParticipant(ctx, id, userID); err != nil {
		return nil, err
	}
	msg, err := s.repo.AddMessage(ctx, id, userID, content)
	if err != nil {
		return nil, err
	}
	s.broadcastMessage(ctx, id, msg)
	return msg, nil
}

func (s *Service) MarkRead(ctx context.Context, userID, id uuid.UUID) error {
	if err := s.ensureParticipant(ctx, id, userID); err != nil {
		return err
	}
	return s.repo.MarkRead(ctx, id, userID)
}

func (s *Service) Delete(ctx context.Context, userID, id uuid.UUID) error {
	if err := s.ensureParticipant(ctx, id, userID); err != nil {
		return err
	}
	return s.repo.Delete(ctx, id)
}

func (s *Service) TotalUnread(ctx context.Context, userID uuid.UUID) (int, error) {
	return s.repo.TotalUnread(ctx, userID)
}

func (s *Service) ensureParticipant(ctx context.Context, convID, userID uuid.UUID) error {
	ok, err := s.repo.IsParticipant(ctx, convID, userID)
	if err != nil {
		return err
	}
	if !ok {
		return ErrForbidden
	}
	return nil
}

func (s *Service) broadcastMessage(ctx context.Context, convID uuid.UUID, msg *models.Message) {
	buyerID, sellerID, err := s.repo.GetParticipants(ctx, convID)
	if err != nil {
		return
	}
	event := ws.ServerEvent{
		Type: ws.EventNewMessage,
		Data: ws.NewMessageEvent{
			ConversationID: convID,
			MessageID:      msg.ID,
			SenderID:       msg.SenderID,
			Content:        msg.Content,
			CreatedAt:      msg.CreatedAt,
		},
	}
	updateEvent := ws.ServerEvent{
		Type: ws.EventConversationUpdate,
		Data: ws.ConversationUpdateEvent{
			ConversationID: convID,
			LastMessage:    msg.Content,
			UpdatedAt:      time.Now(),
		},
	}

	otherID := sellerID
	if msg.SenderID == sellerID {
		otherID = buyerID
	}
	s.hub.SendToUser(otherID, event)
	s.hub.SendToUser(otherID, updateEvent)

	if !s.hub.IsOnline(otherID) && s.publisher != nil {
		otherProfile, err := s.profileRepo.GetByID(ctx, otherID)
		if err == nil && otherProfile.Email != "" {
			senderName := "有人"
			if senderProfile, err := s.profileRepo.GetByID(ctx, msg.SenderID); err == nil {
				senderName = senderProfile.FullName
			}
			_ = s.publisher.Publish(ctx, messaging.EmailEvent{
				EventType: "chat.offline_message",
				To:        otherProfile.Email,
				Subject:   "UniLoop — 你有一条新消息",
				Body:      fmt.Sprintf("%s 给你发了一条消息：\n\n%s\n\n打开 UniLoop 查看并回复。", senderName, msg.Content),
			})
		}
	}
}
