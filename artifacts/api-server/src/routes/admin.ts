import { Router, type IRouter } from "express";
import {
  db,
  adminsTable,
  usersTable,
  categoriesTable,
  productsTable,
  ordersTable,
  depositsTable,
  newsTable,
  bannersTable,
  paymentMethodsTable,
  socialLinksTable,
  settingsTable,
  providersTable,
  couponsTable,
  vipMembershipsTable,
  autoCodesTable,
  orderMessagesTable,
  activityLogTable,
  apiKeysTable,
  notificationsTable,
} from "@workspace/db";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { requireAdmin } from "../lib/adminAuth.js";
import { getAdapter } from "../lib/adapter-registry"; 
import { MersalAdapter } from "../lib/mersal-adapter";
const router: IRouter = Router();
const EXTERNAL_CATEGORY_NAME = "External Provider";
const EXTERNAL_CATEGORY_IMAGE = "https://placehold.co/600x400?text=External+Provider";

class ValidationError extends Error {
  statusCode: number;
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
    this.statusCode = 400;
  }
}

function isBlank(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
}

function normalizeNumberField(data: Record<string, any>, key: string, opts?: { nullable?: boolean; required?: boolean }) {
  const raw = data[key];
  const nullable = opts?.nullable ?? false;
  const required = opts?.required ?? false;

  if (isBlank(raw)) {
    if (required) throw new ValidationError(`${key} is required`);
    data[key] = nullable ? null : raw;
    return;
  }

  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new ValidationError(`${key} must be a valid number`);
  }
  data[key] = n;
}

function findPgError(err: any): any {
  let cur = err;
  for (let i = 0; i < 6 && cur; i += 1) {
    if (cur?.code && typeof cur.code === "string") return cur;
    cur = cur?.cause;
  }
  return null;
}

function toHttpError(error: any): { status: number; message: string } {
  if (typeof error?.statusCode === "number") {
    return { status: error.statusCode, message: error?.message || "Validation error" };
  }

  const pg = findPgError(error);
  if (pg) {
    if (pg.code === "23503") {
      return { status: 400, message: `Foreign key violation: ${pg?.detail || pg?.constraint || "invalid reference"}` };
    }
    if (pg.code === "23502") {
      return { status: 400, message: `Missing required field: ${pg?.column || "unknown"}` };
    }
    if (pg.code === "22P02") {
      return { status: 400, message: `Invalid value format: ${pg?.message || "bad input"}` };
    }
  }

  return { status: 500, message: error?.message || "Internal server error" };
}

async function getOrCreateExternalCategoryId(): Promise<number> {
  const [existing] = await db
    .select({ id: categoriesTable.id })
    .from(categoriesTable)
    .where(eq(categoriesTable.name, EXTERNAL_CATEGORY_NAME))
    .limit(1);

  if (existing?.id) return existing.id;

  const [created] = await db
    .insert(categoriesTable)
    .values({
      name: EXTERNAL_CATEGORY_NAME,
      image: EXTERNAL_CATEGORY_IMAGE,
      active: true,
    })
    .returning({ id: categoriesTable.id });

  return created.id;
}

async function logActivity(
  actor: { id?: number; name?: string } | null,
  action: string,
  target?: string,
  meta?: unknown,
) {
  await db.insert(activityLogTable).values({
    actorType: "admin",
    actorId: actor?.id ? String(actor.id) : null,
    actorName: actor?.name || "system",
    action,
    target: target || null,
    meta: (meta as object) || null,
  });
}

// ========== AUTH ==========
router.post("/admin/login", async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    res.status(400).json({ error: "بيانات ناقصة" });
    return;
  }
  const [admin] = await db
    .select()
    .from(adminsTable)
    .where(eq(adminsTable.username, username))
    .limit(1);
  if (!admin || admin.password !== password || !admin.active) {
    res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
    return;
  }
  req.session.adminId = admin.id;
  req.session.adminUsername = admin.username;
  req.session.adminRole = admin.role;
  await logActivity({ id: admin.id, name: admin.username }, "login", "admin_panel");
  res.json({
    id: admin.id,
    username: admin.username,
    fullName: admin.fullName,
    role: admin.role,
  });
});

