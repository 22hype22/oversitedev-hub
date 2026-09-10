import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Download, Loader2, UserPlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { useAuth } from "@/hooks/useAuth";
import { useMembership } from "@/hooks/useMembership";
import { UpgradeNotice } from "@/components/UpgradeNotice";
import { DiscordJoinGate } from "@/components/checkout/DiscordJoinGate";
// Real image asset instead of the old ~220KB base64-in-JS module (see
// SystemScreen.tsx) — shared with the dashboard so it's usually cached already.
import dashboardBg from "@/assets/containers.webp";
import { track } from "@/lib/analytics";
import { OrderTracker, OrderTransition, consumeOrderHandoff, type OrderStep } from "@/components/checkout/OrderTransition";
import { botBaseIcon } from "@/lib/botCatalog";

// Self-contained "system page" shell (mountain backdrop + frosted slate glass).
// Inlined rather than shared so no extra file is required.
const OSSYS_CSS = `
.ossys{--os-heading:#E8EEF3;--os-body:#A8B4BF;--os-faint:#788591;--os-accent:#C9DBE6;--os-accent-ink:#1E242B;--os-hair:rgba(168,180,191,.16);position:relative;min-height:100vh;display:flex;flex-direction:column;overflow:hidden;color:var(--os-body);font-family:'Manrope',system-ui,-apple-system,sans-serif;background:radial-gradient(130% 85% at 50% 118%,rgba(201,219,230,.14),transparent 55%),radial-gradient(95% 70% at 50% -15%,rgba(70,82,94,.55),transparent 60%),linear-gradient(180deg,#293038,#1e242b)}
.ossys-bg{position:fixed;inset:0;z-index:0;background-size:cover;background-position:center 22%;background-repeat:no-repeat}
.ossys-scrim{position:fixed;inset:0;z-index:0;background:linear-gradient(180deg,rgba(18,22,27,.55),rgba(18,22,27,.72) 55%,rgba(18,22,27,.86))}
.ossys-mid{position:relative;z-index:2;flex:1;display:grid;place-items:center;padding:64px 16px}
.ossys-foot{position:relative;z-index:2;padding-bottom:22px;text-align:center;font-size:12px;color:var(--os-faint)}
.ossys-foot a{color:var(--os-faint);text-decoration:none;transition:color .15s}
.ossys-foot a:hover{color:var(--os-heading)}
.ossys-foot .sep{margin:0 10px;opacity:.45}
.ossys-card{width:100%;border:1px solid var(--os-hair);border-radius:20px;background:linear-gradient(180deg,rgba(46,54,63,.72),rgba(39,46,54,.8));-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);box-shadow:0 34px 90px -34px rgba(0,0,0,.8);padding:38px 34px;text-align:center}
.ossys-green{position:fixed;inset:0;z-index:5;background:linear-gradient(180deg,#34D399,#2DBD87);pointer-events:none;opacity:1;transition:opacity 520ms cubic-bezier(.23,1,.32,1) 120ms}
.ossys-green.gone{opacity:0}
.ossys-bot{width:72px;height:72px;border-radius:22px;margin:0 auto 16px;display:grid;place-items:center;position:relative;background:linear-gradient(180deg,rgba(201,219,230,.22),rgba(201,219,230,.08));box-shadow:inset 0 1px 0 rgba(255,255,255,.22),0 20px 40px -20px rgba(0,0,0,.8);color:var(--os-heading)}
.ossys-bot img{width:100%;height:100%;border-radius:22px;object-fit:cover;display:block}
.ossys-bot i{position:absolute;right:-6px;bottom:-6px;width:26px;height:26px;border-radius:50%;background:#34D399;border:3px solid #293038;display:grid;place-items:center;color:#1E242B;transform:scale(0);transition:transform 300ms cubic-bezier(.34,1.56,.64,1) 700ms}
.ossys-bot i.on{transform:scale(1)}
.ossys-tag{font-size:13px;color:#34D399;font-weight:600;margin:6px 0 0}
`;

type PurchasedFile = {
  id: string;
  productName: string;
  fileName: string | null;
  url: string | null;
};

