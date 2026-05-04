import { Router, type IRouter } from "express";
import { db, depositsTable, paymentMethodsTable, usersTable } from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  CreateDepositBody,
  CreateDepositResponse,
  GetDepositsSummaryResponse,
  ListMyDepositsResponse,
} from "@workspace/api-zod";
import { getOrCreateCurrentUser } from "../lib/currentUser.js";
import {
  notifyAdminsAboutDeposit,
  notifyUserDepositApproved,
  notifyUserDepositRejected,
} from "../lib/telegram.js";

const router: IRouter = Router();
const SAM_API_BASE_URL = process.env.SAM_API_BASE_URL || "https://sam-api.pro/api";
const SAM_PAY_BASE_URL =
  process.env.SAM_PAY_BASE_URL ||
  SAM_API_BASE_URL.replace(/\/api\/?$/i, "");
const SAM_API_KEY = process.env.SAM_API_KEY || "";
const SAM_SHAMCASH_IDENTIFIER = process.env.SAM_SHAMCASH_IDENTIFIER || "";
const SAM_WEBHOOK_SECRET = process.env.SAM_WEBHOOK_SECRET || "";
const PUBLIC_API_BASE_URL = process.env.PUBLIC_API_BASE_URL || process.env.RENDER_EXTERNAL_URL || "";

function authHeaders() {
  if (!SAM_API_KEY) throw new Error("SAM_API_KEY is missing");
  return {
    Authorization: `Bearer ${SAM_API_KEY}`,
    "X-Api-Key": SAM_API_KEY,
    "Content-Type": "application/json",
  };
}

async function findIncomingShamCashTransactionByRef(
  walletIdentifier: string,
  transactionRef: string,
): Promise<{ found: boolean; amount?: number; currency?: string }> {
  const txUrl = `${SAM_API_BASE_URL.replace(/\/+$/, "")}/v1/wallets/shamcash/${encodeURIComponent(walletIdentifier)}/transactions?direction=in`;
  const resp = await fetch(txUrl, {
    method: "GET",
    headers: authHeaders(),
  });
  const payload: any = await resp.json().catch(() => ({}));
  if (!resp.ok || !Array.isArray(payload)) {
    return { found: false };
  }

  const match = payload.find((t: any) => String(t?.id || "").trim() === transactionRef);
  if (!match) return { found: false };

  const amount = Number(match?.amount);
  const currency = String(match?.currency || "").toUpperCase();
  return {
    found: true,
    amount: Number.isFinite(amount) ? amount : undefined,
    currency: currency || undefined,
  };
}

async function applyDepositStatusChangeAuto(id: number, status: "approved" | "rejected") {
  const [dep] = await db.select().from(depositsTable).where(eq(depositsTable.id, id)).limit(1);
  if (!dep) return { error: "not_found" as const };

  if (status === "approved" && dep.status !== "approved") {
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

  const [updated] = await db
    .update(depositsTable)
    .set({ status })
    .where(eq(depositsTable.id, id))
    .returning();

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, dep.userId)).limit(1);
  if (user) {
    try {
      if (status === "approved") {
        await notifyUserDepositApproved({
          telegramId: user.telegramId,
          addedUsd: Number(dep.amountUsd),
          currentUsd: Number(user.balanceUsd),
          operationNumber: String(dep.id),
        });
      } else {
        await notifyUserDepositRejected({
          telegramId: user.telegramId,
          operationNumber: String(dep.id),
        });
      }
    } catch (error) {
      console.error("Auto deposit notify failed:", error);
    }
  }

  return { updated };
}

