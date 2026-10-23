// Package httperr writes error responses that keep internal details server-side.
package httperr

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Internal responds 500 with a generic message. The real error is attached to
// the request, so gin.Logger prints it on the request's access-log line,
// instead of reaching the client with table names, hosts or credentials.
func Internal(c *gin.Context, err error) {
	_ = c.Error(err)
	c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
}
