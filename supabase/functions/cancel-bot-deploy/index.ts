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
import { scrubGuilds } from "../_shared/discord-guilds.ts";

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
      .select("id, railway_service_id, status, bot_token")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // FIREBREAK — linked/main bots are never torn down by platform actions.
    // An order carrying its own manual token (bot_token set, e.g. bots linked
    // via admin-link-bot) means the bot's real home is its Railway service +
    // Discord, and the dashboard is just a control panel. Cancelling such an
    // order only detaches it here: no service deletion, no leaving servers,
    // no identity reset. Pool-token customer bots below are unaffected.
    if (order.bot_token) {
      console.log("[cancel-bot-deploy] linked bot (manual token) — teardown skipped", orderId);
      await admin
        .from("bot_orders")
        .update({ deployment_status: "cancelled" })
        .eq("id", orderId);
      return new Response(
        JSON.stringify({ ok: true, skipped: "linked-bot", teardown: null, deleted: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
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
    //
    // SECURITY: the token is only released to 'available' after a VERIFIED
    // guild scrub (a fresh listing shows zero servers). If anything prevents
    // verification, the row stays 'assigned' with a needs-cleanup note —
    // claim_pool_token_for_deploy only hands out 'available' tokens, and
    // auto-deploy-bot re-scrubs at claim time as the final gate. (The pool
    // status CHECK only allows available/assigned/retired, so an unclean
    // token is flagged via `notes` rather than a custom status.)
    let scrubVerified = false;
    let scrubDetail = "no token resolved for this order";
    try {
      const { data: tokenData } = await admin.rpc("runtime_resolve_bot_token", {
        _bot_id: orderId,
      });
      const botToken = typeof tokenData === "string" ? tokenData : null;
      if (botToken) {
        // 1) Leave every guild the bot is currently in (shared scrub with
        // built-in re-list verification). We must finish this BEFORE
        // releasing the token, otherwise the next bot to claim it would
        // inherit membership in these servers.
        try {
          const scrub = await scrubGuilds(botToken, "cancel-bot-deploy");
          scrubVerified = scrub.clean;
          scrubDetail = scrub.detail;
        } catch (e) {
          scrubDetail = `guild scrub error: ${(e as Error).message}`;
          console.warn("[cancel-bot-deploy] guild scrub error", (e as Error).message);
        }

        // 2) Reset Discord identity (avatar + banner + bio) so the next bot to claim
        // this token doesn't inherit the previous bot's look.
        const dRes = await fetch("https://discord.com/api/v10/users/@me", {
          method: "PATCH",
          headers: {
            Authorization: `Bot ${botToken}`,
            "Content-Type": "application/json",
          },
          // Clear avatar + banner on the bot USER. (auto-deploy-bot re-wipes
          // and verifies at claim time as the real guarantee.)
          body: JSON.stringify({ avatar: null, banner: null }),
        });
        if (!dRes.ok) {
          const t = await dRes.text();
          console.warn("[cancel-bot-deploy] Discord identity reset failed", dRes.status, t.slice(0, 200));
        }
        // Description lives on the APPLICATION, not the user — clear it there.
        const aRes = await fetch("https://discord.com/api/v10/applications/@me", {
          method: "PATCH",
          headers: {
            Authorization: `Bot ${botToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ description: "" }),
        });
        if (!aRes.ok) {
          const t = await aRes.text();
          console.warn("[cancel-bot-deploy] Discord description reset failed", aRes.status, t.slice(0, 200));
        }
      }
    } catch (e) {
      console.warn("[cancel-bot-deploy] identity reset error", (e as Error).message);
    }


    // Release the pool token ONLY after a verified scrub. Anything less keeps
    // the row 'assigned' with a needs-cleanup note: it can't be claimed
    // (claims take only 'available'), and even if it somehow were,
    // auto-deploy-bot's claim-time scrub is the final gate. The admin panel's
    // "Reclaim stuck tokens" button (admin-token-pool) re-scrubs and frees
    // any row left behind here.
    if (scrubVerified) {
      const { error: releaseErr } = await admin
        .from("bot_token_pool")
        .update({
          status: "available",
          assigned_bot_id: null,
          assigned_at: null,
          notes: null,
          updated_at: new Date().toISOString(),
        })
        .eq("assigned_bot_id", orderId);
      if (releaseErr) {
        console.warn("[cancel-bot-deploy] token release failed", releaseErr.message);
      }
    } else {
      console.warn("[cancel-bot-deploy] NOT releasing token —", scrubDetail);
      const { error: parkErr } = await admin
        .from("bot_token_pool")
        .update({
          notes: `needs cleanup: ${scrubDetail}`,
          updated_at: new Date().toISOString(),
        })
        .eq("assigned_bot_id", orderId)
        .eq("status", "assigned");
      if (parkErr) {
        console.warn("[cancel-bot-deploy] token park failed", parkErr.message);
      }
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