async function syncShamCashInvoiceStatus(invoiceId: string): Promise<{
  found: boolean;
  status?: string;
  synced?: "approved" | "rejected" | "pending";
}> {
  const cleanInvoiceId = String(invoiceId || "").trim();
  if (!cleanInvoiceId) return { found: false };

  const [dep] = await db
    .select()
    .from(depositsTable)
    .where(eq(depositsTable.transactionId, cleanInvoiceId))
    .limit(1);
  if (!dep) return { found: false };
  if (dep.status !== "pending") return { found: true, status: dep.status, synced: dep.status as any };

  const payResp = await fetch(`${SAM_PAY_BASE_URL.replace(/\/+$/, "")}/pay/${encodeURIComponent(cleanInvoiceId)}`);
  const payJson: any = await payResp.json().catch(() => ({}));
  const samStatus = String(payJson?.status || "").toLowerCase();

  if (samStatus === "paid") {
    await applyDepositStatusChangeAuto(dep.id, "approved");
    return { found: true, status: samStatus, synced: "approved" };
  }
  if (samStatus === "expired") {
    await applyDepositStatusChangeAuto(dep.id, "rejected");
    return { found: true, status: samStatus, synced: "rejected" };
  }
  return { found: true, status: samStatus || "pending", synced: "pending" };
}

async function syncPendingShamCashDepositsForUser(userId: number): Promise<void> {
  const pending = await db
    .select({ transactionId: depositsTable.transactionId })
    .from(depositsTable)
    .where(and(eq(depositsTable.userId, userId), eq(depositsTable.method, "sham_cash_auto"), eq(depositsTable.status, "pending")))
    .orderBy(desc(depositsTable.id))
    .limit(10);

  for (const dep of pending) {
    try {
      await syncShamCashInvoiceStatus(String(dep.transactionId || ""));
    } catch (error) {
      console.error("ShamCash pending sync failed:", error);
    }
  }
}

function rowToDeposit(d: typeof depositsTable.$inferSelect) {
  return {
    id: String(d.id),
    amountUsd: Number(d.amountUsd),
    amountSyp: d.amountSyp != null ? Number(d.amountSyp) : undefined,
    currency: d.currency as "USD" | "SYP",
    method: d.method,
    methodLabel: d.methodLabel,
    transactionId: d.transactionId,
    status: d.status as "pending" | "approved" | "rejected",
    createdAt: d.createdAt.toISOString(),
  };
}

router.get("/deposits", async (req, res) => {
  const user = await getOrCreateCurrentUser(req);
  await syncPendingShamCashDepositsForUser(user.id);
  const status = (req.query.status as string | undefined) ?? "all";
  const method = (req.query.method as string | undefined) ?? "all";
  const conds = [eq(depositsTable.userId, user.id)];
  if (status && status !== "all") conds.push(eq(depositsTable.status, status));
  if (method && method !== "all") conds.push(eq(depositsTable.method, method));
  const rows = await db
    .select()
    .from(depositsTable)
    .where(and(...conds))
    .orderBy(desc(depositsTable.createdAt));
  res.json(ListMyDepositsResponse.parse(rows.map(rowToDeposit)));
});

router.get("/deposits/summary", async (_req, res) => {
  const user = await getOrCreateCurrentUser(_req);
  await syncPendingShamCashDepositsForUser(user.id);
  const all = await db
    .select({
      total: sql<number>`coalesce(sum(case when status='approved' then amount_usd else 0 end), 0)::float`,
      pendingCount: sql<number>`count(*) filter (where status='pending')::int`,
      approvedCount: sql<number>`count(*) filter (where status='approved')::int`,
      totalCount: sql<number>`count(*)::int`,
    })
    .from(depositsTable)
    .where(eq(depositsTable.userId, user.id));
  const r = all[0]!;
  res.json(
    GetDepositsSummaryResponse.parse({
      totalApprovedUsd: Number(r.total),
      pendingCount: r.pendingCount,
      approvedCount: r.approvedCount,
      totalCount: r.totalCount,
    }),
  );
});

router.post("/deposits/shamcash/:invoiceId/sync", async (req, res) => {
  try {
    const user = await getOrCreateCurrentUser(req);
    const invoiceId = String(req.params.invoiceId || "").trim();
    if (!invoiceId) {
      res.status(400).json({ error: "invoiceId is required" });
      return;
    }

    const [dep] = await db
      .select()
      .from(depositsTable)
      .where(and(eq(depositsTable.userId, user.id), eq(depositsTable.transactionId, invoiceId)))
      .limit(1);
    if (!dep) {
      res.status(404).json({ error: "deposit_not_found_for_invoice" });
      return;
    }

    const result = await syncShamCashInvoiceStatus(invoiceId);
    res.json({ ok: true, ...result });
  } catch (error: any) {
    console.error("ShamCash manual sync failed:", error);
    res.status(500).json({ error: error?.message || "sync_failed" });
  }
});

