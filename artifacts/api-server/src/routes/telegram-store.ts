import { Router, type IRouter } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db, ordersTable, usersTable } from "@workspace/db";

const router: IRouter = Router();

const STORE_BOT_TOKEN = process.env.TELEGRAM_STORE_BOT_TOKEN || "";
const STORE_WEBHOOK_SECRET = process.env.TELEGRAM_STORE_WEBHOOK_SECRET || "";
const MINI_APP_URL = process.env.TELEGRAM_MINI_APP_URL || "";
const SUPPORT_URL = (process.env.TELEGRAM_SUPPORT_URL || "https://t.me/XPaySupportStore").replace("@", "");

async function telegramApi(method: string, body: Record<string, unknown>) {
  if (!STORE_BOT_TOKEN) return;
  const url = `https://api.telegram.org/bot${STORE_BOT_TOKEN}/${method}`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
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
  const text = String(msg?.text || "").trim().toLowerCase();

  if (!chatId) {
    res.json({ ok: true });
    return;
  }

  const isStart = text === "/start" || text === "ابدأ" || text === "start";
  const isProducts = text.includes("المنتجات") || text.includes("products");
  const isAccountInfo = text.includes("معلومات الحساب") || text.includes("حساب المستخدم") || text.includes("account");
  const isSupport = text.includes("تواصل") || text.includes("الدعم") || text.includes("support");

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
