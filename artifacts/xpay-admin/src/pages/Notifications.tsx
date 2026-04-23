import { useEffect, useState } from "react";
import { get, post, del } from "../lib/api";
import { Bell, Send, Trash2 } from "lucide-react";

export default function Notifications() {
  const [items, setItems] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [targetType, setTargetType] = useState("all");
  const [targetUserId, setTargetUserId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = () => get("/notifications").then(setItems).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await post("/notifications", {
        title, content, targetType,
        targetUserId: targetType === "user" ? Number(targetUserId) : null,
      });
      setTitle(""); setContent(""); setTargetUserId("");
      load();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const remove = async (id: number) => {
    if (!confirm("حذف الإشعار؟")) return;
    await del(`/notifications/${id}`);
    load();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">الإشعارات</h1>

      <form onSubmit={send} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-3">
        <h2 className="font-bold text-slate-900 flex items-center gap-2"><Send size={18}/> إرسال إشعار</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">المستهدف</label>
            <select value={targetType} onChange={(e)=>setTargetType(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
              <option value="all">جميع المستخدمين</option>
              <option value="user">مستخدم محدد</option>
              <option value="vip">عملاء VIP</option>
            </select>
          </div>
          {targetType === "user" && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">ID المستخدم</label>
              <input value={targetUserId} onChange={(e)=>setTargetUserId(e.target.value)} required
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">العنوان</label>
          <input value={title} onChange={(e)=>setTitle(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">المحتوى</label>
          <textarea value={content} onChange={(e)=>setContent(e.target.value)} rows={3} required
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        {err && <div className="p-3 bg-rose-50 text-rose-700 rounded-lg text-sm">{err}</div>}
        <button disabled={busy} className="bg-brand-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-brand-700 disabled:opacity-50">
          {busy ? "جاري الإرسال..." : "إرسال"}
        </button>
      </form>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-5 border-b border-slate-100 font-bold text-slate-900 flex items-center gap-2">
          <Bell size={18}/> آخر الإشعارات
        </div>
        <div className="divide-y divide-slate-100">
          {items.length === 0 && <div className="p-6 text-center text-slate-400 text-sm">لا توجد إشعارات</div>}
          {items.map((n) => (
            <div key={n.id} className="p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center">
                <Bell size={16}/>
              </div>
              <div className="flex-1">
                {n.title && <div className="font-semibold text-slate-900">{n.title}</div>}
                <div className="text-sm text-slate-600">{n.content}</div>
                <div className="text-xs text-slate-400 mt-1">
                  {n.targetType === "all" ? "جميع المستخدمين" : n.targetType === "vip" ? "VIP" : `مستخدم #${n.targetUserId}`}
                  {" · "}{new Date(n.createdAt).toLocaleString("ar")}
                </div>
              </div>
              <button onClick={()=>remove(n.id)} className="text-rose-500 p-1.5 hover:bg-rose-50 rounded">
                <Trash2 size={15}/>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
