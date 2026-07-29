import { Link, useRoute } from "wouter";
import { ChevronRight, PackageOpen, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublicJson } from "@/lib/public-api";

type ProductItem = {
  id: string;
  name: string;
  categoryId: string;
  groupId?: string;
  categoryName: string;
  image: string;
  priceUsd: number;
  minTotalUsd?: number;
  minQty?: number;
};

type ProductGroupItem = {
  id: string;
  categoryId: string;
  name: string;
  image: string;
};

function formatTotalUsdPrice(product: ProductItem) {
  const apiTotal = Number(product.minTotalUsd);
  if (Number.isFinite(apiTotal) && apiTotal >= 0) return `$${apiTotal.toFixed(5)}`;
  const unitPrice = Number(product.priceUsd || 0);
  const minQty = Number(product.minQty || 1);
  const total = unitPrice * (Number.isFinite(minQty) && minQty > 0 ? minQty : 1);
  return `$${Number.isFinite(total) ? total.toFixed(5) : "0.00000"}`;
}

export default function ProductGroupProducts() {
  const [, params] = useRoute("/groups/:id");
  const groupId = params?.id;
  const [group, setGroup] = useState<ProductGroupItem | null>(null);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;
    setLoading(true);

    Promise.all([
      getPublicJson<ProductGroupItem[]>(`/product-groups`),
      getPublicJson<ProductItem[]>(`/products?groupId=${encodeURIComponent(groupId)}`),
    ])
      .then(([groups, rows]) => {
        if (cancelled) return;
        setGroup(groups.find((item) => item.id === groupId) || null);
        setProducts(rows);
      })
      .catch((error) => {
        console.error("Group products load failed:", error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [groupId]);

  const sortedProducts = useMemo(() => products, [products]);

  return (
    <div className="min-h-screen bg-background flex flex-col animate-in slide-in-from-right-4 duration-300">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <Link href={group ? `/categories/${group.categoryId}` : "/"}>
          <div className="bg-card p-2 rounded-full cursor-pointer hover:bg-white/5 transition-colors">
            <ChevronRight className="w-5 h-5 text-foreground" />
          </div>
        </Link>
        <div className="flex-1">
          <div className="text-sm text-muted-foreground">اختر النوع أو المصدر</div>
          <div className="text-lg font-black text-foreground">{group?.name || "مجموعة المنتجات"}</div>
        </div>
      </div>

      <div className="flex-1 p-4">
        {loading ? (
          <div className="grid grid-cols-4 gap-3.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <Skeleton className="w-full aspect-[4/3] rounded-2xl" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-2/3 mx-auto" />
              </div>
            ))}
          </div>
        ) : sortedProducts.length > 0 ? (
          <div className="grid grid-cols-4 gap-3.5">
            {sortedProducts.map((product, i) => (
              <Link key={product.id} href={`/products/${product.id}`}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="h-full min-h-[126px] bg-card/90 border border-white/5 rounded-2xl overflow-hidden cursor-pointer group shadow-lg hover:border-primary/30 transition-all flex flex-col"
                >
                  <div className="aspect-[4/3] relative overflow-hidden bg-muted/30 shrink-0">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full xpay-brand-card flex items-center justify-center">
                        <PackageOpen className="w-8 h-8 text-primary/40" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                  </div>
                  <div className="min-h-[58px] p-2.5 flex flex-col items-center justify-center gap-1">
                    <h3 className="text-[11px] sm:text-xs font-bold text-foreground line-clamp-2 leading-snug text-center break-words group-hover:text-primary transition-colors">
                      {product.name}
                    </h3>
                    <span className="text-[11px] font-black text-primary leading-none">
                      {formatTotalUsdPrice(product)}
                    </span>
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 bg-card rounded-full flex items-center justify-center mb-4 border border-white/5 text-muted-foreground">
              <Search className="w-8 h-8" />
            </div>
            <p className="text-foreground font-medium">لا توجد منتجات داخل هذه المجموعة</p>
          </div>
        )}
      </div>
    </div>
  );
}
