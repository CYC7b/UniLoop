package middleware

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func newProxiedEngine(t *testing.T, proxies []string, handlers ...gin.HandlerFunc) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	if err := TrustProxies(r, proxies); err != nil {
		t.Fatalf("TrustProxies: %v", err)
	}
	r.Use(handlers...)
	r.GET("/ip", func(c *gin.Context) { c.String(http.StatusOK, c.ClientIP()) })
	return r
}

func TestTrustProxiesClientIP(t *testing.T) {
	tests := []struct {
		name    string
		proxies []string
		remote  string
		headers map[string]string
		want    string
	}{
		{name: "no proxies uses peer", remote: "203.0.113.7:5000",
			headers: map[string]string{"X-Forwarded-For": "1.2.3.4", "X-Real-IP": "1.2.3.4"}, want: "203.0.113.7"},
		{name: "untrusted peer cannot name client", proxies: []string{"10.0.0.0/8"}, remote: "203.0.113.7:5000",
			headers: map[string]string{"X-Real-IP": "1.2.3.4"}, want: "203.0.113.7"},
		{name: "trusted proxy names client via X-Real-IP", proxies: []string{"10.0.0.0/8"}, remote: "10.0.0.2:5000",
			headers: map[string]string{"X-Real-IP": "198.51.100.9"}, want: "198.51.100.9"},
		{name: "spoofed X-Forwarded-For through proxy ignored", proxies: []string{"10.0.0.0/8"}, remote: "10.0.0.2:5000",
			headers: map[string]string{"X-Forwarded-For": "1.2.3.4, 198.51.100.9", "X-Real-IP": "198.51.100.9"}, want: "198.51.100.9"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := newProxiedEngine(t, tt.proxies)
			req := httptest.NewRequest(http.MethodGet, "/ip", nil)
			req.RemoteAddr = tt.remote
			for k, v := range tt.headers {
				req.Header.Set(k, v)
			}
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)
			if got := w.Body.String(); got != tt.want {
				t.Fatalf("ClientIP = %q, want %q", got, tt.want)
			}
		})
	}
}

// Regression: rotating X-Forwarded-For used to give every request a fresh
// rate-limit bucket, so the login limiter never fired.
func TestRateLimitIgnoresSpoofedForwardedFor(t *testing.T) {
	r := newProxiedEngine(t, []string{"10.0.0.0/8"}, RateLimit(5, 10))
	limited := 0
	for i := 0; i < 30; i++ {
		req := httptest.NewRequest(http.MethodGet, "/ip", nil)
		req.RemoteAddr = "10.0.0.2:5000"
		req.Header.Set("X-Real-IP", "198.51.100.9")
		req.Header.Set("X-Forwarded-For", fmt.Sprintf("1.2.3.%d", i))
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		if w.Code == http.StatusTooManyRequests {
			limited++
		}
	}
	if limited < 15 {
		t.Fatalf("only %d of 30 requests were rate limited; spoofed X-Forwarded-For still bypasses the limiter", limited)
	}
}

func TestRateLimitSeparatesClientsBehindProxy(t *testing.T) {
	r := newProxiedEngine(t, []string{"10.0.0.0/8"}, RateLimit(5, 10))
	send := func(client string) int {
		req := httptest.NewRequest(http.MethodGet, "/ip", nil)
		req.RemoteAddr = "10.0.0.2:5000"
		req.Header.Set("X-Real-IP", client)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		return w.Code
	}
	for i := 0; i < 10; i++ {
		send("198.51.100.1")
	}
	if code := send("198.51.100.1"); code != http.StatusTooManyRequests {
		t.Fatalf("11th burst request from same client = %d, want 429", code)
	}
	if code := send("198.51.100.2"); code != http.StatusOK {
		t.Fatalf("other client behind the same proxy = %d, want 200", code)
	}
}
