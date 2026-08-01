import { Router, type IRouter } from "express";
import { db, categoriesTable, productGroupsTable, productsTable, newsTable, bannersTable } from "@workspace/db";
import { and, asc, eq, ilike, sql } from "drizzle-orm";
import {
  ListCategoriesResponse,
  ListProductsResponse,
  ListFeaturedProductsResponse,
  GetProductResponse,
  ListNewsResponse,
  ListBannersResponse,
} from "@workspace/api-zod";
import { addUnitPrices } from "../lib/pricing.js";

const router: IRouter = Router();

function productRow(p: typeof productsTable.$inferSelect, categoryName: string) {
  const finalPriceUsd =
    p.finalUnitPrice != null
      ? Number(p.finalUnitPrice)
      : Number(addUnitPrices(p.providerUnitPrice ?? p.basePriceUsd ?? 0, p.storeProfitPerUnit ?? p.priceUsd ?? 0));
  const minQty = p.minQuantity ?? (p.minQty != null ? Number(p.minQty) : 1);
  const safeMinQty = Number.isFinite(Number(minQty)) && Number(minQty) > 0 ? Number(minQty) : 1;
  const quantityValues = Array.isArray(p.quantityValues)
    ? p.quantityValues
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
        .sort((a, b) => a - b)
    : undefined;

  return {
    id: String(p.id),
    name: p.name,
    categoryId: String(p.categoryId),
    groupId: p.groupId != null ? String(p.groupId) : undefined,
    categoryName,
    image: p.image,
    order: p.order,
    priceUsd: finalPriceUsd,
    minTotalUsd: Number((finalPriceUsd * safeMinQty).toFixed(8)),
    priceSyp: Number(p.priceSyp),
    productType: p.productType as "amount" | "package",
    available: p.available,
    minQty: safeMinQty,
    maxQty: p.maxQuantity ?? (p.maxQty != null ? Number(p.maxQty) : undefined),
    quantityType: p.quantityType,
    quantityValues,
    description: p.description ?? undefined,
    featured: p.featured,
  };
}

router.get("/categories", async (_req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    const cats = await db.select().from(categoriesTable).orderBy(asc(categoriesTable.order));
    const counts = await db
      .select({ cid: productsTable.categoryId, c: sql<number>`count(*)::int` })
      .from(productsTable)
      .groupBy(productsTable.categoryId);
    const map = new Map(counts.map((c) => [c.cid, c.c]));
    const data = ListCategoriesResponse.parse(
      cats.map((c) => ({
        id: String(c.id),
        name: c.name,
        image: c.image,
        imageVersion: `${c.id}:${c.image}`,
        order: c.order,
        active: c.active,
        productCount: map.get(c.id) ?? 0,
      })),
    );
    res.json(data);
  } catch (error) {
    console.error("🔥 FULL ERROR in /categories:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/products", async (req, res) => {
  try {
    const { categoryId, groupId, q } = req.query as { categoryId?: string; groupId?: string; q?: string };
    const conds = [eq(productsTable.available, true)];
    if (categoryId) conds.push(eq(productsTable.categoryId, Number(categoryId)));
    if (groupId) {
      conds.push(eq(productsTable.groupId, Number(groupId)));
    } else if (categoryId) {
      conds.push(sql`${productsTable.groupId} IS NULL`);
    }
    if (q) conds.push(ilike(productsTable.name, `%${q}%`));
    const rows = await db
      .select({
        p: productsTable,
        cname: categoriesTable.name,
      })
      .from(productsTable)
      .innerJoin(categoriesTable, eq(categoriesTable.id, productsTable.categoryId))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(asc(productsTable.order), asc(productsTable.id));
    res.json(ListProductsResponse.parse(rows.map((r) => productRow(r.p, r.cname))));
  } catch (error) {
    console.error("🔥 FULL ERROR in /products:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/product-groups", async (req, res) => {
  try {
    const { categoryId } = req.query as { categoryId?: string };
    const conds = [eq(productGroupsTable.active, true)];
    if (categoryId) conds.push(eq(productGroupsTable.categoryId, Number(categoryId)));

    const rows = await db
      .select({
        g: productGroupsTable,
        productCount: sql<number>`count(${productsTable.id})::int`,
      })
      .from(productGroupsTable)
      .leftJoin(
        productsTable,
        and(eq(productsTable.groupId, productGroupsTable.id), eq(productsTable.available, true)),
      )
      .where(and(...conds))
      .groupBy(productGroupsTable.id)
      .orderBy(asc(productGroupsTable.order), asc(productGroupsTable.id));

    res.json(
      rows.map((r) => ({
        id: String(r.g.id),
        categoryId: String(r.g.categoryId),
        name: r.g.name,
        image: r.g.image,
        imageVersion: `${r.g.id}:${r.g.image}`,
        order: r.g.order,
        active: r.g.active,
        productCount: Number(r.productCount || 0),
      })),
    );
  } catch (error) {
    console.error("🔥 FULL ERROR in /product-groups:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/products/featured", async (_req, res) => {
  try {
    const rows = await db
      .select({ p: productsTable, cname: categoriesTable.name })
      .from(productsTable)
      .innerJoin(categoriesTable, eq(categoriesTable.id, productsTable.categoryId))
      .where(and(eq(productsTable.featured, true), eq(productsTable.available, true)))
      .orderBy(asc(productsTable.order), asc(productsTable.id));
    res.json(ListFeaturedProductsResponse.parse(rows.map((r) => productRow(r.p, r.cname))));
  } catch (error) {
    console.error("🔥 FULL ERROR in /products/featured:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/products/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const rows = await db
      .select({ p: productsTable, cname: categoriesTable.name })
      .from(productsTable)
      .innerJoin(categoriesTable, eq(categoriesTable.id, productsTable.categoryId))
      .where(and(eq(productsTable.id, id), eq(productsTable.available, true)))
      .limit(1);
    if (!rows.length) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(GetProductResponse.parse(productRow(rows[0]!.p, rows[0]!.cname)));
  } catch (error) {
    console.error("🔥 FULL ERROR in /products/:id:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/news", async (_req, res) => {
  try {
    const rows = await db.select().from(newsTable).where(eq(newsTable.active, true));
    res.json(
      ListNewsResponse.parse(
        rows.map((n) => ({
          id: String(n.id),
          content: n.content,
          type: n.type as "general" | "offer" | "alert" | "new_service",
        })),
      ),
    );
  } catch (error) {
    console.error("🔥 FULL ERROR in /news:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/banners", async (_req, res) => {
  try {
    const rows = await db.select().from(bannersTable).orderBy(asc(bannersTable.order));
    res.json(
      ListBannersResponse.parse(
        rows.map((b) => ({
          id: String(b.id),
          image: b.image,
          title: b.title,
          link: b.link ?? undefined,
        })),
      ),
    );
  } catch (error) {
    console.error("🔥 FULL ERROR in /banners:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
