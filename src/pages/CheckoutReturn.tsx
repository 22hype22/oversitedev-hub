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
import oversiteLogo from "@/assets/oversite-logo.png";
import containers from "@/assets/containers.webp";
import { track } from "@/lib/analytics";

// Self-contained "system page" shell (mountain backdrop + frosted slate glass).
// Inlined rather than shared so no extra file is required.
const OSSYS_CSS = `
.ossys{--os-heading:#E8EEF3;--os-body:#A8B4BF;--os-faint:#788591;--os-accent:#C9DBE6;--os-accent-ink:#1E242B;--os-hair:rgba(168,180,191,.16);position:relative;min-height:100vh;display:flex;flex-direction:column;overflow:hidden;color:var(--os-body);font-family:'Manrope',system-ui,-apple-system,sans-serif;background:radial-gradient(120% 80% at 50% 120%,rgba(201,219,230,.10),transparent 55%),linear-gradient(180deg,rgba(28,34,41,.58),rgba(20,25,31,.82)),var(--os-mtn,none) center 20%/cover no-repeat,#1e242b}
.ossys-top{position:relative;z-index:2;padding:22px 26px}
.ossys-top img{height:30px;width:auto;object-fit:contain}
.ossys-mid{position:relative;z-index:2;flex:1;display:grid;place-items:center;padding:16px 16px 64px}
.ossys-foot{position:relative;z-index:2;padding-bottom:22px;text-align:center;font-size:12px;color:var(--os-faint)}
.ossys-card{width:100%;border:1px solid var(--os-hair);border-radius:20px;background:linear-gradient(180deg,rgba(46,54,63,.72),rgba(39,46,54,.8));-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);box-shadow:0 34px 90px -34px rgba(0,0,0,.8);padding:38px 34px;text-align:center}
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
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<PurchasedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [botOrderId, setBotOrderId] = useState<string | null>(setupOrderId);
  const [showClose, setShowClose] = useState(false);
  const { isMember } = useMembership();

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

  const downloadable = files.filter((f) => f.url);
  const isBotOrder = !!botOrderId;

  useEffect(() => {
    if (!isBotOrder) return;
    const t = setTimeout(() => setShowClose(true), 5000);
    return () => clearTimeout(t);
  }, [isBotOrder]);

  return (
    <main className="ossys" style={{ ["--os-mtn" as any]: `url(${containers})` }}>
      <style>{OSSYS_CSS}</style>
      <div className="ossys-top">
        <Link to="/" aria-label="Oversite — home">
          <img src={oversiteLogo} alt="Oversite" />
        </Link>
      </div>
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
        <CheckCircle2 className="mx-auto h-14 w-14 mb-4" style={{ color: "#86d3a1" }} />
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--os-heading)" }}>
          Thanks for your order!
        </h1>
        <p className="mb-6" style={{ color: "var(--os-body)" }}>
          {comped
            ? "100% off — no charge. Your order is all set."
            : sessionId || setupOrderId
              ? "Your payment was received."
              : "No session information found."}
        </p>

        {/* Bot order — Discord-join gate then status-driven next-step */}
        {isBotOrder && botOrderId && (
          <DiscordJoinGate orderId={botOrderId} />
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
      <div className="ossys-foot">Order reference kept on file · Oversite</div>
    </main>
  );
}
