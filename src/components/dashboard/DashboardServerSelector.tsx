import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Server, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBotGuilds } from "@/hooks/useGuildChannels";
import { useActiveGuild } from "@/hooks/useActiveGuild";
import { toast } from "sonner";

interface Props {
  botId: string;
}

/**
 * Dashboard-wide "which server am I editing?" picker.
 *
 * Sets the active guild used by all addon config boxes (verification,
 * tickets, /say, etc). Logs are intentionally unaffected — they always
 * broadcast to every server the bot is in.
 */
export function DashboardServerSelector({ botId }: Props) {
  const { guilds, loading, refresh, refreshing, refreshFromDiscord } = useBotGuilds(botId);
  const { guild, setGuild } = useActiveGuild();
  const selectedGuild = useMemo(
    () => guilds.find((g) => g.guild_id === guild?.guild_id) ?? guild,
    [guilds, guild],
  );

  const handleRefresh = async () => {
    // Always re-read the cache first (cheap), then ask the bot to re-check.
    refresh();
    const result = await refreshFromDiscord();
    if (result.ok) {
      toast.success("Server list refreshed.");
    } else {
      toast.warning(
        result.error === "not_owner"
          ? "You don't have permission to refresh this bot."
          : `Refresh queued — bot may be offline.`,
      );
    }
  };

  return (
    <Card className="bg-card/40 border-border p-4">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center shrink-0">
          <Globe className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div>
            <h4 className="text-sm font-semibold">Active server</h4>
            <p className="text-xs text-muted-foreground">
              Pick which server your add-on changes (verification, tickets, /say, etc.) target.
              Logs always go to every server.
            </p>
          </div>

          <div className="flex gap-2">
            <label className="relative flex-1 block">
              <Server className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <select
                value={selectedGuild?.guild_id ?? ""}
                onChange={(event) => {
                  const next = guilds.find((g) => g.guild_id === event.target.value) ?? null;
                  setGuild(next);
                }}
                disabled={loading || guilds.length === 0}
                className="h-10 w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm text-foreground ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Active server"
              >
                <option value="">
                  {loading ? "Loading servers…" : guilds.length === 0 ? "No servers cached — click refresh →" : "Select a server…"}
                </option>
                {guilds.map((g) => (
                  <option key={g.guild_id} value={g.guild_id}>
                    {g.guild_name ?? g.guild_id}
                    {g.member_count != null ? ` · ${g.member_count.toLocaleString()} members` : ""}
                  </option>
                ))}
              </select>
            </label>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={loading || refreshing}
              title="Refresh server list from Discord"
            >
              <RefreshCw className={cn("h-4 w-4", (loading || refreshing) && "animate-spin")} />
            </Button>
          </div>
          {selectedGuild && (
            <p className="text-[11px] text-muted-foreground">
              Add-on configurations below will target{" "}
              <span className="text-foreground font-medium">{selectedGuild.guild_name ?? selectedGuild.guild_id}</span>{" "}
              by default. You can still override per add-on.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

interface ServerDropdownProps {
  guilds: ReturnType<typeof useBotGuilds>["guilds"];
  selectedGuild: ReturnType<typeof useBotGuilds>["guilds"][number] | null | undefined;
  loading: boolean;
  onSelect: (g: ReturnType<typeof useBotGuilds>["guilds"][number] | null) => void;
}

function ServerDropdown({ guilds, selectedGuild, loading, onSelect }: ServerDropdownProps) {
  const label = loading
    ? "Loading servers…"
    : guilds.length === 0
      ? "No servers cached — click refresh →"
      : selectedGuild
        ? selectedGuild.guild_name ?? selectedGuild.guild_id
        : "Select a server…";

  return (
    <label className="relative flex-1">
      <select
        value={selectedGuild?.guild_id ?? ""}
        onChange={(event) => {
          const next = guilds.find((g) => g.guild_id === event.target.value) ?? null;
          onSelect(next);
        }}
        disabled={loading || guilds.length === 0}
        className="peer absolute inset-0 z-10 h-10 w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        aria-label="Active server"
      >
        <option value="">
          {loading ? "Loading servers…" : guilds.length === 0 ? "No servers cached — click refresh →" : "Select a server…"}
        </option>
        {guilds.map((g) => (
          <option key={g.guild_id} value={g.guild_id}>
            {formatGuildOption(g)}
          </option>
        ))}
      </select>
      <div className="pointer-events-none flex h-10 w-full items-center rounded-md border border-input bg-background py-2 pl-9 pr-9 text-sm text-foreground ring-offset-background peer-focus:ring-2 peer-focus:ring-ring peer-focus:ring-offset-2 peer-disabled:opacity-50">
        <Server className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <span className="block truncate">{label}</span>
        <ChevronsUpDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    </label>
  );
}

function formatGuildOption(guild: ReturnType<typeof useBotGuilds>["guilds"][number]) {
  const name = guild.guild_name ?? guild.guild_id;
  if (guild.member_count == null) return name;
  const count = guild.member_count.toLocaleString();
  return `${name}${"\u00A0".repeat(Math.max(4, 56 - name.length - count.length))}${count}`;
}
