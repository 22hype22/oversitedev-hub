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
      .select("id, product_id, product_name, file_url, file_name, version")
      .eq("stripe_session_id", sessionId);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const files = await Promise.all(
      (rows || []).map(async (row) => {
        // Resolve the file path for this purchase.
        // Priority:
        //   1. If the row has a recorded version + product_id, look up the
        //      matching snapshot in product_versions (the version they paid for).
        //   2. Otherwise fall back to the file_url stamped on the purchase
        //      itself (legacy purchases / products without a version).
        let filePath: string | null = null;
        let resolvedFileName: string | null = row.file_name ?? null;

        if (row.version && row.product_id) {
          const { data: vRow } = await supabaseAdmin
            .from("product_versions")
            .select("file_url, file_name")
            .eq("product_id", row.product_id)
            .eq("version", row.version)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (vRow?.file_url) {
            filePath = vRow.file_url;
            resolvedFileName = vRow.file_name ?? resolvedFileName;
          }
        }
        if (!filePath && row.file_url) {
          filePath = pathFromPublicUrl(row.file_url);
        }

        if (!filePath) {
          return {
            id: row.id,
            productName: row.product_name,
            fileName: resolvedFileName,
            url: null,
            version: row.version ?? null,
          };
        }
        const { data: signed } = await supabaseAdmin.storage
          .from(FILE_BUCKET)
          .createSignedUrl(filePath, SIGNED_URL_TTL, {
            download: resolvedFileName || true,
          });
        return {
          id: row.id,
          productName: row.product_name,
          fileName: resolvedFileName,
          url: signed?.signedUrl ?? null,
          version: row.version ?? null,
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
