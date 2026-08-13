// Creates a payment on demand for the /payment Discord command.
//
// Body: { method: "stripe" | "gamepass" | "shirt", item?: number (1-6), price: number }
//   - stripe:   price = USD dollars   -> { url } (a Stripe Payment Link)
//   - gamepass: price = Robux, item = which of the 6 payment gamepasses -> { url }
//   - shirt:    price = Robux, item = which of the 6 payment shirts     -> { url }
//
// Auth: bot worker token (x-worker-token: wkr_...), validated via _worker_token_lookup.
//
// Secrets / env (set in Lovable Cloud → Supabase → Edge Functions secrets):
//   ROBLOX_COOKIE          .ROBLOSECURITY of the group's bot account
//   ROBLOX_PLACE_ID        a place id in the game that hosts the gamepasses
//   ROBLOX_GAMEPASS_IDS    comma-separated gamepass ids for items 1..6
//   ROBLOX_SHIRT_IDS       comma-separated shirt (asset) ids for items 1..6
//   STRIPE_SECRET_KEY      sk_live_... or sk_test_...
//   STRIPE_CURRENCY        optional, default "usd"

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
const PLACE_ID = Deno.env.get("ROBLOX_PLACE_ID") ?? "";
const GAMEPASS_IDS = (Deno.env.get("ROBLOX_GAMEPASS_IDS") ?? "")
  .split(",").map((s) => s.trim()).filter(Boolean);
const SHIRT_IDS = (Deno.env.get("ROBLOX_SHIRT_IDS") ?? "")
  .split(",").map((s) => s.trim()).filter(Boolean);
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const STRIPE_CURRENCY = (Deno.env.get("STRIPE_CURRENCY") ?? "usd").toLowerCase();

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---------------- auth (bot worker token) ----------------

