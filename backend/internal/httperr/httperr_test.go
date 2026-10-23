package httperr

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestInternalHidesErrorFromClient(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	secret := errors.New(`begin tx: failed to connect to user=uniloop database=uniloop`)

	Internal(c, secret)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", w.Code)
	}
	if body := w.Body.String(); strings.Contains(body, "uniloop") || !strings.Contains(body, "internal server error") {
		t.Fatalf("body = %s, want only a generic message", body)
	}
	if len(c.Errors) != 1 || !errors.Is(c.Errors[0].Err, secret) {
		t.Fatalf("c.Errors = %v, want the original error kept for the access log", c.Errors)
	}
}
