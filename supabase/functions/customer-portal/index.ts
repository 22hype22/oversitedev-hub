import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    // Validate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user?.email) throw new Error("Not authenticated");

    const body = await req.json().catch(() => ({}));
    const env: StripeEnv = body?.env === "live" ? "live" : "sandbox";
    const returnUrl =
      typeof body?.returnUrl === "string" ? body.returnUrl : req.headers.get("origin") ?? "/";

    const stripe = createStripeClient(env);

    // Find or create the Stripe customer for this email
    const customers = await stripe.customers.list({ email: userData.user.email, limit: 1 });
    const customer =
      customers.data[0] ??
      (await stripe.customers.create({
        email: userData.user.email,
        metadata: { userId: userData.user.id },
      }));

    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: returnUrl,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("customer-portal error:", message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
