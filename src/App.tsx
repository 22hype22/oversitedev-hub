import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SplashScreen } from "@/components/SplashScreen";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { SignupPromoDialog } from "@/components/SignupPromoDialog";
import Index from "./pages/Index.tsx";
import ProcessPage from "./pages/ProcessPage.tsx";
import ProductsPage from "./pages/ProductsPage.tsx";
import BotsPage from "./pages/BotsPage.tsx";
import Auth from "./pages/Auth.tsx";
import Admin from "./pages/Admin.tsx";
import CheckoutReturn from "./pages/CheckoutReturn.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => {
  const [showSplash, setShowSplash] = useState(() => {
    if (typeof window === "undefined") return true;
    return !sessionStorage.getItem("oversite-splash-seen");
  });

  const handleSplashDone = () => {
    sessionStorage.setItem("oversite-splash-seen", "1");
    setShowSplash(false);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <PaymentTestModeBanner />
        {showSplash && <SplashScreen onDone={handleSplashDone} />}
        <BrowserRouter>
          <SignupPromoDialog />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/process" element={<ProcessPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/bots" element={<BotsPage />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/checkout/return" element={<CheckoutReturn />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