router.post("/admin/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

router.get("/admin/me", requireAdmin, async (req, res) => {
  const [admin] = await db
    .select()
    .from(adminsTable)
    .where(eq(adminsTable.id, req.session.adminId!))
    .limit(1);
  if (!admin) {
    res.status(401).json({ error: "غير موجود" });
    return;
  }
  res.json({
    id: admin.id,
    username: admin.username,
    fullName: admin.fullName,
    email: admin.email,
    role: admin.role,
    twoFactorEnabled: !!admin.twoFactorSecret,
  });
});

// ========== DASHBOARD ==========
router.get("/admin/dashboard", requireAdmin, async (_req, res) => {
  const [u] = await db.select({ c: sql<number>`count(*)::int` }).from(usersTable);
  const [p] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(productsTable)
    .where(eq(productsTable.available, true));
  const [oTotal] = await db.select({ c: sql<number>`count(*)::int` }).from(ordersTable);
  const [oPending] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(ordersTable)
    .where(eq(ordersTable.status, "wait"));
  const [dPending] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(depositsTable)
    .where(eq(depositsTable.status, "pending"));
  const [sales] = await db
    .select({ s: sql<string>`coalesce(sum(total_usd),0)::text` })
    .from(ordersTable)
    .where(eq(ordersTable.status, "accept"));
  const [cost] = await db
    .select({ s: sql<string>`coalesce(sum(cost_usd),0)::text` })
    .from(ordersTable)
    .where(eq(ordersTable.status, "accept"));
  const [bal] = await db.select({ s: sql<string>`coalesce(sum(balance_usd),0)::text` }).from(usersTable);

  const recentOrders = await db
    .select()
    .from(ordersTable)
    .orderBy(desc(ordersTable.createdAt))
    .limit(5);
  const recentDeposits = await db
    .select()
    .from(depositsTable)
    .orderBy(desc(depositsTable.createdAt))
    .limit(5);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [todayOrders] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(ordersTable)
    .where(gte(ordersTable.createdAt, today));

  // 7-day chart
  const chart = await db.execute(sql`
    SELECT to_char(d, 'YYYY-MM-DD') as date,
      coalesce(sum(o.total_usd) filter (where o.status='accept'), 0)::float as sales
    FROM generate_series((current_date - interval '6 day')::date, current_date::date, '1 day') d
    LEFT JOIN orders o ON o.created_at::date = d
    GROUP BY d ORDER BY d
  `);

  res.json({
    stats: {
      users: u?.c || 0,
      activeProducts: p?.c || 0,
      totalOrders: oTotal?.c || 0,
      pendingOrders: oPending?.c || 0,
      pendingDeposits: dPending?.c || 0,
      totalSalesUsd: Number(sales?.s || 0),
      totalCostUsd: Number(cost?.s || 0),
      netProfitUsd: Number(sales?.s || 0) - Number(cost?.s || 0),
      totalUserBalanceUsd: Number(bal?.s || 0),
      todayOrders: todayOrders?.c || 0,
    },
    recentOrders,
    recentDeposits,
    chart: chart.rows as any[], // Fix: cast to any[]
  });
});

// ========== GENERIC CRUD HELPER ==========
function makeCrud<T extends { id: any }>(
  path: string,
  table: any,
  opts: { orderBy?: any; allowedFields?: string[] } = {},
) {
  router.get(`/admin/${path}`, requireAdmin, async (_req, res) => {
    const rows = await db.select().from(table).orderBy(opts.orderBy ?? desc(table.id));
    res.json(rows);
  });
  router.get(`/admin/${path}/:id`, requireAdmin, async (req, res) => {
    const [row] = await db.select().from(table).where(eq(table.id, Number(req.params.id))).limit(1);
    if (!row) {
      res.status(404).json({ error: "غير موجود" });
      return;
    }
    res.json(row);
  });
  router.post(`/admin/${path}`, requireAdmin, async (req, res) => {
    try {
      const data = await sanitizeCrudDataForRuntimeSchema(
        path,
        filterFields(req.body, opts.allowedFields),
      );
      const [row] = (await db.insert(table).values(data).returning()) as any[];
      await logActivity(
        { id: req.session.adminId, name: req.session.adminUsername },
        "create",
        path,
        { id: row.id },
      );
      res.json(row);
    } catch (error: any) {
      console.error(`Create ${path} failed:`, error);
      const httpErr = toHttpError(error);
      res.status(httpErr.status).json({ error: httpErr.message });
    }
  });
  router.patch(`/admin/${path}/:id`, requireAdmin, async (req, res) => {
    try {
      const data = await sanitizeCrudDataForRuntimeSchema(
        path,
        filterFields(req.body, opts.allowedFields),
      );
      const [row] = await db
        .update(table)
        .set(data)
        .where(eq(table.id, Number(req.params.id)))
        .returning();
      await logActivity(
        { id: req.session.adminId, name: req.session.adminUsername },
        "update",
        path,
        { id: row?.id },
      );
      res.json(row);
    } catch (error: any) {
      console.error(`Update ${path} failed:`, error);
      const httpErr = toHttpError(error);
      res.status(httpErr.status).json({ error: httpErr.message });
    }
  });
  router.delete(`/admin/${path}/:id`, requireAdmin, async (req, res) => {
    await db.delete(table).where(eq(table.id, Number(req.params.id)));
    await logActivity(
      { id: req.session.adminId, name: req.session.adminUsername },
      "delete",
      path,
      { id: Number(req.params.id) },
    );
    res.json({ ok: true });
  });
}

function filterFields(body: any, allowed?: string[]): any {
  if (!allowed) return body;
  const out: any = {};
  for (const k of allowed) if (k in body) out[k] = body[k];
  return out;
}

const columnExistsCache = new Map<string, boolean>();

async function hasColumn(tableName: string, columnName: string): Promise<boolean> {
  const cacheKey = `${tableName}.${columnName}`;
  const cached = columnExistsCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const result = await db.execute(sql`
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${tableName}
      AND column_name = ${columnName}
    LIMIT 1
  `);
  const exists = (result.rows as any[]).length > 0;
  columnExistsCache.set(cacheKey, exists);
  return exists;
}

async function sanitizeCrudDataForRuntimeSchema(path: string, data: any): Promise<any> {
  if (!data || typeof data !== "object") return data;
  const normalized: Record<string, any> = { ...data };

  if (path === "products") {
    if ("name" in normalized && typeof normalized.name === "string") {
      normalized.name = normalized.name.trim();
    }
    if ("image" in normalized && typeof normalized.image === "string") {
      normalized.image = normalized.image.trim();
    }
    if ("description" in normalized && typeof normalized.description === "string") {
      normalized.description = normalized.description.trim();
      if (normalized.description === "") normalized.description = null;
    }
    if ("source" in normalized && typeof normalized.source === "string") {
      normalized.source = normalized.source.trim() || "manual";
    }

    const source = String(normalized.source || "manual").toLowerCase();
    const isExternalProduct =
      source !== "manual" || !isBlank(normalized.providerId) || !isBlank(normalized.providerProductId);

    if ("categoryId" in normalized) normalizeNumberField(normalized, "categoryId", { required: true });
    if ("priceUsd" in normalized) normalizeNumberField(normalized, "priceUsd", { required: true });
    if ("priceSyp" in normalized) normalizeNumberField(normalized, "priceSyp", { required: true });
    if ("basePriceUsd" in normalized) normalizeNumberField(normalized, "basePriceUsd", { nullable: true });
    if ("minQty" in normalized) normalizeNumberField(normalized, "minQty", { nullable: true });
    if ("maxQty" in normalized) normalizeNumberField(normalized, "maxQty", { nullable: true });
    if ("providerId" in normalized) normalizeNumberField(normalized, "providerId", { nullable: true });
    if ("providerProductId" in normalized) {
      normalizeNumberField(normalized, "providerProductId", { nullable: true });
    }

    if ("available" in normalized) normalized.available = !!normalized.available;
    if ("featured" in normalized) normalized.featured = !!normalized.featured;

    if (isBlank(normalized.name)) throw new ValidationError("name is required");
    if (isBlank(normalized.image)) throw new ValidationError("image is required");
    if (!isExternalProduct && isBlank(normalized.categoryId)) {
      throw new ValidationError("categoryId is required for manual products");
    }
    if (isBlank(normalized.priceUsd)) throw new ValidationError("priceUsd is required");
    if (isBlank(normalized.priceSyp)) throw new ValidationError("priceSyp is required");

    if (normalized.minQty != null && normalized.maxQty != null && normalized.minQty > normalized.maxQty) {
      throw new ValidationError("minQty must be less than or equal to maxQty");
    }

    if (normalized.categoryId != null) {
      const [category] = await db
        .select({ id: categoriesTable.id })
        .from(categoriesTable)
        .where(eq(categoriesTable.id, Number(normalized.categoryId)))
        .limit(1);
      if (!category) {
        if (isExternalProduct) {
          normalized.categoryId = await getOrCreateExternalCategoryId();
        } else {
          throw new ValidationError(`categoryId ${normalized.categoryId} does not exist`);
        }
      }
    } else if (isExternalProduct) {
      normalized.categoryId = await getOrCreateExternalCategoryId();
    }

    if (normalized.providerId != null) {
      const [provider] = await db
        .select({ id: providersTable.id })
        .from(providersTable)
        .where(eq(providersTable.id, Number(normalized.providerId)))
        .limit(1);
      if (!provider) throw new ValidationError(`providerId ${normalized.providerId} does not exist`);
    }
  }

  if (path === "products" && "providerProductId" in normalized) {
    const exists = await hasColumn("products", "provider_product_id");
    if (!exists) delete normalized.providerProductId;
  }

  if (path === "providers" && "providerType" in normalized) {
    const exists = await hasColumn("providers", "provider_type");
    if (!exists) delete normalized.providerType;
  }

  return normalized;
}

// ========== RESOURCES ==========
// Cascade delete للفئات: حذف المنتجات المرتبطة ثم حذف الفئة
router.delete("/admin/categories/:id", requireAdmin, async (req, res) => {
  const categoryId = Number(req.params.id);
  
  // حذف جميع المنتجات المرتبطة بهذه الفئة
  await db.execute(sql`DELETE FROM products WHERE category_id = ${categoryId}`);
  
  // حذف الفئة نفسها
  await db.delete(categoriesTable).where(eq(categoriesTable.id, categoryId));
  
  await logActivity(
    { id: req.session.adminId, name: req.session.adminUsername },
    "delete",
    "categories",
    { id: categoryId, cascade: true }
  );
  
  res.json({ ok: true });
});


makeCrud("categories", categoriesTable, {
  orderBy: categoriesTable.order,
  allowedFields: ["name", "image", "order", "active"],
});

makeCrud("products", productsTable, {
  allowedFields: [
    "categoryId",
    "name",
    "image",
    "priceUsd",
    "priceSyp",
    "basePriceUsd",
    "productType",
    "available",
    "minQty",
    "maxQty",
    "description",
    "featured",
    "providerId",
    "source",
    "providerProductId",
  ],
});

makeCrud("news", newsTable, {
  allowedFields: ["content", "type", "active"],
});

makeCrud("banners", bannersTable, {
  orderBy: bannersTable.order,
  allowedFields: ["image", "title", "link", "order"],
});

makeCrud("payment-methods", paymentMethodsTable, {
  allowedFields: [
    "code",
    "name",
    "subtitle",
    "instructions",
    "walletAddress",
    "qrImage",
    "minAmount",
    "active",
  ],
});

makeCrud("social-links", socialLinksTable, {
  orderBy: socialLinksTable.order,
  allowedFields: ["platform", "url", "label", "order"],
});

// Cascade delete للمزودين: حذف المنتجات المرتبطة ثم حذف المزود
router.delete("/admin/providers/:id", requireAdmin, async (req, res) => {
  const providerId = Number(req.params.id);
  
  // حذف جميع المنتجات المرتبطة بهذا المزود
  await db.execute(sql`DELETE FROM products WHERE provider_id = ${providerId}`);
  
  // حذف المزود نفسه
  await db.delete(providersTable).where(eq(providersTable.id, providerId));
  
  await logActivity(
    { id: req.session.adminId, name: req.session.adminUsername },
    "delete",
    "providers",
    { id: providerId, cascade: true }
  );
  
  res.json({ ok: true });
});

makeCrud("providers", providersTable, {
  orderBy: providersTable.priority,
  allowedFields: ["name", "apiUrl", "apiKey", "notes", "priority", "active", "providerType"],
});

makeCrud("coupons", couponsTable, {
  allowedFields: ["code", "discountPct", "maxUses", "active"],
});

makeCrud("vip-memberships", vipMembershipsTable, {
  allowedFields: ["name", "requiredAmount", "profitPct", "badge", "hidden"],
});

makeCrud("auto-codes", autoCodesTable, {
  allowedFields: ["productId", "code", "note", "used"],
});

makeCrud("order-messages", orderMessagesTable, {
  allowedFields: ["event", "title", "body"],
});

makeCrud("api-keys", apiKeysTable, {
  allowedFields: ["name", "keyValue", "active"],
});

// ========== USERS ==========
router.get("/admin/users", requireAdmin, async (req, res) => {
  const q = (req.query["q"] as string | undefined)?.trim();
  let rows;
  if (q) {
    rows = await db
      .select()
      .from(usersTable)
      .where(sql`${usersTable.username} ILIKE ${"%" + q + "%"} OR ${usersTable.telegramId} ILIKE ${"%" + q + "%"}`)
      .orderBy(desc(usersTable.createdAt))
      .limit(200);
  } else {
    rows = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt)).limit(200);
  }
  res.json(rows);
});

