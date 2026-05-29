import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Info, Ticket } from "lucide-react";
import { GuildChannelPicker } from "./GuildChannelPicker";
import { RoleMultiSelect } from "./RoleMultiSelect";
import type { BotGuild, BotChannel } from "@/hooks/useGuildChannels";
import { useActiveGuild } from "@/hooks/useActiveGuild";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  MessagesV2Builder,
  type MessagesV2BuilderHandle,
  type V2Item,
} from "./MessagesV2Builder";

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
};

type Props = {
  botId?: string;
  botName: string;
  botAvatarUrl?: string | null;
  variant?: Variant;
  engineVersion?: "v1" | "v2";
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
    { botId, botName, botAvatarUrl, variant = "ticket", engineVersion = "v1" },
    ref,
  ) {
  const copy = COPY[variant];
  const isReport = variant === "report";
  const isV2 = engineVersion === "v2";
  const feature = isReport ? "reports" : "tickets";

  const v2Ref = useRef<MessagesV2BuilderHandle>(null);


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

  // Intentionally do NOT hydrate from bot_config — every time the dialog
  // opens, the form starts blank so previously-sent text doesn't reappear.

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
          categories: cleanedCategories,
          components_v2: isV2 ? v2Items : null,
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
          passwords or sensitive info. An <span className="font-medium text-foreground">Open Ticket</span> button
          is added automatically to your panel.
        </span>
      </div>

      {isV2 ? (
        <>
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

          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Panel Message</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                What members see when they open the panel.
              </p>
            </div>
            <MessagesV2Builder
              ref={v2Ref}
              embedded
              botId={botId}
              botName={botName}
              botAvatarUrl={botAvatarUrl}
              previewExtras={
                <div className="flex flex-wrap gap-2 pt-1">
                  <span className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded bg-[#5865F2] text-white">
                    <Ticket className="h-3.5 w-3.5 mr-1.5" />
                    Open Ticket
                  </span>
                </div>
              }
            />
          </section>
        </>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(520px,600px)] gap-6 items-stretch">

          {/* LEFT: all form questions */}
          <div className="space-y-6 min-w-0">
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
          <div className="lg:sticky lg:top-2 lg:self-start space-y-2">
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
      <section className="space-y-4">
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

