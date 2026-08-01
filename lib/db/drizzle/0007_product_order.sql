ALTER TABLE "products"
ADD COLUMN IF NOT EXISTS "order" integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "products_order_idx" ON "products" ("order", "id");
