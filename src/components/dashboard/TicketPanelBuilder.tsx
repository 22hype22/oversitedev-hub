import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

import { Plus, Trash2, Info, Ticket, Hash } from "lucide-react";
import { GuildChannelPicker } from "./GuildChannelPicker";
import { RoleMultiSelect } from "./RoleMultiSelect";
import type { BotGuild, BotChannel } from "@/hooks/useGuildChannels";
import { useBotChannels, sortedChannelCategoryEntries } from "@/hooks/useGuildChannels";
import { useActiveGuild } from "@/hooks/useActiveGuild";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  TicketPanelV2Builder,
  type TicketPanelV2BuilderHandle,
  type V2Item,
} from "./TicketPanelV2Builder";


type Category = {
  id: string;
  name: string;
  roles: string[];
  openingMessage: string;
};


const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

type Variant = "ticket" | "report";

export type TicketPanelBuilderHandle = {
  save: () => Promise<boolean>;
  clear: () => void;
};

type Props = {
  botId?: string;
  botName: string;
  botAvatarUrl?: string | null;
  variant?: Variant;
  engineVersion?: "v1" | "v2";
  /**
   * When provided, saving will additionally enqueue an `edit_ticket_panel`
   * bot command targeting this Discord message so the worker can edit the
   * existing panel in-place instead of (only) reapplying config. Used by
   * the "Ticket Panel Edit" card.
   */
  editTarget?: { channel_id: string; message_id: string } | null;
};


