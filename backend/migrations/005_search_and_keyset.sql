-- +goose Up
-- Search and keyset-pagination support: an indexable venue column,
-- trigram indexes for substring search, and (created_at, id) ordered indexes.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Venue name before the first comma. Used by the location filter, the
-- locations list and search; stored so it can be indexed and grouped.
ALTER TABLE products ADD COLUMN IF NOT EXISTS location_short TEXT
    GENERATED ALWAYS AS (TRIM(SPLIT_PART(location_name, ',', 1))) STORED;

-- Listings page by (created_at DESC, id DESC); id breaks timestamp ties.
DROP INDEX IF EXISTS idx_products_active_category;
CREATE INDEX IF NOT EXISTS idx_products_active_category_keyset
    ON products (category, created_at DESC, id DESC) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_products_active_location_keyset
    ON products (location_short, created_at DESC, id DESC) WHERE status = 'active';

-- Substring search (ILIKE '%term%') on active listings.
CREATE INDEX IF NOT EXISTS idx_products_active_title_trgm
    ON products USING GIN (title gin_trgm_ops) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_products_active_location_trgm
    ON products USING GIN (location_short gin_trgm_ops) WHERE status = 'active';

-- Chat history pages newest-first by (created_at, id) within a conversation.
DROP INDEX IF EXISTS idx_messages_conv;
CREATE INDEX IF NOT EXISTS idx_messages_conv_keyset ON messages (conversation_id, created_at, id);

-- +goose Down
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages (conversation_id, created_at);
DROP INDEX IF EXISTS idx_messages_conv_keyset;
DROP INDEX IF EXISTS idx_products_active_location_trgm;
DROP INDEX IF EXISTS idx_products_active_title_trgm;
DROP INDEX IF EXISTS idx_products_active_location_keyset;
CREATE INDEX IF NOT EXISTS idx_products_active_category
    ON products (category, created_at DESC) WHERE status = 'active';
DROP INDEX IF EXISTS idx_products_active_category_keyset;
ALTER TABLE products DROP COLUMN IF EXISTS location_short;
