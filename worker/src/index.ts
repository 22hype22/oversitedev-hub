import {
  supabase,
  WORKER_ID,
  WORKER_TOKEN_VALUE,
  POLL_INTERVAL_MS,
} from "./supabase.js";
import { BotRuntime } from "./runtime.js";
import { startHealthServer } from "./health.js";

const runtimes = new Map<string, BotRuntime>();
const health = { startedAt: Date.now(), runtimes, lastPollAt: Date.now() };
startHealthServer(health);

// Railway config
const RAILWAY_API_TOKEN = process.env.RAILWAY_API_TOKEN ?? "";
const RAILWAY_PROJECT_ID = process.env.RAILWAY_PROJECT_ID ?? "64aea150-f8c9-4c5a-8dea-de4763b31b1d";
const RAILWAY_ENVIRONMENT_ID = process.env.RAILWAY_ENVIRONMENT_ID ?? "c5e3fda2-4957-4e4c-986a-7314927ecd0a";

// GitHub repos for each bot type
const BOT_REPOS: Record<string, string> = {
  "protection": "22hype22/oversite-protection",
  "support":    "22hype22/oversite-support",
  "utilities":  "22hype22/oversite-utilities",
};

// Addon ID -> feature flag env var name
const ADDON_FLAGS: Record<string, string> = {
  // Protection addons
  "advanced-logging":         "F_ADVANCED_LOGGING",
  "nsfw-invite-scanner":      "F_NSFW_SCANNER",
  "avatar-nsfw-detection":    "F_AVATAR_NSFW",
  "bio-phrase-detection":     "F_BIO_PHRASES",
  "account-age-gating":       "F_ACCOUNT_AGE_GATE",
  "auto-escalating-warnings": "F_AUTO_ESCALATE",
  "softban-massban":          "F_SOFTBAN_MASSBAN",
  "channel-lockdown":         "F_CHANNEL_LOCKDOWN",
  "staff-notes":              "F_STAFF_NOTES",
  "moderation-history":       "F_MOD_HISTORY",
  "auto-slowmode":            "F_AUTO_SLOWMODE",
  "temp-ban":                 "F_TEMP_BAN",
  // Support addons
  "staff-performance":            "F_STAFF_PERFORMANCE",
  "ticket-logs":                  "F_TICKET_LOGS",
  "per-category-roles":           "F_PER_CATEGORY_ROLES",
  "ticket-notes":                 "F_TICKET_NOTES",
  "ticket-members":               "F_TICKET_MEMBERS",
  "close-all-tickets":            "F_CLOSE_ALL",
  "ticket-message-customization": "F_TICKET_MSG_CUSTOM",
  "priority-ticket":              "F_PRIORITY_TICKETS",
  "auto-close-tickets":           "F_AUTO_CLOSE",
  "anonymous-reporting":          "F_ANON_REPORTING",
  // Utilities addons
  "music":                "F_MUSIC_ADDON",
  "auto-radio":           "F_AUTO_RADIO",
  "roblox-verification":  "F_ROBLOX",
  "starboard":            "F_STARBOARD",
  "recurring-messages":   "F_RECURRING",
  "giveaway":             "F_GIVEAWAY",
  "birthday":             "F_BIRTHDAY",
  "server-stats":         "F_SERVER_STATS",
  "stream-notifications": "F_STREAM_NOTIFS",
  "leveling":             "F_LEVELING",
  "economy":              "F_ECONOMY",
  "remindme":             "F_REMINDME",
};

function getRuntime(botId: string): BotRuntime {
  let r = runtimes.get(botId);
  if (!r) {
    r = new BotRuntime(botId);
    runtimes.set(botId, r);
  }
  return r;
}

type Cmd = {
  id: string;
  bot_id: string;
  action: "start" | "stop" | "restart" | "update" | "list_channels" | "list_guilds" | "list_roles";
  payload?: {
    guild_id?: string;
  } | null;
};

type BuildJob = {
  id: string;
  order_id: string;
  status: string;
  selections: {
    bot_name: string;
    base: string;
    addons: string[];
    icon_url?: string;
    banner_url?: string;
    bot_description?: string;
  };
};

// ============================================================
// COMMAND HANDLING
// ============================================================

async function claimNextCommand(): Promise<Cmd | null> {
  const { data, error } = await supabase.rpc("runtime_claim_next_command", {
    _token: WORKER_TOKEN_VALUE,
    _worker_id: WORKER_ID,
  });
  if (error) {
    console.error("claim error:", error.message);
    return null;
  }
  const result = data as { ok: boolean; command: Cmd | null; error?: string };
  if (!result?.ok) {
    console.error("claim refused:", result?.error);
    return null;
  }
  const cmd = result.command ?? null;
  // The worker must NOT process post_message commands — those are handled
  // exclusively by the deployed Discord bot. Release it back to pending so
  // the bot can claim it.
  if (cmd && cmd.action === "post_message") {
    await supabase
      .from("bot_commands")
      .update({ status: "pending", claimed_at: null, worker_id: null })
      .eq("id", cmd.id);
    return null;
  }
  return cmd;
}

