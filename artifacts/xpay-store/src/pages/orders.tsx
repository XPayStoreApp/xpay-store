import { useGetOrdersSummary, useListMyOrders, getListMyOrdersQueryKey, getGetOrdersSummaryQueryKey } from "@workspace/api-client-react";
import { Search, Package, Clock, CheckCircle2, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

export default function Orders() {
  const [filter, setFilter] = useState<"all" | "wait" | "accept" | "reject">("all");
  const [search, setSearch] = useState("");

  const { data: summary, isLoading: summaryLoading } = useGetOrdersSummary({
    query: { queryKey: getGetOrdersSummaryQueryKey() }
  });

  const { data: orders, isLoading: ordersLoading } = useListMyOrders(
    { status: filter === "all" ? undefined : filter },
    { query: { queryKey: getListMyOrdersQueryKey({ status: filter === "all" ? undefined : filter }) } }
  );

  const filteredOrders = orders?.filter(o => 
    search ? (o.orderNumber.includes(search) || o.productName.includes(search)) : true
  );

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case 'accept': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'reject': return <XCircle className="w-4 h-4 text-destructive" />;
      case 'wait': default: return <Clock className="w-4 h-4 text-amber-500" />;
    }
  };

  const StatusBadge = ({ status }: { status: string }) => {
    switch (status) {
      case 'accept': return <span className="bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded text-[10px] font-bold">مكتمل</span>;
      case 'reject': return <span className="bg-destructive/10 text-destructive px-2 py-0.5 rounded text-[10px] font-bold">مرفوض</span>;
      case 'wait': default: return <span className="bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded text-[10px] font-bold">قيد الانتظار</span>;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24 p-4 animate-in fade-in duration-300">
      <h1 className="text-xl font-bold text-foreground mb-4">طلباتي</h1>

      {/* Summary Card */}
      <div className="bg-card border border-white/5 rounded-3xl p-5 mb-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
        
        <div className="text-sm text-muted-foreground mb-1">إجمالي المشتريات</div>
        <div className="text-3xl font-black text-white mb-5 flex items-baseline gap-1">
          <span className="text-primary">$</span>
          {summaryLoading ? <Skeleton className="h-8 w-24" /> : (summary?.totalAcceptedUsd || 0).toFixed(2)}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-background/50 rounded-2xl p-3 text-center border border-white/5">
            <div className="text-xs text-muted-foreground mb-1">الكل</div>
            <div className="font-bold text-foreground">{summaryLoading ? <Skeleton className="h-5 w-8 mx-auto" /> : summary?.totalCount || 0}</div>
          </div>
          <div className="bg-emerald-500/10 rounded-2xl p-3 text-center border border-emerald-500/20">
            <div className="text-xs text-emerald-500/80 mb-1">مكتملة</div>
            <div className="font-bold text-emerald-500">{summaryLoading ? <Skeleton className="h-5 w-8 mx-auto" /> : summary?.acceptCount || 0}</div>
          </div>
          <div className="bg-amber-500/10 rounded-2xl p-3 text-center border border-amber-500/20">
            <div className="text-xs text-amber-500/80 mb-1">بالانتظار</div>
            <div className="font-bold text-amber-500">{summaryLoading ? <Skeleton className="h-5 w-8 mx-auto" /> : summary?.waitCount || 0}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
        {(["all", "wait", "accept", "reject"] as const).map(f => {
          const labels = { all: "الكل", wait: "قيد الانتظار", accept: "مكتمل", reject: "مرفوض" };
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                filter === f 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-card border border-white/5 text-muted-foreground hover:bg-white/5"
              }`}
            >
              {labels[f]}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث برقم الطلب أو المنتج..." 
          className="pl-3 pr-9 h-12 bg-card border-white/5 rounded-2xl text-sm focus-visible:ring-primary/50"
        />
      </div>

      {/* List */}
      <div className="space-y-3">
        {ordersLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card border border-white/5 p-4 rounded-2xl flex gap-3">
              <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))
        ) : filteredOrders && filteredOrders.length > 0 ? (
          filteredOrders.map((order) => (
            <Link key={order.id} href={`/orders/${order.id}`}>
              <div className="bg-card hover:bg-card/80 border border-white/5 p-4 rounded-2xl flex items-center gap-4 cursor-pointer transition-colors group">
                <div className="w-12 h-12 rounded-xl bg-background border border-white/5 overflow-hidden shrink-0 flex items-center justify-center">
                  {order.productImage ? (
                    <img src={order.productImage} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="text-sm font-bold text-foreground truncate pl-2">{order.productName}</h3>
                    <div className="text-sm font-black text-foreground shrink-0">${order.totalUsd.toFixed(2)}</div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">#{order.orderNumber}</span>
                      <span>•</span>
                      <span>{format(new Date(order.createdAt), "MMM d, HH:mm")}</span>
                    </div>
                    <StatusBadge status={order.status} />
                  </div>
                </div>
              </div>
            </Link>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-white/10 rounded-3xl bg-card/30">
            <div className="w-16 h-16 bg-card rounded-full flex items-center justify-center mb-4 border border-white/5 text-muted-foreground">
              <Package className="w-8 h-8" />
            </div>
            <p className="text-foreground font-bold mb-1">لا توجد طلبات</p>
            <p className="text-xs text-muted-foreground max-w-[200px]">
              لم تقم بأي طلبات بعد. ابدأ بالتسوق الآن من الصفحة الرئيسية.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
