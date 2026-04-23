import { useEffect, useState } from "react";
import { get, put } from "../lib/api";
import { Save, Palette } from "lucide-react";

const FIELDS = [
  { key: "theme_primary", label: "اللون الرئيسي", type: "color", default: "#0052CC" },
  { key: "theme_accent", label: "اللون الثانوي", type: "color", default: "#F97316" },
  { key: "theme_bg", label: "خلفية المتجر", type: "color", default: "#F4F6FB" },
  { key: "theme_font", label: "الخط", type: "text", default: "Cairo" },
  { key: "theme_radius", label: "نصف القطر (px)", type: "number", default: "12" },
];

export default function Theme() {
  const [values, setValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    get("/settings/list").then((arr: any[]) => {
      const obj: Record<string, any> = {};
      FIELDS.forEach(f => obj[f.key] = f.default);
      arr.forEach((s) => { if (s.key in obj) obj[s.key] = s.value; });
      setValues(obj);
    });
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const items = FIELDS.map((f) => ({ key: f.key, value: values[f.key] }));
    await put("/settings/items", { items });
    setSaving(false); setDone(true);
    setTimeout(() => setDone(false), 2000);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
        <Palette/> تخصيص التصميم
      </h1>
      <form onSubmit={save} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4 max-w-2xl">
        {FIELDS.map((f) => (
          <div key={f.key} className="grid grid-cols-3 items-center gap-3">
            <label className="text-sm font-semibold text-slate-700">{f.label}</label>
            <input type={f.type} value={values[f.key] ?? f.default}
              onChange={(e)=>setValues({...values, [f.key]: e.target.value})}
              className="col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-sm h-10"
            />
          </div>
        ))}
        {done && <div className="p-3 bg-emerald-50 text-emerald-700 rounded-lg text-sm">تم الحفظ</div>}
        <button disabled={saving} className="bg-brand-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2">
          <Save size={16}/> حفظ التصميم
        </button>
        <p className="text-xs text-slate-500">سيتم تطبيق التصميم على المتجر بعد إعادة تحميل الصفحة.</p>
      </form>
    </div>
  );
}
