-- UniLoop — Go backend schema
-- Run: psql $DATABASE_URL -f migrations/001_init.sql

-- Users (replaces Supabase auth.users)
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles
CREATE TABLE IF NOT EXISTS profiles (
    id                  UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    email               TEXT,
    full_name           TEXT,
    school              TEXT DEFAULT 'Universiti Malaya (UM)',
    avatar_url          TEXT DEFAULT '',
    verification_status TEXT DEFAULT 'unverified'
                            CHECK (verification_status IN ('unverified','pending','verified')),
    last_seen_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- OTP codes for email verification
CREATE TABLE IF NOT EXISTS otp_codes (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email      TEXT NOT NULL,
    code       TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used       BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_otp_user ON otp_codes(user_id, expires_at);

-- Products
CREATE TABLE IF NOT EXISTS products (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title         TEXT NOT NULL,
    price         NUMERIC(10,2) NOT NULL,
    currency      TEXT DEFAULT 'MYR',
    description   TEXT DEFAULT '',
    images        TEXT[] DEFAULT '{}',
    category      TEXT DEFAULT '',
    tags          TEXT[] DEFAULT '{}',
    location_name TEXT DEFAULT '',
    lat           DOUBLE PRECISION,
    lng           DOUBLE PRECISION,
    owner_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_info  JSONB DEFAULT '{}',
    status        TEXT DEFAULT 'active' CHECK (status IN ('active','sold','removed')),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_category   ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_owner      ON products(owner_id);
CREATE INDEX IF NOT EXISTS idx_products_status     ON products(status);

-- Full-text search vector (optional, improves search performance)
ALTER TABLE products ADD COLUMN IF NOT EXISTS search_vector TSVECTOR
    GENERATED ALWAYS AS (
        to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,''))
    ) STORED;
CREATE INDEX IF NOT EXISTS idx_products_fts ON products USING GIN(search_vector);

-- Favorites
CREATE TABLE IF NOT EXISTS favorites (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);

-- Conversations
CREATE TABLE IF NOT EXISTS conversations (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id    UUID REFERENCES products(id) ON DELETE SET NULL,
    buyer_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seller_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_title TEXT DEFAULT '',
    product_image TEXT DEFAULT '',
    buyer_name    TEXT DEFAULT '',
    seller_name   TEXT DEFAULT '',
    last_message  TEXT DEFAULT '',
    buyer_unread  INT DEFAULT 0,
    seller_unread INT DEFAULT 0,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(product_id, buyer_id)
);
CREATE INDEX IF NOT EXISTS idx_conversations_buyer  ON conversations(buyer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_seller ON conversations(seller_id);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content         TEXT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);

-- Reports
CREATE TABLE IF NOT EXISTS reports (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID REFERENCES users(id) ON DELETE SET NULL,
    target_type TEXT NOT NULL CHECK (target_type IN ('product','user','conversation')),
    target_id   UUID NOT NULL,
    reason      TEXT DEFAULT '',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
