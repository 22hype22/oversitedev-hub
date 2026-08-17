// Giveaway persistence — so giveaways AND their entrants survive a bot redeploy.
//
// The bot keeps giveaways in memory; a restart wipes them. This persists each
// giveaway's metadata + entrant list per bot, so on boot the bot can restore
// every giveaway (with entrants + timers) and nobody's entry is ever lost.
//
// Body:
//   { action: "get_all" }                 -> { ok, giveaways: { gid: {meta, entrants} } }
//   { action: "get",       gid }          -> { ok, meta, entrants: [uid...] }
//   { action: "set_state", gid, meta, entrants } -> { ok }   (full snapshot)
//   { action: "add",       gid, uid }     -> { ok, count }   (fast per-click)
//   { action: "remove",    gid, uid }     -> { ok, count }
//   { action: "clear",     gid }          -> { ok }
//
// Stored in bot_config feature "giveaway-entries":
//   { entries: { [gid]: { meta: {...}, entrants: [uid...] } } }
//
// Auth: bot worker token (x-worker-token: wkr_...) via _worker_token_lookup.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-worker-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const FEATURE = "giveaway-entries";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getWorkerToken(req: Request): string {
  const raw =
    req.headers.get("x-worker-token") ??
    req.headers.get("x_worker_token") ??
    req.headers.get("authorization") ??
    "";
  const token = raw.replace(/^Bearer\s+/i, "").replace(/^['"]|['"]$/g, "").trim();
  return token.startsWith("wkr_") ? token : "";
}

async function resolveBotId(req: Request): Promise<string | null> {
  const token = getWorkerToken(req);
  if (!token) return null;
  const { data, error } = await admin.rpc("_worker_token_lookup", { _token: token });
  if (error || !data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return (row?.bot_id ?? row) || null;
}

type State = { meta: Record<string, unknown>; entrants: string[] };
type Entries = Record<string, State | string[]>;

// Legacy rows stored a bare [uid...] array; normalize to { meta, entrants }.
function normalize(v: State | string[] | undefined): State {
  if (Array.isArray(v)) return { meta: {}, entrants: v };
  return { meta: v?.meta ?? {}, entrants: Array.isArray(v?.entrants) ? v!.entrants : [] };
}

async function readEntries(botId: string): Promise<Entries> {
  const { data } = await admin
    .from("bot_config")
    .select("config")
    .eq("bot_id", botId)
    .eq("feature", FEATURE)
    .maybeSingle();
  const cfg = (data?.config ?? {}) as Record<string, unknown>;
  const e = cfg.entries;
  return (e && typeof e === "object" ? e : {}) as Entries;
}

async function writeEntries(botId: string, entries: Entries): Promise<void> {
  await admin.from("bot_config").upsert(
    { bot_id: botId, feature: FEATURE, config: { entries }, updated_at: new Date().toISOString() },
    { onConflict: "bot_id,feature" },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const botId = await resolveBotId(req);
  if (!botId) return json({ error: "Unauthorized" }, 401);

  let body: {
    action?: string;
    gid?: string;
    uid?: string;
    meta?: Record<string, unknown>;
    entrants?: string[];
  };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const action = String(body.action ?? "");

  try {
    if (action === "get_all") {
      const entries = await readEntries(botId);
      const out: Record<string, State> = {};
      for (const gid of Object.keys(entries)) out[gid] = normalize(entries[gid]);
      return json({ ok: true, giveaways: out });
    }

    const gid = String(body.gid ?? "").trim();
    if (!gid) return json({ error: "gid required" }, 400);

    if (action === "get") {
      const entries = await readEntries(botId);
      const s = normalize(entries[gid]);
      return json({ ok: true, meta: s.meta, entrants: s.entrants });
    }
    if (action === "set_state") {
      const entries = await readEntries(botId);
      const entrants = Array.isArray(body.entrants) ? body.entrants.map(String) : normalize(entries[gid]).entrants;
      entries[gid] = { meta: body.meta ?? normalize(entries[gid]).meta, entrants: Array.from(new Set(entrants)) };
      await writeEntries(botId, entries);
      return json({ ok: true, count: (entries[gid] as State).entrants.length });
    }
    if (action === "add" || action === "remove") {
      const uid = String(body.uid ?? "").trim();
      if (!uid) return json({ error: "uid required" }, 400);
      const entries = await readEntries(botId);
      const s = normalize(entries[gid]);
      const set = new Set(s.entrants);
      if (action === "add") set.add(uid);
      else set.delete(uid);
      entries[gid] = { meta: s.meta, entrants: Array.from(set) };
      await writeEntries(botId, entries);
      return json({ ok: true, count: (entries[gid] as State).entrants.length });
    }
    if (action === "clear") {
      const entries = await readEntries(botId);
      delete entries[gid];
      await writeEntries(botId, entries);
      return json({ ok: true });
    }
    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("giveaway-entries error:", message);
    return json({ error: message }, 500);
  }
});
