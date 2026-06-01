import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, ordersTable, productsTable, providersTable, usersTable } from "@workspace/db";
import {
  CreateOrderBody,
  CreateOrderResponse,
  GetOrderResponse,
  GetOrdersSummaryResponse,
  ListMyOrdersResponse,
} from "@workspace/api-zod";
import { getAdapter } from "../lib/adapter-registry";
import { getOrCreateCurrentUser, getOrCreateCurrentUserStrict } from "../lib/currentUser.js";
import { notifyUserOrderCreated, notifyUserOrderStatusChanged } from "../lib/telegram.js";

const router: IRouter = Router();

class ValidationError extends Error {
  statusCode = 400;
}

const USD_SCALE = 12;
const USD_FACTOR = 10n ** BigInt(USD_SCALE);

function decimalToScaledBigInt(value: unknown, scale = USD_SCALE): bigint {
  const raw = String(value ?? "0").trim();
  if (!/^-?\d+(\.\d+)?$/.test(raw)) {
    throw new ValidationError("قيمة السعر غير صالحة");
  }

  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const [wholePart, fractionPart = ""] = unsigned.split(".");
  const fraction = fractionPart.padEnd(scale, "0").slice(0, scale);
  const scaled = BigInt(wholePart || "0") * (10n ** BigInt(scale)) + BigInt(fraction || "0");
  return negative ? -scaled : scaled;
}