router.patch("/admin/users/:id", requireAdmin, async (req, res) => {
  const allowed = filterFields(req.body, [
    "username",
    "email",
    "balanceUsd",
    "balanceSyp",
    "role",
    "banned",
    "vipLevel",
  ]);
  const [row] = await db
    .update(usersTable)
    .set(allowed)
    .where(eq(usersTable.id, Number(req.params.id)))
    .returning();
  await logActivity(
    { id: req.session.adminId, name: req.session.adminUsername },
    "update_user",
    String(req.params.id),
    allowed,
  );
  res.json(row);
});

router.post("/admin/users/:id/adjust-balance", requireAdmin, async (req, res) => {
  const { delta, currency, note } = req.body as {
    delta: number;
    currency: "USD" | "SYP";
    note?: string;
  };
  const col = currency === "SYP" ? usersTable.balanceSyp : usersTable.balanceUsd;
  await db
    .update(usersTable)
    .set({ [currency === "SYP" ? "balanceSyp" : "balanceUsd"]: sql`${col} + ${delta}` })
    .where(eq(usersTable.id, Number(req.params.id)));
  await logActivity(
    { id: req.session.adminId, name: req.session.adminUsername },
    "adjust_balance",
    String(req.params.id),
    { delta, currency, note },
  );
  res.json({ ok: true });
});

