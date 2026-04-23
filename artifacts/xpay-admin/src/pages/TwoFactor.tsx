import { useState } from "react";
import { post } from "../lib/api";
import { ShieldCheck } from "lucide-react";

export default function TwoFactor() {
  const [enabled, setEnabled] = useState(false);
  const [code, setCode] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const enable = async () => {
    setBusy(true);
    try {
      const r = await post("/2fa/enable");
      setSecret(r.secret);
      setMsg("امسح الرمز ثم أدخل الرمز للتفعيل");
    } finally { setBusy(false); }
  };

  const verify = async () => {
    setBusy(true);
    try {
      await post("/2fa/verify", { code });
      setEnabled(true);
      setMsg("تم تفعيل التحقق الثنائي بنجاح");
    } catch (e: any) { setMsg(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><ShieldCheck/> التحقق الثنائي</h1>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 max-w-2xl space-y-4">
        <p className="text-sm text-slate-600">
          أضف طبقة حماية إضافية إلى حسابك باستخدام تطبيق Google Authenticator أو Authy.
        </p>
        {!secret && !enabled && (
          <button onClick={enable} disabled={busy} className="bg-brand-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-brand-700 disabled:opacity-50">
            {busy ? "..." : "تفعيل التحقق الثنائي"}
          </button>
        )}
        {secret && !enabled && (
          <div className="space-y-3">
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="text-xs text-slate-500 mb-1">المفتاح السري</div>
              <div className="font-mono text-sm font-bold text-slate-900">{secret}</div>
            </div>
            <input value={code} onChange={(e)=>setCode(e.target.value)} placeholder="أدخل رمز التحقق المكون من 6 أرقام"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"/>
            <button onClick={verify} disabled={busy || code.length !== 6} className="bg-emerald-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-50">
              تحقق وفعّل
            </button>
          </div>
        )}
        {enabled && (
          <div className="p-4 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-semibold">
            ✓ التحقق الثنائي مفعّل
          </div>
        )}
        {msg && <div className="text-sm text-slate-600">{msg}</div>}
      </div>
    </div>
  );
}
