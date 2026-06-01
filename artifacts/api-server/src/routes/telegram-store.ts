import { Router, type IRouter } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db, ordersTable, usersTable } from "@workspace/db";

const router: IRouter = Router();

const STORE_BOT_TOKEN = process.env.TELEGRAM_STORE_BOT_TOKEN || "";
const STORE_WEBHOOK_SECRET = process.env.TELEGRAM_STORE_WEBHOOK_SECRET || "";
const MINI_APP_URL = process.env.TELEGRAM_MINI_APP_URL || "";
const SUPPORT_URL = (process.env.TELEGRAM_SUPPORT_URL || "https://t.me/XPaySupportStore").replace("@", "");
const STORE_OWNER_TELEGRAM_ID = "8559379666";

async function telegramApi(method: string, body: Record<string, unknown>) {
  if (!STORE_BOT_TOKEN) return;
  const url = `https://api.telegram.org/bot${STORE_BOT_TOKEN}/${method}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Telegram ${method} failed: ${response.status} ${details}`);
  }
}

function buildOpenStoreMarkup() {
  return {
    inline_keyboard: [
      [
        {
          text: "🛍️ فتح المتجر",
          web_app: { url: MINI_APP_URL },
        },
      ],
      [
        {
          text: "🤖 تواصل مع الدعم",
          url: SUPPORT_URL,
        },
      ],
    ],
  };
}

function fullNameFromTelegramUser(user: any): string {
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim();
  return fullName || user?.username || "XPayUser";
}

async function ensureStoreUserFromTelegram(telegramUser: any) {
  const telegramId = String(telegramUser?.id || "").trim();
  if (!telegramId) return null;

  const username = fullNameFromTelegramUser(telegramUser).slice(0, 64);
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.telegramId, telegramId)).limit(1);

  if (existing) {
    if (!existing.username || existing.username === "XPayUser") {
      const [updated] = await db
        .update(usersTable)
        .set({ username })
        .where(eq(usersTable.id, existing.id))
        .returning();
      return updated || existing;
    }
    return existing;
  }

  const [created] = await db
    .insert(usersTable)
    .values({
      telegramId,
      username,
      balanceUsd: "0",
      balanceSyp: "0",
      role: "user",
    })
    .returning();

  return created || null;
}

async function sendAccountInfo(chatId: string | number, telegramUser: any) {
  const telegramId = String(telegramUser?.id || chatId || "").trim();
  const displayName = fullNameFromTelegramUser(telegramUser);

  if (!telegramId) {
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: "تعذر قراءة آيدي تيليجرام الخاص بك. أرسل /start ثم حاول مرة أخرى.",
    });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.telegramId, telegramId)).limit(1);

  if (!user) {
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text:
        `📋 معلومات الحساب:\n\n` +
        `👤 الاسم الكامل: ${displayName}\n` +
        `🆔 الآيدي: ${telegramId}\n` +
        `💰 الرصيد الحالي: 0.000$\n\n` +
        `📦 الطلبات المكتملة: 0\n` +
        `📦 الأرقام المشتراة: 0\n` +
        `📦 طلبات سوشل ميديا: 0\n` +
        `💸 المبلغ المستهلك: 0.000$`,
      reply_markup: buildOpenStoreMarkup(),
    });
    return;
  }

  const [stats] = await db
    .select({
      completedOrders: sql<number>`count(*)::int`,
      spentUsd: sql<number>`coalesce(sum(${ordersTable.totalUsd}), 0)::float`,
    })
    .from(ordersTable)
    .where(and(eq(ordersTable.userId, user.id), eq(ordersTable.status, "accept")));

  const balanceUsd = Number(user.balanceUsd || 0);
  const completedOrders = Number(stats?.completedOrders || 0);
  const spentUsd = Number(stats?.spentUsd || 0);

  await telegramApi("sendMessage", {
    chat_id: chatId,
    text:
      `📋 معلومات الحساب:\n\n` +
      `👤 الاسم الكامل: ${displayName}\n` +
      `🆔 الآيدي: ${telegramId}\n` +
      `💰 الرصيد الحالي: ${balanceUsd.toFixed(3)}$\n\n` +
      `📦 الطلبات المكتملة: ${completedOrders}\n` +
      `📦 الأرقام المشتراة: 0\n` +
      `📦 طلبات سوشل ميديا: 0\n` +
      `💸 المبلغ المستهلك: ${spentUsd.toFixed(3)}$`,
    reply_markup: buildOpenStoreMarkup(),
  });
}

