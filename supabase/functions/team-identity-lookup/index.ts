// Turns a typed username into an identity id for the team invite flow, so an
// owner can invite "by Discord" or "by Roblox" without hunting for numeric ids.
//
// Body: { kind: "discord", query, groupId? }  -> Discord members matching the
//         name in the group's bot guild(s)      { ok, results:[{id,username,name,guild}] }
//       { kind: "roblox",  query }             -> the Roblox user with that username
//                                                 { ok, results:[{id,username,name}] }
//
// Auth: the signed-in owner (JWT). Discord lookups only ever search guilds that
// one of the caller's OWN bots is in (using that bot's token); Roblox lookups use
// Roblox's public username endpoint. Nothing here grants access by itself — the
// dashboard writes a dashboard_access_grants row with the chosen id, and
// team-access-resolve does the (fail-closed) matching.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (s: number, d: unknown) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const GLOBAL_GROUP = "00000000-0000-0000-0000-000000000000";

type Hit = { id: string; username: string; name: string; guild?: string };

async function discordSearch(ownerId: string, groupId: string | null, query: string): Promise<Hit[]> {
  // Every bot the owner has in scope, then every guild each bot is active in.
  let q = admin.from("bot_orders").select("id").eq("user_id", ownerId);
  if (groupId && groupId !== GLOBAL_GROUP) q = q.eq("group_id", groupId);
  const bots = (await q).data ?? [];
  const seen = new Set<string>();
  const out: Hit[] = [];
  for (const b of bots) {
    const { data: ag } = await admin.from("bot_active_guilds").select("guild_id, guild_name").eq("bot_id", b.id);
    if (!ag?.length) continue;
    const { data: tok } = await admin.rpc("runtime_resolve_bot_token", { _bot_id: b.id });
    const token = typeof tok === "string" ? tok : null;
    if (!token) continue;
    for (const g of ag) {
      try {
        const r = await fetch(
          `https://discord.com/api/v10/guilds/${g.guild_id}/members/search?query=${encodeURIComponent(query)}&limit=8`,
          { headers: { Authorization: `Bot ${token}` } },
        );
        if (!r.ok) continue;
        const members = await r.json();
        for (const m of members ?? []) {
          const id = String(m?.user?.id ?? "");
          if (!id || seen.has(id)) continue;
          seen.add(id);
          out.push({
            id,
            username: String(m.user.username ?? ""),
            name: String(m.nick ?? m.user.global_name ?? m.user.username ?? ""),
            guild: String(g.guild_name ?? g.guild_id),
          });
        }
      } catch (_) { /* next guild */ }
      if (out.length >= 8) return out;
    }
  }
  return out;
}

async function robloxLookup(query: string): Promise<Hit[]> {
  const name = query.replace(/^@/, "").trim();
  if (!name) return [];
  const r = await fetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usernames: [name], excludeBannedUsers: true }),
  });
  if (!r.ok) return [];
  const j = await r.json();
  return (j?.data ?? []).map((u: any) => ({
    id: String(u.id),
    username: String(u.name ?? ""),
    name: String(u.displayName ?? u.name ?? ""),
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return json(401, { ok: false, error: "Not authenticated." });
    const { data: ud, error: uErr } = await admin.auth.getUser(jwt);
    const user = ud?.user;
    if (uErr || !user) return json(401, { ok: false, error: "Not authenticated." });

    const body = await req.json().catch(() => ({}));
    const kind = String(body.kind ?? "");
    const query = String(body.query ?? "").trim();
    const groupId = body.groupId ? String(body.groupId) : null;
    if (!query || query.length > 64) return json(400, { ok: false, error: "Enter a name to look up." });

    if (kind === "discord") {
      // A pasted numeric id needs no lookup.
      if (/^\d{15,22}$/.test(query)) return json(200, { ok: true, results: [{ id: query, username: query, name: query }] });
      return json(200, { ok: true, results: await discordSearch(user.id, groupId, query) });
    }
    if (kind === "roblox") {
      if (/^\d{3,}$/.test(query)) return json(200, { ok: true, results: [{ id: query, username: query, name: query }] });
      return json(200, { ok: true, results: await robloxLookup(query) });
    }
    return json(400, { ok: false, error: "Unknown lookup kind." });
  } catch (e) {
    console.error("[team-identity-lookup]", e);
    return json(500, { ok: false, error: "lookup failed" });
  }
});
