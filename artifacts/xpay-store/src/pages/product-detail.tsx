import { useGetProduct, getGetProductQueryKey, useCreateOrder } from "@workspace/api-client-react";
import { useRoute, useLocation, Link } from "wouter";
import { ChevronRight, ShoppingCart, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

type PurchaseMode = "apps" | "games" | "balance";

function detectPurchaseMode(categoryName: string, productType: string): PurchaseMode {
  const normalized = (categoryName || "").toLowerCase();

  if (
    normalized.includes("رصيد") ||
    normalized.includes("balance") ||
    normalized.includes("اتصالات") ||
    normalized.includes("internet") ||
    normalized.includes("numbers")
  ) {
    return "balance";
  }

  if (normalized.includes("game") || normalized.includes("games") || normalized.includes("ألعاب")) {
    return "games";
  }

  if (normalized.includes("app") || normalized.includes("apps") || normalized.includes("تطبيق")) {
    return "apps";
  }

  return productType === "amount" ? "balance" : "games";
}

export default function ProductDetail() {
  const [, params] = useRoute("/products/:id");
  const id = params?.id;
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: product, isLoading } = useGetProduct(id || "", {
    query: { enabled: !!id, queryKey: getGetProductQueryKey(id || "") },
  });

  const createOrder = useCreateOrder();
  const [quantity, setQuantity] = useState(1);
  const [quantityInput, setQuantityInput] = useState("1");
  const [accountId, setAccountId] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  useEffect(() => {
    if (!product) return;
    const min = Number(product.minQty || 1);
    setQuantity(min);
    setQuantityInput(String(min));
  }, [product?.id, product?.minQty]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Skeleton className="w-full h-64 rounded-b-3xl" />
        <div className="p-4 space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-6 w-1/4" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!product) {
    return <div className="p-4 text-center mt-20">المنتج غير موجود</div>;
  }

  const minQty = product.minQty || 1;
  const purchaseMode = detectPurchaseMode(product.categoryName, product.productType);
  const totalUsd = product.priceUsd * quantity;
  const totalSyp = product.priceSyp * quantity;

  const commitQuantityInput = (rawValue?: string) => {
    const source = typeof rawValue === "string" ? rawValue : quantityInput;
    const normalized = String(source || "").replace(/,/g, "").trim();
    if (!normalized) {
      setQuantity(minQty);
      setQuantityInput(String(minQty));
      return minQty;
    }

    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setQuantity(minQty);
      setQuantityInput(String(minQty));
      return minQty;
    }

    const nextQuantity = Math.max(minQty, Math.floor(parsed));
    setQuantity(nextQuantity);
    setQuantityInput(String(nextQuantity));
    return nextQuantity;
  };

  const handleQtyInputChange = (value: string) => {
    const normalized = String(value || "").replace(/,/g, "").trim();
    if (!normalized) {
      setQuantityInput("");
      return;
    }

    if (!/^\d+$/.test(normalized)) return;
    setQuantityInput(normalized);
  };

  const handlePurchase = () => {
    const finalQuantity = commitQuantityInput();

    if (purchaseMode === "balance") {
      if (!phoneNumber.trim()) {
        toast.error("يرجى إدخال رقم الخط");
        return;
      }
    } else if (!accountId.trim()) {
      toast.error("يرجى إدخال معرف المستخدم (ID)");
      return;
    }

    createOrder.mutate(
      {
        data: {
          productId: product.id,
          quantity: finalQuantity,
          userIdentifier: purchaseMode === "balance" ? phoneNumber.trim() : accountId.trim(),
        },
      },
      {
        onSuccess: (order) => {
          toast.success("تم إرسال الطلب إلى API المزود بنجاح");
          queryClient.invalidateQueries({ queryKey: ["/api/me"] });
          queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
          setLocation(`/orders/${order.id}`);
        },
        onError: (err: any) => {
          toast.error(err.response?.data?.message || "حدث خطأ أثناء تنفيذ الطلب");
        },
      },
    );
  };

  return (
    <div className="min-h-screen bg-background pb-24 animate-in slide-in-from-bottom-4 duration-500">
      <div className="relative w-full h-64 bg-card rounded-b-[2rem] overflow-hidden shadow-2xl">
        <div className="absolute top-4 right-4 z-20">
          <Link href={`/categories/${product.categoryId}`}>
            <div className="bg-black/40 backdrop-blur-md p-2 rounded-full cursor-pointer hover:bg-black/60 transition-colors text-white">
              <ChevronRight className="w-6 h-6" />
            </div>
          </Link>
        </div>
        {product.image ? (
          <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/30 to-cyan-600/30 flex items-center justify-center">
            <ShoppingCart className="w-16 h-16 text-primary/50" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
      </div>

      <div className="px-5 -mt-6 relative z-10">
        <h1 className="text-2xl font-bold text-foreground leading-tight mb-2">{product.name}</h1>
        <div className="text-xs text-muted-foreground mb-4">{product.categoryName}</div>

        <div className="space-y-6 bg-card border border-white/5 p-5 rounded-3xl shadow-lg">
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm font-bold text-foreground">الكمية</label>
              <span className="text-xs text-muted-foreground">
                (الحد الأدنى: {minQty.toLocaleString()})
              </span>
            </div>

            <div className="bg-background border border-white/5 p-2 rounded-2xl">
              <Input
                type="number"
                min={minQty}
                step={1}
                value={quantityInput}
                onChange={(e) => handleQtyInputChange(e.target.value)}
                onBlur={() => commitQuantityInput()}
                className="w-full h-10 text-center font-bold text-lg bg-transparent border-0 focus-visible:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>

          {(purchaseMode === "apps" || purchaseMode === "games") && (
            <div>
              <label className="text-sm font-bold text-foreground mb-3 block">ID المستخدم *</label>
              <Input
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                placeholder="أدخل ID المستخدم"
                className="h-12 bg-background border-white/5 rounded-2xl px-4 focus-visible:ring-primary/50 text-base"
              />
            </div>
          )}

          {purchaseMode === "balance" && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-emerald-400 font-bold text-sm">
                الكمية المحددة: {quantity} وحدة
              </div>
              <div>
                <label className="text-sm font-bold text-foreground mb-3 block">رقم الخط *</label>
                <Input
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="09XXXXXXXX"
                  className="h-12 bg-background border-white/5 rounded-2xl px-4 focus-visible:ring-primary/50 text-base"
                />
              </div>
            </div>
          )}

          {(purchaseMode === "apps" || purchaseMode === "games") && (
            <p className="text-xs text-accent flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              تأكد من صحة الـ ID قبل تنفيذ الشراء.
            </p>
          )}

          <div className="h-px w-full bg-white/5" />

          {(purchaseMode === "apps" || purchaseMode === "games") && (
            <div className="rounded-2xl bg-background border border-white/5 p-4 text-center">
              <div className="text-sm text-muted-foreground">السعر الإجمالي</div>
              <div className="text-3xl font-black text-primary mt-1">${totalUsd.toFixed(5)}</div>
              <div className="text-xs text-muted-foreground mt-1">{totalSyp.toLocaleString()} ل.س</div>
            </div>
          )}

          <Button
            onClick={handlePurchase}
            disabled={createOrder.isPending || !product.available}
            className="w-full h-14 rounded-2xl text-base font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25"
          >
            {createOrder.isPending ? "جاري تنفيذ الطلب..." : "تأكيد الشراء"}
          </Button>
        </div>
      </div>
    </div>
  );
}
