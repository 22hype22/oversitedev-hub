// Admin tool: list every Discord server a managed bot is in, and force it to
// leave one. Talks straight to the Discord API with the bot's own token (no
// bot process involved), so it works even while the bot is offline.
//
// POST { action: "list",  orderId }            -> { ok, guilds: [{id,name,memberCount}] }
// POST { action: "leave", orderId, guildId }   -> { ok }
//
// Admin-only: the caller's JWT must belong to a user with the admin role.
import { createClient } from "npm:@supabase/supabase-js@2";

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

const DISCORD_API = "https://discord.com/api/v10";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
    const action = String(body.action || "");
    const orderId = String(body.orderId || "");
    if (!orderId) return json(400, { error: "orderId required" });

    const { data: tokenData, error: tokenErr } = await admin.rpc(
      "runtime_resolve_bot_token",
      { _bot_id: orderId },
    );
    if (tokenErr) return json(500, { error: tokenErr.message });
    const botToken = typeof tokenData === "string" ? tokenData : null;
    if (!botToken) {
      return json(404, { error: "No Discord token is associated with this bot" });
    }
    const discordAuth = { Authorization: `Bot ${botToken}` };

    if (action === "list") {
      const guilds: Array<{ id: string; name: string; memberCount: number | null }> = [];
      let after: string | null = null;
      for (let i = 0; i < 50; i++) {
        const url = new URL(`${DISCORD_API}/users/@me/guilds`);
        url.searchParams.set("limit", "200");
        url.searchParams.set("with_counts", "true");
        if (after) url.searchParams.set("after", after);
        const res = await fetch(url.toString(), { headers: discordAuth });
        if (res.status === 429) {
          const ra = Number(res.headers.get("retry-after") ?? "1");
          await new Promise((r) => setTimeout(r, Math.min(5000, ra * 1000)));
          continue;
        }
        if (!res.ok) {
          const t = await res.text();
          return json(502, { error: `Discord ${res.status}: ${t.slice(0, 200)}` });
        }
        const page = (await res.json()) as Array<{
          id: string;
          name?: string;
          approximate_member_count?: number;
        }>;
        if (!Array.isArray(page) || page.length === 0) break;
        for (const g of page) {
          guilds.push({
            id: g.id,
            name: g.name ?? g.id,
            memberCount: g.approximate_member_count ?? null,
          });
        }
        if (page.length < 200) break;
        after = page[page.length - 1].id;
      }
      return json(200, { ok: true, guilds });
    }

    if (action === "leave") {
      const guildId = String(body.guildId || "");
      if (!guildId) return json(400, { error: "guildId required" });
      const res = await fetch(`${DISCORD_API}/users/@me/guilds/${guildId}`, {
        method: "DELETE",
        headers: discordAuth,
      });
      if (res.status === 204) return json(200, { ok: true });
      const t = await res.text();
      return json(502, { error: `Discord ${res.status}: ${t.slice(0, 200)}` });
    }

    return json(400, { error: "action must be 'list' or 'leave'" });
  } catch (err) {
    return json(500, { error: err instanceof Error ? err.message : String(err) });
  }
});
