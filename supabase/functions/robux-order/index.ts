// Robux checkout for bot orders.
//
// Every Robux order gets its own Roblox gamepass, priced at the order total
// converted with app_settings.robux_per_usd. Owning that gamepass is the
// proof of payment, so two customers can never collide on one pass and a
// price change on the shared /payment passes never affects an order.
//
// Actions (all need the customer's JWT; the order must belong to them):
//   status { orderId }                 -> what the order already has
//   start  { orderId, robloxUsername } -> creates (or re-prices) the pass
//   verify { orderId }                 -> checks ownership, marks the order paid
//
// Env: ROBLOX_COOKIE (.ROBLOSECURITY of the account that owns the payment
// place), optional ROBLOX_ORDER_PLACE_ID (defaults to the store's place),
// optional ROBLOX_ORDER_ICON_URL (defaults to the site logo).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ROBLOX_COOKIE = Deno.env.get("ROBLOX_COOKIE") ?? "";
const PLACE_ID = Deno.env.get("ROBLOX_ORDER_PLACE_ID") || "108687688483255";
const ICON_URL = Deno.env.get("ROBLOX_ORDER_ICON_URL") || "https://www.oversite.shop/OversiteLogo.png";
const GAMEPASS_ITEM_TYPE = 1;
const DEFAULT_RATE = 400;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const gamepassUrl = (id: string) => `https://www.roblox.com/game-pass/${id}/`;

// ---------------- Roblox helpers ----------------

let cachedUniverseId: string | null = null;
async function resolveUniverseId(): Promise<string> {
  if (cachedUniverseId) return cachedUniverseId;
  const res = await fetch(`https://apis.roblox.com/universes/v1/places/${PLACE_ID}/universe`);
  if (!res.ok) throw new Error(`Couldn't resolve the payment place (HTTP ${res.status}).`);
  const data = await res.json();
  if (!data?.universeId) throw new Error("Roblox returned no universe for the payment place.");
  cachedUniverseId = String(data.universeId);
  return cachedUniverseId;
}

async function getCsrfToken(): Promise<string> {
  const res = await fetch("https://auth.roblox.com/v2/logout", {
    method: "POST",
    headers: { Cookie: `.ROBLOSECURITY=${ROBLOX_COOKIE}` },
  });
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

async function fetchIcon(): Promise<{ blob: Blob; ext: string }> {
  const res = await fetch(ICON_URL);
  if (!res.ok) throw new Error(`Couldn't download the gamepass icon (HTTP ${res.status}).`);
  const contentType = res.headers.get("content-type") ?? "image/png";
  const blob = await res.blob();
  let ext = "png";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) ext = "jpg";
  else if (contentType.includes("webp")) ext = "webp";
  return { blob: new Blob([blob], { type: contentType }), ext };
}

async function createGamepass(name: string, priceRobux: number): Promise<string> {
  const universeId = await resolveUniverseId();
  const { blob, ext } = await fetchIcon();
  const res = await withCsrf((token) => {
    const form = new FormData();
    form.append("name", name.slice(0, 50));
    form.append("description", "Oversite order payment");
    form.append("isForSale", priceRobux > 0 ? "true" : "false");
    form.append("price", String(priceRobux));
    form.append("imageFile", blob, `icon.${ext}`);
    return fetch(`https://apis.roblox.com/game-passes/v1/universes/${universeId}/game-passes`, {
      method: "POST",
      headers: { Cookie: `.ROBLOSECURITY=${ROBLOX_COOKIE}`, "x-csrf-token": token },
      body: form,
    });
  });
  if (!res.ok) throw new Error(`Roblox wouldn't create the gamepass (HTTP ${res.status}): ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const id = String(data?.gamePassId ?? data?.gamepassId ?? data?.id ?? "");
  if (!id) throw new Error("Roblox returned no gamepass id.");
  return id;
}

async function setGamepassPrice(gamepassId: string, priceRobux: number): Promise<void> {
  const universeId = await resolveUniverseId();
  const res = await withCsrf((token) => {
    const form = new FormData();
    form.append("isForSale", priceRobux > 0 ? "true" : "false");
    form.append("price", String(priceRobux));
    return fetch(`https://apis.roblox.com/game-passes/v1/universes/${universeId}/game-passes/${gamepassId}`, {
      method: "PATCH",
      headers: { Cookie: `.ROBLOSECURITY=${ROBLOX_COOKIE}`, "x-csrf-token": token },
      body: form,
    });
  });
  if (!res.ok) throw new Error(`Roblox wouldn't update the gamepass price (HTTP ${res.status}).`);
}

async function lookupUser(username: string): Promise<{ id: number; name: string } | null> {
  const res = await fetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
  });
  if (!res.ok) throw new Error("Couldn't reach Roblox to look up that username.");
  const data = await res.json();
  const row = data?.data?.[0];
  return row?.id ? { id: Number(row.id), name: String(row.name || username) } : null;
}

async function ownsGamepass(userId: number, gamepassId: string): Promise<boolean> {
  const res = await fetch(
    `https://inventory.roblox.com/v1/users/${userId}/items/${GAMEPASS_ITEM_TYPE}/${gamepassId}/is-owned`,
    { headers: { Cookie: `.ROBLOSECURITY=${ROBLOX_COOKIE}` } },
  );
  if (res.status === 401 || res.status === 403) {
    throw new Error("The Roblox session can't verify ownership right now. Please try again shortly.");
  }
  if (!res.ok) throw new Error("Couldn't verify the gamepass purchase right now.");
  return Boolean(await res.json());
}

// ---------------- settings + order helpers ----------------

