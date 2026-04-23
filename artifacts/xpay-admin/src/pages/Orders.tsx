import { useEffect, useState } from "react";
import { get, patch } from "../lib/api";
import { Check, X as XIcon, Eye } from "lucide-react";

export default function Orders() {
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const [view, setView] = useState<any | null>(null);

  const load = () => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (q) params.set("q", q);
    const qs = params.toString();
    get(`/orders${qs ? "?" + qs : ""}`).then(setItems).catch(() => {});
  };
  useEffect(() => { load(); }, [status]);

  const update = async (id: number, newStatus: string) => {
    setBusy(id);
    try {
      await patch(`/orders/${id}/status`, { status: newStatus });
      load();
    } finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">الطلبات</h1>

      <div className="flex flex-wrap gap-2">
        {[
          { k: "all", l: "الكل" },
          { k: "wait", l: "بانتظار" },
          { k: "accept", l: "مقبول" },
          { k: "reject", l: "مرفوض" },
        ].map((t) => (
          <button key={t.k} onClick={() => setStatus(t.k)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              status === t.k ? "bg-brand-600 text-white" : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
            }`}>
            {t.l}
          </button>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()}
          placeholder="بحث برقم الطلب أو المستخدم..."
          className="ms-auto border border-slate-300 rounded-lg px-3 py-2 text-sm w-72"/>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-right px-4 py-3 font-semibold">رقم الطلب</th>
                <th className="text-right px-4 py-3 font-semibold">المنتج</th>
                <th className="text-right px-4 py-3 font-semibold">المستخدم</th>
                <th className="text-right px-4 py-3 font-semibold">الكمية</th>
                <th className="text-right px-4 py-3 font-semibold">المعرف</th>
                <th className="text-right px-4 py-3 font-semibold">الإجمالي</th>
                <th className="text-right px-4 py-3 font-semibold">الحالة</th>
                <th className="text-right px-4 py-3 font-semibold">التاريخ</th>
                <th className="text-right px-4 py-3 font-semibold w-40">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-8 text-slate-400">لا توجد طلبات</td></tr>
              ) : items.map((o) => (
                <tr key={o.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-bold text-brand-600">#{o.orderNumber}</td>
                  <td className="px-4 py-3">{o.productName}</td>
                  <td className="px-4 py-3">{o.userName || `#${o.userId}`}</td>
                  <td className="px-4 py-3">{o.quantity}</td>
                  <td className="px-4 py-3 font-mono text-xs">{o.userIdentifier || "—"}</td>
                  <td className="px-4 py-3 font-bold">${Number(o.totalUsd).toFixed(2)}</td>
                  <td className="px-4 py-3"><StatusPill s={o.status} /></td>
                  <td className="px-4 py-3 text-xs text-slate-500">{new Date(o.createdAt).toLocaleString("ar")}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={()=>setView(o)} className="p-1.5 text-slate-600 hover:bg-slate-100 rounded" title="عرض">
                        <Eye size={15}/>
                      </button>
                      {o.status === "wait" && (
                        <>
                          <button disabled={busy === o.id} onClick={() => update(o.id, "accept")}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded disabled:opacity-50" title="قبول">
                            <Check size={15}/>
                          </button>
                          <button disabled={busy === o.id} onClick={() => update(o.id, "reject")}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded disabled:opacity-50" title="رفض">
                            <XIcon size={15}/>
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {view && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={()=>setView(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5" onClick={(e)=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold">تفاصيل الطلب #{view.orderNumber}</h2>
              <button onClick={()=>setView(null)} className="text-slate-400"><XIcon size={20}/></button>
            </div>
            <dl className="space-y-2 text-sm">
              <Row k="المنتج" v={view.productName}/>
              <Row k="المستخدم" v={view.userName || `#${view.userId}`}/>
              <Row k="الكمية" v={view.quantity}/>
              <Row k="المعرف" v={view.userIdentifier || "—"}/>
              <Row k="الإجمالي" v={`$${Number(view.totalUsd).toFixed(2)} / ${Number(view.totalSyp).toFixed(0)} ل.س`}/>
              <Row k="التكلفة" v={`$${Number(view.costUsd || 0).toFixed(2)}`}/>
              <Row k="الربح" v={`$${(Number(view.totalUsd) - Number(view.costUsd || 0)).toFixed(2)}`}/>
              <Row k="الحالة" v={<StatusPill s={view.status}/>}/>
              <Row k="التاريخ" v={new Date(view.createdAt).toLocaleString("ar")}/>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: any }) {
  return (
    <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
      <dt className="text-slate-500">{k}</dt>
      <dd className="font-semibold">{v}</dd>
    </div>
  );
}

function StatusPill({ s }: { s: string }) {
  const map: Record<string, string> = {
    wait: "bg-amber-100 text-amber-700",
    accept: "bg-emerald-100 text-emerald-700",
    reject: "bg-rose-100 text-rose-700",
  };
  const labels: Record<string, string> = { wait: "بانتظار", accept: "مقبول", reject: "مرفوض" };
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded ${map[s] || "bg-slate-100"}`}>{labels[s] || s}</span>;
}
