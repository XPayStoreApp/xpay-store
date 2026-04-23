import { useEffect, useState } from "react";
import { get, put } from "../lib/api";
import { Globe, Save } from "lucide-react";

export default function Currencies() {
  const [rate, setRate] = useState("");
  const [primary, setPrimary] = useState("USD");
  const [showBoth, setShowBoth] = useState(true);
  const [done, setDone] = useState(false);

  useEffect(() => {
    get("/settings/list").then((arr: any[]) => {
      const map = Object.fromEntries(arr.map((s) => [s.key, s.value]));
      setRate(String(map.exchange_rate ?? "13500"));
      setPrimary(String(map.primary_currency ?? "USD"));
      setShowBoth(map.show_both_currencies !== false);
    });
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    await put("/settings/items", { items: [
      { key: "exchange_rate", value: rate },
      { key: "primary_currency", value: primary },
      { key: "show_both_currencies", value: showBoth },
    ]});
    setDone(true); setTimeout(()=>setDone(false), 2000);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><Globe/> العملات</h1>
      <form onSubmit={save} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4 max-w-2xl">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">سعر الصرف ($1 = ل.س)</label>
          <input value={rate} onChange={(e)=>setRate(e.target.value)} type="number" step="0.01" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"/>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">العملة الأساسية</label>
          <select value={primary} onChange={(e)=>setPrimary(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
            <option value="USD">دولار أمريكي ($)</option>
            <option value="SYP">ليرة سورية (ل.س)</option>
          </select>
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={showBoth} onChange={(e)=>setShowBoth(e.target.checked)} className="w-4 h-4 accent-brand-600"/>
          <span className="text-sm">عرض السعر بالعملتين معاً</span>
        </label>
        {done && <div className="p-3 bg-emerald-50 text-emerald-700 rounded-lg text-sm">تم الحفظ</div>}
        <button className="bg-brand-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-brand-700 flex items-center gap-2">
          <Save size={16}/> حفظ
        </button>
      </form>
    </div>
  );
}
