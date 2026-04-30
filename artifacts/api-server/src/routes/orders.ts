import { Router, type IRouter } from "express";
import { db, ordersTable, productsTable, providersTable, usersTable } from "@workspace/db";
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
import { notifyUserOrderCreated, notifyUserOrderStatusChanged } from "../lib/telegram.js";

const router: IRouter = Router();

function normalizeProviderOrderStatus(status: string | null | undefined): "wait" | "accept" | "reject" {
  const normalized = String(status || "").trim().toLowerCase();
  if (["accept", "accepted", "ok", "success", "completed", "paid", "done"].includes(normalized)) {
    return "accept";
  }
  if (["reject", "rejected", "failed", "cancelled", "canceled", "error"].includes(normalized)) {
    return "reject";
  }
  return "wait";
}

async function refundRejectedOrderIfNeeded(args: {
  orderId: number;
  userId: number;
  totalUsd: number;
  totalSyp: number;
  meta: any;
}): Promise<any> {
  if (args.meta?.refund?.refundedAt) return args.meta;

  await db
    .update(usersTable)
    .set({
      balanceUsd: sql`${usersTable.balanceUsd} + ${String(args.totalUsd)}`,
      balanceSyp: sql`${usersTable.balanceSyp} + ${String(args.totalSyp)}`,
    })
    .where(eq(usersTable.id, args.userId));

  const nextMeta = {
    ...args.meta,
    refund: {
      refunded: true,
      refundedAt: new Date().toISOString(),
      amountUsd: args.totalUsd,
      amountSyp: args.totalSyp,
    },
  };

  await db
    .update(ordersTable)
    .set({ meta: nextMeta })
    .where(eq(ordersTable.id, args.orderId));

  return nextMeta;
}

