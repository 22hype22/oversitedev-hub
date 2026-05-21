import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Loader2, RefreshCw, Upload, AlertTriangle, Bot as BotIcon, IdCard, Activity } from "lucide-react";

type ActivityType = "playing" | "watching" | "listening" | "competing" | "streaming";
type PresenceStatus = "online" | "idle" | "dnd" | "invisible";

const ACTIVITY_OPTIONS: { value: ActivityType; label: string }[] = [
  { value: "playing", label: "Playing" },
  { value: "watching", label: "Watching" },
  { value: "listening", label: "Listening to" },
  { value: "competing", label: "Competing in" },
  { value: "streaming", label: "Streaming" },
];

const PRESENCE_OPTIONS: { value: PresenceStatus; label: string; dot: string }[] = [
  { value: "online", label: "Online", dot: "bg-emerald-500" },
  { value: "idle", label: "Idle", dot: "bg-amber-400" },
  { value: "dnd", label: "Do Not Disturb", dot: "bg-red-500" },
  { value: "invisible", label: "Invisible", dot: "bg-muted-foreground" },
];

type Props = {
  botId: string;
  /** Most recent username change time, from bot_orders. */
  lastUsernameChangeAt: string | null;
  /** Saved bio from bot_orders (used as fallback before Discord fetch). */
  initialBio: string | null;
  /** Saved name from bot_orders (used as fallback). */
  initialUsername: string;
  /** Saved presence activity type. */
  initialActivityType?: string | null;
  /** Saved presence activity text. */
  initialActivityText?: string | null;
  /** Saved presence status (online/idle/dnd/invisible). */
  initialPresenceStatus?: string | null;
  onUpdated?: () => void;
};



type LiveIdentity = {
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
};

const MAX_AVATAR_BYTES = 8 * 1024 * 1024; // 8 MB

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

