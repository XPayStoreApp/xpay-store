import { useEffect, useState } from "react";
import { get, patch } from "../lib/api";
import { Check, X as XIcon } from "lucide-react";

function formatAmount(deposit: any) {
  if (deposit.currency === "USD") return `$${Number(deposit.amountUsd || 0).toFixed(2)}`;
  return `${Number(deposit.amountSyp || 0).toFixed(0)} ل.س`;
}

function methodLabel(deposit: any) {
  if (deposit.methodLabel) return deposit.methodLabel;
  if (deposit.method === "sham_cash_auto") return "شام كاش تلقائي";
  if (deposit.method === "sham_cash" || deposit.method === "shamcash") return "شام كاش يدوي";
  if (deposit.method === "manual") return "إيداع يدوي";
  return deposit.method || "غير محدد";
}

export default function Deposits() {
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState("all");
  const [busy, setBusy] = useState<number | null>(null);

  const load = () => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    const qs = params.toString();
    get(`/deposits${qs ? "?" + qs : ""}`).then(setItems).catch(() => {});
  };

  useEffect(() => {
    load();
  }, [status]);

  const update = async (id: number, newStatus: string) => {
    setBusy(id);
    try {
      await patch(`/deposits/${id}/status`, { status: newStatus });
      load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">الإيداعات</h1>

      <div className="flex flex-wrap gap-2">
        {[
          { k: "all", l: "الكل" },
          { k: "pending", l: "بانتظار" },
          { k: "approved", l: "مقبول" },
          { k: "rejected", l: "مرفوض" },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => setStatus(t.k)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              status === t.k
                ? "bg-brand-600 text-white"
                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {t.l}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-right px-4 py-3 font-semibold">#</th>
                <th className="text-right px-4 py-3 font-semibold">المستخدم</th>
                <th className="text-right px-4 py-3 font-semibold">الطريقة</th>
                <th className="text-right px-4 py-3 font-semibold">المبلغ</th>
                <th className="text-right px-4 py-3 font-semibold">رقم العملية</th>
                <th className="text-right px-4 py-3 font-semibold">الحالة</th>
                <th className="text-right px-4 py-3 font-semibold">التاريخ</th>
                <th className="text-right px-4 py-3 font-semibold w-32">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400">
                    لا توجد إيداعات
                  </td>
                </tr>
              ) : (
                items.map((d) => {
                  const isAutoSham = d.method === "sham_cash_auto";
                  return (
                    <tr key={d.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-500">{d.id}</td>
                      <td className="px-4 py-3">{d.userName || `#${d.userId}`}</td>
                      <td className="px-4 py-3">{methodLabel(d)}</td>
                      <td className="px-4 py-3 font-bold">{formatAmount(d)}</td>
                      <td className="px-4 py-3 font-mono text-xs">{d.transactionId || "-"}</td>
                      <td className="px-4 py-3">
                        <StatusPill s={d.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {new Date(d.createdAt).toLocaleString("ar-SY")}
                      </td>
                      <td className="px-4 py-3">
                        {d.status === "pending" && !isAutoSham ? (
                          <div className="flex items-center gap-1">
                            <button
                              disabled={busy === d.id}
                              onClick={() => update(d.id, "approved")}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded disabled:opacity-50"
                              title="قبول"
                            >
                              <Check size={15} />
                            </button>
                            <button
                              disabled={busy === d.id}
                              onClick={() => update(d.id, "rejected")}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded disabled:opacity-50"
                              title="رفض"
                            >
                              <XIcon size={15} />
                            </button>
                          </div>
                        ) : null}
                        {d.status === "pending" && isAutoSham ? (
                          <span className="text-[11px] text-slate-500">تلقائي عبر API</span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ s }: { s: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    approved: "bg-emerald-100 text-emerald-700",
    rejected: "bg-rose-100 text-rose-700",
  };
  const labels: Record<string, string> = {
    pending: "بانتظار",
    approved: "مقبول",
    rejected: "مرفوض",
  };

  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${map[s] || "bg-slate-100 text-slate-700"}`}>
      {labels[s] || s || "غير محدد"}
    </span>
  );
}