async function loadSettings(): Promise<{ enabled: boolean; rate: number }> {
  const { data, error } = await admin
    .from("app_settings")
    .select("robux_orders_enabled, robux_per_usd")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    if (/column|does not exist/i.test(error.message)) {
      throw new Error("Robux checkout isn't set up yet. The robux_orders migration has not been run.");
    }
    throw new Error(error.message);
  }
  const rate = Number(data?.robux_per_usd);
  return {
    enabled: data?.robux_orders_enabled !== false,
    rate: Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_RATE,
  };
}

const robuxFor = (usd: number, rate: number) => Math.max(1, Math.ceil(Number(usd) * rate));

type OrderRow = {
  id: string;
  user_id: string;
  parent_order_id: string | null;
  status: string;
  bot_name: string | null;
  total_amount: number | null;
  charged_at: string | null;
  payment_method: string | null;
  robux_gamepass_id: string | null;
  robux_amount: number | null;
  roblox_username: string | null;
  roblox_user_id: number | null;
};

async function loadOrder(orderId: string, userId: string): Promise<OrderRow> {
  const { data, error } = await admin
    .from("bot_orders")
    .select(
      "id, user_id, parent_order_id, status, bot_name, total_amount, charged_at, payment_method, robux_gamepass_id, robux_amount, roblox_username, roblox_user_id",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (error) {
    if (/column|does not exist/i.test(error.message)) {
      throw new Error("Robux checkout isn't set up yet. The robux_orders migration has not been run.");
    }
    throw new Error(error.message);
  }
  if (!data) throw new Error("Order not found.");
  const order = data as OrderRow;
  if (order.user_id !== userId) throw new Error("This order belongs to someone else.");
  if (order.parent_order_id) throw new Error("Pay the main order of this pack instead.");
  return order;
}

const isPaid = (o: OrderRow) => Boolean(o.charged_at) || !["pending_payment", "payment_failed"].includes(o.status);

function summary(o: OrderRow, rate: number) {
  return {
    orderId: o.id,
    botName: o.bot_name,
    status: o.status,
    paid: isPaid(o),
    totalUsd: Number(o.total_amount ?? 0),
    rate,
    robux: o.robux_amount ?? robuxFor(Number(o.total_amount ?? 0), rate),
    gamepassId: o.robux_gamepass_id,
    gamepassUrl: o.robux_gamepass_id ? gamepassUrl(o.robux_gamepass_id) : null,
    robloxUsername: o.roblox_username,
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

  let body: { action?: string; orderId?: string; robloxUsername?: string };
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

    if (action === "status") {
      return json({ ok: true, enabled: settings.enabled, ...summary(order, settings.rate) });
    }

    if (action === "start") {
      if (!settings.enabled) return json({ error: "Robux checkout is turned off right now." }, 400);
      if (!ROBLOX_COOKIE) return json({ error: "Robux checkout isn't configured on the server yet." }, 500);
      if (isPaid(order)) return json({ ok: true, ...summary(order, settings.rate) });

      const username = String(body.robloxUsername ?? "").trim();
      if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
        return json({ error: "Enter a valid Roblox username: 3 to 20 letters, numbers, or underscores." }, 400);
      }
      const total = Number(order.total_amount ?? 0);
      if (!(total > 0)) return json({ error: "This order has nothing to pay." }, 400);

      const roblox = await lookupUser(username);
      if (!roblox) return json({ error: `Roblox user "${username}" was not found.` }, 404);

      const robux = robuxFor(total, settings.rate);
      let gamepassId = order.robux_gamepass_id;
      if (!gamepassId) {
        const label = `Oversite order ${String(order.bot_name || "").trim() || order.id.slice(0, 8)}`;
        gamepassId = await createGamepass(label, robux);
      } else if (order.robux_amount !== robux) {
        await setGamepassPrice(gamepassId, robux);
      }

      const now = new Date().toISOString();
      const { error: updErr } = await admin
        .from("bot_orders")
        .update({
          payment_method: "robux",
          payment_plan: "full",
          plan_months: null,
          installment_amount: null,
          robux_gamepass_id: gamepassId,
          robux_amount: robux,
          roblox_username: roblox.name,
          roblox_user_id: roblox.id,
          updated_at: now,
        })
        .eq("id", order.id);
      if (updErr) throw new Error(updErr.message);

      return json({
        ok: true,
        ...summary(
          { ...order, robux_gamepass_id: gamepassId, robux_amount: robux, roblox_username: roblox.name, roblox_user_id: roblox.id },
          settings.rate,
        ),
      });
    }

    if (action === "verify") {
      if (isPaid(order)) return json({ ok: true, success: true, ...summary(order, settings.rate) });
      if (!order.robux_gamepass_id || !order.roblox_user_id) {
        return json({ error: "Start the Robux checkout first." }, 400);
      }
      if (!ROBLOX_COOKIE) return json({ error: "Robux checkout isn't configured on the server yet." }, 500);

      const owned = await ownsGamepass(Number(order.roblox_user_id), order.robux_gamepass_id);
      if (!owned) {
        return json({
          ok: true,
          success: false,
          error: "We couldn't find your purchase yet. If you just bought it, wait about 30 seconds and try again.",
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

      // Take the pass off sale so nobody else can buy it. Best effort only:
      // the money is already in, a failure here must not undo the order.
      try {
        await setGamepassPrice(order.robux_gamepass_id, 0);
      } catch (e) {
        console.warn("robux-order: could not take the gamepass off sale", (e as Error)?.message);
      }

      return json({
        ok: true,
        success: true,
        ...summary({ ...order, status: "paid", charged_at: ts }, settings.rate),
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("robux-order error:", message);
    return json({ error: message }, 500);
  }
});
