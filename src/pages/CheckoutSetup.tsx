import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getStripe } from "@/lib/stripe";
import { toast } from "sonner";

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
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="relative min-h-[200px]">
        {!paymentReady && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            Loading secure card form…
          </div>
        )}
        <div className={paymentReady ? "" : "invisible"}>
          <PaymentElement onReady={() => setPaymentReady(true)} />
        </div>
      </div>
      <Button type="submit" disabled={!stripe || !paymentReady || submitting} className="w-full" size="lg" variant="hero">
        {submitting ? "Saving card…" : "Save card & reserve preorder"}
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        Your card will <strong>not</strong> be charged now. We'll DM you on Discord when we're ready
        to build, and only charge after you confirm.
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
    <main className="min-h-screen grid place-items-center px-4 py-16">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-2xl font-semibold mb-2">Reserve your preorder</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Save a card to lock in your spot. We'll DM you on Discord to confirm before charging.
        </p>
        <Elements stripe={stripePromise} options={{ clientSecret: cs, appearance: { theme: "night" } }}>
          <SetupForm orderId={orderId} />
        </Elements>
      </Card>
    </main>
  );
}
