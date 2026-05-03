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
  amount: z.coerce.number().positive("ط§ظ„ظ…ط¨ظ„ط؛ ظٹط¬ط¨ ط£ظ† ظٹظƒظˆظ† ط£ظƒط¨ط± ظ…ظ† طµظپط±"),
  transactionId: z.string().optional(),
  proofImage: z.string().optional(),
});

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

  const method = methods?.find((m) => m.code === methodCode);

  const form = useForm<z.infer<typeof depositSchema>>({
    resolver: zodResolver(depositSchema),
    defaultValues: {
      currency:
        methodCode?.includes("syriatel") || methodCode?.includes("mtn")
          ? "SYP"
          : "USD",
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
      toast.error("ط­ط¬ظ… طµظˆط±ط© ط§ظ„ط¥ظٹطµط§ظ„ ظƒط¨ظٹط±. ط§ط®طھط± طµظˆط±ط© ط£طµط؛ط± ط£ظˆ ط§ط³طھط®ط¯ظ… ط±ط§ط¨ط· طµظˆط±ط©.");
      return;
    }

    if (method.code === "sham_cash_auto") {
      fetch("/api/deposits/shamcash/invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: values.amount,
          currency: values.currency,
        }),
      })
        .then(async (r) => {
          const payload = await r.json().catch(() => ({}));
          if (!r.ok || !payload?.paymentUrl) {
            throw new Error(payload?.error || payload?.message || "failed_to_create_invoice");
          }
          queryClient.invalidateQueries({ queryKey: ["/api/deposits"] });
          window.location.href = String(payload.paymentUrl);
        })
        .catch((err: any) => {
          toast.error(err?.message || "ظپط´ظ„ ط¥ظ†ط´ط§ط، ظپط§طھظˆط±ط© ط´ط§ظ… ظƒط§ط´");
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
          proofImage: values.proofImage || undefined,
        } as any,
      },
      {
        onSuccess: () => {
          toast.success("طھظ… ط¥ط±ط³ط§ظ„ ط·ظ„ط¨ ط§ظ„ط¥ظٹط¯ط§ط¹ ط¨ظ†ط¬ط§ط­");
          queryClient.invalidateQueries({ queryKey: ["/api/me"] });
          queryClient.invalidateQueries({ queryKey: ["/api/deposits"] });
          setLocation("/deposits");
        },
        onError: (err: any) => {
          const apiError =
            err?.response?.data?.error ||
            err?.response?.data?.message ||
            err?.message;
          toast.error(apiError || "ط­ط¯ط« ط®ط·ط£ ط£ط«ظ†ط§ط، ط§ظ„ط¥ط±ط³ط§ظ„");
        },
      },
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("طھظ… ط§ظ„ظ†ط³ط® ط¨ظ†ط¬ط§ط­");
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
    return (
      <div className="p-4 text-center mt-20 text-muted-foreground">
        ط·ط±ظٹظ‚ط© ط§ظ„ط¯ظپط¹ ط؛ظٹط± ظ…ظˆط¬ظˆط¯ط©
      </div>
    );
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
        <h1 className="font-bold text-lg">{method.name}</h1>
      </div>

      <div className="p-4 space-y-6 mt-2">
        <div
          className={`p-6 rounded-3xl border shadow-lg relative overflow-hidden ${themeBgLight} ${themeBorder}`}
        >
          <div className="relative z-10">
            <h2 className={`font-black text-xl mb-4 ${themeColor}`}>
              {method.subtitle}
            </h2>

            {method.instructions && (
              <p className="text-sm text-foreground/80 mb-6 leading-relaxed whitespace-pre-wrap">
                {method.instructions}
              </p>
            )}

            {method.walletAddress && (
              <div className="bg-background/80 backdrop-blur-sm p-4 rounded-2xl border border-white/5">
                <div className="text-xs text-muted-foreground mb-2">
                  ط¹ظ†ظˆط§ظ† ط§ظ„ظ…ط­ظپط¸ط© / ط§ظ„ط±ظ‚ظ…:
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="font-mono text-sm font-bold truncate select-all">
                    {method.walletAddress}
                  </div>
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
                <img
                  src={method.qrImage}
                  alt="QR Code"
                  className="w-32 h-32 rounded-xl border border-white/10"
                />
              </div>
            )}
          </div>
        </div>

        <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 flex gap-3 text-destructive">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed space-y-1 font-medium">
            <p>ظٹط±ط¬ظ‰ ط¥ط¯ط®ط§ظ„ ط±ظ‚ظ… ط¹ظ…ظ„ظٹط© طµط­ظٹط­ ط£ظˆ ط±ظپط¹ ط¥ظٹطµط§ظ„ ظˆط§ط¶ط­.</p>
            <p>ط§ظ„ط·ظ„ط¨ط§طھ طھط±ط³ظ„ ظ…ط¨ط§ط´ط±ط© ط¥ظ„ظ‰ ظ…ط¬ظ…ظˆط¹ط© ط§ظ„ظ…ط´ط±ظپظٹظ† ظ„ظ„ظ…ط±ط§ط¬ط¹ط©.</p>
          </div>
        </div>

        <div className="bg-card border border-white/5 rounded-3xl p-5 shadow-lg">
          <h3 className="font-bold text-foreground mb-4">طھظپط§طµظٹظ„ ط§ظ„طھط­ظˆظٹظ„</h3>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ط§ظ„ط¹ظ…ظ„ط©</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-12 bg-background border-white/5 rounded-xl">
                          <SelectValue placeholder="ط§ط®طھط± ط§ظ„ط¹ظ…ظ„ط©" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="USD">ط¯ظˆظ„ط§ط± ط£ظ…ط±ظٹظƒظٹ (USD)</SelectItem>
                        <SelectItem value="SYP">ظ„ظٹط±ط© ط³ظˆط±ظٹط© (SYP)</SelectItem>
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
                    <FormLabel>ط§ظ„ظ…ط¨ظ„ط؛ ط§ظ„ظ…ط­ظˆظ„</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="ط£ط¯ط®ظ„ ط§ظ„ظ…ط¨ظ„ط؛..."
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
                      <FormLabel>ط±ظ‚ظ… ط§ظ„ط¹ظ…ظ„ظٹط© (Transaction ID/Ref)</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder="ط£ط¯ط®ظ„ ط±ظ‚ظ… ط¹ظ…ظ„ظٹط© ط§ظ„طھط­ظˆظٹظ„..."
                          {...field}
                          onChange={(e) =>
                            field.onChange(e.target.value.replace(/\D+/g, ""))
                          }
                          className="h-12 bg-background border-white/5 rounded-xl text-base font-mono"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}

              <FormField
                control={form.control}
                name="proofImage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>طµظˆط±ط© ط§ظ„ط¥ظٹطµط§ظ„ (ط§ط®طھظٹط§ط±ظٹ)</FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) => onProofFileChange(e.target.files?.[0])}
                          className="h-12 bg-background border-white/5 rounded-xl text-base"
                        />
                        <Input
                          placeholder="ط£ظˆ ط±ط§ط¨ط· طµظˆط±ط© ط§ظ„ط¥ظٹطµط§ظ„"
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value)}
                          className="h-12 bg-background border-white/5 rounded-xl text-base"
                        />
                        {proofImageName ? (
                          <div className="text-xs text-muted-foreground">
                            ط§ظ„ظ…ظ„ظپ ط§ظ„ظ…ط­ط¯ط¯: {proofImageName}
                          </div>
                        ) : null}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={createDeposit.isPending}
                  className={`w-full h-14 rounded-2xl text-base font-bold text-white shadow-lg ${themeBg} hover:opacity-90 transition-opacity`}
                >
                  {createDeposit.isPending ? "ط¬ط§ط±ظٹ ط§ظ„ط¥ط±ط³ط§ظ„..." : "طھط£ظƒظٹط¯ ط§ظ„ط¯ظپط¹"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}

