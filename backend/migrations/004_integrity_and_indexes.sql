-- +goose Up
-- Integrity pass: NOT NULL constraints, case-insensitive email uniqueness,
-- query-shaped indexes, FK indexes and one-active-OTP-per-user.

-- Columns that used to be added at runtime by admin.EnsureSchema.
ALTER TABLE products ADD COLUMN IF NOT EXISTS thumbnails TEXT[] DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verification_doc_url TEXT DEFAULT '';

-- ── NOT NULL: backfill, then enforce ────────────────────────────────────────

UPDATE users SET
    is_admin   = COALESCE(is_admin, FALSE),
    created_at = COALESCE(created_at, NOW())
WHERE is_admin IS NULL OR created_at IS NULL;
ALTER TABLE users
    ALTER COLUMN is_admin   SET NOT NULL,
    ALTER COLUMN created_at SET NOT NULL;

UPDATE profiles p SET email = u.email FROM users u WHERE u.id = p.id AND p.email IS NULL;
UPDATE profiles SET
    full_name            = COALESCE(full_name, ''),
    school               = COALESCE(school, ''),
    avatar_url           = COALESCE(avatar_url, ''),
    verification_status  = COALESCE(verification_status, 'unverified'),
    verification_doc_url = COALESCE(verification_doc_url, ''),
    created_at           = COALESCE(created_at, NOW()),
    updated_at           = COALESCE(updated_at, NOW())
WHERE full_name IS NULL OR school IS NULL OR avatar_url IS NULL
   OR verification_status IS NULL OR verification_doc_url IS NULL
   OR created_at IS NULL OR updated_at IS NULL;
ALTER TABLE profiles
    ALTER COLUMN email                SET NOT NULL,
    ALTER COLUMN full_name            SET NOT NULL,
    ALTER COLUMN school               SET NOT NULL,
    ALTER COLUMN avatar_url           SET NOT NULL,
    ALTER COLUMN verification_status  SET NOT NULL,
    ALTER COLUMN verification_doc_url SET NOT NULL,
    ALTER COLUMN created_at           SET NOT NULL,
    ALTER COLUMN updated_at           SET NOT NULL;

UPDATE otp_codes SET
    used       = COALESCE(used, FALSE),
    created_at = COALESCE(created_at, NOW())
WHERE used IS NULL OR created_at IS NULL;
ALTER TABLE otp_codes
    ALTER COLUMN used       SET NOT NULL,
    ALTER COLUMN created_at SET NOT NULL;

-- A NULL status is already invisible to buyers (lists filter on 'active'),
-- so 'removed' keeps current behaviour.
UPDATE products SET
    currency      = COALESCE(currency, 'MYR'),
    description   = COALESCE(description, ''),
    images        = COALESCE(images, '{}'),
    thumbnails    = COALESCE(thumbnails, '{}'),
    category      = COALESCE(category, ''),
    tags          = COALESCE(tags, '{}'),
    location_name = COALESCE(location_name, ''),
    contact_info  = COALESCE(contact_info, '{}'),
    status        = COALESCE(status, 'removed'),
    created_at    = COALESCE(created_at, NOW()),
    updated_at    = COALESCE(updated_at, NOW())
WHERE currency IS NULL OR description IS NULL OR images IS NULL OR thumbnails IS NULL
   OR category IS NULL OR tags IS NULL OR location_name IS NULL OR contact_info IS NULL
   OR status IS NULL OR created_at IS NULL OR updated_at IS NULL;
ALTER TABLE products
    ALTER COLUMN currency      SET NOT NULL,
    ALTER COLUMN description   SET NOT NULL,
    ALTER COLUMN images        SET NOT NULL,
    ALTER COLUMN thumbnails    SET NOT NULL,
    ALTER COLUMN category      SET NOT NULL,
    ALTER COLUMN tags          SET NOT NULL,
    ALTER COLUMN location_name SET NOT NULL,
    ALTER COLUMN contact_info  SET NOT NULL,
    ALTER COLUMN status        SET NOT NULL,
    ALTER COLUMN created_at    SET NOT NULL,
    ALTER COLUMN updated_at    SET NOT NULL;

UPDATE favorites SET created_at = NOW() WHERE created_at IS NULL;
ALTER TABLE favorites ALTER COLUMN created_at SET NOT NULL;

