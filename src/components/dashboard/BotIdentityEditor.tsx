import { useRef, useState, useEffect } from "react";
import { Bot, Pencil, Upload, Loader2, ChevronDown, ChevronUp, Activity, Check, X, AlertTriangle, Info, Copy, MoreVertical, RefreshCw, Image as ImageIcon } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { OwnedBot } from "@/hooks/useOwnedBots";
import { ImageCropModal, BANNER_RATIO } from "./ImageCropModal";

type PresenceStatus = "online" | "idle" | "dnd" | "invisible";

const PRESENCE_OPTIONS: { value: PresenceStatus; label: string; dot: string }[] = [
  { value: "online", label: "Online", dot: "bg-emerald-500" },
  { value: "idle", label: "Idle", dot: "bg-amber-400" },
  { value: "dnd", label: "Do Not Disturb", dot: "bg-red-500" },
  { value: "invisible", label: "Invisible", dot: "bg-muted-foreground" },
];

const MAX_BYTES = 8 * 1024 * 1024;

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

type Props = {
  bot: OwnedBot;
  onUpdated: () => void;
  badges?: React.ReactNode;
  actions?: React.ReactNode;
  /** Extra items rendered at the bottom of the header "⋯" menu (e.g. Cancel / Leave). */
  menuItems?: React.ReactNode;
  /** When false, Discord-side edits (avatar/banner/username/bio/status) are hidden. */
  enableDiscordEdits?: boolean;
  /** Re-check the bot's live status. Renders the banner Refresh button when set. */
  onRefresh?: () => void | Promise<void>;
};

