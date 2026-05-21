// Auto-deploy a bot to Railway from a configured template service.
//
// Invocation:
//   POST { orderId: string }
//   - Called automatically by the bot_orders trigger when status -> 'ready'.
//   - Can also be called by an admin (e.g. retry button) using their JWT.
//
// It creates the correct Railway service (Protection / Support / Utilities)
// based on the order's `base` field, sets the bot-specific env vars, triggers
// a deploy, and writes the new service id back to bot_orders.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RAILWAY_API = "https://backboard.railway.com/graphql/v2";

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

function repoSourceFor(base: string): string {
  const b = (base ?? "").toLowerCase().trim();
  switch (b) {
    case "support":
      return "22hype22/oversite-support";
    case "utilities":
      return "22hype22/oversite-utilities";
    case "protection":
    case "scratch":
    case "all-in-one-pack":
    case "all_in_one_pack":
    case "allinonepack":
    default:
      return "22hype22/oversite-protection";
  }
}

// ──────────────────────────────────────────────────────────────────────
// Feature flag catalog
//
// Maps every purchasable add-on id (the values stored in
// `bot_orders.addons`, also defined in `src/lib/botCatalog.ts`) to the
// feature-flag environment variable the bot script reads at boot.
// Keep this list in sync with `worker/src/index.ts` ADDON_FLAGS and with
// any feature flag the bot repos consume.
// ──────────────────────────────────────────────────────────────────────
const ADDON_FLAGS: Record<string, string> = {
  // Protection — base-included
  "verification-system":        "F_VERIFICATION",
  "mod-actions":                "F_MODERATION",
  "anti-spam":                  "F_ANTI_SPAM",
  "anti-raid":                  "F_ANTI_RAID",
  "auto-role":                  "F_AUTOROLE",
  "phishing-detection":         "F_PHISHING",
  "rules":                      "F_RULES",
  // Protection — paid add-ons
  "advanced-logging":           "F_ADVANCED_LOGGING",
  "nsfw-invite-scanner":        "F_NSFW_SCANNER",
  "avatar-nsfw-detection":      "F_AVATAR_NSFW",
  "bio-phrase-detection":       "F_BIO_PHRASES",
  "auto-escalating-warnings":   "F_AUTO_ESCALATE",
  "softban-massban":            "F_SOFTBAN_MASSBAN",
  "channel-lockdown":           "F_CHANNEL_LOCKDOWN",
  "staff-notes":                "F_STAFF_NOTES",
  "moderation-history":         "F_MOD_HISTORY",
  "auto-slowmode":              "F_AUTO_SLOWMODE",
  "temp-ban":                   "F_TEMP_BAN",
  "ban-tools":                  "F_SOFTBAN_MASSBAN",

  // Support
  "staff-performance":             "F_STAFF_PERFORMANCE",
  "ticket-logs":                   "F_TICKET_LOGS",
  "ticket-notes":                  "F_TICKET_NOTES",
  "ticket-add-remove":             "F_TICKET_MEMBERS",
  "close-all-tickets":             "F_CLOSE_ALL",
  "ticket-message-customization":  "F_TICKET_MSG_CUSTOM",
  "priority-flagging":             "F_PRIORITY_TICKETS",
  "auto-close-inactive":           "F_AUTO_CLOSE",
  "anonymous-reporting":           "F_ANON_REPORTING",
  "messages":                      "F_SAY",

  // Utilities
  "music-addon":                "F_MUSIC_ADDON",
  "auto-radio":                 "F_AUTO_RADIO",
  "starboard":                  "F_STARBOARD",
  "recurring-messages":         "F_RECURRING",
  "giveaway-system":            "F_GIVEAWAY",
  "server-stats-channels":      "F_SERVER_STATS",
  "live-notifications":         "F_STREAM_NOTIFS",
  "leveling-system":            "F_LEVELING",
  "economy-system":             "F_ECONOMY",
  "remindme":                   "F_REMINDME",

  // Shared / cross-bot extras
  "branding":                   "F_CUSTOM_BRANDING",
  "dashboard":                  "F_WEB_DASHBOARD",
  "multi-server":               "F_MULTI_SERVER",
};

/**
 * Features that are always on for a given base (no purchase required).
 * Mirrors `BASE_INCLUDED_ADDONS` in `src/lib/botCatalog.ts` plus a few
 * built-in commands that ship with each base bot.
 */
