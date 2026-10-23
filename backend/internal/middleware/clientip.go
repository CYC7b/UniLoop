package middleware

import "github.com/gin-gonic/gin"

// TrustProxies decides what c.ClientIP() — and so RateLimit — sees as the
// client address. Only a request whose TCP peer is one of proxies may name the
// client, and only through X-Real-IP, which nginx overwrites with $remote_addr.
// X-Forwarded-For is never read: nginx appends to the client-supplied value,
// so its leftmost entry is whatever the client wrote. With no proxies,
// ClientIP is the TCP peer address.
func TrustProxies(r *gin.Engine, proxies []string) error {
	r.RemoteIPHeaders = []string{"X-Real-IP"}
	return r.SetTrustedProxies(proxies)
}
