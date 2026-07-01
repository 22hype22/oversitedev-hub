import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
// Popup callback for the "Link Discord" flow started from the bot builder.
// Discord redirects here with ?code=&state=. We exchange the code, tell the
// window that opened us the result, then close. Kept inline (rather than a
// separate page file) so there's no extra file to create on deploy.
const DISCORD_LINK_STATE_KEY = "oswire_discord_link_state";
function DiscordLinkedPopup() {
  const [msg, setMsg] = useState("Linking your Discord…");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const returnedState = params.get("state");
    const expected = localStorage.getItem(DISCORD_LINK_STATE_KEY);
    localStorage.removeItem(DISCORD_LINK_STATE_KEY);

    const finish = (payload: Record<string, unknown>) => {
      try {
        window.opener?.postMessage(
          { type: "oswire-discord-linked", ...payload },
          window.location.origin,
        );
      } catch {
        /* opener gone — nothing to do */
      }
      setTimeout(() => window.close(), 200);
    };

    if (!code) {
      setMsg("Discord link cancelled — you can close this window.");
      finish({ ok: false, error: "cancelled" });
      return;
    }
    if (!expected || expected !== returnedState) {
      setMsg("This link expired — please try again.");
      finish({ ok: false, error: "state_mismatch" });
      return;
    }

    (async () => {
      const redirect_uri = `${window.location.origin}/discord/linked`;
      const { data, error } = await supabase.functions.invoke("discord-link", {
        body: { action: "exchange_code", code, redirect_uri },
      });
      if (error || !data?.ok) {
        setMsg("Couldn't link Discord — you can close this window.");
        finish({ ok: false, error: data?.error || error?.message || "exchange_failed" });
        return;
      }
      setMsg(`Linked @${data.discord_username || data.discord_user_id}! Closing…`);
      finish({
        ok: true,
        discord_user_id: data.discord_user_id,
        discord_username: data.discord_username,
      });
    })();
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#0b0b0f",
        color: "#e6e6ee",
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: 24,
        textAlign: "center",
      }}
    >
      <p style={{ fontSize: 15, maxWidth: 360, lineHeight: 1.5 }}>{msg}</p>
    </div>
  );
}

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
  <div className="min-h-screen bg-background grid place-items-center">
    <div
      aria-label="Loading"
      role="status"
      className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/25 border-t-muted-foreground/80"
    />
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

// Catches any render/effect crash (e.g. a realtime hiccup on tab return) and
// shows a recoverable screen instead of a black void.
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
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            background: "#0b0b0f",
            color: "#e6e6ee",
            fontFamily: "system-ui, -apple-system, sans-serif",
            padding: 24,
            textAlign: "center",
          }}
        >
          <div style={{ maxWidth: 360 }}>
            <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Something hiccuped.</p>
            <p style={{ fontSize: 13, opacity: 0.7, lineHeight: 1.5, marginBottom: 18 }}>
              The page ran into an error. Reloading usually clears it.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: "#6ea8fe",
                color: "#0b0b0f",
                border: 0,
                borderRadius: 10,
                padding: "10px 22px",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Reload
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
            <Suspense fallback={<RouteFallback />}>
              <RouteErrorBoundary>
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
                <Route path="/discord/linked" element={<DiscordLinkedPopup />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              </RouteErrorBoundary>
            </Suspense>
          </PreferencesProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
