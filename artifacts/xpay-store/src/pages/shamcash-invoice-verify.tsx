import { useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { ChevronRight, CheckCircle2, ClipboardCheck, Clock3 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type TelegramIdentity = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  initDataRaw: string;
};

const TELEGRAM_IDENTITY_CACHE_KEY = "xpay_telegram_identity";

function parseIdentityFromInitDataRaw(rawInitData?: string): TelegramIdentity | null {
  try {
    const raw = String(rawInitData || "").trim();
    if (!raw) return null;
    const params = new URLSearchParams(raw);
    const userRaw = params.get("user");
    if (!userRaw) return null;
    const user = JSON.parse(userRaw);
    if (!user?.id) return null;

    return {
      id: String(user.id),
      username: String(user.username || `${user.first_name || ""} ${user.last_name || ""}`.trim() || "TelegramUser"),
      firstName: String(user.first_name || ""),
      lastName: String(user.last_name || ""),
      initDataRaw: raw,
    };
  } catch {
    return null;
  }
}

function getTelegramWebAppDataFromUrl(): string {
  try {
    const search = new URLSearchParams(window.location.search || "");
    const hashRaw = String(window.location.hash || "").replace(/^#/, "");
    const hash = new URLSearchParams(hashRaw);
    return String(search.get("tgWebAppData") || hash.get("tgWebAppData") || "").trim();
  } catch {
    return "";
  }
}

function parseIdentityFromWebAppData(webAppData?: string): TelegramIdentity | null {
  const raw = String(webAppData || "").trim();
  if (!raw) return null;

  const attempts = [raw];
  try {
    attempts.push(decodeURIComponent(raw));
  } catch {
    // keep raw value
  }

  for (const item of attempts) {
    const parsed = parseIdentityFromInitDataRaw(item);
    if (parsed?.id) return parsed;
  }

  return null;
}

function readTelegramIdentity(): TelegramIdentity | null {
  try {
    const tg = (window as any)?.Telegram?.WebApp;
    if (tg?.ready) tg.ready();
    if (tg?.expand) tg.expand();
    const user = tg?.initDataUnsafe?.user;
    const initData = String(tg?.initData || "").trim();

    if (user?.id != null) {
      const identity: TelegramIdentity = {
        id: String(user.id),
        username: String(user.username || `${user.first_name || ""} ${user.last_name || ""}`.trim() || "TelegramUser"),
        firstName: String(user.first_name || ""),
        lastName: String(user.last_name || ""),
        initDataRaw: initData,
      };
      localStorage.setItem(TELEGRAM_IDENTITY_CACHE_KEY, JSON.stringify(identity));
      return identity;
    }

    const identity = parseIdentityFromWebAppData(getTelegramWebAppDataFromUrl());
    if (identity?.id) {
      localStorage.setItem(TELEGRAM_IDENTITY_CACHE_KEY, JSON.stringify(identity));
      return identity;
    }

    const cachedRaw = localStorage.getItem(TELEGRAM_IDENTITY_CACHE_KEY) || localStorage.getItem("tg_identity_cache");
    if (!cachedRaw) return null;
    const cached = JSON.parse(cachedRaw);
    return cached?.id ? (cached as TelegramIdentity) : null;
  } catch {
    return null;
  }
}

export default function ShamCashInvoiceVerify() {
  const [, params] = useRoute("/deposit/:method/invoice");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const query = new URLSearchParams(window.location.search || "");
  const invoiceId = String(query.get("invoiceId") || "").trim();
  const expiresAt = String(query.get("expiresAt") || "").trim();
  const [transactionRef, setTransactionRef] = useState("");
  const [verifying, setVerifying] = useState(false);
  const apiBaseUrl = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

  const verifyAutoInvoice = async () => {
    if (!invoiceId) {
      toast.error("رقم الفاتورة غير موجود. ارجع وأعد تأكيد الإيداع.");
      return;
    }

    const cleanRef = transactionRef.trim();
    if (!/^\d+$/.test(cleanRef)) {
      toast.error("رقم العملية يجب أن يحتوي على أرقام فقط");
      return;
    }

    try {
      setVerifying(true);
      toast.info("تم إرسال رقم العملية للتحقق. انتظر النتيجة...");
      const tg = readTelegramIdentity();
      const webAppData = getTelegramWebAppDataFromUrl();
      const resp = await fetch(`${apiBaseUrl}/api/deposits/shamcash/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(tg?.id ? { "x-telegram-id": tg.id } : {}),
          ...(tg?.initDataRaw || webAppData ? { "x-telegram-init-data": tg?.initDataRaw || webAppData } : {}),
        },
        body: JSON.stringify({
          invoiceId,
          transactionRef: cleanRef,
          telegramId: tg?.id || "",
          telegramInitData: tg?.initDataRaw || webAppData || "",
          tgWebAppData: webAppData || "",
        }),
      });

      const payload: any = await resp.json().catch(() => ({}));
      if (resp.ok && payload?.verified) {
        toast.success(payload?.message || "تم التحقق من الإيداع وإضافة الرصيد");
        queryClient.invalidateQueries({ queryKey: ["/api/me"] });
        queryClient.invalidateQueries({ queryKey: ["/api/deposits"] });
        setLocation("/deposits");
        return;
      }

      if (payload?.code === "EXPIRED") {
        toast.error("انتهت صلاحية الفاتورة. ارجع وأعد تأكيد الإيداع.");
        return;
      }

      toast.error(payload?.message || "تعذر التحقق من رقم العملية. تأكد من الرقم وحاول مجددًا.");
    } catch (error: any) {
      toast.error(error?.message || "فشل التحقق من العملية");
    } finally {
      setVerifying(false);
    }
  };

  if (params?.method !== "sham_cash_auto") {
    return <div className="p-4 text-center mt-20 text-muted-foreground">صفحة التحقق مخصصة لشام كاش التلقائي فقط</div>;
  }

  return (
    <div className="min-h-screen bg-background pb-24 animate-in slide-in-from-right-4 duration-300">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl px-4 py-3 flex items-center gap-3 border-b border-white/5">
        <Link href="/deposit/sham_cash_auto">
          <div className="bg-card p-2 rounded-full cursor-pointer hover:bg-white/5 transition-colors">
            <ChevronRight className="w-5 h-5 text-foreground" />
          </div>
        </Link>
        <h1 className="font-bold text-lg">تحقق من الإيداع</h1>
      </div>

      <div className="p-4 mt-4 space-y-5">
        <div className="xpay-brand-card rounded-3xl border p-6 text-center shadow-xl">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center">
            <ClipboardCheck className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-black text-foreground mb-2">أدخل رقم عملية شام كاش</h2>
          <p className="text-sm text-muted-foreground leading-6">
            بعد تحويل المبلغ، اكتب رقم العملية كما ظهر في تطبيق شام كاش ثم اضغط تحقق من العملية.
          </p>
        </div>

        <div className="bg-card border border-white/5 rounded-3xl p-5 shadow-lg space-y-4">
          <div className="rounded-2xl bg-background/70 border border-primary/15 p-4">
            <div className="text-xs text-muted-foreground mb-1">رقم الفاتورة</div>
            <div className="font-mono text-sm font-bold break-all">{invoiceId || "غير متوفر"}</div>
          </div>

          {expiresAt ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock3 className="w-4 h-4 text-primary" />
              <span>تنتهي الفاتورة عند: {new Date(expiresAt).toLocaleString()}</span>
            </div>
          ) : null}

          <div>
            <label className="text-sm font-bold text-foreground mb-2 block">رقم العملية *</label>
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="مثال: 206259523"
              value={transactionRef}
              onChange={(e) => setTransactionRef(e.target.value.replace(/\D+/g, ""))}
              className="h-12 bg-background border-white/5 rounded-xl text-base font-mono"
            />
          </div>

          <Button
            type="button"
            onClick={verifyAutoInvoice}
            disabled={verifying || !invoiceId}
            className="w-full h-12 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500"
          >
            <CheckCircle2 className="w-5 h-5 ml-2" />
            {verifying ? "جاري التحقق..." : "تحقق من العملية"}
          </Button>
        </div>
      </div>
    </div>
  );
}