function getWorkerToken(req: Request): string {
  const raw =
    req.headers.get("x-worker-token") ??
    req.headers.get("x_worker_token") ??
    req.headers.get("authorization") ??
    "";
  const token = raw.replace(/^Bearer\s+/i, "").replace(/^['"]|['"]$/g, "").trim();
  return token.startsWith("wkr_") ? token : "";
}

async function authenticate(req: Request): Promise<boolean> {
  const token = getWorkerToken(req);
  if (!token) return false;
  const { data, error } = await admin.rpc("_worker_token_lookup", { _token: token });
  if (error || !data || (Array.isArray(data) && data.length === 0)) return false;
  return true;
}

// ---------------- Roblox helpers ----------------

let cachedUniverseId: string | null = null;
async function resolveUniverseId(): Promise<string> {
  if (cachedUniverseId) return cachedUniverseId;
  if (!PLACE_ID) throw new Error("ROBLOX_PLACE_ID is not configured");
  const res = await fetch(`https://apis.roblox.com/universes/v1/places/${PLACE_ID}/universe`);
  if (!res.ok) throw new Error(`Failed to resolve universe id (HTTP ${res.status})`);
  const data = await res.json();
  if (!data?.universeId) throw new Error("Roblox returned no universeId");
  cachedUniverseId = String(data.universeId);
  return cachedUniverseId;
}

async function getCsrfToken(): Promise<string> {
  const res = await fetch("https://auth.roblox.com/v2/logout", {
    method: "POST",
    headers: { Cookie: `.ROBLOSECURITY=${ROBLOX_COOKIE}` },
  });
  const token = res.headers.get("x-csrf-token");
  if (!token) throw new Error(`Failed to get x-csrf-token (HTTP ${res.status}). Is ROBLOX_COOKIE valid?`);
  return token;
}

async function updateGamepassPrice(gamepassId: string, priceRobux: number): Promise<void> {
  const universeId = await resolveUniverseId();
  let csrf = await getCsrfToken();
  const doUpdate = (token: string) => {
    const form = new FormData();
    form.append("isForSale", priceRobux > 0 ? "true" : "false");
    form.append("price", String(priceRobux));
    return fetch(
      `https://apis.roblox.com/game-passes/v1/universes/${universeId}/game-passes/${gamepassId}`,
      { method: "PATCH", headers: { Cookie: `.ROBLOSECURITY=${ROBLOX_COOKIE}`, "x-csrf-token": token }, body: form },
    );
  };
  let res = await doUpdate(csrf);
  if (res.status === 403) {
    const refreshed = res.headers.get("x-csrf-token");
    if (refreshed) { csrf = refreshed; res = await doUpdate(csrf); }
  }
  if (!res.ok) throw new Error(`Gamepass price update failed (HTTP ${res.status}): ${await res.text()}`);
}

async function itemConfigPost(assetId: string, path: string, payload: unknown): Promise<Response> {
  let csrf = await getCsrfToken();
  const doReq = (token: string) =>
    fetch(`https://itemconfiguration.roblox.com/v1/assets/${assetId}/${path}`, {
      method: "POST",
      headers: {
        Cookie: `.ROBLOSECURITY=${ROBLOX_COOKIE}`,
        "x-csrf-token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  let res = await doReq(csrf);
  if (res.status === 403) {
    const refreshed = res.headers.get("x-csrf-token");
    if (refreshed) { csrf = refreshed; res = await doReq(csrf); }
  }
  return res;
}

async function assetDetails(assetId: string): Promise<string> {
  // Public endpoint — confirms the id is a real, on-sale-able asset and its type.
  try {
    const res = await fetch(`https://economy.roblox.com/v2/assets/${assetId}/details`);
    if (!res.ok) return `details HTTP ${res.status} (id may be wrong/not an asset)`;
    const d = await res.json();
    const typeNames: Record<number, string> = { 2: "T-Shirt", 11: "Shirt", 12: "Pants" };
    return `name="${d?.Name}", type=${typeNames[d?.AssetTypeId] ?? d?.AssetTypeId}, creator=${d?.Creator?.Name}(${d?.Creator?.CreatorType}), forSale=${d?.IsForSale}, price=${d?.PriceInRobux}`;
  } catch (e) {
    return `details fetch error: ${String(e).slice(0, 80)}`;
  }
}

// New-system avatar items (big 15+ digit ids) are "collectibles" — their price
// lives under a collectibleItemId, not the plain asset id. Resolve it first.
async function resolveCollectibleId(assetId: string): Promise<string | null> {
  try {
    const csrf = await getCsrfToken();
    const res = await fetch("https://catalog.roblox.com/v1/catalog/items/details", {
      method: "POST",
      headers: {
        Cookie: `.ROBLOSECURITY=${ROBLOX_COOKIE}`,
        "x-csrf-token": csrf,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ items: [{ itemType: "Asset", id: Number(assetId) }] }),
    });
    if (!res.ok) return null;
    const d = await res.json();
    return d?.data?.[0]?.collectibleItemId ?? null;
  } catch {
    return null;
  }
}

async function collectiblePatch(collectibleItemId: string, priceRobux: number): Promise<Response> {
  let csrf = await getCsrfToken();
  const doReq = (token: string) =>
    fetch(`https://itemconfiguration.roblox.com/v1/collectibles/${collectibleItemId}`, {
      method: "PATCH",
      headers: {
        Cookie: `.ROBLOSECURITY=${ROBLOX_COOKIE}`,
        "x-csrf-token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ saleStatus: "OnSale", isFree: false, priceInRobux: priceRobux, priceConfiguration: { priceInRobux: priceRobux } }),
    });
  let res = await doReq(csrf);
  if (res.status === 403) {
    const refreshed = res.headers.get("x-csrf-token");
    if (refreshed) { csrf = refreshed; res = await doReq(csrf); }
  }
  return res;
}

async function updateShirtPrice(assetId: string, priceRobux: number): Promise<void> {
  // Try every known clothing-pricing path and report which responds, so a single
  // test tells us the right endpoint. Classic assets use /update-price|/release;
  // new-system items use the collectibles endpoint (needs collectibleItemId).
  const priceConfiguration = { priceInRobux: priceRobux };
  const attempts: string[] = [];

  let res = await itemConfigPost(assetId, "update-price", { priceConfiguration });
  if (res.ok) return;
  attempts.push(`update-price -> ${res.status}: ${(await res.text()).slice(0, 120)}`);

  res = await itemConfigPost(assetId, "release", { saleStatus: "OnSale", priceConfiguration });
  if (res.ok) return;
  attempts.push(`release -> ${res.status}: ${(await res.text()).slice(0, 120)}`);

  const collectibleId = await resolveCollectibleId(assetId);
  if (collectibleId) {
    res = await collectiblePatch(collectibleId, priceRobux);
    if (res.ok) return;
    attempts.push(`collectible(${collectibleId}) -> ${res.status}: ${(await res.text()).slice(0, 120)}`);
  } else {
    attempts.push("collectibleId -> not resolved");
  }

  const info = await assetDetails(assetId);
  throw new Error(`Shirt price update failed for asset ${assetId} [${info}]. ${attempts.join(" || ")}`);
}

// ---------------- Stripe (Payment Link for an ad-hoc amount) ----------------

async function stripeForm(path: string, params: Record<string, string>): Promise<any> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params).toString(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Stripe ${path} failed: ${data?.error?.message ?? res.status}`);
  return data;
}

async function stripeGet(path: string): Promise<any> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Stripe GET ${path} failed: ${data?.error?.message ?? res.status}`);
  return data;
}

// One shared product for all payments (reused across cold starts via search).
let cachedProductId: string | null = null;
async function getPaymentProductId(): Promise<string> {
  if (cachedProductId) return cachedProductId;
  try {
    const q = encodeURIComponent("active:'true' AND metadata['app']:'oversite_payment'");
    const search = await stripeGet(`products/search?query=${q}&limit=1`);
    if (search?.data?.length) { cachedProductId = search.data[0].id; return cachedProductId!; }
  } catch (_) { /* search may lag; fall through to create */ }
  const prod = await stripeForm("products", {
    name: "Oversite Customs Payment",
    "metadata[app]": "oversite_payment",
  });
  cachedProductId = prod.id;
  return cachedProductId!;
}

async function createStripePaymentLink(dollars: number, _label: string): Promise<string> {
  if (!STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not configured");
  const amount = Math.round(dollars * 100);
  const lookupKey = `ovs_pay_${STRIPE_CURRENCY}_${amount}`;

  // Reuse: a price for this exact amount stores its payment link in metadata, so
  // repeat amounts return the SAME link instead of piling up new products.
  try {
    const found = await stripeGet(`prices?lookup_keys[]=${encodeURIComponent(lookupKey)}&active=true&limit=1`);
    const existing = found?.data?.[0];
    if (existing?.metadata?.payment_link) return existing.metadata.payment_link as string;
  } catch (_) { /* fall through to create */ }

  const productId = await getPaymentProductId();
  const price = await stripeForm("prices", {
    unit_amount: String(amount),
    currency: STRIPE_CURRENCY,
    product: productId,
    lookup_key: lookupKey,
    transfer_lookup_key: "true",
  });
  const link = await stripeForm("payment_links", {
    "line_items[0][price]": price.id,
    "line_items[0][quantity]": "1",
  });
  // Remember the link on the price so future calls for this amount reuse it.
  try { await stripeForm(`prices/${price.id}`, { "metadata[payment_link]": link.url }); } catch (_) {}
  return link.url as string;
}

// ---------------- handler ----------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!(await authenticate(req))) return json({ error: "Unauthorized" }, 401);

  let body: { method?: string; item?: number; price?: number };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const method = String(body.method ?? "").toLowerCase();
  const price = Number(body.price);
  const item = Number(body.item);
  if (!Number.isFinite(price) || price <= 0) return json({ error: "Enter a valid price above 0." }, 400);

  try {
    if (method === "stripe") {
      const url = await createStripePaymentLink(price, "Oversite Customs payment");
      return json({ ok: true, method, url, label: `$${price.toFixed(2)} (Stripe)` });
    }

    if (method === "gamepass" || method === "shirt") {
      if (!ROBLOX_COOKIE) return json({ error: "ROBLOX_COOKIE is not configured" }, 500);
      if (!Number.isInteger(item) || item < 1 || item > 6) return json({ error: "Pick an item number 1–6." }, 400);
      const robux = Math.round(price);

      if (method === "gamepass") {
        const id = GAMEPASS_IDS[item - 1];
        if (!id) return json({ error: `No gamepass configured for item ${item} (set ROBLOX_GAMEPASS_IDS).` }, 400);
        await updateGamepassPrice(id, robux);
        return json({ ok: true, method, item, url: `https://www.roblox.com/game-pass/${id}/`, label: `Gamepass #${item} — ${robux} Robux` });
      }

      const id = SHIRT_IDS[item - 1];
      if (!id) return json({ error: `No shirt configured for item ${item} (set ROBLOX_SHIRT_IDS).` }, 400);
      await updateShirtPrice(id, robux);
      return json({ ok: true, method, item, url: `https://www.roblox.com/catalog/${id}/`, label: `Shirt #${item} — ${robux} Robux` });
    }

    return json({ error: "Unknown method — use stripe, gamepass, or shirt." }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("payment-create error:", message);
    return json({ error: message }, 500);
  }
});
