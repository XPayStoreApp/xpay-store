import { Router, type IRouter } from "express";
import { db, categoriesTable, productsTable, newsTable, bannersTable } from "@workspace/db";
import { and, asc, eq, ilike, sql } from "drizzle-orm";
import {
  ListCategoriesResponse,
  ListProductsResponse,
  ListFeaturedProductsResponse,
  GetProductResponse,
  ListNewsResponse,
  ListBannersResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function productRow(p: typeof productsTable.$inferSelect, categoryName: string) {
  return {
    id: String(p.id),
    name: p.name,
    categoryId: String(p.categoryId),
    categoryName,
    image: p.image,
    priceUsd: Number(p.priceUsd),
    priceSyp: Number(p.priceSyp),
    productType: p.productType as "amount" | "package",
    available: p.available,
    minQty: p.minQty != null ? Number(p.minQty) : undefined,
    maxQty: p.maxQty != null ? Number(p.maxQty) : undefined,
    description: p.description ?? undefined,
    featured: p.featured,
  };
}

router.get("/categories", async (_req, res) => {
  try {
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
    const { categoryId, q } = req.query as { categoryId?: string; q?: string };
    const conds = [];
    if (categoryId) conds.push(eq(productsTable.categoryId, Number(categoryId)));
    if (q) conds.push(ilike(productsTable.name, `%${q}%`));
    const rows = await db
      .select({
        p: productsTable,
        cname: categoriesTable.name,
      })
      .from(productsTable)
      .innerJoin(categoriesTable, eq(categoriesTable.id, productsTable.categoryId))
      .where(conds.length ? and(...conds) : undefined);
    res.json(ListProductsResponse.parse(rows.map((r) => productRow(r.p, r.cname))));
  } catch (error) {
    console.error("🔥 FULL ERROR in /products:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/products/featured", async (_req, res) => {
  try {
    const rows = await db
      .select({ p: productsTable, cname: categoriesTable.name })
      .from(productsTable)
      .innerJoin(categoriesTable, eq(categoriesTable.id, productsTable.categoryId))
      .where(eq(productsTable.featured, true));
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
      .where(eq(productsTable.id, id))
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