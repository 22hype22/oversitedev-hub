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

// List a place's developer products (name + id + price), paging until the end.
async function findDevProductByName(placeId: string, name: string):
  Promise<{ productId: string; priceRobux: number } | null> {
  const want = norm(name);
  for (let page = 1; page <= 50; page++) {
    const res = await fetch(
      `https://api.roblox.com/developerproducts/list?placeid=${placeId}&page=${page}`,
    );
    if (!res.ok) break;
    const data = await res.json();
    const rows: any[] = data?.DeveloperProducts ?? data?.developerProducts ?? [];
    for (const p of rows) {
      const pname = p?.Name ?? p?.name ?? "";
      if (norm(pname) === want) {
        const id = String(p?.ProductId ?? p?.productId ?? p?.id ?? "");
        const price = Number(p?.PriceInRobux ?? p?.priceInRobux ?? 0) || 0;
        if (id) return { productId: id, priceRobux: price };
      }
    }
    if (data?.FinalPage === true || rows.length === 0) break;
  }
  return null;
}

async function createDevProduct(
  universeId: string, name: string, priceRobux: number, cookie: string,
): Promise<string> {
  let csrf = await getCsrf(cookie);
  const url = `https://apis.roblox.com/developer-products/v1/universes/${universeId}/developerproducts`
    + `?name=${encodeURIComponent(name.slice(0, 100))}`
    + `&description=${encodeURIComponent("")}`
    + `&priceInRobux=${Math.max(0, Math.round(priceRobux))}`;
  const doCreate = (token: string) =>
    fetch(url, {
      method: "POST",
      headers: { Cookie: `.ROBLOSECURITY=${cookie}`, "x-csrf-token": token },
    });
  let res = await doCreate(csrf);
  if (res.status === 403) {
    const refreshed = res.headers.get("x-csrf-token");
    if (refreshed) { csrf = refreshed; res = await doCreate(csrf); }
  }
  if (!res.ok) throw new Error(`Dev product create failed (HTTP ${res.status}): ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const id = String(data?.id ?? data?.ProductId ?? data?.productId ?? data?.developerProductId ?? "");
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
      const hit = await findDevProductByName(placeId, name);
      return json({ ok: true, productId: hit?.productId ?? null, priceRobux: hit?.priceRobux ?? null, buyUrl: buyUrlFor(placeId), placeId });
    }
    if (action === "find_or_create") {
      const priceRobux = Math.max(0, Math.round(Number(body?.priceRobux ?? 0)) || 0);
      const existing = await findDevProductByName(placeId, name);
      if (existing) {
        return json({ ok: true, productId: existing.productId, existed: true, priceRobux: existing.priceRobux, buyUrl: buyUrlFor(placeId), placeId });
      }
      const cookie = await resolveCookie(botId, req);
      if (!cookie) return json({ error: "No Roblox cookie configured" }, 500);
      const universeId = await resolveUniverseId(placeId);
      const productId = await createDevProduct(universeId, name, priceRobux, cookie);
      return json({ ok: true, productId, existed: false, priceRobux, buyUrl: buyUrlFor(placeId), placeId });
    }
    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("roblox-devproduct error:", message);
    return json({ error: message }, 500);
  }
});
