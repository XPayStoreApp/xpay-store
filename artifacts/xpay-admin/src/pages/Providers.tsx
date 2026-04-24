import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { get, del, post, put } from "../lib/api";
import { Plus, Edit2, Trash2, X, Save } from "lucide-react";
import { api } from "../lib/api";

interface Provider {
  id: number;
  name: string;
  apiUrl: string | null;
  apiKey: string | null;
  notes: string | null;
  priority: number;
  active: boolean;
  providerType: string;
}

export default function Providers() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<number | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const navigate = useNavigate();

  const fetchProviders = async () => {
    setLoading(true);
    try {
      const data = await get<Provider[]>("/providers");
      setProviders(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const handleSync = async (id: number) => {
    setSyncing(id);
    setSyncMessage(null);
    try {
      const res = await api<any>(`/providers/${id}/sync`, { method: "POST" });
      setSyncMessage(`✅ ${res.message || "تمت المزامنة بنجاح"}`);
    } catch (err: any) {
      setSyncMessage(`❌ ${err.message}`);
    } finally {
      setSyncing(null);
      setTimeout(() => setSyncMessage(null), 5000);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("هل أنت متأكد من الحذف؟")) return;
    try {
      await del(`/providers/${id}`);
      await fetchProviders();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSave = async (data: any) => {
    if (data.id) {
      await put(`/providers/${data.id}`, data);
    } else {
      await post("/providers", data);
    }
    setEditing(null);
    await fetchProviders();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">المزودون</h1>
        <button
          onClick={() => setEditing({ name: "", apiUrl: "", apiKey: "", notes: "", priority: 0, active: true, providerType: "custom" })}
          className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-brand-700"
        >
          <Plus size={18} /> إضافة جديد
        </button>
      </div>

      {syncMessage && (
        <div className="p-3 bg-gray-100 rounded-lg text-sm">{syncMessage}</div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-right px-4 py-3 font-semibold">#</th>
              <th className="text-right px-4 py-3 font-semibold">الاسم</th>
              <th className="text-right px-4 py-3 font-semibold">النوع</th>
              <th className="text-right px-4 py-3 font-semibold">مفعل</th>
              <th className="text-center px-4 py-3 font-semibold">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-8 text-slate-400">جاري التحميل...</td></tr>
            ) : providers.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-slate-400">لا يوجد مزودون</td></tr>
            ) : (
              providers.map((p) => (
                <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500">{p.id}</td>
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-xs">
                    <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{p.providerType}</span>
                  </td>
                  <td className="px-4 py-3">
                    {p.active ? (
                      <span className="text-emerald-600 text-xs font-semibold bg-emerald-50 px-2 py-0.5 rounded">نعم</span>
                    ) : (
                      <span className="text-slate-500 text-xs font-semibold bg-slate-100 px-2 py-0.5 rounded">لا</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-center">
                      <button
                        onClick={() => navigate(`/providers/${p.id}/products`)}
                        className="px-3 py-1 bg-emerald-500 text-white rounded hover:bg-emerald-600 text-xs"
                      >
                        منتجات
                      </button>
                      <button
                        onClick={() => handleSync(p.id)}
                        disabled={syncing === p.id}
                        className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 text-xs"
                      >
                        {syncing === p.id ? "⏳" : "مزامنة"}
                      </button>
                      <button
                        onClick={() => setEditing(p)}
                        className="p-1.5 text-brand-600 hover:bg-brand-50 rounded"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">{editing.id ? "تعديل مزود" : "إضافة مزود"}</h2>
              <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSave(editing);
              }}
              className="p-5 space-y-4"
            >
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">الاسم *</label>
                <input
                  type="text"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  value={editing.name || ""}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">رابط API</label>
                <input
                  type="text"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  value={editing.apiUrl || ""}
                  onChange={(e) => setEditing({ ...editing, apiUrl: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">مفتاح API</label>
                <input
                  type="text"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  value={editing.apiKey || ""}
                  onChange={(e) => setEditing({ ...editing, apiKey: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">نوع المزود</label>
                <input
                  type="text"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  value={editing.providerType || "custom"}
                  onChange={(e) => setEditing({ ...editing, providerType: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">ملاحظات</label>
                <textarea
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  rows={3}
                  value={editing.notes || ""}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">الأولوية</label>
                <input
                  type="number"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  value={editing.priority ?? 0}
                  onChange={(e) => setEditing({ ...editing, priority: Number(e.target.value) })}
                />
              </div>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!editing.active}
                  onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                  className="w-5 h-5 accent-brand-600"
                />
                <span className="text-sm text-slate-600">مفعل</span>
              </label>
              <div className="flex items-center gap-2 pt-2">
                <button type="submit" className="flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-brand-700">
                  <Save size={16} /> حفظ
                </button>
                <button type="button" onClick={() => setEditing(null)} className="px-5 py-2.5 rounded-lg font-semibold text-slate-600 hover:bg-slate-100">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}