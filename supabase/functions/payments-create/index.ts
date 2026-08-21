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
//   ROBLOX_SHIRT_COLLECTIBLE_IDS  comma-separated collectibleItemId UUIDs for
//                          items 1..6 (new-system shirts; required to set price)
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
// New-system shirts are priced by their collectibleItemId (a UUID). Optional —
// if set (comma-separated, aligned to items 1..6) we use it directly; otherwise
// we resolve it from the asset id at runtime.
const SHIRT_COLLECTIBLE_IDS = (Deno.env.get("ROBLOX_SHIRT_COLLECTIBLE_IDS") ?? "")
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

async function resolveBotId(req: Request): Promise<string | null> {
  const token = getWorkerToken(req);
  if (!token) return null;
  const { data, error } = await admin.rpc("_worker_token_lookup", { _token: token });
  if (error || !data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return (row?.bot_id ?? row) || null;
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

// New-system clothing ("collectibles") is priced through this endpoint. Body
// matches Roblox's own creator-page PATCH exactly — a partial body 400s, so we
// send the full sale configuration with the new price.
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
      body: JSON.stringify({
        saleLocationConfiguration: { saleLocationType: 1, places: [] },
        saleStatus: 0,
        quantityLimitPerUser: 0,
        resaleRestriction: 2,
        priceInRobux: priceRobux,
        priceOffset: 0,
        isFree: false,
      }),
    });
  let res = await doReq(csrf);
  if (res.status === 403) {
    const refreshed = res.headers.get("x-csrf-token");
    if (refreshed) { csrf = refreshed; res = await doReq(csrf); }
  }
  return res;
}

