// Sync a member's Roblox GROUP RANK from their Discord roles.
//
// Called by the bot (x-worker-token auth, same as roblox-verify). The bot maps
// Discord roles -> Roblox rank numbers in the dashboard; here we turn a desired
// rank number into the group's roleId and set it on the member's Roblox account
// using ROBLOX_COOKIE (.ROBLOSECURITY of the group's bot account).
//
// Actions (POST JSON):
//   { action: "set",  bot_id, group_id, discord_user_id | roblox_id, rank_number }
//        -> ranks one member. { ok, changed, from?, to?, reason? }
//   { action: "sync", bot_id, group_id, desired: [{ discord_user_id, rank_number }] }
//        -> ranks a batch (used by /grouproleupdate). Resolves Roblox ids from the
//           roblox_verifications table in one query, fetches group roles once,
//           and only PATCHes members whose rank is actually wrong.
//        -> { ok, changed, unchanged, skipped, failed, details: [...] }
//
// The bot account behind ROBLOX_COOKIE must sit ABOVE every rank it assigns and
// have "Manage lower-ranked members" — Roblox enforces this and returns 401/403
// otherwise, which we surface verbatim.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ROBLOX_COOKIE = Deno.env.get("ROBLOX_COOKIE") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-worker-token, x_worker_token, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

