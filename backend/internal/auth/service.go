package auth

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
	"gopkg.in/gomail.v2"
	"uniloop/backend/internal/config"
	"uniloop/backend/internal/models"
	"uniloop/backend/pkg/cache"
	"uniloop/backend/pkg/messaging"
)

var ErrInvalidSchoolEmail = errors.New("email must be a .edu.my address")

type Service struct {
	db        *pgxpool.Pool
	cfg       *config.Config
	publisher messaging.EventPublisher
	cache     *cache.Client
}

func NewService(db *pgxpool.Pool, cfg *config.Config, pub messaging.EventPublisher, cacheClient *cache.Client) *Service {
	return &Service{db: db, cfg: cfg, publisher: pub, cache: cacheClient}
}

func (s *Service) Register(ctx context.Context, email, password, name string) (*models.AuthResponse, error) {
	if !isSchoolEmail(email) {
		return nil, ErrInvalidSchoolEmail
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var userID uuid.UUID
	err = tx.QueryRow(ctx,
		`INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id`,
		email, string(hash),
	).Scan(&userID)
	if err != nil {
		return nil, fmt.Errorf("email already registered")
	}

	_, err = tx.Exec(ctx,
		`INSERT INTO profiles (id, email, full_name) VALUES ($1, $2, $3)`,
		userID, email, name,
	)
	if err != nil {
		return nil, fmt.Errorf("create profile: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}

	profile, err := s.getProfile(ctx, userID)
	if err != nil {
		return nil, err
	}

	token, err := s.generateToken(userID, false)
	if err != nil {
		return nil, err
	}

	// 异步发送欢迎邮件（软失败，不影响注册结果）
	if s.publisher != nil {
		_ = s.publisher.Publish(ctx, messaging.EmailEvent{
			EventType: "email.welcome",
			To:        email,
			Subject:   "欢迎加入 UniLoop！",
			Body:      fmt.Sprintf("Hi %s，\n\n欢迎加入 UniLoop 校园二手市场！\n\n现在就去发布你的第一件闲置吧。\n\nUniLoop Team", name),
		})
	}

	return &models.AuthResponse{Token: token, Profile: *profile, IsAdmin: false}, nil
}

func (s *Service) Login(ctx context.Context, email, password string) (*models.AuthResponse, error) {
	var userID uuid.UUID
	var hash string
	var isAdmin bool
	err := s.db.QueryRow(ctx,
		`SELECT id, password_hash, COALESCE(is_admin, FALSE) FROM users WHERE email = $1`,
		email,
	).Scan(&userID, &hash, &isAdmin)
	if err != nil {
		return nil, fmt.Errorf("invalid email or password")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)); err != nil {
		return nil, fmt.Errorf("invalid email or password")
	}

	if _, err := s.db.Exec(ctx, `UPDATE profiles SET last_seen_at = NOW() WHERE id = $1`, userID); err == nil {
		s.cache.Delete(ctx, cache.ProfileKey(userID))
	}

	profile, err := s.getProfile(ctx, userID)
	if err != nil {
		return nil, err
	}

	token, err := s.generateToken(userID, isAdmin)
	if err != nil {
		return nil, err
	}

	return &models.AuthResponse{Token: token, Profile: *profile, IsAdmin: isAdmin}, nil
}

func (s *Service) GetProfile(ctx context.Context, userID uuid.UUID) (*models.Profile, error) {
	return s.getProfile(ctx, userID)
}

func (s *Service) SendOTP(ctx context.Context, userID uuid.UUID, email string) error {
	if !isSchoolEmail(email) {
		return ErrInvalidSchoolEmail
	}

	if s.cfg.SMTPHost == "" && s.publisher == nil {
		return fmt.Errorf("email service not configured")
	}

	code, err := generateOTPCode()
	if err != nil {
		return err
	}

	expiresAt := time.Now().Add(time.Duration(s.cfg.OTPExpirySecs) * time.Second)

	_, _ = s.db.Exec(ctx, `UPDATE otp_codes SET used = TRUE WHERE user_id = $1 AND used = FALSE`, userID)

	_, err = s.db.Exec(ctx,
		`INSERT INTO otp_codes (user_id, email, code, expires_at) VALUES ($1, $2, $3, $4)`,
		userID, email, code, expiresAt,
	)
	if err != nil {
		return fmt.Errorf("save otp: %w", err)
	}

	subject := "UniLoop — Verification Code"
	body := fmt.Sprintf("Your verification code is: %s\n\nIt expires in %d minutes.",
		code, s.cfg.OTPExpirySecs/60)

	// Use message queue if publisher is configured (microservices mode)
	if s.publisher != nil {
		return s.publisher.Publish(ctx, messaging.EmailEvent{
			EventType: "email.otp",
			To:        email,
			Subject:   subject,
			Body:      body,
		})
	}

	// Fallback: synchronous SMTP (monolith mode)
	return s.sendEmail(email, subject, body)
}

func (s *Service) VerifyOTP(ctx context.Context, userID uuid.UUID, email, code string) error {
	var otpID uuid.UUID
	err := s.db.QueryRow(ctx,
		`SELECT id FROM otp_codes
		 WHERE user_id = $1 AND email = $2 AND code = $3
		   AND used = FALSE AND expires_at > NOW()
		 ORDER BY created_at DESC LIMIT 1`,
		userID, email, code,
	).Scan(&otpID)
	if err != nil {
		return fmt.Errorf("invalid or expired code")
	}

	_, err = s.db.Exec(ctx, `UPDATE otp_codes SET used = TRUE WHERE id = $1`, otpID)
	if err != nil {
		return err
	}

	_, err = s.db.Exec(ctx,
		`UPDATE profiles SET verification_status = 'verified', updated_at = NOW() WHERE id = $1`,
		userID,
	)
	if err == nil {
		s.cache.Delete(ctx, cache.ProfileKey(userID))
	}
	return err
}

// --- helpers ---

func (s *Service) getProfile(ctx context.Context, userID uuid.UUID) (*models.Profile, error) {
	p := &models.Profile{}
	err := s.db.QueryRow(ctx,
		`SELECT id, email, full_name, school, avatar_url, verification_status, last_seen_at, created_at, updated_at
		 FROM profiles WHERE id = $1`,
		userID,
	).Scan(&p.ID, &p.Email, &p.FullName, &p.School, &p.AvatarURL,
		&p.VerificationStatus, &p.LastSeenAt, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("profile not found")
	}
	return p, nil
}

func (s *Service) generateToken(userID uuid.UUID, isAdmin bool) (string, error) {
	claims := jwt.MapClaims{
		"user_id":  userID.String(),
		"is_admin": isAdmin,
		"exp":      time.Now().Add(30 * 24 * time.Hour).Unix(),
		"iat":      time.Now().Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.cfg.JWTSecret))
}

func generateOTPCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

func isSchoolEmail(email string) bool {
	normalized := strings.ToLower(strings.TrimSpace(email))
	at := strings.LastIndex(normalized, "@")
	if at < 0 || at == len(normalized)-1 {
		return false
	}
	domain := normalized[at+1:]
	return domain != "edu.my" && strings.HasSuffix(domain, ".edu.my")
}

func (s *Service) sendEmail(to, subject, body string) error {
	m := gomail.NewMessage()
	m.SetHeader("From", s.cfg.SMTPFrom)
	m.SetHeader("To", to)
	m.SetHeader("Subject", subject)
	m.SetBody("text/plain", body)

	d := gomail.NewDialer(s.cfg.SMTPHost, s.cfg.SMTPPort, s.cfg.SMTPUser, s.cfg.SMTPPassword)
	return d.DialAndSend(m)
}
