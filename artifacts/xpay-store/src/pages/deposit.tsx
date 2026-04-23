import { useListPaymentMethods, getListPaymentMethodsQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet, Smartphone, Landmark, ShieldCheck, ChevronLeft } from "lucide-react";
import { motion } from "framer-motion";

export default function Deposit() {
  const { data: methods, isLoading } = useListPaymentMethods({
    query: { queryKey: getListPaymentMethodsQueryKey() }
  });

  const getMethodIcon = (code: string) => {
    switch (code) {
      case 'binance_pay':
      case 'usdt_auto':
        return <ShieldCheck className="w-8 h-8 text-[#FCD535]" />;
      case 'syriatel_cash':
        return <Smartphone className="w-8 h-8 text-[#E31837]" />;
      case 'mtn_cash':
        return <Smartphone className="w-8 h-8 text-[#FFCC00]" />;
      case 'sham_cash':
      default:
        return <Landmark className="w-8 h-8 text-primary" />;
    }
  };

  const getMethodColor = (code: string) => {
    switch (code) {
      case 'binance_pay': return 'border-[#FCD535]/30 hover:border-[#FCD535] bg-[#FCD535]/5';
      case 'usdt_auto': return 'border-[#26A17B]/30 hover:border-[#26A17B] bg-[#26A17B]/5';
      case 'syriatel_cash': return 'border-[#E31837]/30 hover:border-[#E31837] bg-[#E31837]/5';
      case 'mtn_cash': return 'border-[#FFCC00]/30 hover:border-[#FFCC00] bg-[#FFCC00]/5';
      case 'sham_cash': default: return 'border-primary/30 hover:border-primary bg-primary/5';
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24 p-4 animate-in fade-in duration-300">
      <div className="mb-6 mt-4 text-center">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-primary/20 shadow-[0_0_30px_rgba(0,255,255,0.15)]">
          <Wallet className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-black text-foreground mb-2">اختر وسيلة الشحن</h1>
        <p className="text-sm text-muted-foreground">وسائل دفع آمنة ومباشرة لإضافة الرصيد إلى حسابك</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-3xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {methods?.filter(m => m.active).map((method, i) => (
            <Link key={method.id} href={`/deposit/${method.code}`}>
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`p-5 rounded-3xl border border-white/5 bg-card hover:bg-white/5 transition-all cursor-pointer h-full flex flex-col items-center justify-center text-center group ${getMethodColor(method.code)}`}
              >
                <div className="mb-3 transform group-hover:scale-110 transition-transform duration-300">
                  {getMethodIcon(method.code)}
                </div>
                <h3 className="font-bold text-foreground text-sm mb-1">{method.name}</h3>
                <p className="text-[10px] text-muted-foreground">{method.subtitle}</p>
              </motion.div>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-8 bg-card border border-white/5 rounded-2xl p-4 flex items-center gap-4">
        <ShieldCheck className="w-10 h-10 text-emerald-500 shrink-0" />
        <div>
          <h4 className="text-sm font-bold text-foreground mb-1">دفع آمن 100%</h4>
          <p className="text-xs text-muted-foreground">جميع عمليات الدفع مشفرة ومؤمنة بالكامل. يتم إضافة الرصيد تلقائياً أو بعد مراجعة سريعة.</p>
        </div>
      </div>
    </div>
  );
}
