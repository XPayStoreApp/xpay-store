import { useRoute, Link, useLocation } from "wouter";
import { ChevronRight, Copy, AlertTriangle } from "lucide-react";
import {
  useListPaymentMethods,
  useCreateDeposit,
  getListPaymentMethodsQueryKey,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const depositSchema = z.object({
  currency: z.enum(["USD", "SYP"]),
  amount: z.coerce.number().positive("المبلغ يجب أن يكون أكبر من صفر"),
  transactionId: z.string().optional(),
  proofImage: z.string().optional(),
});

type UiMethod = {
  code: string;
  name: string;
  subtitle: string;
  instructions?: string;
  walletAddress?: string;
  qrImage?: string;
};

type TelegramIdentity = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  initDataRaw: string;
};

type AutoInvoiceState = {
  depositId: number;
  invoiceId: string;
  expiresAt?: string | null;
};

function getMethodName(method: UiMethod) {
  if (method.code === "sham_cash_auto") return "شام كاش";
  return method.name;
}

function getMethodSubtitle(method: UiMethod) {
  if (method.code === "sham_cash_auto") return "شام كاش التلقائي";
  return method.subtitle;
}

export default function DepositMethod() {
  const [, params] = useRoute("/deposit/:method");
  const methodCode = params?.method;
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: methods, isLoading } = useListPaymentMethods({
    query: { queryKey: getListPaymentMethodsQueryKey() },
  });

  const createDeposit = useCreateDeposit();
  const [proofImageName, setProofImageName] = useState("");
  const [autoInvoice, setAutoInvoice] = useState<AutoInvoiceState | null>(null);
  const [autoTransactionRef, setAutoTransactionRef] = useState("");
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoVerifying, setAutoVerifying] = useState(false);

  const method = (methods as UiMethod[] | undefined)?.find((m) => m.code === methodCode);
  const apiBaseUrl = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
  const isShamCashAuto = method?.code === "sham_cash_auto";
  const isShamCashManual = method?.code === "sham_cash";

  const readTelegramIdentity = (): TelegramIdentity | null => {
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
        localStorage.setItem("tg_identity_cache", JSON.stringify(identity));
        return identity;
      }

      const search = new URLSearchParams(window.location.search || "");
      const hashRaw = String(window.location.hash || "").replace(/^#/, "");
      const hash = new URLSearchParams(hashRaw);
      const webAppData = search.get("tgWebAppData") || hash.get("tgWebAppData");

      if (webAppData) {
        const init = new URLSearchParams(webAppData);
        const userRaw = init.get("user");
        if (userRaw) {
          const parsedUser = JSON.parse(userRaw);
          if (parsedUser?.id) {
            const identity: TelegramIdentity = {
              id: String(parsedUser.id),
              username: String(parsedUser.username || `${parsedUser.first_name || ""} ${parsedUser.last_name || ""}`.trim() || "TelegramUser"),
              firstName: String(parsedUser.first_name || ""),
              lastName: String(parsedUser.last_name || ""),
              initDataRaw: String(webAppData),
            };
            localStorage.setItem("tg_identity_cache", JSON.stringify(identity));
            return identity;
          }
        }
      }

      const cachedRaw = localStorage.getItem("tg_identity_cache");
      if (!cachedRaw) return null;
      const cached = JSON.parse(cachedRaw);
      return cached?.id ? (cached as TelegramIdentity) : null;
    } catch {
      return null;
    }
  };

  const form = useForm<z.infer<typeof depositSchema>>({
    resolver: zodResolver(depositSchema),
    defaultValues: {
      currency: methodCode?.includes("syriatel") || methodCode?.includes("mtn") ? "SYP" : "USD",
      amount: undefined as unknown as number,
      transactionId: "",
      proofImage: "",
    },
  });

  const onProofFileChange = (file?: File) => {
    if (!file) {
      form.setValue("proofImage", "");
      setProofImageName("");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = typeof reader.result === "string" ? reader.result : "";
      form.setValue("proofImage", base64);
      setProofImageName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = (values: z.infer<typeof depositSchema>) => {
    if (!method) return;

    if (values.proofImage && values.proofImage.startsWith("data:") && values.proofImage.length > 1_500_000) {
      toast.error("حجم صورة الإيصال كبير، اختر صورة أصغر.");
      return;
    }

    if (method.code === "sham_cash_auto") {
      setAutoLoading(true);
      const tg = readTelegramIdentity();
      if (!tg?.id) {
        setAutoLoading(false);
        toast.error("هوية تيليجرام غير متاحة. افتح المتجر من زر البوت داخل Telegram ثم أعد المحاولة.");
        return;
      }
      const invoiceUrl = tg?.id
        ? `${apiBaseUrl}/api/deposits/shamcash/invoice?tg_id=${encodeURIComponent(tg.id)}&tg_username=${encodeURIComponent(tg.username || "")}`
        : `${apiBaseUrl}/api/deposits/shamcash/invoice`;

      fetch(invoiceUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(tg?.id ? { "x-telegram-id": tg.id } : {}),
          ...(tg?.username ? { "x-telegram-username": tg.username } : {}),
          ...(tg?.firstName ? { "x-telegram-first-name": tg.firstName } : {}),
          ...(tg?.lastName ? { "x-telegram-last-name": tg.lastName } : {}),
          ...(tg?.initDataRaw ? { "x-telegram-init-data": tg.initDataRaw } : {}),
        },
        body: JSON.stringify({
          amount: values.amount,
          currency: values.currency,
          telegramId: tg?.id || "",
          telegramUsername: tg?.username || "",
          telegramFirstName: tg?.firstName || "",
          telegramLastName: tg?.lastName || "",
          telegramInitData: tg?.initDataRaw || "",
        }),
      })
        .then(async (r) => {
          const payload = await r.json().catch(() => null);
          if (!r.ok || !payload?.invoiceId) {
            throw new Error(payload?.message || payload?.error || `invoice_http_${r.status}`);
          }

          const invoiceId = String(payload.invoiceId || "");
          setAutoInvoice({
            depositId: Number(payload.depositId),
            invoiceId,
            expiresAt: payload.expiresAt || null,
          });
          setAutoTransactionRef("");
          toast.success(`تم إنشاء الفاتورة بنجاح. رقم العملية: ${invoiceId}`);
          queryClient.invalidateQueries({ queryKey: ["/api/deposits"] });
        })
        .catch((err: any) => {
          toast.error(err?.message || "فشل إنشاء فاتورة شام كاش");
        })
        .finally(() => {
          setAutoLoading(false);
        });
      return;
    }

    const transactionId = String(values.transactionId || "").trim();
    if (!/^\d{3,}$/.test(transactionId)) {
      toast.error("رقم العملية يجب أن يحتوي أرقام فقط وبحد أدنى 3 خانات");
      return;
    }

    createDeposit.mutate(
      {
        data: {
          method: method.code,
          currency: values.currency,
          amount: values.amount,
          transactionId,
          proofImage: isShamCashAuto ? undefined : (values.proofImage || undefined),
        } as any,
      },
      {
        onSuccess: () => {
          toast.success("تم إرسال طلب الإيداع بنجاح");
          queryClient.invalidateQueries({ queryKey: ["/api/me"] });
          queryClient.invalidateQueries({ queryKey: ["/api/deposits"] });
          setLocation("/deposits");
        },
        onError: (err: any) => {
          const apiError = err?.response?.data?.error || err?.response?.data?.message || err?.message;
          toast.error(apiError || "حدث خطأ أثناء الإرسال");
        },
      },
    );
  };

  const verifyAutoInvoice = async () => {
    if (!autoInvoice?.invoiceId) {
      toast.error("أنشئ الفاتورة أولاً");
      return;
    }

    const transactionRef = autoTransactionRef.trim();
    if (!/^\d+$/.test(transactionRef)) {
      toast.error("رقم العملية يجب أن يحتوي على أرقام فقط");
      return;
    }

    try {
      setAutoVerifying(true);
      const resp = await fetch(`${apiBaseUrl}/api/deposits/shamcash/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: autoInvoice.invoiceId,
          transactionRef,
        }),
      });
      const payload: any = await resp.json().catch(() => ({}));

      if (resp.ok && payload?.verified) {
        toast.success(payload?.message || "تم التحقق من الدفع بنجاح");
        queryClient.invalidateQueries({ queryKey: ["/api/me"] });
        queryClient.invalidateQueries({ queryKey: ["/api/deposits"] });
        setLocation("/deposits");
        return;
      }

      if (payload?.code === "EXPIRED") {
        toast.error("انتهت صلاحية الفاتورة. اضغط إنشاء/تحديث الفاتورة.");
        return;
      }

      const msg = String(payload?.message || "");
      if (msg === "verification_failed") {
        toast.error("تعذر التحقق من رقم العملية. تأكد من كتابة الرقم كما ظهر في شام كاش.");
      } else {
        toast.error(msg || "تعذر التحقق من رقم العملية");
      }
    } catch (error: any) {
      toast.error(error?.message || "فشل التحقق من العملية");
    } finally {
      setAutoVerifying(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("تم النسخ بنجاح");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 pt-8">
        <Skeleton className="h-8 w-32 mb-8" />
        <Skeleton className="h-48 w-full rounded-3xl mb-6" />
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    );
  }

  if (!method) {
    return <div className="p-4 text-center mt-20 text-muted-foreground">طريقة الدفع غير موجودة</div>;
  }

  return (
    <div className="min-h-screen bg-background pb-24 animate-in slide-in-from-right-4 duration-300">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl px-4 py-3 flex items-center gap-3 border-b border-white/5">
        <Link href="/deposit">
          <div className="bg-card p-2 rounded-full cursor-pointer hover:bg-white/5 transition-colors">
            <ChevronRight className="w-5 h-5 text-foreground" />
          </div>
        </Link>
        <h1 className="font-bold text-lg">{getMethodName(method)}</h1>
      </div>

      <div className="p-4 space-y-6 mt-2">
        <div className="p-6 rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 via-blue-500/10 to-indigo-500/10 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-black text-xl text-cyan-300">{getMethodSubtitle(method)}</h2>
            <div className="text-xs px-2 py-1 rounded-full bg-cyan-500/20 text-cyan-200">XPay</div>
          </div>

          {method.instructions && (
            <p className="text-sm text-foreground/90 mb-6 leading-relaxed whitespace-pre-wrap">{method.instructions}</p>
          )}

          {method.walletAddress && (
            <div className="bg-background/70 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
              <div className="text-xs text-muted-foreground mb-2">عنوان المحفظة / الرقم</div>
              <div className="flex items-center justify-between gap-3">
                <div className="font-mono text-sm font-bold truncate select-all">{method.walletAddress}</div>
                <button
                  onClick={() => copyToClipboard(method.walletAddress!)}
                  className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-cyan-500/20 text-cyan-300"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {method.qrImage && (
            <div className="mt-4 flex justify-center">
              <img src={method.qrImage} alt="QR Code" className="w-32 h-32 rounded-xl border border-white/10" />
            </div>
          )}
        </div>

        <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 flex gap-3 text-destructive">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed space-y-1 font-medium">
            {method.code === "sham_cash_auto" ? (
              <>
                <p>التحقق يتم عبر API بشكل تلقائي داخل المتجر.</p>
                <p>بعد إنشاء الفاتورة أدخل رقم العملية كما ظهر في شام كاش ثم اضغط تحقق.</p>
              </>
            ) : (
              <>
                <p>يرجى إدخال رقم عملية صحيح أو رفع إيصال واضح.</p>
                <p>طلبات الإيداع اليدوي تُرسل للمشرفين للمراجعة.</p>
              </>
            )}
          </div>
        </div>

        <div className="bg-card border border-white/5 rounded-3xl p-5 shadow-lg">
          <h3 className="font-bold text-foreground mb-4">تفاصيل التحويل</h3>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>العملة</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-12 bg-background border-white/5 rounded-xl">
                          <SelectValue placeholder="اختر العملة" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="USD">دولار أمريكي (USD)</SelectItem>
                        <SelectItem value="SYP">ليرة سورية (SYP)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>المبلغ المحول</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="أدخل المبلغ..."
                        {...field}
                        className="h-12 bg-background border-white/5 rounded-xl text-base"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {method.code !== "sham_cash_auto" ? (
                <FormField
                  control={form.control}
                  name="transactionId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>رقم العملية (Transaction ID/Ref)</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder="أدخل رقم عملية التحويل..."
                          {...field}
                          onChange={(e) => field.onChange(e.target.value.replace(/\D+/g, ""))}
                          className="h-12 bg-background border-white/5 rounded-xl text-base font-mono"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}

              {!isShamCashAuto ? (
                <FormField
                  control={form.control}
                  name="proofImage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>صورة الإيصال (اختياري)</FormLabel>
                      <FormControl>
                        <div className="space-y-2">
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => onProofFileChange(e.target.files?.[0])}
                            className="h-12 bg-background border-white/5 rounded-xl text-base"
                          />
                          {!isShamCashManual ? (
                            <Input
                              placeholder="أو رابط صورة الإيصال"
                              value={field.value || ""}
                              onChange={(e) => field.onChange(e.target.value)}
                              className="h-12 bg-background border-white/5 rounded-xl text-base"
                            />
                          ) : null}
                          {proofImageName ? <div className="text-xs text-muted-foreground">الملف المحدد: {proofImageName}</div> : null}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}

              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={createDeposit.isPending || autoLoading}
                  className="w-full h-14 rounded-2xl text-base font-bold text-white shadow-lg bg-cyan-600 hover:bg-cyan-500"
                >
                  {method.code === "sham_cash_auto"
                    ? (autoLoading ? "جاري إنشاء الفاتورة..." : "إنشاء/تحديث الفاتورة")
                    : (createDeposit.isPending ? "جاري الإرسال..." : "تأكيد الدفع")}
                </Button>
              </div>
            </form>
          </Form>

          {isShamCashAuto && autoInvoice ? (
            <div className="mt-5 space-y-3 rounded-2xl border border-cyan-500/20 bg-background/70 p-4">
              <div className="text-sm font-semibold">رقم العملية (Invoice ID): <span className="font-mono">{autoInvoice.invoiceId}</span></div>
              <div className="text-xs text-muted-foreground">
                {autoInvoice.expiresAt
                  ? `تنتهي الفاتورة عند: ${new Date(autoInvoice.expiresAt).toLocaleString()}`
                  : "يمكنك إنشاء فاتورة جديدة في أي وقت."}
              </div>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="أدخل رقم العملية الذي ظهر في تطبيق شام كاش"
                value={autoTransactionRef}
                onChange={(e) => setAutoTransactionRef(e.target.value.replace(/\D+/g, ""))}
                className="h-12 bg-background border-white/5 rounded-xl text-base font-mono"
              />
              <Button
                type="button"
                onClick={verifyAutoInvoice}
                disabled={autoVerifying}
                className="w-full h-11 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500"
              >
                {autoVerifying ? "جاري التحقق..." : "تحقق من العملية"}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