function normToken(v: string | null): string {
  return (v ?? "").trim().replace(/^Bearer\s+/i, "").replace(/^['"]|['"]$/g, "");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Validate the caller's worker token really belongs to this bot.
async function authBot(req: Request, botId: string): Promise<string | null> {
  const token =
    normToken(req.headers.get("x-worker-token")) ||
    normToken(req.headers.get("x_worker_token")) ||
    normToken(req.headers.get("authorization"));
  if (!token) return "Missing worker token.";
  const { data: lookup, error } = await admin.rpc("_worker_token_lookup", {
    _token: token,
  });
  const row = Array.isArray(lookup) ? lookup[0] : lookup;
  if (error || !row || String(row.bot_id) !== botId) {
    return "Worker token does not match this bot.";
  }
  return null;
}

function workerToken(req: Request): string {
  return (
    normToken(req.headers.get("x-worker-token")) ||
    normToken(req.headers.get("x_worker_token")) ||
    normToken(req.headers.get("authorization"))
  );
}

// The Roblox cookie for this bot: prefer the per-bot value the owner set in the
// dashboard (encrypted in bot_secrets), else the shared project ROBLOX_COOKIE.
// So an unset dashboard field changes nothing.
async function resolveCookie(botId: string, token: string): Promise<string> {
  try {
    const { data, error } = await admin.rpc("runtime_get_bot_secret", {
      _token: token, _bot_id: botId, _key: "ROBLOX_COOKIE",
    });
    if (!error && typeof data === "string" && data.trim()) return data.trim();
  } catch (_e) { /* fall back to the project secret */ }
  return ROBLOX_COOKIE;
}

// ── Roblox helpers ──────────────────────────────────────────────────────────

// Authenticated writes with the .ROBLOSECURITY cookie need an x-csrf-token,
// returned as a header from a "primer" call.
async function getCsrf(cookie: string): Promise<string> {
  const res = await fetch("https://auth.roblox.com/v2/logout", {
    method: "POST",
    headers: { Cookie: `.ROBLOSECURITY=${cookie}` },
  });
  const token = res.headers.get("x-csrf-token");
  if (!token) {
    throw new Error(
      `Failed to get x-csrf-token (HTTP ${res.status}). Is ROBLOX_COOKIE valid?`,
    );
  }
  return token;
}

// rank number -> roleId for this group (rank is the 0-255 number owners set).
async function getGroupRoles(
  groupId: string,
): Promise<Map<number, { roleId: number; name: string }>> {
  const res = await fetch(`https://groups.roblox.com/v1/groups/${groupId}/roles`);
  if (!res.ok) {
    throw new Error(
      `Couldn't read group ${groupId} roles (HTTP ${res.status}): ${await res.text()}`,
    );
  }
  const data = await res.json();
  const map = new Map<number, { roleId: number; name: string }>();
  for (const r of data?.roles ?? []) {
    if (typeof r?.rank === "number" && typeof r?.id === "number") {
      map.set(r.rank, { roleId: r.id, name: String(r.name ?? "") });
    }
  }
  return map;
}

// The member's current rank in this group (null if they aren't in it).
async function getCurrentRank(
  groupId: string,
  robloxId: string,
): Promise<number | null> {
  const res = await fetch(
    `https://groups.roblox.com/v1/users/${robloxId}/groups/roles`,
  );
  if (!res.ok) return null;
  const data = await res.json();
  for (const g of data?.data ?? []) {
    if (String(g?.group?.id) === String(groupId)) {
      return typeof g?.role?.rank === "number" ? g.role.rank : null;
    }
  }
  return null;
}

async function setRank(
  groupId: string,
  robloxId: string,
  roleId: number,
  cookie: string,
  csrfIn?: string,
): Promise<string> {
  let csrf = csrfIn ?? (await getCsrf(cookie));
  const doPatch = (token: string) =>
    fetch(`https://groups.roblox.com/v1/groups/${groupId}/users/${robloxId}`, {
      method: "PATCH",
      headers: {
        Cookie: `.ROBLOSECURITY=${cookie}`,
        "x-csrf-token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ roleId }),
    });

  let res = await doPatch(csrf);
  if (res.status === 403) {
    // Token may have rotated mid-flight — refresh once and retry.
    const refreshed = res.headers.get("x-csrf-token");
    if (refreshed) {
      csrf = refreshed;
      res = await doPatch(csrf);
    }
  }
  if (!res.ok) {
    throw new Error(`Roblox rank set failed (HTTP ${res.status}): ${await res.text()}`);
  }
  return csrf;
}

// discord_user_id -> roblox_id for every verified member of this bot.
async function verifiedMap(botId: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const { data } = await admin
    .from("roblox_verifications")
    .select("discord_user_id, roblox_id")
    .eq("bot_id", botId);
  for (const row of data ?? []) {
    const d = String(row.discord_user_id ?? "");
    const r = String(row.roblox_id ?? "");
    if (d && r) map.set(d, r);
  }
  return map;
}

// ── Handlers ────────────────────────────────────────────────────────────────

async function handleSet(req: Request, body: Record<string, unknown>) {
  const botId = String(body.bot_id ?? "");
  const groupId = String(body.group_id ?? "");
  const rankNumber = Number(body.rank_number);
  let robloxId = String(body.roblox_id ?? "");
  const discordId = String(body.discord_user_id ?? "");
  if (!botId || !groupId || !Number.isFinite(rankNumber)) {
    return json({ error: "Missing bot_id / group_id / rank_number." }, 400);
  }
  const authErr = await authBot(req, botId);
  if (authErr) return json({ error: authErr }, 403);
  const cookie = await resolveCookie(botId, workerToken(req));
  if (!cookie) return json({ error: "No Roblox cookie set. Add one in this bot's API keys & credentials." }, 500);

  if (!robloxId && discordId) {
    robloxId = (await verifiedMap(botId)).get(discordId) ?? "";
  }
  if (!robloxId) return json({ ok: true, changed: false, reason: "not_verified" });

  const roles = await getGroupRoles(groupId);
  const target = roles.get(rankNumber);
  if (!target) {
    return json({ ok: true, changed: false, reason: "no_such_rank" });
  }
  const current = await getCurrentRank(groupId, robloxId);
  if (current === null) {
    return json({ ok: true, changed: false, reason: "not_in_group" });
  }
  if (current === rankNumber) {
    return json({ ok: true, changed: false, reason: "already", to: rankNumber });
  }
  await setRank(groupId, robloxId, target.roleId, cookie);
  return json({ ok: true, changed: true, from: current, to: rankNumber });
}

async function handleSync(req: Request, body: Record<string, unknown>) {
  const botId = String(body.bot_id ?? "");
  const groupId = String(body.group_id ?? "");
  const desired = Array.isArray(body.desired) ? body.desired : [];
  if (!botId || !groupId) {
    return json({ error: "Missing bot_id / group_id." }, 400);
  }
  const authErr = await authBot(req, botId);
  if (authErr) return json({ error: authErr }, 403);
  const cookie = await resolveCookie(botId, workerToken(req));
  if (!cookie) return json({ error: "No Roblox cookie set. Add one in this bot's API keys & credentials." }, 500);

  const roles = await getGroupRoles(groupId);
  const verified = await verifiedMap(botId);

  let changed = 0, unchanged = 0, skipped = 0, failed = 0;
  const details: Array<Record<string, unknown>> = [];
  let csrf = "";

  for (const entry of desired) {
    const discordId = String((entry as Record<string, unknown>)?.discord_user_id ?? "");
    const rankNumber = Number((entry as Record<string, unknown>)?.rank_number);
    const robloxId = verified.get(discordId) ?? "";
    if (!robloxId) { skipped++; details.push({ discordId, reason: "not_verified" }); continue; }
    const target = roles.get(rankNumber);
    if (!target) { skipped++; details.push({ discordId, robloxId, reason: "no_such_rank", rank: rankNumber }); continue; }
    try {
      const current = await getCurrentRank(groupId, robloxId);
      if (current === null) { skipped++; details.push({ discordId, robloxId, reason: "not_in_group" }); continue; }
      if (current === rankNumber) { unchanged++; continue; }
      csrf = await setRank(groupId, robloxId, target.roleId, cookie, csrf || undefined);
      changed++;
      details.push({ discordId, robloxId, from: current, to: rankNumber });
      await sleep(200); // stay under Roblox's write rate limit
    } catch (e) {
      failed++;
      details.push({ discordId, robloxId, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return json({ ok: true, changed, unchanged, skipped, failed, details });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  try {
    if (body.action === "set") return await handleSet(req, body);
    if (body.action === "sync") return await handleSync(req, body);
    return json({ error: "Unknown action." }, 400);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("roblox-group-rank error:", message);
    return json({ error: message }, 500);
  }
});
