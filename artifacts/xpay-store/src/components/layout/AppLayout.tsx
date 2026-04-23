import { Link, useLocation } from "wouter";
import { Home, ListOrdered, Wallet, History, HeadphonesIcon, Plus } from "lucide-react";

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
    <div className="mx-auto max-w-md min-h-screen bg-background shadow-2xl relative pb-20">
      <main className="min-h-[calc(100vh-80px)]">{children}</main>

      <nav className="fixed bottom-0 w-full max-w-md bg-card/80 backdrop-blur-xl border-t border-white/5 pb-safe z-50">
        <div className="flex items-center justify-around px-2 h-16">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            
            if (item.isFab) {
              return (
                <Link key={item.href} href={item.href}>
                  <div className="relative -top-5 flex flex-col items-center justify-center cursor-pointer group">
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 ${isActive ? 'bg-primary text-primary-foreground shadow-primary/25' : 'bg-primary/90 text-primary-foreground hover:bg-primary'}`}>
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
                  <div className={`p-1 rounded-xl transition-all duration-300 ${isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground group-hover:text-primary/70'}`}>
                    <item.icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  <span className={`text-[10px] mt-1 font-medium transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
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
