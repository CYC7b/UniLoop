package pagination

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestCursorRoundTrip(t *testing.T) {
	want := Cursor{
		CreatedAt: time.Date(2026, 10, 23, 12, 34, 56, 123456000, time.FixedZone("MYT", 8*3600)),
		ID:        uuid.New(),
	}
	got, err := Decode(want.Encode())
	if err != nil {
		t.Fatalf("Decode: %v", err)
	}
	if !got.CreatedAt.Equal(want.CreatedAt) || got.ID != want.ID {
		t.Fatalf("round trip = %+v, want %+v", got, want)
	}
}

func TestDecodeEmptyIsFirstPage(t *testing.T) {
	got, err := Decode("")
	if err != nil || got != nil {
		t.Fatalf("Decode(\"\") = %v, %v; want nil, nil", got, err)
	}
}

func TestDecodeRejectsGarbage(t *testing.T) {
	for _, s := range []string{"!!", "bm8tc2VwYXJhdG9y", "eHx5"} {
		if _, err := Decode(s); err != ErrInvalidCursor {
			t.Fatalf("Decode(%q) err = %v, want ErrInvalidCursor", s, err)
		}
	}
}

func TestClampLimit(t *testing.T) {
	tests := []struct{ in, want int }{{0, 20}, {-5, 20}, {10, 10}, {500, 50}}
	for _, tt := range tests {
		if got := ClampLimit(tt.in, 20, 50); got != tt.want {
			t.Fatalf("ClampLimit(%d) = %d, want %d", tt.in, got, tt.want)
		}
	}
}
