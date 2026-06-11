DO $$ BEGIN
  CREATE TYPE quantity_type AS ENUM ('fixed', 'range', 'list');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE product_change_type AS ENUM ('profit', 'max_quantity');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS provider_unit_price NUMERIC(16, 8),
ADD COLUMN IF NOT EXISTS store_profit_per_unit NUMERIC(16, 8) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS final_unit_price NUMERIC(16, 8),
ADD COLUMN IF NOT EXISTS min_quantity INTEGER,
ADD COLUMN IF NOT EXISTS max_quantity INTEGER,
ADD COLUMN IF NOT EXISTS quantity_type quantity_type NOT NULL DEFAULT 'fixed',
ADD COLUMN IF NOT EXISTS quantity_values JSONB;

UPDATE products
SET
  provider_unit_price = COALESCE(provider_unit_price, base_price_usd, 0),
  store_profit_per_unit = COALESCE(store_profit_per_unit, price_usd, 0),
  final_unit_price = COALESCE(provider_unit_price, base_price_usd, 0) + COALESCE(store_profit_per_unit, price_usd, 0),
  min_quantity = COALESCE(min_quantity, NULLIF(min_qty, 0)::INTEGER, 1),
  max_quantity = COALESCE(max_quantity, NULLIF(max_qty, 0)::INTEGER),
  quantity_type = COALESCE(quantity_type, 'fixed'::quantity_type);

CREATE TABLE IF NOT EXISTS product_changes_log (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  change_type product_change_type NOT NULL,
  old_value TEXT,
  new_value TEXT,
  provider_snapshot JSONB,
  admin_id INTEGER REFERENCES admins(id),
  changed_at TIMESTAMP NOT NULL DEFAULT NOW()
);
