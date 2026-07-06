import { Component, lazy, Suspense, useEffect, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { track, startPresence } from "@/lib/analytics";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { SuspensionBanner } from "@/components/SuspensionBanner";
import { PreferencesProvider } from "@/hooks/usePreferences";
import { AutoTranslator } from "@/components/AutoTranslator";
import { ScrollToTop } from "@/components/ScrollToTop";
import { MarkdownFormattingToolbar } from "@/components/MarkdownFormattingToolbar";
import Index from "./pages/Index.tsx";

// Lazy-load every route except the landing page so each one ships in its
// own chunk. This keeps the initial bundle small for the homepage which is
// what most first-time visitors land on.
const ProcessPage = lazy(() => import("./pages/ProcessPage.tsx"));
const ProductsPage = lazy(() => import("./pages/ProductsPage.tsx"));
const BotsPage = lazy(() => import("./pages/BotsPage.tsx"));
const BotDashboard = lazy(() => import("./pages/BotDashboard.tsx"));
const Auth = lazy(() => import("./pages/Auth.tsx"));
const Admin = lazy(() => import("./pages/Admin.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const CheckoutReturn = lazy(() => import("./pages/CheckoutReturn.tsx"));
const CheckoutSetup = lazy(() => import("./pages/CheckoutSetup.tsx"));
const Terms = lazy(() => import("./pages/Terms.tsx"));
const MeetTheOwner = lazy(() => import("./pages/MeetTheOwner.tsx"));
const MeetTheTeam = lazy(() => import("./pages/MeetTheTeam.tsx"));
const Plugyxz = lazy(() => import("./pages/Plugyxz.tsx"));
const SupportIdeas = lazy(() => import("./pages/SupportIdeas.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const Verify = lazy(() => import("./pages/Verify.tsx"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: 1,
    },
  },
});

// Shown while a lazy route chunk downloads. Without this, Suspense renders
// nothing and the user sees a blank dark screen until the chunk arrives —
// which on a cold cache (e.g. the heavy bot-dashboard chunk) reads as "stuck".
const RouteFallback = () => (
  <div className="min-h-screen grid place-items-center" style={{ background: "#21272e" }}>
    <div className="flex flex-col items-center gap-5">
      <div
        aria-label="Loading"
        role="status"
        className="h-12 w-12 animate-spin rounded-full"
        style={{ border: "3px solid rgba(168,180,191,.16)", borderTopColor: "#C9DBE6" }}
      />
      <p className="text-sm font-medium" style={{ color: "#A8B4BF" }}>
        Loading Oversite…
      </p>
    </div>
  </div>
);

// Fires a page_view on every route change and keeps a presence ping going so
// the admin Overview can show live visitors + the funnel.
const AnalyticsTracker = () => {
  const location = useLocation();
  useEffect(() => {
    track("page_view", undefined, location.pathname);
  }, [location.pathname]);
  useEffect(() => startPresence(), []);
  return null;
};

// Catches any render/effect crash (e.g. a realtime or auth hiccup when a tab
// regains focus) and shows a recoverable slate screen instead of a black void.
// Without this, one thrown error anywhere in the tree unmounts the whole app.
class RouteErrorBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false };
  static getDerivedStateFromError() {
    return { crashed: true };
  }
  componentDidCatch(err: unknown) {
    console.error("App error boundary caught:", err);
  }
  render() {
    if (this.state.crashed) {
      return (
        <div
          className="min-h-screen grid place-items-center px-4"
          style={{ background: "#21272e", fontFamily: "'Manrope', system-ui, sans-serif" }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-8 md:p-10 text-center"
            style={{
              border: "1px solid rgba(168,180,191,.16)",
              background: "linear-gradient(180deg,rgba(46,54,63,.9),rgba(39,46,54,.94))",
              boxShadow: "0 34px 90px -34px rgba(0,0,0,.8)",
            }}
          >
            <h1 className="mb-2 text-xl font-extrabold" style={{ color: "#E8EEF3" }}>
              Something hiccuped
            </h1>
            <p className="mb-7 text-sm leading-relaxed" style={{ color: "#A8B4BF" }}>
              The page ran into an error. Reloading usually clears it right up — your data is safe.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex h-11 items-center justify-center rounded-xl px-6 text-sm font-bold"
              style={{ background: "#C9DBE6", color: "#1E242B", cursor: "pointer" }}
            >
              Reload the page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <PaymentTestModeBanner />
        <SuspensionBanner />
        <BrowserRouter>
          <PreferencesProvider>
            <ScrollToTop />
            <AnalyticsTracker />
            <AutoTranslator />
            <MarkdownFormattingToolbar />
            <RouteErrorBoundary>
            <Suspense fallback={<RouteFallback />}>
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
                <Route path="/support-ideas" element={<SupportIdeas />} />
                <Route path="/explore/owner" element={<MeetTheOwner />} />
                <Route path="/explore/plugyxz" element={<Plugyxz />} />
                <Route path="/verify" element={<Verify />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            </RouteErrorBoundary>
          </PreferencesProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
