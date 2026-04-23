import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Categories from "@/pages/categories";
import ProductDetail from "@/pages/product-detail";
import Orders from "@/pages/orders";
import OrderDetail from "@/pages/order-detail";
import Deposit from "@/pages/deposit";
import DepositMethod from "@/pages/deposit-method";
import DepositsList from "@/pages/deposits";
import Profile from "@/pages/profile";
import Support from "@/pages/support";
import AppLayout from "@/components/layout/AppLayout";

const queryClient = new QueryClient();

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/categories/:id" component={Categories} />
        <Route path="/products/:id" component={ProductDetail} />
        <Route path="/orders" component={Orders} />
        <Route path="/orders/:id" component={OrderDetail} />
        <Route path="/deposit" component={Deposit} />
        <Route path="/deposit/:method" component={DepositMethod} />
        <Route path="/deposits" component={DepositsList} />
        <Route path="/profile" component={Profile} />
        <Route path="/support" component={Support} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster theme="dark" position="top-center" dir="rtl" />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
