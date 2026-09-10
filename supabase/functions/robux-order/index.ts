// Robux checkout for bot orders.
//
// The buyer links their Roblox account on the site (roblox-verify, site
// login) and says whether it is a Roblox Select account. The price is the
// order total plus a 30 percent markup at 10,000 Robux per 100 dollars,
// rounded to end in 999.
//
//   Roblox Select account  -> one of the group's payment shirts is re-priced
//                             to the order and the buyer purchases it from the
//                             catalog.
//   Standard account       -> a game pass is created for the order in one of
//                             the payment experiences and bought from its
//                             page. Roblox stopped selling developer products
//                             outside the game in 2026; that code only serves
//                             orders that already carry one.
//
// Both show up as sales in the group's Robux transactions, which is how the
// purchase is confirmed: a sale by that Roblox user for that item. Shirts are
// also checked against the buyer's inventory as a fallback.
//
// Actions (all need the customer's JWT; the order must belong to them):
//   status { orderId }          -> where the order is, plus the linked account
//   start  { orderId, kind }    -> sets up the shirt or product for the order
//   verify { orderId }          -> confirms the sale, marks the order paid
//
// Env: ROBLOX_COOKIE (.ROBLOSECURITY of the group's account), ROBLOX_SHIRT_IDS
// (the payment shirts, comma separated), optional ROBLOX_SHIRT_COLLECTIBLE_IDS,
// ROBLOX_API_KEY (Open Cloud key with developer product write access to the
// Payment experience), optional ROBLOX_ORDER_PLACE_ID and ROBLOX_GROUP_ID.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { robuxProductThumb } from "../_shared/robux-product-thumb.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ROBLOX_COOKIE = Deno.env.get("ROBLOX_COOKIE") ?? "";
const ROBLOX_API_KEY = Deno.env.get("ROBLOX_API_KEY") ?? "";
// The experiences that hold order passes, in the order they are used. When
// one has reached Roblox's limit of passes on sale, the next one is used.
const PLACE_IDS = (Deno.env.get("ROBLOX_ORDER_PLACE_IDS") || Deno.env.get("ROBLOX_ORDER_PLACE_ID") || "99629898994812,128739314806275")
  .split(",").map((s) => s.trim()).filter(Boolean);
