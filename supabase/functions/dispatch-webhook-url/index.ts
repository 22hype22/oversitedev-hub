// The address a customer pastes into their ER:LC private server settings so
// typing ";request supervisor" in game reaches their dispatch bot.
//
// Invocation:
//   POST { orderId: string, regenerate?: boolean }
//        (as the signed-in owner of that order)
//
// Every bot listens on its own service, so every customer needs their own
// address. The service has one the moment it is deployed, but nothing hands it
// to the customer, so the feature sat switched on and unreachable. This looks
// it up, creates one if the service has never been given a public address, and
// returns it with the path already on the end so there is nothing to assemble
// by hand.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RAILWAY_API = "https://backboard.railway.app/graphql/v2";
// The path the bot listens on. Kept in step with ERLC_WEBHOOK_PATH in the bot.
const HOOK_PATH = "/erlc";
// The port the bot binds. Railway needs it to point a domain at the process.
const HOOK_PORT = 8080;

/** A fresh address. Short, unguessable, and nothing to do with the customer,
 *  so a leaked one tells nobody anything about whose bot it was. */
function freshHost(): string {
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `erlc-${hex}.up.railway.app`;
}

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

/** The environment this service actually runs in. */
async function environmentFor(serviceId: string): Promise<{ envId: string; projectId: string }> {
  const data = await railway(
    `query($id: String!) {
       service(id: $id) {
         projectId
         project { environments { edges { node { id name } } } }
       }
     }`,
    { id: serviceId },
  );
  const edges = data?.service?.project?.environments?.edges ?? [];
  const prod = edges.find((e: any) => e.node.name === "production") ?? edges[0];
  if (!prod) throw new Error("no environment found for this bot's service");
  return { envId: prod.node.id as string, projectId: data.service.projectId as string };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Whoever is asking must be signed in, and the order must be theirs. The
    // address is not a secret in the sense a key is, but it is the door to
    // somebody's bot and it belongs to them alone.
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "not signed in" }, 401);
    const asUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await asUser.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "not signed in" }, 401);

    const body = await req.json().catch(() => ({}));
    const orderId = body?.orderId;
    if (!orderId) return json({ error: "orderId required" }, 400);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: order, error } = await admin
      .from("bot_orders")
      .select("id, user_id, railway_service_id")
      .eq("id", orderId)
      .maybeSingle();
    if (error) throw error;
    if (!order) return json({ error: "no such bot" }, 404);
    if (order.user_id !== user.id) {
      const { data: isAdmin } = await admin.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      if (!isAdmin) return json({ error: "not your bot" }, 403);
    }

    const serviceId = order.railway_service_id;
    if (!serviceId) {
      return json({
        ready: false,
        reason: "This bot has not finished deploying yet. The address appears once it is running.",
      });
    }

    const { envId, projectId } = await environmentFor(serviceId);
    const existing = await railway(
      `query($p: String!, $e: String!, $s: String!) {
         domains(projectId: $p, environmentId: $e, serviceId: $s) {
           serviceDomains { domain }
           customDomains { domain }
         }
       }`,
      { p: projectId, e: envId, s: serviceId },
    );
    // A custom domain, when one has been set up, reads better than the
    // generated one, so it wins.
    const custom = existing?.domains?.customDomains?.[0]?.domain;
    const generated = existing?.domains?.serviceDomains?.[0];
    let domain = custom ?? generated?.domain;

    // Regenerating is what you do when a link has got out. The old address
    // stops pointing at the bot the moment this returns, so whoever has it
    // holds nothing. A custom domain is left alone: it was set up deliberately
    // and is not ours to throw away.
    if (body?.regenerate === true && !custom && generated?.id) {
      const want = freshHost();
      await railway(
        `mutation($i: ServiceDomainUpdateInput!) { serviceDomainUpdate(input: $i) }`,
        {
          i: {
            serviceDomainId: generated.id,
            environmentId: envId,
            serviceId,
            domain: want,
            targetPort: HOOK_PORT,
          },
        },
      );
      const after = await railway(
        `query($p: String!, $e: String!, $s: String!) {
           domains(projectId: $p, environmentId: $e, serviceId: $s) {
             serviceDomains { domain }
           }
         }`,
        { p: projectId, e: envId, s: serviceId },
      );
      domain = after?.domains?.serviceDomains?.[0]?.domain ?? want;
    }

    if (!domain) {
      const made = await railway(
        `mutation($i: ServiceDomainCreateInput!) {
           serviceDomainCreate(input: $i) { domain }
         }`,
        { i: { environmentId: envId, serviceId, targetPort: HOOK_PORT } },
      );
      domain = made?.serviceDomainCreate?.domain;
    }
    if (!domain) return json({ error: "could not work out this bot's address" }, 500);

    return json({ ready: true, url: `https://${domain}${HOOK_PATH}` });
  } catch (err) {
    console.error("[dispatch-webhook-url]", (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});
