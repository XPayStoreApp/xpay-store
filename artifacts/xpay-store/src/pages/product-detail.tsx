import { useGetProduct, getGetProductQueryKey, useCreateOrder } from "@workspace/api-client-react";
import { useRoute, useLocation, Link } from "wouter";
import { ChevronRight, Minus, Plus, ShoppingCart, AlertCircle } from "lucide-react";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export default function ProductDetail() {
  const [, params] = useRoute("/products/:id");
  const id = params?.id;
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: product, isLoading } = useGetProduct(id || "", {
    query: { enabled: !!id, queryKey: getGetProductQueryKey(id || "") }
  });

  const createOrder = useCreateOrder();

  const [quantity, setQuantity] = useState(1);
  const [userId, setUserId] = useState("");

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

  const handleQtyChange = (delta: number) => {
    const newQty = quantity + delta;
    if (newQty < (product.minQty || 1)) return;
    if (product.maxQty && newQty > product.maxQty) return;
    setQuantity(newQty);
  };

  const isAmountType = product.productType === 'amount';
  const needsUserId = true; // Most gaming topups need an ID

  const handlePurchase = () => {
    if (needsUserId && !userId.trim()) {
      toast.error("يرجى إدخال معرف اللاعب / الحساب");
      return;
    }

    createOrder.mutate(
      {
        data: {
          productId: product.id,
          quantity: quantity,
          userIdentifier: userId || undefined
        }
      },
      {
        onSuccess: (order) => {
          toast.success("تم إنشاء الطلب بنجاح");
          queryClient.invalidateQueries({ queryKey: ["/api/me"] });
          queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
          setLocation(`/orders/${order.id}`);
        },
        onError: (err: any) => {
          toast.error(err.response?.data?.message || "حدث خطأ أثناء الشراء");
        }
      }
    );
  };

  return (
    <div className="min-h-screen bg-background pb-24 animate-in slide-in-from-bottom-4 duration-500">
      {/* Header Image */}
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
          <div className="w-full h-full bg-gradient-to-br from-primary/30 to-purple-600/30 flex items-center justify-center">
            <ShoppingCart className="w-16 h-16 text-primary/50" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent"></div>
      </div>

      <div className="px-5 -mt-6 relative z-10">
        <h1 className="text-2xl font-bold text-foreground leading-tight mb-2">{product.name}</h1>
        
        <div className="flex items-center gap-3 mb-6">
          <div className="text-3xl font-black text-primary">${product.priceUsd.toFixed(2)}</div>
          <div className="text-sm text-muted-foreground mt-1">≈ {product.priceSyp.toLocaleString()} ل.س</div>
        </div>

        {product.description && (
          <p className="text-sm text-muted-foreground mb-6 bg-card border border-white/5 p-4 rounded-2xl leading-relaxed">
            {product.description}
          </p>
        )}

        <div className="space-y-6 bg-card border border-white/5 p-5 rounded-3xl shadow-lg">
          
          {/* Quantity Selector */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm font-bold text-foreground">الكمية</label>
              {isAmountType && (
                <span className="text-xs text-muted-foreground">
                  (الحد الأدنى: {product.minQty || 1})
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-4 bg-background border border-white/5 p-2 rounded-2xl">
              <button 
                onClick={() => handleQtyChange(1)}
                disabled={!!product.maxQty && quantity >= product.maxQty}
                className="w-10 h-10 rounded-xl bg-card border border-white/5 flex items-center justify-center text-foreground hover:bg-white/5 active:scale-95 disabled:opacity-50 transition-all"
              >
                <Plus className="w-5 h-5" />
              </button>
              
              <div className="flex-1 text-center font-bold text-lg">
                {quantity}
              </div>
              
              <button 
                onClick={() => handleQtyChange(-1)}
                disabled={quantity <= (product.minQty || 1)}
                className="w-10 h-10 rounded-xl bg-card border border-white/5 flex items-center justify-center text-foreground hover:bg-white/5 active:scale-95 disabled:opacity-50 transition-all"
              >
                <Minus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* User ID Input */}
          {needsUserId && (
            <div>
              <label className="text-sm font-bold text-foreground mb-3 block">
                معرف اللاعب (ID)
              </label>
              <Input 
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="أدخل المعرف هنا..." 
                className="h-12 bg-background border-white/5 rounded-2xl px-4 focus-visible:ring-primary/50 text-base"
              />
              <p className="text-xs text-accent mt-2 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                تأكد من صحة المعرف لتجنب شحن حساب خاطئ
              </p>
            </div>
          )}

          <div className="h-px w-full bg-white/5 my-2"></div>

          {/* Total */}
          <div className="flex justify-between items-end">
            <div className="text-sm text-muted-foreground font-medium">الإجمالي</div>
            <div className="text-right">
              <div className="text-2xl font-black text-foreground">
                ${(product.priceUsd * quantity).toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground">
                {(product.priceSyp * quantity).toLocaleString()} ل.س
              </div>
            </div>
          </div>

          {/* CTA */}
          <Button 
            onClick={handlePurchase}
            disabled={createOrder.isPending || !product.available}
            className="w-full h-14 rounded-2xl text-base font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25"
          >
            {createOrder.isPending ? "جاري التنفيذ..." : "تأكيد الشراء"}
          </Button>
        </div>
      </div>
    </div>
  );
}
