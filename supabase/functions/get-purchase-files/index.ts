import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const FILE_BUCKET = "product-files";
const SIGNED_URL_TTL = 60 * 60; // 1 hour

function pathFromPublicUrl(url: string): string | null {
  // Supports both public URLs and already-relative paths
  if (!url) return null;
  // Strip everything before /<bucket>/
  const marker = `/${FILE_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) {
    // Maybe it's already a path
    return url.startsWith("/") ? url.slice(1) : url;
  }
  return url.slice(idx + marker.length);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId, environment } = await req.json();
    if (!sessionId || typeof sessionId !== "string") {
      return new Response(JSON.stringify({ error: "sessionId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const env = ((environment || "sandbox") as StripeEnv);
    const stripe = createStripeClient(env);

    // Verify the session was actually paid
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const paid = session.payment_status === "paid" || session.status === "complete";
    if (!paid) {
      return new Response(
        JSON.stringify({ error: "Payment not completed", status: session.payment_status }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Mark purchase rows paid; capture email from session if not stored
    const customerEmail = session.customer_details?.email || session.customer_email || null;

    // Optionally link to user, if a JWT was provided
    let userId: string | null = null;
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const { data } = await supabaseAdmin.auth.getUser(token);
      userId = data.user?.id ?? null;
    }

    await supabaseAdmin
      .from("purchases")
      .update({
        status: "paid",
        ...(customerEmail ? { email: customerEmail } : {}),
        ...(userId ? { user_id: userId } : {}),
      })
      .eq("stripe_session_id", sessionId);

    const { data: rows, error } = await supabaseAdmin
      .from("purchases")
      .select("id, product_name, file_url, file_name")
      .eq("stripe_session_id", sessionId);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const files = await Promise.all(
      (rows || []).map(async (row) => {
        if (!row.file_url) {
          return {
            id: row.id,
            productName: row.product_name,
            fileName: null,
            url: null,
          };
        }
        const path = pathFromPublicUrl(row.file_url);
        if (!path) {
          return {
            id: row.id,
            productName: row.product_name,
            fileName: row.file_name,
            url: null,
          };
        }
        const { data: signed } = await supabaseAdmin.storage
          .from(FILE_BUCKET)
          .createSignedUrl(path, SIGNED_URL_TTL, {
            download: row.file_name || true,
          });
        return {
          id: row.id,
          productName: row.product_name,
          fileName: row.file_name,
          url: signed?.signedUrl ?? null,
        };
      }),
    );

    return new Response(
      JSON.stringify({ files, email: customerEmail, userId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
