-- +goose Up
-- Listing prices can't be negative. Handlers validate this too; the CHECK
-- guards every other writer. It is added NOT VALID so negative prices written
-- before this migration can't block startup, and validated when there are none.

ALTER TABLE products ADD CONSTRAINT products_price_nonnegative CHECK (price >= 0) NOT VALID;

-- +goose StatementBegin
DO $$
DECLARE
    bad BIGINT;
BEGIN
    SELECT COUNT(*) INTO bad FROM products WHERE price < 0;
    IF bad = 0 THEN
        ALTER TABLE products VALIDATE CONSTRAINT products_price_nonnegative;
    ELSE
        RAISE WARNING 'products has % negative price(s); fix them, then run: ALTER TABLE products VALIDATE CONSTRAINT products_price_nonnegative', bad;
    END IF;
END $$;
-- +goose StatementEnd

-- +goose Down
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_price_nonnegative;
