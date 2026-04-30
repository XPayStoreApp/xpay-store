import { Router, type IRouter } from "express";

const router: IRouter = Router();

const STORE_BOT_TOKEN = process.env.TELEGRAM_STORE_BOT_TOKEN || "";
const STORE_WEBHOOK_SECRET = process.env.TELEGRAM_STORE_WEBHOOK_SECRET || "";
const MINI_APP_URL = process.env.TELEGRAM_MINI_APP_URL || "";
const SUPPORT_URL = process.env.TELEGRAM_SUPPORT_URL || "https://t.me/XPayStoreCRBot";

async function telegramApi(method: string, body: Record<string, unknown>) {
  if (!STORE_BOT_TOKEN) return;
  const url = `https://api.telegram.org/bot${STORE_BOT_TOKEN}/${method}`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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
  const text = String(msg?.text || "").trim().toLowerCase();
  if (!chatId) {
    res.json({ ok: true });
    return;
  }

  if (text === "/start" || text === "ابدأ" || text === "start") {
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: "مرحباً بك في XPayStore 🛍",
      reply_markup: {
        keyboard: [
          [{ text: "🛍 المنتجات" }, { text: "💼 معلومات الحساب" }],
          [{ text: "📘 تعليمات استخدام البوت" }, { text: "🤖 تواصل معنا" }],
        ],
        resize_keyboard: true,
      },
    });
    res.json({ ok: true });
    return;
  }

  if (text.includes("المنتجات")) {
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: MINI_APP_URL ? `افتح المتجر من هنا:\n${MINI_APP_URL}` : "رابط المتجر غير مضبوط بعد.",
    });
    res.json({ ok: true });
    return;
  }

  if (text.includes("معلومات الحساب")) {
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: "افتح Mini App ثم ادخل صفحة الملف الشخصي لرؤية الرصيد والمعرف.",
    });
    res.json({ ok: true });
    return;
  }

  if (text.includes("تعليمات")) {
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text:
        "طريقة الاستخدام:\n1) افتح المنتجات\n2) اختر المنتج\n3) أدخل ID اللاعب\n4) أكّد الشراء\n5) راقب حالة الطلب من قسم الطلبات.",
    });
    res.json({ ok: true });
    return;
  }

  if (text.includes("تواصل")) {
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: `للتواصل:\n${SUPPORT_URL}`,
    });
    res.json({ ok: true });
    return;
  }

  res.json({ ok: true });
});

export default router;
