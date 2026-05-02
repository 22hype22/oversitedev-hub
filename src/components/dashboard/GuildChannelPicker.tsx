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
        <Popover open={guildOpen} onOpenChange={setGuildOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={guildOpen}
              className="w-full justify-between font-normal"
            >
              <span className="flex items-center gap-2 min-w-0">
                <Server className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">
                  {selectedGuild?.guild_name ?? selectedGuild?.guild_id ?? (
                    <span className="text-muted-foreground">
                      {loadingGuilds ? "Loading servers…" : guilds.length === 0 ? "Bot not in any servers yet" : "Select a server…"}
                    </span>
                  )}
                </span>
              </span>
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <div className="border-b border-border p-2">
              <Input
                value={guildQuery}
                onChange={(e) => setGuildQuery(e.target.value)}
                placeholder="Search servers…"
                className="h-9"
              />
            </div>
            <div className="max-h-[300px] overflow-y-auto p-1">
              {filteredGuilds.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {guilds.length === 0
                    ? "Bot isn't in any servers yet."
                    : "No matching servers."}
                </div>
              ) : (
                filteredGuilds.map((g) => (
                  <button
                    key={g.guild_id}
                    type="button"
                    className={cn(
                      "flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground",
                      selectedGuild?.guild_id === g.guild_id && "bg-accent text-accent-foreground",
                    )}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      selectGuild(g);
                    }}
                    onClick={() => selectGuild(g)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        selectedGuild?.guild_id === g.guild_id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <Server className="mr-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">
                      {g.guild_name ?? g.guild_id}
                    </span>
                    {g.member_count != null && (
                      <span className="text-xs text-muted-foreground ml-2 shrink-0">
                        {g.member_count.toLocaleString()} members
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
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
          <Popover
            open={channelOpen}
            onOpenChange={setChannelOpen}
          >
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={channelOpen}
                disabled={!guildId}
                className="w-full justify-between font-normal"
              >
                <span className="flex items-center gap-2 min-w-0">
                  {selectedChannel ? (
                    <>
                      {(() => {
                        const Icon = CHANNEL_ICON[selectedChannel.channel_type] ?? Hash;
                        return <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />;
                      })()}
                      <span className="truncate">{selectedChannel.channel_name}</span>
                    </>
                  ) : (
                    <>
                      <Hash className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate text-muted-foreground">
                        {!guildId
                          ? "Select a server first"
                          : loadingChannels
                          ? "Loading channels…"
                          : filteredChannels.length === 0
                          ? "No channels cached — click Refresh"
                          : "Select a channel…"}
                      </span>
                    </>
                  )}
                </span>
                <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
              <div className="border-b border-border p-2">
                <Input
                  value={channelQuery}
                  onChange={(e) => setChannelQuery(e.target.value)}
                  placeholder="Search channels…"
                  className="h-9"
                />
              </div>
              <div className="max-h-[300px] overflow-y-auto p-1">
                {channelGroups.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    {filteredChannels.length === 0
                      ? "No channels cached for this server. Click Refresh from Discord."
                      : "No matching channels."}
                  </div>
                ) : (
                  channelGroups.map((group) => (
                    <div key={group.key} className="py-1">
                      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                        {group.label}
                      </div>
                      {group.channels.map((c) => {
                        const Icon = CHANNEL_ICON[c.channel_type] ?? Hash;
                        return (
                          <button
                            key={c.channel_id}
                            type="button"
                            className={cn(
                              "flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground",
                              selectedChannel?.channel_id === c.channel_id && "bg-accent text-accent-foreground",
                            )}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              selectChannel(c);
                            }}
                            onClick={() => selectChannel(c)}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4 shrink-0",
                                selectedChannel?.channel_id === c.channel_id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <Icon className="mr-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="flex-1 truncate">{c.channel_name}</span>
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>
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
