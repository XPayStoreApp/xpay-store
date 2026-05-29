import { Link, useLocation } from "wouter";
import { Home, ListOrdered, History, HeadphonesIcon, Plus } from "lucide-react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "الرئيسية", icon: Home },
    { href: "/orders", label: "طلباتي", icon: ListOrdered },
    { href: "/deposit", label: "شحن", icon: Plus, isFab: true },
    { href: "/deposits", label: "سجل الشحن", icon: History },
    { href: "/support", label: "اتصل بنا", icon: HeadphonesIcon },
  ];

  return (
    <div className="xpay-shell w-full min-h-[100dvh] relative pb-20">
      <div className="xpay-app-frame mx-auto w-full max-w-md sm:max-w-xl md:max-w-2xl lg:max-w-3xl min-h-[100dvh] shadow-2xl relative overflow-hidden">
        <main className="min-h-[calc(100dvh-80px)]">{children}</main>
      </div>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md sm:max-w-xl md:max-w-2xl lg:max-w-3xl bg-card/80 backdrop-blur-xl border-t border-primary/15 pb-safe z-50 shadow-[0_-16px_40px_rgba(7,9,27,0.75)]">
        <div className="flex items-center justify-around px-2 h-16">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));

            if (item.isFab) {
              return (
                <Link key={item.href} href={item.href}>
                  <div className="relative -top-5 flex flex-col items-center justify-center cursor-pointer group">
                    <div
                      className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 ${
                        isActive
                          ? "bg-primary text-primary-foreground shadow-primary/30"
                          : "bg-primary/90 text-primary-foreground hover:bg-primary"
                      }`}
                    >
                      <item.icon className="w-7 h-7" />
                    </div>
                    <span className="text-[10px] mt-1 font-medium text-muted-foreground">{item.label}</span>
                  </div>
                </Link>
              );
            }

            return (
              <Link key={item.href} href={item.href}>
                <div className="flex flex-col items-center justify-center w-16 h-full cursor-pointer group">
                  <div
                    className={`p-1 rounded-xl transition-all duration-300 ${
                      isActive ? "bg-primary/10 text-primary" : "text-muted-foreground group-hover:text-primary/70"
                    }`}
                  >
                    <item.icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  <span className={`text-[10px] mt-1 font-medium transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                    {item.label}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
