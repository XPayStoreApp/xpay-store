import { useGetProfile } from "@workspace/api-client-react";
import { Wallet, Settings, LogOut, ShieldAlert, User as UserIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export default function Profile() {
  const { data: profile, isLoading } = useGetProfile();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 pt-8">
        <Skeleton className="w-24 h-24 rounded-full mx-auto mb-4" />
        <Skeleton className="h-6 w-32 mx-auto mb-8" />
        <Skeleton className="h-32 w-full rounded-3xl mb-6" />
        <div className="space-y-4">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 animate-in fade-in duration-300">
      <div className="bg-card/50 border-b border-white/5 pt-12 pb-8 px-4 text-center rounded-b-[2rem] shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-1/2 translate-x-1/2 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="relative z-10">
          <div className="w-24 h-24 rounded-full bg-background border-4 border-card mx-auto mb-4 flex items-center justify-center shadow-xl">
            {profile?.username ? (
              <span className="text-4xl font-black text-primary">{profile.username.charAt(0).toUpperCase()}</span>
            ) : (
              <UserIcon className="w-10 h-10 text-muted-foreground" />
            )}
          </div>
          
          <h1 className="text-2xl font-bold text-foreground mb-1">{profile?.username || "مستخدم"}</h1>
          
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-4">
            <span className="bg-white/5 px-3 py-1 rounded-full border border-white/5 font-mono">
              ID: {profile?.telegramId}
            </span>
            {profile?.role === 'admin' && (
              <span className="bg-primary/20 text-primary px-3 py-1 rounded-full border border-primary/20 text-xs font-bold flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" /> أدمن
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6 mt-4">
        {/* Balances */}
        <div className="bg-card border border-white/5 rounded-3xl p-5 shadow-lg flex gap-4">
          <div className="flex-1 bg-background/50 rounded-2xl p-4 border border-white/5">
            <div className="text-xs text-muted-foreground mb-1 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-primary" /> رصيد الدولار
            </div>
            <div className="text-2xl font-black text-foreground">${(profile?.balanceUsd || 0).toFixed(2)}</div>
          </div>
          
          <div className="flex-1 bg-background/50 rounded-2xl p-4 border border-white/5">
            <div className="text-xs text-muted-foreground mb-1 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-accent" /> رصيد الليرة
            </div>
            <div className="text-xl font-black text-foreground">{(profile?.balanceSyp || 0).toLocaleString()} <span className="text-sm font-normal text-muted-foreground">ل.س</span></div>
          </div>
        </div>

        {/* Menu Items */}
        <div className="bg-card border border-white/5 rounded-3xl overflow-hidden shadow-lg">
          <div className="p-4 border-b border-white/5 flex items-center gap-3 hover:bg-white/5 cursor-pointer transition-colors">
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-foreground">
              <Settings className="w-5 h-5" />
            </div>
            <div className="flex-1 font-medium text-sm text-foreground">إعدادات الحساب</div>
          </div>
          <div className="p-4 flex items-center gap-3 hover:bg-white/5 cursor-pointer transition-colors text-destructive">
            <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <LogOut className="w-5 h-5" />
            </div>
            <div className="flex-1 font-medium text-sm">تسجيل الخروج</div>
          </div>
        </div>
      </div>
    </div>
  );
}
