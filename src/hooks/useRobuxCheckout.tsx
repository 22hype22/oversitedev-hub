import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Robux per 1 USD before the markup: every $100 is 10,000 Robux. Fixed. */
export const ROBUX_PER_USD = 100;
/** Robux prices are 30 percent above the dollar price to cover Roblox's cut. */
export const ROBUX_MARKUP = 1.3;

/**
 * Robux owed for a USD amount: the dollar price plus the markup at the rate,
 * then bumped to the next thousand less one so it ends in 999. $99 is 12,999.
 */
export const robuxFor = (usd: number) => {
  const raw = Math.max(0, usd) * ROBUX_MARKUP * ROBUX_PER_USD;
  return Math.max(99, (Math.floor(raw / 1000) + 1) * 1000 - 1);
};

export const formatRobux = (robux: number) => `R$ ${Math.round(robux).toLocaleString()}`;

/**
 * Whether Robux checkout is offered, from `app_settings` (id = 1). If the
 * column does not exist yet (migration not run) the option is simply hidden.
 * The price rule itself is fixed above and never read from the database.
 */
export const useRobuxCheckout = () => {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const apply = (row: any) => {
      if (row && "robux_orders_enabled" in row) setEnabled(row.robux_orders_enabled !== false);
    };
    (async () => {
      const { data, error } = await (supabase as any)
        .from("app_settings")
        .select("robux_orders_enabled")
        .eq("id", 1)
        .maybeSingle();
      if (!mounted) return;
      if (!error) apply(data);
      setLoading(false);
    })();
    const channel = supabase
      .channel(`app-settings-robux-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings" },
        (payload: any) => apply(payload.new),
      )
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { enabled, loading };
};
