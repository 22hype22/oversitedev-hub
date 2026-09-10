import { supabase } from "@/integrations/supabase/client";
import { refreshAppSettings, useAppSettings } from "@/lib/appSettings";

/**
 * Reads the global `marketing_suspended` flag from `app_settings` (id = 1)
 * and subscribes to realtime updates so toggles propagate to every visitor
 * instantly — signed in or not.
 */
export const useMarketingSuspended = () => {
  const { row, loading } = useAppSettings();
  return { suspended: !!row?.marketing_suspended, loading };
};

/**
 * Admin-only writer. Updates the singleton row and returns the result.
 */
export const setMarketingSuspended = async (next: boolean) => {
  const { error } = await (supabase as any)
    .from("app_settings")
    .update({ marketing_suspended: next, updated_at: new Date().toISOString() })
    .eq("id", 1);
  void refreshAppSettings();
  return { error };
};