export const BotDiscordIdentityCard = ({
  botId,
  lastUsernameChangeAt,
  initialBio,
  initialUsername,
  initialActivityType,
  initialActivityText,
  initialPresenceStatus,
  onUpdated,
}: Props) => {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState<LiveIdentity>({
    username: initialUsername,
    avatar_url: null,
    bio: initialBio,
  });
  const [username, setUsername] = useState(initialUsername);
  const [bio, setBio] = useState(initialBio ?? "");
  const [savingUsername, setSavingUsername] = useState(false);
  const [savingBio, setSavingBio] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);

  const [activityType, setActivityType] = useState<ActivityType>(
    (initialActivityType as ActivityType) ?? "playing",
  );
  const [activityText, setActivityText] = useState(initialActivityText ?? "");
  const [presenceStatus, setPresenceStatus] = useState<PresenceStatus>(
    (initialPresenceStatus as PresenceStatus) ?? "online",
  );
  const [savedActivityType, setSavedActivityType] = useState<ActivityType | null>(
    (initialActivityType as ActivityType) ?? null,
  );
  const [savedActivityText, setSavedActivityText] = useState<string>(initialActivityText ?? "");
  const [savedPresenceStatus, setSavedPresenceStatus] = useState<PresenceStatus>(
    (initialPresenceStatus as PresenceStatus) ?? "online",
  );
  const [savingStatus, setSavingStatus] = useState(false);



  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("bot-fetch-identity", {
      body: { bot_id: botId },
    });
    setLoading(false);
    if (error || !data?.ok) {
      toast.error("Couldn't load Discord identity", {
        description: (data as any)?.error ?? error?.message,
      });
      return;
    }
    setLive({
      username: data.username ?? null,
      avatar_url: data.avatar_url ?? null,
      bio: data.bio ?? null,
    });
    if (typeof data.username === "string") setUsername(data.username);
    if (typeof data.bio === "string") setBio(data.bio);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId]);

  // Discord rate-limits bot username changes to 2 per hour. We can't see
  // Discord's counter — just warn if we changed within the last hour.
  const recentChange = lastUsernameChangeAt
    ? Date.now() - new Date(lastUsernameChangeAt).getTime() < 60 * 60 * 1000
    : false;
  const usernameDirty = username.trim() !== (live.username ?? "").trim();
  const bioDirty = (bio ?? "") !== (live.bio ?? "");

  const callUpdate = async (
    patch: { username?: string; bio?: string; avatar?: string },
  ): Promise<boolean> => {
    const { data, error } = await supabase.functions.invoke("bot-update-identity", {
      body: { bot_id: botId, ...patch },
    });
    if (error || !data?.ok) {
      const msg = (data as any)?.error ?? error?.message ?? "Update failed";
      toast.error("Discord update failed", { description: msg });
      return false;
    }
    return true;
  };

  const saveUsername = async () => {
    const trimmed = username.trim();
    if (trimmed.length < 2 || trimmed.length > 32) {
      toast.error("Username must be 2-32 characters");
      return;
    }
    setSavingUsername(true);
    const ok = await callUpdate({ username: trimmed });
    setSavingUsername(false);
    if (ok) {
      toast.success("Username updated on Discord");
      await refresh();
      onUpdated?.();
    }
  };

  const saveBio = async () => {
    if (bio.length > 190) {
      toast.error("Bio must be 190 characters or fewer");
      return;
    }
    setSavingBio(true);
    const ok = await callUpdate({ bio });
    setSavingBio(false);
    if (ok) {
      toast.success("Bio updated on Discord");
      await refresh();
      onUpdated?.();
    }
  };

  const onAvatarPick = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("Image must be under 8 MB");
      return;
    }
    setSavingAvatar(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const ok = await callUpdate({ avatar: dataUrl });
      if (ok) {
        toast.success("Avatar updated on Discord");
        await refresh();
        onUpdated?.();
      }
    } catch (e: any) {
      toast.error("Couldn't read image", { description: e?.message });
    } finally {
      setSavingAvatar(false);
    }
  };

  const statusDirty =
    activityType !== (savedActivityType ?? "playing") ||
    activityText.trim() !== (savedActivityText ?? "").trim() ||
    presenceStatus !== savedPresenceStatus;

  const saveStatus = async () => {
    if (!user) {
      toast.error("Sign in required");
      return;
    }
    const text = activityText.trim();
    if (text.length > 128) {
      toast.error("Status message must be 128 characters or fewer");
      return;
    }
    setSavingStatus(true);
    try {
      // Persist to bot_orders so it restores on restart
      const { error: upErr } = await (supabase as any)
        .from("bot_orders")
        .update({
          activity_type: activityType,
          activity_text: text || null,
          presence_status: presenceStatus,
        })
        .eq("id", botId);
      if (upErr) throw upErr;

      // Queue a live update command for the worker
      const { error: cmdErr } = await (supabase as any)
        .from("bot_commands")
        .insert({
          bot_id: botId,
          user_id: user.id,
          requested_by: user.id,
          action: "set_status",
          payload: {
            activity_type: activityType,
            activity_text: text,
            presence_status: presenceStatus,
          },
        });
      if (cmdErr) throw cmdErr;

      setSavedActivityType(activityType);
      setSavedActivityText(text);
      setSavedPresenceStatus(presenceStatus);
      toast.success("Status updated", {
        description: "Your bot will apply the new presence shortly.",
      });
      onUpdated?.();
    } catch (e: any) {
      toast.error("Couldn't update status", { description: e?.message });
    } finally {
      setSavingStatus(false);
    }
  };




  return (
    <Card className="p-5 space-y-5 bg-card/40 border-border">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <IdCard className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Bot identity (Discord)</h3>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={refresh}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          <span className="ml-1.5">Refresh</span>
        </Button>
      </div>

      {/* Live preview */}
      <div className="flex items-center gap-3 rounded-lg border border-border bg-background/40 p-3">
        <div className="h-14 w-14 rounded-full overflow-hidden bg-primary/10 grid place-items-center shrink-0">
          {live.avatar_url ? (
            <img
              src={live.avatar_url}
              alt="Current bot avatar"
              className="h-full w-full object-cover"
            />
          ) : (
            <BotIcon className="h-6 w-6 text-primary" />
          )}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">
            {live.username ?? "—"}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {live.bio || "No bio set"}
          </div>
        </div>
        <Badge variant="secondary" className="ml-auto text-[10px]">
          Live from Discord
        </Badge>
      </div>

      {/* Username */}
      <div className="space-y-2">
        <Label htmlFor="bot-username" className="text-xs">
          Username
        </Label>
        <div className="flex items-center gap-2">
          <Input
            id="bot-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={32}
            minLength={2}
            placeholder="my-bot"
            disabled={savingUsername}
          />
          <Button
            size="sm"
            onClick={saveUsername}
            disabled={savingUsername || username.trim().length < 2 || username.trim().length > 32}
          >
            {savingUsername ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Save"
            )}
          </Button>
        </div>
        {recentChange && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              Discord limits bot username changes to <strong>2 per hour</strong>.
              You changed it recently — another change may fail.
            </span>
          </div>
        )}
      </div>

      {/* Avatar */}
      <div className="space-y-2">
        <Label className="text-xs">Avatar</Label>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={savingAvatar}
          >
            {savingAvatar ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-1.5" />
            )}
            Upload new avatar
          </Button>
          <span className="text-xs text-muted-foreground">PNG, JPG or GIF up to 8 MB</span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onAvatarPick(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {/* Bio */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="bot-bio" className="text-xs">
            About me (bio)
          </Label>
          <span className="text-[10px] text-muted-foreground">
            {bio.length}/190
          </span>
        </div>
        <Textarea
          id="bot-bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={190}
          rows={3}
          placeholder="Tell people what your bot does…"
          disabled={savingBio}
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={saveBio}
            disabled={savingBio || bio.length > 190}
          >
            {savingBio ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save bio"}
          </Button>
        </div>
      </div>

      {/* Status (presence) */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-primary" />
          <Label className="text-xs">Status</Label>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Select
            value={activityType}
            onValueChange={(v) => setActivityType(v as ActivityType)}
            disabled={savingStatus}
          >
            <SelectTrigger className="sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTIVITY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={activityText}
            onChange={(e) => setActivityText(e.target.value)}
            maxLength={128}
            placeholder="your server"
            disabled={savingStatus}
            className="flex-1"
          />
          <Button
            size="sm"
            onClick={saveStatus}
            disabled={!statusDirty || savingStatus}
          >
            {savingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save status"}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Shows under your bot's name in Discord (e.g. "Watching your server"). Saved and restored on restart.
        </p>
      </div>
    </Card>
  );
};

