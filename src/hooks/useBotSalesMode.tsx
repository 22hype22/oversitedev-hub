import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type BotSalesMode = "preorder" | "live";

/**
 * Reads the global `bot_sales_mode` flag from `app_settings` (id = 1) and
 * subscribes to realtime updates so toggles propagate to every visitor
 * instantly — signed in or not.
 */
export const useBotSalesMode = () => {
  const [mode, setMode] = useState<BotSalesMode>("preorder");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const { data } = await (supabase as any)
        .from("app_settings")
        .select("bot_sales_mode")
        .eq("id", 1)
        .maybeSingle();
      if (!mounted) return;
      const next = data?.bot_sales_mode === "live" ? "live" : "preorder";
      setMode(next);
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel(`app-settings-bot-sales-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings" },
        (payload: any) => {
          const next = (payload.new as any)?.bot_sales_mode;
          if (next === "live" || next === "preorder") setMode(next);
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { mode, loading, isPreorder: mode === "preorder", isLive: mode === "live" };
};

/** Admin-only writer. */
export const setBotSalesMode = async (next: BotSalesMode) => {
  const { error } = await (supabase as any)
    .from("app_settings")
    .update({ bot_sales_mode: next, updated_at: new Date().toISOString() })
    .eq("id", 1);
  return { error };
};
