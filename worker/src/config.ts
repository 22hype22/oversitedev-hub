import { supabase, WORKER_TOKEN_VALUE } from "./supabase.js";

export interface BotConfig {
  id: string;
  user_id: string;
  bot_name: string;
  base: string;
  addons: string[];
  monthly_hosting: boolean;
  status: string;
  notes: string | null;
  activity_type?: string | null;
  activity_text?: string | null;
  presence_status?: string | null;
}


export async function loadBotConfig(botId: string): Promise<BotConfig | null> {
  const { data, error } = await supabase.rpc("runtime_load_bot_config", {
    _token: WORKER_TOKEN_VALUE,
    _bot_id: botId,
  });
  if (error) {
    console.error(`[${botId}] loadBotConfig failed:`, error.message);
    return null;
  }
  const result = data as { ok: boolean; config?: BotConfig; error?: string };
  if (!result?.ok) {
    if (result?.error) console.error(`[${botId}] loadBotConfig refused:`, result.error);
    return null;
  }
  return result.config ?? null;
}

/**
 * Returns the set of addon ids the customer has explicitly toggled OFF in the
 * dashboard (rows in `bot_addon_state` with `enabled = false`).
 *
 * Addons with no row default to enabled, matching the dashboard's behaviour.
 * Uses the service-role client — bypasses RLS.
 */
export async function loadDisabledAddons(botId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("bot_addon_state")
    .select("addon_id, enabled")
    .eq("bot_id", botId);
  if (error) {
    console.error(`[${botId}] loadDisabledAddons failed:`, error.message);
    return new Set();
  }
  const disabled = new Set<string>();
  for (const row of (data ?? []) as { addon_id: string; enabled: boolean }[]) {
    if (row.enabled === false) disabled.add(row.addon_id);
  }
  return disabled;
}
