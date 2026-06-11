# Product Pricing And Quantity Fix Summary

## Checklist

- Added unit pricing columns to `products`.
- Added `product_changes_log`.
- Added provider quantity parsing for `fixed`, `range`, and `list`.
- Added exact 8-decimal arithmetic for unit price and total price.
- Updated order validation to use synchronized database quantity rules.
- Updated catalog pricing to expose the final unit price.
- Updated provider sync to refresh provider unit price and quantity metadata without changing store profit.
- Updated admin product form with read-only provider fields, editable profit/max quantity, and total previews.
- Added unit tests for price addition, price multiplication, and quantity validation.

## SQL

Run through Drizzle or apply the migration:

```sql
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
```

## Pricing Algorithm

The canonical unit price is:

```text
final_unit_price = provider_unit_price + store_profit_per_unit
```

The customer total is always dynamic:

```text
total_price = final_unit_price * requested_quantity
```

Example:

```text
provider_unit_price = 0.00010
store_profit_per_unit = 0.00011
final_unit_price = 0.00021
quantity = 3000
total_price = 0.63000000
```

The implementation uses scaled `BigInt` arithmetic in `artifacts/api-server/src/lib/pricing.ts` to avoid floating point loss.

## Quantity Rules

- `fixed`: requested quantity must equal `min_quantity`.
- `range`: requested quantity must be between `min_quantity` and `max_quantity`.
- `list`: requested quantity must exist in `quantity_values`, then still respects admin `max_quantity`.

## Source Files

- `lib/db/src/schema/index.ts`
- `lib/db/drizzle/0005_product_unit_pricing.sql`
- `artifacts/api-server/src/lib/pricing.ts`
- `artifacts/api-server/src/lib/pricing.test.ts`
- `artifacts/api-server/src/lib/provider-adapters.ts`
- `artifacts/api-server/src/lib/mersal-adapter.ts`
- `artifacts/api-server/src/routes/orders.ts`
- `artifacts/api-server/src/routes/catalog.ts`
- `artifacts/api-server/src/routes/admin.ts`
- `artifacts/xpay-admin/src/components/Crud.tsx`
- `artifacts/xpay-admin/src/pages/Products.tsx`

## Deployment

1. Push the code.
2. Apply database changes:

```powershell
cd C:\Users\Windows_OS\Desktop\xpay-store\lib\db
pnpm run push
```

3. Redeploy the API server on Render.
4. Redeploy the admin panel on Vercel.
5. Run provider sync from the admin panel for each provider.

## Verification Commands

```powershell
cd C:\Users\Windows_OS\Desktop\xpay-store\lib\db
..\..\node_modules\.bin\tsc.CMD -p tsconfig.json --noEmit

cd C:\Users\Windows_OS\Desktop\xpay-store\artifacts\api-server
..\..\node_modules\.bin\tsc.CMD -p tsconfig.json --noEmit
npm run test:pricing
```

## Notes

- Existing legacy fields remain for compatibility: `price_usd`, `base_price_usd`, `min_qty`, and `max_qty`.
- New calculations prefer the new fields and fall back to legacy values only for old rows.
- The current admin typecheck has an unrelated existing issue in `src/pages/Providers.tsx` where `HTMLElement.cells` is used.
