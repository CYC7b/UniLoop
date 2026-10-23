package admin

import (
	"context"
	"log"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

// SeedAdmin creates or updates an admin user from env config.
func SeedAdmin(db *pgxpool.Pool, email, password string) {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" || password == "" {
		return
	}
	ctx := context.Background()

	var exists bool
	_ = db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE email=$1)`, email).Scan(&exists)
	if exists {
		_, _ = db.Exec(ctx, `UPDATE users SET is_admin=TRUE WHERE email=$1`, email)
		log.Printf("admin user ensured: %s", email)
		return
	}

	// Admin exists with a different email (config changed) — update to new email.
	var oldEmail string
	_ = db.QueryRow(ctx, `SELECT email FROM users WHERE is_admin=TRUE LIMIT 1`).Scan(&oldEmail)
	if oldEmail != "" {
		_, _ = db.Exec(ctx, `UPDATE users    SET email=$1 WHERE email=$2`, email, oldEmail)
		_, _ = db.Exec(ctx, `UPDATE profiles SET email=$1 WHERE email=$2`, email, oldEmail)
		log.Printf("admin email updated: %s → %s", oldEmail, email)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("seed admin hash: %v", err)
		return
	}

	tx, err := db.Begin(ctx)
	if err != nil {
		return
	}
	defer tx.Rollback(ctx)

	var userID uuid.UUID
	err = tx.QueryRow(ctx,
		`INSERT INTO users (email, password_hash, is_admin) VALUES ($1, $2, TRUE) RETURNING id`,
		email, string(hash),
	).Scan(&userID)
	if err != nil {
		log.Printf("seed admin: %v", err)
		return
	}

	_, _ = tx.Exec(ctx,
		`INSERT INTO profiles (id, email, full_name, verification_status) VALUES ($1, $2, 'Admin', 'verified')`,
		userID, email,
	)
	if err := tx.Commit(ctx); err != nil {
		log.Printf("seed admin commit: %v", err)
		return
	}
	log.Printf("admin user created: %s", email)
}