export const BotIdentityEditor = ({
  bot,
  onUpdated,
  badges,
  actions,
  menuItems,
  enableDiscordEdits = true,
  onRefresh,
}: Props) => {
  const { user } = useAuth();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [savingAvatar, setSavingAvatar] = useState(false);
  const [savingBanner, setSavingBanner] = useState(false);
  // When a file is picked, open the crop/zoom editor before uploading.
  const [crop, setCrop] = useState<{ src: string; mode: "avatar" | "banner" } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      // Brief spin so a fast refresh still reads as an action.
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(bot.bot_name);
  const [savingName, setSavingName] = useState(false);

  const [expanded, setExpanded] = useState(false);
  const [presence, setPresence] = useState<PresenceStatus>(
    (bot.presence_status as PresenceStatus) ?? "online",
  );
  const [activityText, setActivityText] = useState(bot.activity_text ?? "");
  const [bio, setBio] = useState(bot.bot_bio ?? "");
  const [bioError, setBioError] = useState<string | null>(null);
  const [savingDetails, setSavingDetails] = useState(false);
  const [emojiMap, setEmojiMap] = useState<Record<string, { id: string; animated: boolean }>>({});
  const emojiFetchedRef = useRef(false);


  useEffect(() => { setNameDraft(bot.bot_name); }, [bot.bot_name]);
  useEffect(() => {
    setPresence((bot.presence_status as PresenceStatus) ?? "online");
  }, [bot.presence_status]);
  useEffect(() => { setActivityText(bot.activity_text ?? ""); }, [bot.activity_text]);
  useEffect(() => { setBio(bot.bot_bio ?? ""); }, [bot.bot_bio]);

  // Load custom emojis from bot's guilds the first time the bio editor opens.
  useEffect(() => {
    if (!expanded || emojiFetchedRef.current) return;
    emojiFetchedRef.current = true;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("bot-list-emojis", {
          body: { bot_id: bot.id },
        });
        if (error || !data?.emojis) return;
        const map: Record<string, { id: string; animated: boolean }> = {};
        for (const e of data.emojis as Array<{ name: string; id: string; animated: boolean }>) {
          if (!map[e.name]) map[e.name] = { id: e.id, animated: e.animated };
        }
        setEmojiMap(map);
      } catch {
        /* ignore */
      }
    })();
  }, [expanded, bot.id]);

  const resolveEmojis = (text: string): string => {
    if (!Object.keys(emojiMap).length) return text;
    return text.replace(/(?<![<a]):([a-zA-Z0-9_]+):/g, (match, name: string) => {
      const e = emojiMap[name];
      if (!e) return match;
      return `<${e.animated ? "a" : ""}:${name}:${e.id}>`;
    });
  };


  const shortBotId = bot.id.slice(0, 8).toUpperCase();
  // Dispatch bots apply their own About Me at runtime (no manual portal step),
  // so their copy/toasts promise ~60s instead of the manual 24-hour flow.
  const isDispatchBot = (bot.base ?? "").toLowerCase().trim() === "dispatch";
  const copyBotId = async () => {
    try {
      await navigator.clipboard.writeText(bot.id);
      toast.success("Bot ID copied");
    } catch {
      toast.error("Couldn't copy");
    }
  };

  const recentChange = bot.discord_last_username_change_at
    ? Date.now() - new Date(bot.discord_last_username_change_at).getTime() < 60 * 60 * 1000
    : false;

  const callUpdate = async (
    patch: { username?: string; avatar?: string; banner?: string },
  ): Promise<{ ok: boolean; data: any }> => {
    const { data, error } = await supabase.functions.invoke("bot-update-identity", {
      body: { bot_id: bot.id, ...patch },
    });
    if (error || !(data as any)?.ok) {
      const msg = (data as any)?.error ?? error?.message ?? "Update failed";
      toast.error("Discord update failed", { description: msg });
      return { ok: false, data };
    }
    return { ok: true, data };
  };

  // Picking a file no longer uploads straight away — it opens the crop/zoom
  // editor. The cropped result is what actually gets uploaded (see onCropApply).
  const onAvatarPick = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image file");
    if (file.size > MAX_BYTES) return toast.error("Image must be under 8 MB");
    setCrop({ src: await fileToDataUrl(file), mode: "avatar" });
  };

  const onBannerPick = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image file");
    if (file.size > MAX_BYTES) return toast.error("Image must be under 8 MB");
    setCrop({ src: await fileToDataUrl(file), mode: "banner" });
  };

  const uploadAvatar = async (dataUrl: string) => {
    setSavingAvatar(true);
    try {
      const { ok } = await callUpdate({ avatar: dataUrl });
      if (ok) {
        toast.success("Confirmed", {
          description: "Allow up to 60 seconds for the change to take effect.",
        });
        onUpdated();
      }
      return ok;
    } finally {
      setSavingAvatar(false);
    }
  };

  const uploadBanner = async (dataUrl: string) => {
    setSavingBanner(true);
    try {
      const { ok, data } = await callUpdate({ banner: dataUrl });
      console.log("[banner] callUpdate result", { ok, data });
      if (ok) {
        toast.success("Confirmed", {
          description: "Allow up to 60 seconds for the change to take effect.",
        });
        onUpdated();
        await notifyBannerUploaded((data as any)?.banner_url ?? null);
      }
      return ok;
    } finally {
      setSavingBanner(false);
    }
  };

  const onCropApply = async (dataUrl: string) => {
    if (!crop) return;
    const ok = crop.mode === "avatar" ? await uploadAvatar(dataUrl) : await uploadBanner(dataUrl);
    if (ok) setCrop(null);
  };

  const notifyBannerUploaded = async (bannerUrl: string | null) => {
    console.log("[banner] notifyBannerUploaded start", { bannerUrl, hasUser: !!user });
    if (!user) {
      console.warn("[banner] no user; skipping notify");
      toast.error("Banner notification skipped", { description: "Not signed in" });
      return;
    }
    try {
      const shortId = bot.id.slice(0, 8).toUpperCase();
      let tokenLabel: string | null = null;
      try {
        const { data: labelData } = await (supabase as any).rpc(
          "get_bot_token_label",
          { _bot_id: bot.id },
        );
        if (typeof labelData === "string" && labelData.trim()) {
          tokenLabel = labelData.trim();
        }
      } catch (labelErr) {
        console.warn("token label lookup failed", labelErr);
      }

      const embedDescription =
        `**Order ID:** \`${bot.id}\`\n` +
        `**Bot:** ${bot.bot_name} (\`#${shortId}\`)\n` +
        `**Discord App:** ${tokenLabel ?? "Unknown"}\n` +
        `**Customer:** ${user.email ?? user.id}` +
        (bannerUrl ? `\n\n[Banner image](${bannerUrl})` : "");

      const embed: Record<string, unknown> = {
        author: { name: "Banner Logging" },
        title: "New Banner upload request",
        description: embedDescription,
        footer: { text: "Banner update request" },
        color: 0x3b82f6,
      };
      if (bannerUrl) (embed as any).image = { url: bannerUrl };

      const insertRow = {
        bot_id: "e7f81d81-5645-4d81-93d4-1ae58b6ba77f",
        user_id: user.id,
        requested_by: user.id,
        action: "send_channel_message",
        status: "pending",
        payload: {
          channel_id: "1507436615910428916",
          content: "||@here||",
          order_id: bot.id,
          bot_name: bot.bot_name,
          short_id: shortId,
          customer: user.email ?? user.id,
          token_label: tokenLabel,
          banner_url: bannerUrl,
          embed,
        },
      };
      console.log("[banner] inserting bot_commands row");

      const { data: insertData, error: cmdErr } = await (supabase as any)
        .from("bot_commands")
        .insert(insertRow)
        .select("id")
        .single();
      if (cmdErr) {
        console.error("[banner] notify insert failed", cmdErr);
        toast.error("Banner notification failed", { description: cmdErr.message });
      } else {
        console.log("[banner] notify insert ok", insertData);
      }
    } catch (e: any) {
      console.error("[banner] notify failed", e);
      toast.error("Banner notification failed", { description: e?.message ?? String(e) });
    }
  };


  const saveName = async () => {
    const trimmed = nameDraft.trim();
    if (trimmed === bot.bot_name) {
      setEditingName(false);
      return;
    }
    if (trimmed.length < 2 || trimmed.length > 32) {
      toast.error("Username must be 2-32 characters");
      return;
    }
    setSavingName(true);
    const { ok } = await callUpdate({ username: trimmed });
    setSavingName(false);
    if (ok) {
      // Ensure bot_orders.bot_name is in sync even if the edge function's
      // persist step silently failed or was skipped.
      const { error: updErr } = await supabase
        .from("bot_orders")
        .update({ bot_name: trimmed })
        .eq("id", bot.id);
      if (updErr) {
        console.warn("[saveName] bot_orders bot_name update failed", updErr);
      }
      toast.success("Username updated on Discord");
      setEditingName(false);
      onUpdated();
    }
  };

  const cancelName = () => {
    setNameDraft(bot.bot_name);
    setEditingName(false);
  };

  const saveDetails = async () => {
    if (!user) return toast.error("Sign in required");

    const presenceChanged = presence !== ((bot.presence_status as PresenceStatus) ?? "online");
    const activityChanged = (activityText ?? "") !== (bot.activity_text ?? "");
    const bioTrimmed = bio.trim();
    const bioChanged = bioTrimmed !== ((bot.bot_bio ?? "").trim());

    if (!presenceChanged && !activityChanged && !bioChanged) {
      toast.info("Nothing to save");
      return;
    }

    if (bioChanged && bioTrimmed.length > 190) {
      toast.error("About Me must be 190 characters or fewer");
      return;
    }

    if (bioError) {
      toast.error("Fix the About Me error before saving");
      return;
    }

    setSavingDetails(true);
    const errors: string[] = [];
    let anySucceeded = false;
    let bioSubmitted = false;
    try {
      if (presenceChanged || activityChanged) {
        const activityType = bot.activity_type ?? "playing";
        try {
          const { error: upErr } = await (supabase as any)
            .from("bot_orders")
            .update({
              activity_type: activityType,
              activity_text: activityText || null,
              presence_status: presence,
            })
            .eq("id", bot.id);
          if (upErr) throw upErr;

          const { error: cmdErr } = await (supabase as any)
            .from("bot_commands")
            .insert({
              bot_id: bot.id,
              user_id: user.id,
              requested_by: user.id,
              action: "set_status",
              payload: {
                activity_type: activityType,
                // Send both keys: the worker reads `activity_text`, while some
                // bot runtimes read `status_text`. Keeping both avoids the
                // activity label being silently dropped.
                activity_text: activityText,
                status_text: activityText,
                presence_status: presence,
              },
            });
          if (cmdErr) throw cmdErr;
          anySucceeded = true;
        } catch (e: any) {
          console.error("set_status save failed", e);
          const msg = e?.message ?? "unknown error";
          errors.push(`status (${msg})`);
          toast.error("Couldn't save status", { description: msg });
        }
      }

      if (bioChanged) {
        try {
          const { error: upErr } = await (supabase as any)
            .from("bot_orders")
            .update({ bot_bio: bioTrimmed || null })
            .eq("id", bot.id);
          if (upErr) throw upErr;

          const shortId = bot.id.slice(0, 8).toUpperCase();
          let tokenLabel: string | null = null;
          try {
            const { data: labelData } = await (supabase as any).rpc(
              "get_bot_token_label",
              { _bot_id: bot.id },
            );
            if (typeof labelData === "string" && labelData.trim()) {
              tokenLabel = labelData.trim();
            }
          } catch (labelErr) {
            console.warn("token label lookup failed", labelErr);
          }

          const embedDescription =
            `**Order ID:** \`${bot.id}\`\n` +
            `**Bot:** ${bot.bot_name} (\`#${shortId}\`)\n` +
            `**Discord App:** ${tokenLabel ?? "Unknown"}\n` +
            `**Customer:** ${user.email ?? user.id}\n\n` +
            `**Requested Description:**\n${bioTrimmed}`;

          const { error: cmdErr } = await (supabase as any)
            .from("bot_commands")
            .insert([
              {
                bot_id: "e7f81d81-5645-4d81-93d4-1ae58b6ba77f",
                user_id: user.id,
                requested_by: user.id,
                action: "bio_update_request",
                status: "pending",
                payload: {
                  bot_name: bot.bot_name,
                  bio: bioTrimmed,
                  token_label: tokenLabel,
                },
              },
              {
                bot_id: "e7f81d81-5645-4d81-93d4-1ae58b6ba77f",
                user_id: user.id,
                requested_by: user.id,
                action: "send_channel_message",
                status: "pending",
                payload: {
                  channel_id: "1507437307349962842",
                  content: "||@here||",
                  order_id: bot.id,
                  bot_name: bot.bot_name,
                  short_id: shortId,
                  customer: user.email ?? user.id,
                  description: bioTrimmed,
                  token_label: tokenLabel,
                  embed: {
                    author: { name: "Description Logging" },
                    title: "New About Me update request",
                    description: embedDescription,
                    footer: { text: "Description update request" },
                    color: 0x3b82f6,
                  },
                },
              },
            ]);

          if (cmdErr) throw cmdErr;


          anySucceeded = true;
          bioSubmitted = true;
        } catch (e: any) {
          console.error("bio request save failed", e);
          const msg = e?.message ?? "unknown error";
          errors.push(`about me (${msg})`);
          toast.error("Couldn't submit About Me request", { description: msg });
        }
      }

      if (errors.length === 0) {
        if (bioSubmitted && !isDispatchBot) {
          toast.success("Request submitted", {
            description: "Our team will apply your About Me within 24 hours.",
          });
        } else {
          toast.success("Confirmed", {
            description: "Allow up to 60 seconds for the change to take effect.",
          });
        }
      } else if (anySucceeded) {
        toast.warning("Partially saved", {
          description: `Failed: ${errors.join(", ")}`,
        });
      }
      if (anySucceeded) onUpdated();
    } finally {
      setSavingDetails(false);
    }
  };

  return (
    <div className="bid">
      <style>{BID_CSS}</style>
      <div className="card">
      {/* Banner — uploaded image, or an icy gradient fallback */}
      <div className={`pbanner${bot.banner_url ? " hasimg" : ""}`}>
        {bot.banner_url && <img src={bot.banner_url} alt={`${bot.bot_name} banner`} />}

        {/* Edit banner — visible affordance, top-left */}
        {enableDiscordEdits && (
          <button
            type="button"
            onClick={() => bannerInputRef.current?.click()}
            disabled={savingBanner}
            className="pbtn bnedit"
            aria-label="Edit banner"
          >
            {savingBanner ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon />}
            <span>{savingBanner ? "Uploading…" : "Edit banner"}</span>
          </button>
        )}

        {/* Refresh + actions + menu, top-right */}
        <div className="pacts">
          {onRefresh && (
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="pbtn icon"
              aria-label="Refresh status"
              title="Refresh status"
            >
              <RefreshCw className={refreshing ? "animate-spin" : ""} />
            </button>
          )}
          {actions}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="pbtn icon" aria-label="More">
                <MoreVertical />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onSelect={copyBotId} className="gap-2">
                <Copy className="h-4 w-4" />
                Copy bot ID
                <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                  #{shortBotId}
                </span>
              </DropdownMenuItem>
              {enableDiscordEdits && (
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    bannerInputRef.current?.click();
                  }}
                  className="gap-2"
                  disabled={savingBanner}
                >
                  {savingBanner ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Change banner
                </DropdownMenuItem>
              )}
              {menuItems && (
                <>
                  <DropdownMenuSeparator />
                  {menuItems}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {enableDiscordEdits && (
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onBannerPick(f);
              e.target.value = "";
            }}
          />
        )}
      </div>

      {/* Body — avatar overlaps banner, then name + meta */}
      <div className="pbody">
        <div className="prow">
          {/* Avatar (with inline edit) */}
          <div className="avatar">
            {bot.icon_url ? (
              <img src={bot.icon_url} alt={bot.bot_name} />
            ) : (
              <Bot />
            )}
            {enableDiscordEdits && (
              <>
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={savingAvatar}
                  aria-label="Change icon"
                  className="edit"
                >
                  {savingAvatar ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Pencil className="h-3 w-3" />
                  )}
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onAvatarPick(f);
                    e.target.value = "";
                  }}
                />
              </>
            )}
          </div>

          {/* Name + meta */}
          <div className="pident">
            <div className="nrow">
              {editingName ? (
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <Input
                    ref={nameInputRef}
                    autoFocus
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); saveName(); }
                      if (e.key === "Escape") { e.preventDefault(); cancelName(); }
                    }}
                    onBlur={() => { if (!savingName) saveName(); }}
                    maxLength={32}
                    minLength={2}
                    disabled={savingName}
                    className="h-9 text-lg font-bold"
                  />
                  {savingName ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={saveName}
                        className="p-1 text-emerald-400 hover:text-emerald-300"
                        aria-label="Save name"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={cancelName}
                        className="p-1 text-muted-foreground hover:text-foreground"
                        aria-label="Cancel"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <h1>{bot.bot_name}</h1>
                  {enableDiscordEdits && (
                    <button
                      type="button"
                      onClick={() => setEditingName(true)}
                      className="pen"
                      aria-label="Edit name"
                    >
                      <Pencil />
                    </button>
                  )}
                </>
              )}
            </div>

            {badges && <div className="metawrap">{badges}</div>}
            {recentChange && (
              <div className="warn">
                <AlertTriangle />
                <span>Discord limits username changes to 2 per hour.</span>
              </div>
            )}
          </div>
        </div>

      {/* Bio & status editor */}
      {enableDiscordEdits && (
        <div className="biorow">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="biotoggle"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {expanded ? "Hide bio & status" : "Edit bio & status"}
          </button>

          {expanded && (
            <div
              className="bioeditor"
              style={{
                marginTop: 14,
                border: "1px solid rgba(201,219,230,.22)",
                borderRadius: 14,
                background: "#20262d",
                padding: "24px 28px",
                display: "flex",
                flexDirection: "column",
                gap: 18,
                boxShadow: "inset 0 1px 0 rgba(255,255,255,.03)",
              }}
            >
              <div className="biofield">
                <label htmlFor="bot-bio" className="biolabel">
                  <Info />
                  About Me
                </label>
                <Textarea
                  id="bot-bio"
                  value={bio}
                  onChange={(e) => {
                    setBio(resolveEmojis(e.target.value));
                  }}
                  maxLength={190}
                  rows={3}
                  placeholder="Describe what your bot does…"
                  disabled={savingDetails}
                  className="resize-none bg-[var(--bpanel)] border-[var(--bhair)] text-[var(--bheading)]"
                  style={{ padding: "10px 13px" }}
                />
                {bioError && (
                  <div className="bioerr">
                    <AlertTriangle />
                    <span>{bioError}</span>
                  </div>
                )}
                <div className="bionote">
                  <Info />
                  <span>
                    {isDispatchBot
                      ? "Your About Me applies automatically — allow up to 60 seconds for it to appear on your bot's profile."
                      : "Discord doesn't let bots change their own About Me through the API. When you save, we send the request to our team and apply it manually — usually within 24 hours."}
                  </span>
                </div>
                <div className="biocount">{bio.length}/190</div>
              </div>

              <div className="biogrid">
                <div className="biofield">
                  <label className="biolabel">
                    <Activity />
                    Online status
                  </label>
                  <Select
                    value={presence}
                    onValueChange={(v) => setPresence(v as PresenceStatus)}
                    disabled={savingDetails}
                  >
                    <SelectTrigger
                      className="bg-[var(--bpanel)] border-[var(--bhair)] text-[var(--bheading)]"
                      style={{ paddingLeft: 13, paddingRight: 12 }}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRESENCE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          <span className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${o.dot}`} />
                            {o.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="biofield">
                  <label htmlFor="bot-status-msg" className="biolabel">Status message</label>
                  <Input
                    id="bot-status-msg"
                    value={activityText}
                    onChange={(e) => setActivityText(e.target.value)}
                    maxLength={128}
                    placeholder="e.g. helping out"
                    disabled={savingDetails}
                    className="bg-[var(--bpanel)] border-[var(--bhair)] text-[var(--bheading)]"
                    style={{ paddingLeft: 13, paddingRight: 13 }}
                  />
                </div>
              </div>

              <div className="bioactions">
                <Button
                  size="sm"
                  onClick={saveDetails}
                  disabled={savingDetails || !!bioError}
                  className="min-w-[120px]"
                >
                  {savingDetails ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
      </div>{/* pbody */}

      </div>

      {crop && (
        <ImageCropModal
          src={crop.src}
          mode={crop.mode}
          bannerRatio={BANNER_RATIO}
          busy={savingAvatar || savingBanner}
          onApply={onCropApply}
          onCancel={() => setCrop(null)}
        />
      )}
    </div>
  );
};

const BID_CSS = `
.bid{
  --bpanel:#272e36;--bpanel2:#242b32;--bsurface:#2d353e;--bsurface2:#343d46;--bhair:#3a434d;
  --bheading:#E8EEF3;--bbody:#A8B4BF;--bfaint:#788591;--baccent:#C9DBE6;--baccentink:#1E242B;
  --bok:#86d3a1;--bgold:#cbb277;
  --bdisp:"Bricolage Grotesque",system-ui,sans-serif;--bbodyf:"Space Grotesk",system-ui,sans-serif;--bmono:"Space Mono",monospace;
}
.bid .card{position:relative;background:linear-gradient(180deg,var(--bpanel),var(--bpanel2));border:1px solid var(--bhair);
  border-radius:18px;box-shadow:0 24px 60px -32px rgba(0,0,0,.6)}

/* Banner — uploaded image, or an icy gradient fallback. Only the banner clips
   (rounded top corners); the card itself must NOT clip, or the bio panel /
   Save button get sliced off at the rounded bottom corners. */
.bid .pbanner{position:relative;height:132px;border-radius:17px 17px 0 0;overflow:hidden;
  background:radial-gradient(120% 160% at 18% -20%,rgba(201,219,230,.22),transparent 60%),
    linear-gradient(120deg,#2c353f 0%,#323d48 45%,#3b4753 100%)}
.bid .pbanner.hasimg{background:#20262d}
.bid .pbanner>img{position:absolute;inset:0;height:100%;width:100%;object-fit:cover;display:block}
.bid .pbanner::after{content:"";position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(180deg,rgba(24,28,34,0) 40%,rgba(24,28,34,.5) 100%)}

.bid .pbtn{position:relative;z-index:2;height:34px;display:inline-flex;align-items:center;gap:7px;padding:0 12px;
  border-radius:9px;background:rgba(20,24,28,.55);border:1px solid rgba(255,255,255,.14);color:var(--bheading);
  font-family:var(--bbodyf);font-size:12.5px;font-weight:600;cursor:pointer;backdrop-filter:blur(6px);transition:.15s}
.bid .pbtn:hover{background:rgba(20,24,28,.72);border-color:rgba(201,219,230,.4)}
.bid .pbtn:disabled{opacity:.6;cursor:default}
.bid .pbtn.icon{width:34px;justify-content:center;padding:0}
.bid .pbtn svg{width:15px;height:15px;stroke:currentColor;stroke-width:1.9;fill:none}
.bid .bnedit{position:absolute;top:14px;left:14px}
.bid .pacts{position:absolute;top:14px;right:14px;z-index:2;display:flex;align-items:center;gap:8px}
/* Let the parent-supplied "Add add-ons" button match the banner buttons */
.bid .pacts>button{height:34px;border-radius:9px;background:rgba(20,24,28,.55);border:1px solid rgba(255,255,255,.14);
  color:var(--bheading);backdrop-filter:blur(6px)}
.bid .pacts>button:hover{background:rgba(20,24,28,.72);border-color:rgba(201,219,230,.4)}

/* Body — avatar overlaps banner */
.bid .pbody{position:relative;padding:0 22px 18px}
.bid .prow{display:flex;align-items:flex-end;gap:16px;margin-top:-40px}
.bid .avatar{position:relative;height:88px;width:88px;border-radius:20px;flex:none;overflow:hidden;
  background:color-mix(in srgb,var(--baccent) 12%,var(--bpanel));border:4px solid var(--bpanel);
  display:grid;place-items:center;box-shadow:0 10px 30px -10px rgba(0,0,0,.7)}
.bid .avatar>img{height:100%;width:100%;object-fit:cover}
.bid .avatar>svg{width:38px;height:38px;stroke:var(--baccent);stroke-width:1.6;fill:none}
.bid .avatar .edit{position:absolute;bottom:4px;right:4px;height:26px;width:26px;border-radius:50%;background:var(--baccent);
  color:var(--baccentink);border:2px solid var(--bpanel);display:grid;place-items:center;cursor:pointer}
.bid .avatar .edit:disabled{opacity:.6}
.bid .avatar .edit svg{width:12px;height:12px;stroke:currentColor;stroke-width:2.2;fill:none}
.bid .pident{flex:1;min-width:0;padding-bottom:4px}
.bid .nrow{display:flex;align-items:center;gap:9px;min-width:0}
.bid .nrow h1{font-family:var(--bdisp);font-weight:800;font-size:25px;color:var(--bheading);margin:0;letter-spacing:-.02em;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bid .nrow .pen{color:var(--bfaint);cursor:pointer;display:grid;place-items:center;padding:3px;background:none;border:0}
.bid .nrow .pen:hover{color:var(--bbody)} .bid .nrow .pen svg{width:15px;height:15px;stroke:currentColor;stroke-width:1.9;fill:none}

/* Meta rows (supplied by parent as .meta1 / .meta2) */
.bid .metawrap{margin-top:9px;display:flex;flex-direction:column;gap:8px}
.bid .meta1{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.bid .basetype{display:inline-flex;align-items:center;gap:7px;font-size:13px;font-weight:600;color:var(--bheading)}
.bid .basetype svg{width:14px;height:14px;stroke:var(--baccent);stroke-width:1.8;fill:none}
.bid .meta2{display:flex;align-items:center;gap:9px;font-size:12px;color:var(--bfaint);flex-wrap:wrap;line-height:1.2}
.bid .meta2 svg{width:13px;height:13px}
.bid .warn{margin-top:8px;display:flex;align-items:flex-start;gap:6px;font-size:11px;color:var(--bgold)}
.bid .warn svg{width:12px;height:12px;margin-top:2px;flex:none;stroke:currentColor;stroke-width:1.9;fill:none}

.bid .biorow{padding:16px 0 0}
.bid .biotoggle{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--bhair);background:rgba(255,255,255,.02);
  border-radius:9px;padding:8px 13px;font-family:var(--bbodyf);font-size:12.5px;font-weight:500;color:var(--bfaint);cursor:pointer}
.bid .biotoggle:hover{background:var(--bsurface2);color:var(--bbody)}
.bid .biotoggle svg{width:13px;height:13px;stroke:currentColor;stroke-width:1.9;fill:none}

/* Expanded bio & status editor — matched to the card's design language */
.bid .bioeditor{margin-top:14px;border:1px solid var(--bhair);border-radius:14px;background:var(--bpanel2);
  padding:22px 26px;display:flex;flex-direction:column;gap:18px}
.bid .biofield{display:flex;flex-direction:column;gap:8px;min-width:0}
.bid .biolabel{display:inline-flex;align-items:center;gap:7px;font-family:var(--bbodyf);font-size:12px;font-weight:600;
  color:var(--bheading);letter-spacing:.01em}
.bid .biolabel svg{width:13px;height:13px;stroke:var(--baccent);stroke-width:2;fill:none}
.bid .bionote{display:flex;align-items:flex-start;gap:9px;border-radius:11px;background:rgba(201,219,230,.06);
  border:1px solid rgba(201,219,230,.14);padding:11px 13px;font-family:var(--bbodyf);font-size:11.5px;color:var(--bbody);line-height:1.55}
.bid .bionote svg{width:14px;height:14px;flex:none;margin-top:1px;stroke:var(--baccent);stroke-width:2;fill:none}
.bid .bioerr{display:flex;align-items:flex-start;gap:9px;border-radius:11px;background:rgba(239,68,68,.1);
  border:1px solid rgba(239,68,68,.25);padding:10px 12px;font-size:11.5px;color:#f4a6a6}
.bid .bioerr svg{width:14px;height:14px;flex:none;margin-top:1px;stroke:currentColor;stroke-width:2;fill:none}
.bid .biocount{font-size:10.5px;color:var(--bfaint);text-align:right;font-variant-numeric:tabular-nums}
.bid .biogrid{display:grid;grid-template-columns:1fr;gap:16px}
.bid .biogrid>*{min-width:0}
@media(min-width:560px){.bid .biogrid{grid-template-columns:1fr 1fr}}
.bid .bioactions{display:flex;justify-content:flex-end}
`;
