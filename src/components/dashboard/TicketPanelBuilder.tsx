import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, AlertTriangle, Info } from "lucide-react";
import { GuildChannelPicker } from "./GuildChannelPicker";
import type { BotGuild, BotChannel } from "@/hooks/useGuildChannels";
import { useActiveGuild } from "@/hooks/useActiveGuild";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Category = {
  id: string;
  name: string;
  roles: string;
  openingMessage: string;
};

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

type Variant = "ticket" | "report";

export type TicketPanelBuilderHandle = {
  save: () => Promise<boolean>;
};

type Props = {
  botId?: string;
  botName: string;
  variant?: Variant;
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
  function TicketPanelBuilder({ botId, botName, variant = "ticket" }, ref) {
  const copy = COPY[variant];
  const isReport = variant === "report";
  const feature = isReport ? "reports" : "tickets";

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
  const [categories, setCategories] = useState<Category[]>([
    { id: uid(), name: "", roles: "", openingMessage: "" },
  ]);

  // Hydrate from existing bot_config row.
  useEffect(() => {
    if (!botId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("bot_config")
        .select("config")
        .eq("bot_id", botId)
        .eq("feature", feature)
        .maybeSingle();
      if (cancelled || !data?.config) return;
      const cfg = data.config as Record<string, unknown>;
      if (typeof cfg.panel_title === "string") setPanelTitle(cfg.panel_title);
      if (typeof cfg.panel_description === "string")
        setPanelDescription(cfg.panel_description);
      if (typeof cfg.cooldown_minutes === "number")
        setCooldownMinutes(cfg.cooldown_minutes);
      if (Array.isArray(cfg.categories) && cfg.categories.length) {
        setCategories(
          (cfg.categories as Array<Record<string, unknown>>).map((c) => ({
            id: uid(),
            name: String(c.name ?? ""),
            roles: String(c.roles ?? ""),
            openingMessage: String(c.opening_message ?? ""),
          })),
        );
      }
      if (cfg.guild_id && cfg.channel_id) {
        setPanelChannel({
          channel_id: String(cfg.channel_id),
          channel_name: String(cfg.channel_name ?? ""),
        } as BotChannel);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [botId, feature]);

  const updateCategory = (id: string, patch: Partial<Category>) =>
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );

  const addCategory = () =>
    setCategories((prev) => [
      ...prev,
      { id: uid(), name: "", roles: "", openingMessage: "" },
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
      if (!panelTitle.trim()) {
        toast.error("Panel title is required");
        return false;
      }
      if (!panelDescription.trim()) {
        toast.error("Panel description is required");
        return false;
      }
      const cleanedCategories = categories
        .map((c) => ({
          name: c.name.trim(),
          roles: c.roles.trim(),
          opening_message: c.openingMessage.trim(),
        }))
        .filter((c) => c.name.length > 0);
      if (cleanedCategories.length === 0) {
        toast.error("Add at least one category");
        return false;
      }

      const payload = {
        bot_id: botId,
        feature,
        config: {
          variant,
          guild_id: guild?.guild_id ?? null,
          guild_name: guild?.guild_name ?? null,
          channel_id: panelChannel?.channel_id ?? null,
          channel_name: panelChannel?.channel_name ?? null,
          panel_title: panelTitle.trim(),
          panel_description: panelDescription.trim(),
          cooldown_minutes: isReport ? cooldownMinutes : null,
          categories: cleanedCategories,
        },
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("bot_config")
        .upsert(payload, { onConflict: "bot_id,feature" });
      if (error) {
        toast.error(`Save failed: ${error.message}`);
        return false;
      }

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
      return true;
    },
  }));

  return (
    <div className="space-y-5 py-2">
      {/* Warning banner */}
      <div className="flex items-start gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
        <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-sm text-foreground/90">
          This form will be submitted to{" "}
          <span className="font-semibold">{botName}</span>. Do not share
          passwords or other sensitive information.
        </p>
      </div>

      {/* Server + channel picker */}
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

      {/* Panel title */}
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

      {/* Panel description */}
      <div className="space-y-2">
        <Label htmlFor="panel-description">
          {copy.panelDescLabel} <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="panel-description"
          placeholder={copy.panelDescPlaceholder}
          value={panelDescription}
          onChange={(e) => setPanelDescription(e.target.value)}
          rows={3}
        />
      </div>

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

      {/* Categories — each with a paired roles + opening message */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>
            {copy.categoriesLabel}{" "}
            <span className="text-destructive">*</span>
          </Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={addCategory}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add category
          </Button>
        </div>

        <div className="space-y-3">
          {categories.map((cat, idx) => (
            <div
              key={cat.id}
              className="rounded-md border border-border bg-card/40 p-3 space-y-3"
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

              <div className="space-y-2">
                <Label htmlFor={`cat-roles-${cat.id}`} className="text-sm">
                  Roles for this category
                </Label>
                <Textarea
                  id={`cat-roles-${cat.id}`}
                  placeholder={copy.rolesPlaceholder}
                  value={cat.roles}
                  onChange={(e) =>
                    updateCategory(cat.id, { roles: e.target.value })
                  }
                  rows={2}
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separate multiple roles. One line per group if needed.
                </p>
              </div>

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
      </div>
    </div>
  );
});