const COPY: Record<Variant, {
  panelTitleLabel: string;
  panelTitlePlaceholder: string;
  panelDescLabel: string;
  panelDescPlaceholder: string;
  channelLabel: string;
  channelHelp: string;
  categoriesLabel: string;
  categoryNamePlaceholder: string;
  rolesPlaceholder: string;
  openingLabel: string;
  openingPlaceholder: string;
}> = {
  ticket: {
    panelTitleLabel: "Panel Title",
    panelTitlePlaceholder: "e.g. Open a Ticket",
    panelDescLabel: "Panel Description",
    panelDescPlaceholder: "e.g. Select a category below to open a ticket.",
    channelLabel: "Panel channel",
    channelHelp: "Where the ticket panel message gets posted.",
    categoriesLabel: "Categories",
    categoryNamePlaceholder: "e.g. Development",
    rolesPlaceholder: "e.g. Board of Directors, Development Team",
    openingLabel: "Message sent when this ticket opens",
    openingPlaceholder:
      "e.g. Thanks for opening a Development ticket — a team member will be with you shortly.",
  },
  report: {
    panelTitleLabel: "Panel Title",
    panelTitlePlaceholder: "e.g. Submit an Anonymous Report",
    panelDescLabel: "Panel Description",
    panelDescPlaceholder:
      "e.g. Select a category below to submit a confidential report.",
    channelLabel: "Panel channel",
    channelHelp: "Where the anonymous report panel message gets posted.",
    categoriesLabel: "Report Categories",
    categoryNamePlaceholder: "e.g. Harassment",
    rolesPlaceholder: "e.g. Moderators, Admins",
    openingLabel: "Message sent when this report is submitted",
    openingPlaceholder:
      "e.g. Your report has been received anonymously. Staff will review it shortly.",
  },
};
export const TicketPanelBuilder = forwardRef<TicketPanelBuilderHandle, Props>(
  function TicketPanelBuilder(
    { botId, botName, botAvatarUrl, variant = "ticket", engineVersion = "v1", editTarget = null },
    ref,
  ) {
  const copy = COPY[variant];
  const isReport = variant === "report";
  const isV2 = engineVersion === "v2";
  const feature = isReport ? "reports" : "tickets";

  const v2Ref = useRef<TicketPanelV2BuilderHandle>(null);


  const { guild: activeGuild, setGuild: setActiveGuild } = useActiveGuild();
  const [guild, setGuildLocal] = useState<BotGuild | null>(activeGuild);
  // Keep our local picker in sync if the dashboard-wide active server changes.
  useEffect(() => {
    if (activeGuild?.guild_id !== guild?.guild_id) setGuildLocal(activeGuild);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGuild?.guild_id]);
  const setGuild = (g: BotGuild | null) => {
    setGuildLocal(g);
    if (g) setActiveGuild(g);
  };
  const [panelChannel, setPanelChannel] = useState<BotChannel | null>(null);
  const [panelTitle, setPanelTitle] = useState("");
  const [panelDescription, setPanelDescription] = useState("");
  const [cooldownMinutes, setCooldownMinutes] = useState<number>(10);
  const [embedColor, setEmbedColor] = useState("#5865F2");
  const [categories, setCategories] = useState<Category[]>([
    { id: uid(), name: "", roles: [], openingMessage: "" },
  ]);

  // ---- Ticket Logging (formerly a separate "Ticket Logs" addon) ----
  const [logChannelId, setLogChannelId] = useState<string>("");
  const [logTicketOpened, setLogTicketOpened] = useState<boolean>(true);
  const [logTicketClosed, setLogTicketClosed] = useState<boolean>(true);
  const [logTicketClaimed, setLogTicketClaimed] = useState<boolean>(true);
  const [logIncludeAttachments, setLogIncludeAttachments] = useState<boolean>(true);

  // ---- Hydration + draft persistence (localStorage) ----
  // Draft key is scoped per (bot, variant, edit target) so the Edit dialog and
  // the Settings card each get their own draft slot.
  const draftKey = botId
    ? `ticket-settings-draft:${botId}:${variant}${
        editTarget ? `:edit:${editTarget.channel_id}:${editTarget.message_id}` : ""
      }`
    : null;

  // Items for the V2 builder live in the parent so we can persist them.
  const [v2Items, setV2Items] = useState<V2Item[] | null>(null);
  // Bumped to force-remount V2Builder with fresh initialItems (used by Clear).
  const [v2BuilderKey, setV2BuilderKey] = useState(0);
  // Set to true once we've finished loading both DB + draft, so the V2 builder
  // can mount with the correct initialItems.
  const [hydrated, setHydrated] = useState(false);
  // Snapshot of the last DB-saved state, so the Clear button can restore it.
  const baselineRef = useRef<{
    panelTitle: string;
    panelDescription: string;
    embedColor: string;
    cooldownMinutes: number;
    categories: Category[];
    panelChannel: BotChannel | null;
    v2Items: V2Item[] | null;
    logChannelId: string;
    logTicketOpened: boolean;
    logTicketClosed: boolean;
    logTicketClaimed: boolean;
    logIncludeAttachments: boolean;
  } | null>(null);

  const applySnapshot = (s: NonNullable<typeof baselineRef.current>) => {
    setPanelTitle(s.panelTitle);
    setPanelDescription(s.panelDescription);
    setEmbedColor(s.embedColor);
    setCooldownMinutes(s.cooldownMinutes);
    setCategories(
      s.categories.length > 0
        ? s.categories
        : [{ id: uid(), name: "", roles: [], openingMessage: "" }],
    );
    setPanelChannel(s.panelChannel);
    setV2Items(s.v2Items);
    setLogChannelId(s.logChannelId);
    setLogTicketOpened(s.logTicketOpened);
    setLogTicketClosed(s.logTicketClosed);
    setLogTicketClaimed(s.logTicketClaimed);
    setLogIncludeAttachments(s.logIncludeAttachments);
  };

  // Full hydration: DB baseline first, then layer the localStorage draft on
  // top so unsaved user edits survive a dialog close / page reload.
  useEffect(() => {
    if (!botId) return;
    let cancelled = false;
    (async () => {
      setHydrated(false);

      // 1. Fetch panel config (tickets / reports).
      const { data: panelRow } = await supabase
        .from("bot_config")
        .select("config")
        .eq("bot_id", botId)
        .eq("feature", feature)
        .maybeSingle();
      const cfg = (panelRow?.config ?? {}) as Record<string, any>;

      // 2. Build baseline from cfg.
      const baseCategories: Category[] = Array.isArray(cfg.categories)
        ? (cfg.categories as any[]).map((c) => {
            if (typeof c === "string") {
              const name = c;
              const roles = (cfg.category_roles ?? {})[name] ?? [];
              const opening = (cfg.category_messages ?? {})[name] ?? "";
              return {
                id: uid(),
                name,
                roles: roles.map(String),
                openingMessage: String(opening),
              };
            }
            return {
              id: uid(),
              name: String(c.name ?? ""),
              roles: Array.isArray(c.roles) ? c.roles.map(String) : [],
              openingMessage: String(c.opening_message ?? ""),
            };
          })
        : [];

      let logsCfg: Record<string, any> = {};
      if (!isReport) {
        const { data: logsRow } = await supabase
          .from("bot_config")
          .select("config")
          .eq("bot_id", botId)
          .eq("feature", "ticket-logs")
          .maybeSingle();
        logsCfg = (logsRow?.config ?? {}) as Record<string, any>;
      }

      const baseline: NonNullable<typeof baselineRef.current> = {
        panelTitle: typeof cfg.panel_title === "string" ? cfg.panel_title : "",
        panelDescription:
          typeof cfg.panel_description === "string" ? cfg.panel_description : "",
        embedColor: typeof cfg.color === "string" ? cfg.color : "#5865F2",
        cooldownMinutes:
          typeof cfg.cooldown_minutes === "number" ? cfg.cooldown_minutes : 10,
        categories: baseCategories,
        panelChannel: cfg.channel_id
          ? ({
              channel_id: String(cfg.channel_id),
              channel_name: String(cfg.channel_name ?? cfg.channel_id),
              channel_type: "text",
            } as BotChannel)
          : null,
        v2Items: Array.isArray(cfg.ticket_panel_v2)
          ? (cfg.ticket_panel_v2 as V2Item[])
          : null,
        logChannelId: String(logsCfg.log_channel_id ?? ""),
        logTicketOpened: logsCfg.log_ticket_opened !== false,
        logTicketClosed: logsCfg.log_ticket_closed !== false,
        logTicketClaimed: logsCfg.log_ticket_claimed !== false,
        logIncludeAttachments: logsCfg.include_attachments !== false,
      };
      if (cancelled) return;
      baselineRef.current = baseline;
      applySnapshot(baseline);

      // 3. Overlay draft.
      if (draftKey) {
        try {
          const raw = localStorage.getItem(draftKey);
          if (raw) {
            const d = JSON.parse(raw) as Record<string, any>;
            if (typeof d.panelTitle === "string") setPanelTitle(d.panelTitle);
            if (typeof d.panelDescription === "string")
              setPanelDescription(d.panelDescription);
            if (typeof d.embedColor === "string") setEmbedColor(d.embedColor);
            if (typeof d.cooldownMinutes === "number")
              setCooldownMinutes(d.cooldownMinutes);
            if (Array.isArray(d.categories) && d.categories.length > 0) {
              setCategories(d.categories as Category[]);
            }
            if (d.panelChannel && typeof d.panelChannel.channel_id === "string") {
              setPanelChannel({
                channel_id: String(d.panelChannel.channel_id),
                channel_name: String(d.panelChannel.channel_name ?? d.panelChannel.channel_id),
                channel_type: "text",
              } as BotChannel);
            }
            if (Array.isArray(d.v2Items)) setV2Items(d.v2Items as V2Item[]);
            if (typeof d.logChannelId === "string") setLogChannelId(d.logChannelId);
            if (typeof d.logTicketOpened === "boolean")
              setLogTicketOpened(d.logTicketOpened);
            if (typeof d.logTicketClosed === "boolean")
              setLogTicketClosed(d.logTicketClosed);
            if (typeof d.logTicketClaimed === "boolean")
              setLogTicketClaimed(d.logTicketClaimed);
            if (typeof d.logIncludeAttachments === "boolean")
              setLogIncludeAttachments(d.logIncludeAttachments);
          }
        } catch {
          /* ignore */
        }
      }

      if (!cancelled) setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId, feature, editTarget?.channel_id, editTarget?.message_id]);

  // Persist draft on every change — only after hydration completes, to avoid
  // overwriting it with the initial empty defaults.
  useEffect(() => {
    if (!draftKey || !hydrated) return;
    const data = {
      panelTitle,
      panelDescription,
      embedColor,
      cooldownMinutes,
      categories,
      panelChannel: panelChannel
        ? {
            channel_id: panelChannel.channel_id,
            channel_name: panelChannel.channel_name,
          }
        : null,
      v2Items,
      logChannelId,
      logTicketOpened,
      logTicketClosed,
      logTicketClaimed,
      logIncludeAttachments,
    };
    try {
      localStorage.setItem(draftKey, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }, [
    draftKey,
    hydrated,
    panelTitle,
    panelDescription,
    embedColor,
    cooldownMinutes,
    categories,
    panelChannel,
    v2Items,
    logChannelId,
    logTicketOpened,
    logTicketClosed,
    logTicketClaimed,
    logIncludeAttachments,
  ]);


  // ---- Channel list (used for the log-channel dropdown) ----
  const { channels: allChannels } = useBotChannels(botId, guild?.guild_id);
  const textChannels = useMemo(
    () =>
      allChannels.filter(
        (c) => c.channel_type === "text" || c.channel_type === "announcement",
      ),
    [allChannels],
  );
  const channelGroups = useMemo(
    () => sortedChannelCategoryEntries(textChannels),
    [textChannels],
  );

  const resetToDefaults = () => {
    setPanelTitle("");
    setPanelDescription("");
    setCooldownMinutes(10);
    setEmbedColor("#5865F2");
    setCategories([{ id: uid(), name: "", roles: [], openingMessage: "" }]);
    setLogChannelId("");
    setLogTicketOpened(true);
    setLogTicketClosed(true);
    setLogTicketClaimed(true);
    setLogIncludeAttachments(true);
  };





  const updateCategory = (id: string, patch: Partial<Category>) =>
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );

  const addCategory = () =>
    setCategories((prev) => [
      ...prev,
      { id: uid(), name: "", roles: [], openingMessage: "" },
    ]);

  const removeCategory = (id: string) =>
    setCategories((prev) =>
      prev.length === 1 ? prev : prev.filter((c) => c.id !== id),
    );

  useImperativeHandle(ref, () => ({
    save: async () => {
      if (!botId) {
        toast.error("Bot is not ready yet");
        return false;
      }

      let v2Items: V2Item[] | null = null;
      if (isV2) {
        v2Items = v2Ref.current?.getItems() ?? [];
        if (v2Items.length === 0) {
          toast.error("Add at least one component to the panel message");
          return false;
        }
      } else {
        if (!panelTitle.trim()) {
          toast.error("Panel title is required");
          return false;
        }
        if (!panelDescription.trim()) {
          toast.error("Panel description is required");
          return false;
        }
      }

      const cleanedCategories = categories
        .map((c) => ({
          name: c.name.trim(),
          roles: c.roles.filter((r) => r && r.length > 0),
          opening_message: c.openingMessage.trim(),
        }))
        .filter((c) => c.name.length > 0);
      if (cleanedCategories.length === 0) {
        toast.error("Add at least one category");
        return false;
      }

      const categoryNames = cleanedCategories.map((c) => c.name);
      const categoryMessages: Record<string, string> = {};
      const categoryRoles: Record<string, string[]> = {};
      for (const c of cleanedCategories) {
        categoryMessages[c.name] = c.opening_message;
        categoryRoles[c.name] = c.roles;
      }

      const payload = {
        bot_id: botId,
        feature,
        config: {
          variant,
          engine_version: engineVersion,
          guild_id: guild?.guild_id ?? null,
          guild_name: guild?.guild_name ?? null,
          channel_id: panelChannel?.channel_id ?? null,
          channel_name: panelChannel?.channel_name ?? null,
          panel_title: isV2 ? null : panelTitle.trim(),
          panel_description: isV2 ? null : panelDescription.trim(),
          color: embedColor,
          cooldown_minutes: isReport ? cooldownMinutes : null,
          categories: isV2 ? categoryNames : cleanedCategories,
          category_messages: isV2 ? categoryMessages : null,
          category_roles: isV2 ? categoryRoles : null,
          ticket_panel_v2: isV2 ? v2Items : null,
          components_v2: null,
        },
        updated_at: new Date().toISOString(),
      };

      // Debug: log exact payload being saved to bot_config so we can verify
      // channel_id and categories are present in the config object.
      console.log("[TicketPanelBuilder] Saving bot_config payload:", payload);
      console.log("[TicketPanelBuilder] config.channel_id:", payload.config.channel_id);
      console.log("[TicketPanelBuilder] config.categories:", payload.config.categories);
      console.log("[TicketPanelBuilder] panelChannel state:", panelChannel);
      if (!payload.config.channel_id) {
        console.warn("[TicketPanelBuilder] channel_id is MISSING — no panel channel selected.");
      }
      if (!payload.config.categories || (Array.isArray(payload.config.categories) && payload.config.categories.length === 0)) {
        console.warn("[TicketPanelBuilder] categories is MISSING or empty.");
      }

      const { error } = await supabase
        .from("bot_config")
        .upsert(payload, { onConflict: "bot_id,feature" });
      if (error) {
        toast.error(`Save failed: ${error.message}`);
        return false;
      }

      // Persist the ticket-logs settings alongside the panel (ticket variant only).
      if (!isReport) {
        const logsPayload = {
          bot_id: botId,
          feature: "ticket-logs",
          config: {
            log_channel_id: logChannelId || null,
            log_ticket_opened: logTicketOpened,
            log_ticket_closed: logTicketClosed,
            log_ticket_claimed: logTicketClaimed,
            include_attachments: logIncludeAttachments,
          },
          updated_at: new Date().toISOString(),
        };
        const { error: logsError } = await supabase
          .from("bot_config")
          .upsert(logsPayload, { onConflict: "bot_id,feature" });
        if (logsError) {
          toast.warning(`Panel saved, but logging settings failed: ${logsError.message}`);
        } else {
          await supabase.rpc("enqueue_apply_config" as any, {
            _bot_id: botId,
            _feature: "ticket-logs",
          });
        }
      }


      // If we're editing an already-posted panel in place, enqueue a targeted
      // edit_ticket_panel command instead of the broad apply_config (which the
      // worker treats as "create / repost"). The worker reads the latest
      // tickets config from bot_config and edits the specific message.
      if (editTarget?.channel_id && editTarget?.message_id) {
        const { data: orderRow } = await supabase
          .from("bot_orders")
          .select("user_id")
          .eq("id", botId)
          .maybeSingle();
        const ownerId = orderRow?.user_id;
        const { data: authData } = await supabase.auth.getUser();
        const requesterId = authData.user?.id;
        if (!ownerId || !requesterId) {
          toast.warning("Saved, but could not enqueue panel edit (auth context missing).");
        } else {
          const { error: cmdInsertErr } = await supabase.from("bot_commands").insert({
            bot_id: botId,
            user_id: ownerId,
            requested_by: requesterId,
            action: "edit_ticket_panel",
            payload: {
              feature,
              channel_id: editTarget.channel_id,
              message_id: editTarget.message_id,
            },
          });
          if (cmdInsertErr) {
            toast.warning(`Saved, but failed to queue panel edit: ${cmdInsertErr.message}`);
          } else {
            toast.success("Panel update queued — the bot will edit the message shortly.");
          }
        }
      } else {
        const { data: cmdData, error: cmdError } = await supabase.rpc(
          "enqueue_apply_config" as any,
          { _bot_id: botId, _feature: feature },
        );
        const cmdResult = cmdData as { ok?: boolean; error?: string } | null;
        if (cmdError) {
          toast.warning(`Saved, but failed to notify bot: ${cmdError.message}`);
        } else if (cmdResult && cmdResult.ok === false) {
          toast.warning(
            `Saved, but failed to notify bot: ${cmdResult.error ?? "unknown error"}`,
          );
        } else {
          toast.success(
            isReport ? "Report panel saved & applied" : "Ticket panel saved & applied",
          );
        }
      }
      // Clear draft on successful save & refresh baseline so a subsequent
      // Clear reverts to the just-saved state.
      if (draftKey) {
        try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
      }
      baselineRef.current = {
        panelTitle,
        panelDescription,
        embedColor,
        cooldownMinutes,
        categories,
        panelChannel,
        v2Items: isV2 ? (v2Items ?? (v2Ref.current?.getItems() ?? null)) : null,
        logChannelId,
        logTicketOpened,
        logTicketClosed,
        logTicketClaimed,
        logIncludeAttachments,
      };
      return true;
    },
    clear: () => {
      if (draftKey) {
        try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
      }
      if (baselineRef.current) {
        applySnapshot(baselineRef.current);
        setV2BuilderKey((k) => k + 1);
        toast.info("Reverted to last saved settings");
      } else {
        resetToDefaults();
        toast.info("Form reset");
      }
    },
  }));

  // ---- V1 preview helpers ----
  const previewTitle = panelTitle.trim() || copy.panelTitlePlaceholder.replace(/^e\.g\. /, "");
  const previewDesc = panelDescription.trim() || copy.panelDescPlaceholder.replace(/^e\.g\. /, "");

  const V1Preview = (
    <div className="rounded-lg border border-border bg-[#313338] p-4 text-white h-full min-h-[420px]">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-muted overflow-hidden shrink-0">
          {botAvatarUrl ? (
            <img src={botAvatarUrl} alt="" className="h-full w-full object-cover" />
          ) : null}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-white">{botName || "Bot"}</span>
            <span className="text-[10px] bg-[#5865F2] text-white px-1 rounded">APP</span>
            <span className="text-[11px] text-[#949ba4]">
              Today at {new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </span>
          </div>
          <div
            className="mt-2 rounded border-l-4 bg-[#2b2d31] p-3"
            style={{ borderLeftColor: embedColor }}
          >
            <div className="font-semibold text-white text-sm">{previewTitle}</div>
            <div className="mt-1 text-sm text-[#dbdee1] whitespace-pre-wrap break-words">
              {previewDesc}
            </div>
            <div className="mt-3">
              <span className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded bg-[#5865F2] text-white">
                <Ticket className="h-3.5 w-3.5 mr-1.5" />
                Open Ticket
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 py-2">
      {/* Subtle info note */}
      <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-2.5 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>
          Submitting to <span className="font-medium text-foreground">{botName}</span>. Don't share
          passwords or sensitive info.{" "}
          {isV2 ? (
            <>
              Add an <span className="font-medium text-foreground">Open Ticket</span> button
              manually by inserting a <span className="font-medium text-foreground">Button Row</span> component
              wherever you want it in the panel message.
            </>
          ) : (
            <>
              An <span className="font-medium text-foreground">Open Ticket</span> button
              is added automatically to your panel.
            </>
          )}
        </span>
      </div>

      {/* ── Server + Panel channel (shared across V1/V2) ───────────────── */}
      {botId ? (
        <GuildChannelPicker
          botId={botId}
          guildId={guild?.guild_id ?? null}
          channelId={panelChannel?.channel_id ?? null}
          onGuildChange={setGuild}
          onChannelChange={setPanelChannel}
          guildLabel="Server to post the panel in"
          channelLabel={copy.channelLabel}
        />
      ) : (
        <div className="space-y-2">
          <Label>{copy.channelLabel}</Label>
          <div className="flex items-start gap-2 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>Server &amp; channel picker will appear here once your bot is online.</span>
          </div>
        </div>
      )}

      {/* ── Channel log (ticket variant only) ──────────────────────────── */}
      {!isReport && (
        <div className="space-y-2">
          <Label className="text-sm">Channel log</Label>
          <p className="text-xs text-muted-foreground">
            Where transcripts and event logs are posted when tickets are opened, claimed, or closed.
          </p>
          <label className="relative block">
            <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <select
              value={logChannelId}
              onChange={(e) => setLogChannelId(e.target.value)}
              disabled={!guild?.guild_id || textChannels.length === 0}
              className="h-10 w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm text-foreground ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">
                {!guild?.guild_id
                  ? "Select a server first"
                  : textChannels.length === 0
                    ? "No channels cached — refresh from the panel picker"
                    : "Select a log channel…"}
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
        </div>
      )}







      {isV2 ? (
        <>
          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Panel Message</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                What members see when they open the panel.
              </p>
            </div>
            {hydrated ? (
              <TicketPanelV2Builder
                key={v2BuilderKey}
                ref={v2Ref}
                embedded
                botId={botId}
                botName={botName}
                botAvatarUrl={botAvatarUrl}
                categoryNames={categories.map((c) => c.name.trim()).filter((n) => n.length > 0)}
                initialItems={v2Items ?? undefined}
                onItemsChange={setV2Items}
              />
            ) : (
              <div className="rounded-md border border-border bg-muted/30 px-3 py-6 text-xs text-muted-foreground text-center">
                Loading panel…
              </div>
            )}
          </section>
        </>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(520px,600px)] gap-6 items-stretch">

          {/* LEFT: all form questions */}
          <div className="space-y-6 min-w-0">


            <section className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Panel Message</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  What members see when they open the panel.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="panel-title">
                  {copy.panelTitleLabel} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="panel-title"
                  placeholder={copy.panelTitlePlaceholder}
                  value={panelTitle}
                  onChange={(e) => setPanelTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="panel-description">
                  {copy.panelDescLabel} <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="panel-description"
                  placeholder={copy.panelDescPlaceholder}
                  value={panelDescription}
                  onChange={(e) => setPanelDescription(e.target.value)}
                  rows={5}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="embed-color">Embed Color</Label>
                <div className="flex items-center gap-3">
                  <input
                    id="embed-color"
                    type="color"
                    value={embedColor}
                    onChange={(e) => setEmbedColor(e.target.value)}
                    className="h-9 w-12 cursor-pointer rounded border border-input bg-background"
                  />
                  <Input
                    value={embedColor}
                    onChange={(e) => setEmbedColor(e.target.value)}
                    className="font-mono text-sm w-32"
                  />
                </div>
              </div>
            </section>
          </div>

          {/* RIGHT: sticky live preview */}
          <div className="flex flex-col space-y-2 min-w-0">

            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Live preview
            </div>
            {V1Preview}
          </div>
        </div>
      )}


      {/* Cooldown — report variant only */}
      {isReport && (
        <div className="space-y-2">
          <Label htmlFor="cooldown">
            Cooldown between reports per user (minutes)
          </Label>
          <Input
            id="cooldown"
            type="number"
            min={0}
            value={cooldownMinutes}
            onChange={(e) => setCooldownMinutes(Number(e.target.value))}
          />
          <p className="text-xs text-muted-foreground">
            How long a member has to wait before submitting another report.
          </p>
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Categories */}
      <section id="ticket-categories-section" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {copy.categoriesLabel} <span className="text-destructive">*</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Each category routes to its own staff roles and opening message.
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={addCategory}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add category
          </Button>
        </div>

        <div className="space-y-3">
          {categories.map((cat, idx) => (
            <div
              key={cat.id}
              className="rounded-md border border-border bg-card/40 p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Category {idx + 1}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-muted-foreground hover:text-destructive"
                  onClick={() => removeCategory(cat.id)}
                  disabled={categories.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`cat-name-${cat.id}`} className="text-sm">
                  Category name
                </Label>
                <Input
                  id={`cat-name-${cat.id}`}
                  placeholder={copy.categoryNamePlaceholder}
                  value={cat.name}
                  onChange={(e) =>
                    updateCategory(cat.id, { name: e.target.value })
                  }
                />
              </div>

              <RoleMultiSelect
                label="Roles for this category"
                botId={botId}
                guildId={guild?.guild_id ?? null}
                value={cat.roles}
                onChange={(roles) => updateCategory(cat.id, { roles })}
              />

              <div className="space-y-2">
                <Label htmlFor={`cat-open-${cat.id}`} className="text-sm">
                  {copy.openingLabel}
                </Label>
                <Textarea
                  id={`cat-open-${cat.id}`}
                  placeholder={copy.openingPlaceholder}
                  value={cat.openingMessage}
                  onChange={(e) =>
                    updateCategory(cat.id, { openingMessage: e.target.value })
                  }
                  rows={3}
                />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
});

