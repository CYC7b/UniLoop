package cache

import "github.com/google/uuid"

const (
	LocationsKey       = "locations"
	LocationsPattern   = "locations*"
	ProductListPattern = "products:*"
)

func ProfileKey(id uuid.UUID) string {
	return "profile:" + id.String()
}

func UnreadKey(userID uuid.UUID) string {
	return "unread:" + userID.String()
}
