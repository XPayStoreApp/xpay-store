import { Router, type IRouter } from "express";
import { db, ordersTable, productsTable, providersTable } from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import {
  CreateOrderBody,
  CreateOrderResponse,
  GetOrderResponse,
  GetOrdersSummaryResponse,
  ListMyOrdersResponse,
} from "@workspace/api-zod";
import { getOrCreateCurrentUser } from "../lib/currentUser.js";
import { getAdapter } from "../lib/adapter-registry";

const router: IRouter = Router();

function rowToOrder(o: typeof ordersTable.$inferSelect, p: typeof productsTable.$inferSelect | null) {
  return {
    id: String(o.id),
    orderNumber: o.orderNumber,
    productId: String(o.productId),
    productName: p?.name ?? "",
    productImage: p?.image ?? undefined,
    quantity: Number(o.quantity),
    userIdentifier: o.userIdentifier ?? undefined,
    totalUsd: Number(o.totalUsd),
    totalSyp: Number(o.totalSyp),
    status: o.status as "wait" | "accept" | "reject",
    createdAt: o.createdAt.toISOString(),
  };
}

router.get("/orders", async (req, res) => {
  const user = await getOrCreateCurrentUser();
  const status = (req.query.status as string | undefined) ?? "all";
  const conds = [eq(ordersTable.userId, user.id)];
  if (status && status !== "all") conds.push(eq(ordersTable.status, status));
  const rows = await db
    .select({ o: ordersTable, p: productsTable })
    .from(ordersTable)
    .leftJoin(productsTable, eq(productsTable.id, ordersTable.productId))
    .where(and(...conds))
    .orderBy(desc(ordersTable.createdAt));
  res.json(ListMyOrdersResponse.parse(rows.map((r) => rowToOrder(r.o, r.p))));
});

router.get("/orders/summary", async (_req, res) => {
  const user = await getOrCreateCurrentUser();
  const all = await db
    .select({
      total: sql<number>`coalesce(sum(case when status='accept' then total_usd else 0 end), 0)::float`,
      waitCount: sql<number>`count(*) filter (where status='wait')::int`,
      acceptCount: sql<number>`count(*) filter (where status='accept')::int`,
      totalCount: sql<number>`count(*)::int`,
    })
    .from(ordersTable)
    .where(eq(ordersTable.userId, user.id));
  const r = all[0]!;
  res.json(
    GetOrdersSummaryResponse.parse({
      totalAcceptedUsd: Number(r.total),
      waitCount: r.waitCount,
      acceptCount: r.acceptCount,
      totalCount: r.totalCount,
    }),
  );
});

router.get("/orders/:id", async (req, res) => {
  const user = await getOrCreateCurrentUser();
  const id = Number(req.params.id);
  const rows = await db
    .select({ o: ordersTable, p: productsTable })
    .from(ordersTable)
    .leftJoin(productsTable, eq(productsTable.id, ordersTable.productId))
    .where(and(eq(ordersTable.id, id), eq(ordersTable.userId, user.id)))
    .limit(1);
  if (!rows.length) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json(GetOrderResponse.parse(rowToOrder(rows[0]!.o, rows[0]!.p)));
});

router.post("/orders", async (req, res) => {
  const body = CreateOrderBody.parse(req.body);
  const user = await getOrCreateCurrentUser();
  const product = (
    await db.select().from(productsTable).where(eq(productsTable.id, Number(body.productId))).limit(1)
  )[0];
  if (!product) {
    res.status(404).json({ error: "product_not_found" });
    return;
  }

  let providerOrderResult: {
    success: boolean;
    providerOrderId?: string;
    status?: string;
    price?: number;
    rawResponse?: any;
    replayApi?: any[];
    error?: string;
  } | null = null;

  // --- تكامل المزود الخارجي ---
  if (product.providerId) {
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.id, product.providerId))
      .limit(1);

    if (!provider) {
      res.status(400).json({ error: "المزود غير موجود" });
      return;
    }

    const adapter = getAdapter(provider.providerType || "custom");
    if (!adapter) {
      res.status(400).json({ error: "نوع المزود غير مدعوم" });
      return;
    }

    const orderUuid = randomUUID();
    const playerId = body.userIdentifier || `user_${user.id}`;

    try {
      providerOrderResult = await adapter.placeOrder(
        provider.apiKey!,
        provider.apiUrl || undefined,
        product.providerProductId!,
        body.quantity,
        playerId,
        orderUuid
      );
    } catch (error: any) {
      console.error("🔥 Provider order error:", error);
      // نستمر بإنشاء الطلب المحلي بحالة wait مع تسجيل الخطأ
      providerOrderResult = {
        success: false,
        error: error.message || "فشل الاتصال بالمزود",
      };
    }
  }
  // --------------------------

  const totalUsd = providerOrderResult?.price
    ? providerOrderResult.price
    : Number(product.priceUsd) * body.quantity;
  const totalSyp = Number(product.priceSyp) * body.quantity;
  const orderNumber = `XP-${Date.now().toString().slice(-8)}`;

  const meta: any = {};
  if (providerOrderResult) {
    meta.provider = {
      providerOrderId: providerOrderResult.providerOrderId,
      status: providerOrderResult.status,
      rawResponse: providerOrderResult.rawResponse,
      replayApi: providerOrderResult.replayApi,
      error: providerOrderResult.error,
    };
  }

  const inserted = await db
    .insert(ordersTable)
    .values({
      orderNumber,
      userId: user.id,
      productId: product.id,
      quantity: String(body.quantity),
      userIdentifier: body.userIdentifier ?? null,
      totalUsd: String(totalUsd),
      totalSyp: String(totalSyp),
      status: providerOrderResult?.status || "wait",
      meta,
    })
    .returning();

  const o = inserted[0]!;
  res.json(CreateOrderResponse.parse(rowToOrder(o, product)));
});

export default router;