import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { post } from "../lib/api";
import {
  LayoutDashboard, ShoppingCart, Wallet, Users, FolderTree, Package,
  CreditCard, Image as ImageIcon, Megaphone, Share2, Server, Ticket,
  Crown, KeyRound, MessageSquare, Code2, Bell, ShieldCheck, Activity,
  Settings as SettingsIcon, Palette, BarChart3, Database, User as UserIcon,
  Lock, Globe, Languages as LangIcon, PowerOff, LogOut, Menu, X,
} from "lucide-react";

const NAV: { to: string; label: string; icon: any; group: string }[] = [
  { to: "/", label: "لوحة التحكم", icon: LayoutDashboard, group: "عام" },
  { to: "/orders", label: "الطلبات", icon: ShoppingCart, group: "العمليات" },
  { to: "/deposits", label: "الإيداعات", icon: Wallet, group: "العمليات" },
  { to: "/users", label: "المستخدمون", icon: Users, group: "العمليات" },
  { to: "/categories", label: "الأقسام", icon: FolderTree, group: "المتجر" },
  { to: "/products", label: "المنتجات", icon: Package, group: "المتجر" },
  { to: "/payment-methods", label: "طرق الدفع", icon: CreditCard, group: "المتجر" },
  { to: "/banners", label: "البانرات", icon: ImageIcon, group: "المتجر" },
  { to: "/news", label: "الأخبار", icon: Megaphone, group: "المتجر" },
  { to: "/social-links", label: "الروابط الاجتماعية", icon: Share2, group: "المتجر" },
  { to: "/providers", label: "المزودون", icon: Server, group: "التكامل" },
  { to: "/coupons", label: "كوبونات الخصم", icon: Ticket, group: "التسويق" },
  { to: "/vip", label: "عضويات VIP", icon: Crown, group: "التسويق" },
  { to: "/auto-codes", label: "الأكواد التلقائية", icon: KeyRound, group: "التكامل" },
  { to: "/order-messages", label: "رسائل الطلبات", icon: MessageSquare, group: "التكامل" },
  { to: "/api-keys", label: "مفاتيح API", icon: Code2, group: "التكامل" },
  { to: "/notifications", label: "الإشعارات", icon: Bell, group: "التسويق" },
  { to: "/admins", label: "المشرفون", icon: ShieldCheck, group: "النظام" },
  { to: "/permissions", label: "الصلاحيات", icon: Lock, group: "النظام" },
  { to: "/activity", label: "سجل النشاط", icon: Activity, group: "النظام" },
  { to: "/reports", label: "التقارير", icon: BarChart3, group: "النظام" },
  { to: "/settings", label: "الإعدادات العامة", icon: SettingsIcon, group: "الإعدادات" },
  { to: "/theme", label: "تخصيص التصميم", icon: Palette, group: "الإعدادات" },
  { to: "/currencies", label: "العملات", icon: Globe, group: "الإعدادات" },
  { to: "/languages", label: "اللغات", icon: LangIcon, group: "الإعدادات" },
  { to: "/maintenance", label: "وضع الصيانة", icon: PowerOff, group: "الإعدادات" },
  { to: "/backup", label: "النسخ الاحتياطي", icon: Database, group: "النظام" },
  { to: "/profile", label: "الملف الشخصي", icon: UserIcon, group: "حسابي" },
  { to: "/2fa", label: "التحقق الثنائي", icon: ShieldCheck, group: "حسابي" },
];

export default function Layout({
  children, me, onLogout,
}: {
  children: React.ReactNode;
  me: any;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try { await post("/logout"); } catch {}
    onLogout();
    navigate("/");
  };

  const groups = NAV.reduce<Record<string, typeof NAV>>((acc, item) => {
    (acc[item.group] = acc[item.group] || []).push(item);
    return acc;
  }, {});

  return (
    <div className="flex min-h-screen bg-slate-100" dir="rtl">
      {/* Sidebar */}
      <aside
        className={`fixed lg:static z-40 inset-y-0 right-0 w-72 bg-white border-l border-slate-200 transform transition-transform overflow-y-auto ${
          open ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <div className="text-lg font-bold text-brand-600">XPayStore</div>
            <div className="text-xs text-slate-500 mt-0.5">لوحة الإدارة</div>
          </div>
          <button className="lg:hidden text-slate-400" onClick={() => setOpen(false)}>
            <X size={20} />
          </button>
        </div>
        <nav className="p-3 space-y-4">
          {Object.entries(groups).map(([group, items]) => (
            <div key={group}>
              <div className="text-xs font-semibold text-slate-400 px-3 mb-1.5">{group}</div>
              <div className="space-y-0.5">
                {items.map((it) => (
                  <NavLink
                    key={it.to}
                    to={it.to}
                    end={it.to === "/"}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                        isActive
                          ? "bg-brand-600 text-white"
                          : "text-slate-700 hover:bg-slate-100"
                      }`
                    }
                  >
                    <it.icon size={18} />
                    <span>{it.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-4 lg:px-6 py-3 flex items-center justify-between">
          <button className="lg:hidden text-slate-700" onClick={() => setOpen(true)}>
            <Menu size={22} />
          </button>
          <div className="hidden lg:block text-sm text-slate-500">
            مرحباً بك في لوحة إدارة XPayStore
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-left hidden sm:block">
              <div className="font-semibold text-slate-900">{me?.fullName || me?.username}</div>
              <div className="text-xs text-slate-500">{me?.role}</div>
            </div>
            <div className="w-9 h-9 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold">
              {(me?.fullName || me?.username || "?").charAt(0).toUpperCase()}
            </div>
            <button
              onClick={handleLogout}
              className="text-slate-500 hover:text-rose-600 p-2 rounded-lg hover:bg-rose-50"
              title="تسجيل الخروج"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-x-auto">{children}</main>
      </div>
    </div>
  );
}
