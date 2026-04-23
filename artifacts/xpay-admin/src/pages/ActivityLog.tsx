import { useEffect, useState } from "react";
import { get } from "../lib/api";
import { Activity } from "lucide-react";

export default function ActivityLog() {
  const [items, setItems] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    get("/activity").then(setItems).catch((e) => setErr(e.message));
  }, []);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">سجل النشاط</h1>
      {err && <div className="p-3 bg-rose-50 text-rose-700 rounded-lg text-sm">{err}</div>}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-right px-4 py-3 font-semibold">#</th>
                <th className="text-right px-4 py-3 font-semibold">الفاعل</th>
                <th className="text-right px-4 py-3 font-semibold">الإجراء</th>
                <th className="text-right px-4 py-3 font-semibold">الهدف</th>
                <th className="text-right px-4 py-3 font-semibold">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-slate-400">لا توجد سجلات</td></tr>
              ) : items.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500">{row.id}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center">
                        <Activity size={14}/>
                      </div>
                      <span>{row.actorName || row.actorId || "نظام"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold">{row.action}</td>
                  <td className="px-4 py-3 text-slate-600">{row.target || "—"}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {new Date(row.createdAt).toLocaleString("ar")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