async function completeCommand(id: string, ok: boolean, errorMessage?: string) {
  await supabase.rpc("runtime_complete_command", {
    _token: WORKER_TOKEN_VALUE,
    _command_id: id,
    _status: ok ? "done" : "failed",
    _error: errorMessage ?? null,
  });
}

async function processCommand(cmd: Cmd) {
  console.log(`[${cmd.bot_id}] processing ${cmd.action}`);
  const runtime = getRuntime(cmd.bot_id);
  try {
    switch (cmd.action) {
      case "start":    await runtime.start(); break;
      case "stop":     await runtime.stop(); break;
      case "restart":  await runtime.restart(); break;
      case "update":   await runtime.restart(); break;
      case "list_guilds": await runtime.listGuilds(); break;
      case "list_channels": {
        const guildId = cmd.payload?.guild_id;
        if (!guildId) throw new Error("Missing guild_id for list_channels");
        await runtime.listChannels(guildId);
        break;
      }
      case "list_roles": {
        const guildId = cmd.payload?.guild_id;
        if (!guildId) throw new Error("Missing guild_id for list_roles");
        await runtime.listRoles(guildId);
        break;
      }
    }
    await completeCommand(cmd.id, true);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[${cmd.bot_id}] ${cmd.action} failed:`, msg);
    await completeCommand(cmd.id, false, msg);
  }
}

// ============================================================
// RAILWAY API HELPERS
// ============================================================

async function railwayGraphQL(query: string, variables: Record<string, unknown> = {}) {
  const res = await fetch("https://backboard.railway.app/graphql/v2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${RAILWAY_API_TOKEN}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Railway API error: ${res.status} ${res.statusText}`);
  const data = await res.json() as { data?: unknown; errors?: { message: string }[] };
  if (data.errors?.length) throw new Error(`Railway GraphQL error: ${data.errors.map(e => e.message).join(", ")}`);
  return data.data;
}

async function createRailwayService(serviceName: string, repoFullName: string): Promise<string> {
  const data = await railwayGraphQL(`
    mutation ServiceCreate($input: ServiceCreateInput!) {
      serviceCreate(input: $input) {
        id
        name
      }
    }
  `, {
    input: {
      projectId: RAILWAY_PROJECT_ID,
      name: serviceName,
      source: {
        repo: repoFullName,
      },
    },
  }) as { serviceCreate: { id: string; name: string } };
  return data.serviceCreate.id;
}

async function setRailwayEnvVars(serviceId: string, variables: Record<string, string>) {
  const variablesInput = Object.entries(variables).map(([name, value]) => ({
    name,
    value,
    serviceId,
    environmentId: RAILWAY_ENVIRONMENT_ID,
    projectId: RAILWAY_PROJECT_ID,
  }));

  await railwayGraphQL(`
    mutation VariableCollectionUpsert($input: VariableCollectionUpsertInput!) {
      variableCollectionUpsert(input: $input)
    }
  `, {
    input: {
      projectId: RAILWAY_PROJECT_ID,
      environmentId: RAILWAY_ENVIRONMENT_ID,
      serviceId,
      variables: Object.fromEntries(Object.entries(variables)),
    },
  });
}

async function deployRailwayService(serviceId: string): Promise<void> {
  await railwayGraphQL(`
    mutation ServiceInstanceDeploy($serviceId: String!, $environmentId: String!) {
      serviceInstanceRedeploy(serviceId: $serviceId, environmentId: $environmentId)
    }
  `, {
    serviceId,
    environmentId: RAILWAY_ENVIRONMENT_ID,
  });
}

// ============================================================
// BUILD PIPELINE
// ============================================================

async function claimNextBuildJob(): Promise<BuildJob | null> {
  const { data, error } = await supabase.rpc("runtime_claim_build_job", {
    _token: WORKER_TOKEN_VALUE,
    _worker_id: WORKER_ID,
  });
  if (error) {
    console.error("build job claim error:", error.message);
    return null;
  }
  const result = data as { ok: boolean; job?: BuildJob; error?: string };
  if (!result?.ok || !result.job) return null;
  return result.job;
}

