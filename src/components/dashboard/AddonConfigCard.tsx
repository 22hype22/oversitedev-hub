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
import { SayCommandBuilder, type SayCommandBuilderHandle } from "./SayCommandBuilder";
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
  enabled?: boolean;
  onToggleEnabled?: (enabled: boolean) => void;
};

/**
 * One configuration "box" per add-on. Click → opens a dialog whose form
 * is built from the add-on's field schema in addonConfigs.ts.
 *
 * Mock UI only — values live in local state and "save" shows a toast.
 */
export function AddonConfigCard({ addonId, botId, botName, botAvatarUrl, open: openProp, onOpenChange, enabled = true, onToggleEnabled }: Props) {
  const isSayCommand = addonId === "messages";
  const isTicketPanel = addonId === "ticket-message-customization";
  const isAnonReport = addonId === "anonymous-reporting";
  const isVerification = addonId === "verification-system";
  const isAdvancedLogging = addonId === "advanced-logging";
  const isModeration = addonId === "mod-actions";
  const isAntiSpam = addonId === "anti-spam";
  const isAntiRaid = addonId === "anti-raid";
  const isNsfwInviteScanner = addonId === "nsfw-invite-scanner";
  const config = getAddonConfig(addonId);

  // Map dashboard addon id → bot_config.feature name for toggleable features.
  const TOGGLE_FEATURE_MAP: Record<string, string> = {
    "verification-system": "verification",
    "advanced-logging": "advanced-logging",
    
    "anti-spam": "anti-spam",
    "anti-raid": "anti-raid",
    "phishing-detection": "phishing-link-detection",
    "nsfw-invite-scanner": "nsfw-invite-scanner",
  };

  const persistEnabledFlag = async (next: boolean) => {
    const feature = TOGGLE_FEATURE_MAP[addonId];
    console.log("[toggle] persistEnabledFlag start", { addonId, feature, botId, next });
    if (!feature || !botId) {
      console.warn("[toggle] aborting — missing feature or botId", { feature, botId });
      return;
    }
    try {
      // 1) Server-side JSONB merge: config = COALESCE(config,'{}') || {"enabled": next}
      console.log("[toggle] calling set_bot_config_enabled", { botId, feature, next });
      const { error: mergeError } = await supabase.rpc("set_bot_config_enabled" as any, {
        _bot_id: botId,
        _feature: feature,
        _enabled: next,
      });
      console.log("[toggle] set_bot_config_enabled result", { mergeError });
      if (mergeError) {
        toast.error(`Failed to save toggle: ${mergeError.message}`);
        return;
      }
      // 2) ALWAYS enqueue apply_config so the bot picks up the change immediately.
      console.log("[toggle] BEFORE enqueue_apply_config", { botId, feature });
      const { data: cmdData, error: cmdError } = await supabase.rpc(
        "enqueue_apply_config" as any,
        { _bot_id: botId, _feature: feature },
      );
      console.log("[toggle] AFTER enqueue_apply_config", { cmdData, cmdError });
      const cmdResult = cmdData as { ok?: boolean; error?: string } | null;
      if (cmdError) {
        toast.warning(`Saved, but failed to notify bot: ${cmdError.message}`);
      } else if (cmdResult && cmdResult.ok === false) {
        toast.warning(`Saved, but failed to notify bot: ${cmdResult.error ?? "unknown error"}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[toggle] persistEnabledFlag threw", err);
      toast.error(`Toggle failed: ${msg}`);
    }
  };

  const handleToggleEnabled = (next: boolean) => {
    console.log("[toggle] handleToggleEnabled fired", { addonId, next });
    onToggleEnabled?.(next);
    void persistEnabledFlag(next);
  };
  const { guild } = useActiveGuild();
  const targetServerName = guild?.guild_name ?? guild?.guild_id ?? botName;
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
        logMessagesSent: cfg.log_messages_sent ?? false,
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

  // Load existing moderation config when dialog opens.
  useEffect(() => {
    if (!isModeration || !open || !botId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("bot_config")
        .select("config, applied_at")
        .eq("bot_id", botId)
        .eq("feature", "moderation")
        .maybeSingle();
      if (cancelled || !data) return;
      const cfg = (data.config ?? {}) as Record<string, any>;
      const rawRoles = cfg.moderator_role_ids ?? cfg.moderator_role_id;
      const modRoles = Array.isArray(rawRoles)
        ? rawRoles.map(String)
        : rawRoles
          ? [String(rawRoles)]
          : [];
      setValues((prev) => ({
        ...prev,
        modRole: modRoles,
        logChannel: cfg.log_channel_id ?? "",
        defaultMuteDuration: String(cfg.default_mute_minutes ?? "60"),
        dmOnAction: cfg.dm_on_action ?? true,
        requireReason: cfg.require_reason ?? true,
      }));
      setAppliedAt((data as any).applied_at ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [isModeration, open, botId]);

  // Load existing anti-spam config when dialog opens.
  useEffect(() => {
    if (!isAntiSpam || !open || !botId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("bot_config")
        .select("config, applied_at")
        .eq("bot_id", botId)
        .eq("feature", "anti-spam")
        .maybeSingle();
      if (cancelled || !data) return;
      const cfg = (data.config ?? {}) as Record<string, any>;
      const minutes = Number(cfg.mute_duration_minutes ?? 10);
      const muteDurationStr =
        minutes === 5 ? "5m" : minutes === 60 ? "1h" : "10m";
      const exempt = Array.isArray(cfg.exempt_role_ids)
        ? cfg.exempt_role_ids.map(String)
        : [];
      const pingExempt = Array.isArray(cfg.exempt_ping_role_ids)
        ? cfg.exempt_ping_role_ids.map(String)
        : [];
      setValues((prev) => ({
        ...prev,
        messageThreshold: Number(cfg.spam_threshold ?? 6),
        action: Array.isArray(cfg.action)
          ? cfg.action.map(String)
          : cfg.action
            ? [String(cfg.action)]
            : ["mute"],
        muteDuration: muteDurationStr,
        logChannel: cfg.log_channel_id ?? "",
        ignoreStaff: cfg.ignore_staff ?? true,
        exemptRoles: exempt,
        pingExemptRoles: pingExempt,
      }));
      setAppliedAt((data as any).applied_at ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [isAntiSpam, open, botId]);

  const saveAntiSpam = async () => {
    if (!botId) {
      toast.error("Missing bot id.");
      return;
    }
    setSaving(true);
    const muteStr = String(values.muteDuration ?? "10m");
    const muteMinutes =
      muteStr === "5m" ? 5 : muteStr === "1h" ? 60 : 10;
    const payload = {
      bot_id: botId,
      feature: "anti-spam",
      config: {
        spam_threshold: Number(values.messageThreshold ?? 6),
        action: Array.isArray(values.action)
          ? (values.action as string[]).filter(Boolean)
          : values.action
            ? [String(values.action)]
            : ["mute"],
        mute_duration_minutes: muteMinutes,
        log_channel_id: values.logChannel ? String(values.logChannel) : null,
        ignore_staff: !!values.ignoreStaff,
        exempt_role_ids: Array.isArray(values.exemptRoles)
          ? (values.exemptRoles as string[]).filter(Boolean)
          : [],
        exempt_ping_role_ids: Array.isArray(values.pingExemptRoles)
          ? (values.pingExemptRoles as string[]).filter(Boolean)
          : [],
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
      _feature: "anti-spam",
    });
    const cmdResult = cmdData as { ok?: boolean; error?: string } | null;
    if (cmdError) {
      toast.warning(`Saved, but failed to notify bot: ${cmdError.message}`);
    } else if (cmdResult && cmdResult.ok === false) {
      toast.warning(`Saved, but failed to notify bot: ${cmdResult.error ?? "unknown error"}`);
    } else {
      toast.success("Anti-Spam settings saved & applied");
    }
    setOpen(false);
  };

  // Load existing anti-raid config when dialog opens.
  useEffect(() => {
    if (!isAntiRaid || !open || !botId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("bot_config")
        .select("config, applied_at")
        .eq("bot_id", botId)
        .eq("feature", "anti-raid")
        .maybeSingle();
      if (cancelled || !data) return;
      const cfg = (data.config ?? {}) as Record<string, any>;
      setValues((prev) => ({
        ...prev,
        joinThreshold: Number(cfg.raid_threshold ?? 8),
        actions: Array.isArray(cfg.actions)
          ? cfg.actions.map(String)
          : cfg.actions
            ? [String(cfg.actions)]
            : ["lock"],
        alertChannel: cfg.alert_channel_id ?? "",
        pingRole: cfg.alert_role_id ?? "",
        autoUnlock: cfg.auto_unlock ?? true,
      }));
      setAppliedAt((data as any).applied_at ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [isAntiRaid, open, botId]);

  const saveAntiRaid = async () => {
    if (!botId) {
      toast.error("Missing bot id.");
      return;
    }
    setSaving(true);
    const payload = {
      bot_id: botId,
      feature: "anti-raid",
      config: {
        raid_threshold: Number(values.joinThreshold ?? 8),
        actions: Array.isArray(values.actions)
          ? (values.actions as string[]).filter(Boolean)
          : values.actions
            ? [String(values.actions)]
            : ["lock"],
        alert_channel_id: values.alertChannel ? String(values.alertChannel) : null,
        alert_role_id: values.pingRole ? String(values.pingRole) : null,
        auto_unlock: !!values.autoUnlock,
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
      _feature: "anti-raid",
    });
    const cmdResult = cmdData as { ok?: boolean; error?: string } | null;
    if (cmdError) {
      toast.warning(`Saved, but failed to notify bot: ${cmdError.message}`);
    } else if (cmdResult && cmdResult.ok === false) {
      toast.warning(`Saved, but failed to notify bot: ${cmdResult.error ?? "unknown error"}`);
    } else {
      toast.success("Anti-Raid settings saved & applied");
    }
    setOpen(false);
  };

  const saveModeration = async () => {
    if (!botId) {
      toast.error("Missing bot id.");
      return;
    }
    setSaving(true);
    const payload = {
      bot_id: botId,
      feature: "moderation",
      config: {
        moderator_role_ids: Array.isArray(values.modRole)
          ? (values.modRole as string[]).filter(Boolean)
          : [],
        log_channel_id: values.logChannel ? String(values.logChannel) : null,
        default_mute_minutes: Number(values.defaultMuteDuration ?? 60),
        dm_on_action: !!values.dmOnAction,
        require_reason: !!values.requireReason,
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
      _feature: "moderation",
    });
    const cmdResult = cmdData as { ok?: boolean; error?: string } | null;
    if (cmdError) {
      toast.warning(`Saved, but failed to notify bot: ${cmdError.message}`);
    } else if (cmdResult && cmdResult.ok === false) {
      toast.warning(`Saved, but failed to notify bot: ${cmdResult.error ?? "unknown error"}`);
    } else {
      toast.success("Moderation settings saved & applied");
    }
    setOpen(false);
  };

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
        log_messages_sent: !!values.logMessagesSent,
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

  // Load existing nsfw-invite-scanner config when dialog opens.
  useEffect(() => {
    if (!isNsfwInviteScanner || !open || !botId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("bot_config")
        .select("config, applied_at")
        .eq("bot_id", botId)
        .eq("feature", "nsfw-invite-scanner")
        .maybeSingle();
      if (cancelled || !data) return;
      const cfg = (data.config ?? {}) as Record<string, any>;
      setValues((prev) => ({
        ...prev,
        alertChannel: cfg.alert_channel_id ?? "",
        action: cfg.action ?? "delete",
        censorLogs: cfg.censor_in_logs ?? true,
        scanDms: cfg.scan_dms ?? false,
      }));
      setAppliedAt((data as any).applied_at ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [isNsfwInviteScanner, open, botId]);

  const saveNsfwInviteScanner = async () => {
    if (!botId) {
      toast.error("Missing bot id.");
      return;
    }
    setSaving(true);
    const payload = {
      bot_id: botId,
      feature: "nsfw-invite-scanner",
      config: {
        alert_channel_id: values.alertChannel ? String(values.alertChannel) : null,
        action: String(values.action ?? "delete"),
        censor_in_logs: !!values.censorLogs,
        scan_dms: !!values.scanDms,
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
      _feature: "nsfw-invite-scanner",
    });
    const cmdResult = cmdData as { ok?: boolean; error?: string } | null;
    if (cmdError) {
      toast.warning(`Saved, but failed to notify bot: ${cmdError.message}`);
    } else if (cmdResult && cmdResult.ok === false) {
      toast.warning(`Saved, but failed to notify bot: ${cmdResult.error ?? "unknown error"}`);
    } else {
      toast.success("NSFW Invite Scanner settings saved & applied");
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

    if (f.type === "multirole") {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <MultiRoleField
          field={f}
          value={selected}
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
        onClick={() => enabled && setOpen(true)}
        className={cn(
          "group/card border-border transition-smooth p-6 flex flex-col h-[210px] relative",
          enabled
            ? "cursor-pointer bg-card hover:bg-card/80 hover:border-primary/50 hover:shadow-elegant"
            : "bg-muted/30 opacity-60 grayscale cursor-default",
        )}
      >
        <div className="flex items-start gap-3 mb-3">
          <div className={cn(
            "h-10 w-10 rounded-lg border grid place-items-center shrink-0 transition-smooth",
            enabled
              ? "bg-primary/10 border-primary/20 group-hover/card:bg-primary/15"
              : "bg-muted border-border",
          )}>
            <Icon className={cn("h-5 w-5", enabled ? "text-primary" : "text-muted-foreground")} />
          </div>
          <h3 className="font-semibold text-base leading-tight pt-1.5 flex-1">
            {config.title}
          </h3>
          {onToggleEnabled && (
            <div
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerDownCapture={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              className="pt-1"
            >
              <Switch
                checked={enabled}
                onCheckedChange={handleToggleEnabled}
                aria-label={`${enabled ? "Disable" : "Enable"} ${config.title}`}
              />
            </div>
          )}
        </div>
        <p className="text-sm text-muted-foreground flex-1">{config.summary}</p>
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-muted-foreground">
            {enabled
              ? `${config.fields.length} setting${config.fields.length === 1 ? "" : "s"}`
              : "Disabled"}
          </span>
          {enabled && (
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover/card:text-primary group-hover/card:translate-x-1 transition-smooth" />
          )}
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
              <span className="text-foreground font-medium">{targetServerName}</span>.
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
                  } else if (isModeration) {
                    void saveModeration();
                  } else if (isAntiSpam) {
                    void saveAntiSpam();
                  } else if (isAntiRaid) {
                    void saveAntiRaid();
                  } else if (isNsfwInviteScanner) {
                    void saveNsfwInviteScanner();
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

/**
 * Multi-select role picker. Renders a list of checkboxes for each assignable
 * role with refresh + select all/none controls.
 */
function MultiRoleField({
  field,
  value,
  onChange,
  botId,
}: {
  field: AddonField;
  value: string[];
  onChange: (v: string[]) => void;
  botId?: string;
}) {
  const { guild } = useActiveGuild();
  const guildId = guild?.guild_id;
  const { roles, loading, refreshing, refreshFromDiscord } = useBotRoles(botId, guildId);

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
        <Label>{field.label}</Label>
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
                className="flex items-center gap-2 cursor-pointer text-sm rounded px-2 py-1 hover:bg-muted/40"
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
      {field.help && (
        <p className="text-xs text-muted-foreground">{field.help}</p>
      )}
    </div>
  );
}