function scaledBigIntToDecimalString(value: bigint, scale = USD_SCALE): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const factor = 10n ** BigInt(scale);
  const whole = abs / factor;
  const fraction = (abs % factor).toString().padStart(scale, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole.toString()}${fraction ? `.${fraction}` : ""}`;
}

function addDecimalStrings(a: unknown, b: unknown): string {
  return scaledBigIntToDecimalString(decimalToScaledBigInt(a) + decimalToScaledBigInt(b));
}

function multiplyDecimalByQuantity(unitPrice: unknown, quantity: unknown): string {
  const priceScaled = decimalToScaledBigInt(unitPrice);
  const quantityScaled = decimalToScaledBigInt(quantity);
  return scaledBigIntToDecimalString((priceScaled * quantityScaled) / USD_FACTOR);
}

function decimalGte(a: unknown, b: unknown): boolean {
  return decimalToScaledBigInt(a) >= decimalToScaledBigInt(b);
}

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

function resolveProviderOrderStatus(result: { success?: boolean; status?: string; error?: string } | null | undefined): "wait" | "accept" | "reject" {
  if (!result) return "wait";
  const normalized = normalizeProviderOrderStatus(result.status);
  if (normalized !== "wait") return normalized;
  if (result.success === false || result.error) return "reject";
  return "wait";
}

function orderStatusMessage(status: "wait" | "accept" | "reject"): string {
  if (status === "accept") return "✅ تم الشراء وتنفيذ الطلب بنجاح.";
  if (status === "reject") return "❌ تم رفض الطلب من المزود وتم إرجاع المبلغ إلى رصيدك.";
  return "⏳ طلبك قيد الانتظار لدى المزود، سنخبرك تلقائياً عند تحديث الحالة.";
}

async function checkProviderOrderImmediately(args: {
  adapter: NonNullable<ReturnType<typeof getAdapter>>;
  provider: typeof providersTable.$inferSelect;
  providerOrderId?: string;
}): Promise<{
  status: "wait" | "accept" | "reject";
  remoteStatus?: string;
  rawData?: any;
  replayApi?: any[];
} | null> {
  const providerOrderId = String(args.providerOrderId || "").trim();
  if (!providerOrderId || !args.adapter.checkOrders || !args.provider.apiKey) return null;

  try {
    const checked = await args.adapter.checkOrders(args.provider.apiKey, args.provider.apiUrl || undefined, [providerOrderId]);
    const remote = checked.orders.find((item) => String(item.providerOrderId) === providerOrderId);
    if (!remote) return null;

    return {
      status: normalizeProviderOrderStatus(remote.status),
      remoteStatus: remote.status,
      rawData: remote.rawData || null,
      replayApi: remote.replayApi || undefined,
    };
  } catch (error) {
    console.error(`Immediate provider order check failed for ${providerOrderId}:`, error);
    return null;
  }
}

async function refundRejectedOrderIfNeeded(args: {
  orderId: number;
  userId: number;
  totalUsd: string | number;
  meta: any;
}): Promise<any> {
  if (args.meta?.refund?.refundedAt) return args.meta;

  await db
    .update(usersTable)
    .set({
      balanceUsd: sql`${usersTable.balanceUsd} + ${String(args.totalUsd)}`,
    })
    .where(eq(usersTable.id, args.userId));

  const nextMeta = {
    ...args.meta,
    refund: {
      refunded: true,
      refundedAt: new Date().toISOString(),
      amountUsd: String(args.totalUsd),
    },
  };

  await db.update(ordersTable).set({ meta: nextMeta }).where(eq(ordersTable.id, args.orderId));

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

    const adapter = getAdapter((provider as any).providerType || "custom");
    if (!adapter?.checkOrders) continue;

    try {
      const check = await adapter.checkOrders(provider.apiKey, provider.apiUrl || undefined, [providerOrderId]);
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

      await db.update(ordersTable).set({ status: nextStatus, meta: nextMeta }).where(eq(ordersTable.id, order.id));

      if (nextStatus === "reject") {
        nextMeta = await refundRejectedOrderIfNeeded({
          orderId: order.id,
          userId: user.id,
          totalUsd: String(order.totalUsd),
          meta: nextMeta,
        });
      }

      try {
        await notifyUserOrderStatusChanged({
          telegramId: user.telegramId,
          orderNumber: order.orderNumber,
          productName: product.name,
          status: nextStatus,
          note: orderStatusMessage(nextStatus),
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

router.get("/orders/summary", async (req, res) => {
  const user = await getOrCreateCurrentUser(req);
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
  try {
    const body = CreateOrderBody.parse(req.body);
    const user = await getOrCreateCurrentUserStrict(req);

    const product = (
      await db.select().from(productsTable).where(eq(productsTable.id, Number(body.productId))).limit(1)
    )[0];

    if (!product) {
      res.status(404).json({ error: "product_not_found" });
      return;
    }

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

    let providerForOrder: typeof providersTable.$inferSelect | null = null;
    let adapterForOrder: ReturnType<typeof getAdapter> | null = null;
    let liveProviderUnitPrice: string | null = null;
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

      const adapter = getAdapter((provider as any).providerType || "custom");
      if (!adapter) {
        res.status(400).json({ error: "نوع المزود غير مدعوم" });
        return;
      }

      providerForOrder = provider;
      adapterForOrder = adapter;

      try {
        const providerProducts = await adapter.fetchProducts(provider.apiKey!, provider.apiUrl || undefined);
        const providerProduct = providerProducts.find((p) => String(p.id) === String((product as any).providerProductId || ""));

        if (providerProduct) {
          liveProviderUnitPrice = String(providerProduct.price || "0");
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
        res.status(400).json({ error: "المنتج غير متوفر حالياً لدى المزود" });
        return;
      }
    }

    const dashboardMarkupUsd = String(product.priceUsd);
    const storedBaseCostUsd = product.basePriceUsd != null ? String(product.basePriceUsd) : "0";
    const providerUnitPriceUsd = product.providerId ? liveProviderUnitPrice || storedBaseCostUsd : "0";
    const finalUnitPriceUsd = product.providerId
      ? addDecimalStrings(providerUnitPriceUsd, dashboardMarkupUsd)
      : dashboardMarkupUsd;
    const totalUsd = multiplyDecimalByQuantity(finalUnitPriceUsd, body.quantity);
    const totalSyp = Number(product.priceSyp) * body.quantity;
    const balanceBeforeUsd = String(user.balanceUsd);

    if (decimalToScaledBigInt(totalUsd) <= 0n) {
      res.status(400).json({ error: "سعر الطلب غير صالح" });
      return;
    }

    if (!decimalGte(balanceBeforeUsd, totalUsd)) {
      res.status(400).json({ error: "رصيدك غير كافٍ لإتمام الطلب" });
      return;
    }

    const orderNumber = `ID_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const playerId = body.userIdentifier || `user_${user.id}`;

    if (product.providerId && providerForOrder && adapterForOrder) {
      try {
        providerOrderResult = await adapterForOrder.placeOrder(
          providerForOrder.apiKey!,
          providerForOrder.apiUrl || undefined,
          (product as any).providerProductId!,
          body.quantity,
          playerId,
          randomUUID(),
        );
      } catch (error: any) {
        console.error("Provider order error:", error);
        providerOrderResult = {
          success: false,
          error: error.message || "فشل الاتصال بالمزود",
        };
      }
    }

    let finalOrderStatus = product.providerId ? resolveProviderOrderStatus(providerOrderResult) : "accept";
    let immediateProviderCheck: Awaited<ReturnType<typeof checkProviderOrderImmediately>> = null;

    if (
      product.providerId &&
      providerForOrder &&
      adapterForOrder &&
      finalOrderStatus === "wait" &&
      providerOrderResult?.providerOrderId
    ) {
      immediateProviderCheck = await checkProviderOrderImmediately({
        adapter: adapterForOrder,
        provider: providerForOrder,
        providerOrderId: providerOrderResult.providerOrderId,
      });

      if (immediateProviderCheck?.status && immediateProviderCheck.status !== "wait") {
        finalOrderStatus = immediateProviderCheck.status;
      }
    }

    const meta: any = {
      pricing: {
        providerUnitPriceUsd,
        dashboardMarkupUsd,
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

      if (immediateProviderCheck) {
        meta.provider.immediateCheck = {
          status: immediateProviderCheck.remoteStatus,
          rawData: immediateProviderCheck.rawData,
          replayApi: immediateProviderCheck.replayApi,
          checkedAt: new Date().toISOString(),
        };
        meta.provider.status = immediateProviderCheck.remoteStatus || meta.provider.status;
        meta.provider.replayApi = immediateProviderCheck.replayApi || meta.provider.replayApi;
      }
    }

    const inserted = await db.transaction(async (tx) => {
      const [updatedUser] = await tx
        .update(usersTable)
        .set({
          balanceUsd: sql`${usersTable.balanceUsd} - ${String(totalUsd)}`,
        })
        .where(and(eq(usersTable.id, user.id), sql`${usersTable.balanceUsd} >= ${String(totalUsd)}`))
        .returning();

      if (!updatedUser) throw new ValidationError("رصيدك غير كافٍ لإتمام الطلب");

      return tx
        .insert(ordersTable)
        .values({
          orderNumber,
          userId: user.id,
          productId: product.id,
          quantity: String(body.quantity),
          userIdentifier: body.userIdentifier ?? null,
          totalUsd,
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
        meta,
      });
    }

    const balanceAfterUsd =
      finalOrderStatus === "reject" ? balanceBeforeUsd : addDecimalStrings(balanceBeforeUsd, `-${totalUsd}`);

    try {
      await notifyUserOrderCreated({
        telegramId: user.telegramId,
        productName: product.name,
        priceUsd: Number(totalUsd),
        balanceBefore: Number(balanceBeforeUsd),
        balanceAfter: Number(balanceAfterUsd),
        orderNumber,
        playerId,
        status: finalOrderStatus,
        details: orderStatusMessage(finalOrderStatus),
      });
    } catch (error) {
      console.error("Notify order user failed:", error);
    }

    res.json(CreateOrderResponse.parse(rowToOrder({ ...o, meta: finalMeta }, product)));
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    throw error;
  }
});

export default router;
