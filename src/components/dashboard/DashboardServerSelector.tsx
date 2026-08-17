import { useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
    () => guilds.find((g) => g.guild_id === guild?.guild_id) ?? null,
    [guilds, guild],
  );

  // If the saved active guild isn't in the current bot's guild list (e.g. bot
  // was removed from that server), auto-select the first available so the
  // dropdown and caption stay in sync.
  useEffect(() => {
    if (loading || guilds.length === 0) return;
    const match = guilds.find((g) => g.guild_id === guild?.guild_id);
    if (!match) {
      setGuild(guilds[0]);
    } else if (
      match.guild_name !== guild?.guild_name ||
      match.member_count !== guild?.member_count
    ) {
      setGuild(match);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guilds, loading]);

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
        <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          <Globe className="h-5 w-5 text-primary" size={20} />
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
            <div className="flex-1 min-w-0">
              <Select
                value={selectedGuild?.guild_id ?? ""}
                onValueChange={(v) => {
                  const next = guilds.find((g) => g.guild_id === v) ?? null;
                  setGuild(next);
                }}
                disabled={loading || guilds.length === 0}
              >
                <SelectTrigger aria-label="Active server">
                  <div className="flex min-w-0 items-center gap-2">
                    <Server className="h-4 w-4 shrink-0 text-[rgb(var(--os-faint))]" />
                    <SelectValue
                      placeholder={
                        loading
                          ? "Loading servers…"
                          : guilds.length === 0
                            ? "No servers cached — click refresh →"
                            : "Select a server…"
                      }
                    />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {guilds.map((g) => (
                    <SelectItem key={g.guild_id} value={g.guild_id}>
                      {g.guild_name ?? g.guild_id}
                      {g.member_count != null ? ` · ${g.member_count.toLocaleString()} members` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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

