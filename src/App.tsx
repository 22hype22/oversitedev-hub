import { lazy, Suspense, useEffect, Component, type ErrorInfo, type ReactNode } from "react";
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
import { AlertTriangle } from "lucide-react";
import containers from "@/assets/containers.webp";
import Index from "./pages/Index.tsx";

// ── App-wide error boundary (inlined so no separate file is required) ──
// Catches render/runtime errors in the route tree and shows the branded
// mountain backdrop + a single frosted error card (no logo / no footer). The
// real error message is surfaced in a faint line so a crash can be diagnosed
// from a screenshot instead of only the console.
const OSSYS_ERR_CSS = `
.oserr{--os-heading:#E8EEF3;--os-body:#A8B4BF;--os-faint:#788591;--os-accent:#C9DBE6;--os-accent-ink:#1E242B;--os-hair:rgba(168,180,191,.16);position:relative;min-height:100vh;display:grid;place-items:center;overflow:hidden;padding:24px 16px;color:var(--os-body);font-family:'Manrope',system-ui,-apple-system,sans-serif;background:radial-gradient(120% 80% at 50% 120%,rgba(201,219,230,.10),transparent 55%),linear-gradient(180deg,rgba(28,34,41,.58),rgba(20,25,31,.82)),var(--os-mtn,none) center 20%/cover no-repeat,#1e242b}
.oserr-card{position:relative;z-index:2;width:100%;max-width:460px;border:1px solid var(--os-hair);border-radius:20px;background:linear-gradient(180deg,rgba(46,54,63,.72),rgba(39,46,54,.8));-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);box-shadow:0 34px 90px -34px rgba(0,0,0,.8);padding:38px 34px;text-align:center}
.oserr-card h1{color:var(--os-heading);font-weight:800;letter-spacing:-.01em;margin:0}
.oserr-card p{color:var(--os-body)}
.oserr-badge{margin:0 auto 22px;width:64px;height:64px;border-radius:18px;display:grid;place-items:center;border:1px solid rgba(233,139,139,.3);background:rgba(233,139,139,.12);color:#e98b8b}
.oserr-accent{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:46px;padding:0 22px;border-radius:12px;font-weight:700;font-size:14.5px;border:0;cursor:pointer;text-decoration:none;background:var(--os-accent);color:var(--os-accent-ink);transition:filter .18s ease,transform .18s ease}
.oserr-accent:hover{filter:brightness(1.06);transform:translateY(-1px)}
.oserr-ghost{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:46px;padding:0 22px;border-radius:12px;font-weight:700;font-size:14.5px;cursor:pointer;text-decoration:none;background:transparent;color:var(--os-heading);border:1px solid var(--os-hair)}
.oserr-ghost:hover{background:rgba(201,219,230,.08)}
.oserr-detail{margin-top:22px;padding-top:16px;border-top:1px solid var(--os-hair);font-family:'Space Mono',ui-monospace,monospace;font-size:11.5px;line-height:1.5;color:var(--os-faint);word-break:break-word;text-align:left}
`;

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; msg: string }> {
  state = { hasError: false, msg: "" };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, msg: error?.message || String(error) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("App error boundary caught an error:", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main className="oserr" style={{ ["--os-mtn" as any]: `url(${containers})` }}>
        <style>{OSSYS_ERR_CSS}</style>
        <div className="oserr-card">
          <div className="oserr-badge">
            <AlertTriangle />
          </div>
          <h1 style={{ fontSize: 22, marginBottom: 10 }}>This page ran into an issue</h1>
          <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 28 }}>
            Something went wrong while loading this page. Reloading usually clears it — if it
            keeps happening, head back home and try again.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <a className="oserr-ghost" href="/">
              Return home
            </a>
            <button className="oserr-accent" onClick={() => window.location.reload()}>
              Reload page
            </button>
          </div>
          {this.state.msg && <div className="oserr-detail">{this.state.msg}</div>}
        </div>
      </main>
    );
  }
}

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
            <ErrorBoundary>
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
            </ErrorBoundary>
          </PreferencesProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
