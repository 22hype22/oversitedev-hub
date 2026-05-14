// Edge function for the external Railway "utilities bot" to read/update
// bot_orders without ever seeing the service-role key. Auth = WORKER_TOKEN
// header, validated against the existing worker_tokens table via the
// _worker_token_lookup() SECURITY DEFINER function.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-worker-token",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const DM_TYPES = {
  in_build: "dm_sent",
  ready: "ready_dm_sent",
  cancel: "cancel_dm_sent",
} as const;
type DmType = keyof typeof DM_TYPES;

async function authenticate(req: Request): Promise<boolean> {
  const token =
    req.headers.get("x-worker-token") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";
  if (!token) return false;
  const { data, error } = await admin.rpc("_worker_token_lookup", {
    _token: token,
  });
  if (error || !data || (Array.isArray(data) && data.length === 0)) return false;
  // touch last_used_at — fire and forget
  const tokenId = Array.isArray(data) ? data[0]?.token_id : (data as any).token_id;
  if (tokenId) {
    admin
      .from("worker_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", tokenId)
      .then(() => {});
  }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!(await authenticate(req))) {
    return json(401, { error: "Invalid or missing worker token" });
  }

  const url = new URL(req.url);
  // Strip the function name prefix so we can route on the rest.
  const path = url.pathname.replace(/^.*\/utilities-bot-api/, "") || "/";

  try {
    // GET /pending?type=in_build|ready|cancel&limit=25
    if (req.method === "GET" && path.startsWith("/pending")) {
      const type = url.searchParams.get("type") as DmType | null;
      if (!type || !(type in DM_TYPES)) {
        return json(400, { error: "type must be in_build, ready, or cancel" });
      }
      const limit = Math.min(
        100,
        Math.max(1, Number(url.searchParams.get("limit") || "25")),
      );
      const flag = DM_TYPES[type];
      const { data, error } = await admin
        .from("bot_orders")
        .select(
          "id, user_id, bot_name, status, discord_user_id, discord_username, total_amount, currency, addons, base, notes, confirmation_deadline_at, created_at",
        )
        .eq("status", type)
        .eq(flag, false)
        .order("created_at", { ascending: true })
        .limit(limit);
      if (error) return json(500, { error: error.message });
      return json(200, { orders: data ?? [] });
    }

    if (req.method !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    const body = await req.json().catch(() => ({} as any));
    const orderId = String(body.orderId || "");
    if (!orderId) return json(400, { error: "orderId required" });

    // POST /mark-dm-sent { orderId, type }
    if (path.startsWith("/mark-dm-sent")) {
      const type = body.type as DmType;
      if (!type || !(type in DM_TYPES)) {
        return json(400, { error: "type must be in_build, ready, or cancel" });
      }
      const flag = DM_TYPES[type];
      const { error } = await admin
        .from("bot_orders")
        .update({ [flag]: true, updated_at: new Date().toISOString() })
        .eq("id", orderId);
      if (error) return json(500, { error: error.message });
      return json(200, { ok: true });
    }

    // POST /cancel-order { orderId, reason? }
    if (path.startsWith("/cancel-order")) {
      const reason = body.reason ? String(body.reason) : null;
      const { error } = await admin
        .from("bot_orders")
        .update({
          status: "cancel",
          cancellation_reason: reason,
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);
      if (error) return json(500, { error: error.message });
      return json(200, { ok: true });
    }

    // POST /confirm-payment {
    //   orderId, confirmed_username?, stripe_payment_intent_id?,
    //   build_started?: boolean (defaults true), paid?: boolean (defaults true)
    // }
    if (path.startsWith("/confirm-payment")) {
      const now = new Date().toISOString();
      const update: Record<string, unknown> = { updated_at: now };
      if (body.confirmed_username) update.confirmed_username = String(body.confirmed_username);
      if (body.stripe_payment_intent_id)
        update.stripe_payment_intent_id = String(body.stripe_payment_intent_id);
      if (body.paid !== false) {
        update.paid_at = now;
        update.charged_at = now;
      }
      if (body.build_started !== false) update.build_started = now;
      const { error } = await admin
        .from("bot_orders")
        .update(update)
        .eq("id", orderId);
      if (error) return json(500, { error: error.message });
      return json(200, { ok: true });
    }

    return json(404, { error: `Unknown route: ${path}` });
  } catch (e) {
    console.error("utilities-bot-api error", e);
    return json(500, { error: (e as Error).message ?? "Internal error" });
  }
});
