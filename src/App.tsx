import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SplashScreen } from "@/components/SplashScreen";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { SuspensionBanner } from "@/components/SuspensionBanner";
import { SignupPromoDialog } from "@/components/SignupPromoDialog";
import { PreferencesProvider } from "@/hooks/usePreferences";
import { AutoTranslator } from "@/components/AutoTranslator";
import { ScrollToTop } from "@/components/ScrollToTop";
import { MarkdownFormattingToolbar } from "@/components/MarkdownFormattingToolbar";
import Index from "./pages/Index.tsx";
import ProcessPage from "./pages/ProcessPage.tsx";
import ProductsPage from "./pages/ProductsPage.tsx";
import BotsPage from "./pages/BotsPage.tsx";
import BotDashboard from "./pages/BotDashboard.tsx";
import Auth from "./pages/Auth.tsx";
import Admin from "./pages/Admin.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import CheckoutReturn from "./pages/CheckoutReturn.tsx";
import CheckoutSetup from "./pages/CheckoutSetup.tsx";
import Terms from "./pages/Terms.tsx";
import MeetTheOwner from "./pages/MeetTheOwner.tsx";
import MeetTheTeam from "./pages/MeetTheTeam.tsx";
import Plugyxz from "./pages/Plugyxz.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale-while-revalidate: serve cached data for 30s, keep in memory
      // for 5 min so navigating between pages doesn't trigger refetches.
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: 1,
    },
  },
});

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
        <SuspensionBanner />
        {showSplash && <SplashScreen onDone={handleSplashDone} />}
        <BrowserRouter>
          <PreferencesProvider>
            <ScrollToTop />
            <AutoTranslator />
        <SignupPromoDialog />
            <MarkdownFormattingToolbar />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/process" element={<ProcessPage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/bots" element={<BotsPage />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/bot-dashboard" element={<BotDashboard />} />
              <Route path="/checkout/return" element={<CheckoutReturn />} />
              <Route path="/checkout/setup" element={<CheckoutSetup />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/explore/team" element={<MeetTheTeam />} />
              <Route path="/explore/owner" element={<MeetTheOwner />} />
              <Route path="/explore/plugyxz" element={<Plugyxz />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </PreferencesProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
