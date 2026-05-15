import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RefreshCw, AtSign } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useActiveGuild } from "@/hooks/useActiveGuild";
import { useBotRoles } from "@/hooks/useBotRoles";

/**
 * Multi-select role picker. Renders a list of checkboxes for each assignable
 * role with refresh + select all/none controls. Shared by addon config cards
 * and the ticket panel builder so behavior stays identical across the
 * dashboard.
 */
export function RoleMultiSelect({
  label,
  help,
  value,
  onChange,
  botId,
  guildId: guildIdProp,
}: {
  label: string;
  help?: string;
  value: string[];
  onChange: (v: string[]) => void;
  botId?: string;
  /** Override the active-guild context. Use when the parent form has its own
   *  server picker (e.g. ticket panel builder). */
  guildId?: string | null;
}) {
  const { guild } = useActiveGuild();
  const guildId = guildIdProp ?? guild?.guild_id;
  const { roles, loading, refreshing, refreshFromDiscord } = useBotRoles(botId, guildId ?? undefined);

  const filtered = useMemo(
    () => roles.filter((r) => !r.is_everyone && !r.managed),
    [roles],
  );

  const toggle = (roleId: string) => {
    if (value.includes(roleId)) onChange(value.filter((v) => v !== roleId));
    else onChange([...value, roleId]);
  };

  const handleRefresh = async () => {
    if (!guildId) {
      toast.info("Select a server at the top first.");
      return;
    }
    const result = await refreshFromDiscord();
    if (result.ok) toast.success("Role list refreshed.");
    else if (result.error === "timeout")
      toast.warning("Refresh queued — bot may be offline.");
    else toast.error(`Refresh failed: ${result.error}`);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <div className="flex items-center gap-1">
          {filtered.length > 0 && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange(filtered.map((r) => r.role_id))}
                className="h-7 px-2 text-xs"
              >
                All
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange([])}
                className="h-7 px-2 text-xs"
              >
                None
              </Button>
            </>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing || !guildId}
            className="h-7 px-2 text-xs gap-1.5"
          >
            <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 rounded-md border border-input bg-muted/30 p-2">
          {value.map((id) => {
            const r = roles.find((x) => x.role_id === id);
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 rounded-full bg-primary/15 text-primary px-2 py-0.5 text-xs"
              >
                @{r?.role_name ?? id}
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  className="hover:text-destructive"
                  aria-label={`Remove ${r?.role_name ?? id}`}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}
      <div className="max-h-56 overflow-y-auto rounded-md border border-input bg-background p-2 space-y-1">
        {!guildId ? (
          <p className="text-sm text-muted-foreground p-2">Select a server first</p>
        ) : loading ? (
          <p className="text-sm text-muted-foreground p-2">Loading roles…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground p-2">
            No roles cached — click Refresh
          </p>
        ) : (
          filtered.map((r) => {
            const checked = value.includes(r.role_id);
            return (
              <label
                key={r.role_id}
                className={cn(
                  "flex items-center gap-2 cursor-pointer text-sm rounded px-2 py-1 hover:bg-muted/40",
                  checked && "bg-primary/10",
                )}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={checked}
                  onChange={() => toggle(r.role_id)}
                />
                <AtSign className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{r.role_name}</span>
              </label>
            );
          })
        )}
      </div>
      {value.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {value.length} role{value.length === 1 ? "" : "s"} selected
        </p>
      )}
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  );
}
