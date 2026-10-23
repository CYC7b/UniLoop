// Package pagination implements opaque keyset cursors over (created_at, id).
package pagination

import (
	"encoding/base64"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
)

var ErrInvalidCursor = errors.New("invalid cursor")

// Cursor identifies the last row of a page. The next page continues with rows
// strictly after it in (created_at DESC, id DESC) order.
type Cursor struct {
	CreatedAt time.Time
	ID        uuid.UUID
}

func (c Cursor) Encode() string {
	raw := c.CreatedAt.UTC().Format(time.RFC3339Nano) + "|" + c.ID.String()
	return base64.RawURLEncoding.EncodeToString([]byte(raw))
}

// Decode parses a cursor produced by Encode. An empty string means "first page"
// and yields nil.
func Decode(s string) (*Cursor, error) {
	if s == "" {
		return nil, nil
	}
	raw, err := base64.RawURLEncoding.DecodeString(s)
	if err != nil {
		return nil, ErrInvalidCursor
	}
	ts, id, ok := strings.Cut(string(raw), "|")
	if !ok {
		return nil, ErrInvalidCursor
	}
	createdAt, err := time.Parse(time.RFC3339Nano, ts)
	if err != nil {
		return nil, ErrInvalidCursor
	}
	uid, err := uuid.Parse(id)
	if err != nil {
		return nil, ErrInvalidCursor
	}
	return &Cursor{CreatedAt: createdAt, ID: uid}, nil
}

// ClampLimit applies the default page size and an upper bound.
func ClampLimit(limit, def, max int) int {
	if limit <= 0 {
		return def
	}
	if limit > max {
		return max
	}
	return limit
}
