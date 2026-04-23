import { useState } from "react";
import { get, post } from "../lib/api";
import { Database, Download, Upload } from "lucide-react";

export default function Backup() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [importJson, setImportJson] = useState("");

  const exportBackup = async () => {
    setBusy(true); setErr(null); setMsg(null);
    try {
      const data = await get("/backup");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `xpay-backup-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg("تم تصدير النسخة الاحتياطية بنجاح");
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const importBackup = async () => {
    if (!importJson.trim()) return;
    if (!confirm("سيتم استيراد البيانات. هل أنت متأكد؟")) return;
    setBusy(true); setErr(null); setMsg(null);
    try {
      const data = JSON.parse(importJson);
      await post("/import", data);
      setMsg("تم استيراد البيانات بنجاح");
      setImportJson("");
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><Database/> النسخ الاحتياطي</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h2 className="font-bold text-slate-900 flex items-center gap-2"><Download size={18}/> تصدير</h2>
          <p className="text-sm text-slate-600 mt-2">تصدير جميع بيانات المتجر في ملف JSON واحد.</p>
          <button onClick={exportBackup} disabled={busy}
            className="mt-3 bg-brand-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-brand-700 disabled:opacity-50">
            تصدير الآن
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h2 className="font-bold text-slate-900 flex items-center gap-2"><Upload size={18}/> استيراد</h2>
          <p className="text-sm text-slate-600 mt-2">الصق محتوى ملف JSON لاستيراد البيانات.</p>
          <textarea value={importJson} onChange={(e)=>setImportJson(e.target.value)} rows={5}
            className="mt-3 w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono"/>
          <button onClick={importBackup} disabled={busy || !importJson}
            className="mt-3 bg-accent-500 text-white px-5 py-2 rounded-lg font-semibold hover:bg-accent-600 disabled:opacity-50">
            استيراد
          </button>
        </div>
      </div>

      {msg && <div className="p-3 bg-emerald-50 text-emerald-700 rounded-lg text-sm">{msg}</div>}
      {err && <div className="p-3 bg-rose-50 text-rose-700 rounded-lg text-sm">{err}</div>}
    </div>
  );
}