export default function CheckoutReturn() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get("session_id");
  const setupOrderId = searchParams.get("order");
  const comped = searchParams.get("comped") === "1";
  const robux = searchParams.get("robux") === "1";
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<PurchasedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [botOrderId, setBotOrderId] = useState<string | null>(setupOrderId);
  const [showClose, setShowClose] = useState(false);
  const { isMember } = useMembership();
  // Opened on green from the builder or the Robux page: fade the green away
  // so the two pages read as one move.
  const [handoff] = useState(() => consumeOrderHandoff());
  const [greenGone, setGreenGone] = useState(false);
  useEffect(() => {
    if (!handoff) return;
    const t = setTimeout(() => setGreenGone(true), 60);
    return () => clearTimeout(t);
  }, [handoff]);
  // The bot this order is for, and where it is in the pipeline.
  const [bot, setBot] = useState<{ name: string; base: string | null; icon: string | null } | null>(null);
  const [step, setStep] = useState<OrderStep>("placed");
  const [declined, setDeclined] = useState<string | null>(null);
  // Where the order is, kept fresh: Building once the build has started,
  // Live only once the bot has actually deployed and is online, which is the
  // moment it is ready to use in the dashboard. Polls until then.
  useEffect(() => {
    if (!user || !botOrderId) return;
    let cancelled = false;
    let timer = 0;
    const read = async () => {
      const { data } = await (supabase as any)
        .from("bot_orders")
        .select("bot_name, base, icon_url, status, deployment_status")
        .eq("id", botOrderId)
        .maybeSingle();
      if (cancelled || !data) return;
      setBot({ name: data.bot_name ?? "", base: data.base ?? null, icon: data.icon_url ?? null });
      const st = String(data.status ?? "");
      const dep = String(data.deployment_status ?? "");
      let live = st === "live";
      if (!live && dep === "deployed") {
        const { data: health } = await (supabase as any).rpc("get_bot_health", { _bot_id: botOrderId });
        if (cancelled) return;
        const h = (health ?? {}) as { effective_status?: string; status?: string };
        live = (h.effective_status ?? h.status) === "online";
      }
      if (live) {
        setStep("live");
        return;
      }
      if (["ready", "building", "deploying"].includes(st) || dep === "deploying") setStep("building");
      timer = window.setTimeout(read, 4000);
    };
    void read();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [user, botOrderId]);

  useEffect(() => {
    if (!sessionId && !setupOrderId) {
      setLoading(false);
      return;
    }
    const load = async () => {
      try {
        if (sessionId) {
          const { data, error } = await supabase.functions.invoke(
            "get-purchase-files",
            {
              body: { sessionId, environment: getStripeEnvironment() },
            },
          );
          if (error) throw new Error(error.message);
          if (data?.error) throw new Error(data.error);
          setFiles(data?.files || []);
          track("purchased", { session_id: sessionId });
        }

        // Resolve the bot order tied to this checkout (if any). For a charge
        // session we look up by stripe_session_id; for a SetupIntent return
        // the order id is passed in the URL.
        if (user && !botOrderId && sessionId) {
          const { data: orders } = await (supabase as any)
            .from("bot_orders")
            .select("id")
            .eq("user_id", user.id)
            .eq("stripe_session_id", sessionId)
            .is("parent_order_id", null)
            .order("created_at", { ascending: false })
            .limit(1);
          if (orders && orders.length > 0) setBotOrderId(orders[0].id);
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [sessionId, setupOrderId, user, botOrderId]);

  useEffect(() => {
    if (step !== "live") return;
    const t = window.setTimeout(() => navigate("/bot-dashboard"), 1800);
    return () => window.clearTimeout(t);
  }, [step, navigate]);

  const downloadable = files.filter((f) => f.url);
  const isBotOrder = !!botOrderId;

  useEffect(() => {
    if (!isBotOrder) return;
    const t = setTimeout(() => setShowClose(true), 5000);
    return () => clearTimeout(t);
  }, [isBotOrder]);

  return (
    <main className="ossys">
      <style>{OSSYS_CSS}</style>
      {/* Mountain backdrop (base64-inlined) + dark scrim, card centered above */}
      <div className="ossys-bg" style={{ backgroundImage: `url(${dashboardBg})` }} aria-hidden />
      <div className="ossys-scrim" />
      {handoff && <div className={`ossys-green ${greenGone ? "gone" : ""}`} aria-hidden />}
      {declined && (
        <OrderTransition
          tone="fail"
          active
          reason={declined}
          hint="Update your card from the dashboard and we will try again the moment you do."
          actionLabel="Open dashboard"
          onAction={() => navigate("/bot-dashboard")}
        />
      )}
      <div className="ossys-mid">
       <div style={{ width: "100%", maxWidth: 560 }}>
      <div className="ossys-card relative">
        {isBotOrder && showClose && (
          <button
            type="button"
            aria-label="Close"
            onClick={() => navigate("/")}
            className="absolute top-3 right-3 p-1.5 rounded-full transition-colors animate-in fade-in"
            style={{ color: "var(--os-faint)" }}
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {isBotOrder && bot ? (
          <>
            <div className="ossys-bot">
              {bot.icon && /^(https?:|data:)/.test(bot.icon) ? (
                <img src={bot.icon} alt="" />
              ) : (
                (() => {
                  const Icon = botBaseIcon(bot.base);
                  return <Icon size={32} strokeWidth={1.6} />;
                })()
              )}
              <i className={greenGone || !handoff ? "on" : ""}>
                <CheckCircle2 size={14} strokeWidth={3} />
              </i>
            </div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--os-heading)", letterSpacing: "-0.02em" }}>
              {(bot.name || "Your bot").trim()} is yours.
            </h1>
            <div className="ossys-tag">
              {comped ? "Order placed, no charge" : robux ? "Order placed, paid with Robux" : "Order placed"}
            </div>
            <div style={{ margin: "22px auto 26px", maxWidth: 380 }}>
              <OrderTracker step={step} />
            </div>
          </>
        ) : (
          <>
            <CheckCircle2 className="mx-auto h-14 w-14 mb-4" style={{ color: "#86d3a1" }} />
            <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--os-heading)" }}>
              Thanks for your order!
            </h1>
            <p className="mb-6" style={{ color: "var(--os-body)" }}>
              {comped
                ? "100% off — no charge. Your order is all set."
                : robux
                  ? "Your Robux payment was verified."
                  : sessionId || setupOrderId
                  ? "Your payment was received."
                  : "No session information found."}
            </p>
          </>
        )}

        {/* Bot order — Discord-join gate then status-driven next-step */}
        {isBotOrder && botOrderId && (
          <DiscordJoinGate
            orderId={botOrderId}
            onPhase={(p) => {
              if (p === "building") setStep("building");
            }}
            onDeclined={(reason) => setDeclined(reason)}
          />
        )}


        {/* File downloads (Roblox products) */}
        {sessionId && !isBotOrder && (
          <div className="mb-6 text-left">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Your downloads
            </h2>
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Preparing your files…
              </div>
            ) : error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : downloadable.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No downloadable files for this order.
              </p>
            ) : (
              <ul className="space-y-2">
                {downloadable.map((f) => (
                  <li key={f.id}>
                    <a
                      href={f.url!}
                      download={f.fileName ?? undefined}
                      className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-border bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Download className="h-4 w-4 shrink-0 text-primary" />
                        <div className="min-w-0">
                          <div className="font-medium truncate">{f.productName}</div>
                          {f.fileName && (
                            <div className="text-xs text-muted-foreground truncate">
                              {f.fileName}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">Download</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {!user && downloadable.length > 0 && (
          <div className="mb-6 rounded-lg border border-primary/30 bg-primary/5 p-4 text-left">
            <div className="flex items-start gap-3">
              <UserPlus className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Save these to your account</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Sign up with the same email you used at checkout to access your purchases anytime.
                </p>
                <Button asChild size="sm" variant="hero" className="mt-3">
                  <Link to="/auth">Create an account</Link>
                </Button>
              </div>
            </div>
          </div>
        )}

        {!isMember && downloadable.length > 0 && <UpgradeNotice className="mb-6" />}

        {sessionId && (
          <p className="text-xs text-muted-foreground mb-6 break-all">Ref: {sessionId}</p>
        )}

        {!isBotOrder && (
          <div className="flex gap-3 justify-center">
            <Button asChild variant="outlineGlow">
              <Link to="/">Back home</Link>
            </Button>
            <Button asChild variant="hero">
              <Link to="/products">Keep shopping</Link>
            </Button>
          </div>
        )}
      </div>
       </div>
      </div>
      {/* Legal footer — each opens the tabbed /terms page in a new tab */}
      <div className="ossys-foot">
        <a href="/legal/terms-of-use" target="_blank" rel="noopener noreferrer">Terms of Use</a>
        <span className="sep">·</span>
        <a href="/legal/privacy-policy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
        <span className="sep">·</span>
        <a href="/legal/sales-and-refunds" target="_blank" rel="noopener noreferrer">Sales &amp; Refunds</a>
      </div>
    </main>
  );
}
