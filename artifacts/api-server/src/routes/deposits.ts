import { Router, type IRouter } from "express";
import { db, depositsTable, paymentMethodsTable } from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  CreateDepositBody,
  CreateDepositResponse,
  GetDepositsSummaryResponse,
  ListMyDepositsResponse,
} from "@workspace/api-zod";
import { getOrCreateCurrentUser } from "../lib/currentUser.js";
import { notifyAdminsAboutDeposit } from "../lib/telegram.js";

const router: IRouter = Router();

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

router.post("/deposits", async (req, res) => {
  const body = CreateDepositBody.parse(req.body);
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
      transactionId: body.transactionId,
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
      transactionId: body.transactionId,
      proofImage,
    });
  } catch (error) {
    console.error("Notify admins about deposit failed:", error);
  }
  res.json(CreateDepositResponse.parse(rowToDeposit(dep)));
});

export default router;
