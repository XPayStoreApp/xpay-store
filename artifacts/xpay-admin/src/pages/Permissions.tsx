import { Lock } from "lucide-react";
const ROLES = [
  { name: "مدير عام", key: "super_admin", desc: "صلاحيات كاملة على جميع الأقسام" },
  { name: "مشرف", key: "admin", desc: "إدارة المتجر والطلبات والمستخدمين" },
  { name: "دعم فني", key: "support", desc: "عرض الطلبات والمستخدمين والرد فقط" },
];
const SECTIONS = [
  "الطلبات", "الإيداعات", "المستخدمون", "الأقسام", "المنتجات", "طرق الدفع",
  "البانرات", "الأخبار", "المزودون", "الكوبونات", "VIP", "الإشعارات",
  "الإعدادات", "النسخ الاحتياطي", "المشرفون", "سجل النشاط",
];
export default function Permissions() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><Lock/> الصلاحيات</h1>
      <p className="text-sm text-slate-500">تكوين صلاحيات الأدوار للأقسام المختلفة. (يتم التحكم بالوصول الفعلي من خلال الدور المسند للمشرف)</p>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-right px-4 py-3 font-semibold">القسم</th>
                {ROLES.map(r => <th key={r.key} className="text-center px-4 py-3 font-semibold">{r.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {SECTIONS.map((s) => (
                <tr key={s} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-semibold">{s}</td>
                  {ROLES.map((r) => (
                    <td key={r.key} className="px-4 py-3 text-center">
                      <input type="checkbox" defaultChecked={r.key !== "support" || ["الطلبات","المستخدمون","الإيداعات"].includes(s)}
                        className="w-4 h-4 accent-brand-600"/>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
