import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ArrowRight,
  Save,
  Settings2,
  Megaphone,
  Hash,
  Volume2,
  MessagesSquare,
  ChevronsUpDown,
  Check,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getAddonConfig, type AddonField } from "@/lib/addonConfigs";
import { getAddonLabel } from "@/lib/botCatalog";
import { SayCommandBuilder } from "./SayCommandBuilder";
import { TicketPanelBuilder } from "./TicketPanelBuilder";
import { useActiveGuild } from "@/hooks/useActiveGuild";
import { sortedChannelCategoryEntries, useBotChannels } from "@/hooks/useGuildChannels";

const CHANNEL_ICON: Record<string, typeof Hash> = {
  text: Hash,
  announcement: Megaphone,
  forum: MessagesSquare,
  voice: Volume2,
};

type Props = {
  addonId: string;
  botId?: string;
  botName: string;
  botAvatarUrl?: string | null;
};

/**
 * One configuration "box" per add-on. Click → opens a dialog whose form
 * is built from the add-on's field schema in addonConfigs.ts.
 *
 * Mock UI only — values live in local state and "save" shows a toast.
 */
export function AddonConfigCard({ addonId, botId, botName, botAvatarUrl }: Props) {
  const isSayCommand = addonId === "messages";
  const isTicketPanel = addonId === "ticket-message-customization";
  const isAnonReport = addonId === "anonymous-reporting";
  const config = getAddonConfig(addonId);
  const [open, setOpen] = useState(false);

  // Generic, untyped form state — schema-driven.
  const [values, setValues] = useState<Record<string, string | number | boolean | string[]>>({});

  useEffect(() => {
    if (!config) return;
    const initial: Record<string, string | number | boolean | string[]> = {};
    for (const f of config.fields) {
      initial[f.key] =
        f.defaultValue ??
        (f.type === "toggle"
          ? false
          : f.type === "number"
            ? 0
            : f.type === "multiselect"
              ? []
              : "");
    }
    setValues(initial);
  }, [config, addonId]);

  // Add-ons we don't have a schema for yet — show a stub box so we know
  // it's owned but configuration is still wired up.
  if (!config) {
    return (
      <Card className="bg-card/40 border-dashed border-border p-6 flex flex-col h-[210px]">
        <div className="flex items-start gap-3 mb-3">
          <div className="h-10 w-10 rounded-lg bg-muted/40 border border-border grid place-items-center shrink-0">
            <Settings2 className="h-5 w-5 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-base leading-tight pt-1.5">
            {getAddonLabel(addonId)}
          </h3>
        </div>
        <p className="text-sm text-muted-foreground flex-1">
          Configuration coming soon for this add-on.
        </p>
      </Card>
    );
  }

  const Icon = config.icon;

  const setValue = (k: string, v: string | number | boolean | string[]) =>
    setValues((prev) => ({ ...prev, [k]: v }));

  const toggleMulti = (k: string, optionValue: string) =>
    setValues((prev) => {
      const current = Array.isArray(prev[k]) ? (prev[k] as string[]) : [];
      const next = current.includes(optionValue)
        ? current.filter((v) => v !== optionValue)
        : [...current, optionValue];
      return { ...prev, [k]: next };
    });

  const renderField = (f: AddonField) => {
    const value = values[f.key];

    if (f.type === "toggle") {
      return (
        <div className="flex items-start justify-between gap-4 py-1">
          <div className="space-y-1">
            <Label htmlFor={f.key} className="cursor-pointer">{f.label}</Label>
            {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
          </div>
          <Switch
            id={f.key}
            checked={!!value}
            onCheckedChange={(v) => setValue(f.key, v)}
          />
        </div>
      );
    }

    if (f.type === "select") {
      return (
        <div className="space-y-2">
          <Label htmlFor={f.key}>{f.label}</Label>
          <Select
            value={String(value ?? "")}
            onValueChange={(v) => setValue(f.key, v)}
          >
            <SelectTrigger id={f.key}>
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              {f.options?.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
        </div>
      );
    }

    if (f.type === "multiselect") {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="space-y-2">
          <Label>{f.label}</Label>
          <div className="grid gap-2 rounded-md border border-border p-3">
            {f.options?.map((o) => {
              const checked = selected.includes(o.value);
              return (
                <label
                  key={o.value}
                  className="flex items-center gap-2 cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={checked}
                    onChange={() => toggleMulti(f.key, o.value)}
                  />
                  <span>{o.label}</span>
                </label>
              );
            })}
          </div>
          {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
        </div>
      );
    }

    if (f.type === "textarea") {
      return (
        <div className="space-y-2">
          <Label htmlFor={f.key}>{f.label}</Label>
          <Textarea
            id={f.key}
            value={String(value ?? "")}
            placeholder={f.placeholder}
            onChange={(e) => setValue(f.key, e.target.value)}
            rows={4}
          />
          {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
        </div>
      );
    }

    if (f.type === "channel") {
      return (
        <ChannelComboField
          field={f}
          value={String(value ?? "")}
          onChange={(v) => setValue(f.key, v)}
          botId={botId}
        />
      );
    }

    // text / role / number
    return (
      <div className="space-y-2">
        <Label htmlFor={f.key}>{f.label}</Label>
        <Input
          id={f.key}
          type={f.type === "number" ? "number" : "text"}
          value={String(value ?? "")}
          placeholder={f.placeholder}
          onChange={(e) =>
            setValue(
              f.key,
              f.type === "number" ? Number(e.target.value) : e.target.value,
            )
          }
        />
        {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
      </div>
    );
  };

  return (
    <>
      <Card
        onClick={() => setOpen(true)}
        className="group cursor-pointer bg-card hover:bg-card/80 border-border hover:border-primary/50 hover:shadow-elegant transition-smooth p-6 flex flex-col h-[210px]"
      >
        <div className="flex items-start gap-3 mb-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center shrink-0 group-hover:bg-primary/15 transition-smooth">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <h3 className="font-semibold text-base leading-tight pt-1.5">
            {config.title}
          </h3>
        </div>
        <p className="text-sm text-muted-foreground flex-1">{config.summary}</p>
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-muted-foreground">
            {config.fields.length} setting{config.fields.length === 1 ? "" : "s"}
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-smooth" />
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={
            isSayCommand
              ? "max-w-5xl max-h-[90vh] overflow-y-auto"
              : isTicketPanel || isAnonReport
                ? "max-w-2xl max-h-[90vh] overflow-y-auto"
                : "max-w-lg max-h-[85vh] overflow-y-auto"
          }
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className="h-5 w-5 text-primary" />
              {config.title}
            </DialogTitle>
            <DialogDescription>
              Configure <span className="text-foreground font-medium">{config.title}</span> for{" "}
              <span className="text-foreground font-medium">{botName}</span>.
            </DialogDescription>
          </DialogHeader>

          {isSayCommand ? (
            <div className="py-2">
              <SayCommandBuilder botId={botId} botName={botName} botAvatarUrl={botAvatarUrl} />
            </div>
          ) : isTicketPanel ? (
            <TicketPanelBuilder botId={botId} botName={botName} variant="ticket" />
          ) : isAnonReport ? (
            <TicketPanelBuilder botId={botId} botName={botName} variant="report" />
          ) : (
            <div className="space-y-5 py-2">
              {config.fields.map((f) => (
                <div key={f.key}>{renderField(f)}</div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                toast.success(`${config.title} settings saved`);
                setOpen(false);
              }}
            >
              <Save className="h-4 w-4 mr-1.5" />
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Channel picker for schema-driven addon fields.
 *
 * Pulls the live channel list for the dashboard's *active guild* (set by
 * the server selector at the top of the page) using the bot's cached
 * channels. Subscribes to realtime updates so newly created/deleted
 * channels appear without a page reload, and offers a manual refresh
 * that asks the worker to re-fetch from Discord.
 */
function ChannelComboField({
  field,
  value,
  onChange,
  botId,
}: {
  field: AddonField;
  value: string;
  onChange: (v: string) => void;
  botId?: string;
}) {
  const { guild } = useActiveGuild();
  const guildId = guild?.guild_id;
  const { channels, loading, refreshing, refreshFromDiscord } = useBotChannels(
    botId,
    guildId,
  );
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Default to the standard text-channel set; voice/forum can opt-in later.
  const filtered = useMemo(
    () =>
      channels.filter((c) =>
        ["text", "announcement", "forum"].includes(c.channel_type),
      ),
    [channels],
  );
  const selected = useMemo(
    () => channels.find((c) => c.channel_id === value) ?? null,
    [channels, value],
  );
  const channelGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = q
      ? filtered.filter((c) =>
          `${c.channel_name} ${c.channel_id}`.toLowerCase().includes(q),
        )
      : filtered;
    return sortedChannelCategoryEntries(visible);
  }, [filtered, query]);

  const handleRefresh = async () => {
    if (!guildId) {
      toast.info("Select a server at the top first.");
      return;
    }
    const result = await refreshFromDiscord();
    if (result.ok) toast.success("Channel list refreshed.");
    else if (result.error === "timeout")
      toast.warning("Refresh queued — bot may be offline.");
    else toast.error(`Refresh failed: ${result.error}`);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{field.label}</Label>
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
      <Popover
        open={open}
        onOpenChange={setOpen}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={!guildId}
            className="w-full justify-between font-normal"
          >
            <span className="flex items-center gap-2 min-w-0">
              {selected ? (
                <>
                  {(() => {
                    const Icon = CHANNEL_ICON[selected.channel_type] ?? Hash;
                    return (
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    );
                  })()}
                  <span className="truncate">{selected.channel_name}</span>
                </>
              ) : (
                <>
                  <Hash className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-muted-foreground">
                    {!guildId
                      ? "Select a server first"
                      : loading
                        ? "Loading channels…"
                        : filtered.length === 0
                          ? "No channels cached — click Refresh"
                          : "Select a channel…"}
                  </span>
                </>
              )}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
        >
          <div className="border-b border-border p-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search channels…"
              className="h-9"
            />
          </div>
          <div className="max-h-[300px] overflow-y-auto p-1">
            {channelGroups.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {filtered.length === 0 ? "No channels cached yet." : "No matching channels."}
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
                          value === c.channel_id && "bg-accent text-accent-foreground",
                        )}
                        onClick={() => {
                          onChange(c.channel_id);
                          setQuery("");
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4 shrink-0",
                            value === c.channel_id ? "opacity-100" : "opacity-0",
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
      {field.help && (
        <p className="text-xs text-muted-foreground">{field.help}</p>
      )}
    </div>
  );
}