router.post("/deposits", async (req, res) => {
  const body = CreateDepositBody.parse(req.body);
  const transactionId = String(body.transactionId || "").trim();
  if (!/^\d+$/.test(transactionId)) {
    res.status(400).json({ error: "رقم العملية يجب أن يحتوي على أرقام فقط" });
    return;
  }
  const proofImage =
    typeof (req.body as any)?.proofImage === "string" && (req.body as any).proofImage.trim().length > 0
      ? String((req.body as any).proofImage)
      : null;
  const user = await getOrCreateCurrentUser(req);
  const m = (await db.select().from(paymentMethodsTable).where(eq(paymentMethodsTable.code, body.method)).limit(1))[0];
  const methodLabel = m?.name ?? body.method;
  const amountUsd =
    body.currency === "USD" ? body.amount : body.amount / 119;
  const amountSyp = body.currency === "SYP" ? body.amount : body.amount * 119;
  const inserted = await db
    .insert(depositsTable)
    .values({
      userId: user.id,
      amountUsd: String(amountUsd.toFixed(4)),
      amountSyp: String(amountSyp.toFixed(2)),
      currency: body.currency,
      method: body.method,
      methodLabel,
      transactionId,
      status: "pending",
    })
    .returning();
  const dep = inserted[0]!;
  try {
    await notifyAdminsAboutDeposit({
      depositId: dep.id,
      amount: body.amount,
      currency: body.currency,
      telegramId: user.telegramId,
      username: user.username,
      transactionId,
      proofImage,
    });
  } catch (error) {
    console.error("Notify admins about deposit failed:", error);
  }
  res.json(CreateDepositResponse.parse(rowToDeposit(dep)));
});

