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
  joined_at?: string;
  last_seen_at?: string;
}

function normalizeRuntimeGuilds(value: unknown): BotActiveGuild[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const guild = entry as {
        id?: unknown;
        name?: unknown;
        guild_id?: unknown;
        guild_name?: unknown;
        member_count?: unknown;
      };
      const id = typeof guild.id === "string" ? guild.id : typeof guild.guild_id === "string" ? guild.guild_id : null;
      if (!id) return null;
      const name = typeof guild.name === "string" ? guild.name : typeof guild.guild_name === "string" ? guild.guild_name : null;
      return {
        id,
        guild_id: id,
        guild_name: name,
        member_count: typeof guild.member_count === "number" ? guild.member_count : null,
      } satisfies BotActiveGuild;
    })
    .filter((guild): guild is BotActiveGuild => guild !== null)
    .sort((a, b) => (a.guild_name ?? a.guild_id).localeCompare(b.guild_name ?? b.guild_id));
}

export function useBotServerSlots(botId: string | undefined) {
  const [limit, setLimit] = useState<BotServerLimit | null>(null);
  const [guilds, setGuilds] = useState<BotActiveGuild[]>([]);
  const [loading, setLoading] = useState(false);

  const readRuntimeStatus = useCallback(async () => {
    if (!botId) return;
    setLoading(true);
    try {
      const [{ data: limitData }, { data: statusData }, { data: activeData }] = await Promise.all([
        supabase.rpc("get_bot_server_limit", { _bot_id: botId }),
        (supabase.from("bot_runtime_status") as any)
          .select("guilds")
          .eq("bot_id", botId)
          .maybeSingle(),
        supabase
          .from("bot_active_guilds")
          .select("id, guild_id, guild_name, member_count, joined_at, last_seen_at")
          .eq("bot_id", botId)
          .order("joined_at", { ascending: true }),
      ]);
      const runtimeGuilds = normalizeRuntimeGuilds((statusData as { guilds?: unknown } | null)?.guilds);
      // Fall back to bot_active_guilds (legacy source) when the heartbeat
      // hasn't populated runtime_status.guilds yet (e.g. bots added directly
      // through Discord before this feature shipped).
      const finalGuilds = runtimeGuilds.length > 0 ? runtimeGuilds : ((activeData ?? []) as BotActiveGuild[]);
      if (limitData) {
        setLimit({ ...(limitData as unknown as BotServerLimit), current_count: finalGuilds.length });
      }
      setGuilds(finalGuilds);
    } finally {
      setLoading(false);
    }
  }, [botId]);

  const refresh = useCallback(async () => {
    if (!botId) return;
    try {
      await supabase.rpc("request_list_guilds", { _bot_id: botId });
    } catch {
      /* ignore — heartbeat will still update runtime status */
    }
    await readRuntimeStatus();
  }, [botId, readRuntimeStatus]);

  useEffect(() => {
    readRuntimeStatus();
  }, [readRuntimeStatus]);

  // Live updates: every worker heartbeat updates bot_runtime_status.guilds.
  useEffect(() => {
    if (!botId) return;
    const channel = supabase.channel(`bot-runtime-status-${botId}-${Math.random().toString(36).slice(2)}`);
    channel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bot_runtime_status", filter: `bot_id=eq.${botId}` },
        (payload) => {
          const nextGuilds = normalizeRuntimeGuilds((payload.new as { guilds?: unknown } | null)?.guilds);
          // Only overwrite if heartbeat actually has guilds; otherwise keep
          // whatever fallback we already loaded.
          if (nextGuilds.length > 0) {
            setGuilds(nextGuilds);
            setLimit((currentLimit) => currentLimit ? { ...currentLimit, current_count: nextGuilds.length } : currentLimit);
          }
        },
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
