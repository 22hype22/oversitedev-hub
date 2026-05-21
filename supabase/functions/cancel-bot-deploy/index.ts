// Tear down a bot's Railway service when its order is cancelled.
//
// Invocation:
//   POST { orderId: string }
//
// Called by the bot_orders trigger when status -> 'cancelled'. The trigger
// has already released the pool token; this function scales / removes the
// Railway service and clears railway_service_id on the order so the slot
// is fully cleaned up.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RAILWAY_API = "https://backboard.railway.app/graphql/v2";

async function railway(query: string, variables: Record<string, unknown>) {
  const token = Deno.env.get("RAILWAY_API_TOKEN");
  if (!token) throw new Error("RAILWAY_API_TOKEN not configured");
  const res = await fetch(RAILWAY_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) {
    throw new Error(json.errors?.[0]?.message ?? `Railway HTTP ${res.status}`);
  }
  return json.data;
}

async function deleteService(serviceId: string): Promise<boolean> {
  try {
    await railway(
      `mutation($id: String!) { serviceDelete(id: $id) }`,
      { id: serviceId },
    );
    return true;
  } catch (err) {
    console.warn("[cancel-bot-deploy] delete failed", (err as Error).message);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  let orderId: string | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    orderId = body?.orderId;
    if (!orderId) {
      return new Response(JSON.stringify({ error: "orderId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: order } = await admin
      .from("bot_orders")
      .select("id, railway_service_id, status")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceId = order.railway_service_id as string | null;
    let deleted = false;
    if (serviceId) {
      // Fully remove the Railway service so cancelled bots don't pile up.
      deleted = await deleteService(serviceId);
    }

    // Reset the Discord identity (avatar + bio) BEFORE releasing the token
    // back to the pool. Otherwise the next bot to claim this token inherits
    // the previous bot's avatar/bio. (Username can't be cleared via API, but
    // the next deploy's auto-deploy-bot will PATCH it to the new bot_name.)
    try {
      const { data: tokenData } = await admin.rpc("runtime_resolve_bot_token", {
        _bot_id: orderId,
      });
      const botToken = typeof tokenData === "string" ? tokenData : null;
      if (botToken) {
        const dRes = await fetch("https://discord.com/api/v10/users/@me", {
          method: "PATCH",
          headers: {
            Authorization: `Bot ${botToken}`,
            "Content-Type": "application/json",
          },
          // null avatar clears it; empty bio clears it.
          body: JSON.stringify({ avatar: null, bio: "" }),
        });
        if (!dRes.ok) {
          const t = await dRes.text();
          console.warn("[cancel-bot-deploy] Discord identity reset failed", dRes.status, t.slice(0, 200));
        }
      }
    } catch (e) {
      console.warn("[cancel-bot-deploy] identity reset error", (e as Error).message);
    }

    // Now release the pool token (the trigger no longer does this, so we own it).
    const { error: releaseErr } = await admin
      .from("bot_token_pool")
      .update({
        status: "available",
        assigned_bot_id: null,
        assigned_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("assigned_bot_id", orderId);
    if (releaseErr) {
      console.warn("[cancel-bot-deploy] token release failed", releaseErr.message);
    }

    await admin
      .from("bot_orders")
      .update({
        railway_service_id: null,
        deployment_status: "cancelled",
        deployment_error: null,
      })
      .eq("id", orderId);

    return new Response(
      JSON.stringify({ ok: true, teardown: serviceId ?? null, deleted }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cancel-bot-deploy] failed", { orderId, message });
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
