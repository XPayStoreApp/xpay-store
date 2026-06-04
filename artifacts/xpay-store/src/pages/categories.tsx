import { useListProducts, getListProductsQueryKey } from "@workspace/api-client-react";
import { Link, useRoute } from "wouter";
import { ChevronRight, Search, PackageOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useEffect, useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { getPublicJson } from "@/lib/public-api";

type ProductItem = {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  image: string;
  priceUsd: number;
};

function formatUsdPrice(value: number) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return "$0.00";
  return `$${amount.toFixed(2)}`;
}

export default function Categories() {
  const [, params] = useRoute("/categories/:id");
  const categoryId = params?.id;
  const [search, setSearch] = useState("");
  const [fallbackProducts, setFallbackProducts] = useState<ProductItem[] | null>(null);

  const { data: products, isLoading } = useListProducts(
    { categoryId, q: search || undefined },
    { query: { enabled: !!categoryId, queryKey: getListProductsQueryKey({ categoryId, q: search || undefined }) } }
  );

  useEffect(() => {
    if (!categoryId) return;

    let cancelled = false;
    const query = search.trim();
    const path = `/products?categoryId=${encodeURIComponent(categoryId)}${query ? `&q=${encodeURIComponent(query)}` : ""}`;
    getPublicJson<ProductItem[]>(path)
      .then((rows) => {
        if (!cancelled) setFallbackProducts(rows);
      })
      .catch((error) => {
        console.error("Fallback products load failed:", error);
      });

    return () => {
      cancelled = true;
    };
  }, [categoryId, search]);

  const visibleProducts = useMemo(
    () => (fallbackProducts && fallbackProducts.length > 0 ? fallbackProducts : products) || [],
    [fallbackProducts, products],
  );

  return (
    <div className="min-h-screen bg-background flex flex-col animate-in slide-in-from-right-4 duration-300">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <Link href="/">
          <div className="bg-card p-2 rounded-full cursor-pointer hover:bg-white/5 transition-colors">
            <ChevronRight className="w-5 h-5 text-foreground" />
          </div>
        </Link>
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث عن منتج..."
              className="pl-3 pr-9 h-10 bg-card border-white/5 rounded-full text-sm focus-visible:ring-primary/50"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 p-4">
        {isLoading && visibleProducts.length === 0 ? (
          <div className="grid grid-cols-4 gap-3.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <Skeleton className="w-full aspect-[4/3] rounded-2xl" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-2/3 mx-auto" />
              </div>
            ))}
          </div>
        ) : visibleProducts.length > 0 ? (
          <div className="grid grid-cols-4 gap-3.5">
            {visibleProducts.map((product, i) => (
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
                      {formatUsdPrice(product.priceUsd)}
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
            <p className="text-foreground font-medium">لا توجد منتجات</p>
            <p className="text-sm text-muted-foreground mt-1">جرّب البحث بكلمات أخرى</p>
          </div>
        )}
      </div>
    </div>
  );
}