function parseBroadcastMessage(rawText: string): string | null {
  const text = String(rawText || "").trim();
  const lower = text.toLowerCase();

  if (lower.startsWith("/broadcast ")) return text.slice("/broadcast ".length).trim();
  if (lower === "/broadcast") return "";
  if (text.startsWith("نشر ")) return text.slice("نشر ".length).trim();
  if (text === "نشر") return "";

  return null;
}

async function broadcastToStoreUsers(chatId: string | number, telegramUser: any, message: string) {
  const senderId = String(telegramUser?.id || "").trim();

  if (senderId !== STORE_OWNER_TELEGRAM_ID) {
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: "هذا الأمر متاح فقط لمالك البوت.",
    });
    return;
  }

  if (!message.trim()) {
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text:
        `اكتب الرسالة بعد الأمر مباشرة.\n\n` +
        `مثال:\n` +
        `/broadcast يوجد تخفيض جديد اليوم على قسم التطبيقات.`,
    });
    return;
  }

  const users = await db
    .select({ telegramId: usersTable.telegramId })
    .from(usersTable);

  const uniqueTelegramIds = Array.from(
    new Set(
      users
        .map((user) => String(user.telegramId || "").trim())
        .filter((telegramId) => telegramId && telegramId !== "0"),
    ),
  );

  let sent = 0;
  let failed = 0;
  const broadcastText = `📢 إعلان من XPayStore\n\n${message.trim()}`;

  for (const telegramId of uniqueTelegramIds) {
    try {
      await telegramApi("sendMessage", {
        chat_id: telegramId,
        text: broadcastText,
        reply_markup: buildOpenStoreMarkup(),
      });
      sent += 1;
    } catch (error) {
      failed += 1;
      console.error(`Broadcast to ${telegramId} failed:`, error);
    }
  }

  await telegramApi("sendMessage", {
    chat_id: chatId,
    text:
      `✅ تم تنفيذ الإرسال الجماعي.\n\n` +
      `👥 إجمالي المستخدمين: ${uniqueTelegramIds.length}\n` +
      `📨 تم الإرسال: ${sent}\n` +
      `⚠️ فشل الإرسال: ${failed}`,
  });
}

router.post("/telegram/store/webhook", async (req, res) => {
  if (STORE_WEBHOOK_SECRET) {
    const secret = req.headers["x-telegram-bot-api-secret-token"];
    if (String(secret || "") !== STORE_WEBHOOK_SECRET) {
      res.status(401).json({ ok: false });
      return;
    }
  }

  const msg = req.body?.message;
  const chatId = msg?.chat?.id;
  const telegramUser = msg?.from || msg?.chat || {};
  const rawText = String(msg?.text || "").trim();
  const text = rawText.toLowerCase();

  if (!chatId) {
    res.json({ ok: true });
    return;
  }

  const isStart = text === "/start" || text === "ابدأ" || text === "start";
  const isProducts = text.includes("المنتجات") || text.includes("products");
  const isAccountInfo = text.includes("معلومات الحساب") || text.includes("حساب المستخدم") || text.includes("account");
  const isSupport = text.includes("تواصل") || text.includes("الدعم") || text.includes("support");
  const broadcastMessage = parseBroadcastMessage(rawText);

  await ensureStoreUserFromTelegram(telegramUser);

  if (broadcastMessage !== null) {
    await broadcastToStoreUsers(chatId, telegramUser, broadcastMessage);
    res.json({ ok: true });
    return;
  }

  if (isAccountInfo) {
    await sendAccountInfo(chatId, telegramUser);
    res.json({ ok: true });
    return;
  }

  if (isStart || isProducts || isSupport) {
    if (!MINI_APP_URL) {
      await telegramApi("sendMessage", {
        chat_id: chatId,
        text: "رابط المتجر غير مضبوط حالياً. تواصل مع الإدارة.",
      });
      res.json({ ok: true });
      return;
    }

    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: "مرحباً بك في XPay Store.\nاختر الإجراء المطلوب:",
      reply_markup: buildOpenStoreMarkup(),
    });

    res.json({ ok: true });
    return;
  }

  await telegramApi("sendMessage", {
    chat_id: chatId,
    text: "استخدم زر فتح المتجر للدخول مباشرة أو تواصل مع الدعم عند الحاجة.",
    reply_markup: buildOpenStoreMarkup(),
  });

  res.json({ ok: true });
});

export default router;