router.post("/deposits/shamcash/invoice", async (req, res) => {
  try {
    if (!SAM_API_KEY || !SAM_SHAMCASH_IDENTIFIER || !PUBLIC_API_BASE_URL) {
      res.status(500).json({
        error: "SAM config missing",
        message: "Missing required server configuration for ShamCash auto invoice.",
        required: ["SAM_API_KEY", "SAM_SHAMCASH_IDENTIFIER", "PUBLIC_API_BASE_URL"],
      });
      return;
    }

    const bodyIdentity = {
      telegramId: String(req.body?.telegramId || "").trim(),
      telegramUsername: String(req.body?.telegramUsername || "").trim(),
      telegramFirstName: String(req.body?.telegramFirstName || "").trim(),
      telegramLastName: String(req.body?.telegramLastName || "").trim(),
      telegramInitData: String(req.body?.telegramInitData || "").trim(),
    };

    const reqWithFallbackHeaders: any = {
      ...req,
      headers: {
        ...req.headers,
        ...(req.headers["x-telegram-id"] ? {} : (bodyIdentity.telegramId ? { "x-telegram-id": bodyIdentity.telegramId } : {})),
        ...(req.headers["x-telegram-username"] ? {} : (bodyIdentity.telegramUsername ? { "x-telegram-username": bodyIdentity.telegramUsername } : {})),
        ...(req.headers["x-telegram-first-name"] ? {} : (bodyIdentity.telegramFirstName ? { "x-telegram-first-name": bodyIdentity.telegramFirstName } : {})),
        ...(req.headers["x-telegram-last-name"] ? {} : (bodyIdentity.telegramLastName ? { "x-telegram-last-name": bodyIdentity.telegramLastName } : {})),
        ...(req.headers["x-telegram-init-data"] ? {} : (bodyIdentity.telegramInitData ? { "x-telegram-init-data": bodyIdentity.telegramInitData } : {})),
      },
    };

    const user = await getOrCreateCurrentUser(reqWithFallbackHeaders);
    const currency = String(req.body?.currency || "SYP").toUpperCase();
    const amount = Number(req.body?.amount);
    if (!["USD", "SYP", "EUR"].includes(currency) || !Number.isFinite(amount) || amount <= 0) {
      res.status(400).json({ error: "VALIDATION_ERROR", message: "Invalid amount or currency." });
      return;
    }

    const [methodRow] = await db
      .select()
      .from(paymentMethodsTable)
      .where(eq(paymentMethodsTable.code, "sham_cash_auto"))
      .limit(1);

    const amountUsd = currency === "USD" ? amount : amount / 119;
    const amountSyp = currency === "SYP" ? amount : amount * 119;

    const [dep] = await db
      .insert(depositsTable)
      .values({
        userId: user.id,
        amountUsd: String(amountUsd.toFixed(4)),
        amountSyp: String(amountSyp.toFixed(2)),
        currency,
        method: "sham_cash_auto",
        methodLabel: methodRow?.name || "شام كاش تلقائي",
        transactionId: `SC-PENDING-${Date.now()}-${user.id}`,
        status: "pending",
      })
      .returning();

    const webhookUrl = `${PUBLIC_API_BASE_URL.replace(/\/+$/, "")}/api/webhooks/shamcash?secret=${encodeURIComponent(SAM_WEBHOOK_SECRET)}`;

    const invoiceResp = await fetch(`${SAM_API_BASE_URL.replace(/\/+$/, "")}/v1/invoices`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        method: "shamcash",
        identifier: SAM_SHAMCASH_IDENTIFIER,
        amount: String(amount),
        currency,
        webhookUrl,
      }),
    });

    const invoiceJson: any = await invoiceResp.json().catch(() => ({}));
    if (!invoiceResp.ok || !invoiceJson?.invoiceId || !invoiceJson?.paymentUrl) {
      await db
        .update(depositsTable)
        .set({ status: "rejected" })
        .where(eq(depositsTable.id, dep.id));
      res.status(502).json({
        error: "SAM_INVOICE_CREATE_FAILED",
        message: invoiceJson?.message || "Sam API rejected invoice creation.",
        details: invoiceJson,
      });
      return;
    }

    await db
      .update(depositsTable)
      .set({ transactionId: String(invoiceJson.invoiceId) })
      .where(eq(depositsTable.id, dep.id));

    res.json({
      ok: true,
      depositId: dep.id,
      invoiceId: invoiceJson.invoiceId,
      paymentUrl: invoiceJson.paymentUrl,
      expiresAt: invoiceJson.expiresAt || null,
    });
  } catch (error: any) {
    console.error("ShamCash invoice create failed:", error);
    if (error?.message === "telegram_identity_missing") {
      console.error("ShamCash identity debug:", {
        hasHeaderId: !!req.headers["x-telegram-id"],
        hasHeaderInitData: !!req.headers["x-telegram-init-data"],
        hasBodyId: !!req.body?.telegramId,
        hasBodyInitData: !!req.body?.telegramInitData,
        queryTgId: req.query?.tg_id || null,
      });
    }
    res.status(500).json({
      error: "SHAMCASH_INVOICE_EXCEPTION",
      message: error?.message || "failed_to_create_invoice",
    });
  }
});

