// Railway-verified status fallback for the bot dashboard.
//
// Bots report their own status via /heartbeat on support-bot-api /
// utilities-bot-api. If a bot's heartbeat loop dies (task crash, gateway
// reconnect that never restarts the loop, …) the dashboard would show
// "offline" forever even though the bot is healthy in Discord. This function
// is the second opinion: for bots whose heartbeat is stale or self-reported
// offline, ask Railway what the service's latest deployment is actually doing
// and write that truth into bot_runtime_status.
//
// Called by the dashboard (useLiveBotStatuses) with the user's JWT; only the
// caller's own bots are synced unless the caller is an admin.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const RAILWAY_API = "https://backboard.railway.app/graphql/v2";

// A heartbeat younger than this is trusted as-is and never overridden.
const FRESH_MS = 45_000;
// Don't hammer Railway: at most this many services checked per call.
const MAX_CHECKS = 12;
// Dashboard-driven transitions (stopping/starting/restarting/updating).
// Right after one of these is written, Railway's latest deployment can still
// read SUCCESS from *before* the action took effect — so for this window a
// SUCCESS is ignored rather than clobbering the transition back to online.
const TRANSITIONAL = new Set(["stopping", "starting", "restarting", "updating"]);
const TRANSITION_GRACE_MS = 45_000;

async function railway(query: string, variables: Record<string, unknown>) {
  const token = Deno.env.get("RAILWAY_API_TOKEN");
  if (!token) throw new Error("RAILWAY_API_TOKEN not configured");
  const res = await fetch(RAILWAY_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const data = await res.json();
  if (!res.ok || data.errors) {
    throw new Error(data.errors?.[0]?.message ?? `Railway HTTP ${res.status}`);
  }
  return data.data;
}

async function environmentIdFor(serviceId: string): Promise<string> {
  const fromEnv =
    Deno.env.get("RAILWAY_ENVIRONMENT_ID") ||
    Deno.env.get("RAILWAY_PRODUCTION_ENVIRONMENT_ID");
  if (fromEnv) return fromEnv;
  const data = await railway(
    `query($id: String!) {
      service(id: $id) {
        project { environments { edges { node { id name } } } }
      }
    }`,
    { id: serviceId },
  );
  const edges = data?.service?.project?.environments?.edges ?? [];
  const prod = edges.find((e: any) => e.node.name === "production") ?? edges[0];
  if (!prod) throw new Error("No environment found for Railway service");
  return prod.node.id as string;
}

/** Latest deployment status for a service, e.g. SUCCESS / CRASHED / REMOVED. */
async function latestDeploymentStatus(serviceId: string): Promise<string | null> {
  const environmentId = await environmentIdFor(serviceId);
  const data = await railway(
    `query($input: DeploymentListInput!) {
      deployments(input: $input, first: 1) {
        edges { node { id status } }
      }
    }`,
    { input: { serviceId, environmentId } },
  );
  return data?.deployments?.edges?.[0]?.node?.status ?? null;
}

/** Map Railway deployment status onto the dashboard's status vocabulary. */
function mapStatus(railwayStatus: string): string {
  switch (railwayStatus) {
    case "SUCCESS":
      return "online";
    case "CRASHED":
    case "FAILED":
      return "crashed";
    case "BUILDING":
    case "DEPLOYING":
    case "INITIALIZING":
    case "QUEUED":
    case "WAITING":
      return "starting";
    default:
      // REMOVED / REMOVING / SLEEPING / SKIPPED / unknown
      return "offline";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json(401, { error: "Unauthorized" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const jwt = authHeader.replace("Bearer ", "");
    const { data: claimData, error: claimErr } = await userClient.auth.getClaims(jwt);
    if (claimErr || !claimData?.claims) return json(401, { error: "Unauthorized" });
    const userId = claimData.claims.sub as string;

    const body = await req.json().catch(() => ({} as any));
    const botIds: string[] = Array.isArray(body?.botIds)
      ? body.botIds.map(String).slice(0, 50)
      : [];
    if (botIds.length === 0) return json(200, { statuses: {} });

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });

    // Only deployed bots with a real Railway service can be verified.
    let query = admin
      .from("bot_orders")
      .select("id, user_id, railway_service_id")
      .in("id", botIds)
      .eq("status", "ready")
      .not("railway_service_id", "is", null);
    if (!isAdmin) query = query.eq("user_id", userId);
    const { data: orders, error: ordersErr } = await query;
    if (ordersErr) return json(500, { error: ordersErr.message });
    if (!orders || orders.length === 0) return json(200, { statuses: {} });

    // Trust fresh heartbeats — only second-guess stale or non-online rows.
    const { data: runtime } = await admin
      .from("bot_runtime_status")
      .select("bot_id, status, last_heartbeat_at, updated_at")
      .in("bot_id", orders.map((o: any) => o.id));
    const runtimeById = new Map<string, any>(
      (runtime ?? []).map((r: any) => [r.bot_id, r]),
    );

    const candidates = orders
      .filter((o: any) => {
        const r = runtimeById.get(o.id);
        if (!r) return true;
        const hbAge = r.last_heartbeat_at
          ? Date.now() - new Date(r.last_heartbeat_at).getTime()
          : Infinity;
        return r.status !== "online" || hbAge > FRESH_MS;
      })
      .slice(0, MAX_CHECKS);

    const statuses: Record<string, { status: string; railway: string | null }> = {};

    await Promise.all(
      candidates.map(async (order: any) => {
        try {
          const railwayStatus = await latestDeploymentStatus(order.railway_service_id);
          if (!railwayStatus) return;
          const mapped = mapStatus(railwayStatus);

          // Mid-transition rules: keep the user-facing label ("Restarting…",
          // "Redeploying…") until Railway reaches a terminal state.
          const current = runtimeById.get(order.id);
          if (current && TRANSITIONAL.has(current.status)) {
            const age = current.updated_at
              ? Date.now() - new Date(current.updated_at).getTime()
              : Infinity;
            // Don't downgrade a named transition to the generic "starting".
            if (mapped === "starting") return;
            // A SUCCESS this soon after the action is almost certainly the
            // deployment from *before* it — wait for the next check.
            if (mapped === "online" && age < TRANSITION_GRACE_MS) return;
          }

          statuses[order.id] = { status: mapped, railway: railwayStatus };

          const now = new Date().toISOString();
          const upsert: Record<string, unknown> = {
            bot_id: order.id,
            user_id: order.user_id,
            status: mapped,
            updated_at: now,
            details: { source: "railway-sync", railway_status: railwayStatus, checked_at: now },
          };
          // Refresh the heartbeat only when Railway confirms the container is
          // up, so the stale-heartbeat guard keeps working for dead services.
          if (mapped === "online") upsert.last_heartbeat_at = now;
          const { error: upsertErr } = await admin
            .from("bot_runtime_status")
            .upsert(upsert, { onConflict: "bot_id" });
          if (upsertErr) {
            console.warn("[bot-status-sync] upsert failed", order.id, upsertErr.message);
          }
        } catch (err) {
          console.warn(
            "[bot-status-sync] railway check failed",
            order.id,
            err instanceof Error ? err.message : String(err),
          );
        }
      }),
    );

    return json(200, { statuses, checked: candidates.length });
  } catch (err) {
    return json(500, { error: err instanceof Error ? err.message : String(err) });
  }
});
