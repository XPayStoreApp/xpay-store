import { useGetProfile, useListBanners, useListCategories, useListNews } from "@workspace/api-client-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Wallet, Plus, BellRing } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { motion } from "framer-motion";
import { getPublicJson } from "@/lib/public-api";

type CategoryItem = {
  id: string;
  name: string;
  image: string;
  order: number;
  active: boolean;
  productCount: number;
};

function getBrandedCategoryImage(categoryName: string, fallback?: string | null): string {
  const name = String(categoryName || "").trim().toLowerCase();

  if (name.includes("تطبيق") || name.includes("app")) return "/xpay-cat-apps.svg";
  if (name.includes("لعب") || name.includes("game")) return "/xpay-cat-games.svg";
  if (name.includes("رصيد") || name.includes("balance")) return "/xpay-cat-balance.svg";
  if (name.includes("ميديا") || name.includes("سوشل") || name.includes("social")) return "/xpay-cat-media.svg";
  if (name.includes("شات") || name.includes("chat")) return "/xpay-cat-chat.svg";
  if (name.includes("رقم") || name.includes("number")) return "/xpay-cat-numbers.svg";
  if (name.includes("بطاق") || name.includes("card")) return "/xpay-cat-cards.svg";

  return fallback || "/xpay-cat-apps.svg";
}

function readLocalTelegramUser() {
  try {
    const user = (globalThis as any)?.Telegram?.WebApp?.initDataUnsafe?.user;
    if (!user?.id) return null;
    const username = String(
      user.username || `${user.first_name || ""} ${user.last_name || ""}`.trim() || "TelegramUser",
    );
    return {
      telegramId: String(user.id),
      username,
    };
  } catch {
    return null;
  }
}

