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
import { useBotRoles } from "@/hooks/useBotRoles";
import { AtSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/**
 * One configuration "box" per add-on. Click → opens a dialog whose form
 * is built from the add-on's field schema in addonConfigs.ts.
 *
 * Mock UI only — values live in local state and "save" shows a toast.
 */
export function AddonConfigCard({ addonId, botId, botName, botAvatarUrl, open: openProp, onOpenChange }: Props) {
  const isSayCommand = addonId === "messages";
  const isTicketPanel = addonId === "ticket-message-customization";
  const isAnonReport = addonId === "anonymous-reporting";
  const isVerification = addonId === "verification-system";
  const isAdvancedLogging = addonId === "advanced-logging";
  const config = getAddonConfig(addonId);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = (v: boolean) => {
    if (onOpenChange) onOpenChange(v);
    else setInternalOpen(v);
  };
  const [appliedAt, setAppliedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  // Load existing verification config from bot_config when dialog opens.
  useEffect(() => {
    if (!isVerification || !open || !botId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("bot_config")
        .select("config, applied_at")
        .eq("bot_id", botId)
        .eq("feature", "verification")
        .maybeSingle();
      if (cancelled || !data) return;
      const cfg = (data.config ?? {}) as Record<string, any>;
      setValues((prev) => ({
        ...prev,
        channel_id: cfg.channel_id ?? "",
        role_id: cfg.role_id ?? "",
        message: cfg.message ?? prev.message ?? "",
        button_label: cfg.button_label ?? prev.button_label ?? "Verify",
        min_account_age_days: String(cfg.min_account_age_days ?? "0"),
        embed_author: cfg.author ?? cfg.embed_author ?? "",
        embed_title: cfg.title ?? cfg.embed_title ?? "",
        embed_footer: cfg.footer ?? cfg.embed_footer ?? "",
      }));
      setAppliedAt((data as any).applied_at ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [isVerification, open, botId]);

  // Load existing advanced-logging config when dialog opens.
  useEffect(() => {
    if (!isAdvancedLogging || !open || !botId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("bot_config")
        .select("config, applied_at")
        .eq("bot_id", botId)
        .eq("feature", "advanced-logging")
        .maybeSingle();
      if (cancelled || !data) return;
      const cfg = (data.config ?? {}) as Record<string, any>;
      setValues((prev) => ({
        ...prev,
        channel: cfg.log_channel_id ?? "",
        logMessages: cfg.log_message_edits_deletes ?? true,
        logMembers: cfg.log_member_joins_leaves ?? true,
        logVoice: cfg.log_voice_activity ?? false,
        logModeration: cfg.log_moderation_actions ?? true,
      }));
      setAppliedAt((data as any).applied_at ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdvancedLogging, open, botId]);

  const saveAdvancedLogging = async () => {
    if (!botId) {
      toast.error("Missing bot id.");
      return;
    }
    setSaving(true);
    const payload = {
      bot_id: botId,
      feature: "advanced-logging",
      config: {
        log_channel_id: String(values.channel ?? ""),
        log_message_edits_deletes: !!values.logMessages,
        log_member_joins_leaves: !!values.logMembers,
        log_voice_activity: !!values.logVoice,
        log_moderation_actions: !!values.logModeration,
      },
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("bot_config")
      .upsert(payload, { onConflict: "bot_id,feature" });
    setSaving(false);
    if (error) {
      toast.error(`Save failed: ${error.message}`);
      return;
    }
    const { data: cmdData, error: cmdError } = await supabase.rpc("enqueue_apply_config" as any, {
      _bot_id: botId,
      _feature: "advanced-logging",
    });
    const cmdResult = cmdData as { ok?: boolean; error?: string } | null;
    if (cmdError) {
      toast.warning(`Saved, but failed to notify bot: ${cmdError.message}`);
    } else if (cmdResult && cmdResult.ok === false) {
      toast.warning(`Saved, but failed to notify bot: ${cmdResult.error ?? "unknown error"}`);
    } else {
      toast.success("Advanced Logging settings saved & applied");
    }
    setOpen(false);
  };

  const saveVerification = async () => {
    if (!botId) {
      toast.error("Missing bot id.");
      return;
    }
    setSaving(true);
    const payload = {
      bot_id: botId,
      feature: "verification",
      config: {
        channel_id: String(values.channel_id ?? ""),
        role_id: String(values.role_id ?? ""),
        message: String(values.message ?? ""),
        button_label: String(values.button_label ?? "Verify"),
        min_account_age_days: Number(values.min_account_age_days ?? 0),
        author: String(values.embed_author ?? ""),
        title: String(values.embed_title ?? ""),
        footer: String(values.embed_footer ?? ""),
      },
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("bot_config")
      .upsert(payload, { onConflict: "bot_id,feature" });
    setSaving(false);
    if (error) {
      toast.error(`Save failed: ${error.message}`);
      return;
    }
    const { data: cmdData, error: cmdError } = await supabase.rpc("enqueue_apply_config" as any, {
      _bot_id: botId,
      _feature: "verification",
    });
    const cmdResult = cmdData as { ok?: boolean; error?: string } | null;
    if (cmdError) {
      toast.warning(`Saved, but failed to notify bot: ${cmdError.message}`);
    } else if (cmdResult && cmdResult.ok === false) {
      toast.warning(`Saved, but failed to notify bot: ${cmdResult.error ?? "unknown error"}`);
    } else {
      toast.success("Verification settings saved & applied");
    }
    setOpen(false);
  };


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

    if (f.type === "role") {
      return (
        <RoleComboField
          field={f}
          value={String(value ?? "")}
          onChange={(v) => setValue(f.key, v)}
          botId={botId}
        />
      );
    }

    // text / number
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

          <DialogFooter className="flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            {isVerification && appliedAt ? (
              <span className="text-xs text-muted-foreground">
                Last applied {new Date(appliedAt).toLocaleString()}
              </span>
            ) : isAdvancedLogging && appliedAt ? (
              <span className="text-xs text-muted-foreground">
                Last applied {new Date(appliedAt).toLocaleString()}
              </span>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={saving}
                onClick={() => {
                  if (isVerification) {
                    void saveVerification();
                  } else if (isAdvancedLogging) {
                    void saveAdvancedLogging();
                  } else {
                    toast.success(`${config.title} settings saved`);
                    setOpen(false);
                  }
                }}
              >
                <Save className="h-4 w-4 mr-1.5" />
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
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
  // Default to the standard text-channel set; voice/forum can opt-in later.
  const filtered = useMemo(
    () =>
      channels.filter((c) =>
        ["text", "announcement", "forum"].includes(c.channel_type),
      ),
    [channels],
  );
  const selected = useMemo(
    () => filtered.find((c) => c.channel_id === value) ?? null,
    [filtered, value],
  );
  const channelGroups = useMemo(
    () => sortedChannelCategoryEntries(filtered),
    [filtered],
  );

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
      <label className="relative block">
        <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <select
          value={selected?.channel_id ?? ""}
          onChange={(event) => onChange(event.target.value)}
          disabled={!guildId}
          className="h-10 w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm text-foreground ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">
            {!guildId
              ? "Select a server first"
              : loading
                ? "Loading channels…"
                : filtered.length === 0
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
      {field.help && (
        <p className="text-xs text-muted-foreground">{field.help}</p>
      )}
    </div>
  );
}

/**
 * Role picker for schema-driven addon fields. Mirrors the channel picker UX:
 * native `<select>`, auto-syncs from Discord on guild change, manual refresh.
 */
function RoleComboField({
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
  const { roles, loading, refreshing, refreshFromDiscord } = useBotRoles(botId, guildId);

  // Hide @everyone and managed (bot/integration) roles by default — pickable
  // assignable roles only.
  const filtered = useMemo(
    () => roles.filter((r) => !r.is_everyone && !r.managed),
    [roles],
  );

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
      <label className="relative block">
        <AtSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={!guildId}
          className="h-10 w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm text-foreground ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">
            {!guildId
              ? "Select a server first"
              : loading
                ? "Loading roles…"
                : filtered.length === 0
                  ? "No roles cached — click Refresh"
                  : "Select a role…"}
          </option>
          {filtered.map((r) => (
            <option key={r.role_id} value={r.role_id}>
              @{r.role_name}
            </option>
          ))}
        </select>
      </label>
      {field.help && (
        <p className="text-xs text-muted-foreground">{field.help}</p>
      )}
    </div>
  );
}
