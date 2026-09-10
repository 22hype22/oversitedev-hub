import { supabase } from "@/integrations/supabase/client";
import { refreshAppSettings, useAppSettings } from "@/lib/appSettings";

export type BotStatus = "available" | "preorder" | "coming_soon";

/**
 * Reads the per-bot availability map from `app_settings` (id = 1) and
 * subscribes to realtime updates so status changes propagate to every
 * visitor instantly — mirrors useBotSalesMode. Missing entries default to
 * "available" at the call site.
 */
export const useBotAvailability = () => {
  const { row, loading } = useAppSettings();
  const raw = row?.bot_availability;
  const availability = (raw && typeof raw === "object" ? raw : {}) as Record<string, BotStatus>;
  return { availability, loading };
};

/** Per-bot price overrides the owner sets from the builder's gear. */
export type BotPricing = {
  /** List price in USD. */
  price?: number;
  /** Dollars off the list price. Missing or 0 means no discount. */
  discount?: number;
  monthly?: boolean;
  monthly_price?: number;
  /** How the bot can be bought. Missing means both. */
  pay?: "usd" | "robux" | "both";
};

/**
 * Reads `app_settings.bot_pricing` (base id -> BotPricing) with realtime
 * updates. Missing keys mean "use the price built into the site".
 */
export const useBotPricing = () => {
  const { row } = useAppSettings();
  const raw = row?.bot_pricing;
  const pricing = (raw && typeof raw === "object" ? raw : {}) as Record<string, BotPricing>;
  return { pricing };
};

/** Owner-only writer — the RPC verifies the caller server-side. */
export const setBotPricing = async (baseId: string, pricing: BotPricing) => {
  const { data, error } = await (supabase as any).rpc("set_bot_pricing", {
    _base_id: baseId,
    _pricing: pricing,
  });
  void refreshAppSettings();
  return { data, error };
};

/** Owner-only writer — the RPC verifies the caller's email server-side. */
export const setBotAvailability = async (baseId: string, status: BotStatus) => {
  const { data, error } = await (supabase as any).rpc("set_bot_availability", {
    _base_id: baseId,
    _status: status,
  });
  void refreshAppSettings();
  return { data, error };
};