// ========== ORDERS ==========
router.get("/admin/orders", requireAdmin, async (req, res) => {
  const status = req.query["status"] as string | undefined;
  const conditions = status && status !== "all" ? [eq(ordersTable.status, status)] : [];
  const rows = await db
    .select({
      order: ordersTable,
      user: usersTable,
      product: productsTable,
    })
    .from(ordersTable)
    .leftJoin(usersTable, eq(usersTable.id, ordersTable.userId))
    .leftJoin(productsTable, eq(productsTable.id, ordersTable.productId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(ordersTable.createdAt))
    .limit(500);
  res.json(
    rows.map((r) => ({
      ...r.order,
      userName: r.user?.username,
      productName: r.product?.name,
      productImage: r.product?.image,
    })),
  );
});

router.post("/admin/orders/:id/status", requireAdmin, async (req, res) => {
  const { status, note } = req.body as { status: string; note?: string };
  const [updated] = await db
    .update(ordersTable)
    .set({ status })
    .where(eq(ordersTable.id, Number(req.params.id)))
    .returning();
  await logActivity(
    { id: req.session.adminId, name: req.session.adminUsername },
    "order_status",
    String(req.params.id),
    { status, note },
  );
  res.json(updated);
});

// ========== DEPOSITS ==========
router.get("/admin/deposits", requireAdmin, async (req, res) => {
  const status = req.query["status"] as string | undefined;
  const conditions = status && status !== "all" ? [eq(depositsTable.status, status)] : [];
  const rows = await db
    .select({ deposit: depositsTable, user: usersTable })
    .from(depositsTable)
    .leftJoin(usersTable, eq(usersTable.id, depositsTable.userId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(depositsTable.createdAt))
    .limit(500);
  res.json(
    rows.map((r) => ({ ...r.deposit, userName: r.user?.username })),
  );
});

router.post("/admin/deposits/:id/status", requireAdmin, async (req, res) => {
  const { status, note } = req.body as { status: string; note?: string };
  const id = Number(req.params.id);
  const [dep] = await db.select().from(depositsTable).where(eq(depositsTable.id, id)).limit(1);
  if (!dep) {
    res.status(404).json({ error: "غير موجود" });
    return;
  }
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
  await logActivity(
    { id: req.session.adminId, name: req.session.adminUsername },
    "deposit_status",
    String(id),
    { status, note },
  );
  res.json(updated);
});

// ========== SETTINGS ==========
router.get("/admin/settings", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(settingsTable);
  const out: Record<string, any> = {};
  for (const r of rows) out[r.key] = r.value;
  res.json(out);
});

router.put("/admin/settings", requireAdmin, async (req, res) => {
  const updates = req.body as Record<string, any>;
  for (const [key, value] of Object.entries(updates)) {
    await db
      .insert(settingsTable)
      .values({ key, value })
      .onConflictDoUpdate({ target: settingsTable.key, set: { value } });
  }
  await logActivity(
    { id: req.session.adminId, name: req.session.adminUsername },
    "settings_update",
    "settings",
    Object.keys(updates),
  );
  res.json({ ok: true });
});

// ========== ACTIVITY ==========
router.get("/admin/activity", requireAdmin, async (_req, res) => {
  const rows = await db
    .select()
    .from(activityLogTable)
    .orderBy(desc(activityLogTable.createdAt))
    .limit(300);
  res.json(rows);
});

// ========== ADMINS MANAGEMENT ==========
router.get("/admin/admins", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(adminsTable).orderBy(desc(adminsTable.id));
  res.json(rows.map((r) => ({ ...r, password: undefined })));
});

router.post("/admin/admins", requireAdmin, async (req, res) => {
  const data = filterFields(req.body, [
    "username",
    "password",
    "fullName",
    "email",
    "role",
    "permissions",
    "active",
  ]);
  const [row] = await db.insert(adminsTable).values(data).returning();
  res.json({ ...row, password: undefined });
});

router.patch("/admin/admins/:id", requireAdmin, async (req, res) => {
  const data = filterFields(req.body, [
    "username",
    "password",
    "fullName",
    "email",
    "role",
    "permissions",
    "active",
  ]);
  if (data.password === "") delete data.password;
  const [row] = await db
    .update(adminsTable)
    .set(data)
    .where(eq(adminsTable.id, Number(req.params.id)))
    .returning();
  res.json({ ...row, password: undefined });
});

router.delete("/admin/admins/:id", requireAdmin, async (req, res) => {
  await db.delete(adminsTable).where(eq(adminsTable.id, Number(req.params.id)));
  res.json({ ok: true });
});

// ========== NOTIFICATIONS ==========
router.get("/admin/notifications", requireAdmin, async (_req, res) => {
  const rows = await db
    .select()
    .from(notificationsTable)
    .orderBy(desc(notificationsTable.createdAt))
    .limit(200);
  res.json(rows);
});

