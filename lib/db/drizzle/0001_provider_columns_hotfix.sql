ALTER TABLE "products"
ADD COLUMN IF NOT EXISTS "provider_product_id" integer;

ALTER TABLE "providers"
ADD COLUMN IF NOT EXISTS "provider_type" text DEFAULT 'custom';
