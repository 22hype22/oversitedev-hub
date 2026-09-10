import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Copy, ExternalLink, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatRobux } from "@/hooks/useRobuxCheckout";
import containers from "@/assets/containers.webp";
import { OrderTransition, markOrderHandoff, originOf } from "@/components/checkout/OrderTransition";

// Same self-contained "system page" shell as /checkout/setup so the two
// payment pages feel like one flow.
const OSSYS_CSS = `
.ossys{--os-heading:#E8EEF3;--os-body:#A8B4BF;--os-faint:#788591;--os-accent:#C9DBE6;--os-accent-ink:#1E242B;--os-hair:rgba(168,180,191,.16);position:relative;min-height:100vh;display:flex;flex-direction:column;overflow:hidden;color:var(--os-body);font-family:'Manrope',system-ui,-apple-system,sans-serif;background:radial-gradient(120% 80% at 50% 120%,rgba(201,219,230,.10),transparent 55%),linear-gradient(180deg,rgba(28,34,41,.58),rgba(20,25,31,.82)),var(--os-mtn,none) center 20%/cover no-repeat,#1e242b}
.ossys-mid{position:relative;z-index:2;flex:1;display:grid;place-items:center;padding:16px 16px 64px}
.ossys-foot{position:relative;z-index:2;padding-bottom:22px;text-align:center;font-size:12px;color:var(--os-faint)}
.ossys-card{width:100%;border:1px solid var(--os-hair);border-radius:20px;background:linear-gradient(180deg,rgba(46,54,63,.72),rgba(39,46,54,.8));-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);box-shadow:0 34px 90px -34px rgba(0,0,0,.8);padding:38px 34px}
.ossys-card h1{color:var(--os-heading);font-weight:800;letter-spacing:-.01em;margin:0}
.ossys-card p{color:var(--os-body)}
.ossys-accent{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:46px;padding:0 22px;border-radius:12px;font-weight:700;font-size:14.5px;border:0;cursor:pointer;text-decoration:none;background:var(--os-accent);color:var(--os-accent-ink);transition:filter .18s ease,transform .18s ease}
.ossys-accent:hover{filter:brightness(1.06)}
.ossys-accent:disabled{opacity:.6;cursor:default}
.ossys-ghost{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:46px;padding:0 18px;border-radius:12px;font-weight:700;font-size:14px;cursor:pointer;text-decoration:none;background:rgba(232,238,243,.05);border:1px solid var(--os-hair);color:var(--os-heading);transition:background .15s}
.ossys-ghost:hover{background:rgba(232,238,243,.09)}
.ossys-pill{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:700;padding:6px 12px;border-radius:999px;margin-bottom:18px;background:rgba(201,219,230,.12);border:1px solid rgba(201,219,230,.28);color:var(--os-accent)}
.ossys-box{border:1px solid var(--os-hair);border-radius:12px;background:rgba(232,238,243,.045);padding:14px 16px;font-size:13px;line-height:1.6}
.ossys-mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;word-break:break-all;color:var(--os-heading)}
.ossys-steps{margin:0;padding-left:18px;color:var(--os-body)}
.ossys-steps li{margin:4px 0}
.ossys-link{color:var(--os-faint);font-size:12px;background:none;border:0;cursor:pointer;text-decoration:underline;display:block;margin:14px auto 0}
.ossys-acct{display:flex;align-items:center;gap:12px;border:1px solid var(--os-hair);border-radius:12px;background:rgba(232,238,243,.045);padding:12px 14px;margin-bottom:16px}
.ossys-acct img{width:40px;height:40px;border-radius:10px;background:rgba(18,22,27,.5);flex:none}
.ossys-acct-tile{width:40px;height:40px;border-radius:10px;flex:none;display:grid;place-items:center;background:rgba(201,219,230,.14);border:1px solid rgba(201,219,230,.25);color:var(--os-accent);font-weight:800;font-size:16px}
.ossys-acct .n{color:var(--os-heading);font-weight:700;font-size:14px}
.ossys-acct .s{font-size:12px;color:var(--os-faint);margin-top:2px}
.ossys-kind{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px}
.ossys-kind button{text-align:left;border-radius:12px;border:1px solid var(--os-hair);background:rgba(18,22,27,.35);padding:12px 12px 11px;cursor:pointer;color:var(--os-body);transition:border-color .15s,background .15s}
.ossys-kind button:hover{border-color:rgba(201,219,230,.45)}
.ossys-kind button.on{border-color:var(--os-accent);background:rgba(201,219,230,.10)}
.ossys-kind .t{display:flex;align-items:center;justify-content:space-between;color:var(--os-heading);font-weight:700;font-size:13.5px}
.ossys-kind .d{font-size:11.5px;line-height:1.45;color:var(--os-faint);margin-top:4px}
@media (max-width:420px){.ossys-kind{grid-template-columns:1fr}}
`;