const BASE_FEATURE_FLAGS: Record<string, string[]> = {
  protection: [
    "F_VERIFICATION", "F_MODERATION", "F_ANTI_SPAM", "F_ANTI_RAID",
    "F_AUTOROLE", "F_PHISHING", "F_BASIC_LOGGING", "F_RULES", "F_SAY",
    "F_ADMIN_ABUSE",
  ],
  support: [
    "F_TICKETS", "F_APPEALS", "F_REPORTS", "F_WELCOME", "F_SAY",
    "F_SUGGESTIONS",
  ],
  utilities: [
    "F_ANNOUNCE", "F_REACTION_ROLES", "F_POLL", "F_USERINFO",
    "F_SERVERINFO", "F_AVATAR", "F_8BALL", "F_COINFLIP",
    "F_BASIC_MUSIC", "F_SAY",
  ],
};

/**
 * Mirrors `BASE_INCLUDED_ADDONS` from the catalog — the addon ids whose
 * config blocks ship with each base bot. We provision these into
 * `bot_addon_state` alongside purchased addons so the dashboard renders
 * them as enabled immediately after deploy.
 */
const BASE_INCLUDED_ADDONS: Record<string, string[]> = {
  protection: [
    "verification-system", "mod-actions", "anti-spam", "anti-raid",
    "phishing-detection", "auto-role", "messages", "rules",
  ],
  support: [
    "staff-performance", "ticket-logs", "ticket-notes", "ticket-add-remove",
    "close-all-tickets", "ticket-message-customization", "priority-flagging",
    "auto-close-inactive", "messages",
  ],
  utilities: [
    "music-addon", "auto-radio", "starboard", "recurring-messages",
    "giveaway-system", "server-stats-channels", "live-notifications",
    "leveling-system", "economy-system", "remindme", "staff-notes",
    "messages",
  ],
};

function normalizeBase(base: string): "protection" | "support" | "utilities" | "scratch" {
  const b = (base ?? "").toLowerCase().trim();
  if (b === "support" || b === "utilities") return b;
  if (
    b === "scratch" ||
    b === "all-in-one-pack" ||
    b === "all_in_one_pack" ||
    b === "allinonepack"
  ) {
    return "scratch";
  }
  return "protection";
}

/**
 * Compute the `F_*` env vars to set on the Railway service from the
 * order's purchased addons + the bot's base features.
 */
function buildFeatureFlagVars(
  base: string,
  purchasedAddons: string[],
): Record<string, string> {
  const flags: Record<string, string> = {};
  const norm = normalizeBase(base);

  // Always-on base features. "scratch" turns every base on (legacy combined bot).
  const baseSets = norm === "scratch"
    ? [...BASE_FEATURE_FLAGS.protection, ...BASE_FEATURE_FLAGS.support, ...BASE_FEATURE_FLAGS.utilities]
    : BASE_FEATURE_FLAGS[norm] ?? [];
  for (const f of baseSets) flags[f] = "true";

  // Base-included addons (config-only but bot script may also gate on them).
  const includedAddons = norm === "scratch"
    ? [...BASE_INCLUDED_ADDONS.protection, ...BASE_INCLUDED_ADDONS.support, ...BASE_INCLUDED_ADDONS.utilities]
    : BASE_INCLUDED_ADDONS[norm] ?? [];
  for (const id of includedAddons) {
    const flag = ADDON_FLAGS[id];
    if (flag) flags[flag] = "true";
  }

  // Purchased add-ons.
  for (const id of purchasedAddons ?? []) {
    const flag = ADDON_FLAGS[id];
    if (flag) flags[flag] = "true";
  }

  return flags;
}

/**
 * Ensure a `bot_addon_state` row exists with enabled=true for every
 * base-included and purchased addon. This "provisions" the customer's
 * entitlements so the dashboard shows the matching config blocks the
 * moment the bot finishes deploying.
 */