router.post("/admin/notifications", requireAdmin, async (req, res) => {
  const { targetType, targetUserId, title, content } = req.body as any;
  const [row] = await db
    .insert(notificationsTable)
    .values({ targetType, targetUserId, title, content })
    .returning();
  await logActivity(
    { id: req.session.adminId, name: req.session.adminUsername },
    "send_notification",
    "notifications",
    { targetType, targetUserId },
  );
  res.json(row);
});

// ========== REPORTS ==========
router.get("/admin/reports/sales", requireAdmin, async (_req, res) => {
  const rows = await db.execute(sql`
    SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as date,
      count(*)::int as orders_count,
      coalesce(sum(total_usd) filter (where status='accept'), 0)::float as revenue,
      coalesce(sum(cost_usd) filter (where status='accept'), 0)::float as cost,
      coalesce(sum(total_usd - cost_usd) filter (where status='accept'), 0)::float as profit
    FROM orders
    WHERE created_at >= current_date - interval '30 days'
    GROUP BY date_trunc('day', created_at)
    ORDER BY date_trunc('day', created_at) DESC
  `);
  res.json((rows.rows as any[]) || []);
});

router.get("/admin/reports/profit-log", requireAdmin, async (_req, res) => {
  const rows = await db.execute(sql`
    SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as date,
      coalesce(sum(total_usd - cost_usd) filter (where status='accept'), 0)::float as profit_usd,
      count(*) filter (where status='accept')::int as accepted_orders
    FROM orders
    GROUP BY date_trunc('day', created_at)
    ORDER BY date_trunc('day', created_at) DESC
    LIMIT 90
  `);
  res.json((rows.rows as any[]) || []);
});

// ========== BACKUP (mock) ==========
router.post("/admin/backup", requireAdmin, async (_req, res) => {
  await logActivity(
    { id: _req.session.adminId, name: _req.session.adminUsername },
    "backup_request",
    "system",
  );
  res.json({
    ok: true,
    filename: `xpay-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.sql`,
    sizeMb: Math.round(Math.random() * 30 + 5),
  });
});

// ========== IMPORT PRODUCTS ==========
router.post("/admin/import-products", requireAdmin, async (req, res) => {
  const { rows } = req.body as {
    rows: Array<{
      name: string;
      categoryId: number;
      priceUsd: number;
      priceSyp: number;
      productType?: string;
      image?: string;
    }>;
  };
  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: "لا توجد بيانات" });
    return;
  }
  const inserted = await db
    .insert(productsTable)
    .values(
      rows.map((r) => ({
        name: r.name,
        categoryId: r.categoryId,
        priceUsd: String(r.priceUsd),
        priceSyp: String(r.priceSyp),
        productType: r.productType || "package",
        image: r.image || "/cat-cards.png",
        source: "import",
      })),
    )
    .returning();
  await logActivity(
    { id: req.session.adminId, name: req.session.adminUsername },
    "import_products",
    "products",
    { count: inserted.length },
  );
  res.json({ ok: true, count: inserted.length });
});

// ========== 2FA (mock secret) ==========
router.post("/admin/2fa/enable", requireAdmin, async (req, res) => {
  const secret = Array.from({ length: 16 }, () =>
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"[Math.floor(Math.random() * 32)],
  ).join("");
  await db
    .update(adminsTable)
    .set({ twoFactorSecret: secret })
    .where(eq(adminsTable.id, req.session.adminId!));
  res.json({ secret, otpauthUrl: `otpauth://totp/XPayStore?secret=${secret}&issuer=XPayStore` });
});

router.post("/admin/2fa/disable", requireAdmin, async (req, res) => {
  await db
    .update(adminsTable)
    .set({ twoFactorSecret: null })
    .where(eq(adminsTable.id, req.session.adminId!));
  res.json({ ok: true });
});

router.post("/admin/2fa/verify", requireAdmin, async (req, res) => {
  const { code } = req.body as { code?: string };
  if (!code || code.length !== 6) {
    res.status(400).json({ error: "رمز غير صالح" });
    return;
  }
  res.json({ ok: true, verified: true });
});

// ========== PROFILE ==========
router.put("/admin/profile", requireAdmin, async (req, res) => {
  const { fullName, email, oldPassword, newPassword } = req.body as any;
  const [admin] = await db
    .select()
    .from(adminsTable)
    .where(eq(adminsTable.id, req.session.adminId!))
    .limit(1);
  if (!admin) {
    res.status(404).json({ error: "غير موجود" });
    return;
  }
  const update: any = {};
  if (fullName !== undefined) update.fullName = fullName;
  if (email !== undefined) update.email = email;
  if (newPassword) {
    if (admin.password !== oldPassword) {
      res.status(400).json({ error: "كلمة المرور الحالية غير صحيحة" });
      return;
    }
    update.password = newPassword;
  }
  if (Object.keys(update).length) {
    await db.update(adminsTable).set(update).where(eq(adminsTable.id, admin.id));
  }
  res.json({ ok: true });
});

// ========== USER BALANCE / BAN ALIASES ==========
router.post("/admin/users/:id/balance", requireAdmin, async (req, res) => {
  const { delta, currency, note } = req.body as {
    delta: number;
    currency: "USD" | "SYP";
    note?: string;
  };
  const col = currency === "SYP" ? usersTable.balanceSyp : usersTable.balanceUsd;
  await db
    .update(usersTable)
    .set({
      [currency === "SYP" ? "balanceSyp" : "balanceUsd"]: sql`${col} + ${delta}`,
    })
    .where(eq(usersTable.id, Number(req.params.id)));
  await logActivity(
    { id: req.session.adminId, name: req.session.adminUsername },
    "adjust_balance",
    String(req.params.id),
    { delta, currency, note },
  );
  res.json({ ok: true });
});

router.patch("/admin/users/:id/ban", requireAdmin, async (req, res) => {
  const { banned } = req.body as { banned: boolean };
  await db
    .update(usersTable)
    .set({ banned: !!banned })
    .where(eq(usersTable.id, Number(req.params.id)));
  await logActivity(
    { id: req.session.adminId, name: req.session.adminUsername },
    banned ? "ban_user" : "unban_user",
    String(req.params.id),
  );
  res.json({ ok: true });
});

