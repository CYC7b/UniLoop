package ws

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestTokenFromRequestUsesWebSocketSubprotocol(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/ws", nil)
	req.Header.Set("Sec-WebSocket-Protocol", "chat, bearer.header.payload.signature")

	protocol, token := tokenFromRequest(req)
	if protocol != "bearer.header.payload.signature" {
		t.Fatalf("protocol = %q", protocol)
	}
	if token != "header.payload.signature" {
		t.Fatalf("token = %q", token)
	}
}

func TestTokenFromRequestUsesAuthorizationHeader(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/ws", nil)
	req.Header.Set("Authorization", "Bearer header.payload.signature")

	protocol, token := tokenFromRequest(req)
	if protocol != "" {
		t.Fatalf("protocol = %q, want empty", protocol)
	}
	if token != "header.payload.signature" {
		t.Fatalf("token = %q", token)
	}
}

func TestTokenFromRequestIgnoresQueryToken(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/ws?token=header.payload.signature", nil)

	protocol, token := tokenFromRequest(req)
	if protocol != "" || token != "" {
		t.Fatalf("query token should not be accepted, got protocol=%q token=%q", protocol, token)
	}
}

func TestCheckOriginAllowsConfiguredOrigin(t *testing.T) {
	handler := NewWSHandler(NewHub(), "secret", []string{"http://localhost:5173"})
	req := httptest.NewRequest(http.MethodGet, "/ws", nil)
	req.Header.Set("Origin", "http://localhost:5173")

	if !handler.checkOrigin(req) {
		t.Fatal("configured origin should be allowed")
	}
}

func TestCheckOriginRejectsUnknownOrigin(t *testing.T) {
	handler := NewWSHandler(NewHub(), "secret", []string{"http://localhost:5173"})
	req := httptest.NewRequest(http.MethodGet, "/ws", nil)
	req.Header.Set("Origin", "https://evil.example")

	if handler.checkOrigin(req) {
		t.Fatal("unknown origin should be rejected")
	}
}

func TestCheckOriginAllowsNonBrowserClients(t *testing.T) {
	handler := NewWSHandler(NewHub(), "secret", []string{"http://localhost:5173"})
	req := httptest.NewRequest(http.MethodGet, "/ws", nil)

	if !handler.checkOrigin(req) {
		t.Fatal("requests without an origin should be allowed")
	}
}
