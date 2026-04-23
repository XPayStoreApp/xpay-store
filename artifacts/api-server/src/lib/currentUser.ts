import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const DEFAULT_TELEGRAM_ID = "8333183867";
const DEFAULT_USERNAME = "XPayUser";

export async function getOrCreateCurrentUser() {
  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.telegramId, DEFAULT_TELEGRAM_ID))
    .limit(1);
  if (existing.length > 0) return existing[0]!;
  const inserted = await db
    .insert(usersTable)
    .values({
      telegramId: DEFAULT_TELEGRAM_ID,
      username: DEFAULT_USERNAME,
      balanceUsd: "0",
      balanceSyp: "0",
      role: "user",
    })
    .returning();
  return inserted[0]!;
}