async function syncPendingProviderOrdersForUser(userId: number): Promise<void> {
  const pendingRows = await db
    .select({
      order: ordersTable,
      product: productsTable,
      provider: providersTable,
      user: usersTable,
    })
    .from(ordersTable)
    .innerJoin(productsTable, eq(productsTable.id, ordersTable.productId))
    .innerJoin(usersTable, eq(usersTable.id, ordersTable.userId))
    .leftJoin(providersTable, eq(providersTable.id, productsTable.providerId))
    .where(and(eq(ordersTable.userId, userId), eq(ordersTable.status, "wait")));

  for (const row of pendingRows) {
    const provider = row.provider;
    const product = row.product;
    const order = row.order;
    const user = row.user;
    const meta = (order.meta || {}) as any;
    const providerOrderId = String(meta?.provider?.providerOrderId || "").trim();

    if (!provider?.apiKey || !providerOrderId) continue;

    const adapter = getAdapter(provider.providerType || "custom");
    if (!adapter?.checkOrders) continue;

    try {
      const check = await adapter.checkOrders(
        provider.apiKey,
        provider.apiUrl || undefined,
        [providerOrderId],
      );

      const remote = check.orders.find((item) => String(item.providerOrderId) === providerOrderId);
      if (!remote) continue;

      const nextStatus = normalizeProviderOrderStatus(remote.status);
      if (nextStatus === "wait" || nextStatus === order.status) continue;

      let nextMeta = {
        ...meta,
        provider: {
          ...(meta?.provider || {}),
          checkResponse: remote.rawData || null,
          replayApi: remote.replayApi || meta?.provider?.replayApi || null,
          status: remote.status,
        },
      };

      await db
        .update(ordersTable)
        .set({
          status: nextStatus,
          meta: nextMeta,
        })
        .where(eq(ordersTable.id, order.id));

      if (nextStatus === "reject") {
        nextMeta = await refundRejectedOrderIfNeeded({
          orderId: order.id,
          userId: user.id,
          totalUsd: Number(order.totalUsd),
          totalSyp: Number(order.totalSyp),
          meta: nextMeta,
        });
      }

      try {
        await notifyUserOrderStatusChanged({
          telegramId: user.telegramId,
          orderNumber: order.orderNumber,
          productName: product.name,
          status: nextStatus,
          note: nextStatus === "accept" ? "تمت العملية بنجاح." : "تم رفض الطلب من المزود.",
        });
      } catch (error) {
        console.error("Notify provider order status user failed:", error);
      }
    } catch (error) {
      console.error(`Provider order sync failed for order ${order.id}:`, error);
    }
  }
}

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
  const user = await getOrCreateCurrentUser(req);
  await syncPendingProviderOrdersForUser(user.id);
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
  const user = await getOrCreateCurrentUser(_req);
  await syncPendingProviderOrdersForUser(user.id);
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
  const user = await getOrCreateCurrentUser(req);
  await syncPendingProviderOrdersForUser(user.id);
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
  const user = await getOrCreateCurrentUser(req);

  const product = (
    await db.select().from(productsTable).where(eq(productsTable.id, Number(body.productId))).limit(1)
  )[0];
  if (!product) {
    res.status(404).json({ error: "product_not_found" });
    return;
  }

  // Validate quantity against dashboard limits first.
  if (body.quantity <= 0) {
    res.status(400).json({ error: "الكمية يجب أن تكون أكبر من صفر" });
    return;
  }
  if (product.minQty && body.quantity < Number(product.minQty)) {
    res.status(400).json({ error: `الحد الأدنى هو ${Number(product.minQty)}` });
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

  let liveProviderUnitPrice = 0;
  let providerAvailable: boolean | null = null;

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

    // 1) Read live provider product details (price/availability/qty range).
    try {
      const providerProducts = await adapter.fetchProducts(provider.apiKey!, provider.apiUrl || undefined);
      const providerProduct = providerProducts.find((p) => String(p.id) === String(product.providerProductId || ""));
      if (providerProduct) {
        liveProviderUnitPrice = Number(providerProduct.price || 0);
        providerAvailable = !!providerProduct.available;

        if (providerProduct.minQty != null && body.quantity < Number(providerProduct.minQty)) {
          res.status(400).json({ error: `الحد الأدنى لدى المزود هو ${Number(providerProduct.minQty)}` });
          return;
        }
      }
    } catch (error) {
      console.error("Provider live price lookup failed:", error);
    }

    if (providerAvailable === false) {
      res.status(400).json({ error: "المنتج غير متوفر حاليا لدى المزود" });
      return;
    }

    // 2) Place provider order.
    const orderUuid = randomUUID();
    const playerId = body.userIdentifier || `user_${user.id}`;
    try {
      providerOrderResult = await adapter.placeOrder(
        provider.apiKey!,
        provider.apiUrl || undefined,
        product.providerProductId!,
        body.quantity,
        playerId,
        orderUuid,
      );
    } catch (error: any) {
      console.error("Provider order error:", error);
      providerOrderResult = {
        success: false,
        error: error.message || "فشل الاتصال بالمزود",
      };
    }
  }

  // 3) Final price = provider live price + dashboard configured price.
  // For non-provider products, keep dashboard price only.
  const dashboardUnitPriceUsd = Number(product.priceUsd);
  const providerUnitPriceUsd =
    product.providerId
      ? liveProviderUnitPrice || (providerOrderResult?.price ? Number(providerOrderResult.price) / body.quantity : 0)
      : 0;
  const finalUnitPriceUsd = product.providerId
    ? providerUnitPriceUsd + dashboardUnitPriceUsd
    : dashboardUnitPriceUsd;

  const totalUsd = finalUnitPriceUsd * body.quantity;
  const totalSyp = Number(product.priceSyp) * body.quantity;
  const orderNumber = `ID_${randomUUID().replace(/-/g, "").slice(0, 16)}`;

  const balanceBeforeUsd = Number(user.balanceUsd);
  if (balanceBeforeUsd < totalUsd) {
    res.status(400).json({ error: "رصيدك غير كافٍ لإتمام الطلب" });
    return;
  }

  const finalOrderStatus = product.providerId
    ? normalizeProviderOrderStatus(providerOrderResult?.status)
    : "accept";

  const meta: any = {
    pricing: {
      providerUnitPriceUsd,
      dashboardUnitPriceUsd,
      finalUnitPriceUsd,
    },
  };
  if (providerOrderResult) {
    meta.provider = {
      providerOrderId: providerOrderResult.providerOrderId,
      status: providerOrderResult.status,
      rawResponse: providerOrderResult.rawResponse,
      replayApi: providerOrderResult.replayApi,
      error: providerOrderResult.error,
    };
  }

  const inserted = await db.transaction(async (tx) => {
    const [updatedUser] = await tx
      .update(usersTable)
      .set({
        balanceUsd: sql`${usersTable.balanceUsd} - ${String(totalUsd)}`,
        balanceSyp: sql`${usersTable.balanceSyp} - ${String(totalSyp)}`,
      })
      .where(eq(usersTable.id, user.id))
      .returning();
    if (!updatedUser) throw new Error("user_not_found");

    return tx
      .insert(ordersTable)
      .values({
        orderNumber,
        userId: user.id,
        productId: product.id,
        quantity: String(body.quantity),
        userIdentifier: body.userIdentifier ?? null,
        totalUsd: String(totalUsd),
        totalSyp: String(totalSyp),
        status: finalOrderStatus,
        meta,
      })
      .returning();
  });

  const o = inserted[0]!;
  let finalMeta = meta;
  if (finalOrderStatus === "reject") {
    finalMeta = await refundRejectedOrderIfNeeded({
      orderId: o.id,
      userId: user.id,
      totalUsd,
      totalSyp,
      meta,
    });
  }
  const playerId = body.userIdentifier || `user_${user.id}`;
  const balanceAfterUsd = finalOrderStatus === "reject" ? balanceBeforeUsd : balanceBeforeUsd - totalUsd;
  try {
    await notifyUserOrderCreated({
      telegramId: user.telegramId,
      productName: product.name,
      priceUsd: totalUsd,
      balanceBefore: balanceBeforeUsd,
      balanceAfter: balanceAfterUsd,
      orderNumber,
      playerId,
      status: finalOrderStatus,
      details: finalOrderStatus === "accept" ? "تمت بنجاح" : "انتظر قليلا",
    });
  } catch (error) {
    console.error("Notify order user failed:", error);
  }

  res.json(CreateOrderResponse.parse(rowToOrder({ ...o, meta: finalMeta }, product)));
});

export default router;
