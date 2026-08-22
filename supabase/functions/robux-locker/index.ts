// Robux Locker backend for the Discord bot.
//
// Body: { action: "funds"|"get_stock"|"set_stock"|"add_stock"|"take_stock"|"get_rate"|"set_rate", amount?: number }
//   - funds:       read the group's available Robux balance        -> { robux }
//   - funds_detail:available + pending + revenue breakdown         -> { available, pending, summary }
//   - get_stock:   current Available Stock for this bot            -> { stock }
//   - set_stock:   set Available Stock to `amount`                 -> { stock }
//   - add_stock:   add `amount` to Available Stock (restock)       -> { stock }
//   - take_stock:  atomically remove `amount` if available (a buy) -> { ok, stock } | { ok:false }
//   - get_rate:    USD price per 1,000 Robux                       -> { rate_per_1k }
//   - set_rate:    set USD-per-1,000-Robux to `amount` (fractional)-> { rate_per_1k }
//
// Auth: bot worker token (x-worker-token: wkr_...), validated via _worker_token_lookup,
// which also tells us WHICH bot this is so stock is scoped per bot.
//
// Secrets / env (Lovable Cloud -> Supabase -> Edge Function secrets):
//   ROBLOX_COOKIE      .ROBLOSECURITY of the group's bot account (already set for payments)
//   ROBLOX_GROUP_ID    OPTIONAL. The group id whose funds back the locker. If unset,
//                      it's auto-detected from the cookie (the group the bot owns).

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

function cookieHeaders(): Record<string, string> {
  return { Cookie: `.ROBLOSECURITY=${ROBLOX_COOKIE}` };
}

// The group id, resolved once and cached. If ROBLOX_GROUP_ID is set it wins;
// otherwise we ask Roblox who this cookie belongs to and find the group it owns.
let cachedGroupId = "";

async function resolveGroupId(): Promise<string> {
  if (!ROBLOX_COOKIE) throw new Error("ROBLOX_COOKIE is not configured");
  if (GROUP_ID) return GROUP_ID;
  if (cachedGroupId) return cachedGroupId;

  // Who is this cookie?
  const meRes = await fetch("https://users.roblox.com/v1/users/authenticated", {
    headers: cookieHeaders(),
  });
  if (!meRes.ok) {
    const body = (await meRes.text()).slice(0, 200);
    throw new Error(`Couldn't identify the bot's Roblox account (HTTP ${meRes.status}). Is ROBLOX_COOKIE valid? ${body}`);
  }
  const me = await meRes.json();
  const userId = Number(me?.id ?? 0);
  if (!userId) throw new Error("Couldn't read the bot's Roblox user id from the cookie");

  // What groups is it in, and with what rank?
  const grpRes = await fetch(`https://groups.roblox.com/v1/users/${userId}/groups/roles`, {
    headers: cookieHeaders(),
  });
  if (!grpRes.ok) {
    const body = (await grpRes.text()).slice(0, 200);
    throw new Error(`Couldn't list the bot's Roblox groups (HTTP ${grpRes.status}): ${body}`);
  }
  const grp = await grpRes.json();
  const rows: Array<{ group?: { id?: number; name?: string }; role?: { rank?: number } }> =
    Array.isArray(grp?.data) ? grp.data : [];
  if (rows.length === 0) {
    throw new Error("The bot's Roblox account isn't in any group");
  }
  // Prefer the group the bot OWNS (rank 255); otherwise the highest rank; if
  // there's only one group, just use it.
  const owned = rows.find((r) => Number(r?.role?.rank ?? 0) === 255);
  const best = owned ?? rows.slice().sort((a, b) => Number(b?.role?.rank ?? 0) - Number(a?.role?.rank ?? 0))[0];
  const id = String(best?.group?.id ?? "");
  if (!id) throw new Error("Couldn't determine the group id from the bot's Roblox account");
  cachedGroupId = id;
  return id;
}