UPDATE conversations SET
    product_title = COALESCE(product_title, ''),
    product_image = COALESCE(product_image, ''),
    buyer_name    = COALESCE(buyer_name, ''),
    seller_name   = COALESCE(seller_name, ''),
    last_message  = COALESCE(last_message, ''),
    buyer_unread  = COALESCE(buyer_unread, 0),
    seller_unread = COALESCE(seller_unread, 0),
    created_at    = COALESCE(created_at, NOW()),
    updated_at    = COALESCE(updated_at, NOW())
WHERE product_title IS NULL OR product_image IS NULL OR buyer_name IS NULL
   OR seller_name IS NULL OR last_message IS NULL OR buyer_unread IS NULL
   OR seller_unread IS NULL OR created_at IS NULL OR updated_at IS NULL;
ALTER TABLE conversations
    ALTER COLUMN product_title SET NOT NULL,
    ALTER COLUMN product_image SET NOT NULL,
    ALTER COLUMN buyer_name    SET NOT NULL,
    ALTER COLUMN seller_name   SET NOT NULL,
    ALTER COLUMN last_message  SET NOT NULL,
    ALTER COLUMN buyer_unread  SET NOT NULL,
    ALTER COLUMN seller_unread SET NOT NULL,
    ALTER COLUMN created_at    SET NOT NULL,
    ALTER COLUMN updated_at    SET NOT NULL;

UPDATE messages SET created_at = NOW() WHERE created_at IS NULL;
ALTER TABLE messages ALTER COLUMN created_at SET NOT NULL;

UPDATE reports SET
    reason     = COALESCE(reason, ''),
    resolved   = COALESCE(resolved, FALSE),
    created_at = COALESCE(created_at, NOW())
WHERE reason IS NULL OR resolved IS NULL OR created_at IS NULL;
ALTER TABLE reports
    ALTER COLUMN reason     SET NOT NULL,
    ALTER COLUMN resolved   SET NOT NULL,
    ALTER COLUMN created_at SET NOT NULL;

-- ── Case-insensitive email uniqueness ──────────────────────────────────────
-- Emails are stored lowercased; the CHECK keeps it that way, so the existing
-- UNIQUE(email) constraint is effectively case-insensitive and plain
-- `email = $1` lookups keep using its index.

-- +goose StatementBegin
DO $$
DECLARE
    dups TEXT;
BEGIN
    SELECT string_agg(e, ', ') INTO dups
    FROM (SELECT lower(btrim(email)) AS e FROM users GROUP BY 1 HAVING COUNT(*) > 1) d;
    IF dups IS NOT NULL THEN
        RAISE EXCEPTION 'users.email has case-insensitive duplicates; merge these accounts first: %', dups;
    END IF;
END $$;
-- +goose StatementEnd

UPDATE users     SET email = lower(btrim(email)) WHERE email <> lower(btrim(email));
UPDATE profiles  SET email = lower(btrim(email)) WHERE email <> lower(btrim(email));
UPDATE otp_codes SET email = lower(btrim(email)) WHERE email <> lower(btrim(email));
ALTER TABLE users ADD CONSTRAINT users_email_normalized CHECK (email = lower(btrim(email)));

-- ── Indexes ────────────────────────────────────────────────────────────────

-- Public listing: WHERE status = 'active' [AND category = $1] ORDER BY created_at DESC.
CREATE INDEX IF NOT EXISTS idx_products_active_created
    ON products (created_at DESC, id DESC) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_products_active_category
    ON products (category, created_at DESC) WHERE status = 'active';
-- Low-selectivity single-column index, superseded by the partial indexes above.
DROP INDEX IF EXISTS idx_products_status;

-- "My listings": WHERE owner_id = $1 ORDER BY created_at DESC.
CREATE INDEX IF NOT EXISTS idx_products_owner_created ON products (owner_id, created_at DESC);
DROP INDEX IF EXISTS idx_products_owner;

