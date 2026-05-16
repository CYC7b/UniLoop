package models

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID           uuid.UUID `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	CreatedAt    time.Time `json:"created_at"`
}

type Profile struct {
	ID                 uuid.UUID  `json:"id"`
	Email              string     `json:"email"`
	FullName           string     `json:"full_name"`
	School             string     `json:"school"`
	AvatarURL          string     `json:"avatar_url"`
	VerificationStatus string     `json:"verification_status"` // unverified | pending | verified
	LastSeenAt         *time.Time `json:"last_seen_at,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

type ContactInfo struct {
	WhatsApp  string `json:"whatsapp,omitempty"`
	WeChat    string `json:"wechat,omitempty"`
	Instagram string `json:"instagram,omitempty"`
}

type Product struct {
	ID           uuid.UUID   `json:"id"`
	Title        string      `json:"title"`
	Price        float64     `json:"price"`
	Currency     string      `json:"currency"`
	Description  string      `json:"description"`
	Images       []string    `json:"images"`
	Thumbnails   []string    `json:"thumbnails"`
	Category     string      `json:"category"`
	Tags         []string    `json:"tags"`
	LocationName string      `json:"location_name"`
	Lat          *float64    `json:"lat,omitempty"`
	Lng          *float64    `json:"lng,omitempty"`
	OwnerID      uuid.UUID   `json:"owner_id"`
	ContactInfo  ContactInfo `json:"contact_info"`
	Status       string      `json:"status"`
	CreatedAt    time.Time   `json:"created_at"`
	UpdatedAt    time.Time   `json:"updated_at"`
}

type Favorite struct {
	ID        uuid.UUID `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	ProductID uuid.UUID `json:"product_id"`
	CreatedAt time.Time `json:"created_at"`
}

type Conversation struct {
	ID           uuid.UUID  `json:"id"`
	ProductID    *uuid.UUID `json:"product_id,omitempty"`
	BuyerID      uuid.UUID  `json:"buyer_id"`
	SellerID     uuid.UUID  `json:"seller_id"`
	ProductTitle string     `json:"product_title"`
	ProductImage string     `json:"product_image"`
	BuyerName    string     `json:"buyer_name"`
	SellerName   string     `json:"seller_name"`
	LastMessage  string     `json:"last_message"`
	BuyerUnread  int        `json:"buyer_unread"`
	SellerUnread int        `json:"seller_unread"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
	// Computed per-request fields
	Messages      []Message `json:"messages,omitempty"`
	UnreadCount   int       `json:"unread_count"`
	OtherUserID   uuid.UUID `json:"other_user_id"`
	OtherName     string    `json:"other_name"`
	ProductStatus string    `json:"product_status"`
}

type Message struct {
	ID             uuid.UUID `json:"id"`
	ConversationID uuid.UUID `json:"conversation_id"`
	SenderID       uuid.UUID `json:"sender_id"`
	Content        string    `json:"content"`
	CreatedAt      time.Time `json:"created_at"`
}

type Report struct {
	ID         uuid.UUID `json:"id"`
	ReporterID uuid.UUID `json:"reporter_id"`
	TargetType string    `json:"target_type"` // product | user | conversation
	TargetID   uuid.UUID `json:"target_id"`
	Reason     string    `json:"reason"`
	CreatedAt  time.Time `json:"created_at"`
}

// --- Request / Response DTOs ---

type RegisterRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
	Name     string `json:"name" binding:"required"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type AuthResponse struct {
	Token   string  `json:"token"`
	Profile Profile `json:"profile"`
	IsAdmin bool    `json:"is_admin"`
}

type SendOTPRequest struct {
	Email string `json:"email" binding:"required,email"`
}

type VerifyOTPRequest struct {
	Email string `json:"email" binding:"required,email"`
	Code  string `json:"code" binding:"required"`
}

type UpdateProfileRequest struct {
	Name   string `json:"name"`
	School string `json:"school"`
}

type CreateProductRequest struct {
	Title        string      `json:"title" binding:"required"`
	Price        float64     `json:"price" binding:"required"`
	Currency     string      `json:"currency"`
	Description  string      `json:"description"`
	Images       []string    `json:"images" binding:"required,min=1"`
	Thumbnails   []string    `json:"thumbnails"`
	Category     string      `json:"category" binding:"required"`
	Tags         []string    `json:"tags"`
	LocationName string      `json:"location_name" binding:"required"`
	Lat          *float64    `json:"lat"`
	Lng          *float64    `json:"lng"`
	ContactInfo  ContactInfo `json:"contact_info"`
}

// UpdateProductRequest uses pointers so nil = "not provided" vs zero-value = "set to empty/zero".
type UpdateProductRequest struct {
	Title        *string      `json:"title"`
	Price        *float64     `json:"price"`
	Currency     *string      `json:"currency"`
	Description  *string      `json:"description"`
	Images       []string     `json:"images"`
	Thumbnails   []string     `json:"thumbnails"`
	Category     *string      `json:"category"`
	Tags         []string     `json:"tags"`
	LocationName *string      `json:"location_name"`
	Lat          *float64     `json:"lat"`
	Lng          *float64     `json:"lng"`
	ContactInfo  *ContactInfo `json:"contact_info"`
}

type CreateConversationRequest struct {
	ProductID uuid.UUID `json:"product_id" binding:"required"`
	Message   string    `json:"message" binding:"required"`
}

type SendMessageRequest struct {
	Content string `json:"content" binding:"required"`
}

type CreateReportRequest struct {
	TargetType string    `json:"target_type" binding:"required"`
	TargetID   uuid.UUID `json:"target_id" binding:"required"`
	Reason     string    `json:"reason"`
}

type AddFavoriteRequest struct {
	ProductID uuid.UUID `json:"product_id" binding:"required"`
}
