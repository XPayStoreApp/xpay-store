import { useEffect, useState } from "react";
import { get, put } from "../lib/api";
import { PowerOff, Save } from "lucide-react";

export default function Maintenance() {
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    get("/settings/list").then((arr: any[]) => {
      const map = Object.fromEntries(arr.map((s) => [s.key, s.value]));
      setEnabled(map.maintenance_mode === true || map.maintenance_mode === "true");
      setMessage(String(map.maintenance_message ?? "المتجر تحت الصيانة، يرجى المعاودة لاحقاً"));
    });
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    await put("/settings/items", { items: [
      { key: "maintenance_mode", value: enabled },
      { key: "maintenance_message", value: message },
    ]});
    setDone(true); setTimeout(()=>setDone(false), 2000);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><PowerOff/> وضع الصيانة</h1>
      <form onSubmit={save} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4 max-w-2xl">
        <label className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
          <span>
            <div className="font-semibold text-slate-900">تفعيل وضع الصيانة</div>
            <div className="text-xs text-slate-500 mt-0.5">سيتم عرض رسالة الصيانة لجميع المستخدمين</div>
          </span>
          <input type="checkbox" checked={enabled} onChange={(e)=>setEnabled(e.target.checked)} className="w-5 h-5 accent-rose-600"/>
        </label>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">رسالة الصيانة</label>
          <textarea value={message} onChange={(e)=>setMessage(e.target.value)} rows={3} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"/>
        </div>
        {done && <div className="p-3 bg-emerald-50 text-emerald-700 rounded-lg text-sm">تم الحفظ</div>}
        <button className="bg-brand-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-brand-700 flex items-center gap-2">
          <Save size={16}/> حفظ
        </button>
      </form>
    </div>
  );
}