async function updateShirtPrice(
  assetId: string,
  priceRobux: number,
  collectibleId?: string,
): Promise<void> {
  // New-system shirts are collectibles: price lives under a collectibleItemId
  // (a UUID). Use the configured one if present, else resolve it from the asset
  // id at runtime, then PATCH the collectibles endpoint.
  const cid = collectibleId || (await resolveCollectibleId(assetId));
  if (cid) {
    const res = await collectiblePatch(cid, priceRobux);
    if (res.ok) return;
    const bodyText = (await res.text()).slice(0, 160);
    const info = await assetDetails(assetId);
    throw new Error(
      `Shirt price update failed for asset ${assetId} via collectible ${cid} ` +
      `(HTTP ${res.status}: ${bodyText}) [${info}]`,
    );
  }

  // Fallback for older classic assets that still use the asset-scoped endpoints.
  const priceConfiguration = { priceInRobux: priceRobux };
  const attempts: string[] = [];
  let res = await itemConfigPost(assetId, "update-price", { priceConfiguration });
  if (res.ok) return;
  attempts.push(`update-price -> ${res.status}: ${(await res.text()).slice(0, 120)}`);
  res = await itemConfigPost(assetId, "release", { saleStatus: "OnSale", priceConfiguration });
  if (res.ok) return;
  attempts.push(`release -> ${res.status}: ${(await res.text()).slice(0, 120)}`);

  const info = await assetDetails(assetId);
  throw new Error(
    `Shirt price update failed for asset ${assetId} — no collectibleItemId could ` +
    `be resolved (set ROBLOX_SHIRT_COLLECTIBLE_IDS). [${info}]. ${attempts.join(" || ")}`,
  );
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

async function findOrCreatePrice(amount: number, lookupKey: string): Promise<string> {
  try {
    const found = await stripeGet(`prices?lookup_keys[]=${encodeURIComponent(lookupKey)}&active=true&limit=1`);
    const existing = found?.data?.[0];
    if (existing?.id) return existing.id as string;
  } catch (_) { /* fall through to create */ }
  const productId = await getPaymentProductId();
  const price = await stripeForm("prices", {
    unit_amount: String(amount),
    currency: STRIPE_CURRENCY,
    product: productId,
    lookup_key: lookupKey,
    transfer_lookup_key: "true",
  });
  return price.id as string;
}

// Create (or reuse) a Stripe Payment Link for `dollars`.
//
// When `metadata` is given, it's stamped onto each PaymentIntent this link
// creates (payment_intent_data.metadata) — customs links carry { app, bot_id }
// so the purchase-log poller can find this bot's payments. Those links are made
// fresh (not reused) so the tag is always present. Plain (no-metadata) links
// keep the old reuse-by-amount behavior.
async function createStripePaymentLink(
  dollars: number,
  attribution?: Record<string, string>,
): Promise<string> {
  if (!STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not configured");
  const amount = Math.round(dollars * 100);
  const lookupKey = `ovs_pay_${STRIPE_CURRENCY}_${amount}`;

  if (!attribution) {
    // Reuse: a price for this exact amount stores its payment link in metadata,
    // so repeat amounts return the SAME link instead of piling up new products.
    try {
      const found = await stripeGet(`prices?lookup_keys[]=${encodeURIComponent(lookupKey)}&active=true&limit=1`);
      const existing = found?.data?.[0];
      if (existing?.metadata?.payment_link) return existing.metadata.payment_link as string;
    } catch (_) { /* fall through to create */ }
    const priceId = await findOrCreatePrice(amount, lookupKey);
    const link = await stripeForm("payment_links", {
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
    });
    try { await stripeForm(`prices/${priceId}`, { "metadata[payment_link]": link.url }); } catch (_) {}
    return link.url as string;
  }

  // Attributed: fresh link carrying the buyer's metadata on the PaymentIntent.
  const priceId = await findOrCreatePrice(amount, lookupKey);
  const params: Record<string, string> = {
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
  };
  for (const [k, v] of Object.entries(attribution)) {
    params[`payment_intent_data[metadata][${k}]`] = v;
  }
  const link = await stripeForm("payment_links", params);
  return link.url as string;
}

// ---------------- purchase-log poller support (customs Stripe sales) ----------------
//
// The bot polls stripe_recent every ~30s and logs new succeeded PaymentIntents
// that carry our attribution metadata for THIS bot. A per-bot cursor
// (bot_config feature "customs-stripe-state-v1") dedups so each sale logs once.

const STRIPE_APP_TAG = "oversite_payment_customs";

async function stripeRecent(botId: string, limit: number): Promise<Array<Record<string, unknown>>> {
  if (!STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not configured");
  // Expand the charge so we can read the payer's billing name/email (Stripe has
  // no Discord identity — this is the best "customer" we can show).
  const data = await stripeGet(
    `payment_intents?limit=${Math.min(100, Math.max(1, limit))}&expand[]=data.latest_charge`,
  );
  const rows: any[] = Array.isArray(data?.data) ? data.data : [];
  return rows
    .filter((pi) =>
      pi?.status === "succeeded" &&
      pi?.metadata?.app === STRIPE_APP_TAG &&
      String(pi?.metadata?.bot_id ?? "") === botId
    )
    .map((pi) => {
      const bd = pi?.latest_charge?.billing_details ?? {};
      return {
        id: String(pi.id),
        created: Number(pi.created ?? 0),
        amount: Number(pi.amount_received ?? pi.amount ?? 0),
        currency: String(pi.currency ?? STRIPE_CURRENCY),
        customer_name: String(bd?.name ?? ""),
        customer_email: String(bd?.email ?? pi?.receipt_email ?? ""),
      };
    });
}

async function stripeStateGet(botId: string): Promise<string[]> {
  const { data } = await admin.from("bot_config").select("config")
    .eq("bot_id", botId).eq("feature", "customs-stripe-state-v1").maybeSingle();
  const cfg = (data?.config ?? {}) as Record<string, unknown>;
  return Array.isArray(cfg.seen_ids) ? (cfg.seen_ids as unknown[]).map(String) : [];
}

async function stripeStateSet(botId: string, seen: string[]): Promise<void> {
  await admin.from("bot_config").upsert(
    { bot_id: botId, feature: "customs-stripe-state-v1", config: { seen_ids: seen.slice(-500) }, updated_at: new Date().toISOString() },
    { onConflict: "bot_id,feature" },
  );
}

// ---------------- handler ----------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const botId = await resolveBotId(req);
  if (!botId) return json({ error: "Unauthorized" }, 401);

  let body: {
    action?: string; method?: string; item?: number; price?: number;
    discord_id?: string; guild_id?: string; customer_name?: string;
    limit?: number; seen_ids?: unknown[];
  };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const action = String(body.action ?? "");

  try {
    // ---- purchase-log poller actions (no payment creation) ----
    if (action === "stripe_recent") {
      return json({ ok: true, sales: await stripeRecent(botId, Number(body.limit ?? 25)) });
    }
    if (action === "stripe_state_get") {
      return json({ ok: true, seen_ids: await stripeStateGet(botId) });
    }
    if (action === "stripe_state_set") {
      const seen = Array.isArray(body.seen_ids) ? body.seen_ids.map(String) : [];
      await stripeStateSet(botId, seen);
      return json({ ok: true });
    }

    const method = String(body.method ?? "").toLowerCase();
    const price = Number(body.price);
    const item = Number(body.item);
    if (!Number.isFinite(price) || price <= 0) return json({ error: "Enter a valid price above 0." }, 400);

    if (method === "stripe") {
      // Tag every customs Stripe link with app + bot_id (invisible to the buyer)
      // so the purchase-log poller can find THIS bot's payments and skip unrelated
      // charges on the same Stripe account. Stripe never sees Discord identity, so
      // the log's Customer is the payer's own name/email from the charge.
      const url = await createStripePaymentLink(price, { app: STRIPE_APP_TAG, bot_id: botId });
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
        return json({ ok: true, method, item, url: `https://www.roblox.com/game-pass/${id}/`, label: `R$${robux} (Gamepass)` });
      }

      const id = SHIRT_IDS[item - 1];
      if (!id) return json({ error: `No shirt configured for item ${item} (set ROBLOX_SHIRT_IDS).` }, 400);
      const cid = SHIRT_COLLECTIBLE_IDS[item - 1];
      await updateShirtPrice(id, robux, cid);
      return json({ ok: true, method, item, url: `https://www.roblox.com/catalog/${id}/`, label: `R$${robux} (Shirt)` });
    }

    return json({ error: "Unknown method — use stripe, gamepass, or shirt." }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("payment-create error:", message);
    return json({ error: message }, 500);
  }
});
