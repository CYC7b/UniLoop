package conversation

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"uniloop/backend/internal/models"
	"uniloop/backend/pkg/cache"
)

const unreadTTL = 15 * time.Second

type Repository struct {
	db    *pgxpool.Pool
	cache *cache.Client
}

func NewRepository(db *pgxpool.Pool, c *cache.Client) *Repository {
	return &Repository{db: db, cache: c}
}

// ListForUser returns all conversations where the user is buyer or seller.
func (r *Repository) ListForUser(ctx context.Context, userID uuid.UUID) ([]models.Conversation, error) {
	rows, err := r.db.Query(ctx, `
		SELECT c.id, c.product_id, c.buyer_id, c.seller_id, c.product_title, c.product_image,
		       c.buyer_name, c.seller_name, c.last_message, c.buyer_unread, c.seller_unread,
		       c.created_at, c.updated_at,
		       COALESCE(p.status, 'deleted') AS product_status
		FROM conversations c
		LEFT JOIN products p ON c.product_id = p.id
		WHERE c.buyer_id=$1 OR c.seller_id=$1
		ORDER BY c.updated_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var convs []models.Conversation
	for rows.Next() {
		c, err := scanConversation(rows)
		if err != nil {
			return nil, err
		}
		c.OtherUserID, c.OtherName, c.UnreadCount = convPOV(*c, userID)
		convs = append(convs, *c)
	}
	return convs, rows.Err()
}

// GetByID returns a conversation with all messages.
func (r *Repository) GetByID(ctx context.Context, id uuid.UUID) (*models.Conversation, error) {
	rows, err := r.db.Query(ctx, `
		SELECT c.id, c.product_id, c.buyer_id, c.seller_id, c.product_title, c.product_image,
		       c.buyer_name, c.seller_name, c.last_message, c.buyer_unread, c.seller_unread,
		       c.created_at, c.updated_at,
		       COALESCE(p.status, 'deleted') AS product_status
		FROM conversations c
		LEFT JOIN products p ON c.product_id = p.id
		WHERE c.id=$1`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	if !rows.Next() {
		return nil, fmt.Errorf("conversation not found")
	}
	c, err := scanConversation(rows)
	if err != nil {
		return nil, err
	}

	// Fetch messages
	msgRows, err := r.db.Query(ctx, `
		SELECT id, conversation_id, sender_id, content, created_at
		FROM messages WHERE conversation_id=$1 ORDER BY created_at ASC`, id)
	if err != nil {
		return nil, err
	}
	defer msgRows.Close()
	for msgRows.Next() {
		var m models.Message
		if err := msgRows.Scan(&m.ID, &m.ConversationID, &m.SenderID, &m.Content, &m.CreatedAt); err != nil {
			return nil, err
		}
		c.Messages = append(c.Messages, m)
	}
	if c.Messages == nil {
		c.Messages = []models.Message{}
	}
	return c, nil
}

// GetParticipants returns buyer_id and seller_id without loading messages.
// Fix #11: lightweight query for broadcast.
func (r *Repository) GetParticipants(ctx context.Context, id uuid.UUID) (buyerID, sellerID uuid.UUID, err error) {
	err = r.db.QueryRow(ctx,
		`SELECT buyer_id, seller_id FROM conversations WHERE id=$1`, id,
	).Scan(&buyerID, &sellerID)
	return
}

// FindByProductAndBuyer finds an existing conversation (for dedup).
func (r *Repository) FindByProductAndBuyer(ctx context.Context, productID, buyerID uuid.UUID) (*uuid.UUID, error) {
	var id uuid.UUID
	err := r.db.QueryRow(ctx,
		`SELECT id FROM conversations WHERE product_id=$1 AND buyer_id=$2`,
		productID, buyerID,
	).Scan(&id)
	if err != nil {
		return nil, nil // not found is OK
	}
	return &id, nil
}

// CreateWithMessage atomically creates a conversation + first message using
// ON CONFLICT to eliminate TOCTOU races (Fix #6).
// Returns the conversation ID and the created message.
func (r *Repository) CreateWithMessage(ctx context.Context,
	productID uuid.UUID, productTitle, productImage string,
	buyerID uuid.UUID, buyerName string,
	sellerID uuid.UUID, sellerName string,
	firstMessage string,
) (uuid.UUID, *models.Message, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return uuid.Nil, nil, err
	}
	defer tx.Rollback(ctx)

	var convID uuid.UUID
	err = tx.QueryRow(ctx, `
		INSERT INTO conversations
			(product_id, buyer_id, seller_id, product_title, product_image,
			 buyer_name, seller_name, last_message, seller_unread)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,1)
		ON CONFLICT (product_id, buyer_id) DO UPDATE
			SET last_message=EXCLUDED.last_message, updated_at=NOW(),
			    seller_unread = conversations.seller_unread + 1
		RETURNING id`,
		productID, buyerID, sellerID, productTitle, productImage,
		buyerName, sellerName, firstMessage,
	).Scan(&convID)
	if err != nil {
		return uuid.Nil, nil, fmt.Errorf("upsert conversation: %w", err)
	}

	var msg models.Message
	err = tx.QueryRow(ctx, `
		INSERT INTO messages (conversation_id, sender_id, content)
		VALUES ($1,$2,$3)
		RETURNING id, conversation_id, sender_id, content, created_at`,
		convID, buyerID, firstMessage,
	).Scan(&msg.ID, &msg.ConversationID, &msg.SenderID, &msg.Content, &msg.CreatedAt)
	if err != nil {
		return uuid.Nil, nil, fmt.Errorf("insert first message: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return uuid.Nil, nil, err
	}
	r.cache.Delete(ctx, cache.UnreadKey(sellerID))
	return convID, &msg, nil
}

// AddMessage inserts a new message and updates conversation summary.
func (r *Repository) AddMessage(ctx context.Context, convID, senderID uuid.UUID, content string) (*models.Message, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var m models.Message
	err = tx.QueryRow(ctx,
		`INSERT INTO messages (conversation_id, sender_id, content) VALUES ($1,$2,$3)
		 RETURNING id, conversation_id, sender_id, content, created_at`,
		convID, senderID, content,
	).Scan(&m.ID, &m.ConversationID, &m.SenderID, &m.Content, &m.CreatedAt)
	if err != nil {
		return nil, err
	}

	// Update last_message and increment unread for the other participant
	_, err = tx.Exec(ctx, `
		UPDATE conversations SET
			last_message=$1,
			updated_at=NOW(),
			buyer_unread  = CASE WHEN seller_id=$2 THEN buyer_unread + 1  ELSE buyer_unread  END,
			seller_unread = CASE WHEN buyer_id=$2  THEN seller_unread + 1 ELSE seller_unread END
		WHERE id=$3`, content, senderID, convID)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	// Invalidate unread cache for both participants (we don't know who's buyer/seller here)
	// They'll be repopulated on next TotalUnread call
	buyerID, sellerID, err := r.GetParticipants(ctx, convID)
	if err == nil {
		r.cache.Delete(ctx, cache.UnreadKey(buyerID), cache.UnreadKey(sellerID))
	}

	return &m, nil
}

// MarkRead resets unread count for the given user.
func (r *Repository) MarkRead(ctx context.Context, convID, userID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		UPDATE conversations SET
			buyer_unread  = CASE WHEN buyer_id=$1  THEN 0 ELSE buyer_unread  END,
			seller_unread = CASE WHEN seller_id=$1 THEN 0 ELSE seller_unread END
		WHERE id=$2`, userID, convID)
	if err == nil {
		r.cache.Delete(ctx, cache.UnreadKey(userID))
	}
	return err
}

