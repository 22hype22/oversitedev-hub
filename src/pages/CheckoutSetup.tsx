import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripe";
import { toast } from "sonner";
import { SystemScreen, SystemCard } from "@/components/site/SystemScreen";

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
    <SystemScreen footer={<>Payments are securely processed by Stripe · 256-bit encrypted</>}>
      <SystemCard align="left">
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            fontWeight: 700,
            padding: "6px 12px",
            borderRadius: 999,
            marginBottom: 18,
            background: "rgba(201,219,230,.12)",
            border: "1px solid rgba(201,219,230,.28)",
            color: "var(--os-accent)",
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--os-accent)" }} />
          Preorder — no charge today
        </span>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>Reserve your preorder</h1>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 24 }}>
          Save a card to lock in your spot. We'll DM you on Discord to confirm before we build — and
          only then are you charged.
        </p>
        <Elements stripe={stripePromise} options={{ clientSecret: cs, appearance: { theme: "night" } }}>
          <SetupForm orderId={orderId} />
        </Elements>
      </SystemCard>
    </SystemScreen>
  );
}
