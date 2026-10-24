package app

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"uniloop/backend/internal/config"
)

func testConfig(trustedProxies ...string) *config.Config {
	return &config.Config{
		AllowedOrigins: []string{"http://localhost:5173"},
		TrustedProxies: trustedProxies,
	}
}

func newTestRouter(t *testing.T, trustedProxies ...string) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)
	r, err := newBaseRouter(testConfig(trustedProxies...))
	if err != nil {
		t.Fatalf("newBaseRouter: %v", err)
	}
	r.GET("/ip", func(c *gin.Context) { c.String(http.StatusOK, c.ClientIP()) })
	return r
}

func get(r *gin.Engine, remoteAddr, forwardedFor string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, "/ip", nil)
	req.RemoteAddr = remoteAddr
	if forwardedFor != "" {
		req.Header.Set("X-Forwarded-For", forwardedFor)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestClientIPIgnoresForwardedForFromUntrustedPeer(t *testing.T) {
	r := newTestRouter(t)
	w := get(r, "203.0.113.7:4321", "1.2.3.4")
	if got := w.Body.String(); got != "203.0.113.7" {
		t.Fatalf("ClientIP() = %q, want the TCP peer 203.0.113.7", got)
	}
}

func TestClientIPHonoursForwardedForFromTrustedProxy(t *testing.T) {
	r := newTestRouter(t, "10.0.0.0/8")
	w := get(r, "10.1.2.3:4321", "198.51.100.9")
	if got := w.Body.String(); got != "198.51.100.9" {
		t.Fatalf("ClientIP() = %q, want forwarded client 198.51.100.9", got)
	}
}

func TestRateLimitCannotBeBypassedWithSpoofedForwardedFor(t *testing.T) {
	r := newTestRouter(t)
	// The base router allows a burst of 40; rotating X-Forwarded-For must not
	// give each request a fresh bucket.
	for i := 0; i < 40; i++ {
		if w := get(r, "203.0.113.7:4321", fmt.Sprintf("1.2.3.%d", i)); w.Code != http.StatusOK {
			t.Fatalf("request %d: status %d, want 200", i, w.Code)
		}
	}
	if w := get(r, "203.0.113.7:4321", "9.9.9.9"); w.Code != http.StatusTooManyRequests {
		t.Fatalf("status %d after burst, want 429", w.Code)
	}
}

func TestNewBaseRouterRejectsInvalidTrustedProxy(t *testing.T) {
	if _, err := newBaseRouter(testConfig("not-an-ip")); err == nil {
		t.Fatal("newBaseRouter accepted an invalid trusted proxy")
	}
}
