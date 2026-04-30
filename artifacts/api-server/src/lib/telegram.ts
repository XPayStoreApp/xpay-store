type InlineButton = { text: string; callback_data: string };

const ADMIN_BOT_TOKEN = process.env.TELEGRAM_ADMIN_BOT_TOKEN || "";
const STORE_BOT_TOKEN = process.env.TELEGRAM_STORE_BOT_TOKEN || "";
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID || "";
const WEBHOOK_SECRET = process.env.TELEGRAM_ADMIN_WEBHOOK_SECRET || "";
const PUBLIC_API_BASE = (process.env.PUBLIC_API_BASE_URL || process.env.API_PUBLIC_URL || "").replace(/\/+$/, "");

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
  const webhookPath = "/api/telegram/admin/callback";
  return {
    adminBotTokenConfigured: !!ADMIN_BOT_TOKEN,
    storeBotTokenConfigured: !!STORE_BOT_TOKEN,
    adminChatIdConfigured: !!ADMIN_CHAT_ID,
    webhookSecretConfigured: !!WEBHOOK_SECRET,
    webhookUrl: PUBLIC_API_BASE ? `${PUBLIC_API_BASE}${webhookPath}` : "",
  };
}

export async function sendTelegramMessage(
  kind: "admin" | "store",
  chatId: string | number,
  text: string,
  inlineButtons?: InlineButton[],
): Promise<void> {
  const url = apiUrl(kind, "sendMessage");
  if (!url) return;

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
    `عملية ايداع جديدة 💵\n` +
    `رقم العملية: <code>${args.depositId}</code>\n` +
    `قيمة الايداع: <b>${amountLabel}</b>\n` +
    `ايداع من: <code>${args.telegramId}</code> (${args.username})\n` +
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
  const statusLabel = args.status === "accept" ? "مكتمل" : "انتظر";
  const statusIcon = args.status === "accept" ? "✅" : "⏳";
  const msg =
    `✅ تم شراء "${args.productName}"\n` +
    `💰 السعر: ${args.priceUsd.toFixed(3)}$\n` +
    `💳 الرصيد قبل: ${args.balanceBefore.toFixed(3)}$\n` +
    `💳 الرصيد بعد: ${args.balanceAfter.toFixed(3)}$\n` +
    `🔢 رقم الطلب: ${args.orderNumber}\n` +
    `📎 آيدي اللاعب: ${args.playerId}\n` +
    `🕓 حالة الطلب: ${args.status}\n\n` +
    `📊 الحالة: ${statusIcon} ${statusLabel}\n` +
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
    `التفاصيل: ${details}`;

  await sendTelegramMessage("store", args.telegramId, msg);
}