// ========== STATUS PATCH ALIASES ==========
router.patch("/admin/orders/:id/status", requireAdmin, async (req, res) => {
  const { status } = req.body as { status: string };
  const [updated] = await db
    .update(ordersTable)
    .set({ status })
    .where(eq(ordersTable.id, Number(req.params.id)))
    .returning();
  await logActivity(
    { id: req.session.adminId, name: req.session.adminUsername },
    "order_status",
    String(req.params.id),
    { status },
  );
  res.json(updated);
});

router.patch("/admin/deposits/:id/status", requireAdmin, async (req, res) => {
  const { status } = req.body as { status: string };
  const id = Number(req.params.id);
  const [dep] = await db
    .select()
    .from(depositsTable)
    .where(eq(depositsTable.id, id))
    .limit(1);
  if (!dep) {
    res.status(404).json({ error: "غير موجود" });
    return;
  }
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
  await logActivity(
    { id: req.session.adminId, name: req.session.adminUsername },
    "deposit_status",
    String(id),
    { status },
  );
  res.json(updated);
});

// ========== GENERIC PUT FOR ALL CRUDS (ALIAS OF PATCH) ==========
const PUT_RESOURCES: Array<{ path: string; table: any; allowed: string[] }> = [
  { path: "categories", table: categoriesTable, allowed: ["name", "image", "order", "active"] },
  {
    path: "products",
    table: productsTable,
    allowed: [
      "categoryId", "name", "image", "priceUsd", "priceSyp", "basePriceUsd",
      "productType", "available", "minQty", "maxQty", "description", "featured",
      "providerId", "source", "providerProductId",
    ],
  },
  { path: "news", table: newsTable, allowed: ["content", "type", "active"] },
  { path: "banners", table: bannersTable, allowed: ["image", "title", "link", "order"] },
  {
    path: "payment-methods",
    table: paymentMethodsTable,
    allowed: [
      "code", "name", "subtitle", "instructions", "walletAddress", "qrImage",
      "minAmount", "active",
    ],
  },
  { path: "social-links", table: socialLinksTable, allowed: ["platform", "url", "label", "order"] },
  { path: "providers", table: providersTable, allowed: ["name", "apiUrl", "apiKey", "notes", "priority", "active", "providerType"] },
  { path: "coupons", table: couponsTable, allowed: ["code", "discountPct", "maxUses", "usedCount", "active"] },
  { path: "vip-memberships", table: vipMembershipsTable, allowed: ["name", "requiredAmount", "profitPct", "badge", "hidden"] },
  { path: "auto-codes", table: autoCodesTable, allowed: ["productId", "code", "note", "used"] },
  { path: "order-messages", table: orderMessagesTable, allowed: ["event", "title", "body"] },
  { path: "api-keys", table: apiKeysTable, allowed: ["name", "keyValue", "active"] },
];

for (const r of PUT_RESOURCES) {
  router.put(`/admin/${r.path}/:id`, requireAdmin, async (req, res) => {
    const data = filterFields(req.body, r.allowed);
    const [row] = await db
      .update(r.table)
      .set(data)
      .where(eq(r.table.id, Number(req.params.id)))
      .returning();
    res.json(row);
  });
}

// ========== VIP ALIAS ==========
router.get("/admin/vip", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(vipMembershipsTable).orderBy(desc(vipMembershipsTable.id));
  res.json(rows);
});
router.post("/admin/vip", requireAdmin, async (req, res) => {
  const data = filterFields(req.body, ["name", "requiredAmount", "profitPct", "badge", "hidden"]);
  const [row] = await db.insert(vipMembershipsTable).values(data).returning();
  res.json(row);
});
router.put("/admin/vip/:id", requireAdmin, async (req, res) => {
  const data = filterFields(req.body, ["name", "requiredAmount", "profitPct", "badge", "hidden"]);
  const [row] = await db
    .update(vipMembershipsTable)
    .set(data)
    .where(eq(vipMembershipsTable.id, Number(req.params.id)))
    .returning();
  res.json(row);
});
router.delete("/admin/vip/:id", requireAdmin, async (req, res) => {
  await db.delete(vipMembershipsTable).where(eq(vipMembershipsTable.id, Number(req.params.id)));
  res.json({ ok: true });
});

// ========== BULK DELETE ==========
router.post("/admin/bulk-delete", requireAdmin, async (req, res) => {
  const { resource, ids } = req.body as { resource: string; ids: number[] };
  if (!resource || !Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: "بيانات غير صالحة" });
    return;
  }

  // جدول حسب المورد
  const tableMap: Record<string, any> = {
    categories: categoriesTable,
    products: productsTable,
    providers: providersTable,
    coupons: couponsTable,
    banners: bannersTable,
    news: newsTable,
    paymentMethods: paymentMethodsTable,
    socialLinks: socialLinksTable,
    vipMemberships: vipMembershipsTable,
    autoCodes: autoCodesTable,
    orderMessages: orderMessagesTable,
    apiKeys: apiKeysTable,
    notifications: notificationsTable,
  };

  const table = tableMap[resource];
  if (!table) {
    res.status(400).json({ error: "المورد غير مدعوم" });
    return;
  }

  try {
    // تنفيذ الحذف المتسلسل حسب المورد
    if (resource === "categories") {
      for (const id of ids) {
        await db.execute(sql`DELETE FROM products WHERE category_id = ${id}`);
      }
    } else if (resource === "providers") {
      for (const id of ids) {
        await db.execute(sql`DELETE FROM products WHERE provider_id = ${id}`);
      }
    }

    // حذف العناصر نفسها واحداً تلو الآخر
    for (const id of ids) {
      await db.delete(table).where(eq(table.id, id));
    }

    await logActivity(
      { id: req.session.adminId, name: req.session.adminUsername },
      "bulk_delete",
      resource,
      { ids }
    );

    res.json({ ok: true, deletedCount: ids.length });
  } catch (error: any) {
    console.error("Bulk delete error:", error);
    res.status(500).json({ error: error.message || "فشل الحذف الجماعي" });
  }
});

