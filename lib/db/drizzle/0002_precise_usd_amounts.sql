ALTER TABLE "users"
  ALTER COLUMN "balance_usd" TYPE numeric(24, 12)
  USING "balance_usd"::numeric(24, 12);

ALTER TABLE "orders"
  ALTER COLUMN "total_usd" TYPE numeric(24, 12)
  USING "total_usd"::numeric(24, 12),
  ALTER COLUMN "cost_usd" TYPE numeric(24, 12)
  USING "cost_usd"::numeric(24, 12);

ALTER TABLE "deposits"
  ALTER COLUMN "amount_usd" TYPE numeric(24, 12)
  USING "amount_usd"::numeric(24, 12);