async function groupFunds(): Promise<number> {
  if (!ROBLOX_COOKIE) throw new Error("ROBLOX_COOKIE is not configured");
  const groupId = await resolveGroupId();
  const res = await fetch(`https://economy.roblox.com/v1/groups/${groupId}/currency`, {
    headers: cookieHeaders(),
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 200);
    throw new Error(`Group funds read failed (HTTP ${res.status}): ${body}`);
  }
  const data = await res.json();
  return Math.max(0, Math.floor(Number(data?.robux ?? 0)));
}

// Group revenue breakdown for a window (Day | Week | Month | Year). Includes
// pendingRobux and the per-source figures (sales, payouts, etc.). Requires the
// account to have "View group revenue" (owners have it).
async function revenueSummary(timeFrame: string): Promise<Record<string, unknown>> {
  const groupId = await resolveGroupId();
  const tf = ["Day", "Week", "Month", "Year"].includes(timeFrame) ? timeFrame : "Day";
  const res = await fetch(
    `https://economy.roblox.com/v1/groups/${groupId}/revenue/summary/${tf}`,
    { headers: cookieHeaders() },
  );
  if (!res.ok) {
    const body = (await res.text()).slice(0, 200);
    throw new Error(`Revenue summary failed (HTTP ${res.status}): ${body}`);
  }
  return await res.json();
}

// ---------------- stock + rate (bot_config feature "robux-stock") ----------------
//
// One row per bot holds { stock, rate_per_1k }. Reads/writes MERGE so setting
// the stock never wipes the rate, and setting the rate never wipes the stock.

async function readConfig(botId: string): Promise<Record<string, unknown>> {
  const { data } = await admin
    .from("bot_config")
    .select("config")
    .eq("bot_id", botId)
    .eq("feature", STOCK_FEATURE)
    .maybeSingle();
  return (data?.config ?? {}) as Record<string, unknown>;
}

async function writeConfig(botId: string, patch: Record<string, unknown>): Promise<Record<string, unknown>> {
  const cur = await readConfig(botId);
  const next = { ...cur, ...patch };
  await admin.from("bot_config").upsert(
    { bot_id: botId, feature: STOCK_FEATURE, config: next, updated_at: new Date().toISOString() },
    { onConflict: "bot_id,feature" },
  );
  return next;
}

async function getStock(botId: string): Promise<number> {
  const cfg = await readConfig(botId);
  return Math.max(0, Math.floor(Number(cfg.stock ?? 0)));
}

async function setStock(botId: string, stock: number): Promise<number> {
  const next = Math.max(0, Math.floor(stock));
  await writeConfig(botId, { stock: next });
  return next;
}

async function getRate(botId: string): Promise<number> {
  const cfg = await readConfig(botId);
  return Math.max(0, Number(cfg.rate_per_1k ?? 0));
}