// ========== NOTIFICATIONS DELETE ==========
router.delete("/admin/notifications/:id", requireAdmin, async (req, res) => {
  await db.delete(notificationsTable).where(eq(notificationsTable.id, Number(req.params.id)));
  res.json({ ok: true });
});

// ========== REPORTS (combined) ==========
router.get("/admin/reports", requireAdmin, async (req, res) => {
  const from = (req.query.from as string) || null;
  const to = (req.query.to as string) || null;
  const dailyRows = await db.execute(sql`
    SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as date,
      coalesce(sum(total_usd) filter (where status='accept'), 0)::float as "salesUsd",
      coalesce(sum(total_usd - cost_usd) filter (where status='accept'), 0)::float as "profitUsd",
      count(*) filter (where status='accept')::int as "ordersCount"
    FROM orders
    WHERE (${from}::date IS NULL OR created_at::date >= ${from}::date)
      AND (${to}::date IS NULL OR created_at::date <= ${to}::date)
    GROUP BY date_trunc('day', created_at)
    ORDER BY date_trunc('day', created_at) DESC
    LIMIT 90
  `);
  const totResult = await db.execute(sql`
    SELECT
      coalesce(sum(total_usd) filter (where status='accept'), 0)::float as "totalSalesUsd",
      coalesce(sum(total_usd - cost_usd) filter (where status='accept'), 0)::float as "totalProfitUsd",
      count(*) filter (where status='accept')::int as "orderCount"
    FROM orders
    WHERE (${from}::date IS NULL OR created_at::date >= ${from}::date)
      AND (${to}::date IS NULL OR created_at::date <= ${to}::date)
  `);
  const totRows = totResult.rows as any[];
  const [tot] = totRows;
  const depResult = await db.execute(sql`
    SELECT coalesce(sum(amount_usd) filter (where status='approved'), 0)::float as "totalDepositsUsd"
    FROM deposits
    WHERE (${from}::date IS NULL OR created_at::date >= ${from}::date)
      AND (${to}::date IS NULL OR created_at::date <= ${to}::date)
  `);
  const depRows = depResult.rows as any[];
  const [dep] = depRows;
  res.json({
    daily: (dailyRows.rows as any[]) || [],
    totalSalesUsd: tot?.totalSalesUsd || 0,
    totalProfitUsd: tot?.totalProfitUsd || 0,
    orderCount: tot?.orderCount || 0,
    totalDepositsUsd: dep?.totalDepositsUsd || 0,
  });
});

// ========== BACKUP / IMPORT (full JSON) ==========
router.get("/admin/backup", requireAdmin, async (req, res) => {
  const [
    users, categories, products, paymentMethods, banners, news, socialLinks,
    providers, coupons, vipMemberships, settings, orderMessages, apiKeys,
  ] = await Promise.all([
    db.select().from(usersTable),
    db.select().from(categoriesTable),
    db.select().from(productsTable),
    db.select().from(paymentMethodsTable),
    db.select().from(bannersTable),
    db.select().from(newsTable),
    db.select().from(socialLinksTable),
    db.select().from(providersTable),
    db.select().from(couponsTable),
    db.select().from(vipMembershipsTable),
    db.select().from(settingsTable),
    db.select().from(orderMessagesTable),
    db.select().from(apiKeysTable),
  ]);
  await logActivity(
    { id: req.session.adminId, name: req.session.adminUsername },
    "export_backup",
    "system",
  );
  res.json({
    exportedAt: new Date().toISOString(),
    users, categories, products, paymentMethods, banners, news, socialLinks,
    providers, coupons, vipMemberships, settings, orderMessages, apiKeys,
  });
});

router.post("/admin/import", requireAdmin, async (req, res) => {
  const body = req.body as Record<string, any>;
  let imported = 0;
  const tableMap: Record<string, any> = {
    categories: categoriesTable,
    products: productsTable,
    paymentMethods: paymentMethodsTable,
    banners: bannersTable,
    news: newsTable,
    socialLinks: socialLinksTable,
    providers: providersTable,
    coupons: couponsTable,
    vipMemberships: vipMembershipsTable,
    orderMessages: orderMessagesTable,
    apiKeys: apiKeysTable,
  };
  for (const [k, table] of Object.entries(tableMap)) {
    const rows = body[k];
    if (Array.isArray(rows) && rows.length > 0) {
      try {
        const stripped = rows.map(({ id, ...rest }: any) => rest);
        const result = await db.insert(table).values(stripped).onConflictDoNothing().returning();
        imported += (result as any[]).length;
      } catch {
        // continue silently for invalid rows
      }
    }
  }
  await logActivity(
    { id: req.session.adminId, name: req.session.adminUsername },
    "import_backup",
    "system",
    { imported },
  );
  res.json({ ok: true, imported });
});

// ========== SETTINGS LIST/ITEMS WRAPPER ==========
router.get("/admin/settings/list", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(settingsTable);
  res.json(rows);
});

router.put("/admin/settings/items", requireAdmin, async (req, res) => {
  const { items } = req.body as { items: Array<{ key: string; value: any }> };
  if (!Array.isArray(items)) {
    res.status(400).json({ error: "items required" });
    return;
  }
  for (const it of items) {
    await db
      .insert(settingsTable)
      .values({ key: it.key, value: it.value })
      .onConflictDoUpdate({ target: settingsTable.key, set: { value: it.value } });
  }
  res.json({ ok: true });
}); 

