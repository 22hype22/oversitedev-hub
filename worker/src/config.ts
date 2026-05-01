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