async function processBuildJob(job: BuildJob) {
  const { id, order_id, selections } = job;
  console.log(`[build:${id}] Starting build for order ${order_id}`);

  try {
    // 1. Claim a Discord bot token from the pool
    const { data: tokenData, error: tokenError } = await supabase.rpc(
      "claim_bot_token_from_pool",
      { _order_id: order_id }
    );
    if (tokenError) throw new Error(`Token claim failed: ${tokenError.message}`);
    const tokenResult = tokenData as { ok: boolean; error?: string; client_id?: string; bot_username?: string };
    if (!tokenResult?.ok) throw new Error(tokenResult?.error ?? "No tokens available in pool");
    console.log(`[build:${id}] Token claimed — bot: ${tokenResult.bot_username}`);

    // 2. Determine which repo to use
    // All-in-one uses protection as base (has all features via flags)
    const baseRepo = BOT_REPOS[selections.base] ?? BOT_REPOS["protection"];
    const safeName = selections.bot_name.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 40);
    const serviceName = `customer-${safeName}-${order_id.slice(0, 8)}`;

    console.log(`[build:${id}] Creating Railway service: ${serviceName} from ${baseRepo}`);

    // 3. Create Railway service from the appropriate GitHub repo
    let railwayServiceId: string;
    try {
      railwayServiceId = await createRailwayService(serviceName, baseRepo);
      console.log(`[build:${id}] Railway service created: ${railwayServiceId}`);
    } catch (err) {
      throw new Error(`Failed to create Railway service: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 4. Get the Discord token from bot_secrets
    const { data: secretData } = await supabase.rpc("runtime_get_bot_secret", {
      _token: WORKER_TOKEN_VALUE,
      _bot_id: order_id,
      _key: "DISCORD_TOKEN",
    });
    const discordToken = (secretData as { ok: boolean; value?: string })?.value ?? "";

    // 5. Build environment variables
    const envVars: Record<string, string> = {
      DISCORD_TOKEN: discordToken,
      BOT_NAME: selections.bot_name,
      BOT_STATUS: `Powered by Oversite`,
      DATABASE_URL: process.env.CUSTOMER_DATABASE_URL ?? process.env.DATABASE_URL ?? "",

      // Base features all on
      F_VERIFICATION: "true",
      F_MODERATION: "true",
      F_ANTI_SPAM: "true",
      F_ANTI_RAID: "true",
      F_BASIC_LOGGING: "true",
      F_PHISHING: "true",
      F_TICKETS: "true",
      F_APPEALS: "true",
      F_REPORTS: "true",
      F_WELCOME: "true",
      F_SAY: "true",
      F_ANNOUNCE: "true",
      F_REACTION_ROLES: "true",
      F_AUTOROLE: "true",
      F_POLL: "true",
      F_USERINFO: "true",
      F_SERVERINFO: "true",
      F_AVATAR: "true",
      F_8BALL: "true",
      F_COINFLIP: "true",
      F_BASIC_MUSIC: "true",
      F_SUGGESTIONS: "true",
      F_ADMIN_ABUSE: "true",
    };

    // All-in-one gets all base features from all bots
    if (selections.base === "all-in-one") {
      Object.assign(envVars, {
        F_VERIFICATION: "true",
        F_MODERATION: "true",
        F_ANTI_SPAM: "true",
        F_ANTI_RAID: "true",
        F_BASIC_LOGGING: "true",
        F_PHISHING: "true",
        F_TICKETS: "true",
        F_APPEALS: "true",
        F_REPORTS: "true",
        F_WELCOME: "true",
      });
    }

    // Enable addon flags based on purchased addons
    for (const addonId of selections.addons ?? []) {
      const flagName = ADDON_FLAGS[addonId];
      if (flagName) {
        envVars[flagName] = "true";
        console.log(`[build:${id}] Enabling addon: ${addonId} → ${flagName}=true`);
      }
    }

    // 6. Set environment variables on Railway service
    console.log(`[build:${id}] Setting ${Object.keys(envVars).length} env vars on Railway`);
    await setRailwayEnvVars(railwayServiceId, envVars);

    // 7. Deploy the service
    console.log(`[build:${id}] Deploying Railway service`);
    await deployRailwayService(railwayServiceId);

    // 8. Update bot_orders with Railway service ID and mark ready
    await supabase.rpc("runtime_finalize_build", {
      _token: WORKER_TOKEN_VALUE,
      _job_id: id,
      _order_id: order_id,
      _delivery_url: `https://railway.app/project/${RAILWAY_PROJECT_ID}/service/${railwayServiceId}`,
    });

    // 9. Notify customer
    await supabase.rpc("runtime_enqueue_notification", {
      _token: WORKER_TOKEN_VALUE,
      _bot_id: order_id,
      _event_type: "command_finished",
      _title: "Your bot is ready!",
      _body: `${selections.bot_name} has been deployed and is starting up. Add it to your server using the invite link in your dashboard!`,
    });

    console.log(`[build:${id}] Build complete for order ${order_id} — Railway service: ${railwayServiceId}`);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[build:${id}] Build failed:`, msg);

    await supabase.rpc("runtime_fail_build", {
      _token: WORKER_TOKEN_VALUE,
      _job_id: id,
      _bot_order_id: order_id,
      _error_message: msg,
    });
  }
}

// ============================================================
// POLL LOOP
// ============================================================

async function pollLoop() {
  console.log(`Worker ${WORKER_ID} polling every ${POLL_INTERVAL_MS}ms…`);

  while (true) {
    try {
      health.lastPollAt = Date.now();

      // 1. Check for bot commands (start/stop/restart/update)
      const cmd = await claimNextCommand();
      if (cmd) {
        processCommand(cmd).catch(() => {});
      }

      // 2. Check for pending build jobs
      const buildJob = await claimNextBuildJob();
      if (buildJob) {
        processBuildJob(buildJob).catch(() => {});
      }

    } catch (err) {
      console.error("poll loop error:", err);
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

// ============================================================
// SHUTDOWN
// ============================================================

async function shutdown() {
  console.log("\nShutting down — stopping all running bots…");
  await Promise.allSettled([...runtimes.values()].map((r) => r.stop()));
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

pollLoop().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
