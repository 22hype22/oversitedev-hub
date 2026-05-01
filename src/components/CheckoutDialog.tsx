import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";
import { useCallback } from "react";

export interface CheckoutItem {
  // Either a Stripe lookup key
  priceId?: string;
  // OR dynamic price for a DB product
  productId?: string;
  productName?: string;
  amountCents?: number;
  currency?: string;
  quantity?: number;
  // For upgrade purchases (paid version bumps)
  purchaseType?: "initial" | "upgrade";
  parentPurchaseId?: string;
  upgradeToVersion?: string;
  // For bot-order checkouts: webhook flips bot_orders.status to 'paid'.
  botOrderId?: string;
}

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CheckoutItem[];
  customerEmail?: string;
}

export function CheckoutDialog({ open, onOpenChange, items, customerEmail }: CheckoutDialogProps) {
  const fetchClientSecret = useCallback(async (): Promise<string> => {
    const { data, error } = await supabase.functions.invoke("create-checkout", {
      body: {
        items,
        customerEmail,
        environment: getStripeEnvironment(),
        returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      },
    });
    if (error || !data?.clientSecret) {
      throw new Error(error?.message || data?.error || "Failed to create checkout session");
    }
    return data.clientSecret;
  }, [items, customerEmail]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Checkout</DialogTitle>
        </DialogHeader>
        <div className="p-2">
          {open && (
            <EmbeddedCheckoutProvider
              key={JSON.stringify(items)}
              stripe={getStripe()}
              options={{ fetchClientSecret }}
            >
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
