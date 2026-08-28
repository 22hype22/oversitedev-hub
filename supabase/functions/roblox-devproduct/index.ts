// Edge function: find-or-create a Roblox DEVELOPER PRODUCT by name.
// The bot's Purchase / Package flow uses this instead of gamepasses — it looks
// for a developer product with the same name in the store's universe and, if
// there isn't one, creates it at the given Robux price. Dev products can be
// bought from the web on the experience's Store tab (Roblox enabled this in
// Feb 2025 with "Allow external purchases").
//
// Auth: bot worker token (x-worker-token: wkr_...), validated via
// _worker_token_lookup. The Roblox cookie is the per-bot value the owner set in
// the dashboard ("API keys & credentials"), else the shared project cookie.
//
// Actions:
//   - find_or_create: { action, name, priceRobux, placeId? }
//        -> { ok, productId, existed, priceRobux, buyUrl, placeId }
//   - find:           { action, name, placeId? } -> { ok, productId|null, priceRobux? }

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
// Roblox retired cookie-based developer-product CREATION; the Open Cloud v2 API
// is the only way now and it authenticates with an API key (x-api-key), not the
// cookie. Owners set this per-bot in the dashboard ("API keys & credentials"),
// else the shared project key.
const ROBLOX_API_KEY = Deno.env.get("ROBLOX_API_KEY") ?? "";
// The experience dev products live in. Same store game the gamepass tools use.
const DEFAULT_PLACE_ID = Deno.env.get("ROBLOX_DEVPRODUCT_PLACE_ID") ?? "108687688483255";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---------------- auth ----------------
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

async function resolveCookie(botId: string, req: Request): Promise<string> {
  const token = getWorkerToken(req);
  if (token) {
    try {
      const { data, error } = await admin.rpc("runtime_get_bot_secret", {
        _token: token, _bot_id: botId, _key: "ROBLOX_COOKIE",
      });
      if (!error && typeof data === "string" && data.trim()) return data.trim();
    } catch (_e) { /* fall back to the project secret */ }
  }
  return ROBLOX_COOKIE;
}

async function resolveApiKey(botId: string, req: Request): Promise<string> {
  const token = getWorkerToken(req);
  if (token) {
    try {
      const { data, error } = await admin.rpc("runtime_get_bot_secret", {
        _token: token, _bot_id: botId, _key: "ROBLOX_API_KEY",
      });
      if (!error && typeof data === "string" && data.trim()) return data.trim();
    } catch (_e) { /* fall back to the project secret */ }
  }
  return ROBLOX_API_KEY;
}

// ---------------- Roblox helpers ----------------
const _universeCache: Record<string, string> = {};

