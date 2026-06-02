CREATE TABLE IF NOT EXISTS "shamcash_used_transaction_refs" (
  "id" serial PRIMARY KEY,
  "transaction_ref" text NOT NULL UNIQUE,
  "deposit_id" integer REFERENCES "deposits"("id"),
  "user_id" integer REFERENCES "users"("id"),
  "invoice_id" text,
  "amount_usd" numeric(24, 12),
  "amount_syp" numeric(14, 2),
  "currency" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);
