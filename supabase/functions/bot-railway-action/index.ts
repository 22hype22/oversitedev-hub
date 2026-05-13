import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type Action = "start" | "stop" | "restart" | "redeploy";

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
    const msg = json.errors?.[0]?.message ?? `Railway HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json.data;
}

async function getLatestEnvironmentId(serviceId: string): Promise<string> {
  const data = await railway(
    `query($id: String!) {
      service(id: $id) {
        projectId
        project {
          environments { edges { node { id name } } }
        }
      }
    }`,
    { id: serviceId },
  );
  const edges = data?.service?.project?.environments?.edges ?? [];
  const prod = edges.find((e: any) => e.node.name === "production") ?? edges[0];
  if (!prod) throw new Error("No environment found for Railway service");
  return prod.node.id as string;
}

async function performAction(serviceId: string, action: Action) {
  const environmentId = await getLatestEnvironmentId(serviceId);

  if (action === "stop") {
    return railway(
      `mutation($serviceId: String!, $environmentId: String!) {
        serviceInstanceUpdate(
          serviceId: $serviceId
          environmentId: $environmentId
          input: { numReplicas: 0 }
        )
      }`,
      { serviceId, environmentId },
    );
  }

  if (action === "start") {
    await railway(
      `mutation($serviceId: String!, $environmentId: String!) {
        serviceInstanceUpdate(
          serviceId: $serviceId
          environmentId: $environmentId
          input: { numReplicas: 1 }
        )
      }`,
      { serviceId, environmentId },
    );
    return railway(
      `mutation($serviceId: String!, $environmentId: String!) {
        serviceInstanceRedeploy(serviceId: $serviceId, environmentId: $environmentId)
      }`,
      { serviceId, environmentId },
    );
  }

  return railway(
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

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimData, error: claimErr } = await userClient.auth.getClaims(token);
    if (claimErr || !claimData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimData.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const botId: string | undefined = body?.botId;
    const action: Action | undefined = body?.action;
    const ALLOWED: Action[] = ["start", "stop", "restart", "redeploy"];
    if (!botId || !action || !ALLOWED.includes(action)) {
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: bot, error: botErr } = await admin
      .from("bot_orders")
      .select("id, user_id, railway_service_id")
      .eq("id", botId)
      .maybeSingle();

    if (botErr || !bot) {
      return new Response(JSON.stringify({ error: "Bot not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (bot.user_id !== userId) {
      const { data: isAdmin } = await admin.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!bot.railway_service_id) {
      return new Response(
        JSON.stringify({
          error: "This bot is not linked to a Railway service yet.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: audit } = await admin
      .from("bot_commands")
      .insert({
        bot_id: botId,
        user_id: bot.user_id,
        requested_by: userId,
        action: action === "redeploy" ? "update" : action,
        status: "pending",
      })
      .select("id")
      .single();

    try {
      await performAction(bot.railway_service_id, action);
      if (audit) {
        await admin
          .from("bot_commands")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", audit.id);
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (audit) {
        await admin
          .from("bot_commands")
          .update({
            status: "failed",
            error_message: message,
            completed_at: new Date().toISOString(),
          })
          .eq("id", audit.id);
      }
      return new Response(JSON.stringify({ error: message }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
