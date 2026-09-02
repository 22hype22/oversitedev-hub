// Resolves the CURRENT signed-in user against every dashboard_access_grant and
// materializes normal dashboard_team rows for the ones they match — so all the
// existing per-bot RLS (has_bot_team_access / has_bot_team_perm) keeps enforcing
// access unchanged. Fail-closed: only positive identity matches ever add access;
// any error grants nothing, and rows this function created are removed once the
// match no longer holds. It only ever touches rows tagged access_grant_id — real
// email invites (access_grant_id IS NULL) are never modified.
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
const ROLE_RANK: Record<string, number> = { co_owner: 80, admin: 60, moderator: 40, viewer: 20 };

async function discordRolesFor(ownerId: string, groupId: string | null, wantGuild: string, discordId: string): Promise<Set<string>> {
  // Find a bot (owned by the grant owner, in scope) that shares a guild we can
  // query, resolve its token, and read the member's roles in that guild.
  let q = admin.from("bot_orders").select("id").eq("user_id", ownerId);
  let bots: any[] = [];
  try {
    if (groupId && groupId !== GLOBAL_GROUP) q = q.eq("group_id", groupId);
    bots = (await q).data ?? [];
  } catch (_) {
    bots = (await admin.from("bot_orders").select("id").eq("user_id", ownerId)).data ?? [];
  }
  for (const b of bots) {
    const { data: ag } = await admin.from("bot_active_guilds").select("guild_id").eq("bot_id", b.id);
    const guilds = (ag ?? []).map((x: any) => String(x.guild_id));
    const guild = wantGuild && guilds.includes(wantGuild) ? wantGuild : (wantGuild ? "" : guilds[0]);
    if (!guild) continue;
    const { data: tok } = await admin.rpc("runtime_resolve_bot_token", { _bot_id: b.id });
    const token = typeof tok === "string" ? tok : null;
    if (!token) continue;
    try {
      const r = await fetch(`https://discord.com/api/v10/guilds/${guild}/members/${discordId}`, {
        headers: { Authorization: `Bot ${token}` },
      });
      if (!r.ok) continue; // not a member of this guild, or perms — try the next bot
      const m = await r.json();
      return new Set((m.roles ?? []).map((x: any) => String(x)));
    } catch (_) { /* try next bot */ }
  }
  return new Set();
}

async function robloxRank(robloxId: string, groupId: string): Promise<number> {
  try {
    const r = await fetch(`https://groups.roblox.com/v1/users/${robloxId}/groups/roles`);
    if (!r.ok) return 0;
    const j = await r.json();
    const e = (j.data ?? []).find((x: any) => String(x.group?.id) === String(groupId));
    return Number(e?.role?.rank ?? 0);
  } catch (_) {
    return 0;
  }
}

async function targetBots(ownerId: string, groupId: string | null): Promise<string[]> {
  try {
    let q = admin.from("bot_orders").select("id").eq("user_id", ownerId);
    if (groupId && groupId !== GLOBAL_GROUP) q = q.eq("group_id", groupId);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((b: any) => String(b.id));
  } catch (_) {
    const { data } = await admin.from("bot_orders").select("id").eq("user_id", ownerId);
    return (data ?? []).map((b: any) => String(b.id));
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return json(401, { error: "Not authenticated." });
    const { data: ud, error: uErr } = await admin.auth.getUser(jwt);
    const user = ud?.user;
    if (uErr || !user) return json(401, { error: "Not authenticated." });

    const email = (user.email || "").toLowerCase();

    // The caller's Discord snowflake (from their linked Discord identity).
    let discordId = "";
    try {
      const { data: full } = await admin.auth.admin.getUserById(user.id);
      const ids = (full?.user?.identities ?? []) as any[];
      const d = ids.find((i) => i.provider === "discord");
      discordId = String(d?.identity_data?.sub || (d as any)?.provider_id || d?.identity_data?.provider_id || "");
    } catch (_) { /* no discord identity */ }

    // Their Roblox id, if any verification links this Discord account.
    let robloxId = "";
    if (discordId) {
      const { data: rv } = await admin
        .from("roblox_verifications")
        .select("roblox_id")
        .eq("discord_user_id", discordId)
        .not("roblox_id", "is", null)
        .limit(1)
        .maybeSingle();
      robloxId = String(rv?.roblox_id || "");
    }

    const { data: grants } = await admin.from("dashboard_access_grants").select("*");

    // bot_id -> the strongest role granted to this user
    const matched = new Map<string, { role: string; grantId: string; owner: string }>();
    // cache guild-role lookups per (owner|group|guild)
    const roleCache = new Map<string, Set<string>>();

    for (const g of (grants ?? [])) {
      let ok = false;
      try {
        if (g.kind === "discord_member") {
          ok = !!discordId && String(g.discord_id) === discordId;
        } else if (g.kind === "discord_role") {
          if (discordId && g.discord_id) {
            const key = `${g.owner_user_id}|${g.group_id ?? ""}|${g.guild_id ?? ""}`;
            let roles = roleCache.get(key);
            if (!roles) {
              roles = await discordRolesFor(g.owner_user_id, g.group_id, String(g.guild_id || ""), discordId);
              roleCache.set(key, roles);
            }
            ok = roles.has(String(g.discord_id));
          }
        } else if (g.kind === "roblox_group_rank") {
          if (robloxId && g.roblox_group_id) {
            const rank = await robloxRank(robloxId, String(g.roblox_group_id));
            ok = rank > 0 && rank >= Number(g.roblox_min_rank || 1);
          }
        } else if (g.kind === "roblox_user") {
          // A specific Roblox account, invited by username (stored as its id).
          ok = !!robloxId && String(g.roblox_user_id) === robloxId;
        }
      } catch (_) { ok = false; }
      if (!ok) continue;

      for (const botId of await targetBots(g.owner_user_id, g.group_id)) {
        const prev = matched.get(botId);
        if (!prev || (ROLE_RANK[g.role] ?? 0) > (ROLE_RANK[prev.role] ?? 0)) {
          matched.set(botId, { role: g.role, grantId: g.id, owner: g.owner_user_id });
        }
      }
    }

    // Materialize — never overwrite a real (human) invite row.
    const now = new Date().toISOString();
    for (const [botId, info] of matched) {
      const { data: existing } = await admin
        .from("dashboard_team")
        .select("id, access_grant_id")
        .eq("bot_id", botId)
        .eq("member_user_id", user.id)
        .maybeSingle();
      if (existing && !existing.access_grant_id) continue; // a real invite already grants access
      if (existing) {
        await admin.from("dashboard_team")
          .update({ role: info.role, access_grant_id: info.grantId, accepted_at: now, owner_user_id: info.owner })
          .eq("id", existing.id);
      } else {
        await admin.from("dashboard_team").insert({
          bot_id: botId, owner_user_id: info.owner,
          member_email: email || `discord-${discordId || user.id}@access.local`,
          member_user_id: user.id, role: info.role,
          invited_at: now, accepted_at: now, access_grant_id: info.grantId,
        });
      }
    }

    // Revoke access this function previously granted that no longer applies.
    const { data: mine } = await admin
      .from("dashboard_team")
      .select("id, bot_id")
      .eq("member_user_id", user.id)
      .not("access_grant_id", "is", null);
    for (const r of (mine ?? [])) {
      if (!matched.has(String(r.bot_id))) await admin.from("dashboard_team").delete().eq("id", r.id);
    }

    return json(200, { ok: true, granted: matched.size });
  } catch (e) {
    console.error("[team-access-resolve]", e);
    return json(500, { error: "resolve failed" });
  }
});
