import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Categories from "@/pages/categories";
import ProductDetail from "@/pages/product-detail";
import Orders from "@/pages/orders";
import OrderDetail from "@/pages/order-detail";
import Deposit from "@/pages/deposit";
import DepositMethod from "@/pages/deposit-method";
import DepositsList from "@/pages/deposits";
import Profile from "@/pages/profile";
import Support from "@/pages/support";
import AppLayout from "@/components/layout/AppLayout";

const queryClient = new QueryClient();

type StoreTheme = {
  primary: string;
  accent: string;
  background: string;
  font: string;
  radius: string;
};

function hexToHslString(hex: string, fallback: string): string {
  const normalized = String(hex || "").trim().replace(/^#/, "");
  const fullHex =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(fullHex)) return fallback;

  const r = parseInt(fullHex.slice(0, 2), 16) / 255;
  const g = parseInt(fullHex.slice(2, 4), 16) / 255;
  const b = parseInt(fullHex.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;

  let hue = 0;
  let saturation = 0;

  if (delta !== 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));

    switch (max) {
      case r:
        hue = ((g - b) / delta) % 6;
        break;
      case g:
        hue = (b - r) / delta + 2;
        break;
      default:
        hue = (r - g) / delta + 4;
        break;
    }
  }

  const h = Math.round(hue * 60 < 0 ? hue * 60 + 360 : hue * 60);
  const s = Math.round(saturation * 100);
  const l = Math.round(lightness * 100);
  return `${h} ${s}% ${l}%`;
}

function clampLightness(hsl: string, delta: number): string {
  const match = String(hsl).match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
  if (!match) return hsl;

  const h = Number(match[1]);
  const s = Number(match[2]);
  const l = Math.max(0, Math.min(100, Number(match[3]) + delta));
  return `${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%`;
}

function applyTheme(theme: StoreTheme) {
  const root = document.documentElement;
  const primary = hexToHslString(theme.primary, "185 100% 50%");
  const accent = hexToHslString(theme.accent, "24 95% 53%");
  const background = hexToHslString(theme.background, "215 60% 10%");
  const radiusValue = Number(theme.radius);
  const radius = Number.isFinite(radiusValue) && radiusValue > 0 ? `${radiusValue}px` : "16px";
  const font = String(theme.font || "Cairo").trim() || "Cairo";

  root.style.setProperty("--primary", primary);
  root.style.setProperty("--sidebar-primary", primary);
  root.style.setProperty("--ring", primary);
  root.style.setProperty("--accent", accent);
  root.style.setProperty("--background", background);
  root.style.setProperty("--sidebar", background);
  root.style.setProperty("--card", clampLightness(background, 2));
  root.style.setProperty("--popover", clampLightness(background, 2));
  root.style.setProperty("--border", clampLightness(background, 10));
  root.style.setProperty("--input", clampLightness(background, 10));
  root.style.setProperty("--muted", clampLightness(background, 8));
  root.style.setProperty("--secondary", clampLightness(background, 6));
  root.style.setProperty("--app-bg-glow", clampLightness(primary, -8));
  root.style.setProperty("--app-bg-deep", clampLightness(background, 8));
  root.style.setProperty("--radius", radius);
  root.style.setProperty("--app-font-sans", `'${font}', sans-serif`);
}

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/categories/:id" component={Categories} />
        <Route path="/products/:id" component={ProductDetail} />
        <Route path="/orders" component={Orders} />
        <Route path="/orders/:id" component={OrderDetail} />
        <Route path="/deposit" component={Deposit} />
        <Route path="/deposit/:method" component={DepositMethod} />
        <Route path="/deposits" component={DepositsList} />
        <Route path="/profile" component={Profile} />
        <Route path="/support" component={Support} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  useEffect(() => {
    const baseUrl = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
    const themeUrl = `${baseUrl}/api/theme`;

    fetch(themeUrl)
      .then(async (res) => {
        if (!res.ok) throw new Error(`theme_http_${res.status}`);
        return res.json() as Promise<StoreTheme>;
      })
      .then((theme) => applyTheme(theme))
      .catch((error) => {
        console.error("Theme load failed:", error);
      });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster theme="dark" position="top-center" dir="rtl" />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
