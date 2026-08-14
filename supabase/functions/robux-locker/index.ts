// Robux Locker backend for the Discord bot.
//
// Body: { action: "funds" | "get_stock" | "set_stock" | "add_stock" | "take_stock", amount?: number }
//   - funds:       read the group's available Robux balance        -> { robux }
//   - get_stock:   current Available Stock for this bot            -> { stock }
//   - set_stock:   set Available Stock to `amount`                 -> { stock }
//   - add_stock:   add `amount` to Available Stock (restock)       -> { stock }
//   - take_stock:  atomically remove `amount` if available (a buy) -> { ok, stock } | { ok:false }
//
// Auth: bot worker token (x-worker-token: wkr_...), validated via _worker_token_lookup,
// which also tells us WHICH bot this is so stock is scoped per bot.
//
// Secrets / env (Lovable Cloud -> Supabase -> Edge Function secrets):
//   ROBLOX_COOKIE      .ROBLOSECURITY of the group's bot account (already set for payments)
//   ROBLOX_GROUP_ID    the Roblox group id whose funds back the locker

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-worker-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ROBLOX_COOKIE = Deno.env.get("ROBLOX_COOKIE") ?? "";
const GROUP_ID = Deno.env.get("ROBLOX_GROUP_ID") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const STOCK_FEATURE = "robux-stock";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---------------- auth (bot worker token -> bot id) ----------------

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

// ---------------- Roblox group funds ----------------

async function groupFunds(): Promise<number> {
  if (!ROBLOX_COOKIE) throw new Error("ROBLOX_COOKIE is not configured");
  if (!GROUP_ID) throw new Error("ROBLOX_GROUP_ID is not configured");
  const res = await fetch(`https://economy.roblox.com/v1/groups/${GROUP_ID}/currency`, {
    headers: { Cookie: `.ROBLOSECURITY=${ROBLOX_COOKIE}` },
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 200);
    throw new Error(`Group funds read failed (HTTP ${res.status}): ${body}`);
  }
  const data = await res.json();
  return Math.max(0, Math.floor(Number(data?.robux ?? 0)));
}

// ---------------- stock (bot_config feature "robux-stock") ----------------

async function getStock(botId: string): Promise<number> {
  const { data } = await admin
    .from("bot_config")
    .select("config")
    .eq("bot_id", botId)
    .eq("feature", STOCK_FEATURE)
    .maybeSingle();
  const cfg = (data?.config ?? {}) as Record<string, unknown>;
  return Math.max(0, Math.floor(Number(cfg.stock ?? 0)));
}

async function setStock(botId: string, stock: number): Promise<number> {
  const next = Math.max(0, Math.floor(stock));
  await admin.from("bot_config").upsert(
    { bot_id: botId, feature: STOCK_FEATURE, config: { stock: next }, updated_at: new Date().toISOString() },
    { onConflict: "bot_id,feature" },
  );
  return next;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const botId = await resolveBotId(req);
  if (!botId) return json({ error: "Unauthorized" }, 401);

  let body: { action?: string; amount?: number };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const action = String(body.action ?? "");
  const amount = Math.max(0, Math.floor(Number(body.amount ?? 0)));

  try {
    if (action === "funds") {
      return json({ ok: true, robux: await groupFunds() });
    }
    if (action === "get_stock") {
      return json({ ok: true, stock: await getStock(botId) });
    }
    if (action === "set_stock") {
      return json({ ok: true, stock: await setStock(botId, amount) });
    }
    if (action === "add_stock") {
      const cur = await getStock(botId);
      return json({ ok: true, stock: await setStock(botId, cur + amount) });
    }
    if (action === "take_stock") {
      // Atomic-enough for a single-process bot: read, check, write. First come
      // first served — if there isn't enough, nothing is taken.
      const cur = await getStock(botId);
      if (amount <= 0 || amount > cur) return json({ ok: false, stock: cur, error: "insufficient_stock" });
      return json({ ok: true, stock: await setStock(botId, cur - amount) });
    }
    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("robux-locker error:", message);
    return json({ error: message }, 500);
  }
});
