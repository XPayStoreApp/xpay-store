import { Router, type IRouter } from "express";
import { db, paymentMethodsTable, settingsTable, socialLinksTable } from "@workspace/db";
import { asc, eq } from "drizzle-orm";
import { ListPaymentMethodsResponse, ListSocialLinksResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/payment-methods", async (_req, res) => {
  const rows = await db.select().from(paymentMethodsTable).where(eq(paymentMethodsTable.active, true));
  res.json(
    ListPaymentMethodsResponse.parse(
      rows.map((m) => ({
        id: String(m.id),
        code: m.code as "sham_cash" | "binance_pay" | "syriatel_cash" | "mtn_cash" | "usdt_auto",
        name: m.name,
        subtitle: m.subtitle,
        instructions: m.instructions ?? undefined,
        walletAddress: m.walletAddress ?? undefined,
        qrImage: m.qrImage ?? undefined,
        minAmount: Number(m.minAmount),
        active: m.active,
      })),
    ),
  );
});

router.get("/social-links", async (_req, res) => {
  const rows = await db.select().from(socialLinksTable).orderBy(asc(socialLinksTable.order));
  res.json(
    ListSocialLinksResponse.parse(
      rows.map((s) => ({ id: String(s.id), platform: s.platform, url: s.url, label: s.label })),
    ),
  );
});

router.get("/theme", async (_req, res) => {
  const rows = await db.select().from(settingsTable);
  const map = new Map(rows.map((row) => [row.key, row.value]));

  res.json({
    primary: String(map.get("theme_primary") || "#0052CC"),
    accent: String(map.get("theme_accent") || "#F97316"),
    background: String(map.get("theme_bg") || "#0A1628"),
    font: String(map.get("theme_font") || "Cairo"),
    radius: String(map.get("theme_radius") || "16"),
  });
});

export default router;
