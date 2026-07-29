DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS "product_groups" (
    "id" serial PRIMARY KEY,
    "category_id" integer NOT NULL REFERENCES "categories"("id"),
    "name" text NOT NULL,
    "image" text NOT NULL,
    "order" integer NOT NULL DEFAULT 0,
    "active" boolean NOT NULL DEFAULT true
  );
END $$;

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "group_id" integer REFERENCES "product_groups"("id");

CREATE INDEX IF NOT EXISTS "product_groups_category_id_idx" ON "product_groups" ("category_id");
CREATE INDEX IF NOT EXISTS "products_group_id_idx" ON "products" ("group_id");
