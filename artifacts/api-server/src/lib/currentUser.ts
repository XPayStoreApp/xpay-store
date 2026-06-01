import type { Request } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const DEFAULT_TELEGRAM_ID = "8333183867";
const DEFAULT_USERNAME = "XPayUser";
const TELEGRAM_AUTH_MAX_AGE_SECONDS = Number(process.env.TELEGRAM_AUTH_MAX_AGE_SECONDS || 60 * 60 * 24);

function normalizeUsername(input?: string | null): string {
  const raw = (input || "").trim();
  if (!raw) return DEFAULT_USERNAME;
  return raw.slice(0, 64);
}

function identityError(message = "telegram_identity_missing"): never {
  const err: any = new Error(message);
  err.statusCode = 401;
  err.publicMessage = "هوية تيليجرام غير متاحة. افتح المتجر من داخل Telegram Mini App.";
  throw err;
}

function invalidIdentityError(): never {
  const err: any = new Error("telegram_identity_invalid");
  err.statusCode = 401;
  err.publicMessage = "تعذر التحقق من هوية تيليجرام. أعد فتح المتجر من زر البوت داخل Telegram.";
  throw err;
}

function parseTelegramUserFromInitData(initDataRaw?: string): { telegramId: string; username: string } | null {
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

function verifyTelegramInitData(initDataRaw: string): boolean {
  const botToken = process.env.TELEGRAM_STORE_BOT_TOKEN || "";
  if (!botToken) return false;

  const params = new URLSearchParams(initDataRaw);
  const receivedHash = params.get("hash") || "";
  if (!receivedHash || !/^[a-f0-9]{64}$/i.test(receivedHash)) return false;

  params.delete("hash");
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const calculatedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const received = Buffer.from(receivedHash, "hex");
  const calculated = Buffer.from(calculatedHash, "hex");
  if (received.length !== calculated.length || !timingSafeEqual(received, calculated)) return false;

  const authDate = Number(params.get("auth_date") || 0);
  if (Number.isFinite(TELEGRAM_AUTH_MAX_AGE_SECONDS) && TELEGRAM_AUTH_MAX_AGE_SECONDS > 0) {
    const now = Math.floor(Date.now() / 1000);
    if (!authDate || Math.abs(now - authDate) > TELEGRAM_AUTH_MAX_AGE_SECONDS) return false;
  }

  return true;
}

function readVerifiedIdentityFromInitData(initDataRaw?: string): { telegramId: string; username: string } | null {
  const raw = String(initDataRaw || "").trim();
  if (!raw) return null;
  if (!verifyTelegramInitData(raw)) return null;
  return parseTelegramUserFromInitData(raw);
}

function extractInitDataCandidates(rawInput?: string): string[] {
  const raw = String(rawInput || "").trim();
  if (!raw) return [];

  const candidates = new Set<string>();
  candidates.add(raw);

  try {
    candidates.add(decodeURIComponent(raw));
  } catch {
    // keep raw only
  }

  for (const candidate of Array.from(candidates)) {
    try {
      const full = new URLSearchParams(candidate);
      const nested = full.get("tgWebAppData");
      if (nested) {
        candidates.add(nested);
        try {
          candidates.add(decodeURIComponent(nested));
        } catch {
          // keep nested only
        }
      }
    } catch {
      // ignore malformed query-like data
    }
  }

  return Array.from(candidates).map((item) => item.trim()).filter(Boolean);
}

function tryReadVerifiedIdentityFromAnyRaw(rawInput?: string): { telegramId: string; username: string } | null {
  for (const candidate of extractInitDataCandidates(rawInput)) {
    const identity = readVerifiedIdentityFromInitData(candidate);
    if (identity?.telegramId) return identity;
  }
  return null;
}

function allowUnverifiedTelegramIdentity(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_UNVERIFIED_TELEGRAM_ID === "true";
}

function readTelegramIdentity(req?: Request, opts?: { strict?: boolean }): { telegramId: string; username: string } {
  const hdr = req?.headers || {};
  const initDataRaw = hdr["x-telegram-init-data"] as string | undefined;
  const queryTgWebAppData = req?.query?.["tgWebAppData"] as string | undefined;
  const bodyInitData = (req as any)?.body?.telegramInitData as string | undefined;
  const bodyTgWebAppData = (req as any)?.body?.tgWebAppData as string | undefined;

  const verifiedIdentity =
    tryReadVerifiedIdentityFromAnyRaw(initDataRaw) ||
    tryReadVerifiedIdentityFromAnyRaw(queryTgWebAppData) ||
    tryReadVerifiedIdentityFromAnyRaw(bodyInitData) ||
    tryReadVerifiedIdentityFromAnyRaw(bodyTgWebAppData);
  if (verifiedIdentity?.telegramId) return verifiedIdentity;

  const tgIdRaw =
    (hdr["x-telegram-id"] as string | undefined) ||
    (req?.query?.["tg_id"] as string | undefined) ||
    ((req as any)?.body?.telegramId as string | undefined);
  const usernameRaw =
    (hdr["x-telegram-username"] as string | undefined) ||
    (req?.query?.["tg_username"] as string | undefined) ||
    ((req as any)?.body?.telegramUsername as string | undefined) ||
    [hdr["x-telegram-first-name"], hdr["x-telegram-last-name"]]
      .filter(Boolean)
      .join(" ") ||
    DEFAULT_USERNAME;

  const telegramId = String(tgIdRaw || "").trim();
  const hasAnyInitData = Boolean(
    String(initDataRaw || queryTgWebAppData || bodyInitData || bodyTgWebAppData || "").trim(),
  );

  if (!telegramId) {
    if (hasAnyInitData && !allowUnverifiedTelegramIdentity()) invalidIdentityError();
    if (opts?.strict) identityError();

    const allowFallback = process.env.ALLOW_DEFAULT_TELEGRAM_ID === "true";
    if (allowFallback && allowUnverifiedTelegramIdentity()) {
      return {
        telegramId: DEFAULT_TELEGRAM_ID,
        username: normalizeUsername(String(usernameRaw)),
      };
    }
    identityError();
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

async function upsertCurrentUserByIdentity(identity: { telegramId: string; username: string }) {
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

export async function getOrCreateCurrentUser(req?: Request) {
  const identity = readTelegramIdentity(req);
  return upsertCurrentUserByIdentity(identity);
}

export async function getOrCreateCurrentUserStrict(req?: Request) {
  const identity = readTelegramIdentity(req, { strict: true });
  return upsertCurrentUserByIdentity(identity);
}
