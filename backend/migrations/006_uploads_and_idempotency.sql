-- +goose Up
-- Track uploaded product images so a listing can claim them atomically and
-- unclaimed files can be garbage-collected; make listing creation idempotent.

CREATE TABLE IF NOT EXISTS uploads (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url        TEXT NOT NULL UNIQUE,
    -- SET NULL (not CASCADE) so deleting a user or product leaves an orphan
    -- row behind for the janitor to delete the file.
    owner_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_uploads_product  ON uploads (product_id);
CREATE INDEX IF NOT EXISTS idx_uploads_orphaned ON uploads (created_at) WHERE product_id IS NULL;

-- Register images of existing listings. URLs shared by several listings are
-- left untracked so the janitor can never delete a file still in use.
INSERT INTO uploads (url, owner_id, product_id, created_at)
SELECT u.url, MIN(p.owner_id::text)::uuid, MIN(p.id::text)::uuid, MIN(p.created_at)
FROM products p, LATERAL unnest(p.images || p.thumbnails) AS u(url)
WHERE u.url <> ''
GROUP BY u.url
HAVING COUNT(DISTINCT p.id) = 1
ON CONFLICT (url) DO NOTHING;

ALTER TABLE products ADD COLUMN IF NOT EXISTS idempotency_key UUID;
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_owner_idempotency
    ON products (owner_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- +goose Down
DROP INDEX IF EXISTS uq_products_owner_idempotency;
ALTER TABLE products DROP COLUMN IF EXISTS idempotency_key;
DROP TABLE IF EXISTS uploads;
