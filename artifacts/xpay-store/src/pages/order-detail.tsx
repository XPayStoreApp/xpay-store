import { useGetOrder, getGetOrderQueryKey } from "@workspace/api-client-react";
import { useRoute, Link } from "wouter";
import { ChevronRight, Package, Clock, CheckCircle2, XCircle, HeadphonesIcon, Copy } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { toast } from "sonner";

export default function OrderDetail() {
  const [, params] = useRoute("/orders/:id");
  const id = params?.id;

  const { data: order, isLoading } = useGetOrder(id || "", {
    query: { enabled: !!id, queryKey: getGetOrderQueryKey(id || "") }
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`طھظ… ظ†ط³ط® ${label}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 pt-8">
        <Skeleton className="h-8 w-32 mb-8" />
        <Skeleton className="h-32 w-full rounded-3xl mb-4" />
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    );
  }

  if (!order) {
    return <div className="p-4 text-center mt-20 text-muted-foreground">ط§ظ„ط·ظ„ط¨ ط؛ظٹط± ظ…ظˆط¬ظˆط¯</div>;
  }

  const isAccept = order.status === 'accept';
  const isReject = order.status === 'reject';
  const isWait = order.status === 'wait';

  return (
    <div className="min-h-screen bg-background animate-in slide-in-from-right-4 duration-300">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl px-4 py-3 flex items-center gap-3">
        <Link href="/orders">
          <div className="bg-card p-2 rounded-full cursor-pointer hover:bg-white/5 transition-colors">
            <ChevronRight className="w-5 h-5 text-foreground" />
          </div>
        </Link>
        <h1 className="font-bold text-lg">طھظپط§طµظٹظ„ ط§ظ„ط·ظ„ط¨</h1>
      </div>

      <div className="p-4 pb-24 space-y-6">
        {/* Status Card */}
        <div className={`p-6 rounded-3xl border relative overflow-hidden ${
          isAccept ? 'bg-emerald-500/10 border-emerald-500/20' : 
          isReject ? 'bg-destructive/10 border-destructive/20' : 
          'bg-amber-500/10 border-amber-500/20'
        }`}>
          <div className="flex flex-col items-center text-center relative z-10">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-3 ${
              isAccept ? 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 
              isReject ? 'bg-destructive text-white shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 
              'bg-amber-500 text-white shadow-[0_0_20px_rgba(245,158,11,0.3)]'
            }`}>
              {isAccept ? <CheckCircle2 className="w-8 h-8" /> : 
               isReject ? <XCircle className="w-8 h-8" /> : 
               <Clock className="w-8 h-8" />}
            </div>
            <h2 className="text-xl font-black text-foreground mb-1">
              {isAccept ? 'ط§ظƒطھظ…ظ„ ط§ظ„ط·ظ„ط¨ ط¨ظ†ط¬ط§ط­' : 
               isReject ? 'طھظ… ط±ظپط¶ ط§ظ„ط·ظ„ط¨' : 
               'ط§ظ„ط·ظ„ط¨ ظ‚ظٹط¯ ط§ظ„ظ…ط±ط§ط¬ط¹ط©'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isAccept ? 'طھظ… ط´ط­ظ† ط­ط³ط§ط¨ظƒ ط¨ظ†ط¬ط§ط­. ط´ظƒط±ط§ظ‹ ظ„ط«ظ‚طھظƒ ط¨ظ†ط§.' : 
               isReject ? 'ط¹ط°ط±ط§ظ‹طŒ ظ„ظ… ظ†طھظ…ظƒظ† ظ…ظ† طھظ†ظپظٹط° ط·ظ„ط¨ظƒ. ظٹط±ط¬ظ‰ ظ…ط±ط§ط¬ط¹ط© ط§ظ„ط¯ط¹ظ….' : 
               'ط¬ط§ط±ظٹ طھظ†ظپظٹط° ط·ظ„ط¨ظƒطŒ ط³ظٹطھظ… ط§ظ„طھط­ط¯ظٹط« ظ‚ط±ظٹط¨ط§ظ‹.'}
            </p>
          </div>
        </div>

        {/* Order Details */}
        <div className="bg-card border border-white/5 rounded-3xl p-5 shadow-lg space-y-5">
          <div className="flex items-center gap-4 pb-5 border-b border-white/5">
            <div className="w-16 h-16 rounded-2xl bg-background border border-white/5 overflow-hidden shrink-0 flex items-center justify-center">
              {order.productImage ? (
                <img src={order.productImage} alt="" className="w-full h-full object-cover" />
              ) : (
                <Package className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-foreground mb-1">{order.productName}</h3>
              <div className="text-sm text-muted-foreground">ط§ظ„ظƒظ…ظٹط©: <span className="font-bold text-foreground">{order.quantity}</span></div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">ط±ظ‚ظ… ط§ظ„ط·ظ„ط¨</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono font-bold text-foreground">{order.orderNumber}</span>
                <button onClick={() => copyToClipboard(order.orderNumber, "ط±ظ‚ظ… ط§ظ„ط·ظ„ط¨")} className="text-muted-foreground hover:text-primary transition-colors">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">طھط§ط±ظٹط® ط§ظ„ط·ظ„ط¨</span>
              <span className="text-sm font-medium text-foreground" dir="ltr">
                {format(new Date(order.createdAt), "yyyy-MM-dd HH:mm:ss")}
              </span>
            </div>

            {order.userIdentifier && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">ظ…ط¹ط±ظپ ط§ظ„ظ„ط§ط¹ط¨</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono font-bold text-foreground">{order.userIdentifier}</span>
                  <button onClick={() => copyToClipboard(order.userIdentifier!, "ط§ظ„ظ…ط¹ط±ظپ")} className="text-muted-foreground hover:text-primary transition-colors">
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            <div className="h-px bg-white/5 w-full"></div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">ط§ظ„ظ…ط¨ظ„ط؛ ط§ظ„ط¥ط¬ظ…ط§ظ„ظٹ</span>
              <div className="text-left">
                <div className="text-lg font-black text-primary">${order.totalUsd.toFixed(2)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Support CTA */}
        <div className="bg-card border border-white/5 rounded-3xl p-5 shadow-lg flex items-center justify-between">
          <div>
            <div className="font-bold text-foreground mb-1 text-sm">ظˆط§ط¬ظ‡طھ ظ…ط´ظƒظ„ط©طں</div>
            <div className="text-xs text-muted-foreground">ظپط±ظٹظ‚ ط§ظ„ط¯ط¹ظ… ظ…طھظˆط§ط¬ط¯ ظ„ط®ط¯ظ…طھظƒ</div>
          </div>
          <Link href="/support">
            <Button variant="outline" className="rounded-xl border-white/10 hover:bg-white/5 text-xs h-9">
              <HeadphonesIcon className="w-4 h-4 ml-2" />
              طھظˆط§طµظ„ ظ…ط¹ظ†ط§
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

