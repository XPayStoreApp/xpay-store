import { useEffect, useState } from "react";
import { get } from "../lib/api";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

export default function Reports() {
  const [data, setData] = useState<any>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = () => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const q = params.toString();
    get(`/reports${q ? "?" + q : ""}`).then(setData).catch(()=>{});
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">التقارير</h1>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">من تاريخ</label>
          <input type="date" value={from} onChange={(e)=>setFrom(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm"/>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">إلى تاريخ</label>
          <input type="date" value={to} onChange={(e)=>setTo(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm"/>
        </div>
        <button onClick={load} className="bg-brand-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-brand-700">عرض</button>
      </div>

      {!data ? (
        <div className="text-slate-400">جاري تحميل التقارير...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="إجمالي المبيعات" value={`$${Number(data.totalSalesUsd || 0).toFixed(2)}`} />
            <Stat label="عدد الطلبات" value={data.orderCount || 0} />
            <Stat label="إجمالي الأرباح" value={`$${Number(data.totalProfitUsd || 0).toFixed(2)}`} />
            <Stat label="إجمالي الإيداعات" value={`$${Number(data.totalDepositsUsd || 0).toFixed(2)}`} />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h2 className="font-bold text-slate-900 mb-4">المبيعات اليومية</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.daily || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"/>
                <XAxis dataKey="date" reversed stroke="#94a3b8" fontSize={12}/>
                <YAxis stroke="#94a3b8" fontSize={12}/>
                <Tooltip/>
                <Legend/>
                <Bar dataKey="salesUsd" name="مبيعات $" fill="#0052cc" />
                <Bar dataKey="profitUsd" name="ربح $" fill="#f97316" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-xl font-bold text-slate-900 mt-1">{value}</div>
    </div>
  );
}
