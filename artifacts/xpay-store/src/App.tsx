import { useEffect, useLayoutEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Categories from "@/pages/categories";
import ProductGroupProducts from "@/pages/product-group-products";
import ProductDetail from "@/pages/product-detail";
import Orders from "@/pages/orders";
import OrderDetail from "@/pages/order-detail";
import Deposit from "@/pages/deposit";
import DepositMethod from "@/pages/deposit-method";
import ShamCashInvoiceVerify from "@/pages/shamcash-invoice-verify";
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

type AppSettings = {
  maintenanceMode: boolean;
  maintenanceTitle: string;
  maintenanceMessage: string;
  popupEnabled: boolean;
  popupMessage: string;
  popupLinkText: string;
  popupLinkUrl: string;
};

const XPAY_BRAND_THEME: StoreTheme = {
  primary: "#58E8FF",
  accent: "#D94CFF",
  background: "#07091B",
  font: "Cairo",
  radius: "16",
};

function apiBaseUrl() {
  return (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
}

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

function clampMaxLightness(hsl: string, maxL: number): string {
  const match = String(hsl).match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
  if (!match) return hsl;

  const h = Number(match[1]);
  const s = Number(match[2]);
  const l = Math.min(maxL, Math.max(0, Number(match[3])));
  return `${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%`;
}

function applyTheme(theme: StoreTheme) {
  const root = document.documentElement;
  const primary = hexToHslString(theme.primary, "188 100% 67%");
  const accent = hexToHslString(theme.accent, "291 100% 65%");
  const backgroundRaw = hexToHslString(theme.background, "236 57% 7%");
  const background = clampMaxLightness(backgroundRaw, 18);
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

function normalizeRemoteTheme(theme: Partial<StoreTheme> | null | undefined): StoreTheme {
  const legacyColors = new Set(["#0052cc", "#f97316", "#0a1628"]);
  const remotePrimary = String(theme?.primary || "").trim();
  const remoteAccent = String(theme?.accent || "").trim();
  const remoteBackground = String(theme?.background || "").trim();

  const hasLegacyTheme =
    legacyColors.has(remotePrimary.toLowerCase()) ||
    legacyColors.has(remoteAccent.toLowerCase()) ||
    legacyColors.has(remoteBackground.toLowerCase());

  if (hasLegacyTheme) return XPAY_BRAND_THEME;

  return {
    ...XPAY_BRAND_THEME,
    ...theme,
    primary: remotePrimary || XPAY_BRAND_THEME.primary,
    accent: remoteAccent || XPAY_BRAND_THEME.accent,
    background: remoteBackground || XPAY_BRAND_THEME.background,
  };
}

function StoreMaintenance({ settings }: { settings: AppSettings }) {
  return (
    <div className="min-h-[100dvh] xpay-shell flex items-center justify-center p-6" dir="rtl">
      <div className="w-full max-w-md rounded-[2rem] border border-primary/25 bg-card/85 p-8 text-center shadow-2xl backdrop-blur-xl">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-3xl">🛠️</div>
        <h1 className="text-2xl font-extrabold text-foreground">{settings.maintenanceTitle}</h1>
        <p className="mt-4 text-sm leading-8 text-muted-foreground">{settings.maintenanceMessage}</p>
      </div>
    </div>
  );
}

function StorePopup({ settings }: { settings: AppSettings }) {
  const storageKey = `xpay-popup-seen:${settings.popupMessage}:${settings.popupLinkUrl}`;
  const hasSeenPopup = () => {
    try {
      return sessionStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  };
  const [open, setOpen] = useState(() => settings.popupEnabled && !hasSeenPopup());

  useEffect(() => {
    setOpen(settings.popupEnabled && !hasSeenPopup());
  }, [settings.popupEnabled, storageKey]);

  if (!open || !settings.popupMessage.trim()) return null;

  const close = () => {
    try {
      sessionStorage.setItem(storageKey, "1");
    } catch {
      // Some Telegram WebViews can block storage; closing should still work.
    }
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm" dir="rtl">
      <div className="w-full max-w-md rounded-2xl border border-amber-400/70 bg-[#12072b]/95 p-6 text-center shadow-2xl shadow-black/40">
        <div className="border-r-4 border-white pr-4 text-lg font-bold leading-9 text-white whitespace-pre-line">
          {settings.popupMessage}
        </div>
        {settings.popupLinkUrl && settings.popupLinkText && (
          <a
            href={settings.popupLinkUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-block text-base font-extrabold text-amber-300 underline underline-offset-4"
          >
            {settings.popupLinkText}
          </a>
        )}
        <button
          onClick={close}
          className="mt-6 w-full rounded-full bg-amber-500 px-5 py-3 font-extrabold text-white shadow-lg shadow-amber-950/30"
        >
          موافق
        </button>
        <button
          onClick={close}
          className="mx-auto mt-5 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500 text-4xl leading-none text-white shadow-lg shadow-amber-950/30"
          aria-label="إغلاق"
        >
          ×
        </button>
      </div>
    </div>
  );
}

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/categories/:id" component={Categories} />
        <Route path="/groups/:id" component={ProductGroupProducts} />
        <Route path="/products/:id" component={ProductDetail} />
        <Route path="/orders" component={Orders} />
        <Route path="/orders/:id" component={OrderDetail} />
        <Route path="/deposit" component={Deposit} />
        <Route path="/deposit/:method/invoice" component={ShamCashInvoiceVerify} />
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
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useLayoutEffect(() => {
    applyTheme(XPAY_BRAND_THEME);

    const baseUrl = apiBaseUrl();
    fetch(`${baseUrl}/api/theme`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`theme_http_${res.status}`);
        return res.json() as Promise<StoreTheme>;
      })
      .then((theme) => applyTheme(normalizeRemoteTheme(theme)))
      .catch((error) => {
        console.error("Theme load failed:", error);
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiBaseUrl()}/api/app-settings`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setSettings(data);
      })
      .catch((error) => {
        console.error("App settings load failed:", error);
        if (!cancelled) setSettings(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (settings?.maintenanceMode) {
    return <StoreMaintenance settings={settings} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        {settings && <StorePopup settings={settings} />}
        <Toaster theme="dark" position="top-center" dir="rtl" />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