// Delete removes a conversation (and cascade-deletes messages).
func (r *Repository) Delete(ctx context.Context, id uuid.UUID) error {
	buyerID, sellerID, participantErr := r.GetParticipants(ctx, id)
	_, err := r.db.Exec(ctx, `DELETE FROM conversations WHERE id=$1`, id)
	if err == nil && participantErr == nil {
		r.cache.Delete(ctx, cache.UnreadKey(buyerID), cache.UnreadKey(sellerID))
	}
	return err
}

// IsParticipant checks whether userID is buyer or seller of the conversation.
func (r *Repository) IsParticipant(ctx context.Context, convID, userID uuid.UUID) (bool, error) {
	var exists bool
	err := r.db.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM conversations WHERE id=$1 AND (buyer_id=$2 OR seller_id=$2))`,
		convID, userID,
	).Scan(&exists)
	return exists, err
}

// TotalUnread returns total unread count across all conversations for a user.
func (r *Repository) TotalUnread(ctx context.Context, userID uuid.UUID) (int, error) {
	// Cache-Aside with short TTL (15s) — badge can tolerate slight staleness
	var cached int
	if r.cache.GetJSON(ctx, cache.UnreadKey(userID), &cached) {
		return cached, nil
	}

	var total int
	err := r.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(
			CASE WHEN buyer_id=$1 THEN buyer_unread ELSE seller_unread END
		), 0)
		FROM conversations WHERE buyer_id=$1 OR seller_id=$1`, userID,
	).Scan(&total)
	if err == nil {
		r.cache.SetJSON(ctx, cache.UnreadKey(userID), total, unreadTTL)
	}
	return total, err
}

func scanConversation(rows interface{ Scan(...any) error }) (*models.Conversation, error) {
	c := &models.Conversation{}
	return c, rows.Scan(
		&c.ID, &c.ProductID, &c.BuyerID, &c.SellerID,
		&c.ProductTitle, &c.ProductImage, &c.BuyerName, &c.SellerName,
		&c.LastMessage, &c.BuyerUnread, &c.SellerUnread,
		&c.CreatedAt, &c.UpdatedAt,
		&c.ProductStatus,
	)
}

// convPOV returns the "other user" and unread count from a given user's perspective.
func convPOV(c models.Conversation, userID uuid.UUID) (otherID uuid.UUID, otherName string, unread int) {
	if c.BuyerID == userID {
		return c.SellerID, c.SellerName, c.BuyerUnread
	}
	return c.BuyerID, c.BuyerName, c.SellerUnread
}
