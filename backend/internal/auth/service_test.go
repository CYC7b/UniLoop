package auth

import (
	"errors"
	"fmt"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
)

func TestIsSchoolEmail(t *testing.T) {
	tests := []struct {
		name  string
		email string
		want  bool
	}{
		{name: "student subdomain", email: "student@university.edu.my", want: true},
		{name: "case insensitive", email: "Student@UNIVERSITY.EDU.MY", want: true},
		{name: "trim space", email: " student@faculty.university.edu.my ", want: true},
		{name: "root domain rejected", email: "student@edu.my", want: false},
		{name: "lookalike domain rejected", email: "student@notedu.my", want: false},
		{name: "suffix attack rejected", email: "student@university.edu.my.evil.test", want: false},
		{name: "non school email rejected", email: "student@example.com", want: false},
		{name: "missing at rejected", email: "student.edu.my", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isSchoolEmail(tt.email); got != tt.want {
				t.Fatalf("isSchoolEmail(%q) = %v, want %v", tt.email, got, tt.want)
			}
		})
	}
}

func TestUserInsertError(t *testing.T) {
	unique := &pgconn.PgError{Code: "23505", ConstraintName: "users_email_key"}
	tests := []struct {
		name      string
		err       error
		wantTaken bool
	}{
		{name: "unique violation", err: unique, wantTaken: true},
		{name: "wrapped unique violation", err: fmt.Errorf("insert: %w", unique), wantTaken: true},
		{name: "check violation", err: &pgconn.PgError{Code: "23514"}, wantTaken: false},
		{name: "trigger exception", err: &pgconn.PgError{Code: "P0001", Message: "injected"}, wantTaken: false},
		{name: "connection error", err: errors.New("failed to connect to `user=uniloop`"), wantTaken: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := userInsertError(tt.err)
			if taken := errors.Is(got, ErrEmailTaken); taken != tt.wantTaken {
				t.Fatalf("userInsertError(%v) = %v, ErrEmailTaken=%v want %v", tt.err, got, taken, tt.wantTaken)
			}
			if !tt.wantTaken && !errors.Is(got, tt.err) {
				t.Fatalf("server error %v should wrap the cause %v", got, tt.err)
			}
		})
	}
}
