import { supabase } from "./supabase.js";

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
  const { data, error } = await supabase
    .from("bot_orders")
    .select("id, user_id, bot_name, base, addons, monthly_hosting, status, notes")
    .eq("id", botId)
    .maybeSingle();
  if (error) {
    console.error(`[${botId}] loadBotConfig failed:`, error.message);
    return null;
  }
  return (data as BotConfig) ?? null;
}
