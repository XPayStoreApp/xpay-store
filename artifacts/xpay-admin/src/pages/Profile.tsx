import { useState } from "react";
import { put } from "../lib/api";
import { Save, User as UserIcon } from "lucide-react";

export default function Profile({ me }: { me: any }) {
  const [fullName, setFullName] = useState(me?.fullName || "");
  const [email, setEmail] = useState(me?.email || "");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null); setMsg(null);
    try {
      await put("/profile", { fullName, email, oldPassword: oldPassword || undefined, newPassword: newPassword || undefined });
      setMsg("تم تحديث الملف الشخصي");
      setOldPassword(""); setNewPassword("");
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><UserIcon/> الملف الشخصي</h1>
      <form onSubmit={save} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4 max-w-2xl">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">اسم المستخدم</label>
          <input value={me?.username} disabled className="w-full border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm"/>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">الاسم الكامل</label>
          <input value={fullName} onChange={(e)=>setFullName(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"/>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">البريد الإلكتروني</label>
          <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"/>
        </div>
        <div className="border-t border-slate-100 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">كلمة المرور الحالية</label>
            <input type="password" value={oldPassword} onChange={(e)=>setOldPassword(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"/>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">كلمة المرور الجديدة</label>
            <input type="password" value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"/>
          </div>
        </div>
        {msg && <div className="p-3 bg-emerald-50 text-emerald-700 rounded-lg text-sm">{msg}</div>}
        {err && <div className="p-3 bg-rose-50 text-rose-700 rounded-lg text-sm">{err}</div>}
        <button disabled={busy} className="bg-brand-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2">
          <Save size={16}/> حفظ التغييرات
        </button>
      </form>
    </div>
  );
}
