import { useEffect, useMemo } from "react";
import { RefreshCw, Server, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  useBotGuilds,
  useBotChannels,
  sortedChannelCategoryEntries,
  type BotGuild,
  type BotChannel,
} from "@/hooks/useGuildChannels";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface GuildChannelPickerProps {
  botId: string;
  guildId: string | null;
  channelId: string | null;
  onGuildChange: (guild: BotGuild | null) => void;
  onChannelChange: (channel: BotChannel | null) => void;
  /** Optional: filter the channel types shown. Defaults to ["text", "announcement"]. */
  channelTypes?: string[];
  /** Optional label overrides. */
  guildLabel?: string;
  channelLabel?: string;
  /** When true, hides the channel picker (e.g. for guild-only operations). */
  guildOnly?: boolean;
}

export function GuildChannelPicker({
  botId,
  guildId,
  channelId,
  onGuildChange,
  onChannelChange,
  channelTypes = ["text", "announcement"],
  guildLabel = "Server",
  channelLabel = "Channel",
  guildOnly = false,
}: GuildChannelPickerProps) {
  const { guilds, loading: loadingGuilds, refresh: refreshGuilds } = useBotGuilds(botId);
  const { channels, loading: loadingChannels, refreshing, lastFetchedAt, refreshFromDiscord } =
    useBotChannels(botId, guildId ?? undefined);

  const selectedGuild = useMemo(
    () => guilds.find((g) => g.guild_id === guildId) ?? null,
    [guilds, guildId],
  );
  const filteredChannels = useMemo(
    () => channels.filter((c) => channelTypes.includes(c.channel_type)),
    [channels, channelTypes],
  );
  const selectedChannel = useMemo(
    () => filteredChannels.find((c) => c.channel_id === channelId) ?? null,
    [filteredChannels, channelId],
  );
  const channelGroups = useMemo(() => sortedChannelCategoryEntries(filteredChannels), [filteredChannels]);

  // Auto-clear channel selection if it disappears from the new guild's list.
  useEffect(() => {
    if (channelId && filteredChannels.length > 0 && !selectedChannel) {
      onChannelChange(null);
    }
  }, [channelId, filteredChannels, selectedChannel, onChannelChange]);

  const handleManualRefresh = async () => {
    refreshGuilds();
    if (!guildId) {
      toast.info("Select a server first to refresh its channels.");
      return;
    }
    const result = await refreshFromDiscord();
    if (result.ok) {
      toast.success("Channel list refreshed.");
    } else if (result.error === "timeout") {
      toast.warning("Refresh queued — bot may be offline. Try again in a moment.");
    } else {
      toast.error(`Refresh failed: ${result.error}`);
    }
  };

  return (
    <div className="space-y-3">
      {/* Guild picker */}
      <div className="space-y-1.5">
        <Label className="text-sm">{guildLabel}</Label>
        <label className="relative block">
          <Server className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <select
            value={selectedGuild?.guild_id ?? ""}
            onChange={(event) => {
              const next = guilds.find((g) => g.guild_id === event.target.value) ?? null;
              onGuildChange(next);
              if (event.target.value !== guildId) onChannelChange(null);
            }}
            disabled={loadingGuilds || guilds.length === 0}
            className="h-10 w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm text-foreground ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">
              {loadingGuilds ? "Loading servers…" : guilds.length === 0 ? "Bot not in any servers yet" : "Select a server…"}
            </option>
            {guilds.map((g) => (
              <option key={g.guild_id} value={g.guild_id}>
                {g.guild_name ?? g.guild_id}{g.member_count != null ? ` · ${g.member_count.toLocaleString()} members` : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Channel picker */}
      {!guildOnly && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-sm">{channelLabel}</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="h-7 px-2 text-xs gap-1.5"
            >
              <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
              {refreshing ? "Refreshing…" : "Refresh from Discord"}
            </Button>
          </div>
          <label className="relative block">
            <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <select
              value={selectedChannel?.channel_id ?? ""}
              onChange={(event) => {
                const next = filteredChannels.find((c) => c.channel_id === event.target.value) ?? null;
                onChannelChange(next);
              }}
              disabled={!guildId || loadingChannels || filteredChannels.length === 0}
              className="h-10 w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm text-foreground ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">
                {!guildId
                  ? "Select a server first"
                  : loadingChannels
                    ? "Loading channels…"
                    : filteredChannels.length === 0
                      ? "No channels cached — click Refresh"
                      : "Select a channel…"}
              </option>
              {channelGroups.map((group) => (
                <optgroup key={group.key} label={group.label}>
                  {group.channels.map((c) => (
                    <option key={c.channel_id} value={c.channel_id}>
                      {c.channel_name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          {lastFetchedAt && (
            <p className="text-[11px] text-muted-foreground">
              Channel list updated {formatDistanceToNow(new Date(lastFetchedAt), { addSuffix: true })}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
