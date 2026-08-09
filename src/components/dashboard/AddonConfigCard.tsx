import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DiscordMarkdownTextarea } from "@/components/ui/discord-markdown-textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
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
  Plus,
  Trash2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getAddonConfig, type AddonField } from "@/lib/addonConfigs";
import { getAddonLabel } from "@/lib/botCatalog";
import { SayCommandBuilder, type SayCommandBuilderHandle } from "./SayCommandBuilder";
import { MessagesV2Builder, normalizeV2Items, type MessagesV2BuilderHandle, type V2Item } from "./MessagesV2Builder";
import { TicketPanelBuilder, type TicketPanelBuilderHandle } from "./TicketPanelBuilder";
import { TicketEditor, type TicketEditorHandle } from "./TicketEditor";
import { PostTypesManager } from "./PostTypesManager";
import { useActiveGuild } from "@/hooks/useActiveGuild";
import { sortedChannelCategoryEntries, useBotChannels } from "@/hooks/useGuildChannels";
import { useBotRoles } from "@/hooks/useBotRoles";
import { AtSign, Braces } from "lucide-react";

const INVITE_VARIABLES: { token: string; desc: string }[] = [
  { token: "{user}", desc: "Mentions the new member" },
  { token: "{username}", desc: "Their display name" },
  { token: "{server}", desc: "Server name" },
  { token: "{count}", desc: "Total members" },
  { token: "{human_count}", desc: "Members excluding bots" },
  { token: "{bot_count}", desc: "Number of bots" },
  { token: "{boosts}", desc: "Total server boosts" },
  { token: "{boost_level}", desc: "Boost tier (0–3)" },
  { token: "{channel_count}", desc: "Number of channels" },
  { token: "{role_count}", desc: "Number of roles" },
];
import { supabase } from "@/integrations/supabase/client";
import { RoleMultiSelect } from "./RoleMultiSelect";
import { useTeamRole } from "@/hooks/useTeamRole";
import { useBotScope } from "./ReadOnlyBotScope";

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
  engineVersion?: "v1" | "v2";
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
export function AddonConfigCard({ addonId, botId, botName, botAvatarUrl, engineVersion: engineVersionProp, open: openProp, onOpenChange, enabled = true, onToggleEnabled }: Props) {

  const { botId: scopeBotId, viaTeam, readOnly: scopeReadOnly } = useBotScope();
  const { permissions, role } = useTeamRole(viaTeam ? (scopeBotId ?? botId ?? null) : null);
  const canEdit = viaTeam ? permissions.edit_bot_config : true;
  const readOnly = scopeReadOnly || (viaTeam && !permissions.edit_bot_config);
  const isSayCommand = addonId === "messages";
  // Customs "Messages" uses the SAME rich builder as Join Message (invite):
  // external channel field + Variables + embedded MessagesV2Builder, then posts
  // the composed message to the chosen channel via enqueue_post_message.
  const isCustomsMessages = addonId === "customs-messages";
  const isRules = addonId === "rules";
  const isTicketPanel = addonId === "ticket-message-customization";
  const isTicketLifecycleMessages = addonId === "ticket-lifecycle-messages";
  const isTicketEditor = addonId === "ticket-editor";
  // removed: anonymous-reporting card discontinued
  const isVerification = addonId === "verification-system";
  const isAdvancedLogging = addonId === "advanced-logging";
  const isModeration = addonId === "mod-actions";
  const isAntiSpam = addonId === "anti-spam";
  const isAntiRaid = addonId === "anti-raid";
  const isNsfwInviteScanner = addonId === "nsfw-invite-scanner";
  const isAutoRole = addonId === "auto-role";
  const isModHistory = addonId === "moderation-history";
  const isAutoEscalate = addonId === "auto-escalating-warnings";
  const isAvatarNsfw = addonId === "avatar-nsfw-detection";
  const isBioPhrase = addonId === "bio-phrase-detection";
  const isPhishingDetection = addonId === "phishing-detection";
  const isSoftbanMassban = addonId === "softban-massban";
  const isStaffNotes = addonId === "staff-notes";
  const isChannelLockdown = addonId === "channel-lockdown";
  const isBanTools = addonId === "ban-tools";
  const isStaffPerformance = addonId === "staff-performance";
  
  const isTicketNotes = addonId === "ticket-notes";
  const isTicketMembers = addonId === "ticket-add-remove";
  const isCloseAll = addonId === "close-all-tickets";
  const isPriorityFlagging = addonId === "priority-flagging";
  const isAutoCloseInactive = addonId === "auto-close-inactive";
  const isAutoRadio = addonId === "auto-radio";
  const isMusicAddon = addonId === "music-addon";
  const isStarboard = addonId === "starboard";
  const isGiveaway = addonId === "giveaway-system";
  const isRecurringMessages = addonId === "recurring-messages";
  const isRemindme = addonId === "remindme";
  const isServerStats = addonId === "server-stats-channels";
  const isPostSystem = addonId === "post-system";
  const isInviteMessage = addonId === "invite-message";
  const isCustomsCredits = addonId === "customs-credits";
  const isCustomsTickets = addonId === "customs-tickets";
  const isCustomsVerification = addonId === "customs-verification";
  const config = getAddonConfig(addonId);
  const sayBuilderRef = useRef<SayCommandBuilderHandle>(null);
  const v2BuilderRef = useRef<MessagesV2BuilderHandle>(null);
  const ticketBuilderRef = useRef<TicketPanelBuilderHandle>(null);
  const ticketEditorRef = useRef<TicketEditorHandle>(null);
  const verifyV2Ref = useRef<MessagesV2BuilderHandle>(null);
  const [verifyV2Items, setVerifyV2Items] = useState<V2Item[]>([]);
  const [verifyV2MountKey, setVerifyV2MountKey] = useState(0);
  const inviteV2Ref = useRef<MessagesV2BuilderHandle>(null);
  const inviteSayRef = useRef<SayCommandBuilderHandle>(null);
  const [inviteV2Items, setInviteV2Items] = useState<V2Item[]>([]);
  const [inviteV2MountKey, setInviteV2MountKey] = useState(0);
  // Customs "Messages" — its own V2 builder ref/state (send-only, starts empty).
  const messagesV2Ref = useRef<MessagesV2BuilderHandle>(null);
  const [messagesV2Items, setMessagesV2Items] = useState<V2Item[]>([]);
  const [messagesV2MountKey, setMessagesV2MountKey] = useState(0);
  // Customs "Verification" — the V2 builder for the Verify panel message.
  const verifyPanelV2Ref = useRef<MessagesV2BuilderHandle>(null);
  const [verifyPanelV2Items, setVerifyPanelV2Items] = useState<V2Item[]>([]);
  const [verifyPanelV2MountKey, setVerifyPanelV2MountKey] = useState(0);

  const [engineVersionFetched, setEngineVersionFetched] = useState<"v1" | "v2" | null>(null);
  useEffect(() => {
    if (!isSayCommand || !botId || engineVersionProp) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("bot_orders")
        .select("engine_version")
        .eq("id", botId)
        .maybeSingle();
      if (cancelled) return;
      setEngineVersionFetched(data?.engine_version === "v2" ? "v2" : "v1");
    })();
    return () => { cancelled = true; };
  }, [isSayCommand, botId, engineVersionProp]);
  const engineVersion: "v1" | "v2" = engineVersionProp ?? engineVersionFetched ?? "v1";


  // Map dashboard addon id → bot_config.feature name for toggleable features.
  const TOGGLE_FEATURE_MAP: Record<string, string> = {
    "verification-system": "verification",
    "advanced-logging": "advanced-logging",
    
    "anti-spam": "anti-spam",
    "anti-raid": "anti-raid",
    "phishing-detection": "phishing-link-detection",
    "nsfw-invite-scanner": "nsfw-invite-scanner",
    "moderation-history": "mod-history",
    "auto-escalating-warnings": "auto-escalate",
    "avatar-nsfw-detection": "avatar-nsfw",
    "bio-phrase-detection": "bio-phrase",
  };

  const persistEnabledFlag = async (next: boolean) => {
    const feature = TOGGLE_FEATURE_MAP[addonId];
    if (!feature || !botId) {
      console.warn("[toggle] aborting — missing feature or botId", { feature, botId });
      return;
    }
    try {
      // 1) Server-side JSONB merge: config = COALESCE(config,'{}') || {"enabled": next}
      const { error: mergeError } = await supabase.rpc("set_bot_config_enabled" as any, {
        _bot_id: botId,
        _feature: feature,
        _enabled: next,
      });
      if (mergeError) {
        toast.error(`Failed to save toggle: ${mergeError.message}`);
        return;
      }
      // 2) ALWAYS enqueue apply_config so the bot picks up the change immediately.
      const { data: cmdData, error: cmdError } = await supabase.rpc(
        "enqueue_apply_config" as any,
        { _bot_id: botId, _feature: feature },
      );
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
    onToggleEnabled?.(next);
    void persistEnabledFlag(next);
  };
  const { guild } = useActiveGuild();
  const targetServerName = guild?.guild_name ?? guild?.guild_id ?? botName;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const [ticketBuilderRemountKey, setTicketBuilderRemountKey] = useState(0);
  const setOpen = (v: boolean) => {
    // Force a full remount of TicketPanelBuilder on every open so its state is
    // guaranteed fresh from the DB (no stale draft / cached form values).
    if (v) setTicketBuilderRemountKey((k) => k + 1);
    if (onOpenChange) onOpenChange(v);
    else setInternalOpen(v);
  };
  const [appliedAt, setAppliedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Generic, untyped form state — schema-driven.
  const [values, setValues] = useState<Record<string, string | number | boolean | string[]>>({});

  // Channel lockdown embed state (separate because of nested object shape).
  type LockEmbed = { enabled: boolean; title: string; description: string; color: string };
  const defaultLockEmbed: LockEmbed = {
    enabled: true,
    title: "🔒 Channel Locked",
    description: "This channel is now locked. We'll be back shortly.",
    color: "0xED4245",
  };
  const defaultUnlockEmbed: LockEmbed = {
    enabled: true,
    title: "🔓 Channel Unlocked",
    description: "Channel unlocked — thanks for your patience.",
    color: "0x57F287",
  };
  const [lockEmbed, setLockEmbed] = useState<LockEmbed>(defaultLockEmbed);
  const [unlockEmbed, setUnlockEmbed] = useState<LockEmbed>(defaultUnlockEmbed);

  // Recurring Messages state — custom UI (array of entries + toggle + roles).
  type RecurringEntry = { channel_id: string; interval_minutes: number; message: string; ping_role_ids: string[] };
  const RECURRING_INTERVALS: { value: number; label: string }[] = [
    { value: 5, label: "5 minutes" },
    { value: 15, label: "15 minutes" },
    { value: 30, label: "30 minutes" },
    { value: 60, label: "1 hour" },
    { value: 120, label: "2 hours" },
    { value: 360, label: "6 hours" },
    { value: 720, label: "12 hours" },
    { value: 1440, label: "1 day" },
    { value: 10080, label: "1 week" },
  ];
  const [recurringMessages, setRecurringMessages] = useState<RecurringEntry[]>([]);
  const [recurringDeletePrevious, setRecurringDeletePrevious] = useState(false);
  const [recurringAllowedRoles, setRecurringAllowedRoles] = useState<string[]>([]);

  // Giveaway System — custom form state
  const [giveawayHostRoles, setGiveawayHostRoles] = useState<string[]>([]);
  const [giveawayChannelId, setGiveawayChannelId] = useState("");
  const [giveawayDefaultDuration, setGiveawayDefaultDuration] = useState("1d");
  const [giveawayEntryEmoji, setGiveawayEntryEmoji] = useState("🎉");
  const [giveawayDefaultWinners, setGiveawayDefaultWinners] = useState(1);
  const [giveawayEmbedTitle, setGiveawayEmbedTitle] = useState("🎉 Giveaway!");
  const [giveawayEmbedDescription, setGiveawayEmbedDescription] = useState(
    "React with {emoji} to enter!\n\n**Prize:** {prize}\n**Winners:** {winners}\n**Ends:** {ends}",
  );
  const [giveawayEmbedColor, setGiveawayEmbedColor] = useState("0x5865F2");

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
        log_channel_id: cfg.log_channel_id ?? "",
        role_id: cfg.role_id ?? "",
        message: cfg.message ?? prev.message ?? "",
        button_label: cfg.button_label ?? prev.button_label ?? "Verify",
        min_account_age_days: String(cfg.min_account_age_days ?? "0"),
        embed_author: cfg.author ?? cfg.embed_author ?? "",
        embed_title: cfg.title ?? cfg.embed_title ?? "",
        embed_footer: cfg.footer ?? cfg.embed_footer ?? "",
        embed_color: cfg.embed_color ?? "#5865f2",
        verification_type: cfg.verification_type ?? "one_click",
        captcha_length: cfg.captcha_length ?? 6,
        captcha_difficulty: cfg.captcha_difficulty ?? "medium",
        web_captcha_provider: cfg.web_captcha_provider ?? "hcaptcha",
        web_captcha_site_key: cfg.web_captcha_site_key ?? "",
        // Advanced security
        rate_limit_enabled: !!cfg.rate_limit_enabled,
        rate_limit_max_attempts: cfg.rate_limit_max_attempts ?? 3,
        rate_limit_lockout_minutes: cfg.rate_limit_lockout_minutes ?? 10,
        phone_verified_required: !!cfg.phone_verified_required,
        honeypot_enabled: !!cfg.honeypot_enabled,
        honeypot_flag_under_days: cfg.honeypot_flag_under_days ?? 7,
        honeypot_ping_roles: Array.isArray(cfg.honeypot_ping_roles)
          ? cfg.honeypot_ping_roles.map(String)
          : [],
        suspicious_join_enabled: !!cfg.suspicious_join_enabled,
        suspicious_join_max_per_minute: cfg.suspicious_join_max_per_minute ?? 5,
        vpn_block_enabled: !!cfg.vpn_block_enabled,
        vpn_block_iphub_key: cfg.vpn_block_iphub_key ?? "",
      }));
      const components = Array.isArray((cfg as any).components)
        ? ((cfg as any).components as V2Item[])
        : (cfg as any).message_v2 && Array.isArray((cfg as any).message_v2.components)
          ? ((cfg as any).message_v2.components as V2Item[])
          : [];
      setVerifyV2Items(components);
      setVerifyV2MountKey((k) => k + 1);
      setAppliedAt((data as any).applied_at ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [isVerification, open, botId]);

  // Load existing invite-message config from bot_config when dialog opens.
  useEffect(() => {
    if (!isInviteMessage || !open || !botId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("bot_config")
        .select("config, applied_at")
        .eq("bot_id", botId)
        .eq("feature", "invite")
        .maybeSingle();
      if (cancelled || !data) return;
      const cfg = (data.config ?? {}) as Record<string, any>;
      setValues((prev) => ({
        ...prev,
        channel_id: cfg.channel_id ?? "",
      }));
      const components = Array.isArray((cfg as any).components)
        ? ((cfg as any).components as V2Item[])
        : [];
      setInviteV2Items(components);
      setInviteV2MountKey((k) => k + 1);
      setAppliedAt((data as any).applied_at ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [isInviteMessage, open, botId]);

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
        exemptRoles: Array.isArray(cfg.exempt_role_ids)
          ? cfg.exempt_role_ids.map(String)
          : [],
        stripExemptRoles: Array.isArray(cfg.strip_exempt_role_ids)
          ? cfg.strip_exempt_role_ids.map(String)
          : [],
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
        exempt_role_ids: Array.isArray(values.exemptRoles)
          ? (values.exemptRoles as any[]).map(String).filter(Boolean)
          : [],
        strip_exempt_role_ids: Array.isArray(values.stripExemptRoles)
          ? (values.stripExemptRoles as any[]).map(String).filter(Boolean)
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

  // Load existing auto-role config when dialog opens.
  useEffect(() => {
    if (!isAutoRole || !open || !botId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("bot_config")
        .select("config, applied_at")
        .eq("bot_id", botId)
        .eq("feature", "auto-role")
        .maybeSingle();
      if (cancelled || !data) return;
      const cfg = (data.config ?? {}) as Record<string, any>;
      const roles = Array.isArray(cfg.role_ids)
        ? cfg.role_ids.map(String)
        : [];
      setValues((prev) => ({
        ...prev,
        roles,
        skipBots: cfg.skip_bots ?? true,
      }));
      setAppliedAt((data as any).applied_at ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [isAutoRole, open, botId]);

  const saveAutoRole = async () => {
    if (!botId) {
      toast.error("Missing bot id.");
      return;
    }
    setSaving(true);
    const payload = {
      bot_id: botId,
      feature: "auto-role",
      config: {
        role_ids: Array.isArray(values.roles)
          ? (values.roles as string[]).filter(Boolean)
          : [],
        skip_bots: !!values.skipBots,
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
      _feature: "auto-role",
    });
    const cmdResult = cmdData as { ok?: boolean; error?: string } | null;
    if (cmdError) {
      toast.warning(`Saved, but failed to notify bot: ${cmdError.message}`);
    } else if (cmdResult && cmdResult.ok === false) {
      toast.warning(`Saved, but failed to notify bot: ${cmdResult.error ?? "unknown error"}`);
    } else {
      toast.success("Auto Role settings saved & applied");
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
    const liveV2 = verifyV2Ref.current?.getItems() ?? verifyV2Items;
    const v2Components = normalizeV2Items(liveV2 ?? []);
    setSaving(true);
    const payload = {
      bot_id: botId,
      feature: "verification",
      config: {
        channel_id: String(values.channel_id ?? ""),
        log_channel_id: String(values.log_channel_id ?? ""),
        role_id: String(values.role_id ?? ""),
        message: String(values.message ?? ""),
        button_label: String(values.button_label ?? "Verify"),
        min_account_age_days: Number(values.min_account_age_days ?? 0),
        author: String(values.embed_author ?? ""),
        title: String(values.embed_title ?? ""),
        footer: String(values.embed_footer ?? ""),
        embed_color: String(values.embed_color ?? "#5865f2"),
        verification_type: String(values.verification_type ?? "one_click"),
        captcha_length: Number(values.captcha_length ?? 6),
        captcha_difficulty: String(values.captcha_difficulty ?? "medium"),
        web_captcha_provider: String(values.web_captcha_provider ?? "hcaptcha"),
        web_captcha_site_key: String(values.web_captcha_site_key ?? ""),
        // Advanced security
        rate_limit_enabled: !!values.rate_limit_enabled,
        rate_limit_max_attempts: Number(values.rate_limit_max_attempts ?? 3),
        rate_limit_lockout_minutes: Number(values.rate_limit_lockout_minutes ?? 10),
        phone_verified_required: !!values.phone_verified_required,
        honeypot_enabled: !!values.honeypot_enabled,
        honeypot_flag_under_days: Number(values.honeypot_flag_under_days ?? 7),
        honeypot_ping_roles: Array.isArray(values.honeypot_ping_roles)
          ? (values.honeypot_ping_roles as string[]).filter(Boolean)
          : [],
        suspicious_join_enabled: !!values.suspicious_join_enabled,
        suspicious_join_max_per_minute: Number(values.suspicious_join_max_per_minute ?? 5),
        vpn_block_enabled: !!values.vpn_block_enabled,
        vpn_block_iphub_key: String(values.vpn_block_iphub_key ?? ""),
        components: v2Components,
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

  const saveInviteMessage = async () => {
    if (!botId) {
      toast.error("Missing bot id.");
      return;
    }
    const liveV2 = inviteV2Ref.current?.getItems() ?? inviteV2Items;
    const v2Components = normalizeV2Items(liveV2 ?? []);
    setSaving(true);
    const payload = {
      bot_id: botId,
      feature: "invite",
      config: {
        channel_id: String(values.channel_id ?? ""),
        components: v2Components,
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
      _feature: "invite",
    });
    const cmdResult = cmdData as { ok?: boolean; error?: string } | null;
    if (cmdError) {
      toast.warning(`Saved, but failed to notify bot: ${cmdError.message}`);
    } else if (cmdResult && cmdResult.ok === false) {
      toast.warning(`Saved, but failed to notify bot: ${cmdResult.error ?? "unknown error"}`);
    } else {
      toast.success("Invite message saved & applied");
    }
    setOpen(false);
  };

  // ---------- customs: messages (send-to-channel) ----------
  // Start each open with an empty composer (this is a "send now", not a saved
  // template) and remount the builder so no stale draft carries over.
  useEffect(() => {
    if (!isCustomsMessages || !open) return;
    setMessagesV2Items([]);
    setMessagesV2MountKey((k) => k + 1);
  }, [isCustomsMessages, open]);

  const sendCustomsMessages = async () => {
    if (!botId) return toast.error("Missing bot id.");
    if (!values.channel_id) return toast.error("Pick a channel to post in.");
    const liveV2 = messagesV2Ref.current?.getItems() ?? messagesV2Items;
    const components_v2 = normalizeV2Items(liveV2 ?? []);
    if (!components_v2 || components_v2.length === 0) {
      return toast.error("Add at least one component first.");
    }
    setSaving(true);
    const { data, error } = await supabase.rpc("enqueue_post_message" as any, {
      _bot_id: botId,
      _payload: { channel_id: String(values.channel_id), components_v2 } as any,
    });
    setSaving(false);
    if (error) return toast.error(`Failed to send: ${error.message}`);
    const result = data as { ok?: boolean; error?: string } | null;
    if (!result?.ok) return toast.error(result?.error || "Could not queue the message.");
    toast.success("Message queued — your bot will post it shortly.");
    setOpen(false);
  };

  // ---------- customs: credits ----------
  useEffect(() => {
    if (!isCustomsCredits || !open || !botId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("bot_config")
        .select("config, applied_at")
        .eq("bot_id", botId)
        .eq("feature", "credits")
        .maybeSingle();
      if (cancelled || !data) return;
      const cfg = (data.config ?? {}) as Record<string, any>;
      setValues((prev) => ({
        ...prev,
        manager_role_ids: Array.isArray(cfg.manager_role_ids) ? cfg.manager_role_ids.map(String) : [],
        currency_name: cfg.currency_name ?? "credits",
        log_channel_id: cfg.log_channel_id ? String(cfg.log_channel_id) : "",
      }));
      setAppliedAt((data as any).applied_at ?? null);
    })();
    return () => { cancelled = true; };
  }, [isCustomsCredits, open, botId]);

  const saveCustomsCredits = async () => {
    if (!botId) return toast.error("Missing bot id.");
    setSaving(true);
    const payload = {
      bot_id: botId,
      feature: "credits",
      config: {
        manager_role_ids: Array.isArray(values.manager_role_ids) ? (values.manager_role_ids as string[]).map(String) : [],
        currency_name: String(values.currency_name ?? "credits") || "credits",
        log_channel_id: values.log_channel_id ? String(values.log_channel_id) : null,
      },
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("bot_config").upsert(payload, { onConflict: "bot_id,feature" });
    setSaving(false);
    if (error) return toast.error(`Save failed: ${error.message}`);
    const { data: cmdData, error: cmdError } = await supabase.rpc("enqueue_apply_config" as any, {
      _bot_id: botId, _feature: "credits",
    });
    const cmdResult = cmdData as { ok?: boolean; error?: string } | null;
    if (cmdError) toast.warning(`Saved, but failed to notify bot: ${cmdError.message}`);
    else if (cmdResult && cmdResult.ok === false) toast.warning(`Saved, but failed to notify bot: ${cmdResult.error ?? "unknown error"}`);
    else toast.success("Credits saved & applied");
    setOpen(false);
  };

  // ---------- customs: verification (Roblox OAuth) ----------
  useEffect(() => {
    if (!isCustomsVerification || !open || !botId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("bot_config")
        .select("config, applied_at")
        .eq("bot_id", botId)
        .eq("feature", "roblox-verify")
        .maybeSingle();
      if (cancelled || !data) return;
      const cfg = (data.config ?? {}) as Record<string, any>;
      setValues((prev) => ({
        ...prev,
        channel_id: cfg.channel_id ? String(cfg.channel_id) : "",
        verified_role_id: cfg.verified_role_id ? String(cfg.verified_role_id) : "",
        set_nickname: cfg.set_nickname ?? true,
        log_channel_id: cfg.log_channel_id ? String(cfg.log_channel_id) : "",
        roblox_client_id: cfg.roblox_client_id ?? "",
        roblox_client_secret: cfg.roblox_client_secret ?? "",
      }));
      setVerifyPanelV2Items(Array.isArray(cfg.components) ? (cfg.components as V2Item[]) : []);
      setVerifyPanelV2MountKey((k) => k + 1);
      setAppliedAt((data as any).applied_at ?? null);
    })();
    return () => { cancelled = true; };
  }, [isCustomsVerification, open, botId]);

  const saveCustomsVerification = async () => {
    if (!botId) return toast.error("Missing bot id.");
    setSaving(true);
    const payload = {
      bot_id: botId,
      feature: "roblox-verify",
      config: {
        channel_id: values.channel_id ? String(values.channel_id) : null,
        verified_role_id: values.verified_role_id ? String(values.verified_role_id) : null,
        set_nickname: values.set_nickname ?? true,
        log_channel_id: values.log_channel_id ? String(values.log_channel_id) : null,
        roblox_client_id: String(values.roblox_client_id ?? "").trim(),
        roblox_client_secret: String(values.roblox_client_secret ?? "").trim(),
        components: normalizeV2Items(verifyPanelV2Ref.current?.getItems() ?? verifyPanelV2Items ?? []),
      },
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("bot_config").upsert(payload, { onConflict: "bot_id,feature" });
    setSaving(false);
    if (error) return toast.error(`Save failed: ${error.message}`);
    const { data: cmdData, error: cmdError } = await supabase.rpc("enqueue_apply_config" as any, {
      _bot_id: botId, _feature: "roblox-verify",
    });
    const cmdResult = cmdData as { ok?: boolean; error?: string } | null;
    if (cmdError) toast.warning(`Saved, but failed to notify bot: ${cmdError.message}`);
    else if (cmdResult && cmdResult.ok === false) toast.warning(`Saved, but failed to notify bot: ${cmdResult.error ?? "unknown error"}`);
    else toast.success("Verification saved & applied");
    setOpen(false);
  };

  // ---------- customs: tickets ----------
  useEffect(() => {
    if (!isCustomsTickets || !open || !botId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("bot_config")
        .select("config, applied_at")
        .eq("bot_id", botId)
        .eq("feature", "tickets")
        .maybeSingle();
      if (cancelled || !data) return;
      const cfg = (data.config ?? {}) as Record<string, any>;
      setValues((prev) => ({
        ...prev,
        category_id: cfg.category_id ? String(cfg.category_id) : "",
        support_role_ids: Array.isArray(cfg.support_role_ids) ? cfg.support_role_ids.map(String) : [],
        log_channel_id: cfg.log_channel_id ? String(cfg.log_channel_id) : "",
        open_message: cfg.open_message ?? "",
        ping_support: cfg.ping_support ?? true,
        one_per_user: cfg.one_per_user ?? true,
      }));
      setAppliedAt((data as any).applied_at ?? null);
    })();
    return () => { cancelled = true; };
  }, [isCustomsTickets, open, botId]);

  const saveCustomsTickets = async () => {
    if (!botId) return toast.error("Missing bot id.");
    setSaving(true);
    const payload = {
      bot_id: botId,
      feature: "tickets",
      config: {
        category_id: values.category_id ? String(values.category_id) : null,
        support_role_ids: Array.isArray(values.support_role_ids) ? (values.support_role_ids as string[]).map(String) : [],
        log_channel_id: values.log_channel_id ? String(values.log_channel_id) : null,
        open_message: values.open_message ? String(values.open_message) : "",
        ping_support: values.ping_support ?? true,
        one_per_user: values.one_per_user ?? true,
      },
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("bot_config").upsert(payload, { onConflict: "bot_id,feature" });
    setSaving(false);
    if (error) return toast.error(`Save failed: ${error.message}`);
    const { data: cmdData, error: cmdError } = await supabase.rpc("enqueue_apply_config" as any, {
      _bot_id: botId, _feature: "tickets",
    });
    const cmdResult = cmdData as { ok?: boolean; error?: string } | null;
    if (cmdError) toast.warning(`Saved, but failed to notify bot: ${cmdError.message}`);
    else if (cmdResult && cmdResult.ok === false) toast.warning(`Saved, but failed to notify bot: ${cmdResult.error ?? "unknown error"}`);
    else toast.success("Tickets saved & applied");
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
        alertRole: cfg.alert_role_id ?? "",
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

  // Load existing phishing-detection config when dialog opens.
  useEffect(() => {
    if (!isPhishingDetection || !open || !botId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("bot_config")
        .select("config, applied_at")
        .eq("bot_id", botId)
        .eq("feature", "phishing-link-detection")
        .maybeSingle();
      if (cancelled || !data) return;
      const cfg = (data.config ?? {}) as Record<string, any>;
      setValues((prev) => ({
        ...prev,
        action: cfg.action ?? "delete",
        logChannel: cfg.log_channel_id ?? "",
        alertRole: cfg.alert_role_id ?? "",
        extraDomains: Array.isArray(cfg.extra_domains)
          ? cfg.extra_domains.join("\n")
          : String(cfg.extra_domains ?? ""),
        scanEdits: cfg.scan_edits ?? false,
      }));
      setAppliedAt((data as any).applied_at ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [isPhishingDetection, open, botId]);

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
        alert_role_id: values.alertRole ? String(values.alertRole) : null,
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

  const savePhishingDetection = async () => {
    if (!botId) {
      toast.error("Missing bot id.");
      return;
    }
    setSaving(true);
    const extraDomainsText = String(values.extraDomains ?? "");
    const extraDomainsArr = extraDomainsText
      .split("\n")
      .map((d) => d.trim())
      .filter(Boolean);
    const payload = {
      bot_id: botId,
      feature: "phishing-link-detection",
      config: {
        action: String(values.action ?? "delete"),
        log_channel_id: values.logChannel ? String(values.logChannel) : null,
        alert_role_id: values.alertRole ? String(values.alertRole) : null,
        extra_domains: extraDomainsArr,
        scan_edits: !!values.scanEdits,
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
      _feature: "phishing-link-detection",
    });
    const cmdResult = cmdData as { ok?: boolean; error?: string } | null;
    if (cmdError) {
      toast.warning(`Saved, but failed to notify bot: ${cmdError.message}`);
    } else if (cmdResult && cmdResult.ok === false) {
      toast.warning(`Saved, but failed to notify bot: ${cmdResult.error ?? "unknown error"}`);
    } else {
      toast.success("Phishing Link Detection settings saved & applied");
    }
    setOpen(false);
  };

  // ---------- mod-history ----------
  useEffect(() => {
    if (!isModHistory || !open || !botId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("bot_config")
        .select("config, applied_at")
        .eq("bot_id", botId)
        .eq("feature", "mod-history")
        .maybeSingle();
      if (cancelled || !data) return;
      const cfg = (data.config ?? {}) as Record<string, any>;
      const viewerRoles = Array.isArray(cfg.viewer_role_ids)
        ? cfg.viewer_role_ids.map(String)
        : [];
      setValues((prev) => ({
        ...prev,
        enabled: cfg.enabled ?? true,
        viewerRole: viewerRoles,
        includeExpired: cfg.include_expired ?? false,
        retentionDays: Number(cfg.retention_days ?? 0),
      }));
      setAppliedAt((data as any).applied_at ?? null);
    })();
    return () => { cancelled = true; };
  }, [isModHistory, open, botId]);

  const saveModHistory = async () => {
    if (!botId) return toast.error("Missing bot id.");
    setSaving(true);
    const payload = {
      bot_id: botId,
      feature: "mod-history",
      config: {
        enabled: enabled,
        viewer_role_ids: Array.isArray(values.viewerRole)
          ? (values.viewerRole as string[]).filter(Boolean)
          : [],
        include_expired: !!values.includeExpired,
        retention_days: Number(values.retentionDays ?? 0),
      },
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("bot_config")
      .upsert(payload, { onConflict: "bot_id,feature" });
    setSaving(false);
    if (error) return toast.error(`Save failed: ${error.message}`);
    const { data: cmdData, error: cmdError } = await supabase.rpc("enqueue_apply_config" as any, {
      _bot_id: botId, _feature: "mod-history",
    });
    const cmdResult = cmdData as { ok?: boolean; error?: string } | null;
    if (cmdError) toast.warning(`Saved, but failed to notify bot: ${cmdError.message}`);
    else if (cmdResult && cmdResult.ok === false) toast.warning(`Saved, but failed to notify bot: ${cmdResult.error ?? "unknown error"}`);
    else toast.success("Moderation History settings saved & applied");
    setOpen(false);
  };

  // ---------- softban-massban ----------
  useEffect(() => {
    if (!isSoftbanMassban || !open || !botId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("bot_config")
        .select("config, applied_at")
        .eq("bot_id", botId)
        .eq("feature", "softban-massban")
        .maybeSingle();
      if (cancelled || !data) return;
      const cfg = (data.config ?? {}) as Record<string, any>;
      const softbanRoles = Array.isArray(cfg.softban_role_ids)
        ? cfg.softban_role_ids.map(String)
        : [];
      const massbanRoles = Array.isArray(cfg.massban_role_ids)
        ? cfg.massban_role_ids.map(String)
        : [];
      setValues((prev) => ({
        ...prev,
        softbanRole: softbanRoles,
        massbanRole: massbanRoles,
        logChannel: cfg.log_channel_id ?? "",
        softbanDeleteDays: Number(cfg.softban_delete_days ?? 1),
        requireReason: cfg.require_reason ?? true,
      }));
      setAppliedAt((data as any).applied_at ?? null);
    })();
    return () => { cancelled = true; };
  }, [isSoftbanMassban, open, botId]);

  const saveSoftbanMassban = async () => {
    if (!botId) return toast.error("Missing bot id.");
    setSaving(true);
    const payload = {
      bot_id: botId,
      feature: "softban-massban",
      config: {
        softban_role_ids: Array.isArray(values.softbanRole)
          ? (values.softbanRole as string[]).filter(Boolean)
          : [],
        massban_role_ids: Array.isArray(values.massbanRole)
          ? (values.massbanRole as string[]).filter(Boolean)
          : [],
        log_channel_id: values.logChannel ? String(values.logChannel) : null,
        softban_delete_days: Number(values.softbanDeleteDays ?? 1),
        require_reason: !!values.requireReason,
      },
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("bot_config")
      .upsert(payload, { onConflict: "bot_id,feature" });
    setSaving(false);
    if (error) return toast.error(`Save failed: ${error.message}`);
    const { data: cmdData, error: cmdError } = await supabase.rpc("enqueue_apply_config" as any, {
      _bot_id: botId, _feature: "softban-massban",
    });
    const cmdResult = cmdData as { ok?: boolean; error?: string } | null;
    if (cmdError) toast.warning(`Saved, but failed to notify bot: ${cmdError.message}`);
    else if (cmdResult && cmdResult.ok === false) toast.warning(`Saved, but failed to notify bot: ${cmdResult.error ?? "unknown error"}`);
    else toast.success("Softban / Massban settings saved & applied");
    setOpen(false);
  };

  // ---------- auto-escalate ----------
  const MUTE_DURATION_TO_MIN: Record<string, number> = { "10m": 10, "1h": 60, "6h": 360, "1d": 1440 };
  useEffect(() => {
    if (!isAutoEscalate || !open || !botId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("bot_config")
        .select("config, applied_at")
        .eq("bot_id", botId)
        .eq("feature", "auto-escalate")
        .maybeSingle();
      if (cancelled || !data) return;
      const cfg = (data.config ?? {}) as Record<string, any>;
      const minutes = Number(cfg.mute_duration_minutes ?? 60);
      const muteStr = minutes === 10 ? "10m" : minutes === 360 ? "6h" : minutes === 1440 ? "1d" : "1h";
      setValues((prev) => ({
        ...prev,
        muteAt: Number(cfg.warn_threshold_mute ?? 3),
        banAt: Number(cfg.warn_threshold_ban ?? 7),
        muteDuration: muteStr,
      }));
      setAppliedAt((data as any).applied_at ?? null);
    })();
    return () => { cancelled = true; };
  }, [isAutoEscalate, open, botId]);

  const saveAutoEscalate = async () => {
    if (!botId) return toast.error("Missing bot id.");
    setSaving(true);
    const muteStr = String(values.muteDuration ?? "1h");
    const payload = {
      bot_id: botId,
      feature: "auto-escalate",
      config: {
        enabled: enabled,
        warn_threshold_mute: Number(values.muteAt ?? 3),
        warn_threshold_ban: Number(values.banAt ?? 7),
        mute_duration_minutes: MUTE_DURATION_TO_MIN[muteStr] ?? 60,
      },
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("bot_config").upsert(payload, { onConflict: "bot_id,feature" });
    setSaving(false);
    if (error) return toast.error(`Save failed: ${error.message}`);
    const { data: cmdData, error: cmdError } = await supabase.rpc("enqueue_apply_config" as any, {
      _bot_id: botId, _feature: "auto-escalate",
    });
    const cmdResult = cmdData as { ok?: boolean; error?: string } | null;
    if (cmdError) toast.warning(`Saved, but failed to notify bot: ${cmdError.message}`);
    else if (cmdResult && cmdResult.ok === false) toast.warning(`Saved, but failed to notify bot: ${cmdResult.error ?? "unknown error"}`);
    else toast.success("Auto-Escalating Warnings saved & applied");
    setOpen(false);
  };

  // ---------- avatar-nsfw ----------
  useEffect(() => {
    if (!isAvatarNsfw || !open || !botId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("bot_config")
        .select("config, applied_at")
        .eq("bot_id", botId)
        .eq("feature", "avatar-nsfw")
        .maybeSingle();
      if (cancelled || !data) return;
      const cfg = (data.config ?? {}) as Record<string, any>;
      setValues((prev) => ({
        ...prev,
        action: cfg.action ?? "delete",
        channel: cfg.log_channel_id ?? "",
      }));
      setAppliedAt((data as any).applied_at ?? null);
    })();
    return () => { cancelled = true; };
  }, [isAvatarNsfw, open, botId]);

  const saveAvatarNsfw = async () => {
    if (!botId) return toast.error("Missing bot id.");
    setSaving(true);
    const payload = {
      bot_id: botId,
      feature: "avatar-nsfw",
      config: {
        enabled: enabled,
        action: String(values.action ?? "delete"),
        log_channel_id: values.channel ? String(values.channel) : null,
      },
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("bot_config").upsert(payload, { onConflict: "bot_id,feature" });
    setSaving(false);
    if (error) return toast.error(`Save failed: ${error.message}`);
    const { data: cmdData, error: cmdError } = await supabase.rpc("enqueue_apply_config" as any, {
      _bot_id: botId, _feature: "avatar-nsfw",
    });
    const cmdResult = cmdData as { ok?: boolean; error?: string } | null;
    if (cmdError) toast.warning(`Saved, but failed to notify bot: ${cmdError.message}`);
    else if (cmdResult && cmdResult.ok === false) toast.warning(`Saved, but failed to notify bot: ${cmdResult.error ?? "unknown error"}`);
    else toast.success("Avatar NSFW Detection saved & applied");
    setOpen(false);
  };

  // ---------- bio-phrase ----------
  useEffect(() => {
    if (!isBioPhrase || !open || !botId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("bot_config")
        .select("config, applied_at")
        .eq("bot_id", botId)
        .eq("feature", "bio-phrase")
        .maybeSingle();
      if (cancelled || !data) return;
      const cfg = (data.config ?? {}) as Record<string, any>;
      const phrasesArr = Array.isArray(cfg.phrases) ? cfg.phrases : [];
      setValues((prev) => ({
        ...prev,
        channel: cfg.log_channel_id ?? "",
        phrases: phrasesArr.join("\n"),
        action: cfg.action ?? "delete",
        strikeLimit: Number(cfg.strike_limit ?? 3),
        muteDurationMinutes: Number(cfg.mute_duration_minutes ?? 60),
      }));
      setAppliedAt((data as any).applied_at ?? null);
    })();
    return () => { cancelled = true; };
  }, [isBioPhrase, open, botId]);

  const saveBioPhrase = async () => {
    if (!botId) {
      console.warn("[bio-phrase] aborting — missing botId");
      return toast.error("Missing bot id.");
    }
    setSaving(true);
    try {
      const phrasesText = String(values.phrases ?? "");
      const phrasesArr = phrasesText.split("\n").map((p) => p.trim()).filter(Boolean);
      const payload = {
        bot_id: botId,
        feature: "bio-phrase",
        config: {
          enabled: enabled,
          phrases: phrasesArr,
          strike_limit: Number(values.strikeLimit ?? 3),
          mute_duration_minutes: Number(values.muteDurationMinutes ?? 60),
          action: String(values.action ?? "delete"),
          log_channel_id: values.channel ? String(values.channel) : null,
        },
        updated_at: new Date().toISOString(),
      };
      const { data: upsertData, error } = await supabase
        .from("bot_config")
        .upsert(payload, { onConflict: "bot_id,feature" })
        .select();
      if (error) {
        toast.error(`Save failed: ${error.message}`);
        return;
      }
      const { data: cmdData, error: cmdError } = await supabase.rpc("enqueue_apply_config" as any, {
        _bot_id: botId, _feature: "bio-phrase",
      });
      const cmdResult = cmdData as { ok?: boolean; error?: string } | null;
      if (cmdError) toast.warning(`Saved, but failed to notify bot: ${cmdError.message}`);
      else if (cmdResult && cmdResult.ok === false) toast.warning(`Saved, but failed to notify bot: ${cmdResult.error ?? "unknown error"}`);
      else toast.success("Bio Phrase Detection saved & applied");
      setOpen(false);
    } catch (e) {
      console.error("[bio-phrase] saveBioPhrase threw", e);
      toast.error(`Save failed: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  // ---------- staff-notes ----------
  useEffect(() => {
    if (!isStaffNotes || !open || !botId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("bot_config")
        .select("config, applied_at")
        .eq("bot_id", botId)
        .eq("feature", "staff-notes")
        .maybeSingle();
      if (cancelled || !data) return;
      const cfg = (data.config ?? {}) as Record<string, any>;
      const allowed = Array.isArray(cfg.allowed_role_ids) ? cfg.allowed_role_ids.map(String) : [];
      setValues((prev) => ({ ...prev, allowedRoles: allowed }));
      setAppliedAt((data as any).applied_at ?? null);
    })();
    return () => { cancelled = true; };
  }, [isStaffNotes, open, botId]);

  const saveStaffNotes = async () => {
    if (!botId) return toast.error("Missing bot id.");
    setSaving(true);
    const payload = {
      bot_id: botId,
      feature: "staff-notes",
      config: {
        allowed_role_ids: Array.isArray(values.allowedRoles)
          ? (values.allowedRoles as string[]).filter(Boolean)
          : [],
      },
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("bot_config").upsert(payload, { onConflict: "bot_id,feature" });
    setSaving(false);
    if (error) return toast.error(`Save failed: ${error.message}`);
    const { data: cmdData, error: cmdError } = await supabase.rpc("enqueue_apply_config" as any, {
      _bot_id: botId, _feature: "staff-notes",
    });
    const cmdResult = cmdData as { ok?: boolean; error?: string } | null;
    if (cmdError) toast.warning(`Saved, but failed to notify bot: ${cmdError.message}`);
    else if (cmdResult && cmdResult.ok === false) toast.warning(`Saved, but failed to notify bot: ${cmdResult.error ?? "unknown error"}`);
  };

  // ---------- remindme ----------
  useEffect(() => {
    if (!isRemindme || !open || !botId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("bot_config")
        .select("config, applied_at")
        .eq("bot_id", botId)
        .eq("feature", "remindme")
        .maybeSingle();
      if (cancelled || !data) return;
      const cfg = (data.config ?? {}) as Record<string, any>;
      setValues((prev) => ({
        ...prev,
        maxPerUser: typeof cfg.max_per_user === "number" ? cfg.max_per_user : (prev.maxPerUser ?? 25),
        deliveryMethod: ["dm", "channel", "both"].includes(cfg.delivery_method) ? cfg.delivery_method : "dm",
        allowRecurring: !!cfg.allow_recurring,
        embed_color: typeof cfg.embed_color === "string" ? cfg.embed_color : "#5865f2",
        embed_title: typeof cfg.embed_title === "string" ? cfg.embed_title : "Reminder",
        footer_text: typeof cfg.footer_text === "string" ? cfg.footer_text : "",
        show_original: cfg.show_original !== false,
        ping_user: cfg.ping_user !== false,
      }));
      setAppliedAt((data as any).applied_at ?? null);
    })();
    return () => { cancelled = true; };
  }, [isRemindme, open, botId]);

  const saveRemindme = async () => {
    if (!botId) return toast.error("Missing bot id.");
    setSaving(true);
    const rawMethod = String(values.deliveryMethod ?? "dm");
    const delivery_method: "dm" | "channel" | "both" = ["dm", "channel", "both"].includes(rawMethod) ? (rawMethod as "dm" | "channel" | "both") : "dm";
    const max_per_user = Math.max(1, Number(values.maxPerUser ?? 25) || 25);
    const payload = {
      bot_id: botId,
      feature: "remindme",
      config: {
        max_per_user,
        delivery_method,
        allow_recurring: !!values.allowRecurring,
        embed_color: String(values.embed_color ?? "#5865f2"),
        embed_title: String(values.embed_title ?? "Reminder"),
        footer_text: String(values.footer_text ?? ""),
        show_original: !!values.show_original,
        ping_user: !!values.ping_user,
      },
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("bot_config").upsert(payload, { onConflict: "bot_id,feature" });
    setSaving(false);
    if (error) return toast.error(`Save failed: ${error.message}`);
    const { data: cmdData, error: cmdError } = await supabase.rpc("enqueue_apply_config" as any, {
      _bot_id: botId, _feature: "remindme",
    });
    const cmdResult = cmdData as { ok?: boolean; error?: string } | null;
    if (cmdError) toast.warning(`Saved, but failed to notify bot: ${cmdError.message}`);
    else if (cmdResult && cmdResult.ok === false) toast.warning(`Saved, but failed to notify bot: ${cmdResult.error ?? "unknown error"}`);
    else toast.success("/remindme saved & applied");
    setOpen(false);
  };

  // ---------- server-stats-channels ----------
  useEffect(() => {
    if (!isServerStats || !open || !botId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("bot_config")
        .select("config, applied_at")
        .eq("bot_id", botId)
        .eq("feature", "server-stats")
        .maybeSingle();
      if (cancelled || !data) return;
      const cfg = (data.config ?? {}) as Record<string, any>;
      setValues((prev) => ({
        ...prev,
        showTotalMembers: cfg.show_members ?? prev.showTotalMembers ?? true,
        showOnlineMembers: cfg.show_online ?? prev.showOnlineMembers ?? true,
        showBots: cfg.show_bots ?? prev.showBots ?? false,
        showBoosts: cfg.show_boosts ?? prev.showBoosts ?? true,
        format: cfg.channel_name_format ?? prev.format ?? "📊 Members: {count}",
        updateMinutes:
          typeof cfg.update_interval_minutes === "number"
            ? Math.max(10, cfg.update_interval_minutes)
            : (prev.updateMinutes ?? 10),
      }));
      setAppliedAt((data as any).applied_at ?? null);
    })();
    return () => { cancelled = true; };
  }, [isServerStats, open, botId]);

  const saveServerStats = async () => {
    if (!botId) return toast.error("Missing bot id.");
    setSaving(true);
    const payload = {
      bot_id: botId,
      feature: "server-stats",
      config: {
        show_members: !!values.showTotalMembers,
        show_online: !!values.showOnlineMembers,
        show_bots: !!values.showBots,
        show_boosts: !!values.showBoosts,
        channel_name_format: String(values.format ?? "📊 Members: {count}"),
        update_interval_minutes: Math.max(10, Number(values.updateMinutes ?? 10) || 10),
      },
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("bot_config").upsert(payload, { onConflict: "bot_id,feature" });
    setSaving(false);
    if (error) return toast.error(`Save failed: ${error.message}`);
    const { data: cmdData, error: cmdError } = await supabase.rpc("enqueue_apply_config" as any, {
      _bot_id: botId, _feature: "server-stats",
    });
    const cmdResult = cmdData as { ok?: boolean; error?: string } | null;
    if (cmdError) toast.warning(`Saved, but failed to notify bot: ${cmdError.message}`);
    else if (cmdResult && cmdResult.ok === false) toast.warning(`Saved, but failed to notify bot: ${cmdResult.error ?? "unknown error"}`);
    else toast.success("Server Stats Channels saved & applied");

    // Also enqueue a setup_stats command so the utilities bot creates the
    // channels automatically without the user running /setupstats.
    const { error: setupErr } = await supabase.functions.invoke("enqueue-setup-stats", {
      body: { botId },
    });
    if (setupErr) {
      toast.warning(`Saved, but failed to queue channel setup: ${setupErr.message}`);
    }

    setOpen(false);
  };

  useEffect(() => {
    if (!isAutoRadio || !open || !botId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("bot_config")
        .select("config, applied_at")
        .eq("bot_id", botId)
        .eq("feature", "auto-radio")
        .maybeSingle();
      if (cancelled || !data) return;
      const cfg = (data.config ?? {}) as Record<string, any>;
      setValues((prev) => ({
        ...prev,
        voice_channel_id: cfg.voice_channel_id ? String(cfg.voice_channel_id) : "",
        genre: cfg.genre ?? "lofi",
        auto_start: cfg.auto_start ?? false,
        allow_vote: cfg.allow_vote ?? false,
      }));
      setAppliedAt((data as any).applied_at ?? null);
    })();
    return () => { cancelled = true; };
  }, [isAutoRadio, open, botId]);

  const saveAutoRadio = async () => {
    if (!botId) return toast.error("Missing bot id.");
    setSaving(true);
    const payload = {
      bot_id: botId,
      feature: "auto-radio",
      config: {
        voice_channel_id: values.voice_channel_id ? String(values.voice_channel_id) : null,
        genre: String(values.genre ?? "lofi"),
        auto_start: !!values.auto_start,
        allow_vote: !!values.allow_vote,
      },
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("bot_config").upsert(payload, { onConflict: "bot_id,feature" });
    setSaving(false);
    if (error) return toast.error(`Save failed: ${error.message}`);
    const { data: cmdData, error: cmdError } = await supabase.rpc("enqueue_apply_config" as any, {
      _bot_id: botId, _feature: "auto-radio",
    });
    const cmdResult = cmdData as { ok?: boolean; error?: string } | null;
    if (cmdError) toast.warning(`Saved, but failed to notify bot: ${cmdError.message}`);
    else if (cmdResult && cmdResult.ok === false) toast.warning(`Saved, but failed to notify bot: ${cmdResult.error ?? "unknown error"}`);
    else toast.success("Auto Radio saved & applied");
    setOpen(false);
  };

  // ---------- music-addon ----------
  useEffect(() => {
    if (!isMusicAddon || !open || !botId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("bot_config")
        .select("config, applied_at")
        .eq("bot_id", botId)
        .eq("feature", "music-addon")
        .maybeSingle();
      if (cancelled || !data) return;
      const cfg = (data.config ?? {}) as Record<string, any>;
      setValues((prev) => ({
        ...prev,
        dj_role_ids: Array.isArray(cfg.dj_role_ids) ? cfg.dj_role_ids.map(String) : [],
        everyone_can_queue: cfg.everyone_can_queue ?? false,
        max_queue_length: typeof cfg.max_queue_length === "number" ? cfg.max_queue_length : 100,
        default_volume: typeof cfg.default_volume === "number" ? cfg.default_volume : 50,
        auto_leave: cfg.auto_leave ?? false,
        now_playing_v2: cfg.now_playing_v2 ?? false,
      }));
      setAppliedAt((data as any).applied_at ?? null);
    })();
    return () => { cancelled = true; };
  }, [isMusicAddon, open, botId]);

  const saveMusicAddon = async () => {
    if (!botId) return toast.error("Missing bot id.");
    setSaving(true);
    const payload = {
      bot_id: botId,
      feature: "music-addon",
      config: {
        dj_role_ids: Array.isArray(values.dj_role_ids) ? values.dj_role_ids.map(String) : [],
        everyone_can_queue: !!values.everyone_can_queue,
        max_queue_length: Number(values.max_queue_length ?? 100),
        default_volume: Number(values.default_volume ?? 50),
        auto_leave: !!values.auto_leave,
        now_playing_v2: !!values.now_playing_v2,
      },
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("bot_config").upsert(payload, { onConflict: "bot_id,feature" });
    setSaving(false);
    if (error) return toast.error(`Save failed: ${error.message}`);
    const { data: cmdData, error: cmdError } = await supabase.rpc("enqueue_apply_config" as any, {
      _bot_id: botId, _feature: "music-addon",
    });
    const cmdResult = cmdData as { ok?: boolean; error?: string } | null;
    if (cmdError) toast.warning(`Saved, but failed to notify bot: ${cmdError.message}`);
    else if (cmdResult && cmdResult.ok === false) toast.warning(`Saved, but failed to notify bot: ${cmdResult.error ?? "unknown error"}`);
    else toast.success("Music settings saved & applied");
    setOpen(false);
  };

  useEffect(() => {
    if (!isGiveaway || !open || !botId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("bot_config")
        .select("config, applied_at")
        .eq("bot_id", botId)
        .eq("feature", "giveaway")
        .maybeSingle();
      if (cancelled || !data) return;
      const cfg = (data.config ?? {}) as Record<string, any>;
      const hostRoles = Array.isArray(cfg.host_role_ids)
        ? cfg.host_role_ids.map(String)
        : cfg.host_role_ids
          ? [String(cfg.host_role_ids)]
          : [];
      setGiveawayHostRoles(hostRoles);
      setGiveawayChannelId(cfg.default_channel_id ? String(cfg.default_channel_id) : "");
      setGiveawayDefaultDuration(
        typeof cfg.default_duration === "string" && cfg.default_duration
          ? cfg.default_duration
          : "1d",
      );
      setGiveawayEntryEmoji(typeof cfg.entry_emoji === "string" && cfg.entry_emoji ? cfg.entry_emoji : "🎉");
      setGiveawayDefaultWinners(Math.max(1, Number(cfg.default_winners ?? 1)));
      if (typeof cfg.embed_title === "string") setGiveawayEmbedTitle(cfg.embed_title);
      if (typeof cfg.embed_description === "string") setGiveawayEmbedDescription(cfg.embed_description);
      if (typeof cfg.embed_color === "string" && cfg.embed_color) setGiveawayEmbedColor(cfg.embed_color);
      setAppliedAt((data as any).applied_at ?? null);
    })();
    return () => { cancelled = true; };
  }, [isGiveaway, open, botId]);

  const saveGiveaway = async () => {
    if (!botId) return toast.error("Missing bot id.");
    setSaving(true);
    const payload = {
      bot_id: botId,
      feature: "giveaway",
      config: {
        host_role_ids: giveawayHostRoles.filter(Boolean),
        default_channel_id: giveawayChannelId || null,
        default_duration: giveawayDefaultDuration.trim() || "1d",
        entry_emoji: giveawayEntryEmoji || "🎉",
        default_winners: Math.max(1, giveawayDefaultWinners),
        embed_title: giveawayEmbedTitle,
        embed_description: giveawayEmbedDescription,
        embed_color: giveawayEmbedColor,
      },
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("bot_config").upsert(payload, { onConflict: "bot_id,feature" });
    setSaving(false);
    if (error) return toast.error(`Save failed: ${error.message}`);
    const { data: cmdData, error: cmdError } = await supabase.rpc("enqueue_apply_config" as any, {
      _bot_id: botId, _feature: "giveaway",
    });
    const cmdResult = cmdData as { ok?: boolean; error?: string } | null;
    if (cmdError) toast.warning(`Saved, but failed to notify bot: ${cmdError.message}`);
    else if (cmdResult && cmdResult.ok === false) toast.warning(`Saved, but failed to notify bot: ${cmdResult.error ?? "unknown error"}`);
    else toast.success("Giveaway settings saved & applied");
    setOpen(false);
  };

  // ---------- starboard ----------
  useEffect(() => {
    if (!isStarboard || !open || !botId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("bot_config")
        .select("config, applied_at")
        .eq("bot_id", botId)
        .eq("feature", "starboard")
        .maybeSingle();
      if (cancelled || !data) return;
      const cfg = (data.config ?? {}) as Record<string, any>;
      setValues((prev) => ({
        ...prev,
        starboard_channel_id: cfg.starboard_channel_id ? String(cfg.starboard_channel_id) : "",
        showcase_channel_id: cfg.showcase_channel_id ? String(cfg.showcase_channel_id) : "",
        threshold: Number(cfg.threshold ?? 5),
        reaction_emoji: cfg.reaction_emoji ?? "⭐",
        spotlight_message: cfg.spotlight_message ?? "",
        allow_self_star: cfg.allow_self_star ?? false,
        ignore_nsfw: cfg.ignore_nsfw ?? true,
        mode: cfg.mode === "timed" ? "timed" : "threshold",
        timed_interval: cfg.timed_interval ?? "weekly",
        spotlight_ping_role_id: cfg.spotlight_ping_role_id ? String(cfg.spotlight_ping_role_id) : "",
      }));
      setAppliedAt((data as any).applied_at ?? null);
    })();
    return () => { cancelled = true; };
  }, [isStarboard, open, botId]);

  const saveStarboard = async () => {
    if (!botId) return toast.error("Missing bot id.");
    setSaving(true);
    const mode = values.mode === "timed" ? "timed" : "threshold";
    const payload = {
      bot_id: botId,
      feature: "starboard",
      config: {
        starboard_channel_id: values.starboard_channel_id ? String(values.starboard_channel_id) : null,
        showcase_channel_id: values.showcase_channel_id ? String(values.showcase_channel_id) : null,
        threshold: Number(values.threshold ?? 5),
        reaction_emoji: String(values.reaction_emoji ?? "⭐"),
        spotlight_message: values.spotlight_message ? String(values.spotlight_message) : null,
        allow_self_star: !!values.allow_self_star,
        ignore_nsfw: !!values.ignore_nsfw,
        mode,
        timed_interval: String(values.timed_interval ?? "weekly"),
        spotlight_ping_role_id: values.spotlight_ping_role_id ? String(values.spotlight_ping_role_id) : null,
      },
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("bot_config").upsert(payload, { onConflict: "bot_id,feature" });
    setSaving(false);
    if (error) return toast.error(`Save failed: ${error.message}`);
    const { data: cmdData, error: cmdError } = await supabase.rpc("enqueue_apply_config" as any, {
      _bot_id: botId, _feature: "starboard",
    });
    const cmdResult = cmdData as { ok?: boolean; error?: string } | null;
    if (cmdError) toast.warning(`Saved, but failed to notify bot: ${cmdError.message}`);
    else if (cmdResult && cmdResult.ok === false) toast.warning(`Saved, but failed to notify bot: ${cmdResult.error ?? "unknown error"}`);
    else toast.success("Starboard saved & applied");
    setOpen(false);
  };

  // ---------- recurring messages ----------
  useEffect(() => {
    if (!isRecurringMessages || !open || !botId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("bot_config")
        .select("config, applied_at")
        .eq("bot_id", botId)
        .eq("feature", "recurring-messages")
        .maybeSingle();
      if (cancelled || !data) {
        setRecurringMessages([]);
        setRecurringDeletePrevious(false);
        setRecurringAllowedRoles([]);
        return;
      }
      const cfg = (data.config ?? {}) as Record<string, any>;
      const list = Array.isArray(cfg.messages) ? cfg.messages : [];
      setRecurringMessages(
        list.map((m: any) => ({
          channel_id: m?.channel_id ? String(m.channel_id) : "",
          interval_minutes: Number(m?.interval_minutes ?? 60),
          message: typeof m?.message === "string" ? m.message : "",
          ping_role_ids: Array.isArray(m?.ping_role_ids) ? m.ping_role_ids.map(String) : [],
        })),
      );
      setRecurringDeletePrevious(!!cfg.delete_previous);
      setRecurringAllowedRoles(
        Array.isArray(cfg.allowed_role_ids) ? cfg.allowed_role_ids.map(String) : [],
      );
      setAppliedAt((data as any).applied_at ?? null);
    })();
    return () => { cancelled = true; };
  }, [isRecurringMessages, open, botId]);

  const saveRecurringMessages = async () => {
    if (!botId) return toast.error("Missing bot id.");
    setSaving(true);
    const payload = {
      bot_id: botId,
      feature: "recurring-messages",
      config: {
        messages: recurringMessages
          .filter((m) => m.channel_id && m.message.trim())
          .map((m) => ({
            channel_id: String(m.channel_id),
            interval_minutes: Number(m.interval_minutes) || 60,
            message: String(m.message),
            ping_role_ids: Array.isArray(m.ping_role_ids) ? m.ping_role_ids.map(String) : [],
          })),
        delete_previous: !!recurringDeletePrevious,
        allowed_role_ids: recurringAllowedRoles.map(String),
      },
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("bot_config").upsert(payload, { onConflict: "bot_id,feature" });
    setSaving(false);
    if (error) return toast.error(`Save failed: ${error.message}`);
    const { data: cmdData, error: cmdError } = await supabase.rpc("enqueue_apply_config" as any, {
      _bot_id: botId, _feature: "recurring-messages",
    });
    const cmdResult = cmdData as { ok?: boolean; error?: string } | null;
    if (cmdError) toast.warning(`Saved, but failed to notify bot: ${cmdError.message}`);
    else if (cmdResult && cmdResult.ok === false) toast.warning(`Saved, but failed to notify bot: ${cmdResult.error ?? "unknown error"}`);
    else toast.success("Recurring Messages saved & applied");
    setOpen(false);
  };

  // ---------- ticket-lifecycle-messages (V2 builder per event) ----------
  const LIFECYCLE_KEYS = [
    "claim_message",
    "priority_message",
    "close_message",
  ] as const;
  type LifecycleKey = typeof LIFECYCLE_KEYS[number];
  const LIFECYCLE_LABELS: Record<LifecycleKey, string> = {
    claim_message: "Claim message",
    priority_message: "Priority message",
    close_message: "Close message",
  };
  const lifecycleV2Ref = useRef<MessagesV2BuilderHandle>(null);
  const [lifecycleEvent, setLifecycleEvent] = useState<LifecycleKey>("claim_message");
  const [lifecycleConfigs, setLifecycleConfigs] = useState<Record<LifecycleKey, V2Item[]>>({
    claim_message: [],
    priority_message: [],
    close_message: [],
  });
  const [lifecycleMountKey, setLifecycleMountKey] = useState(0);

  useEffect(() => {
    if (!isTicketLifecycleMessages || !open || !botId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("bot_config")
        .select("config, applied_at")
        .eq("bot_id", botId)
        .eq("feature", "ticket-lifecycle-messages")
        .maybeSingle();
      if (cancelled) return;
      const cfg = ((data?.config ?? {}) as Record<string, any>) || {};
      const nextConfigs: Record<LifecycleKey, V2Item[]> = {
        claim_message: [],
        priority_message: [],
        close_message: [],
      };
      for (const k of LIFECYCLE_KEYS) {
        const entry = cfg[k];
        if (entry && entry.v2 === true && Array.isArray(entry.components)) {
          nextConfigs[k] = entry.components as V2Item[];
        }
      }
      setLifecycleConfigs(nextConfigs);
      setLifecycleEvent("claim_message");
      setLifecycleMountKey((k) => k + 1);
      setAppliedAt((data as any)?.applied_at ?? null);
    })();
    return () => { cancelled = true; };
  }, [isTicketLifecycleMessages, open, botId]);

  const captureLifecycleCurrent = () => {
    const current = lifecycleV2Ref.current?.getItems();
    if (!current) return;
    setLifecycleConfigs((prev) => ({ ...prev, [lifecycleEvent]: current }));
  };

  const switchLifecycleEvent = (next: LifecycleKey) => {
    if (next === lifecycleEvent) return;
    const current = lifecycleV2Ref.current?.getItems();
    setLifecycleConfigs((prev) => ({
      ...prev,
      [lifecycleEvent]: current ?? prev[lifecycleEvent],
    }));
    setLifecycleEvent(next);
    setLifecycleMountKey((k) => k + 1);
  };

  const saveTicketLifecycleMessages = async () => {
    if (!botId) return toast.error("Missing bot id.");
    // Snapshot the currently-edited event before serializing.
    const liveItems = lifecycleV2Ref.current?.getItems();
    const merged: Record<LifecycleKey, V2Item[]> = {
      ...lifecycleConfigs,
      [lifecycleEvent]: liveItems ?? lifecycleConfigs[lifecycleEvent],
    };
    setSaving(true);
    const config: Record<string, { v2: true; components: V2Item[] }> = {};
    for (const k of LIFECYCLE_KEYS) {
      const items = merged[k] ?? [];
      if (items.length === 0) continue;
      config[k] = { v2: true, components: normalizeV2Items(items) };
    }
    const payload = {
      bot_id: botId,
      feature: "ticket-lifecycle-messages",
      config,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("bot_config")
      .upsert(payload, { onConflict: "bot_id,feature" });
    setSaving(false);
    if (error) return toast.error(`Save failed: ${error.message}`);
    const { data: cmdData, error: cmdError } = await supabase.rpc("enqueue_apply_config" as any, {
      _bot_id: botId,
      _feature: "ticket-lifecycle-messages",
    });
    const cmdResult = cmdData as { ok?: boolean; error?: string } | null;
    if (cmdError) toast.warning(`Saved, but failed to notify bot: ${cmdError.message}`);
    else if (cmdResult && cmdResult.ok === false)
      toast.warning(`Saved, but failed to notify bot: ${cmdResult.error ?? "unknown error"}`);
    else toast.success("Ticket lifecycle messages saved & applied");
    setOpen(false);
  };



  useEffect(() => {
    if (!isTicketNotes || !open || !botId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("bot_config")
        .select("config, applied_at")
        .eq("bot_id", botId)
        .eq("feature", "ticket-notes")
        .maybeSingle();
      if (cancelled || !data) return;
      const cfg = (data.config ?? {}) as Record<string, any>;
      const allowed = Array.isArray(cfg.allowed_role_ids) ? cfg.allowed_role_ids.map(String) : [];
      setValues((prev) => ({
        ...prev,
        allowedRoleIds: allowed,
        pingStaff: cfg.ping_staff ?? false,
        includeInTranscript: cfg.include_in_transcript ?? false,
      }));
      setAppliedAt((data as any).applied_at ?? null);
    })();
    return () => { cancelled = true; };
  }, [isTicketNotes, open, botId]);

  const saveTicketNotes = async () => {
    if (!botId) return toast.error("Missing bot id.");
    setSaving(true);
    const payload = {
      bot_id: botId,
      feature: "ticket-notes",
      config: {
        allowed_role_ids: Array.isArray(values.allowedRoleIds)
          ? (values.allowedRoleIds as string[]).filter(Boolean)
          : [],
        ping_staff: !!values.pingStaff,
        include_in_transcript: !!values.includeInTranscript,
      },
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("bot_config").upsert(payload, { onConflict: "bot_id,feature" });
    setSaving(false);
    if (error) return toast.error(`Save failed: ${error.message}`);
    const { data: cmdData, error: cmdError } = await supabase.rpc("enqueue_apply_config" as any, {
      _bot_id: botId, _feature: "ticket-notes",
    });
    const cmdResult = cmdData as { ok?: boolean; error?: string } | null;
    if (cmdError) toast.warning(`Saved, but failed to notify bot: ${cmdError.message}`);
    else if (cmdResult && cmdResult.ok === false) toast.warning(`Saved, but failed to notify bot: ${cmdResult.error ?? "unknown error"}`);
    else toast.success("Ticket Notes settings saved & applied");
    setOpen(false);
  };

  // ticket-logs config now lives inside the Ticket Settings card (TicketPanelBuilder).


  // ---------- ticket-members ----------
  useEffect(() => {
    if (!isTicketMembers || !open || !botId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("bot_config")
        .select("config, applied_at")
        .eq("bot_id", botId)
        .eq("feature", "ticket-members")
        .maybeSingle();
      if (cancelled || !data) return;
      const cfg = (data.config ?? {}) as Record<string, any>;
      const allowed = Array.isArray(cfg.allowed_role_ids) ? cfg.allowed_role_ids.map(String) : [];
      setValues((prev) => ({
        ...prev,
        allowedRoleIds: allowed,
        logActions: cfg.log_actions ?? true,
        openerCanAdd: cfg.opener_can_add ?? false,
      }));
      setAppliedAt((data as any).applied_at ?? null);
    })();
    return () => { cancelled = true; };
  }, [isTicketMembers, open, botId]);

  const saveTicketMembers = async () => {
    if (!botId) return toast.error("Missing bot id.");
    setSaving(true);
    const payload = {
      bot_id: botId,
      feature: "ticket-members",
      config: {
        allowed_role_ids: Array.isArray(values.allowedRoleIds)
          ? (values.allowedRoleIds as string[]).filter(Boolean)
          : [],
        log_actions: !!values.logActions,
        opener_can_add: !!values.openerCanAdd,
      },
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("bot_config").upsert(payload, { onConflict: "bot_id,feature" });
    setSaving(false);
    if (error) return toast.error(`Save failed: ${error.message}`);
    const { data: cmdData, error: cmdError } = await supabase.rpc("enqueue_apply_config" as any, {
      _bot_id: botId, _feature: "ticket-members",
    });
    const cmdResult = cmdData as { ok?: boolean; error?: string } | null;
    if (cmdError) toast.warning(`Saved, but failed to notify bot: ${cmdError.message}`);
    else if (cmdResult && cmdResult.ok === false) toast.warning(`Saved, but failed to notify bot: ${cmdResult.error ?? "unknown error"}`);
    else toast.success("Add / Remove Members settings saved & applied");
    setOpen(false);
  };

  // ---------- close-all ----------
  useEffect(() => {
    if (!isCloseAll || !open || !botId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("bot_config")
        .select("config, applied_at")
        .eq("bot_id", botId)
        .eq("feature", "close-all")
        .maybeSingle();
      if (cancelled || !data) return;
      const cfg = (data.config ?? {}) as Record<string, any>;
      const allowed = Array.isArray(cfg.allowed_role_ids) ? cfg.allowed_role_ids.map(String) : [];
      setValues((prev) => ({
        ...prev,
        allowedRoleIds: allowed,
        requireConfirmation: cfg.require_confirmation ?? true,
        saveTranscripts: cfg.save_transcripts ?? true,
        closingMessage: cfg.closing_message ?? prev.closingMessage ?? "This ticket is being closed as part of a mass close. Reopen if needed.",
      }));
      setAppliedAt((data as any).applied_at ?? null);
    })();
    return () => { cancelled = true; };
  }, [isCloseAll, open, botId]);

  const saveCloseAll = async () => {
    if (!botId) return toast.error("Missing bot id.");
    setSaving(true);
    const payload = {
      bot_id: botId,
      feature: "close-all",
      config: {
        allowed_role_ids: Array.isArray(values.allowedRoleIds)
          ? (values.allowedRoleIds as string[]).filter(Boolean)
          : [],
        require_confirmation: !!values.requireConfirmation,
        save_transcripts: !!values.saveTranscripts,
        closing_message: String(values.closingMessage ?? ""),
      },
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("bot_config").upsert(payload, { onConflict: "bot_id,feature" });
    setSaving(false);
    if (error) return toast.error(`Save failed: ${error.message}`);
    const { data: cmdData, error: cmdError } = await supabase.rpc("enqueue_apply_config" as any, {
      _bot_id: botId, _feature: "close-all",
    });
    const cmdResult = cmdData as { ok?: boolean; error?: string } | null;
    if (cmdError) toast.warning(`Saved, but failed to notify bot: ${cmdError.message}`);
    else if (cmdResult && cmdResult.ok === false) toast.warning(`Saved, but failed to notify bot: ${cmdResult.error ?? "unknown error"}`);
    else toast.success("Close All Tickets settings saved & applied");
    setOpen(false);
  };

  // ---------- priority-flagging ----------
  useEffect(() => {
    if (!isPriorityFlagging || !open || !botId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("bot_config")
        .select("config, applied_at")
        .eq("bot_id", botId)
        .eq("feature", "priority-tickets")
        .maybeSingle();
      if (cancelled || !data) return;
      const cfg = (data.config ?? {}) as Record<string, any>;
      const setterRoles = Array.isArray(cfg.setter_role_ids) ? cfg.setter_role_ids.map(String) : [];
      const pingRoles = Array.isArray(cfg.ping_role_ids) ? cfg.ping_role_ids.map(String) : [];
      setValues((prev) => ({
        ...prev,
        setterRoleIds: setterRoles,
        pingRoleIds: pingRoles,
        urgentChannel: String(cfg.alert_channel_id ?? ""),
        colorCodeNames: cfg.color_code_names ?? false,
      }));
      setAppliedAt((data as any).applied_at ?? null);
    })();
    return () => { cancelled = true; };
  }, [isPriorityFlagging, open, botId]);

  const savePriorityFlagging = async () => {
    if (!botId) return toast.error("Missing bot id.");
    setSaving(true);
    const payload = {
      bot_id: botId,
      feature: "priority-tickets",
      config: {
        setter_role_ids: Array.isArray(values.setterRoleIds)
          ? (values.setterRoleIds as string[]).filter(Boolean)
          : [],
        ping_role_ids: Array.isArray(values.pingRoleIds)
          ? (values.pingRoleIds as string[]).filter(Boolean)
          : [],
        alert_channel_id: values.urgentChannel ? String(values.urgentChannel) : null,
        color_code_names: !!values.colorCodeNames,
      },
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("bot_config").upsert(payload, { onConflict: "bot_id,feature" });
    setSaving(false);
    if (error) return toast.error(`Save failed: ${error.message}`);
    const { data: cmdData, error: cmdError } = await supabase.rpc("enqueue_apply_config" as any, {
      _bot_id: botId, _feature: "priority-tickets",
    });
    const cmdResult = cmdData as { ok?: boolean; error?: string } | null;
    if (cmdError) toast.warning(`Saved, but failed to notify bot: ${cmdError.message}`);
    else if (cmdResult && cmdResult.ok === false) toast.warning(`Saved, but failed to notify bot: ${cmdResult.error ?? "unknown error"}`);
    else toast.success("Priority Ticket Flagging settings saved & applied");
    setOpen(false);
  };

  // ---------- auto-close-inactive ----------
  useEffect(() => {
    if (!isAutoCloseInactive || !open || !botId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("bot_config")
        .select("config, applied_at")
        .eq("bot_id", botId)
        .eq("feature", "auto-close")
        .maybeSingle();
      if (cancelled || !data) return;
      const cfg = (data.config ?? {}) as Record<string, any>;
      setValues((prev) => ({
        ...prev,
        close_after_hours: Number(cfg.close_after_hours ?? 48),
        warn_before_hours: Number(cfg.warn_before_hours ?? 12),
        embed_author: String(cfg.embed_author ?? ""),
        embed_title: String(cfg.embed_title ?? ""),
        warning_message: String(cfg.warning_message ?? prev.warning_message ?? "This ticket will close soon due to inactivity. Reply to keep it open."),
        save_transcript: Boolean(cfg.save_transcript ?? false),
        embed_footer: String(cfg.embed_footer ?? ""),
      }));
      setAppliedAt((data as any).applied_at ?? null);
    })();
    return () => { cancelled = true; };
  }, [isAutoCloseInactive, open, botId]);

  const saveAutoCloseInactive = async () => {
    if (!botId) return toast.error("Missing bot id.");
    setSaving(true);
    const payload = {
      bot_id: botId,
      feature: "auto-close",
      config: {
        close_after_hours: Number(values.close_after_hours ?? 48),
        warn_before_hours: Number(values.warn_before_hours ?? 12),
        embed_author: String(values.embed_author ?? ""),
        embed_title: String(values.embed_title ?? ""),
        warning_message: String(values.warning_message ?? ""),
        save_transcript: Boolean(values.save_transcript ?? false),
        embed_footer: String(values.embed_footer ?? ""),
      },
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("bot_config").upsert(payload, { onConflict: "bot_id,feature" });
    setSaving(false);
    if (error) return toast.error(`Save failed: ${error.message}`);
    const { data: cmdData, error: cmdError } = await supabase.rpc("enqueue_apply_config" as any, {
      _bot_id: botId, _feature: "auto-close",
    });
    const cmdResult = cmdData as { ok?: boolean; error?: string } | null;
    if (cmdError) toast.warning(`Saved, but failed to notify bot: ${cmdError.message}`);
    else if (cmdResult && cmdResult.ok === false) toast.warning(`Saved, but failed to notify bot: ${cmdResult.error ?? "unknown error"}`);
    else toast.success("Auto-Close Inactive Tickets settings saved & applied");
    setOpen(false);
  };

  // ---------- staff-performance ----------
  useEffect(() => {
    if (!isStaffPerformance || !open || !botId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("bot_config")
        .select("config, applied_at")
        .eq("bot_id", botId)
        .eq("feature", "staff-performance")
        .maybeSingle();
      if (cancelled || !data) return;
      const cfg = (data.config ?? {}) as Record<string, any>;
      const staffRoles = Array.isArray(cfg.staff_role_ids) ? cfg.staff_role_ids.map(String) : [];
      const viewerRoleIds = Array.isArray(cfg.viewer_role_ids) ? cfg.viewer_role_ids.map(String) : [];
      setValues((prev) => ({
        ...prev,
        staffRoles,
        viewerRoleIds,
        reportChannel: String(cfg.report_channel_id ?? ""),
        reportFrequency: String(cfg.report_frequency ?? "weekly"),
        trackClaimed: Boolean(cfg.track_claimed ?? true),
        trackClosed: Boolean(cfg.track_closed ?? true),
        trackMessages: Boolean(cfg.track_messages ?? false),
        trackCommands: Boolean(cfg.track_commands ?? false),
        trackProactive: Boolean(cfg.track_proactive ?? false),
        trackResponseTime: Boolean(cfg.track_response_time ?? true),
        trackResolutionTime: Boolean(cfg.track_resolution_time ?? true),
      }));
      setAppliedAt((data as any).applied_at ?? null);
    })();
    return () => { cancelled = true; };
  }, [isStaffPerformance, open, botId]);

  const saveStaffPerformance = async () => {
    if (!botId) return toast.error("Missing bot id.");

    const metrics = [
      values.trackClaimed,
      values.trackClosed,
      values.trackMessages,
      values.trackCommands,
      values.trackProactive,
      values.trackResponseTime,
      values.trackResolutionTime,
    ];
    if (!metrics.some(Boolean)) {
      toast.error("At least one tracked metric must be selected.");
      return;
    }

    setSaving(true);
    const payload = {
      bot_id: botId,
      feature: "staff-performance",
      config: {
        staff_role_ids: Array.isArray(values.staffRoles)
          ? (values.staffRoles as string[]).filter(Boolean)
          : [],
        viewer_role_ids: Array.isArray(values.viewerRoleIds)
          ? (values.viewerRoleIds as string[]).filter(Boolean)
          : [],
        report_channel_id: String(values.reportChannel ?? ""),
        report_frequency: String(values.reportFrequency ?? "weekly"),
        track_claimed: Boolean(values.trackClaimed ?? true),
        track_closed: Boolean(values.trackClosed ?? true),
        track_messages: Boolean(values.trackMessages ?? false),
        track_commands: Boolean(values.trackCommands ?? false),
        track_proactive: Boolean(values.trackProactive ?? false),
        track_response_time: Boolean(values.trackResponseTime ?? true),
        track_resolution_time: Boolean(values.trackResolutionTime ?? true),
      },
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("bot_config").upsert(payload, { onConflict: "bot_id,feature" });
    setSaving(false);
    if (error) return toast.error(`Save failed: ${error.message}`);
    const { data: cmdData, error: cmdError } = await supabase.rpc("enqueue_apply_config" as any, {
      _bot_id: botId, _feature: "staff-performance",
    });
    const cmdResult = cmdData as { ok?: boolean; error?: string } | null;
    if (cmdError) toast.warning(`Saved, but failed to notify bot: ${cmdError.message}`);
    else if (cmdResult && cmdResult.ok === false) toast.warning(`Saved, but failed to notify bot: ${cmdResult.error ?? "unknown error"}`);
    else toast.success("Staff Performance settings saved & applied");
    setOpen(false);
  };

  // ---------- channel-lockdown ----------
  useEffect(() => {
    if (!isChannelLockdown || !open || !botId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("bot_config")
        .select("config, applied_at")
        .eq("bot_id", botId)
        .eq("feature", "channel-lockdown")
        .maybeSingle();
      if (cancelled || !data) return;
      const cfg = (data.config ?? {}) as Record<string, any>;
      const allowed = Array.isArray(cfg.allowed_role_ids) ? cfg.allowed_role_ids.map(String) : [];
      setValues((prev) => ({
        ...prev,
        allowedRoles: allowed,
        lockMessage: String(cfg.lock_message ?? ""),
        unlockMessage: String(cfg.unlock_message ?? ""),
      }));
      const le = (cfg.lock_embed ?? {}) as Partial<LockEmbed>;
      const ue = (cfg.unlock_embed ?? {}) as Partial<LockEmbed>;
      setLockEmbed({
        enabled: le.enabled ?? defaultLockEmbed.enabled,
        title: le.title ?? defaultLockEmbed.title,
        description: le.description ?? defaultLockEmbed.description,
        color: le.color ?? defaultLockEmbed.color,
      });
      setUnlockEmbed({
        enabled: ue.enabled ?? defaultUnlockEmbed.enabled,
        title: ue.title ?? defaultUnlockEmbed.title,
        description: ue.description ?? defaultUnlockEmbed.description,
        color: ue.color ?? defaultUnlockEmbed.color,
      });
      setAppliedAt((data as any).applied_at ?? null);
    })();
    return () => { cancelled = true; };
  }, [isChannelLockdown, open, botId]);

  const saveChannelLockdown = async () => {
    if (!botId) return toast.error("Missing bot id.");
    setSaving(true);
    const payload = {
      bot_id: botId,
      feature: "channel-lockdown",
      config: {
        allowed_role_ids: Array.isArray(values.allowedRoles)
          ? (values.allowedRoles as string[]).filter(Boolean)
          : [],
        lock_message: String(values.lockMessage ?? ""),
        unlock_message: String(values.unlockMessage ?? ""),
        lock_embed: { ...lockEmbed },
        unlock_embed: { ...unlockEmbed },
      },
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("bot_config").upsert(payload, { onConflict: "bot_id,feature" });
    setSaving(false);
    if (error) return toast.error(`Save failed: ${error.message}`);
    const { data: cmdData, error: cmdError } = await supabase.rpc("enqueue_apply_config" as any, {
      _bot_id: botId, _feature: "channel-lockdown",
    });
    const cmdResult = cmdData as { ok?: boolean; error?: string } | null;
    if (cmdError) toast.warning(`Saved, but failed to notify bot: ${cmdError.message}`);
    else if (cmdResult && cmdResult.ok === false) toast.warning(`Saved, but failed to notify bot: ${cmdResult.error ?? "unknown error"}`);
    else toast.success("Channel Lockdown settings saved & applied");
    setOpen(false);
  };

  // ---------- ban-tools (merged softban-massban + temp-ban) ----------
  useEffect(() => {
    if (!isBanTools || !open || !botId) return;
    let cancelled = false;
    (async () => {
      const [{ data: sm }, { data: tb }] = await Promise.all([
        supabase
          .from("bot_config")
          .select("config, applied_at")
          .eq("bot_id", botId)
          .eq("feature", "softban-massban")
          .maybeSingle(),
        supabase
          .from("bot_config")
          .select("config, applied_at")
          .eq("bot_id", botId)
          .eq("feature", "temp-ban")
          .maybeSingle(),
      ]);
      if (cancelled) return;
      const smCfg = (sm?.config ?? {}) as Record<string, any>;
      const tbCfg = (tb?.config ?? {}) as Record<string, any>;
      setValues((prev) => ({
        ...prev,
        softbanRole: Array.isArray(smCfg.softban_role_ids) ? smCfg.softban_role_ids.map(String) : [],
        massbanRole: Array.isArray(smCfg.massban_role_ids) ? smCfg.massban_role_ids.map(String) : [],
        logChannel: smCfg.log_channel_id ?? "",
        softbanDeleteDays: Number(smCfg.softban_delete_days ?? 1),
        requireReason: smCfg.require_reason ?? true,
        tempbanAllowedRole: Array.isArray(tbCfg.allowed_role_ids) ? tbCfg.allowed_role_ids.map(String) : [],
        tempbanDefaultDuration: (() => {
          const mins = Number(tbCfg.default_duration_minutes ?? 1440);
          if (mins === 60) return "1h";
          if (mins === 1440) return "1d";
          if (mins === 10080) return "7d";
          if (mins === 43200) return "30d";
          return "1d";
        })(),
        tempbanLogChannel: tbCfg.log_channel_id ?? "",
        tempbanDmOnBan: tbCfg.dm_on_ban ?? true,
        tempbanDmOnUnban: tbCfg.dm_on_unban ?? false,
      }));
      setAppliedAt(((sm as any)?.applied_at ?? (tb as any)?.applied_at) ?? null);
    })();
    return () => { cancelled = true; };
  }, [isBanTools, open, botId]);

  const saveBanTools = async () => {
    if (!botId) return toast.error("Missing bot id.");
    setSaving(true);
    const smPayload = {
      bot_id: botId,
      feature: "softban-massban",
      config: {
        softban_role_ids: Array.isArray(values.softbanRole)
          ? (values.softbanRole as string[]).filter(Boolean)
          : [],
        massban_role_ids: Array.isArray(values.massbanRole)
          ? (values.massbanRole as string[]).filter(Boolean)
          : [],
        log_channel_id: values.logChannel ? String(values.logChannel) : null,
        softban_delete_days: Number(values.softbanDeleteDays ?? 1),
        require_reason: !!values.requireReason,
      },
      updated_at: new Date().toISOString(),
    };
    const tbPayload = {
      bot_id: botId,
      feature: "temp-ban",
      config: {
        allowed_role_ids: Array.isArray(values.tempbanAllowedRole)
          ? (values.tempbanAllowedRole as string[]).filter(Boolean)
          : [],
        log_channel_id: values.tempbanLogChannel ? String(values.tempbanLogChannel) : null,
        default_duration_minutes: (() => {
          const dur = String(values.tempbanDefaultDuration ?? "1d");
          if (dur === "1h") return 60;
          if (dur === "1d") return 1440;
          if (dur === "7d") return 10080;
          if (dur === "30d") return 43200;
          return 1440;
        })(),
        dm_on_ban: !!values.tempbanDmOnBan,
        dm_on_unban: !!values.tempbanDmOnUnban,
      },
      updated_at: new Date().toISOString(),
    };
    const [smRes, tbRes] = await Promise.all([
      supabase.from("bot_config").upsert(smPayload, { onConflict: "bot_id,feature" }),
      supabase.from("bot_config").upsert(tbPayload, { onConflict: "bot_id,feature" }),
    ]);
    setSaving(false);
    if (smRes.error) return toast.error(`Save failed (softban/massban): ${smRes.error.message}`);
    if (tbRes.error) return toast.error(`Save failed (temp-ban): ${tbRes.error.message}`);
    const [smCmd, tbCmd] = await Promise.all([
      supabase.rpc("enqueue_apply_config" as any, { _bot_id: botId, _feature: "softban-massban" }),
      supabase.rpc("enqueue_apply_config" as any, { _bot_id: botId, _feature: "temp-ban" }),
    ]);
    const failures: string[] = [];
    if (smCmd.error) failures.push(`softban/massban: ${smCmd.error.message}`);
    else if ((smCmd.data as any)?.ok === false) failures.push(`softban/massban: ${(smCmd.data as any)?.error ?? "unknown"}`);
    if (tbCmd.error) failures.push(`temp-ban: ${tbCmd.error.message}`);
    else if ((tbCmd.data as any)?.ok === false) failures.push(`temp-ban: ${(tbCmd.data as any)?.error ?? "unknown"}`);
    if (failures.length) toast.warning(`Saved, but failed to notify bot: ${failures.join("; ")}`);
    else toast.success("Ban Tools settings saved & applied");
    setOpen(false);
  };

  // it's owned but configuration is still wired up.

  if (!config) {
    return (
      <Card className="bg-card/40 border-dashed border-border p-4 flex flex-col h-[158px]">
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

    if (f.type === "header") {
      return (
        <div className="pt-2 pb-1">
          <h4 className="text-sm font-semibold text-foreground">{f.label}</h4>
          <div className="mt-1 h-px bg-border" />
        </div>
      );
    }

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
          {f.markdown ? (
            <DiscordMarkdownTextarea
              id={f.key}
              value={String(value ?? "")}
              placeholder={f.placeholder}
              onValueChange={(v) => setValue(f.key, v)}
              rows={3}
            />
          ) : (
            <Textarea
              id={f.key}
              value={String(value ?? "")}
              placeholder={f.placeholder}
              onChange={(e) => setValue(f.key, e.target.value)}
              rows={4}
            />
          )}
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
          min={f.type === "number" && f.key === "updateMinutes" ? 10 : undefined}
          value={String(value ?? "")}
          placeholder={f.placeholder}
          onChange={(e) =>
            setValue(
              f.key,
              f.type === "number" && f.key === "updateMinutes"
                ? Math.max(10, Number(e.target.value) || 10)
                : f.type === "number" ? Number(e.target.value) : e.target.value,
            )
          }
        />
        {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
      </div>
    );
  };

  return (
    <>
      <style>{`
        .acard.acard{position:relative;height:158px;padding:15px;display:flex;flex-direction:column;border-radius:14px;
          font-family:'Manrope',system-ui,-apple-system,"Segoe UI",sans-serif;border:1px solid #3a434d;
          background:linear-gradient(180deg,#2d353e,#29313a);box-shadow:inset 0 1px 0 rgba(255,255,255,.03);
          transition:transform .17s cubic-bezier(.22,1,.36,1),border-color .17s,box-shadow .17s;cursor:pointer}
        .acard.on:hover{transform:translateY(-2px);border-color:rgba(201,219,230,.42);
          box-shadow:0 16px 34px -18px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.05)}
        .acard.off{opacity:.5;filter:grayscale(.6);cursor:default;background:#272e36}
        .acard .ac-head{display:flex;align-items:center;gap:10px}
        .acard .ac-ico{height:34px;width:34px;border-radius:10px;flex:none;display:grid;place-items:center;
          background:rgba(201,219,230,.10);border:1px solid rgba(201,219,230,.42);color:#C9DBE6;transition:.17s}
        .acard.on:hover .ac-ico{background:rgba(201,219,230,.16)}
        .acard.off .ac-ico{background:#343d46;border-color:#3a434d;color:#788591}
        .acard .ac-ico svg{width:17px;height:17px;stroke:currentColor;stroke-width:1.8;fill:none}
        .acard .ac-title{flex:1;min-width:0;font-size:20px;font-weight:700;line-height:1.2;letter-spacing:-.01em;color:#E8EEF3;padding-top:0}
        .acard.off .ac-title{color:#A8B4BF}
        /* Enable/disable toggle — sits quietly in the top-right and blends into
           the card, brightening only on hover so it never reads as a sore thumb.
           Stays fully visible when the card is OFF so its state is obvious. */
        .acard .ac-sw{padding-top:0;flex:none;opacity:.38;transform:scale(.82);transform-origin:right center;
          transition:opacity .16s ease,transform .16s ease}
        .acard:hover .ac-sw{opacity:.85}
        .acard .ac-sw:hover{opacity:1}
        .acard.off .ac-sw{opacity:1}
        .acard .ac-summary{flex:1;margin-top:10px;font-size:12px;line-height:1.45;color:#788591;
          overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3}
        .acard .ac-foot{display:flex;align-items:center;justify-content:space-between;margin-top:10px}
        .acard .ac-count{font-size:11.5px;font-weight:600;color:#788591}
        .acard .ac-arrow{height:16px;width:16px;color:#788591;transition:transform .17s,color .17s}
        .acard.on:hover .ac-arrow{color:#C9DBE6;transform:translateX(3px)}
      `}</style>
      <Card
        onClick={() => enabled && setOpen(true)}
        className={cn("acard", enabled ? "on" : "off")}
      >
        <div className="ac-head">
          <span className="ac-ico">
            <Icon />
          </span>
          <h3 className="ac-title">{config.title}</h3>
          {onToggleEnabled && (
            <div
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerDownCapture={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              className="ac-sw"
            >
              <Switch
                checked={enabled}
                onCheckedChange={handleToggleEnabled}
                aria-label={`${enabled ? "Disable" : "Enable"} ${config.title}`}
              />
            </div>
          )}
        </div>
        <p className="ac-summary">{config.summary}</p>
        <div className="ac-foot">
          <span className="ac-count">
            {enabled
              ? `${config.fields.length} setting${config.fields.length === 1 ? "" : "s"}`
              : "Disabled"}
          </span>
          {enabled && <ArrowRight className="ac-arrow" />}
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={cn(
            isSayCommand && engineVersion === "v2"
              ? "max-w-6xl max-h-[90vh] overflow-y-auto"
              : isTicketPanel || isTicketLifecycleMessages || isVerification || isInviteMessage || isCustomsMessages || isCustomsVerification
                ? "max-w-6xl max-h-[90vh] overflow-y-auto"
                : isSayCommand || isRules || isGiveaway || isRemindme
                  ? "max-w-5xl max-h-[90vh] overflow-y-auto"
                  : isChannelLockdown
                    ? "max-w-3xl max-h-[90vh] overflow-y-auto"
                    : "max-w-lg max-h-[85vh] overflow-y-auto",
            readOnly && "readonly-scope",
          )}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className="h-5 w-5 text-os-accent" />
              {config.title}
            </DialogTitle>
            <DialogDescription>
              Configure <span className="text-foreground font-medium">{config.title}</span> for{" "}
              <span className="text-foreground font-medium">{targetServerName}</span>.
            </DialogDescription>
          </DialogHeader>

          {isSayCommand ? (
            <div className="py-2">
              {engineVersion === "v2" ? (
                <MessagesV2Builder ref={v2BuilderRef} botId={botId} botName={botName} botAvatarUrl={botAvatarUrl} />
              ) : (
                <SayCommandBuilder ref={sayBuilderRef} botId={botId} botName={botName} botAvatarUrl={botAvatarUrl} />
              )}
            </div>
          ) : isRules ? (
            <div className="py-2">
              <SayCommandBuilder ref={sayBuilderRef} mode="rules" botId={botId} botName={botName} botAvatarUrl={botAvatarUrl} />
            </div>
          ) : isTicketPanel ? (
            <TicketPanelBuilder
              key={`ticket-builder-${ticketBuilderRemountKey}`}
              ref={ticketBuilderRef}
              botId={botId}
              botName={botName}
              botAvatarUrl={botAvatarUrl}
              variant="ticket"
              engineVersion={engineVersion}
            />

          ) : isTicketEditor ? (
            <TicketEditor
              ref={ticketEditorRef}
              botId={botId}
              botName={botName}
              botAvatarUrl={botAvatarUrl}
              engineVersion={engineVersion}
            />

          ) : isTicketLifecycleMessages ? (
            <div className="space-y-4 py-2">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex-1 min-w-0">
                  <Label className="mb-1.5 block">Lifecycle event</Label>
                  <Select
                    value={lifecycleEvent}
                    onValueChange={(v) => switchLifecycleEvent(v as LifecycleKey)}
                  >
                    <SelectTrigger className="w-full sm:w-[360px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LIFECYCLE_KEYS.map((k) => (
                        <SelectItem key={k} value={k}>
                          {LIFECYCLE_LABELS[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Build the message with the V2 component editor. Available tokens in any text:{" "}
                <code className="rounded bg-muted px-1">{"{user}"}</code>{" "}
                <code className="rounded bg-muted px-1">{"{staff}"}</code>{" "}
                <code className="rounded bg-muted px-1">{"{category}"}</code>{" "}
                <code className="rounded bg-muted px-1">{"{server}"}</code>{" "}
                <code className="rounded bg-muted px-1">{"{ticket}"}</code>. Leave blank to use the bot's built-in default.
              </p>
              <MessagesV2Builder
                key={`lifecycle-${lifecycleEvent}-${lifecycleMountKey}`}
                ref={lifecycleV2Ref}
                embedded
                botId={botId}
                botName={botName}
                botAvatarUrl={botAvatarUrl}
                initialItems={lifecycleConfigs[lifecycleEvent] ?? []}
              />
            </div>





          ) : isChannelLockdown ? (
            <div className="space-y-5 py-2">
              {config.fields.map((f) => (
                <div key={f.key}>{renderField(f)}</div>
              ))}
              <LockEmbedEditor
                label="Lock embed"
                value={lockEmbed}
                onChange={setLockEmbed}
                botName={botName}
                botAvatarUrl={botAvatarUrl ?? undefined}
              />
              <LockEmbedEditor
                label="Unlock embed"
                value={unlockEmbed}
                onChange={setUnlockEmbed}
                botName={botName}
                botAvatarUrl={botAvatarUrl ?? undefined}
              />
            </div>
          ) : isRecurringMessages ? (
            <RecurringMessagesForm
              botId={botId}
              entries={recurringMessages}
              onEntriesChange={setRecurringMessages}
              deletePrevious={recurringDeletePrevious}
              onDeletePreviousChange={setRecurringDeletePrevious}
              allowedRoleIds={recurringAllowedRoles}
              onAllowedRoleIdsChange={setRecurringAllowedRoles}
              intervals={RECURRING_INTERVALS}
            />
          ) : isGiveaway ? (
            <GiveawayForm
              botId={botId}
              botName={botName}
              botAvatarUrl={botAvatarUrl ?? undefined}
              hostRoles={giveawayHostRoles}
              onHostRolesChange={setGiveawayHostRoles}
              channelId={giveawayChannelId}
              onChannelIdChange={setGiveawayChannelId}
              defaultDuration={giveawayDefaultDuration}
              onDefaultDurationChange={setGiveawayDefaultDuration}
              entryEmoji={giveawayEntryEmoji}
              onEntryEmojiChange={setGiveawayEntryEmoji}
              defaultWinners={giveawayDefaultWinners}
              onDefaultWinnersChange={setGiveawayDefaultWinners}
              embedTitle={giveawayEmbedTitle}
              onEmbedTitleChange={setGiveawayEmbedTitle}
              embedDescription={giveawayEmbedDescription}
              onEmbedDescriptionChange={setGiveawayEmbedDescription}
              embedColor={giveawayEmbedColor}
              onEmbedColorChange={setGiveawayEmbedColor}
            />
          ) : isInviteMessage || isCustomsMessages || isCustomsVerification ? (
            <div className="space-y-5 py-2">
              {config.fields
                .filter((f) => (f.visibleIf ? f.visibleIf(values) : true))
                .map((f) => (
                  <div key={f.key}>{renderField(f)}</div>
                ))}
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {isCustomsVerification
                    ? "Design the panel members see below. A Verify button is added automatically underneath it."
                    : (<>Type variables like <code className="font-mono text-os-accent">{"{count}"}</code> anywhere — they fill in {isCustomsMessages ? "when the message is posted." : "when someone joins."}</>)}
                </p>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" size="sm" className="gap-1.5 shrink-0">
                      <Braces className="h-3.5 w-3.5" /> Variables
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-72 p-0">
                    <div className="px-3 py-2 border-b border-border/60">
                      <p className="text-xs font-semibold">Variables</p>
                      <p className="text-[11px] text-muted-foreground">Click to copy, then paste into your message.</p>
                    </div>
                    <div className="py-1">
                      {INVITE_VARIABLES.map((v) => (
                        <button
                          key={v.token}
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(v.token);
                            toast.success(`Copied ${v.token}`);
                          }}
                          className="w-full flex items-start gap-2 px-3 py-1.5 text-left hover:bg-muted/60 transition-colors"
                        >
                          <code className="text-[11px] font-mono text-os-accent bg-os-accent/10 border border-os-accent/25 rounded px-1.5 py-0.5 shrink-0">
                            {v.token}
                          </code>
                          <span className="text-[11px] text-muted-foreground leading-snug">{v.desc}</span>
                        </button>
                      ))}
                    </div>
                    <div className="px-3 py-2 border-t border-border/60 space-y-1">
                      <p className="text-[11px] font-semibold text-foreground">Emojis</p>
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        Paste any emoji directly. For a custom server emoji, type its name in colons like{" "}
                        <code className="font-mono text-os-accent">:ovs:</code> — the bot swaps in the correct
                        emoji when it posts (pasting the copied{" "}
                        <code className="font-mono text-os-accent">:name~1:</code> works too).
                      </p>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              {engineVersion === "v2" || isCustomsMessages || isCustomsVerification ? (
                <MessagesV2Builder
                  key={isCustomsVerification ? `verify-panel-v2-${verifyPanelV2MountKey}` : isCustomsMessages ? `customs-msg-v2-${messagesV2MountKey}` : `invite-v2-${inviteV2MountKey}`}
                  ref={isCustomsVerification ? verifyPanelV2Ref : isCustomsMessages ? messagesV2Ref : inviteV2Ref}
                  embedded
                  botId={botId}
                  botName={botName}
                  botAvatarUrl={botAvatarUrl}
                  initialItems={isCustomsVerification ? verifyPanelV2Items : isCustomsMessages ? messagesV2Items : inviteV2Items}
                />
              ) : (
                <SayCommandBuilder
                  ref={inviteSayRef}
                  mode="rules"
                  feature="invite"
                  extraConfig={{ channel_id: String(values.channel_id ?? "") }}
                  botId={botId}
                  botName={botName}
                  botAvatarUrl={botAvatarUrl}
                />
              )}
            </div>
          ) : isVerification ? (
            <VerificationForm
              values={values}
              setValue={setValue}
              renderField={renderField}
              config={config}
              botName={botName}
              botAvatarUrl={botAvatarUrl ?? undefined}
              botId={botId}
              v2BuilderRef={verifyV2Ref}
              v2InitialItems={verifyV2Items}
              v2MountKey={verifyV2MountKey}
            />
          ) : isRemindme ? (
            <RemindmeForm
              values={values}
              setValue={setValue}
              renderField={renderField}
              config={config}
              botName={botName}
              botAvatarUrl={botAvatarUrl ?? undefined}
            />
          ) : isPostSystem ? (
            <div className="py-2">
              <PostTypesManager botId={botId} />
            </div>
          ) : (
            <div className="space-y-5 py-2">
              {config.fields
                .filter((f) => (f.visibleIf ? f.visibleIf(values) : true))
                .map((f) => (
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
              {isTicketPanel && (
                <Button
                  variant="ghost"
                  onClick={() => ticketBuilderRef.current?.clear()}
                  data-readonly-allow
                >
                  Clear
                </Button>
              )}
              <Button variant="outline" onClick={() => setOpen(false)} data-readonly-allow>
                Cancel
              </Button>
              {!isPostSystem && (
              <Button
                className="bg-os-accent text-os-accent-ink hover:brightness-105 disabled:opacity-50"
                disabled={saving || !canEdit}
                title={!canEdit ? `Your role (${role ?? "viewer"}) doesn't allow editing bot config` : undefined}
                onClick={async () => {
                  if (isSayCommand || isRules) {
                    setSaving(true);
                    try {
                      const ok = isSayCommand && engineVersion === "v2"
                        ? await v2BuilderRef.current?.send()
                        : await sayBuilderRef.current?.send();
                      if (ok) setOpen(false);
                    } finally {
                      setSaving(false);
                    }
                    return;
                  }
                  if (isCustomsMessages) {
                    void sendCustomsMessages();
                    return;
                  }
                  if (isInviteMessage) {
                    if (engineVersion === "v2") {
                      void saveInviteMessage();
                    } else {
                      setSaving(true);
                      try {
                        const ok = await inviteSayRef.current?.send();
                        if (ok) setOpen(false);
                      } finally {
                        setSaving(false);
                      }
                    }
                    return;
                  }
                  if (isTicketPanel) {
                    setSaving(true);
                    try {
                      const ok = await ticketBuilderRef.current?.save();
                      if (ok) {
                        setOpen(false);
                        window.dispatchEvent(new CustomEvent("ticket-panels-changed"));
                      }
                    } finally {
                      setSaving(false);
                    }
                    return;
                  }
                  if (isTicketEditor) {
                    setSaving(true);
                    try {
                      const ok = await ticketEditorRef.current?.save();
                      if (ok) setOpen(false);
                    } finally {
                      setSaving(false);
                    }
                    return;
                  }
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
                  } else if (isAutoRole) {
                    void saveAutoRole();
                  } else if (isModHistory) {
                    void saveModHistory();
                  } else if (isAutoEscalate) {
                    void saveAutoEscalate();
                  } else if (isAvatarNsfw) {
                    void saveAvatarNsfw();
                  } else if (isBioPhrase) {
                    void saveBioPhrase();
                  } else if (isPhishingDetection) {
                    void savePhishingDetection();
                  } else if (isSoftbanMassban) {
                    void saveSoftbanMassban();
                  } else if (isStaffNotes) {
                    void saveStaffNotes();
                  } else if (isChannelLockdown) {
                    void saveChannelLockdown();
                  } else if (isBanTools) {
                    void saveBanTools();
                  } else if (isStaffPerformance) {
                    void saveStaffPerformance();
                  } else if (isTicketLifecycleMessages) {
                    void saveTicketLifecycleMessages();
                  } else if (isTicketNotes) {
                    void saveTicketNotes();
                  } else if (isTicketMembers) {
                    void saveTicketMembers();
                  } else if (isCloseAll) {
                    void saveCloseAll();
                  } else if (isPriorityFlagging) {
                    void savePriorityFlagging();
                  } else if (isAutoCloseInactive) {
                    void saveAutoCloseInactive();
                  } else if (isAutoRadio) {
                    void saveAutoRadio();
                  } else if (isMusicAddon) {
                    void saveMusicAddon();
                  } else if (isGiveaway) {
                    void saveGiveaway();
                  } else if (isStarboard) {
                    void saveStarboard();
                  } else if (isRecurringMessages) {
                    void saveRecurringMessages();
                  } else if (isRemindme) {
                    void saveRemindme();
                  } else if (isServerStats) {
                    void saveServerStats();
                  } else if (isCustomsCredits) {
                    void saveCustomsCredits();
                  } else if (isCustomsVerification) {
                    void saveCustomsVerification();
                  } else if (isCustomsTickets) {
                    void saveCustomsTickets();
                  } else {
                    toast.success(`${config.title} settings saved`);
                    setOpen(false);
                  }
                }}
              >
                <Save className="h-4 w-4 mr-1.5" />
                {!canEdit
                  ? "Read only"
                  : saving
                    ? "Saving…"
                    : isRules
                      ? "Save rules"
                      : isSayCommand || isCustomsMessages
                        ? "Send message"
                        : "Save changes"}
              </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

type RecurringEntryInput = { channel_id: string; interval_minutes: number; message: string; ping_role_ids: string[] };

function RecurringMessagesForm({
  botId,
  entries,
  onEntriesChange,
  deletePrevious,
  onDeletePreviousChange,
  allowedRoleIds,
  onAllowedRoleIdsChange,
  intervals,
}: {
  botId?: string;
  entries: RecurringEntryInput[];
  onEntriesChange: (next: RecurringEntryInput[]) => void;
  deletePrevious: boolean;
  onDeletePreviousChange: (next: boolean) => void;
  allowedRoleIds: string[];
  onAllowedRoleIdsChange: (next: string[]) => void;
  intervals: { value: number; label: string }[];
}) {
  const { guild } = useActiveGuild();
  const guildId = guild?.guild_id;
  const { channels, loading, refreshing, refreshFromDiscord } = useBotChannels(botId, guildId);
  const textChannels = useMemo(
    () => channels.filter((c) => ["text", "announcement"].includes(c.channel_type)),
    [channels],
  );
  const channelGroups = useMemo(() => sortedChannelCategoryEntries(textChannels), [textChannels]);

  const update = (idx: number, patch: Partial<RecurringEntryInput>) => {
    onEntriesChange(entries.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  };
  const remove = (idx: number) => onEntriesChange(entries.filter((_, i) => i !== idx));
  const add = () =>
    onEntriesChange([...entries, { channel_id: "", interval_minutes: 60, message: "", ping_role_ids: [] }]);

  return (
    <div className="space-y-5 py-2">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm">Scheduled messages</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => refreshFromDiscord()}
            disabled={refreshing || !guildId}
            className="h-7 px-2 text-xs gap-1.5"
          >
            <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
            {refreshing ? "Refreshing…" : "Refresh channels"}
          </Button>
        </div>

        {entries.length === 0 && (
          <p className="text-xs text-muted-foreground rounded-md border border-dashed border-input px-3 py-4 text-center">
            No scheduled messages yet. Click "Add message" to create one.
          </p>
        )}

        {entries.map((entry, idx) => (
          <div
            key={idx}
            className="rounded-md border border-input bg-muted/20 p-3 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Message #{idx + 1}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => remove(idx)}
                className="h-7 px-2 text-xs text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Remove
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Channel</Label>
                <Select
                  value={entry.channel_id}
                  onValueChange={(v) => update(idx, { channel_id: v })}
                  disabled={!guildId || loading}
                >
                  <SelectTrigger className="h-9">
                    <div className="flex min-w-0 items-center gap-2">
                      <Hash className="h-4 w-4 shrink-0 text-[rgb(var(--os-faint))]" />
                      <SelectValue
                        placeholder={
                          !guildId
                            ? "Select a server first"
                            : loading
                              ? "Loading channels…"
                              : textChannels.length === 0
                                ? "No channels — click Refresh"
                                : "Select a channel…"
                        }
                      />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {channelGroups.map((group) => (
                      <SelectGroup key={group.key}>
                        <SelectLabel>{group.label}</SelectLabel>
                        {group.channels.map((c) => (
                          <SelectItem key={c.channel_id} value={c.channel_id}>
                            {c.channel_name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Interval</Label>
                <Select
                  value={String(entry.interval_minutes)}
                  onValueChange={(v) => update(idx, { interval_minutes: Number(v) })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {intervals.map((opt) => (
                      <SelectItem key={opt.value} value={String(opt.value)}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Message</Label>
              <Textarea
                value={entry.message}
                onChange={(e) => update(idx, { message: e.target.value })}
                placeholder="What should the bot post? Use {roles} to ping the selected roles."
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Tip: type <code className="px-1 rounded bg-muted">{"{roles}"}</code> anywhere to insert the role pings.
              </p>
            </div>

            <RoleMultiSelect
              label="Roles to ping"
              help="These roles will replace {roles} in the message text when posted."
              value={entry.ping_role_ids ?? []}
              onChange={(next) => update(idx, { ping_role_ids: next })}
              botId={botId}
              guildId={guildId}
            />
          </div>
        ))}

        <Button type="button" variant="outline" size="sm" onClick={add} className="w-full">
          <Plus className="h-4 w-4 mr-1.5" />
          Add message
        </Button>
      </div>

      <div className="flex items-center justify-between rounded-md border border-input bg-muted/20 px-3 py-2">
        <div>
          <Label className="text-sm">Delete previous post before posting again</Label>
          <p className="text-xs text-muted-foreground">
            Keeps the channel from filling up with repeats.
          </p>
        </div>
        <Switch checked={deletePrevious} onCheckedChange={onDeletePreviousChange} />
      </div>

      <RoleMultiSelect
        label="Roles allowed to use /repeating"
        help="Members with any of these roles can run the /repeating command."
        value={allowedRoleIds}
        onChange={onAllowedRoleIdsChange}
        botId={botId}
        guildId={guildId}
      />
    </div>
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
  // Default to the standard text-channel set; fields can opt into other
  // channel types (e.g. voice) via field.channelTypes.
  const allowedTypes = field.channelTypes ?? ["text", "announcement", "forum"];
  const filtered = useMemo(
    () => channels.filter((c) => allowedTypes.includes(c.channel_type)),
    [channels, allowedTypes],
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
      <Select
        value={selected?.channel_id ?? ""}
        onValueChange={(v) => onChange(v)}
        disabled={!guildId}
      >
        <SelectTrigger>
          <div className="flex min-w-0 items-center gap-2">
            <Hash className="h-4 w-4 shrink-0 text-[rgb(var(--os-faint))]" />
            <SelectValue
              placeholder={
                !guildId
                  ? "Select a server first"
                  : loading
                    ? "Loading channels…"
                    : filtered.length === 0
                      ? "No channels cached — click Refresh"
                      : "Select a channel…"
              }
            />
          </div>
        </SelectTrigger>
        <SelectContent>
          {channelGroups.map((group) => (
            <SelectGroup key={group.key}>
              <SelectLabel>{group.label}</SelectLabel>
              {group.channels.map((c) => (
                <SelectItem key={c.channel_id} value={c.channel_id}>
                  {c.channel_name}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
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
      <Select value={value} onValueChange={(v) => onChange(v)} disabled={!guildId}>
        <SelectTrigger>
          <div className="flex min-w-0 items-center gap-2">
            <AtSign className="h-4 w-4 shrink-0 text-[rgb(var(--os-faint))]" />
            <SelectValue
              placeholder={
                !guildId
                  ? "Select a server first"
                  : loading
                    ? "Loading roles…"
                    : filtered.length === 0
                      ? "No roles cached — click Refresh"
                      : "Select a role…"
              }
            />
          </div>
        </SelectTrigger>
        <SelectContent>
          {filtered.map((r) => (
            <SelectItem key={r.role_id} value={r.role_id}>
              @{r.role_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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

/**
 * Inline editor + Discord-style preview for one of the channel-lockdown
 * embeds (lock or unlock).
 */
function LockEmbedEditor({
  label,
  value,
  onChange,
  botName,
  botAvatarUrl,
}: {
  label: string;
  value: { enabled: boolean; title: string; description: string; color: string };
  onChange: (v: { enabled: boolean; title: string; description: string; color: string }) => void;
  botName: string;
  botAvatarUrl?: string;
}) {
  // Convert "0xED4245" or "#ED4245" → "#ed4245" for <input type=color>.
  const toHexInput = (c: string): string => {
    const m = String(c ?? "").match(/[0-9a-f]{6}/i);
    return m ? `#${m[0].toLowerCase()}` : "#5865f2";
  };
  // Convert "#ed4245" → "0xED4245" for storage.
  const toStorage = (hex: string): string => `0x${hex.replace("#", "").toUpperCase()}`;
  const hexInputValue = toHexInput(value.color);

  return (
    <div className="space-y-3 rounded-md border border-border p-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        <Switch
          checked={value.enabled}
          onCheckedChange={(v) => onChange({ ...value, enabled: v })}
        />
      </div>
      {value.enabled && (
        <>
          <div className="space-y-2">
            <Label className="text-xs">Title</Label>
            <Input
              value={value.title}
              onChange={(e) => onChange({ ...value, title: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Description</Label>
            <Textarea
              rows={3}
              value={value.description}
              onChange={(e) => onChange({ ...value, description: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={hexInputValue}
                onChange={(e) => onChange({ ...value, color: toStorage(e.target.value) })}
                className="h-9 w-12 cursor-pointer rounded border border-input bg-background"
              />
              <Input
                value={value.color}
                onChange={(e) => onChange({ ...value, color: e.target.value })}
                placeholder="0xED4245"
                className="font-mono text-sm"
              />
            </div>
          </div>
          {/* Preview */}
          <div className="rounded-md bg-[#313338] p-4 text-[#dbdee1]">
            <div className="flex gap-3">
              <div className="h-10 w-10 rounded-full bg-[#5865F2] grid place-items-center shrink-0 overflow-hidden">
                {botAvatarUrl ? (
                  <img src={botAvatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-white text-sm font-bold">
                    {botName.slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-white font-medium">{botName}</span>
                  <span className="bg-[#5865F2] text-white text-[10px] px-1 py-px rounded font-semibold">
                    APP
                  </span>
                  <span className="text-[11px] text-[#949ba4]">Today at 12:00 PM</span>
                </div>
                <div
                  className="mt-1 max-w-md rounded border-l-4 bg-[#2b2d31] p-3"
                  style={{ borderLeftColor: hexInputValue }}
                >
                  {value.title && (
                    <div className="font-semibold text-white">{value.title}</div>
                  )}
                  {value.description && (
                    <div className="mt-1 whitespace-pre-wrap text-sm text-[#dbdee1]">
                      {value.description}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Giveaway System form ──────────────────────────────────────────────
function GiveawayForm({
  botId,
  botName,
  botAvatarUrl,
  hostRoles,
  onHostRolesChange,
  channelId,
  onChannelIdChange,
  defaultDuration,
  onDefaultDurationChange,
  entryEmoji,
  onEntryEmojiChange,
  defaultWinners,
  onDefaultWinnersChange,
  embedTitle,
  onEmbedTitleChange,
  embedDescription,
  onEmbedDescriptionChange,
  embedColor,
  onEmbedColorChange,
}: {
  botId?: string;
  botName: string;
  botAvatarUrl?: string;
  hostRoles: string[];
  onHostRolesChange: (v: string[]) => void;
  channelId: string;
  onChannelIdChange: (v: string) => void;
  defaultDuration: string;
  onDefaultDurationChange: (v: string) => void;
  entryEmoji: string;
  onEntryEmojiChange: (v: string) => void;
  defaultWinners: number;
  onDefaultWinnersChange: (v: number) => void;
  embedTitle: string;
  onEmbedTitleChange: (v: string) => void;
  embedDescription: string;
  onEmbedDescriptionChange: (v: string) => void;
  embedColor: string;
  onEmbedColorChange: (v: string) => void;
}) {
  const { guild } = useActiveGuild();
  const guildId = guild?.guild_id;
  const { channels, loading, refreshing, refreshFromDiscord } = useBotChannels(botId, guildId);
  const textChannels = useMemo(
    () => channels.filter((c) => ["text", "announcement"].includes(c.channel_type)),
    [channels],
  );
  const channelGroups = useMemo(() => sortedChannelCategoryEntries(textChannels), [textChannels]);

  const toHexInput = (c: string): string => {
    const m = String(c ?? "").match(/[0-9a-f]{6}/i);
    return m ? `#${m[0].toLowerCase()}` : "#5865f2";
  };
  const toStorage = (hex: string): string => `0x${hex.replace("#", "").toUpperCase()}`;
  const hexInputValue = toHexInput(embedColor);

  const previewSubs = (s: string) =>
    s
      .split("{emoji}").join(entryEmoji || "🎉")
      .split("{prize}").join("Example Prize")
      .split("{winners}").join(String(Math.max(1, defaultWinners)))
      .split("{ends}").join(`in ${defaultDuration.trim() || "1d"}`);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-2">
      {/* Left: form fields */}
      <div className="space-y-6">
        <RoleMultiSelect
          label="Roles allowed to host"
          help="Members with any of these roles can use /giveaway."
          value={hostRoles}
          onChange={onHostRolesChange}
          botId={botId}
          guildId={guildId}
        />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Giveaway channel</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => refreshFromDiscord()}
              disabled={refreshing || !guildId}
              className="h-7 px-2 text-xs gap-1.5"
            >
              <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
              {refreshing ? "Refreshing…" : "Refresh"}
            </Button>
          </div>
          <Select
            value={channelId}
            onValueChange={(v) => onChannelIdChange(v)}
            disabled={!guildId || loading}
          >
            <SelectTrigger>
              <div className="flex min-w-0 items-center gap-2">
                <Hash className="h-4 w-4 shrink-0 text-[rgb(var(--os-faint))]" />
                <SelectValue
                  placeholder={
                    !guildId
                      ? "Select a server first"
                      : loading
                        ? "Loading channels…"
                        : textChannels.length === 0
                          ? "No channels — click Refresh"
                          : "Select a channel…"
                  }
                />
              </div>
            </SelectTrigger>
            <SelectContent>
              {channelGroups.map((group) => (
                <SelectGroup key={group.key}>
                  <SelectLabel>{group.label}</SelectLabel>
                  {group.channels.map((c) => (
                    <SelectItem key={c.channel_id} value={c.channel_id}>
                      {c.channel_name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label>Default duration</Label>
            <Input
              value={defaultDuration}
              onChange={(e) => onDefaultDurationChange(e.target.value)}
              placeholder="1d"
            />
            <p className="text-[11px] text-muted-foreground">
              e.g. 10m, 2h, 1d, 1w, 1mo, 1y
            </p>
          </div>
          <div className="space-y-2">
            <Label>Entry emoji</Label>
            <Input
              value={entryEmoji}
              onChange={(e) => onEntryEmojiChange(e.target.value)}
              placeholder="🎉"
            />
          </div>
          <div className="space-y-2">
            <Label>Default winners</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={defaultWinners}
              onChange={(e) => onDefaultWinnersChange(Math.max(1, Number(e.target.value)))}
            />
          </div>
        </div>

        <div className="space-y-3 rounded-md border border-border p-4">
          <Label className="text-sm font-medium">Giveaway embed</Label>
          <div className="space-y-2">
            <Label className="text-xs">Title</Label>
            <Input
              value={embedTitle}
              onChange={(e) => onEmbedTitleChange(e.target.value)}
              placeholder="🎉 Giveaway!"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Description</Label>
            <Textarea
              rows={5}
              value={embedDescription}
              onChange={(e) => onEmbedDescriptionChange(e.target.value)}
              placeholder="Tip: use {emoji}, {prize}, {winners}, {ends}"
            />
            <p className="text-xs text-muted-foreground">
              Placeholders: <code className="px-1 rounded bg-muted">{"{emoji}"}</code>,{" "}
              <code className="px-1 rounded bg-muted">{"{prize}"}</code>,{" "}
              <code className="px-1 rounded bg-muted">{"{winners}"}</code>,{" "}
              <code className="px-1 rounded bg-muted">{"{ends}"}</code>
            </p>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={hexInputValue}
                onChange={(e) => onEmbedColorChange(toStorage(e.target.value))}
                className="h-9 w-12 cursor-pointer rounded border border-input bg-background"
              />
              <Input
                value={embedColor}
                onChange={(e) => onEmbedColorChange(e.target.value)}
                placeholder="0x5865F2"
                className="font-mono text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Right: live preview (sticky) */}
      <div className="lg:sticky lg:top-2 self-start">
        <Label className="text-sm font-medium">Preview</Label>
        <div className="mt-2 rounded-md bg-[#313338] p-4 text-[#dbdee1]">
          <div className="flex gap-3">
            <div className="h-10 w-10 rounded-full bg-[#5865F2] grid place-items-center shrink-0 overflow-hidden">
              {botAvatarUrl ? (
                <img src={botAvatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-white text-sm font-bold">
                  {botName.slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-white font-medium">{botName}</span>
                <span className="bg-[#5865F2] text-white text-[10px] px-1 py-px rounded font-semibold">APP</span>
                <span className="text-[11px] text-[#949ba4]">Today at 12:00 PM</span>
              </div>
              <div
                className="mt-1 rounded border-l-4 bg-[#2b2d31] p-3"
                style={{ borderLeftColor: hexInputValue }}
              >
                {embedTitle && (
                  <div className="font-semibold text-white">{previewSubs(embedTitle)}</div>
                )}
                {embedDescription && (
                  <div className="mt-1 whitespace-pre-wrap text-sm text-[#dbdee1]">
                    {previewSubs(embedDescription)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Verification System form (with live preview + advanced security) ───
function VerificationForm({
  values,
  setValue,
  renderField,
  config,
  botName,
  botAvatarUrl,
  botId,
  v2BuilderRef,
  v2InitialItems,
  v2MountKey,
}: {
  values: Record<string, any>;
  setValue: (k: string, v: string | number | boolean | string[]) => void;
  renderField: (f: AddonField) => JSX.Element | null;
  config: { fields: AddonField[] };
  botName: string;
  botAvatarUrl?: string;
  botId?: string;
  v2BuilderRef: React.RefObject<MessagesV2BuilderHandle>;
  v2InitialItems: V2Item[];
  v2MountKey: number;
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const author = String(values.embed_author ?? "");
  const title = String(values.embed_title ?? "");
  const message = String(values.message ?? "Click the button below to verify and unlock the server.");
  const footer = String(values.embed_footer ?? "");
  const buttonLabel = String(values.button_label ?? "Verify");
  const embedColor = String(values.embed_color ?? "#5865f2");
  const colorHex = /^#[0-9a-fA-F]{6}$/.test(embedColor) ? embedColor : "#5865f2";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-2">
      {/* Left: form fields */}
      <div className="space-y-5">

        {config.fields
          .filter((f) => f.key !== "message" && f.key !== "embed_author" && f.key !== "embed_title" && f.key !== "embed_footer")
          .filter((f) => (f.visibleIf ? f.visibleIf(values) : true))
          .map((f) => (
            <div key={f.key}>{renderField(f)}</div>
          ))}

        {/* V2 Verification message builder */}
        <div className="space-y-2 rounded-md border border-border p-3">
          <Label className="text-sm font-medium">Verification message</Label>
          <p className="text-xs text-muted-foreground">
            Build the verification message with containers, sections, text, buttons, images, separators, and select menus. Available tokens in any text:{" "}
            <code className="rounded bg-muted px-1">{"{user}"}</code>{" "}
            <code className="rounded bg-muted px-1">{"{server}"}</code>.
          </p>
          <MessagesV2Builder
            key={`verify-v2-${v2MountKey}`}
            ref={v2BuilderRef}
            embedded
            hidePreview
            botId={botId}
            botName={botName}
            botAvatarUrl={botAvatarUrl}
            initialItems={v2InitialItems}
          />

        </div>


        {/* Embed color */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Embed color</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={colorHex}
              onChange={(e) => setValue("embed_color", e.target.value)}
              className="h-9 w-12 cursor-pointer rounded border border-input bg-background"
            />
            <Input
              value={embedColor}
              onChange={(e) => setValue("embed_color", e.target.value)}
              placeholder="#5865f2"
              className="font-mono text-sm"
            />
          </div>
        </div>


        {/* Advanced Security collapsible */}
        <div className="rounded-md border border-border">
          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/40 transition-smooth"
          >
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Advanced Security
            </span>
            <ChevronsUpDown className={cn("h-4 w-4 transition-transform", advancedOpen && "rotate-180")} />
          </button>
          {advancedOpen && (
            <div className="px-4 pb-4 pt-2 space-y-5 border-t border-border">
              {/* Rate limiting */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Rate Limiting</Label>
                    <p className="text-xs text-muted-foreground">Lock users out after too many failed attempts.</p>
                  </div>
                  <Switch
                    checked={!!values.rate_limit_enabled}
                    onCheckedChange={(v) => setValue("rate_limit_enabled", v)}
                  />
                </div>
                {values.rate_limit_enabled && (
                  <div className="grid grid-cols-2 gap-3 pl-1">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Max attempts before lockout</Label>
                      <Input
                        type="number"
                        min={1}
                        value={Number(values.rate_limit_max_attempts ?? 3)}
                        onChange={(e) => setValue("rate_limit_max_attempts", Number(e.target.value) || 1)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Lockout duration</Label>
                      <Select
                        value={String(values.rate_limit_lockout_minutes ?? 10)}
                        onValueChange={(v) => setValue("rate_limit_lockout_minutes", Number(v))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5 minutes</SelectItem>
                          <SelectItem value="10">10 minutes</SelectItem>
                          <SelectItem value="30">30 minutes</SelectItem>
                          <SelectItem value="60">1 hour</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              {/* Phone verified required */}
              <div className="flex items-center justify-between">
                <div className="pr-3">
                  <Label className="text-sm font-medium">Phone Verified Required</Label>
                  <p className="text-xs text-muted-foreground">
                    Requires Discord phone verification before users can verify.
                  </p>
                </div>
                <Switch
                  checked={!!values.phone_verified_required}
                  onCheckedChange={(v) => setValue("phone_verified_required", v)}
                />
              </div>

              {/* Honeypot */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="pr-3">
                    <Label className="text-sm font-medium">New Account Honeypot</Label>
                    <p className="text-xs text-muted-foreground">Silently flag suspiciously new accounts.</p>
                  </div>
                  <Switch
                    checked={!!values.honeypot_enabled}
                    onCheckedChange={(v) => setValue("honeypot_enabled", v)}
                  />
                </div>
                {values.honeypot_enabled && (
                  <div className="pl-1 space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Flag accounts under X days</Label>
                      <Input
                        type="number"
                        min={1}
                        value={values.honeypot_flag_under_days ?? ""}
                        onChange={(e) =>
                          setValue(
                            "honeypot_flag_under_days",
                            e.target.value === "" ? "" : Number(e.target.value)
                          )
                        }
                        onBlur={(e) => {
                          if (e.target.value === "") {
                            setValue("honeypot_flag_under_days", 7);
                          }
                        }}
                      />
                    </div>
                    <MultiRoleField
                      field={{ label: "Staff roles to ping", key: "honeypot_ping_roles", type: "multiselect", help: "Roles to mention when a suspicious new account is flagged." }}
                      value={Array.isArray(values.honeypot_ping_roles) ? values.honeypot_ping_roles as string[] : []}
                      onChange={(v) => setValue("honeypot_ping_roles", v)}
                      botId={botId}
                    />
                  </div>
                )}
              </div>

              {/* Suspicious joins */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="pr-3">
                    <Label className="text-sm font-medium">Suspicious Join Detection</Label>
                    <p className="text-xs text-muted-foreground">Flag bursts of verification attempts.</p>
                  </div>
                  <Switch
                    checked={!!values.suspicious_join_enabled}
                    onCheckedChange={(v) => setValue("suspicious_join_enabled", v)}
                  />
                </div>
                {values.suspicious_join_enabled && (
                  <div className="pl-1 space-y-1.5">
                    <Label className="text-xs">Max verifications per minute before flagging</Label>
                    <Input
                      type="number"
                      min={1}
                      value={values.suspicious_join_max_per_minute ?? ""}
                      onChange={(e) =>
                        setValue(
                          "suspicious_join_max_per_minute",
                          e.target.value === "" ? "" : Number(e.target.value)
                        )
                      }
                      onBlur={(e) => {
                        if (e.target.value === "") {
                          setValue("suspicious_join_max_per_minute", 5);
                        }
                      }}
                    />
                  </div>
                )}
              </div>

              {/* VPN Blocking */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="pr-3">
                    <Label className="text-sm font-medium">VPN Blocking</Label>
                    <p className="text-xs text-muted-foreground">Block users connecting through VPNs during verification.</p>
                  </div>
                  <Switch
                    checked={!!values.vpn_block_enabled}
                    onCheckedChange={(v) => setValue("vpn_block_enabled", v)}
                  />
                </div>
                {values.vpn_block_enabled && (
                  <div className="pl-1 space-y-1.5">
                    <Label className="text-xs">IPHub API Key</Label>
                    <Input
                      type="text"
                      placeholder="Your IPHub API key"
                      value={String(values.vpn_block_iphub_key ?? "")}
                      onChange={(e) => setValue("vpn_block_iphub_key", e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">API key for IPHub VPN detection service.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: live embed preview */}
      <div className="lg:sticky lg:top-0 self-start">
        <Label className="text-xs text-muted-foreground mb-2 block">Live preview</Label>
        <div className="rounded-md bg-[#313338] p-4 text-[#dbdee1]">
          <div className="flex gap-3">
            <div className="h-10 w-10 rounded-full bg-[#5865F2] grid place-items-center shrink-0 overflow-hidden">
              {botAvatarUrl ? (
                <img src={botAvatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-white text-sm font-bold">
                  {botName.slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-white font-medium">{botName}</span>
                <span className="bg-[#5865F2] text-white text-[10px] px-1 py-px rounded font-semibold">APP</span>
                <span className="text-[11px] text-[#949ba4]">Today at 12:00 PM</span>
              </div>
              <div
                className="mt-1 max-w-md rounded border-l-4 bg-[#2b2d31] p-3"
                style={{ borderLeftColor: colorHex }}
              >
                {author && (
                  <div className="text-xs text-[#dbdee1] mb-1">{author}</div>
                )}
                {title && (
                  <div className="font-semibold text-white">{title}</div>
                )}
                {message && (
                  <div className="mt-1 whitespace-pre-wrap text-sm text-[#dbdee1]">{message}</div>
                )}
                {footer && (
                  <div className="mt-2 text-[11px] text-[#949ba4]">{footer}</div>
                )}
                <div className="mt-3">
                  <span className="inline-flex items-center rounded bg-[#248046] text-white text-sm font-medium px-3 py-1.5 cursor-default">
                    {buttonLabel || "Verify"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

// ─── Remindme form (with live embed preview) ───
function RemindmeForm({
  values,
  setValue,
  renderField,
  config,
  botName,
  botAvatarUrl,
}: {
  values: Record<string, any>;
  setValue: (k: string, v: string | number | boolean | string[]) => void;
  renderField: (f: AddonField) => JSX.Element | null;
  config: { fields: AddonField[] };
  botName: string;
  botAvatarUrl?: string;
}) {
  const embedColor = String(values.embed_color ?? "#5865f2");
  const colorHex = /^#[0-9a-fA-F]{6}$/.test(embedColor) ? embedColor : "#5865f2";
  const embedTitle = String(values.embed_title ?? "Reminder");
  const footerText = String(values.footer_text ?? "");
  const showOriginal = values.show_original !== false;
  const pingUser = values.ping_user !== false;
  const sampleReminder = "Take out the trash 🗑️";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-2">
      {/* Left: fields */}
      <div className="space-y-5">
        {config.fields
          .filter((f) => f.key !== "embed_title" && f.key !== "footer_text" && f.key !== "show_original" && f.key !== "ping_user")
          .filter((f) => (f.visibleIf ? f.visibleIf(values) : true))
          .map((f) => (
            <div key={f.key}>{renderField(f)}</div>
          ))}

        <div className="space-y-2">
          <Label className="text-sm font-medium">Embed color</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={colorHex}
              onChange={(e) => setValue("embed_color", e.target.value)}
              className="h-9 w-12 cursor-pointer rounded border border-input bg-background"
            />
            <Input
              value={embedColor}
              onChange={(e) => setValue("embed_color", e.target.value)}
              placeholder="#5865f2"
              className="font-mono text-sm"
            />
          </div>
        </div>

        {config.fields
          .filter((f) => f.key === "embed_title" || f.key === "footer_text" || f.key === "show_original" || f.key === "ping_user")
          .map((f) => (
            <div key={f.key}>{renderField(f)}</div>
          ))}
      </div>

      {/* Right: preview */}
      <div className="lg:sticky lg:top-2 self-start">
        <Label className="text-sm font-medium">Preview</Label>
        <div className="mt-2 rounded-md bg-[#313338] p-4 text-[#dbdee1]">
          <div className="flex gap-3">
            <div className="h-10 w-10 rounded-full bg-[#5865F2] grid place-items-center shrink-0 overflow-hidden">
              {botAvatarUrl ? (
                <img src={botAvatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-white text-sm font-bold">
                  {botName.slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-white font-medium">{botName}</span>
                <span className="bg-[#5865F2] text-white text-[10px] px-1 py-px rounded font-semibold">APP</span>
                <span className="text-[11px] text-[#949ba4]">Today at 12:00 PM</span>
              </div>
              {pingUser && (
                <div className="mt-1 text-sm text-[#dbdee1]">
                  <span className="bg-[#3c4270] text-[#c9cdfb] px-1 rounded">@user</span> ⏰
                </div>
              )}
              <div
                className="mt-1 rounded border-l-4 bg-[#2b2d31] p-3"
                style={{ borderLeftColor: colorHex }}
              >
                {embedTitle && (
                  <div className="font-semibold text-white">{embedTitle}</div>
                )}
                {showOriginal && (
                  <div className="mt-1 whitespace-pre-wrap text-sm text-[#dbdee1]">
                    {sampleReminder}
                  </div>
                )}
                {!showOriginal && (
                  <div className="mt-1 whitespace-pre-wrap text-sm text-[#dbdee1]">
                    Your reminder is ready!
                  </div>
                )}
                {footerText && (
                  <div className="mt-2 text-[11px] text-[#949ba4]">{footerText}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