async function resolveUniverseId(placeId: string): Promise<string> {
  if (_universeCache[placeId]) return _universeCache[placeId];
  const res = await fetch(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`);
  if (!res.ok) throw new Error(`Couldn't resolve universe for place ${placeId} (HTTP ${res.status})`);
  const data = await res.json();
  const uni = String(data?.universeId ?? "");
  if (!uni) throw new Error("Roblox returned no universeId");
  _universeCache[placeId] = uni;
  return uni;
}

async function getCsrf(cookie: string): Promise<string> {
  const res = await fetch("https://auth.roblox.com/v2/logout", {
    method: "POST",
    headers: { Cookie: `.ROBLOSECURITY=${cookie}` },
  });
  const token = res.headers.get("x-csrf-token");
  if (!token) throw new Error(`Couldn't get an x-csrf-token (HTTP ${res.status}). Is the Roblox cookie valid?`);
  return token;
}

const norm = (s: string) => String(s || "").trim().toLowerCase();

// Roblox retired the public "list developer products" endpoint (api.roblox.com
// no longer resolves), so instead of asking Roblox what exists we remember what
// WE created, per bot, in a bot_config cache. That avoids duplicates without any
// listing call. Key: "<placeId>:<name lowercased>" -> productId.
const DEVPRODUCT_FEATURE = "roblox-devproducts";
const cacheKey = (placeId: string, name: string) => `${placeId}:${norm(name)}`;

async function readDevCache(botId: string): Promise<Record<string, string>> {
  const { data } = await admin.from("bot_config").select("config")
    .eq("bot_id", botId).eq("feature", DEVPRODUCT_FEATURE).maybeSingle();
  const cfg = (data?.config ?? {}) as any;
  return (cfg && typeof cfg.products === "object" && cfg.products) ? cfg.products : {};
}

async function writeDevCache(botId: string, products: Record<string, string>) {
  await admin.from("bot_config").upsert(
    { bot_id: botId, feature: DEVPRODUCT_FEATURE, config: { products }, updated_at: new Date().toISOString() },
    { onConflict: "bot_id,feature" },
  );
}

async function createDevProduct(
  universeId: string, name: string, priceRobux: number, apiKey: string,
): Promise<string> {
  const nm = name.slice(0, 100);
  const price = Math.max(0, Math.round(priceRobux));
  // Open Cloud v2 — the only supported way to create a dev product now. Auth is
  // an API key (x-api-key). Body is multipart/form-data (it also allows an icon
  // file, which we don't send). Docs: create.roblox.com/docs/cloud/features/
  // developer-products.
  const url = `https://apis.roblox.com/developer-products/v2/universes/${universeId}/developer-products`;
  const form = new FormData();
  form.append("name", nm);
  form.append("description", "");
  form.append("isForSale", "true");
  form.append("price", String(price));
  const res = await fetch(url, {
    method: "POST",
    headers: { "x-api-key": apiKey },  // don't set Content-Type — fetch adds the multipart boundary
    body: form,
  });
  if (!res.ok) {
    const text = (await res.text()).slice(0, 300);
    throw new Error(`Dev product create failed (HTTP ${res.status}): ${text}`);
  }
  const data = await res.json();
  // Open Cloud returns the product resource; the id can be `id`, `productId`,
  // or the last segment of a `path` like "universes/X/developer-products/Y".
  let id = String(data?.id ?? data?.productId ?? data?.developerProductId ?? "");
  if (!id && typeof data?.path === "string") id = data.path.split("/").pop() ?? "";
  if (!id) throw new Error("Roblox response missing developer product id");
  return id;
}

// The web link a buyer opens to purchase — the experience's Store tab.
const buyUrlFor = (placeId: string) => `https://www.roblox.com/games/${placeId}/#!/store`;

// ---------------- handler ----------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const botId = await resolveBotId(req);
  if (!botId) return json({ error: "Unauthorized" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const action = String(body?.action ?? "");
  const name = String(body?.name ?? "").trim();
  const placeId = String(body?.placeId ?? DEFAULT_PLACE_ID);
  if (!name) return json({ error: "name is required" }, 400);

  try {
    if (action === "find") {
      const products = await readDevCache(botId);
      const id = products[cacheKey(placeId, name)] || null;
      return json({ ok: true, productId: id, buyUrl: buyUrlFor(placeId), placeId });
    }
    if (action === "find_or_create") {
      const priceRobux = Math.max(0, Math.round(Number(body?.priceRobux ?? 0)) || 0);
      const products = await readDevCache(botId);
      const key = cacheKey(placeId, name);
      if (products[key]) {
        return json({ ok: true, productId: products[key], existed: true, priceRobux, buyUrl: buyUrlFor(placeId), placeId });
      }
      const apiKey = await resolveApiKey(botId, req);
      if (!apiKey) {
        return json({ error: "No Roblox API key configured. Roblox no longer lets the .ROBLOSECURITY cookie create developer products — add a Roblox Open Cloud API key (with developer-product write access to the experience) in the dashboard under API keys & credentials." }, 500);
      }
      const universeId = await resolveUniverseId(placeId);
      const productId = await createDevProduct(universeId, name, priceRobux, apiKey);
      products[key] = productId;
      await writeDevCache(botId, products);
      return json({ ok: true, productId, existed: false, priceRobux, buyUrl: buyUrlFor(placeId), placeId });
    }
    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("roblox-devproduct error:", message);
    return json({ error: message }, 500);
  }
});