-- Indexes on FK columns so ON DELETE CASCADE / SET NULL don't seq-scan.
CREATE INDEX IF NOT EXISTS idx_favorites_product ON favorites (product_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender   ON messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter  ON reports (reporter_id);
-- Covered by the UNIQUE (user_id, product_id) index.
DROP INDEX IF EXISTS idx_favorites_user;

-- Admin queues.
CREATE INDEX IF NOT EXISTS idx_reports_unresolved
    ON reports (created_at DESC) WHERE NOT resolved;
CREATE INDEX IF NOT EXISTS idx_profiles_pending_verification
    ON profiles (created_at DESC) WHERE verification_status = 'pending';

-- ── OTP: one active code per user, bounded attempts ────────────────────────

ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0;

-- Retire all but the newest unused code per user before adding the unique index.
UPDATE otp_codes o SET used = TRUE
WHERE NOT o.used
  AND EXISTS (
      SELECT 1 FROM otp_codes n
      WHERE n.user_id = o.user_id AND NOT n.used
        AND (n.created_at, n.id) > (o.created_at, o.id));
CREATE UNIQUE INDEX IF NOT EXISTS uq_otp_codes_active_user ON otp_codes (user_id) WHERE NOT used;
DROP INDEX IF EXISTS idx_otp_user;

-- +goose Down
CREATE INDEX IF NOT EXISTS idx_otp_user ON otp_codes (user_id, expires_at);
DROP INDEX IF EXISTS uq_otp_codes_active_user;
ALTER TABLE otp_codes DROP COLUMN IF EXISTS attempts;

DROP INDEX IF EXISTS idx_profiles_pending_verification;
DROP INDEX IF EXISTS idx_reports_unresolved;
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites (user_id);
DROP INDEX IF EXISTS idx_reports_reporter;
DROP INDEX IF EXISTS idx_messages_sender;
DROP INDEX IF EXISTS idx_favorites_product;
CREATE INDEX IF NOT EXISTS idx_products_owner ON products (owner_id);
DROP INDEX IF EXISTS idx_products_owner_created;
CREATE INDEX IF NOT EXISTS idx_products_status ON products (status);
DROP INDEX IF EXISTS idx_products_active_category;
DROP INDEX IF EXISTS idx_products_active_created;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_normalized;

ALTER TABLE reports
    ALTER COLUMN reason     DROP NOT NULL,
    ALTER COLUMN resolved   DROP NOT NULL,
    ALTER COLUMN created_at DROP NOT NULL;
ALTER TABLE messages ALTER COLUMN created_at DROP NOT NULL;
ALTER TABLE conversations
    ALTER COLUMN product_title DROP NOT NULL,
    ALTER COLUMN product_image DROP NOT NULL,
    ALTER COLUMN buyer_name    DROP NOT NULL,
    ALTER COLUMN seller_name   DROP NOT NULL,
    ALTER COLUMN last_message  DROP NOT NULL,
    ALTER COLUMN buyer_unread  DROP NOT NULL,
    ALTER COLUMN seller_unread DROP NOT NULL,
    ALTER COLUMN created_at    DROP NOT NULL,
    ALTER COLUMN updated_at    DROP NOT NULL;
ALTER TABLE favorites ALTER COLUMN created_at DROP NOT NULL;
ALTER TABLE products
    ALTER COLUMN currency      DROP NOT NULL,
    ALTER COLUMN description   DROP NOT NULL,
    ALTER COLUMN images        DROP NOT NULL,
    ALTER COLUMN thumbnails    DROP NOT NULL,
    ALTER COLUMN category      DROP NOT NULL,
    ALTER COLUMN tags          DROP NOT NULL,
    ALTER COLUMN location_name DROP NOT NULL,
    ALTER COLUMN contact_info  DROP NOT NULL,
    ALTER COLUMN status        DROP NOT NULL,
    ALTER COLUMN created_at    DROP NOT NULL,
    ALTER COLUMN updated_at    DROP NOT NULL;
ALTER TABLE otp_codes
    ALTER COLUMN used       DROP NOT NULL,
    ALTER COLUMN created_at DROP NOT NULL;
ALTER TABLE profiles
    ALTER COLUMN email                DROP NOT NULL,
    ALTER COLUMN full_name            DROP NOT NULL,
    ALTER COLUMN school               DROP NOT NULL,
    ALTER COLUMN avatar_url           DROP NOT NULL,
    ALTER COLUMN verification_status  DROP NOT NULL,
    ALTER COLUMN verification_doc_url DROP NOT NULL,
    ALTER COLUMN created_at           DROP NOT NULL,
    ALTER COLUMN updated_at           DROP NOT NULL;
ALTER TABLE users
    ALTER COLUMN is_admin   DROP NOT NULL,
    ALTER COLUMN created_at DROP NOT NULL;
