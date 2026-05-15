package cache

import (
	"context"
	"encoding/json"
	"time"

	"github.com/redis/go-redis/v9"
)

// Client wraps redis.Client with JSON helpers.
type Client struct {
	rdb *redis.Client
}

// New connects to Redis using a standard URL (e.g. redis://host:6379).
func New(url string) (*Client, error) {
	opt, err := redis.ParseURL(url)
	if err != nil {
		return nil, err
	}
	rdb := redis.NewClient(opt)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := rdb.Ping(ctx).Err(); err != nil {
		_ = rdb.Close()
		return nil, err
	}
	return &Client{rdb: rdb}, nil
}

// GetJSON reads a key and unmarshals JSON into dest.
// Returns false if key does not exist or on any error.
func (c *Client) GetJSON(ctx context.Context, key string, dest any) bool {
	if c == nil {
		return false
	}
	val, err := c.rdb.Get(ctx, key).Bytes()
	if err != nil {
		return false
	}
	return json.Unmarshal(val, dest) == nil
}

// SetJSON marshals value as JSON and stores it with the given TTL.
// Errors are silently ignored to keep callers simple.
func (c *Client) SetJSON(ctx context.Context, key string, value any, ttl time.Duration) {
	if c == nil {
		return
	}
	data, err := json.Marshal(value)
	if err != nil {
		return
	}
	_ = c.rdb.Set(ctx, key, data, ttl).Err()
}

// Delete removes one or more keys.
func (c *Client) Delete(ctx context.Context, keys ...string) {
	if c == nil || len(keys) == 0 {
		return
	}
	_ = c.rdb.Del(ctx, keys...).Err()
}

// DeleteByPattern removes all keys matching a glob pattern (e.g. "products:*").
func (c *Client) DeleteByPattern(ctx context.Context, pattern string) {
	if c == nil {
		return
	}

	var cursor uint64
	for {
		keys, nextCursor, err := c.rdb.Scan(ctx, cursor, pattern, 100).Result()
		if err != nil {
			return
		}
		if len(keys) > 0 {
			_ = c.rdb.Del(ctx, keys...).Err()
		}
		if nextCursor == 0 {
			return
		}
		cursor = nextCursor
	}
}

func (c *Client) Close() error {
	if c == nil {
		return nil
	}
	return c.rdb.Close()
}
