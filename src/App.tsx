import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { TriangleAlert } from "lucide-react";
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
const ErlcDesign = lazy(() => import("./pages/ErlcDesign.tsx"));
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
// Ghost loading: neutral skeleton blocks in the rough shape of a page — top
// bar, heading, card grid — with a soft shimmer sweeping across them. Pure
// CSS, respects prefers-reduced-motion (static blocks, no sweep).
const RouteFallback = () => (
  <div
    role="status"
    aria-label="Loading"
    className="min-h-screen"
    style={{ background: "linear-gradient(180deg, #232930, #1a1f25)" }}
  >
    <style>{`
      @keyframes os-ghost{0%{background-position:200% 0}100%{background-position:-200% 0}}
      .os-ghost{border-radius:10px;background:linear-gradient(90deg,rgba(201,219,230,.07) 25%,rgba(201,219,230,.16) 50%,rgba(201,219,230,.07) 75%);background-size:200% 100%;animation:os-ghost 1.5s ease-in-out infinite}
      @media (prefers-reduced-motion: reduce){.os-ghost{animation:none;background:rgba(201,219,230,.09)}}
    `}</style>
    {/* Top bar */}
    <div
      className="flex items-center justify-between px-6 py-4"
      style={{ borderBottom: "1px solid rgba(168,180,191,.08)" }}
    >
      <div className="os-ghost" style={{ width: 120, height: 28 }} />
      <div className="flex items-center gap-3">
        <div className="os-ghost hidden sm:block" style={{ width: 72, height: 28 }} />
        <div className="os-ghost hidden sm:block" style={{ width: 72, height: 28 }} />
        <div className="os-ghost" style={{ width: 96, height: 32, borderRadius: 999 }} />
      </div>
    </div>
    {/* Page body */}
    <div className="mx-auto w-full max-w-5xl px-6 pt-12">
      <div className="os-ghost" style={{ width: "42%", height: 36, marginBottom: 14 }} />
      <div className="os-ghost" style={{ width: "68%", height: 16, marginBottom: 8 }} />
      <div className="os-ghost" style={{ width: "55%", height: 16, marginBottom: 36 }} />
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-2xl p-4"
            style={{ border: "1px solid rgba(168,180,191,.10)", background: "rgba(46,54,63,.35)" }}
          >
            <div className="os-ghost" style={{ width: 40, height: 40, borderRadius: 12, marginBottom: 14 }} />
            <div className="os-ghost" style={{ width: "70%", height: 14, marginBottom: 8 }} />
            <div className="os-ghost" style={{ width: "90%", height: 12 }} />
          </div>
        ))}
      </div>
      <div className="os-ghost" style={{ width: "100%", height: 180, marginTop: 24, borderRadius: 16 }} />
    </div>
  </div>
);

// Warm the hot route chunks once the browser goes idle after first paint, so
// navigating to them later is instant instead of showing the ghost skeleton.
// Auth + account Dashboard are small and always warmed; the heavy bot-dashboard
// chunk is only warmed for visitors who actually have a session (a Supabase
// auth token in storage) since everyone else will never open it.
const PrefetchRoutes = () => {
  useEffect(() => {
    const warm = () => {
      import("./pages/Auth.tsx");
      import("./pages/Dashboard.tsx");
      try {
        const signedIn = Object.keys(localStorage).some(
          (k) => k.startsWith("sb-") && k.includes("auth-token"),
        );
        if (signedIn) import("./pages/BotDashboard.tsx");
      } catch {
        /* storage blocked — skip the heavy chunk */
      }
    };
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(warm, { timeout: 5000 });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = setTimeout(warm, 2500);
    return () => clearTimeout(t);
  }, []);
  return null;
};

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
            <div
              className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl"
              style={{
                border: "1px solid rgba(233,139,139,.3)",
                background: "rgba(233,139,139,.12)",
                color: "#e98b8b",
              }}
            >
              <TriangleAlert className="h-8 w-8" />
            </div>
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
            <PrefetchRoutes />
            <AutoTranslator />
            <MarkdownFormattingToolbar />
            <Suspense fallback={<RouteFallback />}>
              <RouteErrorBoundary>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/process" element={<ProcessPage />} />
                <Route path="/erlc-design" element={<ErlcDesign />} />
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
