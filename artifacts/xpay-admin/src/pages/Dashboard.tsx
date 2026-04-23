import { useEffect, useState } from "react";
import { get } from "../lib/api";
import {
  ShoppingCart, Wallet, Users, DollarSign, Clock, CheckCircle2, TrendingUp, Package,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    get("/dashboard").then(setData).catch((e) => setErr(e.message));
  }, []);

  if (err) return <div className="p-3 bg-rose-50 text-rose-700 rounded-lg">{err}</div>;
  if (!data)
    return <div className="text-slate-400">جاري تحميل اللوحة...</div>;

  const s = data.stats || {};
  const cards = [
    { label: "إجمالي المستخدمين", value: s.users ?? 0, icon: Users, color: "bg-brand-600" },
    { label: "إجمالي الطلبات", value: s.totalOrders ?? 0, icon: ShoppingCart, color: "bg-emerald-600" },
    { label: "الطلبات المعلقة", value: s.pendingOrders ?? 0, icon: Clock, color: "bg-amber-500" },
    { label: "طلبات اليوم", value: s.todayOrders ?? 0, icon: CheckCircle2, color: "bg-sky-600" },
    { label: "المنتجات النشطة", value: s.activeProducts ?? 0, icon: Package, color: "bg-violet-600" },
    { label: "إيداعات بانتظار", value: s.pendingDeposits ?? 0, icon: Wallet, color: "bg-rose-500" },
    { label: "صافي الربح ($)", value: Number(s.netProfitUsd ?? 0).toFixed(2), icon: DollarSign, color: "bg-accent-500" },
    { label: "إجمالي المبيعات ($)", value: Number(s.totalSalesUsd ?? 0).toFixed(2), icon: TrendingUp, color: "bg-indigo-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">لوحة التحكم</h1>
        <p className="text-sm text-slate-500 mt-1">نظرة عامة على أداء المتجر</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center gap-3"
          >
            <div className={`w-12 h-12 rounded-xl ${c.color} text-white flex items-center justify-center`}>
              <c.icon size={22} />
            </div>
            <div>
              <div className="text-xs text-slate-500">{c.label}</div>
              <div className="text-xl font-bold text-slate-900 mt-0.5">{c.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h2 className="font-bold text-slate-900 mb-4">المبيعات خلال آخر 7 أيام</h2>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data.chart || []}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0052cc" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#0052cc" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} reversed />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip />
              <Area type="monotone" dataKey="sales" stroke="#0052cc" strokeWidth={2} fill="url(#g1)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h2 className="font-bold text-slate-900 mb-4">أحدث الطلبات</h2>
          <div className="space-y-2">
            {(data.recentOrders || []).slice(0, 6).map((o: any) => (
              <div key={o.id} className="flex items-center justify-between text-sm border-b border-slate-100 pb-2 last:border-0">
                <div>
                  <div className="font-semibold text-slate-800">#{o.orderNumber || o.id}</div>
                  <div className="text-xs text-slate-500 truncate max-w-[140px]">{o.customParam || ""}</div>
                </div>
                <div className="text-left">
                  <div className="font-bold text-brand-600">${Number(o.totalUsd ?? 0).toFixed(2)}</div>
                  <StatusPill s={o.status} />
                </div>
              </div>
            ))}
            {(!data.recentOrders || data.recentOrders.length === 0) && (
              <div className="text-sm text-slate-400 text-center py-4">لا توجد طلبات</div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <h2 className="font-bold text-slate-900 mb-4">آخر الإيداعات</h2>
        <div className="space-y-2">
          {(data.recentDeposits || []).slice(0, 8).map((d: any) => (
            <div key={d.id} className="flex items-center justify-between text-sm border-b border-slate-100 pb-2 last:border-0">
              <div>
                <div className="font-semibold text-slate-800">{d.method || d.paymentMethodCode}</div>
                <div className="text-xs text-slate-500">{d.transactionRef || d.note}</div>
              </div>
              <div className="text-left">
                <div className="font-bold text-emerald-600">${Number(d.amountUsd ?? 0).toFixed(2)}</div>
                <StatusPill s={d.status} />
              </div>
            </div>
          ))}
          {(!data.recentDeposits || data.recentDeposits.length === 0) && (
            <div className="text-sm text-slate-400 text-center py-4">لا توجد إيداعات</div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ s }: { s: string }) {
  const map: Record<string, string> = {
    wait: "bg-amber-100 text-amber-700",
    pending: "bg-amber-100 text-amber-700",
    accept: "bg-emerald-100 text-emerald-700",
    approved: "bg-emerald-100 text-emerald-700",
    reject: "bg-rose-100 text-rose-700",
    rejected: "bg-rose-100 text-rose-700",
  };
  const labels: Record<string, string> = {
    wait: "بانتظار",
    pending: "بانتظار",
    accept: "مقبول",
    approved: "مقبول",
    reject: "مرفوض",
    rejected: "مرفوض",
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${map[s] || "bg-slate-100 text-slate-600"}`}>
      {labels[s] || s}
    </span>
  );
}
