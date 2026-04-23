import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  numeric,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  telegramId: text("telegram_id").notNull().unique(),
  username: text("username").notNull(),
  email: text("email"),
  balanceUsd: numeric("balance_usd", { precision: 12, scale: 4 }).notNull().default("0"),
  balanceSyp: numeric("balance_syp", { precision: 14, scale: 2 }).notNull().default("0"),
  role: text("role").notNull().default("user"),
  banned: boolean("banned").notNull().default(false),
  vipLevel: integer("vip_level").notNull().default(0),
  referralCode: text("referral_code"),
  referredBy: integer("referred_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const categoriesTable = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  image: text("image").notNull(),
  order: integer("order").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull().references(() => categoriesTable.id),
  name: text("name").notNull(),
  image: text("image").notNull(),
  priceUsd: numeric("price_usd", { precision: 12, scale: 4 }).notNull(),
  priceSyp: numeric("price_syp", { precision: 14, scale: 2 }).notNull(),
  basePriceUsd: numeric("base_price_usd", { precision: 12, scale: 4 }),
  productType: text("product_type").notNull().default("package"),
  available: boolean("available").notNull().default(true),
  minQty: numeric("min_qty", { precision: 14, scale: 2 }),
  maxQty: numeric("max_qty", { precision: 14, scale: 2 }),
  description: text("description"),
  featured: boolean("featured").notNull().default(false),
  providerId: integer("provider_id"),
  source: text("source").notNull().default("manual"),
});

export const newsTable = pgTable("news", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  type: text("type").notNull().default("general"),
  active: boolean("active").notNull().default(true),
});

export const bannersTable = pgTable("banners", {
  id: serial("id").primaryKey(),
  image: text("image").notNull(),
  title: text("title").notNull(),
  link: text("link"),
  order: integer("order").notNull().default(0),
});

export const paymentMethodsTable = pgTable("payment_methods", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  subtitle: text("subtitle").notNull(),
  instructions: text("instructions"),
  walletAddress: text("wallet_address"),
  qrImage: text("qr_image"),
  minAmount: numeric("min_amount", { precision: 12, scale: 2 }).notNull().default("1"),
  active: boolean("active").notNull().default(true),
});

export const socialLinksTable = pgTable("social_links", {
  id: serial("id").primaryKey(),
  platform: text("platform").notNull(),
  url: text("url").notNull(),
  label: text("label").notNull(),
  order: integer("order").notNull().default(0),
});

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  quantity: numeric("quantity", { precision: 14, scale: 2 }).notNull(),
  userIdentifier: text("user_identifier"),
  totalUsd: numeric("total_usd", { precision: 12, scale: 4 }).notNull(),
  totalSyp: numeric("total_syp", { precision: 14, scale: 2 }).notNull(),
  costUsd: numeric("cost_usd", { precision: 12, scale: 4 }).notNull().default("0"),
  status: text("status").notNull().default("wait"),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const depositsTable = pgTable("deposits", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  amountUsd: numeric("amount_usd", { precision: 12, scale: 4 }).notNull(),
  amountSyp: numeric("amount_syp", { precision: 14, scale: 2 }),
  currency: text("currency").notNull(),
  method: text("method").notNull(),
  methodLabel: text("method_label").notNull(),
  transactionId: text("transaction_id").notNull(),
  proofImage: text("proof_image"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const adminsTable = pgTable("admins", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  email: text("email"),
  role: text("role").notNull().default("admin"),
  permissions: jsonb("permissions"),
  twoFactorSecret: text("two_factor_secret"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const settingsTable = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});

export const providersTable = pgTable("providers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  apiUrl: text("api_url"),
  apiKey: text("api_key"),
  notes: text("notes"),
  priority: integer("priority").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const couponsTable = pgTable("coupons", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  discountPct: numeric("discount_pct", { precision: 5, scale: 2 }).notNull(),
  maxUses: integer("max_uses").notNull().default(100),
  usedCount: integer("used_count").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const vipMembershipsTable = pgTable("vip_memberships", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  requiredAmount: numeric("required_amount", { precision: 12, scale: 2 }).notNull(),
  profitPct: numeric("profit_pct", { precision: 5, scale: 2 }).notNull(),
  badge: text("badge"),
  hidden: boolean("hidden").notNull().default(false),
});

export const autoCodesTable = pgTable("auto_codes", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  code: text("code").notNull(),
  note: text("note"),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const orderMessagesTable = pgTable("order_messages", {
  id: serial("id").primaryKey(),
  event: text("event").notNull().unique(),
  title: text("title").notNull(),
  body: text("body").notNull(),
});

export const activityLogTable = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  actorType: text("actor_type").notNull().default("admin"),
  actorId: text("actor_id"),
  actorName: text("actor_name"),
  action: text("action").notNull(),
  target: text("target"),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const apiKeysTable = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  keyValue: text("key_value").notNull().unique(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  targetType: text("target_type").notNull().default("all"),
  targetUserId: integer("target_user_id"),
  title: text("title"),
  content: text("content").notNull(),
  status: text("status").notNull().default("sent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
