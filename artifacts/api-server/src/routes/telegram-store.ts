import { Router, type IRouter } from "express";

const router: IRouter = Router();

const STORE_BOT_TOKEN = process.env.TELEGRAM_STORE_BOT_TOKEN || "";
const STORE_WEBHOOK_SECRET = process.env.TELEGRAM_STORE_WEBHOOK_SECRET || "";
const MINI_APP_URL = process.env.TELEGRAM_MINI_APP_URL || "";

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
    ],
  };
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
  const text = String(msg?.text || "").trim().toLowerCase();

  if (!chatId) {
    res.json({ ok: true });
    return;
  }

  const isStart = text === "/start" || text === "ابدأ" || text === "start";
  const isProducts = text.includes("المنتجات") || text.includes("products");

  if (isStart || isProducts) {
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
      text: "اضغط الزر لفتح المتجر مباشرة:",
      reply_markup: buildOpenStoreMarkup(),
    });

    res.json({ ok: true });
    return;
  }

  await telegramApi("sendMessage", {
    chat_id: chatId,
    text: "استخدم زر فتح المتجر للدخول مباشرة.",
    reply_markup: buildOpenStoreMarkup(),
  });

  res.json({ ok: true });
});

export default router;
