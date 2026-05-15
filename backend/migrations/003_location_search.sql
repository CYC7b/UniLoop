-- Rebuild search_vector to include location_name so full-text search matches venue names
ALTER TABLE products DROP COLUMN IF EXISTS search_vector;
ALTER TABLE products ADD COLUMN search_vector TSVECTOR
    GENERATED ALWAYS AS (
        to_tsvector('english',
            coalesce(title, '') || ' ' ||
            coalesce(description, '') || ' ' ||
            coalesce(TRIM(SPLIT_PART(location_name, ',', 1)), ''))
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_products_fts ON products USING GIN(search_vector);
