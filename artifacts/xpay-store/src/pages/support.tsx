import { useListSocialLinks, getListSocialLinksQueryKey } from "@workspace/api-client-react";
import { useEffect, useState } from "react";
import { HeadphonesIcon, MessageCircle, Send, Globe, ChevronLeft, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { getPublicJson } from "@/lib/public-api";

type SocialLinkItem = {
  id: string;
  platform: string;
  url: string;
  label: string;
};

export default function Support() {
  const { data: links, isLoading } = useListSocialLinks({
    query: { queryKey: getListSocialLinksQueryKey() },
  });
  const [fallbackLinks, setFallbackLinks] = useState<SocialLinkItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPublicJson<SocialLinkItem[]>("/social-links")
      .then((rows) => {
        if (!cancelled) setFallbackLinks(rows);
      })
      .catch((error) => {
        console.error("Fallback social links load failed:", error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleLinks = (fallbackLinks && fallbackLinks.length > 0 ? fallbackLinks : links) || [];

  const getPlatformIcon = (platform: string) => {
    const p = platform.toLowerCase();
    if (p.includes("whatsapp")) return <MessageCircle className="w-6 h-6 text-[#25D366]" />;
    if (p.includes("telegram")) return <Send className="w-6 h-6 text-[#0088cc]" />;
    if (p.includes("facebook")) return <Globe className="w-6 h-6 text-[#1877F2]" />;
    return <HeadphonesIcon className="w-6 h-6 text-primary" />;
  };

  return (
    <div className="min-h-screen bg-background pb-24 p-4 animate-in fade-in duration-300">
      <div className="mb-8 mt-6 text-center">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-primary/20 relative">
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
          <HeadphonesIcon className="w-10 h-10 text-primary relative z-10" />
        </div>
        <h1 className="text-2xl font-black text-foreground mb-2">كيف يمكننا مساعدتك؟</h1>
        <p className="text-sm text-muted-foreground px-4">
          نحن متواجدون للرد على استفساراتك ومساعدتك في أي مشكلة تواجهك.
        </p>
      </div>

      <div className="space-y-4">
        {isLoading && visibleLinks.length === 0 ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)
        ) : visibleLinks.length > 0 ? (
          visibleLinks.map((link, i) => (
            <motion.div
              key={link.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-card border border-white/5 rounded-2xl p-4 flex items-center gap-4 hover:bg-white/5 transition-all group shadow-lg"
              >
                <div className="w-12 h-12 rounded-xl bg-background border border-white/5 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  {getPlatformIcon(link.platform)}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-foreground mb-1">{link.label}</h3>
                  <p className="text-xs text-muted-foreground capitalize">{link.platform}</p>
                </div>
                <ChevronLeft className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </a>
            </motion.div>
          ))
        ) : (
          <div className="text-center p-8 bg-card rounded-3xl border border-white/5">
            <p className="text-muted-foreground">لا توجد طرق تواصل متاحة حالياً</p>
          </div>
        )}
      </div>

      <div className="mt-8 p-5 bg-primary/10 border border-primary/20 rounded-3xl text-center">
        <h4 className="font-bold text-primary mb-2 text-sm">أوقات العمل</h4>
        <p className="text-xs text-primary/80 leading-6">
          فريق الدعم متواجد يومياً من 10 صباحاً حتى 12 ليلاً بتوقيت دمشق.
        </p>

        <a
          href="https://t.me/ShadMiniX"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/30 bg-background/45 px-4 py-3 text-sm font-bold text-foreground shadow-lg shadow-primary/10 transition-all hover:border-primary/60 hover:bg-primary/10 active:scale-[0.98]"
        >
          <Sparkles className="h-4 w-4 text-primary" />
          <span>تم تصميم المتجر بواسطة ShadMiniX</span>
        </a>
      </div>
    </div>
  );
}

