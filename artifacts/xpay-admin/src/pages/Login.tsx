import { useState } from "react";
import { post } from "../lib/api";
import { Lock, User } from "lucide-react";

export default function Login({ onSuccess }: { onSuccess: (u: any) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      const u = await post("/login", { username, password });
      onSuccess(u);
    } catch (e: any) {
      setErr(e.message || "فشل تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background:
          "linear-gradient(135deg, #0052cc 0%, #08326d 50%, #f97316 130%)",
      }}
      dir="rtl"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-7">
          <div className="inline-block w-16 h-16 rounded-2xl bg-brand-600 text-white text-2xl font-bold flex items-center justify-center shadow-lg">
            XP
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-4">XPayStore</h1>
          <p className="text-sm text-slate-500 mt-1">لوحة الإدارة</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              اسم المستخدم
            </label>
            <div className="relative">
              <User
                size={18}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full border border-slate-300 rounded-lg pr-10 pl-3 py-2.5 text-sm"
                placeholder="أدخل اسم المستخدم"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              كلمة المرور
            </label>
            <div className="relative">
              <Lock
                size={18}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full border border-slate-300 rounded-lg pr-10 pl-3 py-2.5 text-sm"
                placeholder="••••••••"
              />
            </div>
          </div>

          {err && (
            <div className="p-3 bg-rose-50 text-rose-700 rounded-lg text-sm">
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 text-white font-bold py-2.5 rounded-lg hover:bg-brand-700 disabled:opacity-50 transition"
          >
            {loading ? "جاري الدخول..." : "تسجيل الدخول"}
          </button>
        </form>
      </div>
    </div>
  );
}
