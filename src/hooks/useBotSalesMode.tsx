import { supabase } from "@/integrations/supabase/client";
import { refreshAppSettings, useAppSettings } from "@/lib/appSettings";

export type BotSalesMode = "preorder" | "live";

/**
 * Reads the global `bot_sales_mode` flag from `app_settings` (id = 1) and
 * subscribes to realtime updates so toggles propagate to every visitor
 * instantly — signed in or not.
 */
export const useBotSalesMode = () => {
  const { row, loading } = useAppSettings();
  const mode: BotSalesMode = row?.bot_sales_mode === "live" ? "live" : "preorder";
  return { mode, loading, isPreorder: mode === "preorder", isLive: mode === "live" };
};

/** Admin-only writer. */
export const setBotSalesMode = async (next: BotSalesMode) => {
  const { error } = await (supabase as any)
    .from("app_settings")
    .update({ bot_sales_mode: next, updated_at: new Date().toISOString() })
    .eq("id", 1);
  void refreshAppSettings();
  return { error };
};
