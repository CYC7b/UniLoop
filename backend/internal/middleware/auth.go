package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

const UserIDKey = "userID"
const IsAdminKey = "isAdmin"

type Claims struct {
	UserID  uuid.UUID `json:"user_id"`
	IsAdmin bool      `json:"is_admin"`
	jwt.RegisteredClaims
}

// Auth is a Gin middleware that validates Bearer JWT tokens.
func Auth(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing authorization header"})
			return
		}
		parts := strings.SplitN(header, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid authorization format"})
			return
		}
		tokenStr := parts[1]

		claims := &Claims{}
		token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return []byte(jwtSecret), nil
		})
		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		}

		c.Set(UserIDKey, claims.UserID)
		c.Set(IsAdminKey, claims.IsAdmin)
		c.Next()
	}
}

// AdminOnly requires the authenticated user to have admin privileges.
func AdminOnly() gin.HandlerFunc {
	return func(c *gin.Context) {
		v, exists := c.Get(IsAdminKey)
		if !exists {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "admin access required"})
			return
		}
		isAdmin, ok := v.(bool)
		if !ok || !isAdmin {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "admin access required"})
			return
		}
		c.Next()
	}
}

// OptionalAuth sets UserID if a valid token is present, but doesn't abort.
func OptionalAuth(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" {
			c.Next()
			return
		}
		parts := strings.SplitN(header, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
			c.Next()
			return
		}
		claims := &Claims{}
		token, err := jwt.ParseWithClaims(parts[1], claims, func(t *jwt.Token) (interface{}, error) {
			return []byte(jwtSecret), nil
		})
		if err == nil && token.Valid {
			c.Set(UserIDKey, claims.UserID)
		}
		c.Next()
	}
}

// GetUserID extracts the authenticated user ID from context. Panics if not set.
func GetUserID(c *gin.Context) uuid.UUID {
	v, _ := c.Get(UserIDKey)
	id, _ := v.(uuid.UUID)
	return id
}
