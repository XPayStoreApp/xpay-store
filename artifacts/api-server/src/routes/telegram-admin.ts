import { Router, type IRouter } from "express";
import { db, depositsTable, settingsTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  answerCallbackQuery,
  editMessageReplyMarkup,
  getTelegramWebhookSecret,
  notifyUserDepositApproved,
  notifyUserDepositRejected,
} from "../lib/telegram.js";

const router: IRouter = Router();

type TelegramUpdate = {
  callback_query?: {
    id: string;
    from?: { id?: number };
    data?: string;
    message?: { message_id?: number; chat?: { id?: number } };
  };
};

async function readAdminTelegramIds(): Promise<Set<string>> {
  const [row] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, "admin_telegram_ids"))
    .limit(1);

  const v = row?.value as unknown;
  if (Array.isArray(v)) return new Set(v.map((x) => String(x).trim()).filter(Boolean));
  if (typeof v === "string") return new Set(v.split(",").map((x) => x.trim()).filter(Boolean));
  return new Set();
}

async function applyDepositDecision(depositId: number, status: "approved" | "rejected") {
  const [dep] = await db
    .select()
    .from(depositsTable)
    .where(eq(depositsTable.id, depositId))
    .limit(1);

  if (!dep) return { ok: false as const, message: "الطلب غير موجود" };
  if (dep.status !== "pending") return { ok: false as const, message: `تمت معالجته مسبقاً (${dep.status})` };

  if (status === "approved") {
    const col = dep.currency === "SYP" ? "balanceSyp" : "balanceUsd";
    const amount = dep.currency === "SYP" ? dep.amountSyp : dep.amountUsd;
    if (amount) {
      await db
        .update(usersTable)
        .set({
          [col]:
            col === "balanceSyp"
              ? sql`${usersTable.balanceSyp} + ${amount}`
              : sql`${usersTable.balanceUsd} + ${amount}`,
        })
        .where(eq(usersTable.id, dep.userId));
    }
  }

  await db.update(depositsTable).set({ status }).where(eq(depositsTable.id, depositId));

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, dep.userId)).limit(1);
  if (user) {
    if (status === "approved") {
      await notifyUserDepositApproved({
        telegramId: user.telegramId,
        addedUsd: Number(dep.amountUsd),
        currentUsd: Number(user.balanceUsd) + Number(dep.amountUsd),
        operationNumber: String(dep.id),
      });
    } else {
      await notifyUserDepositRejected({
        telegramId: user.telegramId,
        operationNumber: String(dep.id),
      });
    }
  }

  return { ok: true as const, message: status === "approved" ? "تمت الموافقة ✅" : "تم الرفض ❌" };
}

router.post("/telegram/admin/callback", async (req, res) => {
  try {
    const expected = getTelegramWebhookSecret();
    const strictSecret = process.env.TELEGRAM_ADMIN_WEBHOOK_STRICT === "true";
    if (expected) {
      const secretHeader = String(req.headers["x-telegram-bot-api-secret-token"] || "");
      if (secretHeader) {
        if (secretHeader !== expected) {
          res.status(401).json({ ok: false, error: "invalid_secret" });
          return;
        }
      } else if (strictSecret) {
        res.status(401).json({ ok: false, error: "missing_secret" });
        return;
      } else {
        console.warn("Admin Telegram callback without secret header. Allowed because strict mode is disabled.");
      }
    }

    const update = req.body as TelegramUpdate;
    const cb = update.callback_query;
    if (!cb?.id || !cb.data) {
      res.json({ ok: true });
      return;
    }

    const actorTelegramId = String(cb.from?.id || "");
    const allowed = await readAdminTelegramIds();
    if (!allowed.has(actorTelegramId)) {
      await answerCallbackQuery(cb.id, "غير مصرح لك بهذا الإجراء");
      res.json({ ok: true });
      return;
    }

    const m = cb.data.match(/^dep:(approve|reject):(\d+)$/);
    if (!m) {
      await answerCallbackQuery(cb.id, "أمر غير صالح");
      res.json({ ok: true });
      return;
    }

    const action = m[1]!;
    const depositId = Number(m[2]!);
    const result = await applyDepositDecision(depositId, action === "approve" ? "approved" : "rejected");
    await answerCallbackQuery(cb.id, result.message);

    const chatId = cb.message?.chat?.id;
    const messageId = cb.message?.message_id;
    if (chatId && messageId) {
      await editMessageReplyMarkup(chatId, messageId);
    }

    res.json({ ok: true });
  } catch (error) {
    console.error("Telegram admin callback handler failed:", error);
    res.json({ ok: true });
  }
});

export default router;