async function setRate(botId: string, rate: number): Promise<number> {
  const next = Math.max(0, Number(rate));
  await writeConfig(botId, { rate_per_1k: next });
  return next;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const botId = await resolveBotId(req);
  if (!botId) return json({ error: "Unauthorized" }, 401);

  let body: { action?: string; amount?: number; timeFrame?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const action = String(body.action ?? "");
  const amount = Math.max(0, Math.floor(Number(body.amount ?? 0)));

  try {
    if (action === "funds") {
      return json({ ok: true, robux: await groupFunds() });
    }
    if (action === "funds_detail") {
      const available = await groupFunds();
      let summary: Record<string, unknown> | null = null;
      let summaryError: string | null = null;
      try {
        summary = await revenueSummary(String(body.timeFrame ?? "Day"));
      } catch (e) {
        summaryError = e instanceof Error ? e.message : String(e);
      }
      const pending = summary ? Math.floor(Number(summary.pendingRobux ?? 0)) : null;
      return json({ ok: true, available, pending, summary, summaryError });
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
    if (action === "get_rate") {
      return json({ ok: true, rate_per_1k: await getRate(botId) });
    }
    if (action === "set_rate") {
      // `amount` here carries the USD-per-1000-Robux rate (may be fractional).
      const rate = Math.max(0, Number(body.amount ?? 0));
      return json({ ok: true, rate_per_1k: await setRate(botId, rate) });
    }
    if (action === "take_stock") {
      // Atomic-enough for a single-process bot: read, check, write. First come
      // first served — if there isn't enough, nothing is taken.
      const cur = await getStock(botId);
      if (amount <= 0 || amount > cur) return json({ ok: false, stock: cur, error: "insufficient_stock" });
      return json({ ok: true, stock: await setStock(botId, cur - amount) });
    }
    if (action === "sales") {
      // Recent group SALE transactions (game passes, shirts, etc.), newest first.
      // Used by the purchase-logs poller. Each item: { id, created, buyerId,
      // buyerName, itemName, itemType, itemId, amount }.
      const groupId = await resolveGroupId();
      const limit = Math.min(100, Math.max(1, Number(body.limit ?? 25)));
      const res = await fetch(
        `https://economy.roblox.com/v2/groups/${groupId}/transactions?transactionType=Sale&limit=${limit}&sortOrder=Desc`,
        { headers: cookieHeaders() },
      );
      if (!res.ok) {
        const bodyText = (await res.text()).slice(0, 200);
        return json({ error: `Sales read failed (HTTP ${res.status}): ${bodyText}` }, 502);
      }
      const data = await res.json();
      const rows: any[] = Array.isArray(data?.data) ? data.data : [];
      const sales = rows.map((r) => ({
        // The numeric `id` comes back as 0 for every sale, so build a stable
        // unique key from idHash (preferred) or a composite of the fields that
        // differ per transaction. Without this, dedup collides on "0".
        id: String(
          r?.idHash ||
          [r?.created ?? "", r?.agent?.id ?? "", r?.details?.id ?? "", r?.currency?.amount ?? ""].join("|"),
        ),
        created: r?.created ?? null,
        buyerId: String(r?.agent?.id ?? ""),
        buyerName: String(r?.agent?.name ?? ""),
        itemName: String(r?.details?.name ?? ""),
        itemType: String(r?.details?.type ?? ""),
        itemId: String(r?.details?.id ?? ""),
        amount: Number(r?.currency?.amount ?? 0),
      })).filter((s) => s.id);
      return json({ ok: true, sales });
    }
    if (action === "roblox_reverse") {
      // A Roblox id → the Discord user linked to it (for purchase logs).
      // Match on roblox_id first. Older verifications may have stored a
      // username but no roblox_id (null), so fall back to a case-insensitive
      // username match when an id lookup finds nothing. The sales poller has
      // both the buyer's id and name, so it can pass both.
      const rid = String(body.roblox_id ?? "").trim();
      const rname = String(body.roblox_username ?? "").trim();
      let row: { discord_user_id?: string; roblox_username?: string } | null = null;
      if (rid) {
        const { data } = await admin.from("roblox_verifications")
          .select("discord_user_id, roblox_username")
          .eq("bot_id", botId).eq("roblox_id", rid).maybeSingle();
        row = data ?? null;
      }
      if (!row && rname) {
        const { data } = await admin.from("roblox_verifications")
          .select("discord_user_id, roblox_username")
          .eq("bot_id", botId).ilike("roblox_username", rname).maybeSingle();
        row = data ?? null;
      }
      return json({ ok: true, discord_user_id: row?.discord_user_id ?? null, roblox_username: row?.roblox_username ?? null });
    }
    if (action === "verify_debug") {
      // Diagnostic: given a roblox id and/or username, report exactly what the
      // verifications table holds so a blank "Customer" can be traced to its
      // cause (row missing vs. null roblox_id vs. bot_id mismatch).
      const rid = String(body.roblox_id ?? "").trim();
      const rname = String(body.roblox_username ?? "").trim();
      const byId = rid
        ? (await admin.from("roblox_verifications")
            .select("discord_user_id, roblox_id, roblox_username, bot_id")
            .eq("bot_id", botId).eq("roblox_id", rid).maybeSingle()).data
        : null;
      const byName = rname
        ? (await admin.from("roblox_verifications")
            .select("discord_user_id, roblox_id, roblox_username, bot_id")
            .eq("bot_id", botId).ilike("roblox_username", rname).maybeSingle()).data
        : null;
      const anyBot = rid
        ? (await admin.from("roblox_verifications")
            .select("discord_user_id, roblox_id, roblox_username, bot_id")
            .eq("roblox_id", rid).maybeSingle()).data
        : null;
      const { count } = await admin.from("roblox_verifications")
        .select("discord_user_id", { count: "exact", head: true }).eq("bot_id", botId);
      return json({ ok: true, bot_id: botId, total_for_bot: count ?? null, by_id: byId, by_name: byName, any_bot: anyBot });
    }
    if (action === "log_state_get") {
      // Dedup cursor for the purchase-logs sales poller (seen sale ids).
      // Key is versioned (v2) so switching to the new unique-id scheme starts
      // from a clean, empty cursor (re-seeds instead of dumping old sales).
      const { data } = await admin.from("bot_config").select("config")
        .eq("bot_id", botId).eq("feature", "customs-logging-state-v2").maybeSingle();
      const cfg = (data?.config ?? {}) as Record<string, unknown>;
      const seen = Array.isArray(cfg.seen_ids) ? (cfg.seen_ids as unknown[]).map(String) : [];
      return json({ ok: true, seen_ids: seen });
    }
    if (action === "log_state_set") {
      const seen = Array.isArray(body.seen_ids) ? (body.seen_ids as unknown[]).map(String).slice(-500) : [];
      await admin.from("bot_config").upsert(
        { bot_id: botId, feature: "customs-logging-state-v2", config: { seen_ids: seen }, updated_at: new Date().toISOString() },
        { onConflict: "bot_id,feature" },
      );
      return json({ ok: true });
    }
    if (action === "gamepass_find") {
      // Given a list of place ids and a package TITLE, find the game pass in
      // those games whose name matches that title (exact first, then contains).
      const b = body as Record<string, unknown>;
      const placeIds = Array.isArray(b.place_ids) ? b.place_ids.map((x) => String(x)) : [];
      const title = String(b.title ?? "").trim().toLowerCase();
      if (!placeIds.length || !title) return json({ ok: true, found: false, debug: "no place ids or title" });
      let partial: { id: string; name: string; price: number } | null = null;
      const debug: any[] = [];
      for (const pid of placeIds) {
        let universeId = "";
        let uStatus = 0;
        try {
          const ur = await fetch(`https://apis.roblox.com/universes/v1/places/${pid}/universe`, { headers: cookieHeaders() });
          uStatus = ur.status;
          if (ur.ok) universeId = String(((await ur.json()) as any)?.universeId ?? "");
        } catch (e) { uStatus = -1; }
        const dbg: any = { place: pid, universe: universeId, universeStatus: uStatus, count: 0, sample: [] as string[], passStatus: 0 };
        debug.push(dbg);
        if (!universeId) continue;
        let cursor = "";
        for (let page = 0; page < 6; page++) {
          const url = `https://games.roblox.com/v1/games/${universeId}/game-passes?limit=100&sortOrder=Asc${cursor ? `&cursor=${cursor}` : ""}`;
          const gr = await fetch(url, { headers: cookieHeaders() });
          dbg.passStatus = gr.status;
          if (!gr.ok) break;
          const gd = (await gr.json()) as any;
          const passes = Array.isArray(gd?.data) ? gd.data : [];
          dbg.count += passes.length;
          for (const p of passes) {
            if (dbg.sample.length < 10) dbg.sample.push(String(p?.name ?? ""));
            const name = String(p?.name ?? "").trim().toLowerCase();
            const hit = { id: String(p.id), name: String(p.name ?? ""), price: Number(p.price ?? 0) };
            if (name === title) return json({ ok: true, found: true, gamepass: hit });
            if (!partial && title && name.includes(title)) partial = hit;
          }
          cursor = String(gd?.nextPageCursor ?? "");
          if (!cursor) break;
        }
      }
      if (partial) return json({ ok: true, found: true, gamepass: partial });
      return json({ ok: true, found: false, debug });
    }
    if (action === "pkg_files_set") {
      // Stash a package post's receipt record (finished-product files, product
      // name, image, thread link, price) keyed by the post's message id, so it
      // can be delivered to a buyer on claim.
      const b = body as Record<string, unknown>;
      const msgId = String(b.msg_id ?? "");
      const record = (b.record && typeof b.record === "object") ? b.record : {};
      if (!msgId) return json({ error: "missing msg_id" }, 400);
      await admin.from("bot_config").upsert(
        { bot_id: botId, feature: `pkgfile:${msgId}`, config: { record }, updated_at: new Date().toISOString() },
        { onConflict: "bot_id,feature" },
      );
      return json({ ok: true });
    }
    if (action === "pkg_files_get") {
      const b = body as Record<string, unknown>;
      const msgId = String(b.msg_id ?? "");
      if (!msgId) return json({ ok: true, record: null });
      const { data } = await admin.from("bot_config").select("config")
        .eq("bot_id", botId).eq("feature", `pkgfile:${msgId}`).maybeSingle();
      const record = (data?.config as any)?.record ?? null;
      return json({ ok: true, record });
    }
    if (action === "pkg_shirt_next") {
      // Durable round-robin over the six shirt slots so the rotation survives bot
      // redeploys (an in-memory counter would reset to slot 1 on every restart).
      const { data } = await admin.from("bot_config").select("config")
        .eq("bot_id", botId).eq("feature", "customs-packages-state").maybeSingle();
      const cur = Number((data?.config as any)?.shirt_cursor ?? 0) + 1;
      const slot = ((cur - 1) % 6) + 1;
      await admin.from("bot_config").upsert(
        { bot_id: botId, feature: "customs-packages-state", config: { shirt_cursor: cur }, updated_at: new Date().toISOString() },
        { onConflict: "bot_id,feature" },
      );
      return json({ ok: true, slot });
    }
    if (action === "owns_asset") {
      // Does this Roblox user own the given catalog asset (a shirt)? 403 = hidden.
      const b = body as Record<string, unknown>;
      const userId = String(b.user_id ?? "").trim();
      const assetId = String(b.asset_id ?? "").trim();
      if (!userId || !assetId) return json({ ok: false, error: "missing user_id/asset_id" }, 400);
      const r = await fetch(`https://inventory.roblox.com/v1/users/${userId}/items/Asset/${assetId}/is-owned`);
      if (r.status === 403) return json({ ok: true, owned: false, hidden: true });
      if (!r.ok) return json({ ok: true, owned: false, hidden: false, error: `HTTP ${r.status}` });
      const txt = (await r.text()).trim().toLowerCase();
      return json({ ok: true, owned: txt === "true", hidden: false });
    }
    if (action === "owns_gamepass") {
      // Does this Roblox user own the given game pass? 403 = inventory hidden.
      const b = body as Record<string, unknown>;
      const userId = String(b.user_id ?? "").trim();
      const gpId = String(b.gamepass_id ?? "").trim();
      if (!userId || !gpId) return json({ ok: false, error: "missing user_id/gamepass_id" }, 400);
      const r = await fetch(`https://inventory.roblox.com/v1/users/${userId}/items/GamePass/${gpId}/is-owned`);
      if (r.status === 403) return json({ ok: true, owned: false, hidden: true });
      if (!r.ok) return json({ ok: true, owned: false, hidden: false, error: `HTTP ${r.status}` });
      const txt = (await r.text()).trim().toLowerCase();
      return json({ ok: true, owned: txt === "true", hidden: false });
    }
    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("robux-locker error:", message);
    return json({ error: message }, 500);
  }
});
