// Admin tool: reclaim pool tokens stranded by cancelled/deleted orders so the
// pool never needs manual SQL to recover. Mirrors the self-heal that runs
// inside auto-deploy-bot, but on demand from the admin panel with a visible
// per-token report.
//
// POST { action: "reclaim" } -> {
//   ok, reclaimed: [{id, username, scrub}], kept: [{id, username, reason}],
//   counts: { available, assigned, retired }
// }
//
// Release rules (same invariant as everywhere else):
// - Scrub verified clean (bot left every server, re-list shows zero) -> 'available'.
// - Token can't be resolved (no order to decrypt through) -> 'available' anyway;
//   auto-deploy-bot's claim-time scrub gate is the hard stop before any
//   customer ever receives it.
// - Scrub ran but servers remain that Discord wouldn't let us leave -> token
//   is KEPT assigned and reported, because releasing it would lie.
//
// Admin-only: the caller's JWT must belong to a user with the admin role.
import { createClient } from "npm:@supabase/supabase-js@2";
import { scrubGuilds } from "../_shared/discord-guilds.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SERVICE_ROLE_KEY_OVERRIDE") ||
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const jwt = authHeader.replace("Bearer ", "");
    const { data: claimData, error: claimErr } = await userClient.auth.getClaims(jwt);
    if (claimErr || !claimData?.claims) return json(401, { error: "Unauthorized" });
    const userId = claimData.claims.sub as string;

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) return json(403, { error: "Admins only" });

    const body = await req.json().catch(() => ({} as any));
    const action = String(body.action || "reclaim");
    if (action !== "reclaim") return json(400, { error: "action must be 'reclaim'" });

    // Every assigned token whose order is gone or cancelled is stranded.
    // ('retired' is a deliberate admin state and is never touched.)
    const { data: pool, error: poolErr } = await admin
      .from("bot_token_pool")
      .select("id, bot_username, client_id, status, assigned_bot_id");
    if (poolErr) return json(500, { error: poolErr.message });

    const rows = (pool ?? []) as Array<{
      id: string;
      bot_username: string;
      client_id: string;
      status: string;
      assigned_bot_id: string | null;
    }>;

    const assigned = rows.filter((r) => r.status === "assigned");
    const linkedIds = assigned.map((r) => r.assigned_bot_id).filter(Boolean) as string[];
    const { data: linkedOrders } = linkedIds.length
      ? await admin.from("bot_orders").select("id, status").in("id", linkedIds)
      : { data: [] as Array<{ id: string; status: string }> };
    const orderStatus = new Map((linkedOrders ?? []).map((o: any) => [o.id, o.status]));

    const stranded = assigned.filter((r) => {
      if (!r.assigned_bot_id) return true; // assigned to nothing
      const s = orderStatus.get(r.assigned_bot_id);
      return s === undefined || s === "cancelled"; // order gone or cancelled
    });

    const reclaimed: Array<{ id: string; username: string; scrub: string }> = [];
    const kept: Array<{ id: string; username: string; reason: string }> = [];

    for (const row of stranded) {
      // Resolve the raw token through the cancelled order it's still pinned
      // to, so we can make it leave any servers before releasing it.
      let botToken: string | null = null;
      if (row.assigned_bot_id) {
        const { data: tokenData } = await admin.rpc("runtime_resolve_bot_token", {
          _bot_id: row.assigned_bot_id,
        });
        botToken = typeof tokenData === "string" && tokenData.length > 0 ? tokenData : null;
      }

      let scrubNote: string;
      if (botToken) {
        const scrub = await scrubGuilds(botToken, "admin-token-pool");
        if (!scrub.clean) {
          kept.push({ id: row.id, username: row.bot_username, reason: scrub.detail });
          await admin
            .from("bot_token_pool")
            .update({
              notes: `needs cleanup: ${scrub.detail}`,
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);
          continue;
        }
        scrubNote = scrub.detail;
      } else {
        // Can't decrypt without an order to resolve through. Release anyway:
        // auto-deploy-bot re-scrubs (and aborts on failure) before this token
        // can ever reach a customer.
        scrubNote = "token not resolvable here — will be scrubbed at next deploy";
      }

      const { error: relErr } = await admin
        .from("bot_token_pool")
        .update({
          status: "available",
          assigned_bot_id: null,
          assigned_at: null,
          notes: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("status", "assigned");
      if (relErr) {
        kept.push({ id: row.id, username: row.bot_username, reason: relErr.message });
      } else {
        reclaimed.push({ id: row.id, username: row.bot_username, scrub: scrubNote });
        console.log("[admin-token-pool] reclaimed", row.id, row.bot_username, scrubNote);
      }
    }

    const { data: after } = await admin.from("bot_token_pool").select("status");
    const counts = { available: 0, assigned: 0, retired: 0 } as Record<string, number>;
    for (const r of (after ?? []) as Array<{ status: string }>) {
      counts[r.status] = (counts[r.status] ?? 0) + 1;
    }

    return json(200, { ok: true, reclaimed, kept, counts });
  } catch (err) {
    return json(500, { error: err instanceof Error ? err.message : String(err) });
  }
});
