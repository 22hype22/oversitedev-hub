// Pricing store for the Discord bot.
//
// The dashboard "Pricing" block defines the STRUCTURE (services + their
// sub-items). Designers fill in the actual prices from Discord via /setpricing,
// which is what this function persists (per bot, so each bot keeps its own).
//
// Body: { action: "get" } | { action: "set", entries: [{ service, user, item, robux, usd }] }
//   - get: current prices for this bot                 -> { ok, prices }
//   - set: merge the given entries into the prices      -> { ok, prices }
//
// prices shape (PER DESIGNER): { [service]: { [userId]: { [item]: { robux, usd } } } }
//
// Auth: bot worker token (x-worker-token: wkr_...), validated via
// _worker_token_lookup, which also tells us WHICH bot this is.

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

const PRICING_FEATURE = "customs-pricing-values";

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

type PriceEntry = { robux?: string; usd?: string };
// Per designer: { [service]: { [userId]: { [item]: { robux, usd } } } }.
type Prices = Record<string, Record<string, Record<string, PriceEntry>>>;

async function readPrices(botId: string): Promise<Prices> {
  const { data } = await admin
    .from("bot_config")
    .select("config")
    .eq("bot_id", botId)
    .eq("feature", PRICING_FEATURE)
    .maybeSingle();
  const cfg = (data?.config ?? {}) as Record<string, unknown>;
  const prices = cfg.prices;
  return (prices && typeof prices === "object" ? prices : {}) as Prices;
}

async function writePrices(botId: string, prices: Prices): Promise<Prices> {
  await admin.from("bot_config").upsert(
    { bot_id: botId, feature: PRICING_FEATURE, config: { prices }, updated_at: new Date().toISOString() },
    { onConflict: "bot_id,feature" },
  );
  return prices;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const botId = await resolveBotId(req);
  if (!botId) return json({ error: "Unauthorized" }, 401);

  let body: {
    action?: string;
    entries?: Array<{ service?: string; user?: string; item?: string; robux?: string; usd?: string }>;
  };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const action = String(body.action ?? "");

  try {
    if (action === "get") {
      return json({ ok: true, prices: await readPrices(botId) });
    }
    if (action === "set") {
      // Prices are PER DESIGNER: prices[service][userId][item] = { robux, usd }.
      // An entry with both blank clears that item; a user with no items is dropped.
      const prices = await readPrices(botId);
      for (const e of body.entries ?? []) {
        const service = String(e?.service ?? "").trim();
        const user = String(e?.user ?? "").trim();
        const item = String(e?.item ?? "").trim();
        if (!service || !user || !item) continue;
        const robux = String(e?.robux ?? "").trim();
        const usd = String(e?.usd ?? "").trim();
        if (!prices[service]) prices[service] = {};
        if (!prices[service][user]) prices[service][user] = {};
        if (robux || usd) prices[service][user][item] = { robux, usd };
        else delete prices[service][user][item];
        if (Object.keys(prices[service][user]).length === 0) delete prices[service][user];
      }
      return json({ ok: true, prices: await writePrices(botId, prices) });
    }
    if (action === "remove_user") {
      // Drop ALL of a designer's prices across every service (they left the server).
      const user = String(body.user ?? "").trim();
      if (!user) return json({ error: "user required" }, 400);
      const prices = await readPrices(botId);
      let changed = false;
      for (const service of Object.keys(prices)) {
        if (prices[service] && prices[service][user]) {
          delete prices[service][user];
          changed = true;
        }
      }
      return json({ ok: true, prices: changed ? await writePrices(botId, prices) : prices });
    }
    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("pricing error:", message);
    return json({ error: message }, 500);
  }
});
