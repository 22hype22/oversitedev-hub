// Auto-deploy a bot to Railway by cloning a template service.
//
// Invocation:
//   POST { orderId: string }
//   - Called automatically by the bot_orders trigger when status -> 'ready'.
//   - Can also be called by an admin (e.g. retry button) using their JWT.
//
// It clones the correct Railway template service (Protection / Support /
// Utilities) based on the order's `base` field, sets the bot-specific env
// vars, triggers a deploy, and writes the new service id back to bot_orders.
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

function templateServiceFor(base: string): string {
  const b = (base ?? "").toLowerCase();
  if (b === "protection") return Deno.env.get("RAILWAY_TEMPLATE_SERVICE_PROTECTION") ?? "";
  if (b === "support") return Deno.env.get("RAILWAY_TEMPLATE_SERVICE_SUPPORT") ?? "";
  if (b === "utilities") return Deno.env.get("RAILWAY_TEMPLATE_SERVICE_UTILITIES") ?? "";
  return "";
}

async function getTemplateSource(serviceId: string): Promise<{ repo?: string; branch?: string; image?: string; envId: string }> {
  const data = await railway(
    `query($id: String!) {
      service(id: $id) {
        id
        repo { fullName branch }
        templateServiceId
        project { environments { edges { node { id name } } } }
      }
    }`,
    { id: serviceId },
  );
  const svc = data?.service;
  if (!svc) throw new Error("Template service not found");
  const edges = svc.project?.environments?.edges ?? [];
  const prod = edges.find((e: any) => e.node.name === "production") ?? edges[0];
  if (!prod) throw new Error("Template has no environment");
  return {
    repo: svc.repo?.fullName,
    branch: svc.repo?.branch,
    envId: prod.node.id,
  };
}

async function createServiceFromRepo(
  projectId: string,
  name: string,
  repo: string,
  branch: string | undefined,
): Promise<string> {
  const data = await railway(
    `mutation($input: ServiceCreateInput!) {
      serviceCreate(input: $input) { id }
    }`,
    {
      input: {
        projectId,
        name,
        source: { repo },
        branch: branch ?? undefined,
      },
    },
  );
  const id = data?.serviceCreate?.id;
  if (!id) throw new Error("serviceCreate returned no id");
  return id;
}

async function getEnvironmentId(serviceId: string): Promise<string> {
  const data = await railway(
    `query($id: String!) {
      service(id: $id) { project { environments { edges { node { id name } } } } }
    }`,
    { id: serviceId },
  );
  const edges = data?.service?.project?.environments?.edges ?? [];
  const prod = edges.find((e: any) => e.node.name === "production") ?? edges[0];
  if (!prod) throw new Error("No environment found on new service");
  return prod.node.id;
}

async function setVariables(
  projectId: string,
  environmentId: string,
  serviceId: string,
  vars: Record<string, string>,
) {
  await railway(
    `mutation($input: VariableCollectionUpsertInput!) {
      variableCollectionUpsert(input: $input)
    }`,
    {
      input: {
        projectId,
        environmentId,
        serviceId,
        variables: vars,
        replace: false,
      },
    },
  );
}

async function redeploy(serviceId: string, environmentId: string) {
  await railway(
    `mutation($serviceId: String!, $environmentId: String!) {
      serviceInstanceRedeploy(serviceId: $serviceId, environmentId: $environmentId)
    }`,
    { serviceId, environmentId },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
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

    const { data: order, error: orderErr } = await admin
      .from("bot_orders")
      .select("id, user_id, bot_name, base, bot_token, railway_service_id, status, deployment_status")
      .eq("id", orderId)
      .maybeSingle();

    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (order.railway_service_id) {
      return new Response(
        JSON.stringify({ ok: true, alreadyDeployed: true, serviceId: order.railway_service_id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Resolve the Discord bot token. Prefer a manually-set token on the
    // order; otherwise claim the next available token from the pool.
    let botToken = order.bot_token as string | null;
    let poolClientId: string | null = null;
    if (!botToken) {
      const { data: claim, error: claimErr } = await admin.rpc(
        "claim_pool_token_for_deploy",
        { _order_id: orderId },
      );
      if (claimErr) throw new Error(`Token pool claim failed: ${claimErr.message}`);
      const c = claim as { ok?: boolean; error?: string; token?: string; client_id?: string } | null;
      if (!c?.ok) {
        const isEmpty = c?.error === "pool_empty";
        const msg = isEmpty
          ? "No bot tokens available in the pool. Add more tokens to the bot token pool before marking this order ready."
          : `Could not claim a bot token: ${c?.error ?? "unknown error"}`;
        await admin
          .from("bot_orders")
          .update({ deployment_status: "failed", deployment_error: msg })
          .eq("id", orderId);
        return new Response(JSON.stringify({ error: msg, pool_empty: isEmpty }), {
          status: isEmpty ? 409 : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      botToken = c.token ?? null;
      poolClientId = c.client_id ?? null;
      if (!botToken) throw new Error("Pool returned an empty token");
    }

    const projectId = Deno.env.get("RAILWAY_PROJECT_ID");
    if (!projectId) throw new Error("RAILWAY_PROJECT_ID not configured");

    const templateId = templateServiceFor(order.base);
    if (!templateId) {
      throw new Error(
        `No Railway template configured for base "${order.base}". Expected protection/support/utilities.`,
      );
    }

    // Mark as deploying
    await admin
      .from("bot_orders")
      .update({
        deployment_status: "deploying",
        deployment_error: null,
        deployment_attempted_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    const tmpl = await getTemplateSource(templateId);
    if (!tmpl.repo) {
      throw new Error("Template service has no GitHub repo — cannot clone source.");
    }

    const serviceName = `${order.bot_name ?? "bot"}-${orderId.slice(0, 8)}`
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50);

    const newServiceId = await createServiceFromRepo(projectId, serviceName, tmpl.repo, tmpl.branch);
    const newEnvId = await getEnvironmentId(newServiceId);

    const workerToken = Deno.env.get("WORKER_TOKEN") ?? "";
    const fnUrl = `${supabaseUrl}/functions/v1`;

    await setVariables(projectId, newEnvId, newServiceId, {
      BOT_TOKEN: order.bot_token,
      BOT_ORDER_ID: orderId,
      SUPABASE_URL: supabaseUrl,
      SUPABASE_ANON_KEY: anonKey,
      WORKER_TOKEN: workerToken,
      SUPABASE_FN_URL: fnUrl,
    });

    await redeploy(newServiceId, newEnvId);

    await admin
      .from("bot_orders")
      .update({
        railway_service_id: newServiceId,
        deployment_status: "deployed",
        deployment_error: null,
      })
      .eq("id", orderId);

    return new Response(
      JSON.stringify({ ok: true, serviceId: newServiceId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[auto-deploy-bot] failed", { orderId, message });
    if (orderId) {
      await admin
        .from("bot_orders")
        .update({ deployment_status: "failed", deployment_error: message })
        .eq("id", orderId);
    }
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
