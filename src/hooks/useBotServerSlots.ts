import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface BotServerLimit {
  bot_id: string;
  limit: number;
  extra_slots: number;
  current_count: number;
  is_unlimited: boolean;
}

export interface BotActiveGuild {
  id: string;
  guild_id: string;
  guild_name: string | null;
  member_count: number | null;
  joined_at: string;
  last_seen_at: string;
}

export function useBotServerSlots(botId: string | undefined) {
  const [limit, setLimit] = useState<BotServerLimit | null>(null);
  const [guilds, setGuilds] = useState<BotActiveGuild[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!botId) return;
    setLoading(true);
    try {
      const [{ data: limitData }, { data: guildData }] = await Promise.all([
        supabase.rpc("get_bot_server_limit", { _bot_id: botId }),
        supabase
          .from("bot_active_guilds")
          .select("id, guild_id, guild_name, member_count, joined_at, last_seen_at")
          .eq("bot_id", botId)
          .order("joined_at", { ascending: true }),
      ]);
      if (limitData) setLimit(limitData as unknown as BotServerLimit);
      if (guildData) setGuilds(guildData as BotActiveGuild[]);
    } finally {
      setLoading(false);
    }
  }, [botId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Periodically ask the worker to reconcile its guild list against Discord,
  // so guilds the bot was kicked from disappear without the user clicking refresh.
  useEffect(() => {
    if (!botId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        await supabase.rpc("request_list_guilds", { _bot_id: botId });
      } catch {
        /* ignore — bot may be offline */
      }
      if (!cancelled) await refresh();
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [botId, refresh]);

  // Live updates: when the worker writes to bot_active_guilds (join/leave),
  // refresh immediately instead of waiting for the next poll.
  useEffect(() => {
    if (!botId) return;
    const channel = supabase.channel(`bot-active-guilds-${botId}-${Math.random().toString(36).slice(2)}`);
    channel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bot_active_guilds", filter: `bot_id=eq.${botId}` },
        () => { refresh(); },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [botId, refresh]);

  const purchase = useCallback(
    async (additionalSlots: number) => {
      if (!botId) return { ok: false, error: "No bot" };
      const { data, error } = await supabase.functions.invoke("purchase-bot-slot", {
        body: {
          botId,
          additionalSlots,
          returnUrl: window.location.href,
        },
      });
      if (error) return { ok: false, error: error.message };
      if ((data as any)?.url) window.location.href = (data as any).url;
      else await refresh();
      return { ok: true, ...(data as any) };
    },
    [botId, refresh],
  );

  return { limit, guilds, loading, refresh, purchase };
}
