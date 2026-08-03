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
import { scrubGuilds } from "../_shared/discord-guilds.ts";
import { mintWorkerToken } from "../_shared/worker-token.ts";

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

// SECURITY GATE — pool-token guild scrub.
//
// A pool token must NEVER reach a new customer while it still has access to
// a previous customer's servers. Cancellation-time cleanup exists, but it
// can miss (edge function down, Discord outage, historical cancellations
// from before the cleanup was wired up). So the handout itself is gated:
// right after claiming a pool token, `scrubGuilds` (shared, see
// _shared/discord-guilds.ts) leaves every guild it's in and re-verifies the
// list is empty. If Discord won't let us finish, the deploy ABORTS — a dirty
// token is never shipped.

function repoSourceFor(base: string): string {
  const b = (base ?? "").toLowerCase().trim();
  switch (b) {
    case "support":
      return "22hype22/oversite-support";
    case "utilities":
      return "22hype22/oversite-utilities";
    case "dispatch":
      return "22hype22/oversite-dispatch";
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

// Wipe a pool token's Discord identity to a blank slate (avatar, banner, bio)
// so a bot returned to the pool never carries the previous customer's look to
// the next one. Runs at claim time right after the guild scrub, so it's
// guaranteed even if the cancellation-time reset never ran. Returns which
// fields Discord refused to clear (it silently ignores bio/banner for some
// applications) so the caller can alert staff to wipe them by hand.
async function resetBotIdentityToBlank(
  botToken: string,
): Promise<{ ok: boolean; stuck: string[]; error?: string }> {
  const stuck: string[] = [];
  let ok = true;
  let error: string | undefined;
  try {
    // Avatar + banner live on the bot USER.
    const res = await fetch("https://discord.com/api/v10/users/@me", {
      method: "PATCH",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ avatar: null, banner: null }),
    });
    if (!res.ok) {
      const text = await res.text();
      ok = false;
      error = `users HTTP ${res.status}: ${text.slice(0, 160)}`;
      stuck.push("avatar", "banner");
    } else {
      const updated = await res.json().catch(() => ({} as Record<string, unknown>));
      if (updated?.avatar) stuck.push("avatar");
      if (updated?.banner) stuck.push("banner");
    }
    // Description lives on the APPLICATION — clear it there.
    const aRes = await fetch("https://discord.com/api/v10/applications/@me", {
      method: "PATCH",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ description: "" }),
    });
    if (!aRes.ok) {
      const text = await aRes.text();
      ok = false;
      error = error ?? `applications HTTP ${aRes.status}: ${text.slice(0, 160)}`;
      stuck.push("description");
    } else {
      const app = await aRes.json().catch(() => ({} as Record<string, unknown>));
      if (typeof app?.description === "string" && app.description.trim().length > 0) {
        stuck.push("description");
      }
    }
    return { ok, stuck, error };
  } catch (e) {
    return { ok: false, stuck: ["avatar", "banner", "description"], error: String(e) };
  }
}

// Post a staff alert when a returned token's old banner/bio couldn't be wiped
// automatically, so a human clears it. Fire-and-forget; needs
// OVERSITE_UTILITIES_BOT_TOKEN + STAFF_ALERTS_CHANNEL_ID. No-op if missing.
async function alertStaffIdentityStuck(
  botName: string | null | undefined,
  orderId: string,
  stuck: string[],
): Promise<void> {
  const token = Deno.env.get("OVERSITE_UTILITIES_BOT_TOKEN");
  const channelId = Deno.env.get("STAFF_ALERTS_CHANNEL_ID");
  if (!token || !channelId) return;
  try {
    const content =
      `⚠️ **Returned bot token needs a manual identity wipe.**\n` +
      `A pool token was just handed to a new order and Discord refused to clear: **${stuck.join(", ")}**.\n` +
      `Bot: \`${botName ?? "unknown"}\` · Order: \`${orderId}\`\n` +
      `Open the bot's application and clear the leftover ${stuck.join(" / ")} so the new customer doesn't inherit the previous one.`;
    await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
  } catch (e) {
    console.warn("[auto-deploy-bot] identity-stuck staff alert failed", String(e));
  }
}

