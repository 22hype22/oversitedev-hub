import { useRef, useState, useEffect } from "react";
import { Bot, Image as ImageIcon, Pencil, Upload, Loader2, ChevronDown, ChevronUp, Activity, Check, X, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { OwnedBot } from "@/hooks/useOwnedBots";

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
  /** When false, Discord-side edits (avatar/banner/username/bio/status) are hidden. */
  enableDiscordEdits?: boolean;
};

export const BotIdentityEditor = ({
  bot,
  onUpdated,
  badges,
  actions,
  enableDiscordEdits = true,
}: Props) => {
  const { user } = useAuth();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [savingAvatar, setSavingAvatar] = useState(false);
  const [savingBanner, setSavingBanner] = useState(false);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(bot.bot_name);
  const [savingName, setSavingName] = useState(false);

  const [expanded, setExpanded] = useState(false);
  const [bio, setBio] = useState(bot.bot_bio ?? "");
  const [presence, setPresence] = useState<PresenceStatus>(
    (bot.presence_status as PresenceStatus) ?? "online",
  );
  const [activityText, setActivityText] = useState(bot.activity_text ?? "");
  const [savingDetails, setSavingDetails] = useState(false);

  useEffect(() => { setNameDraft(bot.bot_name); }, [bot.bot_name]);
  useEffect(() => { setBio(bot.bot_bio ?? ""); }, [bot.bot_bio]);
  useEffect(() => {
    setPresence((bot.presence_status as PresenceStatus) ?? "online");
  }, [bot.presence_status]);
  useEffect(() => { setActivityText(bot.activity_text ?? ""); }, [bot.activity_text]);

  const recentChange = bot.discord_last_username_change_at
    ? Date.now() - new Date(bot.discord_last_username_change_at).getTime() < 60 * 60 * 1000
    : false;

  const callUpdate = async (
    patch: { username?: string; bio?: string; avatar?: string; banner?: string },
  ): Promise<boolean> => {
    const { data, error } = await supabase.functions.invoke("bot-update-identity", {
      body: { bot_id: bot.id, ...patch },
    });
    if (error || !(data as any)?.ok) {
      const msg = (data as any)?.error ?? error?.message ?? "Update failed";
      toast.error("Discord update failed", { description: msg });
      return false;
    }
    return true;
  };

  const onAvatarPick = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image file");
    if (file.size > MAX_BYTES) return toast.error("Image must be under 8 MB");
    setSavingAvatar(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const ok = await callUpdate({ avatar: dataUrl });
      if (ok) {
        toast.success("Avatar updated on Discord");
        onUpdated();
      }
    } finally {
      setSavingAvatar(false);
    }
  };

  const onBannerPick = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image file");
    if (file.size > MAX_BYTES) return toast.error("Image must be under 8 MB");
    setSavingBanner(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const ok = await callUpdate({ banner: dataUrl });
      if (ok) {
        toast.success("Banner updated on Discord");
        onUpdated();
      }
    } finally {
      setSavingBanner(false);
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
    const ok = await callUpdate({ username: trimmed });
    setSavingName(false);
    if (ok) {
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
    if (bio.length > 190) return toast.error("Bio must be 190 characters or fewer");

    const bioChanged = (bio ?? "") !== (bot.bot_bio ?? "");
    const presenceChanged = presence !== ((bot.presence_status as PresenceStatus) ?? "online");
    const activityChanged = (activityText ?? "") !== (bot.activity_text ?? "");

    if (!bioChanged && !presenceChanged && !activityChanged) {
      toast.info("Nothing to save");
      return;
    }

    setSavingDetails(true);
    try {
      if (bioChanged) {
        const ok = await callUpdate({ bio });
        if (!ok) return;
      }

      if (presenceChanged || activityChanged) {
        const activityType = bot.activity_type ?? "playing";
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
              activity_text: activityText,
              presence_status: presence,
            },
          });
        if (cmdErr) throw cmdErr;
      }

      toast.success("Saved", {
        description: "Your bot will apply changes shortly.",
      });
      onUpdated();
    } catch (e: any) {
      toast.error("Couldn't save", { description: e?.message });
    } finally {
      setSavingDetails(false);
    }
  };

  return (
    <Card className="overflow-hidden bg-card/60 border-border">
      {/* Banner */}
      <div className="relative h-36 sm:h-44 w-full bg-gradient-to-br from-primary/20 via-primary/5 to-background border-b border-border">
        {bot.banner_url ? (
          <img
            src={bot.banner_url}
            alt={`${bot.bot_name} banner`}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-muted-foreground">
            <div className="flex items-center gap-2 text-xs">
              <ImageIcon className="h-4 w-4" />
              No banner uploaded
            </div>
          </div>
        )}

        {enableDiscordEdits && (
          <div className="absolute top-3 right-3">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => bannerInputRef.current?.click()}
              disabled={savingBanner}
              className="backdrop-blur bg-background/70 hover:bg-background/90"
            >
              {savingBanner ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-1.5" />
              )}
              Upload banner
            </Button>
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
          </div>
        )}
      </div>

      {/* Icon + name row */}
      <div className="px-5 pb-5 -mt-10 flex items-end gap-4 flex-wrap">
        <div className="relative shrink-0 group">
          <div className="h-20 w-20 rounded-2xl bg-primary/10 border-4 border-card grid place-items-center overflow-hidden shadow-md">
            {bot.icon_url ? (
              <img src={bot.icon_url} alt={bot.bot_name} className="h-full w-full object-cover" />
            ) : (
              <Bot className="h-8 w-8 text-primary" />
            )}
          </div>
          {enableDiscordEdits && (
            <>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={savingAvatar}
                aria-label="Change avatar"
                className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-primary text-primary-foreground border-2 border-card grid place-items-center shadow hover:bg-primary/90 transition-smooth disabled:opacity-60"
              >
                {savingAvatar ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Pencil className="h-3.5 w-3.5" />
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

        <div className="flex-1 min-w-0 pt-10 flex items-end justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
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
                    className="h-9 text-xl font-bold"
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
                  <h2 className="text-2xl font-bold tracking-tight truncate">{bot.bot_name}</h2>
                  {enableDiscordEdits && (
                    <button
                      type="button"
                      onClick={() => setEditingName(true)}
                      className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-smooth"
                      aria-label="Edit name"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </>
              )}
            </div>
            {badges && (
              <div className="flex flex-wrap items-center gap-2 mt-2">{badges}</div>
            )}
            {recentChange && (
              <div className="mt-2 flex items-start gap-2 text-[11px] text-amber-300">
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                <span>Discord limits username changes to 2 per hour.</span>
              </div>
            )}

            {enableDiscordEdits && (
              <>
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-smooth"
                >
                  {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  {expanded ? "Hide bio & status" : "Edit bio & status"}
                </button>

                {expanded && (
                  <div className="mt-3 space-y-3 rounded-lg border border-border bg-background/40 p-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="bot-bio-inline" className="text-xs">About me (bio)</Label>
                        <span className="text-[10px] text-muted-foreground">{bio.length}/190</span>
                      </div>
                      <Textarea
                        id="bot-bio-inline"
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        maxLength={190}
                        rows={2}
                        placeholder="Tell people what your bot does…"
                        disabled={savingDetails}
                      />
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs flex items-center gap-1.5">
                          <Activity className="h-3 w-3 text-primary" />
                          Online status
                        </Label>
                        <Select
                          value={presence}
                          onValueChange={(v) => setPresence(v as PresenceStatus)}
                          disabled={savingDetails}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
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

                      <div className="space-y-1.5">
                        <Label htmlFor="bot-status-msg" className="text-xs">Status message</Label>
                        <Input
                          id="bot-status-msg"
                          value={activityText}
                          onChange={(e) => setActivityText(e.target.value)}
                          maxLength={128}
                          placeholder="e.g. helping out"
                          disabled={savingDetails}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button size="sm" onClick={saveDetails} disabled={savingDetails}>
                        {savingDetails ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          {actions && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>
          )}
        </div>
      </div>
    </Card>
  );
};
