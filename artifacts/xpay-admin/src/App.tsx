import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { get } from "./lib/api";
import Login from "./pages/Login";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
import Deposits from "./pages/Deposits";
import Users from "./pages/Users";
import Categories from "./pages/Categories";
import Products from "./pages/Products";
import PaymentMethods from "./pages/PaymentMethods";
import Banners from "./pages/Banners";
import News from "./pages/News";
import SocialLinks from "./pages/SocialLinks";
import Providers from "./pages/Providers";
import Coupons from "./pages/Coupons";
import VipMemberships from "./pages/VipMemberships";
import AutoCodes from "./pages/AutoCodes";
import OrderMessages from "./pages/OrderMessages";
import ApiKeys from "./pages/ApiKeys";
import Notifications from "./pages/Notifications";
import Admins from "./pages/Admins";
import ActivityLog from "./pages/ActivityLog";
import Settings from "./pages/Settings";
import Theme from "./pages/Theme";
import Reports from "./pages/Reports";
import Backup from "./pages/Backup";
import Profile from "./pages/Profile";
import TwoFactor from "./pages/TwoFactor";
import Permissions from "./pages/Permissions";
import Currencies from "./pages/Currencies";
import Languages from "./pages/Languages";
import Maintenance from "./pages/Maintenance";

export default function App() {
  const [auth, setAuth] = useState<"loading" | "in" | "out">("loading");
  const [me, setMe] = useState<any>(null);

  useEffect(() => {
    get("/me")
      .then((u) => {
        setMe(u);
        setAuth("in");
      })
      .catch(() => setAuth("out"));
  }, []);

  if (auth === "loading") {
    return (
      <div className="flex items-center justify-center h-screen text-slate-500">
        جاري التحميل...
      </div>
    );
  }

  if (auth === "out") {
    return <Login onSuccess={(u) => { setMe(u); setAuth("in"); }} />;
  }

  return (
    <Layout me={me} onLogout={() => { setMe(null); setAuth("out"); }}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/deposits" element={<Deposits />} />
        <Route path="/users" element={<Users />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/products" element={<Products />} />
        <Route path="/payment-methods" element={<PaymentMethods />} />
        <Route path="/banners" element={<Banners />} />
        <Route path="/news" element={<News />} />
        <Route path="/social-links" element={<SocialLinks />} />
        <Route path="/providers" element={<Providers />} />
        <Route path="/coupons" element={<Coupons />} />
        <Route path="/vip" element={<VipMemberships />} />
        <Route path="/auto-codes" element={<AutoCodes />} />
        <Route path="/order-messages" element={<OrderMessages />} />
        <Route path="/api-keys" element={<ApiKeys />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/admins" element={<Admins />} />
        <Route path="/activity" element={<ActivityLog />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/theme" element={<Theme />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/backup" element={<Backup />} />
        <Route path="/profile" element={<Profile me={me} />} />
        <Route path="/2fa" element={<TwoFactor />} />
        <Route path="/permissions" element={<Permissions />} />
        <Route path="/currencies" element={<Currencies />} />
        <Route path="/languages" element={<Languages />} />
        <Route path="/maintenance" element={<Maintenance />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
