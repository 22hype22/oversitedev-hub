import { useRef, useState } from "react";
import { Bot, Image as ImageIcon, Pencil, Upload, Check, X, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { OwnedBot } from "@/hooks/useOwnedBots";

type Props = {
  bot: OwnedBot;
  onUpdated: () => void;
  /** Status / category badges rendered under the name. */
  badges?: React.ReactNode;
  /** Action buttons rendered on the right side of the header row. */
  actions?: React.ReactNode;
};

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export const BotIdentityEditor = ({ bot, onUpdated, badges, actions }: Props) => {
  const { user } = useAuth();
  const iconInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(bot.bot_name);
  const [savingName, setSavingName] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const isDemo = !!bot.isDemo;

  const saveName = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Name can't be empty");
      return;
    }
    if (trimmed === bot.bot_name) {
      setEditingName(false);
      return;
    }
    if (isDemo) {
      toast.info("Practice bots can't be renamed");
      setEditingName(false);
      return;
    }
    setSavingName(true);
    const { error } = await (supabase as any)
      .from("bot_orders")
      .update({ bot_name: trimmed })
      .eq("id", bot.id)
      .eq("user_id", user!.id);
    setSavingName(false);
    if (error) {
      toast.error("Couldn't save name — " + error.message);
      return;
    }
    toast.success("Name updated");
    setEditingName(false);
    onUpdated();
  };

  const uploadAsset = async (
    file: File,
    kind: "icon" | "banner",
  ) => {
    if (!user) return;
    if (isDemo) {
      toast.info("Practice bots can't be customized");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Image must be under 5 MB");
      return;
    }
    const setBusy = kind === "icon" ? setUploadingIcon : setUploadingBanner;
    setBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${user.id}/${bot.id}/${kind}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("bot-assets")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("bot-assets").getPublicUrl(path);
      const url = pub.publicUrl;
      const column = kind === "icon" ? "icon_url" : "banner_url";
      const { error: dbErr } = await (supabase as any)
        .from("bot_orders")
        .update({ [column]: url })
        .eq("id", bot.id)
        .eq("user_id", user.id);
      if (dbErr) throw dbErr;
      toast.success(`${kind === "icon" ? "Icon" : "Banner"} updated`);
      onUpdated();
    } catch (e: any) {
      toast.error("Upload failed — " + (e.message ?? "unknown error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="overflow-hidden bg-card/60 border-border">
      {/* Banner */}
      <div className="relative h-36 sm:h-44 w-full bg-gradient-to-br from-primary/20 via-primary/5 to-background border-b border-border">
        {bot.banner_url && (
          <img
            src={bot.banner_url}
            alt={`${bot.bot_name} banner`}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {!bot.banner_url && (
          <div className="absolute inset-0 grid place-items-center text-muted-foreground">
            <div className="flex items-center gap-2 text-xs">
              <ImageIcon className="h-4 w-4" />
              No banner uploaded
            </div>
          </div>
        )}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="absolute top-3 right-3 backdrop-blur-sm bg-background/70 hover:bg-background/90"
          onClick={() => bannerInputRef.current?.click()}
          disabled={uploadingBanner || isDemo}
        >
          {uploadingBanner ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Upload className="h-4 w-4 mr-1.5" />
          )}
          {bot.banner_url ? "Change banner" : "Upload banner"}
        </Button>
        <input
          ref={bannerInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadAsset(f, "banner");
            e.target.value = "";
          }}
        />
      </div>

      {/* Icon + name row */}
      <div className="px-5 pb-5 -mt-10 flex items-end gap-4 flex-wrap">
        <div className="relative shrink-0">
          <div className="h-20 w-20 rounded-2xl bg-primary/10 border-4 border-card grid place-items-center overflow-hidden shadow-md">
            {bot.icon_url ? (
              <img src={bot.icon_url} alt={bot.bot_name} className="h-full w-full object-cover" />
            ) : (
              <Bot className="h-8 w-8 text-primary" />
            )}
          </div>
          <button
            type="button"
            onClick={() => iconInputRef.current?.click()}
            disabled={uploadingIcon || isDemo}
            className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-primary text-primary-foreground grid place-items-center shadow-md hover:bg-primary/90 disabled:opacity-60"
            aria-label="Change icon"
          >
            {uploadingIcon ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Pencil className="h-3.5 w-3.5" />
            )}
          </button>
          <input
            ref={iconInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadAsset(f, "icon");
              e.target.value = "";
            }}
          />
        </div>

        <div className="flex-1 min-w-0 pt-10 flex items-end justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            {editingName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={50}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveName();
                    if (e.key === "Escape") {
                      setName(bot.bot_name);
                      setEditingName(false);
                    }
                  }}
                  className="max-w-sm"
                />
                <Button size="sm" onClick={saveName} disabled={savingName}>
                  {savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setName(bot.bot_name);
                    setEditingName(false);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-2xl font-bold tracking-tight truncate">{bot.bot_name}</h2>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0"
                  onClick={() => setEditingName(true)}
                  disabled={isDemo}
                  aria-label="Rename bot"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            {badges && (
              <div className="flex flex-wrap items-center gap-2 mt-2">{badges}</div>
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
      </div>
    </Card>
  );
};
