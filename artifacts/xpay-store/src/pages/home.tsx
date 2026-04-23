import { useGetProfile, useListBanners, useListCategories, useListNews } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Wallet, Plus, BellRing, ChevronLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { motion } from "framer-motion";

export default function Home() {
  const { data: profile, isLoading: profileLoading } = useGetProfile();
  const { data: news, isLoading: newsLoading } = useListNews();
  const { data: banners, isLoading: bannersLoading } = useListBanners();
  const { data: categories, isLoading: categoriesLoading } = useListCategories();

  const [emblaRef] = useEmblaCarousel({ loop: true, direction: "rtl" }, [Autoplay({ delay: 3000 })]);

  return (
    <div className="pb-8 animate-in fade-in duration-500">
      {/* Header / Balance Card */}
      <div className="p-4 pt-6 bg-gradient-to-b from-card/50 to-transparent">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
              <span className="text-primary font-bold text-lg">
                {profile?.username ? profile.username.charAt(0).toUpperCase() : "X"}
              </span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">مرحباً بك،</p>
              <p className="text-sm font-bold text-foreground">
                {profileLoading ? <Skeleton className="h-4 w-20" /> : profile?.username || "ضيف"}
              </p>
            </div>
          </div>
          <Link href="/profile">
            <div className="bg-card border border-white/5 rounded-full px-3 py-1.5 flex items-center gap-2 cursor-pointer">
              <span className="text-xs text-muted-foreground">ID:</span>
              <span className="text-xs font-mono font-medium text-foreground">
                {profileLoading ? <Skeleton className="h-4 w-16" /> : profile?.telegramId || "---"}
              </span>
            </div>
          </Link>
        </div>

        <Card className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 border-white/10 shadow-xl overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
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
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <span>≈</span>
                  {profileLoading ? <Skeleton className="h-3 w-16" /> : (profile?.balanceSyp || 0).toLocaleString()}
                  <span>ل.س</span>
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
      </div>

      {/* News Ticker */}
      {!newsLoading && news && news.length > 0 && (
        <div className="px-4 mb-6">
          <div className="bg-card border border-white/5 rounded-xl p-3 flex items-center gap-3">
            <div className="bg-accent/20 p-2 rounded-full text-accent shrink-0 animate-pulse">
              <BellRing className="w-4 h-4" />
            </div>
            <div className="overflow-hidden flex-1 relative h-5">
              <div className="animate-[marquee_15s_linear_infinite] whitespace-nowrap absolute right-0 flex items-center h-full">
                {news.map((item, i) => (
                  <span key={item.id} className="text-xs text-muted-foreground mr-8">
                    {item.content}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Banner Slider */}
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

      {/* Categories Grid */}
      <div className="px-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground">الأقسام</h2>
        </div>
        
        {categoriesLoading ? (
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <Skeleton className="w-full aspect-square rounded-2xl" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-x-3 gap-y-5">
            {categories?.map((cat, i) => (
              <Link key={cat.id} href={`/categories/${cat.id}`}>
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex flex-col items-center gap-2 cursor-pointer group"
                >
                  <div className="w-full aspect-square rounded-2xl bg-card border border-white/5 overflow-hidden relative shadow-lg group-hover:border-primary/30 transition-colors">
                    <img src={cat.image} alt={cat.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent"></div>
                  </div>
                  <span className="text-[11px] font-semibold text-center text-muted-foreground group-hover:text-primary transition-colors leading-tight">
                    {cat.name}
                  </span>
                </motion.div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