async function applyDiscordIdentity(
  botToken: string,
  identity: { username?: string | null; iconUrl?: string | null; bio?: string | null },
): Promise<{ ok: boolean; status?: number; error?: string }> {
  // Username + avatar go on the bot USER; the description ("About Me") is the
  // APPLICATION description (/applications/@me). Sending description as `bio`
  // to /users/@me is silently ignored for bots.
  const payload: Record<string, unknown> = {};
  if (identity.username) {
    payload.username = identity.username.trim().slice(0, 32);
  }
  let iconDataUrl: string | null = null;
  if (identity.iconUrl) {
    iconDataUrl = await fetchImageAsDataUrl(identity.iconUrl);
    if (iconDataUrl) payload.avatar = iconDataUrl;
  }
  let ok = true;
  let status: number | undefined;
  let error: string | undefined;
  try {
    if (Object.keys(payload).length > 0) {
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
        console.warn("[auto-deploy-bot] discord user patch failed", {
          status: res.status,
          body: text.slice(0, 300),
          keys: Object.keys(payload),
        });
        ok = false;
        status = res.status;
        error = text.slice(0, 300);
      } else {
        console.log("[auto-deploy-bot] discord user identity applied", { keys: Object.keys(payload) });
      }
    }
    // Application-level identity: the description ("About Me") AND the icon
    // shown on the OAuth "Add to server" screen. Setting the icon here — before
    // the customer ever opens the invite — makes that screen show their icon
    // instead of the pool app's placeholder. The application NAME is not
    // editable via the API, so it stays the pool app's Developer Portal name.
    const appPayload: Record<string, unknown> = {};
    if (identity.bio) appPayload.description = identity.bio.slice(0, 400);
    if (iconDataUrl) appPayload.icon = iconDataUrl;
    if (Object.keys(appPayload).length > 0) {
      const aRes = await fetch("https://discord.com/api/v10/applications/@me", {
        method: "PATCH",
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(appPayload),
      });
      if (!aRes.ok) {
        const text = await aRes.text();
        console.warn("[auto-deploy-bot] discord application patch failed", {
          status: aRes.status,
          body: text.slice(0, 300),
          keys: Object.keys(appPayload),
        });
        ok = false;
        status = status ?? aRes.status;
        error = error ?? text.slice(0, 300);
      } else {
        console.log("[auto-deploy-bot] discord application identity applied", { keys: Object.keys(appPayload) });
      }
    }
    return { ok, status, error };
  } catch (e) {
    console.warn("[auto-deploy-bot] discord identity patch threw", { e: String(e) });
    return { ok: false, error: String(e) };
  }
}

