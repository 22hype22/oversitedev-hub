import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, RefreshCw, Server, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBotGuilds } from "@/hooks/useGuildChannels";
import { useActiveGuild } from "@/hooks/useActiveGuild";

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
  const { guilds, loading, refresh } = useBotGuilds(botId);
  const { guild, setGuild } = useActiveGuild();
  const [open, setOpen] = useState(false);

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
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="flex-1 justify-between font-normal"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <Server className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">
                      {guild?.guild_name ?? guild?.guild_id ?? (
                        <span className="text-muted-foreground">
                          {loading
                            ? "Loading servers…"
                            : guilds.length === 0
                              ? "Bot not in any servers yet"
                              : "Select a server…"}
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
                            setGuild(g);
                            setOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              guild?.guild_id === g.guild_id ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <Server className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                          <span className="flex-1 truncate">
                            {g.guild_name ?? g.guild_id}
                          </span>
                          {g.member_count != null && (
                            <span className="text-xs text-muted-foreground ml-2">
                              {g.member_count.toLocaleString()}
                            </span>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={refresh}
              disabled={loading}
              title="Refresh server list"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
          {guild && (
            <p className="text-[11px] text-muted-foreground">
              Add-on configurations below will target{" "}
              <span className="text-foreground font-medium">{guild.guild_name ?? guild.guild_id}</span>{" "}
              by default. You can still override per add-on.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
