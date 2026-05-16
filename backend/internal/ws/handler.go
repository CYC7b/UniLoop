package ws

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

type WSHandler struct {
	hub             *Hub
	jwtSecret       string
	allowedOrigins  map[string]struct{}
	allowAllOrigins bool
}

func NewWSHandler(hub *Hub, jwtSecret string, allowedOrigins []string) *WSHandler {
	h := &WSHandler{
		hub:            hub,
		jwtSecret:      jwtSecret,
		allowedOrigins: make(map[string]struct{}, len(allowedOrigins)),
	}
	for _, origin := range allowedOrigins {
		origin = strings.TrimRight(strings.TrimSpace(origin), "/")
		if origin == "" {
			continue
		}
		if origin == "*" {
			h.allowAllOrigins = true
			continue
		}
		h.allowedOrigins[origin] = struct{}{}
	}
	return h
}

// ServeWS upgrades the connection and registers the client.
func (h *WSHandler) ServeWS(c *gin.Context) {
	protocol, tokenStr := tokenFromRequest(c.Request)
	if tokenStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "token required"})
		return
	}

	userID, err := parseToken(tokenStr, h.jwtSecret)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
		return
	}

	responseHeader := http.Header{}
	if protocol != "" {
		responseHeader.Set("Sec-WebSocket-Protocol", protocol)
	}

	upgrader := websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin:     h.checkOrigin,
	}
	conn, err := upgrader.Upgrade(c.Writer, c.Request, responseHeader)
	if err != nil {
		return
	}

	h.hub.newClient(conn, userID)
}

func (h *WSHandler) checkOrigin(r *http.Request) bool {
	origin := strings.TrimRight(strings.TrimSpace(r.Header.Get("Origin")), "/")
	if origin == "" {
		return true
	}
	if h.allowAllOrigins {
		return true
	}
	_, ok := h.allowedOrigins[origin]
	return ok
}

func tokenFromRequest(r *http.Request) (string, string) {
	if protocol, token := tokenFromSubprotocol(r.Header.Get("Sec-WebSocket-Protocol")); token != "" {
		return protocol, token
	}
	return "", tokenFromAuthorization(r.Header.Get("Authorization"))
}

func tokenFromSubprotocol(header string) (string, string) {
	for _, raw := range strings.Split(header, ",") {
		protocol := strings.TrimSpace(raw)
		if strings.HasPrefix(strings.ToLower(protocol), "bearer.") {
			return protocol, protocol[len("bearer."):]
		}
	}
	return "", ""
}

func tokenFromAuthorization(header string) string {
	parts := strings.SplitN(header, " ", 2)
	if len(parts) == 2 && strings.EqualFold(parts[0], "bearer") {
		return strings.TrimSpace(parts[1])
	}
	return ""
}

// Fix #9: verify signing method same as Auth middleware.
func parseToken(tokenStr, secret string) (uuid.UUID, error) {
	claims := jwt.MapClaims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return []byte(secret), nil
	})
	if err != nil || !token.Valid {
		return uuid.Nil, err
	}
	raw, _ := claims["user_id"].(string)
	return uuid.Parse(raw)
}