const PLACE_ID = PLACE_IDS[0];
const GROUP_ID_ENV = Deno.env.get("ROBLOX_GROUP_ID") ?? "";
const SHIRT_IDS = (Deno.env.get("ROBLOX_SHIRT_IDS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const SHIRT_COLLECTIBLE_IDS = (Deno.env.get("ROBLOX_SHIRT_COLLECTIBLE_IDS") ?? "").split(",").map((s) => s.trim());
const GAMEPASS_ITEM_TYPE = 1;
// Fixed price rule. Keep in step with src/hooks/useRobuxCheckout.tsx.
const ROBUX_PER_USD = 100;
const ROBUX_MARKUP = 1.3;
// What a comped account pays on Roblox: a token amount, at Roblox's minimum
// for each item type, so the flow can still be tested end to end.
const COMPED_TEST_ROBUX = { devproduct: 1, shirt: 5, gamepass: 1 } as const;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const gamepassUrl = (id: string) => `https://www.roblox.com/game-pass/${id}/`;
const shirtUrl = (id: string) => `https://www.roblox.com/catalog/${id}/`;
let cachedUniverseId: string | null = null;
// A developer product has its own web page once the experience id is known;
// until then the experience's Store tab is the fallback.
const storeUrl = (productId?: string | null) =>
  productId && cachedUniverseId
    ? `https://www.roblox.com/developer-product/${cachedUniverseId}/product/${productId}`
    : `https://www.roblox.com/games/${PLACE_ID}/#!/store`;
const cookieHeaders = (extra: Record<string, string> = {}) => ({ Cookie: `.ROBLOSECURITY=${ROBLOX_COOKIE}`, ...extra });

// ---------------- Roblox session helpers ----------------

const universeByPlace = new Map<string, string>();
async function universeForPlace(placeId: string): Promise<string> {
  const hit = universeByPlace.get(placeId);
  if (hit) return hit;
  const res = await fetch(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`);
  if (!res.ok) throw new Error(`Couldn't resolve the payment place (HTTP ${res.status}).`);
  const data = await res.json();
  if (!data?.universeId) throw new Error("Roblox returned no universe for the payment place.");
  universeByPlace.set(placeId, String(data.universeId));
  return String(data.universeId);
}
async function resolveUniverseId(): Promise<string> {
  if (cachedUniverseId) return cachedUniverseId;
  cachedUniverseId = await universeForPlace(PLACE_ID);
  return cachedUniverseId;
}
async function passUniverses(): Promise<string[]> {
  const out: string[] = [];
  for (const placeId of PLACE_IDS) {
    try { out.push(await universeForPlace(placeId)); } catch (e) { console.warn("robux-order: place skipped", placeId, (e as Error)?.message); }
  }
  if (out.length === 0) throw new Error("No payment experience is configured.");
  return out;
}

// The group that owns the Payment experience. Its transactions list is where
// every sale, shirt or product, is confirmed.
let cachedGroupId: string | null = null;
async function resolveGroupId(): Promise<string> {
  if (GROUP_ID_ENV) return GROUP_ID_ENV;
  if (cachedGroupId) return cachedGroupId;
  const universeId = await resolveUniverseId();
  const res = await fetch(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
  if (!res.ok) throw new Error(`Couldn't read the payment experience (HTTP ${res.status}).`);
  const data = await res.json();
  const creator = data?.data?.[0]?.creator;
  if (!creator?.id || creator?.type !== "Group") throw new Error("The payment experience is not owned by a group.");
  cachedGroupId = String(creator.id);
  return cachedGroupId;
}

async function getCsrfToken(): Promise<string> {
  const res = await fetch("https://auth.roblox.com/v2/logout", { method: "POST", headers: cookieHeaders() });
  const token = res.headers.get("x-csrf-token");
  if (!token) throw new Error(`Roblox session refused (HTTP ${res.status}). Is ROBLOX_COOKIE valid?`);
  return token;
}

async function withCsrf(doReq: (token: string) => Promise<Response>): Promise<Response> {
  let res = await doReq(await getCsrfToken());
  if (res.status === 403) {
    const refreshed = res.headers.get("x-csrf-token");
    if (refreshed) res = await doReq(refreshed);
  }
  return res;
}

// ---------------- per-order game passes (standard accounts) ----------------
//
// Each order gets its own pass, named after the bot, priced to the order and
// bought from the pass page. Passes belong to the group's payment experiences;
// Roblox caps how many can be on sale per experience, so a pass comes off
// sale once paid, stale unpaid ones are cleared, and when an experience is
// full the next one is used.

type OrderPass = { id: string; name: string; price: number; forSale: boolean; ours: boolean };

function passRow(r: any): OrderPass {
  return {
    id: String(r?.gamePassId ?? r?.id ?? ""),
    name: String(r?.name ?? ""),
    price: Number(r?.priceInformation?.defaultPriceInRobux ?? r?.price ?? NaN),
    forSale: r?.isForSale !== false,
    ours: String(r?.description ?? "") === PRODUCT_DESCRIPTION,
  };
}

async function passLimitReached(universeId: string): Promise<boolean> {
  const res = await fetch(`https://apis.roblox.com/game-passes/v1/game-passes/universes/${universeId}/sales-limit`, { headers: cookieHeaders() });
  if (!res.ok) throw new Error(`Roblox wouldn't report the pass limit (HTTP ${res.status}).`);
  const data = await res.json();
  return data?.hasLimitBeenReached === true;
}

async function listOurPasses(universeId: string): Promise<OrderPass[]> {
  const res = await fetch(`https://apis.roblox.com/game-passes/v1/universes/${universeId}/game-passes/creator?pageSize=100`, { headers: cookieHeaders() });
  if (!res.ok) throw new Error(`Roblox wouldn't list the passes (HTTP ${res.status}).`);
  const data = await res.json();
  const rows: any[] = Array.isArray(data?.gamePasses) ? data.gamePasses : Array.isArray(data?.data) ? data.data : [];
  return rows.map(passRow).filter((r) => r.id && r.ours);
}

async function updatePass(universeId: string, passId: string, fields: { price?: number; forSale?: boolean; name?: string }): Promise<boolean> {
  const res = await withCsrf((token) => {
    const form = new FormData();
    if (fields.name !== undefined) form.append("name", fields.name.slice(0, 50));
    if (fields.forSale !== undefined) form.append("isForSale", fields.forSale ? "true" : "false");
    if (fields.price !== undefined) form.append("price", String(Math.max(1, Math.round(fields.price))));
    return fetch(`https://apis.roblox.com/game-passes/v1/universes/${universeId}/game-passes/${passId}`, {
      method: "PATCH",
      headers: cookieHeaders({ "x-csrf-token": token }),
      body: form,
    });
  });
  return res.ok;
}

async function createPass(universeId: string, name: string, priceRobux: number): Promise<string> {
  const res = await withCsrf((token) => {
    const form = new FormData();
    form.append("name", name.slice(0, 50));
    form.append("description", PRODUCT_DESCRIPTION);
    form.append("price", String(Math.max(1, Math.round(priceRobux))));
    form.append("isForSale", "true");
    form.append("imageFile", new Blob([robuxProductThumb()], { type: "image/png" }), "oversite.png");
    return fetch(`https://apis.roblox.com/game-passes/v1/universes/${universeId}/game-passes`, {
      method: "POST",
      headers: cookieHeaders({ "x-csrf-token": token }),
      body: form,
    });
  });
  if (!res.ok) throw new Error(`Roblox wouldn't create the pass (HTTP ${res.status}): ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const id = String(data?.gamePassId ?? data?.id ?? "");
  if (!id) throw new Error("Roblox returned no pass id.");
  return id;
}

// Take off sale every pass of ours that no order has been working on for two
// hours. Frees slots for new orders.
async function freeStalePasses(universeId: string): Promise<number> {
  const passes = (await listOurPasses(universeId)).filter((p) => p.forSale);
  if (passes.length === 0) return 0;
  const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data: busy } = await admin
    .from("bot_orders")
    .select("robux_item_id")
    .in("robux_item_id", passes.map((p) => p.id))
    .eq("status", "pending_payment")
    .gt("updated_at", since);
  const keep = new Set((busy ?? []).map((r: any) => String(r.robux_item_id)));
  let freed = 0;
  for (const p of passes) {
    if (keep.has(p.id)) continue;
    if (await updatePass(universeId, p.id, { forSale: false })) freed++;
  }
  return freed;
}

// The order's pass at this price, on sale. Reuses the order's own pass;
// otherwise creates one in the first experience with a free slot.
async function ensurePass(order: OrderRow, priceRobux: number): Promise<string> {
  const universes = await passUniverses();
  const own = order.robux_item_kind === "gamepass" ? order.robux_item_id : order.robux_gamepass_id;
  if (own) {
    for (const u of universes) {
      if (await updatePass(u, own, { price: priceRobux, forSale: true, name: itemName(order) })) return own;
    }
  }
  for (const u of universes) {
    let full = await passLimitReached(u);
    if (full) {
      await freeStalePasses(u);
      full = await passLimitReached(u);
    }
    if (full) continue;
    return await createPass(u, itemName(order), priceRobux);
  }
  throw new Error("Every order slot on Roblox is busy right now. Try again in a few minutes, or open a ticket in our Discord and we will take your order by hand.");
}

// After payment the pass comes off sale so it takes no slot. Best effort.
async function retirePass(passId: string): Promise<void> {
  for (const u of await passUniverses()) {
    if (await updatePass(u, passId, { forSale: false })) return;
  }
}

// Legacy name kept for older call sites.
async function setGamepassPrice(gamepassId: string, priceRobux: number): Promise<void> {
  if (priceRobux <= 0) return await retirePass(gamepassId);
  for (const u of await passUniverses()) {
    if (await updatePass(u, gamepassId, { price: priceRobux, forSale: true })) return;
  }
  throw new Error("Roblox wouldn't update the gamepass price.");
}

async function ownsItem(userId: number, itemType: string | number, itemId: string): Promise<boolean | null> {
  const res = await fetch(
    `https://inventory.roblox.com/v1/users/${userId}/items/${itemType}/${itemId}/is-owned`,
    { headers: cookieHeaders() },
  );
  // 403 means the inventory is private; that is not a no.
  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) return null;
  return Boolean(await res.json());
}

// ---------------- payment shirts (Roblox Select accounts) ----------------

// New-system clothing is a collectible: its price lives under a
// collectibleItemId. Resolve it from the asset id when not configured.
async function resolveCollectibleId(assetId: string): Promise<string | null> {
  try {
    const res = await withCsrf((token) =>
      fetch("https://catalog.roblox.com/v1/catalog/items/details", {
        method: "POST",
        headers: cookieHeaders({ "x-csrf-token": token, "Content-Type": "application/json" }),
        body: JSON.stringify({ items: [{ itemType: "Asset", id: Number(assetId) }] }),
      }),
    );
    if (!res.ok) return null;
    const d = await res.json();
    return d?.data?.[0]?.collectibleItemId ?? null;
  } catch {
    return null;
  }
}

async function updateShirtPrice(assetId: string, priceRobux: number, collectibleId?: string): Promise<void> {
  const cid = collectibleId || (await resolveCollectibleId(assetId));
  if (cid) {
    // The body must be the full sale configuration; a partial one is refused.
    const res = await withCsrf((token) =>
      fetch(`https://itemconfiguration.roblox.com/v1/collectibles/${cid}`, {
        method: "PATCH",
        headers: cookieHeaders({ "x-csrf-token": token, "Content-Type": "application/json" }),
        body: JSON.stringify({
          saleLocationConfiguration: { saleLocationType: 1, places: [] },
          saleStatus: 0,
          quantityLimitPerUser: 0,
          resaleRestriction: 2,
          priceInRobux: priceRobux,
          priceOffset: 0,
          isFree: false,
        }),
      }),
    );
    if (res.ok) return;
    throw new Error(`Roblox wouldn't re-price the payment shirt (HTTP ${res.status}).`);
  }
  // Older classic assets still use the asset-scoped endpoints.
  const post = (path: string, payload: unknown) =>
    withCsrf((token) =>
      fetch(`https://itemconfiguration.roblox.com/v1/assets/${assetId}/${path}`, {
        method: "POST",
        headers: cookieHeaders({ "x-csrf-token": token, "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      }),
    );
  const priceConfiguration = { priceInRobux: priceRobux };
  let res = await post("update-price", { priceConfiguration });
  if (res.ok) return;
  res = await post("release", { saleStatus: "OnSale", priceConfiguration });
  if (res.ok) return;
  throw new Error(`Roblox wouldn't re-price the payment shirt (HTTP ${res.status}).`);
}

// The payment shirts are shared by every Robux checkout. Hand out the one
// that has been idle longest, so two buyers in the same minute never share.
// A shirt the buyer already owns cannot be bought again, so only shirts they
// do not own are handed out. Someone who owns every one is sent to a ticket.
async function nextShirtSlot(buyerId: number): Promise<number> {
  if (SHIRT_IDS.length === 0) throw new Error("No payment shirts are configured yet (ROBLOX_SHIRT_IDS).");
  const owned = await Promise.all(SHIRT_IDS.map((id) => ownsItem(buyerId, "Asset", id)));
  const open = SHIRT_IDS.map((_, i) => i + 1).filter((slot) => owned[slot - 1] !== true);
  if (open.length === 0) {
    throw new Error(
      "Your Roblox account already owns every one of our payment shirts, so Roblox will not sell you another. Open a ticket in our Discord, in #dashboard press Need assistance, and we will take your order by hand.",
    );
  }
  const { data } = await admin.from("app_settings").select("robux_shirt_slots").eq("id", 1).maybeSingle();
  const used = ((data as any)?.robux_shirt_slots ?? {}) as Record<string, string>;
  let best = open[0];
  let bestAt = Number.POSITIVE_INFINITY;
  for (const slot of open) {
    const at = used[String(slot)] ? Date.parse(used[String(slot)]) : 0;
    if (at < bestAt) {
      best = slot;
      bestAt = at;
    }
  }
  await admin
    .from("app_settings")
    .update({ robux_shirt_slots: { ...used, [String(best)]: new Date().toISOString() } })
    .eq("id", 1);
  return best;
}

// ---------------- developer products (standard accounts) ----------------

const PRODUCT_DESCRIPTION = "Oversite order payment";

type DevProduct = { id: string; name: string; price: number; forSale: boolean; ours: boolean; hasThumb: boolean };
// The icon a product gets when none was uploaded.
const DEFAULT_PRODUCT_ICON = "88963008124478";

function productHeaders(): Record<string, string> {
  if (!ROBLOX_API_KEY) {
    throw new Error("Developer products aren't set up on the site yet. Add a Roblox Open Cloud API key (ROBLOX_API_KEY).");
  }
  return { "x-api-key": ROBLOX_API_KEY };
}

// Every developer product in the payment universe. Products we did not
// create (the description tells them apart) are never changed.
async function listDevProducts(universeId: string): Promise<DevProduct[]> {
  const res = await fetch(`https://apis.roblox.com/developer-products/v2/universes/${universeId}/developer-products/creator`, {
    headers: productHeaders(),
  });
  if (!res.ok) throw new Error(`Roblox wouldn't list the products (HTTP ${res.status}): ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const rows: any[] = Array.isArray(data?.developerProducts) ? data.developerProducts : Array.isArray(data) ? data : [];
  return rows.map((r) => ({
    id: String(r?.productId ?? r?.id ?? ""),
    name: String(r?.name ?? ""),
    price: Number(r?.priceInformation?.defaultPriceInRobux ?? r?.priceInRobux ?? r?.price ?? NaN),
    forSale: r?.isForSale !== false,
    ours: String(r?.description ?? "") === PRODUCT_DESCRIPTION,
    hasThumb: Boolean(r?.iconImageAssetId) && String(r.iconImageAssetId) !== DEFAULT_PRODUCT_ICON,
  })).filter((r) => r.id);
}

// The product must be buyable from its page outside the game, which needs
// the store page flag and a thumbnail. Both go through the same update call.
async function updateDevProduct(
  universeId: string,
  id: string,
  fields: { price?: number; name?: string; forSale?: boolean; storePage?: boolean; thumbnail?: boolean },
): Promise<void> {
  const form = new FormData();
  if (fields.price !== undefined) form.append("price", String(Math.max(0, Math.round(fields.price))));
  if (fields.name !== undefined) form.append("name", fields.name.slice(0, 100));
  if (fields.forSale !== undefined) form.append("isForSale", fields.forSale ? "true" : "false");
  if (fields.storePage !== undefined) form.append("storePageEnabled", fields.storePage ? "true" : "false");
  if (fields.thumbnail) form.append("imageFile", new Blob([robuxProductThumb()], { type: "image/png" }), "oversite.png");
  const res = await fetch(`https://apis.roblox.com/developer-products/v2/universes/${universeId}/developer-products/${id}`, {
    method: "PATCH",
    headers: productHeaders(),
    body: form,
  });
  if (!res.ok) throw new Error(`Roblox wouldn't update the product (HTTP ${res.status}): ${(await res.text()).slice(0, 200)}`);
}

async function createDevProduct(universeId: string, name: string, priceRobux: number): Promise<string> {
  const form = new FormData();
  form.append("name", name.slice(0, 100));
  form.append("description", PRODUCT_DESCRIPTION);
  form.append("isForSale", "true");
  form.append("price", String(Math.max(0, Math.round(priceRobux))));
  form.append("imageFile", new Blob([robuxProductThumb()], { type: "image/png" }), "oversite.png");
  const res = await fetch(`https://apis.roblox.com/developer-products/v2/universes/${universeId}/developer-products`, {
    method: "POST",
    headers: productHeaders(),
    body: form,
  });
  if (!res.ok) throw new Error(`Roblox wouldn't create the product (HTTP ${res.status}): ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  let id = String(data?.id ?? data?.productId ?? data?.developerProductId ?? "");
  if (!id && typeof data?.path === "string") id = data.path.split("/").pop() ?? "";
  if (!id) throw new Error("Roblox returned no product id.");
  await updateDevProduct(universeId, id, { storePage: true, thumbnail: true });
  return id;
}

// A product with this name at this price, for sale, in the first payment
// experience that will take it. Reuses and re-prices one we made earlier, so
// a discount or a price change shows up on the existing product; steps aside
// with a suffix when the name belongs to a product that is not ours.
async function ensureDevProduct(order: OrderRow, priceRobux: number): Promise<string> {
  const wanted = itemName(order);
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  let lastError: Error | null = null;
  for (const universeId of await passUniverses()) {
    try {
      const products = await listDevProducts(universeId);
      let own = products.find((p) => p.ours && same(p.name, wanted));
      if (own) {
        // Another customer may be mid-purchase on this very product (same bot
        // name); re-pricing it under them would break their checkout.
        const { data: busy } = await admin
          .from("bot_orders")
          .select("id")
          .eq("robux_item_id", own.id)
          .neq("user_id", order.user_id)
          .eq("status", "pending_payment")
          .gt("updated_at", new Date(Date.now() - 30 * 60 * 1000).toISOString())
          .limit(1)
          .maybeSingle();
        if (busy) own = undefined;
      }
      if (own) {
        await updateDevProduct(universeId, own.id, { price: priceRobux, forSale: true, storePage: true, thumbnail: !own.hasThumb });
        return own.id;
      }
      const taken = products.some((p) => same(p.name, wanted));
      const name = taken ? `${wanted} ${order.id.slice(0, 8)}` : wanted;
      try {
        return await createDevProduct(universeId, name, priceRobux);
      } catch (e) {
        if (!String((e as Error)?.message ?? "").includes("DuplicateProductName")) throw e;
        return await createDevProduct(universeId, `${wanted} ${order.id.slice(0, 8)} ${Date.now().toString(36)}`, priceRobux);
      }
    } catch (e) {
      lastError = e as Error;
      console.warn("robux-order: product not possible in universe", universeId, lastError.message);
    }
  }
  throw lastError ?? new Error("No payment experience would take the product.");
}

// ---------------- sales confirmation ----------------

type Sale = { buyerId: string; itemId: string; itemType: string; amount: number; created: string };

// The payment shirts can belong to a different group than the Payment
// experience, and a shirt sale shows up in the shirt's group. Resolve that
// group from the first shirt once, or take it from ROBLOX_SHIRT_GROUP_ID.
let cachedShirtGroupId: string | null = null;
async function resolveShirtGroupId(): Promise<string> {
  const fromEnv = Deno.env.get("ROBLOX_SHIRT_GROUP_ID") ?? "";
  if (fromEnv) return fromEnv;
  if (cachedShirtGroupId) return cachedShirtGroupId;
  if (SHIRT_IDS.length === 0) return resolveGroupId();
  const res = await fetch(`https://economy.roblox.com/v2/assets/${SHIRT_IDS[0]}/details`);
  if (!res.ok) return resolveGroupId();
  const d = await res.json();
  const creator = d?.Creator;
  if (creator?.CreatorType === "Group" && creator?.CreatorTargetId) {
    cachedShirtGroupId = String(creator.CreatorTargetId);
    return cachedShirtGroupId;
  }
  return resolveGroupId();
}

async function recentSales(kind: string | null): Promise<Sale[]> {
  const groupId = kind === "shirt" ? await resolveShirtGroupId() : await resolveGroupId();
  const res = await fetch(
    `https://economy.roblox.com/v2/groups/${groupId}/transactions?transactionType=Sale&limit=100&sortOrder=Desc`,
    { headers: cookieHeaders() },
  );
  if (!res.ok) throw new Error("The Roblox session can't read sales right now. Please try again shortly.");
  const data = await res.json();
  const rows: any[] = Array.isArray(data?.data) ? data.data : [];
  return rows.map((r) => ({
    buyerId: String(r?.agent?.id ?? ""),
    itemId: String(r?.details?.id ?? ""),
    itemType: String(r?.details?.type ?? ""),
    amount: Number(r?.currency?.amount ?? 0),
    created: String(r?.created ?? ""),
  }));
}

// Did this Roblox user buy this item in the last five minutes, and after the
// order was set up? The sale has to be in the group's own transaction log;
// nothing else counts, and the amount must match the order: a shirt slot can
// be re-priced for the next order while an earlier buyer is still looking at
// it, and a product's price can change with a discount.
const SALE_WINDOW_MS = 5 * 60 * 1000;
async function saleFound(o: OrderRow): Promise<boolean> {
  const buyer = String(o.roblox_user_id ?? "");
  const item = String(o.robux_item_id ?? o.robux_gamepass_id ?? "");
  if (!buyer || !item) return false;
  const started = o.robux_started_at ? Date.parse(o.robux_started_at) - 60 * 1000 : 0;
  const since = Math.max(started, Date.now() - SALE_WINDOW_MS);
  const sales = await recentSales(o.robux_item_kind);
  return sales.some((s) =>
    s.buyerId === buyer &&
    s.itemId === item &&
    s.amount === Number(o.robux_amount ?? -1) &&
    Boolean(s.created) && Date.parse(s.created) >= since,
  );
}

// ---------------- settings, profile, order ----------------

async function loadSettings(): Promise<{ enabled: boolean }> {
  const { data, error } = await admin.from("app_settings").select("robux_orders_enabled").eq("id", 1).maybeSingle();
  if (error) {
    if (/column|does not exist/i.test(error.message)) {
      throw new Error("Robux checkout isn't set up yet. The robux_orders migration has not been run.");
    }
    throw new Error(error.message);
  }
  return { enabled: data?.robux_orders_enabled !== false };
}

type Profile = { roblox_user_id: number | null; roblox_username: string | null; roblox_account_kind: string | null };

// The linked account's headshot, looked up once per user through Roblox's
// thumbnails API. Browsers cannot call it directly, so the page gets the
// image address from us.
const headshots = new Map<number, string | null>();
async function warmHeadshot(userId: number | null): Promise<void> {
  if (!userId || headshots.has(userId)) return;
  try {
    const res = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`);
    const d = res.ok ? await res.json() : null;
    const url = d?.data?.[0]?.imageUrl;
    headshots.set(userId, typeof url === "string" && url ? url : null);
  } catch {
    headshots.set(userId, null);
  }
}

async function loadProfile(userId: string): Promise<Profile> {
  const { data, error } = await admin
    .from("profiles")
    .select("roblox_user_id, roblox_username, roblox_account_kind")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    if (/column|does not exist/i.test(error.message)) {
      throw new Error("Robux checkout isn't set up yet. The robux_checkout_accounts migration has not been run.");
    }
    throw new Error(error.message);
  }
  return {
    roblox_user_id: data?.roblox_user_id ? Number(data.roblox_user_id) : null,
    roblox_username: data?.roblox_username ?? null,
    roblox_account_kind: data?.roblox_account_kind ?? null,
  };
}

// Dollar price plus the markup at the rate, bumped to the next thousand less
// one so it ends in 999. Keep in step with robuxFor in useRobuxCheckout.tsx.
const robuxFor = (usd: number) => {
  const raw = Math.max(0, Number(usd)) * ROBUX_MARKUP * ROBUX_PER_USD;
  return Math.max(99, (Math.floor(raw / 1000) + 1) * 1000 - 1);
};

type OrderRow = {
  id: string;
  user_id: string;
  parent_order_id: string | null;
  status: string;
  bot_name: string | null;
  base: string | null;
  icon_url: string | null;
  total_amount: number | null;
  discount_code: string | null;
  discount_amount: number | null;
  charged_at: string | null;
  payment_method: string | null;
  robux_gamepass_id: string | null;
  robux_amount: number | null;
  roblox_username: string | null;
  roblox_user_id: number | null;
  robux_item_kind: string | null;
  robux_item_id: string | null;
  robux_shirt_slot: number | null;
  robux_started_at: string | null;
};

const ORDER_COLUMNS =
  "id, user_id, parent_order_id, status, bot_name, base, icon_url, total_amount, discount_code, discount_amount, charged_at, payment_method, robux_gamepass_id, robux_amount, roblox_username, roblox_user_id, robux_item_kind, robux_item_id, robux_shirt_slot, updated_at";

async function loadOrder(orderId: string, userId: string): Promise<OrderRow> {
  const { data, error } = await admin.from("bot_orders").select(ORDER_COLUMNS).eq("id", orderId).maybeSingle();
  if (error) {
    if (/column|does not exist/i.test(error.message)) {
      throw new Error("Robux checkout isn't set up yet. The robux_checkout_accounts migration has not been run.");
    }
    throw new Error(error.message);
  }
  if (!data) throw new Error("Order not found.");
  const row = data as any;
  const order: OrderRow = { ...row, robux_started_at: row.updated_at ?? null };
  if (order.user_id !== userId) throw new Error("This order belongs to someone else.");
  if (order.parent_order_id) throw new Error("Pay the main order of this pack instead.");
  return order;
}

const isPaid = (o: OrderRow) => Boolean(o.charged_at) || !["pending_payment", "payment_failed"].includes(o.status);

// The product is named after the bot. Roblox refuses two products with the
// same name in a universe, so ensureDevProduct reuses ours when one exists.
const itemName = (o: OrderRow) => `Oversite ${String(o.bot_name || "").trim() || o.id.slice(0, 8)}`;

function summary(o: OrderRow, profile?: Profile) {
  const kind = o.robux_item_kind ?? (o.robux_gamepass_id ? "gamepass" : null);
  const itemId = o.robux_item_id ?? o.robux_gamepass_id ?? null;
  const itemUrl =
    kind === "shirt" && itemId ? shirtUrl(itemId)
    : kind === "devproduct" ? storeUrl(itemId)
    : kind === "gamepass" && itemId ? gamepassUrl(itemId)
    : null;
  return {
    orderId: o.id,
    botName: o.bot_name,
    base: o.base,
    iconUrl: o.icon_url && /^https?:\/\//.test(o.icon_url) ? o.icon_url : null,
    status: o.status,
    paid: isPaid(o),
    totalUsd: Number(o.total_amount ?? 0),
    rate: ROBUX_PER_USD,
    markup: ROBUX_MARKUP,
    robux: o.robux_amount ?? robuxFor(Number(o.total_amount ?? 0)),
    // The Robux price already has the discount in it; these let the page say so.
    discountCode: Number(o.discount_amount ?? 0) > 0 ? o.discount_code ?? null : null,
    discountUsd: Number(o.discount_amount ?? 0),
    listRobux: robuxFor(Number(o.total_amount ?? 0) + Number(o.discount_amount ?? 0)),
    itemKind: kind,
    itemId,
    itemUrl,
    itemName: kind === "devproduct" || kind === "gamepass" ? itemName(o) : null,
    // Kept for older clients.
    gamepassId: o.robux_gamepass_id,
    gamepassUrl: o.robux_gamepass_id ? gamepassUrl(o.robux_gamepass_id) : null,
    robloxUsername: o.roblox_username,
    linked: profile
      ? {
          robloxUserId: profile.roblox_user_id,
          robloxUsername: profile.roblox_username,
          robloxAvatarUrl: profile.roblox_user_id ? headshots.get(profile.roblox_user_id) ?? null : null,
          accountKind: profile.roblox_account_kind,
        }
      : undefined,
  };
}

// ---------------- handler ----------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Sign in to continue." }, 401);
  const { data: userData, error: userErr } = await admin.auth.getUser(authHeader.slice(7));
  if (userErr || !userData?.user) return json({ error: "Sign in to continue." }, 401);
  const user = userData.user;

  let body: { action?: string; orderId?: string; kind?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const action = String(body.action ?? "");
  const orderId = String(body.orderId ?? "").trim();
  if (!orderId) return json({ error: "orderId required" }, 400);

  try {
    const settings = await loadSettings();
    const order = await loadOrder(orderId, user.id);
    const profile = await loadProfile(user.id);
    await warmHeadshot(profile.roblox_user_id);
    // The product link needs the experience id; resolve it once so every
    // summary, status included, can point straight at the product.
    if (order.robux_item_kind === "devproduct") await resolveUniverseId().catch(() => {});

    if (action === "status") {
      return json({ ok: true, enabled: settings.enabled, ...summary(order, profile) });
    }

    if (action === "start") {
      if (!settings.enabled) return json({ error: "Robux checkout is turned off right now." }, 400);
      if (!ROBLOX_COOKIE) return json({ error: "Robux checkout isn't configured on the server yet." }, 500);
      if (isPaid(order)) return json({ ok: true, ...summary(order, profile) });
      if (!profile.roblox_user_id || !profile.roblox_username) {
        return json({ error: "Link your Roblox account first." }, 400);
      }
      const kind = body.kind === "select" ? "select" : body.kind === "standard" ? "standard" : "";
      if (!kind) return json({ error: "Say whether this is a Roblox Select account." }, 400);

      // A comped account owes nothing, but still pays a token amount in
      // Robux so the whole flow can be exercised for real. The order is
      // marked comped the same way a comped card order is.
      const email = String(user.email ?? "").toLowerCase();
      const { data: comp } = email
        ? await admin.from("comped_emails").select("id").ilike("email", email).limit(1).maybeSingle()
        : { data: null };
      const compedAccount = Boolean(comp);
      const total = compedAccount ? 0 : Number(order.total_amount ?? 0);
      if (!compedAccount && !(total > 0)) return json({ error: "This order has nothing to pay." }, 400);
      const robux = compedAccount ? COMPED_TEST_ROBUX[kind === "select" ? "shirt" : "gamepass"] : robuxFor(total);
      if (compedAccount && order.discount_code !== "COMP") {
        const listed = Number(order.total_amount ?? 0) + Number(order.discount_amount ?? 0);
        await admin.from("bot_orders")
          .update({ total_amount: 0, discount_code: "COMP", discount_amount: listed, updated_at: new Date().toISOString() })
          .eq("id", order.id);
        order.total_amount = 0; order.discount_code = "COMP"; order.discount_amount = listed;
      }

      // Remember the answer for next time.
      await admin.from("profiles").update({ roblox_account_kind: kind }).eq("user_id", user.id);

      let itemKind: "shirt" | "devproduct" | "gamepass";
      let itemId: string;
      let slot: number | null = null;
      if (kind === "select") {
        itemKind = "shirt";
        slot = await nextShirtSlot(Number(profile.roblox_user_id));
        itemId = SHIRT_IDS[slot - 1];
        await updateShirtPrice(itemId, robux, SHIRT_COLLECTIBLE_IDS[slot - 1] || undefined);
      } else {
        // Roblox no longer sells developer products outside the game, so a
        // standard account gets its own game pass instead.
        itemKind = "gamepass";
        itemId = await ensurePass(order, robux);
      }

      const now = new Date().toISOString();
      const patch = {
        payment_method: "robux",
        payment_plan: "full",
        plan_months: null,
        installment_amount: null,
        robux_item_kind: itemKind,
        robux_item_id: itemId,
        robux_gamepass_id: itemKind === "gamepass" ? itemId : null,
        robux_shirt_slot: slot,
        robux_amount: robux,
        roblox_username: profile.roblox_username,
        roblox_user_id: profile.roblox_user_id,
        updated_at: now,
      };
      const { error: updErr } = await admin.from("bot_orders").update(patch).eq("id", order.id);
      if (updErr) throw new Error(updErr.message);

      return json({
        ok: true,
        ...summary({ ...order, ...patch, robux_started_at: now } as OrderRow, { ...profile, roblox_account_kind: kind }),
      });
    }

    if (action === "verify") {
      if (isPaid(order)) return json({ ok: true, success: true, ...summary(order, profile) });
      if (!ROBLOX_COOKIE) return json({ error: "Robux checkout isn't configured on the server yet." }, 500);
      const kind = order.robux_item_kind ?? (order.robux_gamepass_id ? "gamepass" : null);
      if (!kind || !order.roblox_user_id) return json({ error: "Start the Robux checkout first." }, 400);

      let confirmed = false;
      confirmed = await saleFound(order);
      if (!confirmed) {
        return json({
          ok: true,
          success: false,
          error: "We couldn't find a purchase on your account in the last five minutes. If you just bought it, give Roblox about 30 seconds and try again. If you bought it earlier, open a ticket in our Discord and we will match it by hand.",
        });
      }

      // Paid. Mirror what a successful card charge does: charged_at is the
      // guard that stops charge-confirmed-order from billing a card later,
      // and 'paid' lets the post-checkout gate take the order to 'ready'.
      const ts = new Date().toISOString();
      const paidPatch = { status: "paid", paid_at: ts, charged_at: ts, updated_at: ts };
      const { error: e1 } = await admin
        .from("bot_orders")
        .update({ ...paidPatch, payment_method: "robux" })
        .eq("id", order.id)
        .in("status", ["pending_payment", "payment_failed"]);
      if (e1) throw new Error(e1.message);
      await admin
        .from("bot_orders")
        .update(paidPatch)
        .eq("parent_order_id", order.id)
        .in("status", ["pending_payment", "payment_failed"]);

      // The pass comes off sale so it takes no slot. Best effort.
      if (kind === "gamepass" && (order.robux_item_id || order.robux_gamepass_id)) {
        try {
          await retirePass(String(order.robux_item_id ?? order.robux_gamepass_id));
        } catch (e) {
          console.warn("robux-order: could not take the gamepass off sale", (e as Error)?.message);
        }
      }

      return json({ ok: true, success: true, ...summary({ ...order, status: "paid", charged_at: ts }, profile) });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("robux-order error:", message);
    return json({ error: message }, 500);
  }
});