type AccountKind = "standard" | "select";

type Summary = {
  paid: boolean;
  status: string;
  botName: string | null;
  base?: string | null;
  iconUrl?: string | null;
  totalUsd: number;
  robux: number;
  itemKind: "gamepass" | "shirt" | "devproduct" | null;
  itemId: string | null;
  itemUrl: string | null;
  itemName: string | null;
  robloxUsername: string | null;
  enabled?: boolean;
  linked?: { robloxUserId: number | null; robloxUsername: string | null; robloxAvatarUrl?: string | null; accountKind: AccountKind | null };
};

type Step = "loading" | "link" | "kind" | "purchase" | "done" | "error";

async function callRobux(action: string, orderId: string, extra: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("robux-order", {
    body: { action, orderId, ...extra },
  });
  if (data?.error) throw new Error(String(data.error));
  if (error) {
    let message = error.message || "Something went wrong.";
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const payload = await ctx.json();
        if (payload?.error) message = String(payload.error);
      } catch {
        /* keep the generic message */
      }
    }
    throw new Error(message);
  }
  return data as Summary & { ok?: boolean; success?: boolean };
}

// The linked account's headshot, as the server looked it up. If Roblox has
// none, a tile with the first letter stands in.
function Headshot({ url, username }: { url: string | null | undefined; username: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  if (url && !failed) return <img src={url} alt="" onError={() => setFailed(true)} />;
  return <span className="ossys-acct-tile" aria-hidden>{(username || "?").slice(0, 1).toUpperCase()}</span>;
}

export default function CheckoutRobux() {
  const [params] = useSearchParams();
  const orderId = params.get("order") || "";
  const justLinked = params.get("linked") === "1";
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [step, setStep] = useState<Step>("loading");
  const [errorText, setErrorText] = useState<string>("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [kind, setKind] = useState<AccountKind>("standard");
  const [busy, setBusy] = useState(false);
  // On verify the screen fills green and hands off to the thank-you page.
  // A verification that never lands fills red with the reason instead.
  const [goGreen, setGoGreen] = useState(false);
  const [failReason, setFailReason] = useState<string | null>(null);
  const verifyBtn = useRef<HTMLButtonElement>(null);
  const [fillOrigin, setFillOrigin] = useState<{ x: number; y: number } | null>(null);

  const finish = (id: string) => {
    markOrderHandoff();
    navigate(`/checkout/return?order=${id}&robux=1`);
  };

  const linked = summary?.linked && summary.linked.robloxUserId ? summary.linked : null;

  // Load where this order is: not linked yet, linked, item ready, or paid.
  useEffect(() => {
    if (!orderId) {
      setErrorText("No order was given. Go back to the builder and place the order again.");
      setStep("error");
      return;
    }
    if (authLoading) return;
    if (!user) {
      setErrorText("Sign in with the account that placed the order to keep going.");
      setStep("error");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const s = await callRobux("status", orderId);
        if (cancelled) return;
        setSummary(s);
        if (s.paid) {
          setStep("done");
          return;
        }
        if (s.enabled === false) {
          setErrorText("Robux checkout is turned off right now. Go back and pay by card instead.");
          setStep("error");
          return;
        }
        if (s.linked?.accountKind) setKind(s.linked.accountKind);
        if (!s.linked?.robloxUserId) {
          setStep("link");
        } else if (s.itemKind && s.itemUrl && !justLinked) {
          setStep("purchase");
        } else {
          setStep("kind");
        }
      } catch (e) {
        if (cancelled) return;
        setErrorText(e instanceof Error ? e.message : "Couldn't load this order.");
        setStep("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, user, authLoading, justLinked]);

  // Sends the buyer to Roblox to sign in; Roblox brings them straight back
  // here with the account attached.
  const link = async () => {
    setBusy(true);
    try {
      const returnTo = `${window.location.origin}/checkout/robux?order=${encodeURIComponent(orderId)}`;
      const { data, error } = await supabase.functions.invoke("roblox-verify", {
        body: { action: "site_start", return_to: returnTo },
      });
      const url = (data as { url?: string; error?: string } | null)?.url;
      if (error || !url) {
        throw new Error((data as { error?: string } | null)?.error || error?.message || "Couldn't start the Roblox login.");
      }
      window.location.href = url;
    } catch (e) {
      toast.error("Couldn't open Roblox", { description: e instanceof Error ? e.message : "Please try again." });
      setBusy(false);
    }
  };

  const start = async () => {
    setBusy(true);
    try {
      const s = await callRobux("start", orderId, { kind });
      setSummary(s);
      setStep(s.paid ? "done" : "purchase");
    } catch (e) {
      toast.error("Couldn't set up the Robux payment", {
        description: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  // Roblox can take a little while to record the sale, so check a few times
  // before asking the customer to try again.
  const verify = async () => {
    setBusy(true);
    const MAX_ATTEMPTS = 5;
    const DELAY_MS = 4000;
    try {
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        let s: Awaited<ReturnType<typeof callRobux>>;
        try {
          s = await callRobux("verify", orderId);
        } catch (e) {
          setFillOrigin(originOf(verifyBtn.current));
          setFailReason(e instanceof Error ? e.message : "We couldn't verify the purchase. Please try again.");
          return;
        }
        if (s.success || s.paid) {
          setSummary(s);
          setFillOrigin(originOf(verifyBtn.current));
          void import("@/pages/CheckoutReturn");
          setStep("done");
          setGoGreen(true);
          return;
        }
        if (attempt === MAX_ATTEMPTS - 1) {
          setFillOrigin(originOf(verifyBtn.current));
          setFailReason(
            `Roblox has not recorded that purchase on ${linked?.robloxUsername || "your account"} yet. If you just bought it, give it a minute and press I've purchased again. If you have not bought it, nothing was charged.`,
          );
          return;
        }
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    if (!summary?.itemUrl) return;
    try {
      await navigator.clipboard.writeText(summary.itemUrl);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy the link", { description: "Select the link and copy it by hand." });
    }
  };

  const robuxLabel = summary ? formatRobux(summary.robux) : "";
  const isShirt = summary?.itemKind === "shirt";
  const isProduct = summary?.itemKind === "devproduct";
  const itemWord = isShirt ? "shirt" : isProduct ? "product" : "gamepass";

  const accountCard = linked ? (
    <div className="ossys-acct">
      <Headshot url={linked.robloxAvatarUrl} username={linked.robloxUsername ?? ""} />
      <div>
        <div className="n">{linked.robloxUsername}</div>
        <div className="s">Linked Roblox account</div>
      </div>
    </div>
  ) : null;

  return (
    <main className="ossys" style={{ ["--os-mtn" as any]: `url(${containers})` }}>
      <style>{OSSYS_CSS}</style>
      {goGreen && <OrderTransition tone="go" active origin={fillOrigin} onFilled={() => finish(orderId)} />}
      {failReason && (
        <OrderTransition
          tone="fail"
          active
          origin={fillOrigin}
          reason={failReason}
          actionLabel={`Back to the ${itemWord}`}
          onAction={() => setFailReason(null)}
        />
      )}
      <div className="ossys-mid">
        <div style={{ width: "100%", maxWidth: 480 }}>
          <div className="ossys-card">
            {step === "loading" && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
                <Loader2 size={16} className="animate-spin" /> Loading your order…
              </div>
            )}

            {step === "error" && (
              <>
                <h1 style={{ fontSize: 22, marginBottom: 8 }}>Can't continue</h1>
                <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 20 }}>{errorText}</p>
                <button type="button" className="ossys-ghost" onClick={() => navigate("/")}>
                  Back to the site
                </button>
              </>
            )}

            {step === "link" && summary && (
              <>
                <h1 style={{ fontSize: 24, marginBottom: 8 }}>
                  {robuxLabel} for {summary.botName || "your bot"}
                </h1>
                <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 20 }}>
                  ${summary.totalUsd.toFixed(2)} plus 30 percent for Roblox's cut. Sign in with the Roblox
                  account that will pay, so we can match the sale to this order.
                </p>
                <button type="button" className="ossys-accent" style={{ width: "100%" }} onClick={link} disabled={busy}>
                  {busy ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Opening Roblox…
                    </>
                  ) : (
                    <>
                      Link my Roblox account <ExternalLink size={15} />
                    </>
                  )}
                </button>
                <p style={{ fontSize: 12, lineHeight: 1.6, textAlign: "center", color: "var(--os-faint)", marginTop: 14 }}>
                  Roblox only tells us your username and id. Nothing is charged until you buy on Roblox.
                </p>
              </>
            )}

            {step === "kind" && summary && linked && (
              <>
                <h1 style={{ fontSize: 24, marginBottom: 8 }}>
                  {robuxLabel} for {summary.botName || "your bot"}
                </h1>
                <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 16 }}>
                  Which kind of Roblox account is this? It decides how you pay.
                </p>
                {accountCard}
                <div className="ossys-kind">
                  {([
                    { id: "standard", label: "Standard", desc: "Age 16 and up. You buy a product in our Payment experience." },
                    { id: "select", label: "Roblox Select", desc: "Age 9 to 15. You buy a shirt from our group store." },
                  ] as const).map((opt) => (
                    <button key={opt.id} type="button" className={kind === opt.id ? "on" : ""} onClick={() => setKind(opt.id)}>
                      <div className="t">
                        {opt.label}
                        {kind === opt.id && <Check size={13} style={{ color: "var(--os-accent)" }} />}
                      </div>
                      <div className="d">{opt.desc}</div>
                    </button>
                  ))}
                </div>
                <button type="button" className="ossys-accent" style={{ width: "100%" }} onClick={start} disabled={busy}>
                  {busy ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Setting up your {kind === "select" ? "shirt" : "product"}…
                    </>
                  ) : (
                    <>
                      Continue <ExternalLink size={15} />
                    </>
                  )}
                </button>
                <button type="button" className="ossys-link" onClick={link} disabled={busy}>
                  Not your account? Link a different one
                </button>
              </>
            )}

            {step === "purchase" && summary && (
              <>
                <h1 style={{ fontSize: 24, marginBottom: 8 }}>
                  {isShirt ? "Buy the shirt on Roblox" : isProduct ? "Buy the product on Roblox" : "Buy the gamepass on Roblox"}
                </h1>
                <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 16 }}>
                  Buy it for <strong style={{ color: "var(--os-heading)" }}>{robuxLabel}</strong> as{" "}
                  <strong style={{ color: "var(--os-heading)" }}>{linked?.robloxUsername || summary.robloxUsername}</strong>,
                  then come back here and press "I've purchased".
                </p>
                <div className="ossys-box" style={{ marginBottom: 12 }}>
                  <ol className="ossys-steps">
                    <li>Open the link below.</li>
                    {isProduct ? (
                      <li>
                        On the Store tab, buy <strong style={{ color: "var(--os-heading)" }}>{summary.itemName}</strong> for {robuxLabel}.
                      </li>
                    ) : (
                      <li>Buy the {itemWord} on Roblox for {robuxLabel}.</li>
                    )}
                    <li>Give Roblox a few seconds to record the sale.</li>
                    <li>Press "I've purchased" and we confirm it.</li>
                  </ol>
                </div>
                <div className="ossys-box ossys-mono" style={{ marginBottom: 16 }}>
                  {summary.itemUrl}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                  <button type="button" className="ossys-ghost" onClick={copyLink}>
                    <Copy size={14} /> Copy link
                  </button>
                  <a className="ossys-ghost" href={summary.itemUrl ?? "#"} target="_blank" rel="noopener noreferrer">
                    <ExternalLink size={14} /> Open link
                  </a>
                </div>
                <button
                  ref={verifyBtn}
                  type="button"
                  className="ossys-accent"
                  style={{ width: "100%" }}
                  onClick={verify}
                  disabled={busy}
                >
                  {busy ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Checking with Roblox…
                    </>
                  ) : (
                    "I've purchased"
                  )}
                </button>
                <button type="button" className="ossys-link" onClick={() => setStep("kind")} disabled={busy}>
                  Wrong account or account type? Change it
                </button>
              </>
            )}

            {step === "done" && summary && (
              <>
                <h1 style={{ fontSize: 24, marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
                  <CheckCircle2 size={22} style={{ color: "#86d3a1" }} /> Payment verified
                </h1>
                <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 20 }}>
                  We matched your {robuxLabel} {itemWord} purchase to this order.
                </p>
                <button type="button" className="ossys-accent" style={{ width: "100%" }} onClick={() => finish(orderId)}>
                  Continue
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="ossys-foot">Robux payments are matched to the sale on your linked Roblox account</div>
    </main>
  );
}
