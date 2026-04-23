import { useEffect, useState } from "react";
import { get, patch, post } from "../lib/api";
import { Search, Wallet, Ban, CheckCircle2, X as XIcon } from "lucide-react";

export default function Users() {
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<any | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    const qs = params.toString();
    get(`/users${qs ? "?" + qs : ""}`).then(setItems).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const toggleBan = async (u: any) => {
    setBusy(u.id);
    try {
      await patch(`/users/${u.id}/ban`, { banned: !u.banned });
      load();
    } finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">المستخدمون</h1>

      <div className="flex gap-2">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input value={q} onChange={(e)=>setQ(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&load()}
            placeholder="بحث بالاسم أو رقم تيليجرام أو البريد..."
            className="w-full border border-slate-300 rounded-lg pr-10 pl-3 py-2 text-sm"/>
        </div>
        <button onClick={load} className="bg-brand-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-brand-700">بحث</button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-right px-4 py-3 font-semibold">#</th>
                <th className="text-right px-4 py-3 font-semibold">الاسم</th>
                <th className="text-right px-4 py-3 font-semibold">تيليجرام</th>
                <th className="text-right px-4 py-3 font-semibold">البريد</th>
                <th className="text-right px-4 py-3 font-semibold">الرصيد $</th>
                <th className="text-right px-4 py-3 font-semibold">الرصيد ل.س</th>
                <th className="text-right px-4 py-3 font-semibold">VIP</th>
                <th className="text-right px-4 py-3 font-semibold">الحالة</th>
                <th className="text-right px-4 py-3 font-semibold w-32">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-8 text-slate-400">لا يوجد مستخدمون</td></tr>
              ) : items.map((u) => (
                <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500">{u.id}</td>
                  <td className="px-4 py-3 font-semibold">{u.username}</td>
                  <td className="px-4 py-3 font-mono text-xs">{u.telegramId}</td>
                  <td className="px-4 py-3 text-xs">{u.email || "—"}</td>
                  <td className="px-4 py-3 font-bold">${Number(u.balanceUsd).toFixed(2)}</td>
                  <td className="px-4 py-3">{Number(u.balanceSyp).toFixed(0)}</td>
                  <td className="px-4 py-3">
                    {u.vipLevel > 0 ? (
                      <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded">VIP {u.vipLevel}</span>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {u.banned ? (
                      <span className="bg-rose-100 text-rose-700 text-xs font-semibold px-2 py-0.5 rounded">محظور</span>
                    ) : (
                      <span className="bg-emerald-100 text-emerald-700 text-xs font-semibold px-2 py-0.5 rounded">نشط</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={()=>setEdit(u)} className="p-1.5 text-brand-600 hover:bg-brand-50 rounded" title="تعديل الرصيد">
                        <Wallet size={15}/>
                      </button>
                      <button disabled={busy===u.id} onClick={()=>toggleBan(u)}
                        className={`p-1.5 rounded disabled:opacity-50 ${u.banned ? "text-emerald-600 hover:bg-emerald-50" : "text-rose-600 hover:bg-rose-50"}`}
                        title={u.banned ? "إلغاء الحظر" : "حظر"}>
                        {u.banned ? <CheckCircle2 size={15}/> : <Ban size={15}/>}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {edit && <BalanceModal user={edit} onClose={()=>setEdit(null)} onDone={()=>{ setEdit(null); load(); }}/>}
    </div>
  );
}

function BalanceModal({ user, onClose, onDone }: { user: any; onClose: ()=>void; onDone: ()=>void }) {
  const [currency, setCurrency] = useState("USD");
  const [type, setType] = useState("add");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const num = Number(amount);
      const delta = type === "add" ? num : -num;
      await post(`/users/${user.id}/balance`, { currency, delta, note });
      onDone();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-lg font-bold">تعديل رصيد {user.username}</h2>
          <button onClick={onClose} className="text-slate-400"><XIcon size={20}/></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">العملة</label>
              <select value={currency} onChange={(e)=>setCurrency(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                <option value="USD">دولار</option>
                <option value="SYP">ليرة سورية</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">العملية</label>
              <select value={type} onChange={(e)=>setType(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                <option value="add">إضافة</option>
                <option value="sub">خصم</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">المبلغ</label>
            <input type="number" step="0.01" value={amount} onChange={(e)=>setAmount(e.target.value)} required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"/>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">ملاحظة (اختياري)</label>
            <input value={note} onChange={(e)=>setNote(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"/>
          </div>
          {err && <div className="p-3 bg-rose-50 text-rose-700 rounded-lg text-sm">{err}</div>}
          <button disabled={busy} className="w-full bg-brand-600 text-white py-2.5 rounded-lg font-semibold hover:bg-brand-700 disabled:opacity-50">
            {busy ? "جاري التنفيذ..." : "تنفيذ"}
          </button>
        </form>
      </div>
    </div>
  );
}
