import Stripe from "https://esm.sh/stripe@18.5.0";

export type StripeEnv = "sandbox" | "live";

const getEnv = (key: string): string => {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`${key} is not configured`);
  return value;
};

export function getConnectionApiKey(env: StripeEnv): string {
  return env === "sandbox"
    ? getEnv("STRIPE_SANDBOX_API_KEY")
    : getEnv("STRIPE_LIVE_API_KEY");
}

export function createStripeClient(env: StripeEnv): Stripe {
  // Call Stripe's API directly with our own secret key. (Previously this was
  // proxied through Lovable's connector gateway, which required a
  // LOVABLE_API_KEY — removed so the payment stack doesn't depend on Lovable
  // Cloud and keeps working after migrating to our own hosting.)
  // STRIPE_{LIVE,SANDBOX}_API_KEY must be a real Stripe secret key (sk_live_…
  // / sk_test_…) from our own Stripe account.
  const apiKey = getConnectionApiKey(env);
  return new Stripe(apiKey, {
    apiVersion: "2025-03-31.basil",
    httpClient: Stripe.createFetchHttpClient(),
  });
}

// Reusable WebCrypto provider for Stripe's async signature verifier (edge
// runtimes have no Node crypto).
let _cryptoProvider: any = null;
function getCryptoProvider(): any {
  if (!_cryptoProvider) _cryptoProvider = Stripe.createSubtleCryptoProvider();
  return _cryptoProvider;
}

// Verify that an incoming request was really signed by Stripe with OUR webhook
// secret, and return the parsed event. This is the gate that stops a forged
// call from flipping an order to "paid" and handing out a product for free.
//
// We delegate to Stripe's official `constructEventAsync`, which:
//   * recomputes the HMAC-SHA256 over `${timestamp}.${body}` and compares it in
//     CONSTANT TIME (no timing side-channel like a plain string compare),
//   * enforces the 5-minute timestamp tolerance (replay protection),
//   * rejects anything whose signature doesn't match the secret.
// Anyone without the webhook secret cannot produce a request that passes.
export async function verifyWebhook(
  req: Request,
  env: StripeEnv,
): Promise<{ type: string; data: { object: any } }> {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();
  const secret =
    env === "sandbox"
      ? getEnv("PAYMENTS_SANDBOX_WEBHOOK_SECRET")
      : getEnv("PAYMENTS_LIVE_WEBHOOK_SECRET");

  if (!signature || !body) throw new Error("Missing signature or body");

  const stripe = createStripeClient(env);
  try {
    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      secret,
      undefined, // default tolerance: 300s
      getCryptoProvider(),
    );
    return event as unknown as { type: string; data: { object: any } };
  } catch (err) {
    // Includes bad signature, unknown secret, or a stale/replayed timestamp.
    throw new Error(`Webhook signature verification failed: ${(err as Error).message}`);
  }
}
