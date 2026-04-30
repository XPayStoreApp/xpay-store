type InlineButton = { text: string; callback_data: string };

const ADMIN_BOT_TOKEN = process.env.TELEGRAM_ADMIN_BOT_TOKEN || "";
const STORE_BOT_TOKEN = process.env.TELEGRAM_STORE_BOT_TOKEN || "";
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID || "";
const WEBHOOK_SECRET = process.env.TELEGRAM_ADMIN_WEBHOOK_SECRET || "";
const PUBLIC_API_BASE = (
  process.env.PUBLIC_API_BASE_URL ||
  process.env.API_PUBLIC_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  ""
).replace(/\/+$/, "");
const ADMIN_WEBHOOK_PATH = "/api/telegram/admin/callback";

let adminWebhookReady: Promise<void> | null = null;

function tokenFor(kind: "admin" | "store"): string {
  return kind === "admin" ? ADMIN_BOT_TOKEN : STORE_BOT_TOKEN;
}

function apiUrl(kind: "admin" | "store", method: string): string | null {
  const token = tokenFor(kind);
  if (!token) return null;
  return `https://api.telegram.org/bot${token}/${method}`;
}

export function getTelegramWebhookSecret(): string {
  return WEBHOOK_SECRET;
}

export function getTelegramConfigStatus() {
  return {
    adminBotTokenConfigured: !!ADMIN_BOT_TOKEN,
    storeBotTokenConfigured: !!STORE_BOT_TOKEN,
    adminChatIdConfigured: !!ADMIN_CHAT_ID,
    webhookSecretConfigured: !!WEBHOOK_SECRET,
    webhookUrl: PUBLIC_API_BASE ? `${PUBLIC_API_BASE}${ADMIN_WEBHOOK_PATH}` : "",
  };
}

async function ensureAdminWebhook(): Promise<void> {
  if (adminWebhookReady) {
    await adminWebhookReady;
    return;
  }

  adminWebhookReady = (async () => {
    if (!ADMIN_BOT_TOKEN || !PUBLIC_API_BASE) return;

    const expectedUrl = `${PUBLIC_API_BASE}${ADMIN_WEBHOOK_PATH}`;
    const infoUrl = apiUrl("admin", "getWebhookInfo");
    const setUrl = apiUrl("admin", "setWebhook");
    if (!infoUrl || !setUrl) return;

    const infoRes = await fetch(infoUrl);
    const infoJson = (await infoRes.json().catch(() => null)) as
      | { ok?: boolean; result?: { url?: string } }
      | null;

    const currentUrl = String(infoJson?.result?.url || "");
    if (currentUrl === expectedUrl) return;

    const payload: Record<string, unknown> = { url: expectedUrl };
    if (WEBHOOK_SECRET) payload.secret_token = WEBHOOK_SECRET;

    const setRes = await fetch(setUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!setRes.ok) {
      const txt = await setRes.text();
      throw new Error(`Telegram setWebhook failed: ${setRes.status} ${txt}`);
    }
  })().catch((error) => {
    adminWebhookReady = null;
    throw error;
  });

  await adminWebhookReady;
}

export function primeTelegramIntegrations(): void {
  void ensureAdminWebhook().catch((error) => {
    console.error("Admin Telegram webhook auto-setup failed:", error);
  });
}