export default function Home() {
  const { data: profile, isLoading: profileLoading, isError: profileError } = useGetProfile();
  const { data: news, isLoading: newsLoading } = useListNews();
  const { data: banners, isLoading: bannersLoading } = useListBanners();
  const { data: categories, isLoading: categoriesLoading } = useListCategories();
  const [fallbackCategories, setFallbackCategories] = useState<CategoryItem[] | null>(null);

  useEffect(() => {
    if (categoriesLoading) return;
    if (categories && categories.length > 0) return;

    let cancelled = false;
    getPublicJson<CategoryItem[]>("/categories")
      .then((rows) => {
        if (!cancelled) setFallbackCategories(rows.filter((cat) => cat.active));
      })
      .catch((error) => {
        console.error("Fallback categories load failed:", error);
      });

    return () => {
      cancelled = true;
    };
  }, [categories, categoriesLoading]);

  const [emblaRef] = useEmblaCarousel({ loop: true, direction: "rtl" }, [Autoplay({ delay: 3000 })]);
  const localTelegramUser = readLocalTelegramUser();
  const isInsideTelegram = Boolean((globalThis as any)?.Telegram?.WebApp);
  const visibleCategories = (categories && categories.length > 0 ? categories : fallbackCategories) || [];
  const effectiveTelegramId = profile?.telegramId || localTelegramUser?.telegramId || "";
  const displayName =
    (profile?.telegramId ? profile.username : "") ||
    localTelegramUser?.username ||
    profile?.username ||
    (isInsideTelegram ? "Telegram User" : "ضيف");
  const shortId = effectiveTelegramId
    ? (((Number(String(effectiveTelegramId).replace(/\D/g, "").slice(-10) || "0") % 9000) + 1000)
        .toString()
        .padStart(4, "0"))
    : "---";

  return (
    <div className="relative pb-8 animate-in fade-in duration-500 overflow-hidden">
      <div className="home-stars" aria-hidden="true">
        <span className="shooting-star s1" />
        <span className="shooting-star s2" />
        <span className="shooting-star s3" />
      </div>

      <div className="relative z-10">
        <div className="p-4 pt-6 bg-gradient-to-b from-card/50 to-transparent">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                <span className="text-primary font-bold text-lg">
                  {displayName ? displayName.charAt(0).toUpperCase() : "X"}
                </span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">أهلاً بك يا</p>
                <p className="text-sm font-bold text-foreground">
                  {profileLoading ? <Skeleton className="h-4 w-20" /> : displayName}
                </p>
              </div>
            </div>
            <Link href="/profile">
              <div className="bg-card border border-white/5 rounded-xl px-3 py-2 flex flex-col gap-1 cursor-pointer min-w-[120px] sm:min-w-[150px]">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">ID:</span>
                  <span className="text-xs font-mono font-medium text-foreground">
                    {profileLoading && !effectiveTelegramId ? <Skeleton className="h-4 w-16" /> : (effectiveTelegramId || "---")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">ACC:</span>
                  <span className="text-xs font-mono font-bold text-primary">
                    {profileLoading ? <Skeleton className="h-4 w-10" /> : shortId}
                  </span>
                </div>
              </div>
            </Link>
          </div>

          <Card className="xpay-brand-card shadow-xl overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            <CardContent className="p-6 relative z-10">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Wallet className="w-4 h-4 text-primary" />
                    <span className="text-sm">الرصيد المتاح</span>
                  </div>
                  <div className="text-3xl font-bold text-white mb-1 flex items-baseline gap-1">
                    <span className="text-primary">$</span>
                    {profileLoading ? <Skeleton className="h-8 w-24" /> : (profile?.balanceUsd || 0).toFixed(2)}
                  </div>
                </div>
                <Link href="/deposit">
                  <div className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 rounded-full px-4 py-2 flex items-center gap-2 text-sm font-bold transition-transform active:scale-95 cursor-pointer">
                    <Plus className="w-4 h-4" />
                    <span>شحن</span>
                  </div>
                </Link>
              </div>
            </CardContent>
          </Card>

          {profileError && !localTelegramUser && (
            <div className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              لم تصل بيانات تيليجرام إلى المتجر. اضغط /start ثم افتح المتجر من زر البوت.
            </div>
          )}
        </div>

        {!newsLoading && news && news.length > 0 && (
          <div className="px-4 mb-6">
            <div className="bg-card border border-white/5 rounded-xl p-3 flex items-center gap-3">
              <div className="bg-accent/20 p-2 rounded-full text-accent shrink-0 animate-pulse">
                <BellRing className="w-4 h-4" />
              </div>
              <div className="overflow-hidden flex-1 relative h-5">
                <div className="animate-[marquee_15s_linear_infinite] whitespace-nowrap absolute right-0 flex items-center h-full">
                  {news.map((item) => (
                    <span key={item.id} className="text-xs text-muted-foreground mr-8">
                      {item.content}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="px-4 mb-8">
          {bannersLoading ? (
            <Skeleton className="w-full h-40 rounded-2xl" />
          ) : banners && banners.length > 0 ? (
            <div className="overflow-hidden rounded-2xl" ref={emblaRef}>
              <div className="flex">
                {banners.map((banner) => (
                  <div key={banner.id} className="flex-[0_0_100%] min-w-0 relative h-40">
                    <img src={banner.image} alt={banner.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-4">
                      <h3 className="text-white font-bold text-lg drop-shadow-md">{banner.title}</h3>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="px-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground">الأقسام</h2>
          </div>

          {categoriesLoading && visibleCategories.length === 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  <Skeleton className="w-full aspect-square rounded-2xl" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
          ) : visibleCategories.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-x-3 gap-y-5">
              {visibleCategories.map((cat, i) => (
                <Link key={cat.id} href={`/categories/${cat.id}`}>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex flex-col items-center gap-2 cursor-pointer group"
                  >
                    <div className="w-full aspect-square rounded-2xl bg-card border border-white/5 overflow-hidden relative shadow-lg group-hover:border-primary/30 transition-colors">
                      <img
                        src={getBrandedCategoryImage(cat.name, cat.image)}
                        alt={cat.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                    </div>
                    <span className="text-[11px] font-semibold text-center text-muted-foreground group-hover:text-primary transition-colors leading-tight">
                      {cat.name}
                    </span>
                  </motion.div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-card/70 px-4 py-6 text-center text-sm text-muted-foreground">
              لا توجد أقسام متاحة حالياً.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

