import { useEffect, useState } from "react";
import { get, put } from "../lib/api";
import { Languages as LangIcon, Save } from "lucide-react";

export default function Languages() {
  const [primary, setPrimary] = useState("ar");
  const [enabled, setEnabled] = useState<string[]>(["ar"]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    get("/settings/list").then((arr: any[]) => {
      const map = Object.fromEntries(arr.map((s) => [s.key, s.value]));
      setPrimary(String(map.primary_language ?? "ar"));
      setEnabled(Array.isArray(map.enabled_languages) ? map.enabled_languages : ["ar"]);
    });
  }, []);

  const ALL = [
    { code: "ar", label: "العربية" },
    { code: "en", label: "English" },
    { code: "tr", label: "Türkçe" },
    { code: "fr", label: "Français" },
  ];

  const toggle = (code: string) => {
    setEnabled((s) => s.includes(code) ? s.filter((c) => c !== code) : [...s, code]);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    await put("/settings/items", { items: [
      { key: "primary_language", value: primary },
      { key: "enabled_languages", value: enabled },
    ]});
    setDone(true); setTimeout(()=>setDone(false), 2000);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><LangIcon/> اللغات</h1>
      <form onSubmit={save} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4 max-w-2xl">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">اللغة الأساسية</label>
          <select value={primary} onChange={(e)=>setPrimary(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
            {ALL.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">اللغات المفعلة</label>
          <div className="space-y-1">
            {ALL.map((l) => (
              <label key={l.code} className="flex items-center gap-2">
                <input type="checkbox" checked={enabled.includes(l.code)} onChange={()=>toggle(l.code)} className="w-4 h-4 accent-brand-600"/>
                <span>{l.label} ({l.code})</span>
              </label>
            ))}
          </div>
        </div>
        {done && <div className="p-3 bg-emerald-50 text-emerald-700 rounded-lg text-sm">تم الحفظ</div>}
        <button className="bg-brand-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-brand-700 flex items-center gap-2">
          <Save size={16}/> حفظ
        </button>
      </form>
    </div>
  );
}