export async function sendTelegramMessage(
  kind: "admin" | "store",
  chatId: string | number,
  text: string,
  inlineButtons?: InlineButton[],
): Promise<void> {
  const url = apiUrl(kind, "sendMessage");
  if (!url) return;

  if (kind === "admin") {
    await ensureAdminWebhook();
  }

  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };
  if (inlineButtons?.length) payload.reply_markup = { inline_keyboard: [inlineButtons] };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Telegram sendMessage failed: ${res.status} ${txt}`);
  }
}

export async function answerCallbackQuery(callbackQueryId: string, text: string): Promise<void> {
  const url = apiUrl("admin", "answerCallbackQuery");
  if (!url) return;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
      show_alert: false,
    }),
  });
}

export async function editMessageReplyMarkup(chatId: number | string, messageId: number): Promise<void> {
  const url = apiUrl("admin", "editMessageReplyMarkup");
  if (!url) return;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: [] },
    }),
  });
}

export async function notifyAdminsAboutDeposit(args: {
  depositId: number;
  amount: number;
  currency: "USD" | "SYP";
  telegramId: string;
  username: string;
  transactionId: string;
  proofImage?: string | null;
}): Promise<void> {
  if (!ADMIN_CHAT_ID) return;

  const amountLabel = args.currency === "USD" ? `${args.amount.toFixed(3)}$` : `${args.amount.toFixed(0)}.SY`;
  const receiptLabel = args.proofImage
    ? `الإيصال: ${args.proofImage.startsWith("data:") ? "[مرفق صورة]" : args.proofImage}\n`
    : "الإيصال: غير مرفق\n";

  const text =
    `عملية إيداع جديدة 💵\n` +
    `رقم العملية: <code>${args.depositId}</code>\n` +
    `قيمة الإيداع: <b>${amountLabel}</b>\n` +
    `إيداع من: <code>${args.telegramId}</code> (${args.username})\n` +
    `رقم المعاملة: <code>${args.transactionId}</code>\n` +
    receiptLabel +
    `\nاختر الإجراء:`;

  await sendTelegramMessage("admin", ADMIN_CHAT_ID, text, [
    { text: "✅ موافقة", callback_data: `dep:approve:${args.depositId}` },
    { text: "❌ رفض", callback_data: `dep:reject:${args.depositId}` },
  ]);
}

export async function notifyUserDepositApproved(args: {
  telegramId: string;
  addedUsd: number;
  currentUsd: number;
  operationNumber: string;
}) {
  const msg =
    `✅ تم التحقق بنجاح!\n` +
    `تمت إضافة $${args.addedUsd.toFixed(3)} إلى رصيدك.\n` +
    `رصيدك الحالي: $${args.currentUsd.toFixed(3)}\n\n` +
    `رقم العملية: ${args.operationNumber}`;
  await sendTelegramMessage("store", args.telegramId, msg);
}

export async function notifyUserDepositRejected(args: {
  telegramId: string;
  operationNumber: string;
}) {
  const msg =
    `❌ لم يتم العثور على عملية دفع مطابقة أو المبلغ غير صحيح.\n` +
    `رقم العملية: ${args.operationNumber}`;
  await sendTelegramMessage("store", args.telegramId, msg);
}

export async function notifyUserOrderCreated(args: {
  telegramId: string;
  productName: string;
  priceUsd: number;
  balanceBefore: number;
  balanceAfter: number;
  orderNumber: string;
  playerId: string;
  status: string;
  details: string;
}) {
  const isAccepted = args.status === "accept";
  const isRejected = args.status === "reject";
  const statusLabel = isAccepted ? "مكتمل" : isRejected ? "مرفوض" : "قيد الانتظار";
  const statusIcon = isAccepted ? "✅" : isRejected ? "❌" : "⏳";
  const reminderLine = isAccepted
    ? "تم تنفيذ طلبك بنجاح."
    : isRejected
      ? "تم رفض الطلب. راجع التفاصيل أو تواصل مع الدعم إذا لزم."
      : "سنقوم بتذكيرك تلقائياً فور تحديث حالة الطلب من المزود.";

  const msg =
    `✅ تم شراء "${args.productName}"\n` +
    `💰 السعر: ${args.priceUsd.toFixed(3)}$\n` +
    `💳 الرصيد قبل: ${args.balanceBefore.toFixed(3)}$\n` +
    `💳 الرصيد بعد: ${args.balanceAfter.toFixed(3)}$\n` +
    `🔢 رقم الطلب: ${args.orderNumber}\n` +
    `📎 آيدي اللاعب: ${args.playerId}\n` +
    `🕓 حالة الطلب: ${args.status}\n\n` +
    `📊 الحالة الحالية: ${statusIcon} ${statusLabel}\n` +
    `🔔 التذكير: ${reminderLine}\n` +
    `التفاصيل: ${args.details}`;
  await sendTelegramMessage("store", args.telegramId, msg);
}

export async function notifyUserOrderStatusChanged(args: {
  telegramId: string;
  orderNumber: string;
  productName: string;
  status: "accept" | "reject" | "wait" | string;
  note?: string;
}) {
  const statusLabel =
    args.status === "accept" ? "✅ مكتمل" : args.status === "reject" ? "❌ مرفوض" : "⏳ قيد الانتظار";

  const details =
    args.note?.trim() ||
    (args.status === "accept"
      ? "تمت العملية بنجاح."
      : args.status === "reject"
        ? "تم رفض الطلب من الإدارة."
        : "انتظر قليلا، الطلب قيد المعالجة.");

  const msg =
    `📦 تحديث حالة الطلب\n` +
    `🔢 رقم الطلب: ${args.orderNumber}\n` +
    `🛒 المنتج: ${args.productName}\n` +
    `📊 الحالة: ${statusLabel}\n` +
    `🔔 تذكير: هذه هي آخر حالة مؤكدة لطلبك.\n` +
    `التفاصيل: ${details}`;

  await sendTelegramMessage("store", args.telegramId, msg);
}
