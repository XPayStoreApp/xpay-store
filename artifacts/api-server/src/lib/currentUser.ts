import type { Request } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const DEFAULT_TELEGRAM_ID = "8333183867";
const DEFAULT_USERNAME = "XPayUser";

function normalizeUsername(input?: string | null): string {
  const raw = (input || "").trim();
  if (!raw) return DEFAULT_USERNAME;
  return raw.slice(0, 64);
}

function readIdentityFromInitData(initDataRaw?: string): { telegramId: string; username: string } | null {
  try {
    const raw = String(initDataRaw || "").trim();
    if (!raw) return null;
    const p = new URLSearchParams(raw);
    const userRaw = p.get("user");
    if (!userRaw) return null;
    const user = JSON.parse(userRaw);
    if (!user?.id) return null;
    const username = normalizeUsername(
      String(user.username || `${user.first_name || ""} ${user.last_name || ""}`.trim() || DEFAULT_USERNAME),
    );
    return { telegramId: String(user.id), username };
  } catch {
    return null;
  }
}

function readTelegramIdentity(req?: Request): { telegramId: string; username: string } {
  const hdr = req?.headers || {};
  const initDataRaw = hdr["x-telegram-init-data"] as string | undefined;
  const parsedFromInitData = readIdentityFromInitData(initDataRaw);
  if (parsedFromInitData?.telegramId) return parsedFromInitData;

  const tgIdRaw =
    (hdr["x-telegram-id"] as string | undefined) ||
    (req?.query?.["tg_id"] as string | undefined);
  const usernameRaw =
    (hdr["x-telegram-username"] as string | undefined) ||
    [hdr["x-telegram-first-name"], hdr["x-telegram-last-name"]]
      .filter(Boolean)
      .join(" ") ||
    DEFAULT_USERNAME;

  const telegramId = String(tgIdRaw || "").trim();
  if (!telegramId) {
    const allowFallback = process.env.ALLOW_DEFAULT_TELEGRAM_ID === "true";
    if (allowFallback) {
      return {
        telegramId: DEFAULT_TELEGRAM_ID,
        username: normalizeUsername(String(usernameRaw)),
      };
    }
    const err: any = new Error("telegram_identity_missing");
    err.statusCode = 401;
    err.publicMessage = "هوية تيليجرام غير متاحة. افتح المتجر من داخل Telegram Mini App.";
    throw err;
  }

  return {
    telegramId,
    username: normalizeUsername(String(usernameRaw)),
  };
}

export function getShortAccountId(telegramId: string): string {
  const digits = String(telegramId).replace(/\D/g, "");
  const n = digits ? Number(digits.slice(-10)) : 0;
  const short = ((n % 9000) + 1000).toString();
  return short.padStart(4, "0");
}

export async function getOrCreateCurrentUser(req?: Request) {
  const identity = readTelegramIdentity(req);
  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.telegramId, identity.telegramId))
    .limit(1);
  if (existing.length > 0) {
    const current = existing[0]!;
    if (!current.username || current.username === DEFAULT_USERNAME) {
      const [updated] = await db
        .update(usersTable)
        .set({ username: identity.username })
        .where(eq(usersTable.id, current.id))
        .returning();
      return updated ?? current;
    }
    return current;
  }
  const inserted = await db
    .insert(usersTable)
    .values({
      telegramId: identity.telegramId,
      username: identity.username,
      balanceUsd: "0",
      balanceSyp: "0",
      role: "user",
    })
    .returning();
  return inserted[0]!;
}
