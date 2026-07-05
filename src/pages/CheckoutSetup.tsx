import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripe";
import { toast } from "sonner";
import oversiteLogo from "@/assets/oversite-logo.png";

// Self-contained "system page" shell (mountain backdrop + frosted slate glass
// + icy accent). Inlined rather than shared so no extra file is required.
const OSSYS_CSS = `
.ossys{--os-heading:#E8EEF3;--os-body:#A8B4BF;--os-faint:#788591;--os-accent:#C9DBE6;--os-accent-ink:#1E242B;--os-hair:rgba(168,180,191,.16);position:relative;min-height:100vh;display:flex;flex-direction:column;overflow:hidden;color:var(--os-body);font-family:'Manrope',system-ui,-apple-system,sans-serif;background:radial-gradient(130% 85% at 50% 118%,rgba(201,219,230,.14),transparent 55%),radial-gradient(95% 70% at 50% -15%,rgba(70,82,94,.55),transparent 60%),linear-gradient(180deg,#293038,#1e242b)}
.ossys-top{position:relative;z-index:2;padding:22px 26px}
.ossys-top img{height:30px;width:auto;object-fit:contain}
.ossys-mid{position:relative;z-index:2;flex:1;display:grid;place-items:center;padding:16px 16px 64px}
.ossys-foot{position:relative;z-index:2;padding-bottom:22px;text-align:center;font-size:12px;color:var(--os-faint)}
.ossys-card{width:100%;border:1px solid var(--os-hair);border-radius:20px;background:linear-gradient(180deg,rgba(46,54,63,.72),rgba(39,46,54,.8));-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);box-shadow:0 34px 90px -34px rgba(0,0,0,.8);padding:38px 34px}
.ossys-card h1{color:var(--os-heading);font-weight:800;letter-spacing:-.01em;margin:0}
.ossys-card p{color:var(--os-body)}
.ossys-accent{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:46px;padding:0 22px;border-radius:12px;font-weight:700;font-size:14.5px;border:0;cursor:pointer;text-decoration:none;background:var(--os-accent);color:var(--os-accent-ink);transition:filter .18s ease,transform .18s ease}
.ossys-accent:hover{filter:brightness(1.06)}
.ossys-accent:disabled{opacity:.6;cursor:default}
.ossys-pill{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:700;padding:6px 12px;border-radius:999px;margin-bottom:18px;background:rgba(201,219,230,.12);border:1px solid rgba(201,219,230,.28);color:var(--os-accent)}
`;

function SetupForm({ orderId }: { orderId: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [paymentReady, setPaymentReady] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    const { error, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: "if_required",
      confirmParams: {
        return_url: `${window.location.origin}/checkout/return?setup=1&order=${orderId}`,
      },
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message || "Couldn't save your card");
      return;
    }
    if (setupIntent?.status === "succeeded") {
      toast.success("Card saved — you'll be DM'd when we go live.");
      navigate(`/checkout/return?setup=1&order=${orderId}`);
    }
  };

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 20 }}>
      <div style={{ position: "relative", minHeight: 200 }}>
        {!paymentReady && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              color: "var(--os-faint)",
            }}
          >
            Loading secure card form…
          </div>
        )}
        <div className={paymentReady ? "" : "invisible"}>
          <PaymentElement onReady={() => setPaymentReady(true)} />
        </div>
      </div>
      <button
        type="submit"
        className="ossys-accent"
        style={{ width: "100%", height: 48 }}
        disabled={!stripe || !paymentReady || submitting}
      >
        {submitting ? "Saving card…" : "Save card & reserve preorder"}
      </button>
      <p style={{ fontSize: 12, lineHeight: 1.6, textAlign: "center", color: "var(--os-faint)" }}>
        Your card will <strong style={{ color: "var(--os-body)" }}>not</strong> be charged now.
        We'll DM you on Discord when we're ready to build, and only charge after you confirm.
      </p>
    </form>
  );
}

export default function CheckoutSetup() {
  const [params] = useSearchParams();
  const cs = params.get("cs");
  const orderId = params.get("order") || "";
  const [stripePromise] = useState(() => getStripe());

  useEffect(() => {
    if (!cs) {
      toast.error("Missing setup session — please try again.");
    }
  }, [cs]);

  if (!cs) return null;

  return (
    <main className="ossys">
      <style>{OSSYS_CSS}</style>
      <div className="ossys-top">
        <Link to="/" aria-label="Oversite — home">
          <img src={oversiteLogo} alt="Oversite" />
        </Link>
      </div>
      <div className="ossys-mid">
        <div style={{ width: "100%", maxWidth: 460 }}>
          <div className="ossys-card">
            <span className="ossys-pill">
              <span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--os-accent)" }} />
              Preorder — no charge today
            </span>
            <h1 style={{ fontSize: 24, marginBottom: 8 }}>Reserve your preorder</h1>
            <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 24 }}>
              Save a card to lock in your spot. We'll DM you on Discord to confirm before we
              build — and only then are you charged.
            </p>
            <Elements stripe={stripePromise} options={{ clientSecret: cs, appearance: { theme: "night" } }}>
              <SetupForm orderId={orderId} />
            </Elements>
          </div>
        </div>
      </div>
      <div className="ossys-foot">Payments are securely processed by Stripe · 256-bit encrypted</div>
    </main>
  );
}