async function sendDeployedDM(
  discordUserId: string,
  botName: string | null | undefined,
): Promise<{ ok: boolean; error?: string }> {
  const notifierToken = Deno.env.get("OVERSITE_UTILITIES_BOT_TOKEN");
  if (!notifierToken) {
    return { ok: false, error: "OVERSITE_UTILITIES_BOT_TOKEN not configured" };
  }
  try {
    const dmRes = await fetch("https://discord.com/api/v10/users/@me/channels", {
      method: "POST",
      headers: {
        Authorization: `Bot ${notifierToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recipient_id: discordUserId }),
    });
    if (!dmRes.ok) {
      const text = await dmRes.text();
      return { ok: false, error: `open DM ${dmRes.status}: ${text.slice(0, 200)}` };
    }
    const channel = await dmRes.json();
    const channelId = channel?.id;
    if (!channelId) return { ok: false, error: "no DM channel id returned" };

    const name = botName?.trim() || "Your bot";
    const content =
      `🎉 **${name} is live!**\n\n` +
      `Your bot has finished deploying and is online. ` +
      `Head to your Oversite dashboard to invite it to your server and start configuring features.\n\n` +
      `https://oversite.shop/dashboard`;

    const msgRes = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${notifierToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
      },
    );
    if (!msgRes.ok) {
      const text = await msgRes.text();
      return { ok: false, error: `send DM ${msgRes.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}




// Build the env vars for a Dispatch (ER:LC voice dispatcher) bot. Unlike the
// Discord bases, Dispatch reads real credentials at boot: the customer's ER:LC
// server key plus which guild/voice-channel to sit in (pulled from their
// encrypted secrets), and the Oversite-bundled voice + AI keys (from this
// function's own env). Strictly separate from buildFeatureFlagVars — the F_*
// feature flags don't apply to Dispatch.
async function buildDispatchVars(
  admin: any,
  orderId: string,
  workerToken: string,
): Promise<Record<string, string>> {
  const vars: Record<string, string> = {};

  // Oversite-bundled, shared across every Dispatch bot. Set these as secrets on
  // this edge function. The customer's own values (ER:LC key, voice channel) are
  // fetched by the bot at runtime using the BOT_ORDER_ID + WORKER_TOKEN env that
  // every deploy already injects — so entering them later needs no redeploy.
  const bundled: Record<string, string | undefined> = {
    ELEVENLABS_API_KEY: Deno.env.get("DISPATCH_ELEVENLABS_API_KEY") ?? Deno.env.get("ELEVENLABS_API_KEY"),
    ANTHROPIC_API_KEY: Deno.env.get("DISPATCH_ANTHROPIC_API_KEY") ?? Deno.env.get("ANTHROPIC_API_KEY"),
    ELEVENLABS_VOICE_ID: Deno.env.get("DISPATCH_ELEVENLABS_VOICE_ID"),
    DISPATCH_REGION: Deno.env.get("DISPATCH_DEFAULT_REGION"),
    DISPATCH_TZ: Deno.env.get("DISPATCH_DEFAULT_TZ"),
  };
  for (const [k, v] of Object.entries(bundled)) {
    if (v && v.trim()) vars[k] = v.trim();
  }

  // Belt-and-suspenders: if the customer has ALREADY entered their ER:LC key
  // (true for every redeploy/reprovision after first setup), bake it in as a
  // real ERLC_SERVER_KEY env var — exactly like a hand-configured bot. The bot
  // reads env first (ERLC_KEY = os.environ.get("ERLC_SERVER_KEY")) and only
  // overwrites it if the runtime secret read succeeds, so this makes the bot
  // work at boot even if the token-gated read ever hiccups. On the very first
  // deploy the key isn't entered yet, so this is skipped and the bot picks it
  // up live later using its freshly-minted (registered) WORKER_TOKEN.
  //
  // We read it through the same runtime_get_bot_secret RPC the bot uses,
  // passing the just-minted worker token so decryption + token scoping happen
  // in one audited path. Failures are non-fatal — fall through to runtime read.
  try {
    const { data: erlcKey, error: erlcErr } = await admin.rpc("runtime_get_bot_secret", {
      _token: workerToken,
      _bot_id: orderId,
      _key: "ERLC_SERVER_KEY",
    });
    if (erlcErr) {
      console.warn("[auto-deploy-bot] dispatch ERLC key prefetch RPC error", erlcErr.message);
    } else if (typeof erlcKey === "string" && erlcKey.trim()) {
      vars.ERLC_SERVER_KEY = erlcKey.trim();
      console.log("[auto-deploy-bot] dispatch ERLC key baked into env vars", { orderId });
    } else {
      console.log("[auto-deploy-bot] dispatch ERLC key not yet entered — deferring to runtime read", { orderId });
    }
  } catch (e) {
    console.warn("[auto-deploy-bot] dispatch ERLC key prefetch threw", String(e));
  }

  return vars;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  // Same workaround as the anon key below: on this project the auto-injected
  // SUPABASE_SERVICE_ROLE_KEY may not carry service-role privileges (RLS then
  // silently hides every row). SERVICE_ROLE_KEY_OVERRIDE is a user-managed
  // secret holding a real service_role / sb_secret_ key and wins when set.
  const serviceKey = Deno.env.get("SERVICE_ROLE_KEY_OVERRIDE") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  // The auto-injected SUPABASE_ANON_KEY on newer projects is the publishable
  // key (sb_publishable_...), which PostgREST rejects. The worker needs the
  // legacy JWT anon key. Read it from LEGACY_ANON_JWT (user-managed secret)
  // and fall back to SUPABASE_ANON_KEY only if it already looks like a JWT.
  const envAnon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const legacyJwt = Deno.env.get("LEGACY_ANON_JWT") ?? "";
  const anonKey = legacyJwt.startsWith("eyJ")
    ? legacyJwt
    : (envAnon.startsWith("eyJ") ? envAnon : legacyJwt || envAnon);
  if (!anonKey.startsWith("eyJ")) {
    console.warn("[auto-deploy-bot] anon key is not a JWT — worker will fail to auth. Set the LEGACY_ANON_JWT secret to the legacy anon JWT (eyJ...).");
  }
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
      .select("id, user_id, bot_name, bot_description, bot_bio, icon_url, base, bot_token, addons, railway_service_id, status, deployment_status, deployment_attempted_at, discord_user_id, ready_dm_sent")
      .eq("id", orderId)
      .maybeSingle();

    if (orderErr || !order) {
      // Surface WHY the lookup failed — a DB error here (bad key, missing
      // column, RLS) otherwise masquerades as a missing order forever.
      // keyKind/keyRole/visibleRows expose the credential problem directly:
      // no error + 0 visible rows means the key is anon-level and RLS is
      // silently hiding the table from us.
      const keyKind = serviceKey.startsWith("sb_secret_")
        ? "sb_secret"
        : serviceKey.startsWith("sb_publishable_")
        ? "sb_publishable"
        : serviceKey.startsWith("eyJ")
        ? "legacy_jwt"
        : "unknown";
      let keyRole: string | null = null;
      if (keyKind === "legacy_jwt") {
        try {
          keyRole = JSON.parse(atob(serviceKey.split(".")[1])).role ?? null;
        } catch {
          keyRole = "undecodable";
        }
      }
      const { count: visibleRows, error: countErr } = await admin
        .from("bot_orders")
        .select("id", { count: "exact", head: true });
      const usingOverride = Boolean(Deno.env.get("SERVICE_ROLE_KEY_OVERRIDE"));
      console.error("[auto-deploy-bot] order lookup failed", {
        orderId,
        dbError: orderErr?.message ?? null,
        dbCode: (orderErr as { code?: string } | null)?.code ?? null,
        keyKind,
        keyRole,
        usingOverride,
        visibleRows: visibleRows ?? null,
        countError: countErr?.message ?? null,
      });
      return new Response(
        JSON.stringify({
          error: "Order not found",
          orderId: orderId ?? null,
          dbError: orderErr?.message ?? null,
          dbCode: (orderErr as { code?: string } | null)?.code ?? null,
          keyKind,
          keyRole,
          usingOverride,
          visibleRows: visibleRows ?? null,
          countError: countErr?.message ?? null,
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // PRE-SALE GUARD (defense in depth): never deploy a bot whose storefront
    // status is Pre-order or Coming Soon. Orders for a gated bot are held as
    // reserved pre-orders and never reach 'ready', so this normally isn't hit —
    // but if a deploy is triggered manually while the bot is gated, refuse it.
    // The order stays reserved until the owner flips the bot to Available.
    try {
      const { data: appRow } = await admin
        .from("app_settings")
        .select("bot_availability")
        .eq("id", 1)
        .maybeSingle();
      const availability = ((appRow as { bot_availability?: Record<string, string> } | null)
        ?.bot_availability ?? {}) as Record<string, string>;
      const gated = String(order.base ?? "")
        .split(/[^a-z0-9-]+/i)
        .filter(Boolean)
        .some((tok) => {
          const st = availability[tok];
          return st === "preorder" || st === "coming_soon";
        });
      if (gated) {
        console.log("[auto-deploy-bot] refusing deploy — bot is in pre-sale", {
          orderId,
          base: order.base,
        });
        return new Response(
          JSON.stringify({
            ok: true,
            held: true,
            message: "Bot is in Pre-order/Coming Soon — not deploying until it's set to Available.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    } catch (e) {
      console.warn("[auto-deploy-bot] pre-sale guard check failed (continuing)", String(e));
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
      // Self-healing pool: reclaim tokens stranded by cancelled orders or
      // parked as needs_cleanup, so a botched cancellation can never require
      // manual SQL to recover. Safe because the claim-time scrubGuilds gate strips and
      // verifies every claimed token before it reaches a customer anyway.
      try {
        const { data: stranded } = await admin
          .from("bot_token_pool")
          .select("id, assigned_bot_id, status")
          .in("status", ["assigned", "needs_cleanup"]);
        if (stranded && stranded.length > 0) {
          const linkedIds = stranded
            .map((r: any) => r.assigned_bot_id)
            .filter(Boolean) as string[];
          const { data: linkedOrders } = linkedIds.length
            ? await admin.from("bot_orders").select("id, status").in("id", linkedIds)
            : { data: [] as any[] };
          const statusById = new Map(
            (linkedOrders ?? []).map((o: any) => [o.id, o.status]),
          );
          const reclaim = stranded
            .filter((r: any) => {
              if (r.status === "needs_cleanup") return true;
              if (!r.assigned_bot_id) return true; // assigned to nothing
              const s = statusById.get(r.assigned_bot_id);
              return s === undefined || s === "cancelled"; // order gone or cancelled
            })
            .map((r: any) => r.id);
          if (reclaim.length > 0) {
            await admin
              .from("bot_token_pool")
              .update({
                status: "available",
                assigned_bot_id: null,
                assigned_at: null,
                updated_at: new Date().toISOString(),
              })
              .in("id", reclaim);
            console.log(
              `[auto-deploy-bot] self-heal: reclaimed ${reclaim.length} stranded pool token(s)`,
            );
          }
        }
      } catch (e) {
        console.warn("[auto-deploy-bot] pool self-heal failed", (e as Error).message);
      }

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

      // SECURITY GATE: never hand a pool token to a customer while it still
      // has access to someone else's servers. Only on the first deploy of an
      // order (no Railway service yet) — a re-deploy of an already-live bot
      // must NOT kick it from its current owner's servers.
      if (!order.railway_service_id) {
        const scrub = await scrubGuilds(botToken, "auto-deploy-bot");
        if (!scrub.clean) {
          const msg =
            `Deploy blocked for safety: the assigned bot token still has access to previous servers and Discord wouldn't let us remove it (${scrub.detail}). ` +
            "Retry the deploy in a few minutes.";
          console.error("[auto-deploy-bot] scrub failed", orderId, scrub.detail);
          await admin
            .from("bot_orders")
            .update({ deployment_status: "failed", deployment_error: msg })
            .eq("id", orderId);
          return new Response(JSON.stringify({ error: msg }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        console.log("[auto-deploy-bot] pool token scrub:", scrub.detail);

        // Wipe the previous owner's identity (avatar/banner/bio) before this
        // token reaches the new customer. Discord doesn't let a bot re-fetch
        // and change its own banner/bio reliably, so if it refuses, alert
        // staff to clear it by hand instead of silently leaking it.
        const idReset = await resetBotIdentityToBlank(botToken);
        if (!idReset.ok) {
          console.warn("[auto-deploy-bot] identity reset call failed:", idReset.error);
          await alertStaffIdentityStuck((order as any).bot_name, orderId, idReset.stuck);
        } else if (idReset.stuck.length > 0) {
          console.warn("[auto-deploy-bot] identity fields Discord refused to clear:", idReset.stuck.join(", "));
          await alertStaffIdentityStuck((order as any).bot_name, orderId, idReset.stuck);
        } else {
          console.log("[auto-deploy-bot] identity reset to blank slate");
        }
      }
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


    const workerToken = await mintWorkerToken(admin, orderId, order.bot_name);
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
    const isDispatch = (order.base ?? "").toLowerCase().trim() === "dispatch";
    const featureFlagVars = isDispatch
      ? await buildDispatchVars(admin, orderId, workerToken)
      : buildFeatureFlagVars(order.base, purchasedAddons);

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
    if (!isDispatch) {
      await provisionAddonEntitlements(admin, orderId, order.base, purchasedAddons);
    }

    // Send the "your bot is live" Discord DM directly from the edge function
    // using the Oversite Utilities notifier bot. This replaces the previous
    // Python-bot-polled /pending?type=ready flow which never ran reliably.
    const discordUserId = (order as any).discord_user_id as string | null;
    const alreadyDmd = Boolean((order as any).ready_dm_sent);
    if (discordUserId && !alreadyDmd) {
      const dm = await sendDeployedDM(discordUserId, (order as any).bot_name);
      if (dm.ok) {
        await admin
          .from("bot_orders")
          .update({ ready_dm_sent: true, updated_at: new Date().toISOString() })
          .eq("id", orderId);
        console.log("[auto-deploy-bot] deployed DM sent", { orderId, discordUserId });
      } else {
        console.warn("[auto-deploy-bot] deployed DM failed", { orderId, discordUserId, error: dm.error });
      }
    } else {
      console.log("[auto-deploy-bot] deployed DM skipped", {
        orderId,
        hasDiscordUserId: Boolean(discordUserId),
        alreadyDmd,
      });
    }


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