// ========== PROVIDER SYNC (UPDATED – لا يضيف منتجات جديدة) ==========
router.post("/admin/providers/:id/sync", requireAdmin, async (req, res) => {
  const providerId = Number(req.params.id);
  const [provider] = await db
    .select()
    .from(providersTable)
    .where(eq(providersTable.id, providerId))
    .limit(1);

  if (!provider) {
    res.status(404).json({ error: "المزود غير موجود" });
    return;
  }

  const adapter = new MersalAdapter();

  try {
    const products = await adapter.fetchProducts(
      provider.apiKey!,
      provider.apiUrl || undefined
    );

    let updated = 0;

    for (const p of products) {
      // البحث عن منتج موجود مسبقاً بنفس provider_product_id
      const existingProdResult = await db.execute(sql`
        SELECT id FROM products 
        WHERE provider_product_id = ${Number(p.id)} 
        LIMIT 1
      `);
      const existingProdId = (existingProdResult.rows as any[])[0]?.id || null;

      // تحديث المنتج الموجود فقط – لا نقوم بإدراج جديد
      if (existingProdId) {
        await db.execute(sql`
          UPDATE products SET
            name = ${p.name},
            image = ${p.categoryImage || "/cat-cards.png"},
            price_usd = ${String(p.price)},
            price_syp = '0',
            base_price_usd = ${p.basePrice ? String(p.basePrice) : null},
            product_type = ${p.productType},
            available = ${p.available},
            min_qty = ${p.minQty ? String(p.minQty) : null},
            max_qty = ${p.maxQty ? String(p.maxQty) : null},
            description = ${p.description || null},
            source = 'provider'
          WHERE id = ${existingProdId}
        `);
        updated++;
      }
      // تمت إزالة كتلة else الخاصة بالإدراج
    }

    await logActivity(
      { id: req.session.adminId, name: req.session.adminUsername },
      "sync_provider",
      `provider_${providerId}`,
      { updated }
    );

    res.json({
      ok: true,
      message: `✅ تم تحديث ${updated} منتج مرتبط`,
      updated,
    });
  } catch (error: any) {
    console.error("🔥 Sync error:", error);
    res.status(500).json({ error: error.message || "فشلت المزامنة" });
  }
});


// ========== FETCH PROVIDER PRODUCTS (للاطلاع على المعرفات) ==========
router.get("/admin/providers/:id/products", requireAdmin, async (req, res) => {
  const providerId = Number(req.params.id);
  const [provider] = await db
    .select()
    .from(providersTable)
    .where(eq(providersTable.id, providerId))
    .limit(1);

  if (!provider) {
    res.status(404).json({ error: "المزود غير موجود" });
    return;
  }

  const adapter = new MersalAdapter();
  try {
    const products = await adapter.fetchProducts(
      provider.apiKey!,
      provider.apiUrl || undefined
    );

    // إعادة قائمة بالمعلومات الأساسية فقط (id, name, price)
    const list = products.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      category: p.categoryName,
    }));

    res.json({ provider: provider.name, products: list });
  } catch (error: any) {
    console.error("Fetch provider products error:", error);
    res.status(500).json({ error: error.message || "فشل جلب المنتجات" });
  }
});

// ========== VERIFY SINGLE PRODUCT AGAINST PROVIDER ==========
router.get("/admin/products/:id/provider-status", requireAdmin, async (req, res) => {
  const productId = Number(req.params.id);
  const [product] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, productId))
    .limit(1);

  if (!product) {
    res.status(404).json({ error: "المنتج غير موجود" });
    return;
  }

  if (!product.providerId) {
    res.json({
      ok: true,
      type: "local",
      existsAtProvider: false,
      message: "هذا منتج محلي غير مرتبط بمزوّد خارجي.",
      product: {
        id: product.id,
        name: product.name,
        source: product.source,
      },
    });
    return;
  }

  const [provider] = await db
    .select()
    .from(providersTable)
    .where(eq(providersTable.id, product.providerId))
    .limit(1);

  if (!provider) {
    res.status(400).json({ error: `المزوّد المرتبط (${product.providerId}) غير موجود` });
    return;
  }

  const apiUrl = provider.apiUrl || "https://api.mersal-card.com";
  let isMersalHost = false;
  try {
    const host = new URL(apiUrl).host.toLowerCase();
    isMersalHost = host === "api.mersal-card.com";
  } catch {
    isMersalHost = false;
  }

  if (!product.providerProductId) {
    res.json({
      ok: true,
      type: "provider",
      existsAtProvider: false,
      provider: {
        id: provider.id,
        name: provider.name,
        providerType: provider.providerType,
        apiUrl,
        isMersalHost,
      },
      product: {
        id: product.id,
        name: product.name,
        source: product.source,
      },
      message: "المنتج مرتبط بمزوّد لكن بدون providerProductId.",
    });
    return;
  }

  const adapter = getAdapter(provider.providerType || "custom");
  if (!adapter) {
    res.status(400).json({ error: `نوع المزوّد غير مدعوم: ${provider.providerType}` });
    return;
  }

  try {
    const remoteProducts = await adapter.fetchProducts(provider.apiKey!, provider.apiUrl || undefined);
    const remote = remoteProducts.find((p) => Number(p.id) === Number(product.providerProductId));
    const remotePrice = remote?.price != null ? Number(remote.price) : null;
    const localPrice = Number(product.priceUsd);

    res.json({
      ok: true,
      type: "provider",
      existsAtProvider: !!remote,
      provider: {
        id: provider.id,
        name: provider.name,
        providerType: provider.providerType,
        apiUrl,
        isMersalHost,
      },
      product: {
        id: product.id,
        name: product.name,
        source: product.source,
        localProviderProductId: product.providerProductId,
        localPriceUsd: localPrice,
      },
      remote: remote
        ? {
            id: remote.id,
            name: remote.name,
            priceUsd: remotePrice,
            categoryName: remote.categoryName,
            available: remote.available,
            minQty: remote.minQty ?? null,
            maxQty: remote.maxQty ?? null,
          }
        : null,
      priceDiffUsd: remotePrice != null ? Number((localPrice - remotePrice).toFixed(6)) : null,
      message: remote
        ? "تم العثور على المنتج عند المزوّد الخارجي."
        : "لم يتم العثور على providerProductId في قائمة منتجات المزوّد.",
    });
  } catch (error: any) {
    console.error("Verify provider product error:", error);
    res.status(500).json({ error: error?.message || "فشل التحقق من المنتج عند المزوّد" });
  }
});

export default router;
