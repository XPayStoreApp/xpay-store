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

function getMethodName(method: UiMethod) {
  if (method.code === "sham_cash_auto") return "شام كاش";
  return method.name;
}

function getMethodSubtitle(method: UiMethod) {
  if (method.code === "sham_cash_auto") return "شام كاش تلقائي عبر الفاتورة";
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

  const method = (methods as UiMethod[] | undefined)?.find((m) => m.code === methodCode);
  const apiBaseUrl = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
  const isShamCashAuto = method?.code === "sham_cash_auto";
  const isShamCashManual = method?.code === "sham_cash";

  const readTelegramIdentity = (): TelegramIdentity | null => {
    try {
      const tg = (window as any)?.Telegram?.WebApp;
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
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        if (cached?.id) return cached as TelegramIdentity;
      }
      return null;
    } catch {
      return null;
    }
  };

  const form = useForm<z.infer<typeof depositSchema>>({
    resolver: zodResolver(depositSchema),
    defaultValues: {
      currency:
        methodCode?.includes("syriatel") || methodCode?.includes("mtn") ? "SYP" : "USD",
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

    if (
      values.proofImage &&
      values.proofImage.startsWith("data:") &&
      values.proofImage.length > 1_500_000
    ) {
      toast.error("حجم صورة الإيصال كبير. اختر صورة أصغر أو استخدم رابط صورة.");
      return;
    }

    if (method.code === "sham_cash_auto") {
      const tg = readTelegramIdentity();
      const invoiceUrl =
        tg?.id
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
          if (!r.ok || !payload?.paymentUrl) {
            throw new Error(
              payload?.message ||
              payload?.error ||
              `invoice_http_${r.status}`
            );
          }

          const invoiceId = String(payload.invoiceId || "");
          if (invoiceId) {
            toast.success(`تم إنشاء الفاتورة بنجاح. رقم العملية: ${invoiceId}`);
          }

          queryClient.invalidateQueries({ queryKey: ["/api/deposits"] });
          setTimeout(() => {
            window.location.href = String(payload.paymentUrl);
          }, 650);
        })
        .catch((err: any) => {
          toast.error(err?.message || "فشل إنشاء فاتورة شام كاش");
        });
      return;
    }

    const transactionId = String(values.transactionId || "").trim();
    if (!/^\d{3,}$/.test(transactionId)) {
      toast.error("رقم العملية يجب أن يحتوي على أرقام فقط وبحد أدنى 3 خانات");
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

  const isSyriatel = methodCode === "syriatel_cash";
  const isMtn = methodCode === "mtn_cash";
  const isBinance = methodCode === "binance_pay";
  const isUsdt = methodCode === "usdt_auto";

  const themeColor = isSyriatel
    ? "text-[#E31837]"
    : isMtn
      ? "text-[#FFCC00]"
      : isBinance
        ? "text-[#FCD535]"
        : isUsdt
          ? "text-[#26A17B]"
          : "text-primary";

  const themeBg = isSyriatel
    ? "bg-[#E31837]"
    : isMtn
      ? "bg-[#FFCC00]"
      : isBinance
        ? "bg-[#FCD535]"
        : isUsdt
          ? "bg-[#26A17B]"
          : "bg-primary";

  const themeBgLight = isSyriatel
    ? "bg-[#E31837]/10"
    : isMtn
      ? "bg-[#FFCC00]/10"
      : isBinance
        ? "bg-[#FCD535]/10"
        : isUsdt
          ? "bg-[#26A17B]/10"
          : "bg-primary/10";

  const themeBorder = isSyriatel
    ? "border-[#E31837]/20"
    : isMtn
      ? "border-[#FFCC00]/20"
      : isBinance
        ? "border-[#FCD535]/20"
        : isUsdt
          ? "border-[#26A17B]/20"
          : "border-primary/20";

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
        <div className={`p-6 rounded-3xl border shadow-lg relative overflow-hidden ${themeBgLight} ${themeBorder}`}>
          <div className="relative z-10">
            <h2 className={`font-black text-xl mb-4 ${themeColor}`}>{getMethodSubtitle(method)}</h2>

            {method.instructions && (
              <p className="text-sm text-foreground/80 mb-6 leading-relaxed whitespace-pre-wrap">
                {method.instructions}
              </p>
            )}

            {method.walletAddress && (
              <div className="bg-background/80 backdrop-blur-sm p-4 rounded-2xl border border-white/5">
                <div className="text-xs text-muted-foreground mb-2">عنوان المحفظة / الرقم:</div>
                <div className="flex items-center justify-between gap-3">
                  <div className="font-mono text-sm font-bold truncate select-all">{method.walletAddress}</div>
                  <button
                    onClick={() => copyToClipboard(method.walletAddress!)}
                    className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${themeBgLight} ${themeColor}`}
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
        </div>

        <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 flex gap-3 text-destructive">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed space-y-1 font-medium">
            {method.code === "sham_cash_auto" ? (
              <>
                <p>بعد الضغط على تأكيد الدفع سيتم إنشاء فاتورة شام كاش مباشرة.</p>
                <p>سيظهر رقم العملية (Invoice ID) ثم يتم تحويلك لصفحة الدفع تلقائيًا.</p>
              </>
            ) : (
              <>
                <p>يرجى إدخال رقم عملية صحيح أو رفع إيصال واضح.</p>
                <p>الطلبات ترسل مباشرة إلى مجموعة المشرفين للمراجعة.</p>
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
                          {proofImageName ? (
                            <div className="text-xs text-muted-foreground">الملف المحدد: {proofImageName}</div>
                          ) : null}
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
                  disabled={createDeposit.isPending}
                  className={`w-full h-14 rounded-2xl text-base font-bold text-white shadow-lg ${themeBg} hover:opacity-90 transition-opacity`}
                >
                  {createDeposit.isPending ? "جارٍ الإرسال..." : "تأكيد الدفع"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