router.post("/deposits/shamcash/verify", async (req, res) => {
  try {
    if (!SAM_API_KEY) {
      res.status(500).json({ error: "SAM_API_KEY missing" });
      return;
    }

    const user = await getOrCreateCurrentUser(req);
    const invoiceId = String(req.body?.invoiceId || "").trim();
    const transactionRef = String(req.body?.transactionRef || "").trim();
    if (!invoiceId || !transactionRef) {
      res.status(400).json({ error: "invoiceId and transactionRef are required" });
      return;
    }

    const [dep] = await db
      .select()
      .from(depositsTable)
      .where(and(eq(depositsTable.userId, user.id), eq(depositsTable.transactionId, invoiceId)))
      .limit(1);

    if (!dep) {
      res.status(404).json({ error: "deposit_not_found_for_invoice" });
      return;
    }

    const verifyUrls = [
      `${SAM_PAY_BASE_URL.replace(/\/+$/, "")}/pay/${encodeURIComponent(invoiceId)}/verify`,
      `${SAM_API_BASE_URL.replace(/\/+$/, "")}/pay/${encodeURIComponent(invoiceId)}/verify`,
    ].filter((u, idx, arr) => arr.indexOf(u) === idx);

    let verifyResp: Response | null = null;
    let verifyJson: any = {};

    for (const url of verifyUrls) {
      try {
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SAM_API_KEY}`,
            "X-Api-Key": SAM_API_KEY,
          },
          body: JSON.stringify({ transactionRef }),
        });
        const payload = await resp.json().catch(() => ({}));
        verifyResp = resp;
        verifyJson = payload;

        // stop on success, or when provider returned a structured response
        if (resp.ok || payload?.verified !== undefined || payload?.message || payload?.code) {
          break;
        }
      } catch (error) {
        console.error("ShamCash verify attempt failed:", { url, error });
      }
    }

    if (!verifyResp) {
      res.status(502).json({
        ok: false,
        verified: false,
        message: "تعذر الوصول إلى مزود التحقق.",
        code: "VERIFY_UPSTREAM_UNREACHABLE",
      });
      return;
    }

    if (verifyResp.ok && verifyJson?.verified === true) {
      await applyDepositStatusChangeAuto(dep.id, "approved");
      res.json({ ok: true, verified: true, message: verifyJson?.message || "verified" });
      return;
    }

    // Fallback: accept verification via incoming transactions lookup to avoid strict invoice window failures.
    // This keeps auto-deposit usable when provider verify endpoint rejects by invoice time window.
    const fallbackTx = await findIncomingShamCashTransactionByRef(
      SAM_SHAMCASH_IDENTIFIER,
      transactionRef,
    );
    if (fallbackTx.found) {
      const depExpectedAmount = dep.currency === "SYP" ? Number(dep.amountSyp) : Number(dep.amountUsd);
      const txAmount = Number(fallbackTx.amount || 0);
      const txCurrency = String(fallbackTx.currency || "").toUpperCase();
      const sameCurrency = !txCurrency || txCurrency === dep.currency;
      const amountMatches = Number.isFinite(depExpectedAmount) && Number.isFinite(txAmount) && txAmount >= depExpectedAmount;

      if (sameCurrency && amountMatches) {
        await applyDepositStatusChangeAuto(dep.id, "approved");
        res.json({
          ok: true,
          verified: true,
          message: "تم التحقق من العملية عبر سجل معاملات شام كاش وإضافة الرصيد.",
          via: "transactions_fallback",
        });
        return;
      }
    }

    res.status(400).json({
      ok: false,
      verified: false,
      message: verifyJson?.message || "تعذر التحقق من رقم العملية. تأكد من الرقم وحاول مجددًا.",
      code: verifyJson?.code || null,
      upstreamStatus: verifyResp.status,
    });
  } catch (error: any) {
    console.error("ShamCash verify failed:", error);
    res.status(500).json({ error: error?.message || "verify_failed" });
  }
});

router.post("/webhooks/shamcash", async (req, res) => {
  try {
    const secret = String(req.query.secret || "");
    if (SAM_WEBHOOK_SECRET && secret !== SAM_WEBHOOK_SECRET) {
      res.status(401).json({ error: "invalid_webhook_secret" });
      return;
    }

    const event = String(req.body?.event || "");
    const invoiceId = String(req.body?.invoiceId || "").trim();
    if (!invoiceId) {
      res.status(400).json({ error: "invoiceId is required" });
      return;
    }

    const [dep] = await db
      .select()
      .from(depositsTable)
      .where(eq(depositsTable.transactionId, invoiceId))
      .limit(1);

    if (!dep) {
      res.status(200).json({ ok: true, ignored: "deposit_not_found" });
      return;
    }

    if (event === "invoice.paid") {
      await applyDepositStatusChangeAuto(dep.id, "approved");
      res.status(200).json({ ok: true, status: "approved" });
      return;
    }

    if (event === "invoice.expired") {
      if (dep.status === "pending") {
        await applyDepositStatusChangeAuto(dep.id, "rejected");
      }
      res.status(200).json({ ok: true, status: "expired" });
      return;
    }

    res.status(200).json({ ok: true, ignored: "unsupported_event" });
  } catch (error: any) {
    console.error("ShamCash webhook failed:", error);
    res.status(500).json({ error: error?.message || "webhook_failed" });
  }
});

export default router;
