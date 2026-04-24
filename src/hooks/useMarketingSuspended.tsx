import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Reads the global `marketing_suspended` flag from `app_settings` (id = 1)
 * and subscribes to realtime updates so toggles propagate to every visitor
 * instantly — signed in or not.
 */
export const useMarketingSuspended = () => {
  const [suspended, setSuspended] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const { data } = await (supabase as any)
        .from("app_settings")
        .select("marketing_suspended")
        .eq("id", 1)
        .maybeSingle();
      if (!mounted) return;
      setSuspended(!!data?.marketing_suspended);
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel("app-settings-global")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings" },
        (payload: any) => {
          const next = (payload.new as any)?.marketing_suspended;
          if (typeof next === "boolean") setSuspended(next);
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { suspended, loading };
};

/**
 * Admin-only writer. Updates the singleton row and returns the result.
 */
export const setMarketingSuspended = async (next: boolean) => {
  const { error } = await (supabase as any)
    .from("app_settings")
    .update({ marketing_suspended: next, updated_at: new Date().toISOString() })
    .eq("id", 1);
  return { error };
};
