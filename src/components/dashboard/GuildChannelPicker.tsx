import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, RefreshCw, Server, Hash, Volume2, Megaphone, MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useBotGuilds, useBotChannels, type BotGuild, type BotChannel } from "@/hooks/useGuildChannels";
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

const CHANNEL_ICON: Record<string, typeof Hash> = {
  text: Hash,
  announcement: Megaphone,
  forum: MessagesSquare,
  voice: Volume2,
};

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

  const [guildOpen, setGuildOpen] = useState(false);
  const [channelOpen, setChannelOpen] = useState(false);

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
            <Command>
              <CommandInput placeholder="Search servers…" />
              <CommandList>
                <CommandEmpty>
                  {guilds.length === 0
                    ? "Bot isn't in any servers yet."
                    : "No matching servers."}
                </CommandEmpty>
                <CommandGroup>
                  {guilds.map((g) => (
                    <CommandItem
                      key={g.guild_id}
                      value={`${g.guild_name ?? ""} ${g.guild_id}`}
                      onSelect={() => {
                        onGuildChange(g);
                        if (g.guild_id !== guildId) onChannelChange(null);
                        setGuildOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedGuild?.guild_id === g.guild_id ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <Server className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                      <span className="flex-1 truncate">
                        {g.guild_name ?? g.guild_id}
                      </span>
                      {g.member_count != null && (
                        <span className="text-xs text-muted-foreground ml-2">
                          {g.member_count.toLocaleString()} members
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
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
            onOpenChange={(open) => {
              setChannelOpen(open);
              // Auto-refresh from Discord when the picker is opened so the
              // user always sees an up-to-date list without clicking Refresh.
              if (open && guildId && !refreshing) {
                refreshFromDiscord().catch(() => {});
              }
            }}
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
              <Command>
                <CommandInput placeholder="Search channels…" />
                <CommandList>
                  <CommandEmpty>
                    {filteredChannels.length === 0
                      ? "No channels cached for this server. Click Refresh from Discord."
                      : "No matching channels."}
                  </CommandEmpty>
                  {/* Group by parent category, sorted by Discord position */}
                  {sortedCategoryEntries(filteredChannels).map(([cat, list]) => (
                    <CommandGroup key={cat} heading={cat}>
                      {list.map((c) => {
                        const Icon = CHANNEL_ICON[c.channel_type] ?? Hash;
                        return (
                          <CommandItem
                            key={c.channel_id}
                            value={`${c.channel_name} ${c.channel_id}`}
                            onSelect={() => {
                              onChannelChange(c);
                              setChannelOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedChannel?.channel_id === c.channel_id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <Icon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                            <span className="flex-1 truncate">{c.channel_name}</span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  ))}
                </CommandList>
              </Command>
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

function sortedCategoryEntries(channels: BotChannel[]): [string, BotChannel[]][] {
  const groups = new Map<string, BotChannel[]>();
  for (const c of channels) {
    const key = c.parent_name ?? "Uncategorized";
    const list = groups.get(key);
    if (list) list.push(c);
    else groups.set(key, [c]);
  }
  // Within each category: text/announcement/forum first (by Discord position),
  // then voice channels (Discord always renders these below).
  for (const list of groups.values()) {
    list.sort((a, b) => {
      const aVoice = a.channel_type === "voice" ? 1 : 0;
      const bVoice = b.channel_type === "voice" ? 1 : 0;
      if (aVoice !== bVoice) return aVoice - bVoice;
      return a.position - b.position;
    });
  }
  // Sort the categories themselves by parent_position (which the worker
  // copies straight from Discord). Uncategorized (parent_position = -1)
  // naturally sorts to the top.
  return [...groups.entries()].sort(([aKey, aList], [bKey, bList]) => {
    const ap = aList[0]?.parent_position ?? -1;
    const bp = bList[0]?.parent_position ?? -1;
    if (ap !== bp) return ap - bp;
    return aKey.localeCompare(bKey);
  });
}
