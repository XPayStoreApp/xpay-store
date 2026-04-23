import { useListProducts, getListProductsQueryKey } from "@workspace/api-client-react";
import { Link, useRoute } from "wouter";
import { ChevronRight, Search, PackageOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

export default function Categories() {
  const [, params] = useRoute("/categories/:id");
  const categoryId = params?.id;
  const [search, setSearch] = useState("");

  const { data: products, isLoading } = useListProducts(
    { categoryId, q: search || undefined },
    { query: { enabled: !!categoryId, queryKey: getListProductsQueryKey({ categoryId, q: search || undefined }) } }
  );

  return (
    <div className="min-h-screen bg-background flex flex-col animate-in slide-in-from-right-4 duration-300">
      {/* Top App Bar */}
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

      {/* Content */}
      <div className="flex-1 p-4">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <Skeleton className="w-full aspect-[4/3] rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : products && products.length > 0 ? (
          <div className="grid grid-cols-2 gap-4">
            {products.map((product, i) => (
              <Link key={product.id} href={`/products/${product.id}`}>
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-card border border-white/5 rounded-2xl overflow-hidden cursor-pointer group shadow-lg hover:border-primary/30 transition-all"
                >
                  <div className="aspect-[4/3] relative overflow-hidden bg-muted/30">
                    {product.image ? (
                      <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center">
                        <PackageOpen className="w-8 h-8 text-primary/40" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                    <div className="absolute bottom-2 left-2 right-2 flex justify-between items-end">
                      <span className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md">
                        ${product.priceUsd.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className="p-3">
                    <h3 className="text-xs font-semibold text-foreground line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                      {product.name}
                    </h3>
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
            <p className="text-sm text-muted-foreground mt-1">جرب البحث بكلمات أخرى</p>
          </div>
        )}
      </div>
    </div>
  );
}