async function provisionAddonEntitlements(
  admin: ReturnType<typeof createClient>,
  botId: string,
  base: string,
  purchasedAddons: string[],
) {
  const norm = normalizeBase(base);
  const ids = new Set<string>();
  const included = norm === "scratch"
    ? [...BASE_INCLUDED_ADDONS.protection, ...BASE_INCLUDED_ADDONS.support, ...BASE_INCLUDED_ADDONS.utilities]
    : BASE_INCLUDED_ADDONS[norm] ?? [];
  for (const id of included) ids.add(id);
  for (const id of purchasedAddons ?? []) ids.add(id);
  if (ids.size === 0) return;

  const rows = [...ids].map((addon_id) => ({
    bot_id: botId,
    addon_id,
    enabled: true,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await admin
    .from("bot_addon_state")
    .upsert(rows, { onConflict: "bot_id,addon_id", ignoreDuplicates: false });
  if (error) {
    console.warn("[auto-deploy-bot] provisionAddonEntitlements failed", {
      botId,
      message: error.message,
    });
  } else {
    console.log("[auto-deploy-bot] provisioned addon entitlements", {
      botId,
      count: rows.length,
    });
  }
}

function railwayEnvironmentId(): string {
  const environmentId =
    Deno.env.get("RAILWAY_ENVIRONMENT_ID") ??
    Deno.env.get("RAILWAY_PRODUCTION_ENVIRONMENT_ID") ??
    "";
  if (!environmentId) {
    throw new Error("RAILWAY_ENVIRONMENT_ID not configured.");
  }
  return environmentId;
}

type RailwayService = { id: string; name: string };

function buildServiceName(botName: string | null | undefined, orderId: string): string {
  return `${botName ?? "bot"}-${orderId.slice(0, 8)}`
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

async function listProjectServices(projectId: string): Promise<RailwayService[]> {
  const services: RailwayService[] = [];
  let after: string | null = null;
  do {
    const data = await railway(
      `query($projectId: String!, $after: String) {
      project(id: $projectId) {
        services(first: 100, after: $after) {
          edges { cursor node { id name } }
          pageInfo { hasNextPage endCursor }
        }
      }
    }`,
      { projectId, after },
    );
    const conn = data?.project?.services;
    const edges = conn?.edges ?? [];
    services.push(
      ...edges
        .map((edge: any) => edge?.node)
        .filter((node: any): node is RailwayService => Boolean(node?.id && node?.name)),
    );
    after = conn?.pageInfo?.hasNextPage ? conn?.pageInfo?.endCursor ?? null : null;
  } while (after);
  return services;
}

async function deleteService(serviceId: string) {
  await railway(
    `mutation($id: String!) { serviceDelete(id: $id) }`,
    { id: serviceId },
  );
}

async function renameService(serviceId: string, name: string) {
  await railway(
    `mutation($id: String!, $input: ServiceUpdateInput!) {
      serviceUpdate(id: $id, input: $input) { id name }
    }`,
    { id: serviceId, input: { name } },
  );
}

async function resolveReusableService(
  projectId: string,
  canonicalName: string,
  preferredServiceId?: string | null,
): Promise<string | null> {
  const services = await listProjectServices(projectId);
  const byId = new Map<string, RailwayService>();
  for (const service of services) {
    if (service.name === canonicalName || service.name.startsWith(`${canonicalName}-`)) {
      byId.set(service.id, service);
    }
  }
  const candidates = [...byId.values()];
  if (candidates.length === 0) return null;

  const exact = candidates.filter((service) => service.name === canonicalName);
  const keep =
    exact.find((service) => service.id === preferredServiceId) ??
    exact[0] ??
    candidates.find((service) => service.id === preferredServiceId) ??
    candidates[0];

  for (const duplicate of candidates) {
    if (duplicate.id === keep.id) continue;
    try {
      await deleteService(duplicate.id);
      console.log("[auto-deploy-bot] deleted duplicate Railway service", {
        serviceId: duplicate.id,
        serviceName: duplicate.name,
        keptServiceId: keep.id,
        canonicalName,
      });
    } catch (e) {
      console.warn("[auto-deploy-bot] duplicate Railway service delete failed", {
        serviceId: duplicate.id,
        serviceName: duplicate.name,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (keep.name !== canonicalName && exact.length === 0) {
    try {
      await renameService(keep.id, canonicalName);
    } catch (e) {
      console.warn("[auto-deploy-bot] Railway service rename failed", {
        serviceId: keep.id,
        from: keep.name,
        to: canonicalName,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  console.log("[auto-deploy-bot] reusing Railway service", {
    serviceId: keep.id,
    serviceName: keep.name,
    canonicalName,
    duplicateCount: Math.max(candidates.length - 1, 0),
  });
  return keep.id;
}

async function createServiceFromRepo(
  projectId: string,
  environmentId: string,
  name: string,
  repo: string,
): Promise<string> {
  const data = await railway(
    `mutation($input: ServiceCreateInput!) {
      serviceCreate(input: $input) { id }
    }`,
    {
      input: {
        projectId,
        environmentId,
        name,
      },
    },
  );
  const id = data?.serviceCreate?.id;
  if (!id) throw new Error("serviceCreate returned no id");
  await connectServiceToRepo(id, environmentId, repo);
  return id;
}

async function connectServiceToRepo(serviceId: string, environmentId: string, repo: string) {
  let connected = false;
  try {
    await railway(
      `mutation($id: String!, $input: ServiceConnectInput!) {
        serviceConnect(id: $id, input: $input) { id }
      }`,
      { id: serviceId, input: { repo, branch: "main" } },
    );
    connected = true;
    console.log("[auto-deploy-bot] Railway source connected via serviceConnect", {
      serviceId,
      repo,
      branch: "main",
    });
  } catch (e) {
    console.warn("[auto-deploy-bot] serviceConnect failed, trying serviceInstanceUpdate", {
      serviceId,
      message: e instanceof Error ? e.message : String(e),
    });
  }

  try {
    await updateServiceSource(serviceId, environmentId, repo);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (!connected) throw new Error(`Could not connect Railway repo source: ${message}`);
    console.warn("[auto-deploy-bot] serviceInstanceUpdate source fallback failed after serviceConnect", {
      serviceId,
      message,
    });
  }
}

async function updateServiceSource(serviceId: string, environmentId: string, repo: string) {
  await railway(
    `mutation($serviceId: String!, $environmentId: String!, $input: ServiceInstanceUpdateInput!) {
      serviceInstanceUpdate(serviceId: $serviceId, environmentId: $environmentId, input: $input)
    }`,
    {
      serviceId,
      environmentId,
      input: {
        source: { repo, branch: "main" },
      },
    },
  );
  console.log("[auto-deploy-bot] Railway source connected via serviceInstanceUpdate", {
    serviceId,
    repo,
    branch: "main",
  });
}


async function setVariables(
  projectId: string,
  environmentId: string,
  serviceId: string,
  vars: Record<string, string>,
) {
  // Railway's per-variable variableUpsert can stage pending changes that the
  // dashboard shows as "1 Change". Send the full set atomically instead.
  const variables = Object.fromEntries(
    Object.entries(vars).map(([name, value]) => [name, String(value).trim()]),
  );
  await railway(
    `mutation($input: VariableCollectionUpsertInput!) {
      variableCollectionUpsert(input: $input)
    }`,
    {
      input: {
        projectId,
        environmentId,
        serviceId,
        variables,
      },
    },
  );
  console.log("[auto-deploy-bot] variableCollectionUpsert ok", {
    serviceId,
    count: Object.keys(variables).length,
    keys: Object.keys(variables).sort(),
  });
}

async function fetchServiceVariables(
  projectId: string,
  environmentId: string,
  serviceId: string,
): Promise<Record<string, string>> {
  const data = await railway(
    `query($projectId: String!, $environmentId: String!, $serviceId: String!) {
      variables(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId)
    }`,
    { projectId, environmentId, serviceId },
  );
  const raw = (data?.variables ?? {}) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v == null) continue;
    out[k] = String(v);
  }
  console.log("[auto-deploy-bot] fetchServiceVariables", {
    serviceId,
    count: Object.keys(out).length,
    keys: Object.keys(out).sort(),
  });
  return out;
}

async function deploymentCreate(
  projectId: string,
  serviceId: string,
  environmentId: string,
  variables: Record<string, string>,
  required: boolean,
) {
  try {
    await railway(
      `mutation($input: DeploymentCreateInput!) {
        deploymentCreate(input: $input) { id status }
      }`,
      { input: { projectId, serviceId, environmentId, variables } },
    );
    console.log("[auto-deploy-bot] deploymentCreate ok", { serviceId, withVariables: true });
    return;
  } catch (e) {
    console.warn("[auto-deploy-bot] deploymentCreate with variables failed", {
      serviceId,
      message: e instanceof Error ? e.message : String(e),
    });
    if (!required) return;
  }
  await railway(
    `mutation($input: DeploymentCreateInput!) {
      deploymentCreate(input: $input) { id status }
    }`,
    { input: { projectId, serviceId, environmentId } },
  );
  console.log("[auto-deploy-bot] deploymentCreate ok", { serviceId, withVariables: false });
}

async function deployService(
  projectId: string,
  serviceId: string,
  environmentId: string,
  variables: Record<string, string>,
) {
  // After variableCollectionUpsert, explicitly create a fresh service deploy.
  // If Railway ever stages the variables anyway, deploymentCreate is tried as
  // the final direct-build fallback.
  try {
    await railway(
      `mutation($serviceId: String!, $environmentId: String!) {
        serviceInstanceRedeploy(serviceId: $serviceId, environmentId: $environmentId)
      }`,
      { serviceId, environmentId },
    );
    console.log("[auto-deploy-bot] serviceInstanceRedeploy ok", { serviceId });
    await deploymentCreate(projectId, serviceId, environmentId, variables, false);
    return;
  } catch (e) {
    console.warn("[auto-deploy-bot] serviceInstanceRedeploy failed, trying serviceInstanceDeploy", {
      serviceId,
      message: e instanceof Error ? e.message : String(e),
    });
  }
  try {
    await railway(
      `mutation($serviceId: String!, $environmentId: String!) {
        serviceInstanceDeploy(serviceId: $serviceId, environmentId: $environmentId)
      }`,
      { serviceId, environmentId },
    );
    return;
  } catch (e) {
    console.warn("[auto-deploy-bot] serviceInstanceDeploy failed, trying deploymentTrigger", {
      serviceId,
      message: e instanceof Error ? e.message : String(e),
    });
  }
  try {
    await railway(
      `mutation($serviceId: String!, $environmentId: String!) {
        deploymentTrigger(serviceId: $serviceId, environmentId: $environmentId)
      }`,
      { serviceId, environmentId },
    );
    return;
  } catch (e) {
    console.warn("[auto-deploy-bot] deploymentTrigger failed, trying serviceInstanceDeployV2", {
      serviceId,
      message: e instanceof Error ? e.message : String(e),
    });
  }
  try {
    await railway(
      `mutation($serviceId: String!, $environmentId: String!) {
        serviceInstanceDeployV2(serviceId: $serviceId, environmentId: $environmentId)
      }`,
      { serviceId, environmentId },
    );
    return;
  } catch (e) {
    console.warn("[auto-deploy-bot] serviceInstanceDeployV2 failed, falling back to serviceDeploy", {
      serviceId,
      message: e instanceof Error ? e.message : String(e),
    });
  }
  try {
    await railway(
      `mutation($serviceId: String!, $environmentId: String!) {
        serviceDeploy(serviceId: $serviceId, environmentId: $environmentId)
      }`,
      { serviceId, environmentId },
    );
    return;
  } catch (e) {
    console.warn("[auto-deploy-bot] serviceDeploy failed, trying deploymentCreate", {
      serviceId,
      message: e instanceof Error ? e.message : String(e),
    });
  }
  try {
    await railway(
      `mutation($input: DeploymentCreateInput!) {
        deploymentCreate(input: $input) { id status }
      }`,
      { input: { projectId, serviceId, environmentId, variables } },
    );
    console.log("[auto-deploy-bot] deploymentCreate ok", { serviceId, withVariables: true });
    return;
  } catch (e) {
    console.warn("[auto-deploy-bot] deploymentCreate with variables failed, trying without variables", {
      serviceId,
      message: e instanceof Error ? e.message : String(e),
    });
  }
  await railway(
    `mutation($input: DeploymentCreateInput!) {
      deploymentCreate(input: $input) { id status }
    }`,
    { input: { projectId, serviceId, environmentId } },
  );
  console.log("[auto-deploy-bot] deploymentCreate ok", { serviceId, withVariables: false });
}

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "image/png";
    const buf = new Uint8Array(await res.arrayBuffer());
    // Cap at ~8 MB raw to stay well under Discord's limit.
    if (buf.byteLength > 8_000_000) return null;
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    const b64 = btoa(bin);
    return `data:${contentType};base64,${b64}`;
  } catch (e) {
    console.warn("[auto-deploy-bot] avatar fetch failed", { url, e: String(e) });
    return null;
  }
}

async function applyDiscordIdentity(
  botToken: string,
  identity: { username?: string | null; iconUrl?: string | null; bio?: string | null },
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const payload: Record<string, unknown> = {};
  if (identity.username) {
    payload.username = identity.username.trim().slice(0, 32);
  }
  if (identity.bio) {
    payload.bio = identity.bio.slice(0, 190);
  }
  if (identity.iconUrl) {
    const dataUrl = await fetchImageAsDataUrl(identity.iconUrl);
    if (dataUrl) payload.avatar = dataUrl;
  }
  if (Object.keys(payload).length === 0) return { ok: true };
  try {
    const res = await fetch("https://discord.com/api/v10/users/@me", {
      method: "PATCH",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn("[auto-deploy-bot] discord identity patch failed", {
        status: res.status,
        body: text.slice(0, 300),
        keys: Object.keys(payload),
      });
      return { ok: false, status: res.status, error: text.slice(0, 300) };
    }
    console.log("[auto-deploy-bot] discord identity applied", {
      keys: Object.keys(payload),
    });
    return { ok: true };
  } catch (e) {
    console.warn("[auto-deploy-bot] discord identity patch threw", { e: String(e) });
    return { ok: false, error: String(e) };
  }
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
  let invocationSource: string | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    orderId = body?.orderId;
    invocationSource = body?.source;
    if (!orderId) {
      return new Response(JSON.stringify({ error: "orderId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: order, error: orderErr } = await admin
      .from("bot_orders")
      .select("id, user_id, bot_name, bot_description, bot_bio, icon_url, base, bot_token, addons, railway_service_id, status, deployment_status, deployment_attempted_at")
      .eq("id", orderId)
      .maybeSingle();

    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Concurrency lock: refuse to start a new deploy if one is already in
    // flight. A stale lock older than 10 minutes is considered abandoned.
    // Skip this check when invoked by the bot_orders trigger — the trigger
    // sets deployment_status='deploying' in the same transaction before
    // calling us, so the lock would always trip on the first auto-deploy.
    if (order.deployment_status === "deploying" && invocationSource !== "trigger") {
      const attemptedAt = (order as { deployment_attempted_at?: string | null })
        .deployment_attempted_at
        ? new Date(
            (order as { deployment_attempted_at: string }).deployment_attempted_at,
          ).getTime()
        : 0;
      const ageMs = Date.now() - attemptedAt;
      if (ageMs < 10 * 60 * 1000) {
        return new Response(
          JSON.stringify({
            ok: true,
            alreadyInProgress: true,
            message: "A deployment is already in progress for this bot.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
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
        if (c?.error === "pool_empty") {
          // Hold the order in a friendly "queued" state. A token-pool trigger
          // will retry this order automatically when a new token is added.
          const friendly =
            "We're currently preparing your bot — our team is on it and you'll receive a Discord DM as soon as it's live. Thank you for your patience!";
          await admin
            .from("bot_orders")
            .update({
              deployment_status: "queued",
              deployment_error: friendly,
              deployment_attempted_at: new Date().toISOString(),
            })
            .eq("id", orderId);
          return new Response(
            JSON.stringify({ ok: true, queued: true, message: friendly }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        const msg = `Could not claim a bot token: ${c?.error ?? "unknown error"}`;
        await admin
          .from("bot_orders")
          .update({ deployment_status: "failed", deployment_error: msg })
          .eq("id", orderId);
        return new Response(JSON.stringify({ error: msg }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      botToken = c.token ?? null;
      poolClientId = c.client_id ?? null;
      if (!botToken) throw new Error("Pool returned an empty token");
    }

    const projectId = Deno.env.get("RAILWAY_PROJECT_ID");
    if (!projectId) throw new Error("RAILWAY_PROJECT_ID not configured");

    const repo = repoSourceFor(order.base);

    // Mark as deploying
    await admin
      .from("bot_orders")
      .update({
        deployment_status: "deploying",
        deployment_error: null,
        deployment_attempted_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    const environmentId = railwayEnvironmentId();

    const serviceName = buildServiceName(order.bot_name, orderId);
    const existingServiceId = await resolveReusableService(
      projectId,
      serviceName,
      order.railway_service_id as string | null,
    );
    const targetServiceId = existingServiceId ??
      await createServiceFromRepo(projectId, environmentId, serviceName, repo);

    if (existingServiceId) {
      await connectServiceToRepo(targetServiceId, environmentId, repo);
    }

    await admin
      .from("bot_orders")
      .update({ railway_service_id: targetServiceId })
      .eq("id", orderId);


    const workerToken = Deno.env.get("WORKER_TOKEN") ?? "";
    const fnUrl = `${supabaseUrl}/functions/v1`;

    if (!botToken || typeof botToken !== "string" || botToken.trim() === "") {
      throw new Error("Refusing to deploy: DISCORD_TOKEN is empty after pool claim");
    }
    if (!workerToken || workerToken.trim() === "") {
      throw new Error("Refusing to deploy: WORKER_TOKEN secret is not configured");
    }

    const purchasedAddons = Array.isArray((order as any).addons)
      ? ((order as any).addons as string[])
      : [];
    const featureFlagVars = buildFeatureFlagVars(order.base, purchasedAddons);

    const varsPayload: Record<string, string> = {
      DISCORD_TOKEN: botToken.trim(),
      ...(poolClientId ? { DISCORD_CLIENT_ID: poolClientId } : {}),
      BOT_ORDER_ID: orderId,
      SUPABASE_URL: supabaseUrl,
      SUPABASE_ANON_KEY: anonKey,
      WORKER_TOKEN: workerToken,
      SUPABASE_FN_URL: fnUrl,
      ...featureFlagVars,
    };

    // Log shape (not values) of the payload to confirm DISCORD_TOKEN is present.
    console.log("[auto-deploy-bot] variableCollectionUpsert payload", {
      orderId,
      serviceId: targetServiceId,
      serviceName,
      reusedService: Boolean(existingServiceId),
      keys: Object.keys(varsPayload),
      botTokenLength: varsPayload.DISCORD_TOKEN?.length ?? 0,
      botTokenPreview: varsPayload.DISCORD_TOKEN
        ? `${varsPayload.DISCORD_TOKEN.slice(0, 4)}…${varsPayload.DISCORD_TOKEN.slice(-4)}`
        : "(empty)",
      hasClientId: Boolean(poolClientId),
      featureFlagCount: Object.keys(featureFlagVars).length,
      enabledFlags: Object.keys(featureFlagVars).sort(),
      purchasedAddons,
    });

    await setVariables(
      projectId,
      environmentId,
      targetServiceId,
      varsPayload,
    );

    // Verify Railway actually stored DISCORD_TOKEN with the value we sent.
    // If it comes back empty/missing, do NOT redeploy — abort so the bot
    // doesn't boot with an empty token.
    try {
      const stored = await fetchServiceVariables(projectId, environmentId, targetServiceId);
      const storedToken = stored?.DISCORD_TOKEN ?? "";
      console.log("[auto-deploy-bot] post-upsert verification", {
        serviceId: targetServiceId,
        storedKeys: Object.keys(stored ?? {}),
        storedBotTokenLength: storedToken.length,
      });
      if (!storedToken || storedToken.length !== varsPayload.DISCORD_TOKEN.length) {
        throw new Error(
          `Railway stored DISCORD_TOKEN with length ${storedToken.length}, expected ${varsPayload.DISCORD_TOKEN.length}. Refusing to redeploy.`,
        );
      }
    } catch (verifyErr) {
      const m = verifyErr instanceof Error ? verifyErr.message : String(verifyErr);
      // If the verification query itself fails (schema change etc.) log and
      // continue rather than blocking deploys, but if it's our explicit
      // mismatch error, re-throw.
      if (m.includes("Refusing to redeploy")) throw verifyErr;
      console.warn("[auto-deploy-bot] variable verification query failed (continuing)", { message: m });
    }

    await deployService(projectId, targetServiceId, environmentId, varsPayload);

    await admin
      .from("bot_orders")
      .update({
        railway_service_id: targetServiceId,
        deployment_status: "deployed",
        deployment_error: null,
      })
      .eq("id", orderId);

    // Apply the customer's chosen identity (username/avatar/bio) to the
    // Discord application now that we have a confirmed token. This makes the
    // bot come online already branded without any manual step from the owner.
    const identityRes = await applyDiscordIdentity(botToken.trim(), {
      username: (order as any).bot_name ?? null,
      iconUrl: (order as any).icon_url ?? null,
      bio: (order as any).bot_bio ?? null,
    });
    if (identityRes.ok) {
      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if ((order as any).bot_name) {
        patch.discord_last_username_change_at = new Date().toISOString();
      }
      await admin.from("bot_orders").update(patch).eq("id", orderId);
    }

    // Provision base-included + purchased addon entitlements so the
    // dashboard renders every config block the customer paid for the
    // moment they land on the page after deploy.
    await provisionAddonEntitlements(admin, orderId, order.base, purchasedAddons);


    return new Response(
      JSON.stringify({ ok: true, serviceId: targetServiceId, reusedService: Boolean(existingServiceId) }),
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
