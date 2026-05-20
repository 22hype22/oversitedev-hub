// Tear down a bot's Railway service when its order is cancelled.
//
// Invocation:
//   POST { orderId: string }
//
// Called by the bot_orders trigger when status -> 'cancelled'. The trigger
// has already released the pool token; this function scales / removes the
// Railway service and clears railway_service_id on the order so the slot
// is fully cleaned up.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RAILWAY_API = "https://backboard.railway.app/graphql/v2";

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
  const json = await res.json();
  if (!res.ok || json.errors) {
    throw new Error(json.errors?.[0]?.message ?? `Railway HTTP ${res.status}`);
  }
  return json.data;
}

async function getEnvironmentId(serviceId: string): Promise<string | null> {
  try {
    const data = await railway(
      `query($id: String!) {
        service(id: $id) { project { environments { edges { node { id name } } } } }
      }`,
      { id: serviceId },
    );
    const edges = data?.service?.project?.environments?.edges ?? [];
    const prod = edges.find((e: any) => e.node.name === "production") ?? edges[0];
    return prod?.node?.id ?? null;
  } catch {
    return null;
  }
}

async function scaleToZero(serviceId: string, environmentId: string) {
  // Set replicas to 0 so the service stops running but stays available for inspection.
  await railway(
    `mutation($serviceId: String!, $environmentId: String!, $replicas: Int!) {
      serviceInstanceUpdate(
        serviceId: $serviceId,
        environmentId: $environmentId,
        input: { numReplicas: $replicas }
      )
    }`,
    { serviceId, environmentId, replicas: 0 },
  ).catch((err) => console.warn("[cancel-bot-deploy] scale failed", err.message));
}

async function deleteService(serviceId: string) {
  await railway(
    `mutation($id: String!) { serviceDelete(id: $id) }`,
    { id: serviceId },
  ).catch((err) => console.warn("[cancel-bot-deploy] delete failed", err.message));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  let orderId: string | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    orderId = body?.orderId;
    if (!orderId) {
      return new Response(JSON.stringify({ error: "orderId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: order } = await admin
      .from("bot_orders")
      .select("id, railway_service_id, status")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceId = order.railway_service_id as string | null;
    if (serviceId) {
      const envId = await getEnvironmentId(serviceId);
      if (envId) await scaleToZero(serviceId, envId);
      // Then fully remove the service so the Railway slot is freed.
      await deleteService(serviceId);
    }

    await admin
      .from("bot_orders")
      .update({
        railway_service_id: null,
        deployment_status: "pending",
        deployment_error: null,
      })
      .eq("id", orderId);

    return new Response(
      JSON.stringify({ ok: true, teardown: serviceId ?? null }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cancel-bot-deploy] failed", { orderId, message });
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
