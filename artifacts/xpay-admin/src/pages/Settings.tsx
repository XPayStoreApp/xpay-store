import { useEffect, useState } from "react";
import { get, put } from "../lib/api";
import { Save } from "lucide-react";

const FIELDS: { key: string; label: string; type?: string }[] = [
  { key: "site_name", label: "اسم المتجر" },
  { key: "site_logo", label: "رابط الشعار" },
  { key: "site_description", label: "وصف المتجر" },
  { key: "support_email", label: "بريد الدعم" },
  { key: "support_phone", label: "هاتف الدعم" },
  { key: "telegram_channel", label: "قناة التيليجرام" },
  { key: "exchange_rate", label: "سعر صرف الدولار (ل.س)", type: "number" },
  { key: "min_deposit_usd", label: "أقل مبلغ إيداع ($)", type: "number" },
  { key: "min_deposit_syp", label: "أقل مبلغ إيداع (ل.س)", type: "number" },
  { key: "registration_open", label: "السماح بالتسجيل (true/false)" },
  { key: "footer_text", label: "نص التذييل" },
];

export default function Settings() {
  const [values, setValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    get("/settings/list").then((arr: any[]) => {
      const obj: Record<string, any> = {};
      arr.forEach((s) => { obj[s.key] = typeof s.value === "object" ? JSON.stringify(s.value) : s.value; });
      setValues(obj);
    }).catch((e) => setErr(e.message));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setDone(false); setErr(null);
    try {
      const items = FIELDS.map((f) => ({ key: f.key, value: values[f.key] ?? "" }));
      await put("/settings/items", { items });
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">الإعدادات العامة</h1>
      <form onSubmit={save} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4 max-w-3xl">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="block text-sm font-semibold text-slate-700 mb-1">{f.label}</label>
            <input
              type={f.type || "text"}
              value={values[f.key] ?? ""}
              onChange={(e)=>setValues({...values, [f.key]: e.target.value})}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
            <div className="text-xs text-slate-400 mt-0.5">{f.key}</div>
          </div>
        ))}
        {err && <div className="p-3 bg-rose-50 text-rose-700 rounded-lg text-sm">{err}</div>}
        {done && <div className="p-3 bg-emerald-50 text-emerald-700 rounded-lg text-sm">تم الحفظ بنجاح</div>}
        <button disabled={saving} className="bg-brand-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2">
          <Save size={16}/> {saving ? "جاري الحفظ..." : "حفظ الإعدادات"}
        </button>
      </form>
    </div>
  );
}
