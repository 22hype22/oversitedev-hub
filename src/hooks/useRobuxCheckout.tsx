import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Robux per 1 USD before the markup. Roughly the DevEx rate. */
export const DEFAULT_ROBUX_PER_USD = 285;
/** Robux prices are 30 percent above the dollar price to cover Roblox's cut. */
export const ROBUX_MARKUP = 1.3;

/** Robux owed for a USD amount: the dollar price plus the markup, converted at the rate, rounded up. */
export const robuxFor = (usd: number, rate: number) =>
  Math.max(1, Math.ceil(Math.max(0, usd) * ROBUX_MARKUP * (rate > 0 ? rate : DEFAULT_ROBUX_PER_USD)));

export const formatRobux = (robux: number) => `R$ ${Math.round(robux).toLocaleString()}`;

/**
 * Site-wide Robux checkout settings from `app_settings` (id = 1): whether the
 * option is offered and how many Robux one dollar costs. If the columns do not
 * exist yet (migration not run) the option is simply hidden.
 */
export const useRobuxCheckout = () => {
  const [enabled, setEnabled] = useState(false);
  const [rate, setRate] = useState(DEFAULT_ROBUX_PER_USD);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const apply = (row: any) => {
      if (!row) return;
      const r = Number(row.robux_per_usd);
      if (Number.isFinite(r) && r > 0) setRate(r);
      setEnabled(row.robux_orders_enabled !== false);
    };
    (async () => {
      const { data, error } = await (supabase as any)
        .from("app_settings")
        .select("robux_orders_enabled, robux_per_usd")
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

  return { enabled, rate, loading };
};
