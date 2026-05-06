import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ChevronDown, Plus, Trash2, GripVertical, Info, Save, FolderOpen } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { GuildChannelPicker } from "./GuildChannelPicker";
import type { BotGuild, BotChannel } from "@/hooks/useGuildChannels";
import { useActiveGuild } from "@/hooks/useActiveGuild";

/**
 * Discohook-style /say command builder.
 *
 * Left column: editor with collapsible sections (message content, embeds,
 * embed fields).
 * Right column: live preview rendered to look like a Discord message.
 */

type EmbedField = {
  id: string;
  name: string;
  value: string;
  inline: boolean;
};

type Embed = {
  id: string;
  authorName: string;
  authorIconUrl: string;
  authorUrl: string;
  title: string;
  url: string;
  description: string;
  color: string; // hex
  fields: EmbedField[];
  imageUrl: string;
  thumbnailUrl: string;
  footerText: string;
  footerIconUrl: string;
  timestamp: boolean;
};

const newEmbed = (): Embed => ({
  id: crypto.randomUUID(),
  authorName: "",
  authorIconUrl: "",
  authorUrl: "",
  title: "Welcome",
  url: "",
  description: "This is your embed description. It supports **markdown** formatting like bold, italic, and [links](https://example.com).",
  color: "#5865F2",
  fields: [],
  imageUrl: "",
  thumbnailUrl: "",
  footerText: "",
  footerIconUrl: "",
  timestamp: false,
});

const newField = (): EmbedField => ({
  id: crypto.randomUUID(),
  name: "",
  value: "",
  inline: false,
});

export type SayCommandBuilderHandle = {
  send: () => Promise<boolean>;
};

export const SayCommandBuilder = forwardRef<
  SayCommandBuilderHandle,
  {
    botId?: string;
    botName: string;
    botAvatarUrl?: string | null;
  }
>(function SayCommandBuilder({ botId, botName, botAvatarUrl }, ref) {
  const { guild: activeGuild, setGuild: setActiveGuild } = useActiveGuild();
  const [guild, setGuildLocal] = useState<BotGuild | null>(activeGuild);
  // Keep our local picker in sync if the dashboard-wide active server changes.
  useEffect(() => {
    if (activeGuild?.guild_id !== guild?.guild_id) setGuildLocal(activeGuild);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGuild?.guild_id]);
  const setGuild = (g: BotGuild | null) => {
    setGuildLocal(g);
    if (g) setActiveGuild(g); // sync the dashboard-wide selection.
  };
  const [channel, setChannel] = useState<BotChannel | null>(null);
  const [content, setContent] = useState("Hey everyone! Check out the info below 👇");
  const [embeds, setEmbeds] = useState<Embed[]>([newEmbed()]);
  // Extra messages shown below the embeds (each is a separate message)
  const [trailingMessages, setTrailingMessages] = useState<
    { id: string; text: string }[]
  >([]);
  // Files actually attached by the user
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const MAX_FILE_BYTES = 25 * 1024 * 1024;

  type SavedDraft = {
    id: string;
    name: string;
    updated_at: string;
    payload: { content: string; embeds: Embed[]; trailingMessages: { id: string; text: string }[] };
  };
  const [drafts, setDrafts] = useState<SavedDraft[]>([]);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftsLoading, setDraftsLoading] = useState(false);

  const refreshDrafts = async () => {
    if (!botId) return;
    setDraftsLoading(true);
    const { data } = await supabase
      .from("bot_say_drafts")
      .select("id, name, updated_at, payload")
      .eq("bot_id", botId)
      .order("updated_at", { ascending: false });
    setDrafts((data as SavedDraft[]) ?? []);
    setDraftsLoading(false);
  };

  const saveDraft = async () => {
    if (!botId) {
      toast.error("Bot not ready yet.");
      return;
    }
    const name = draftName.trim() || `Draft ${new Date().toLocaleString()}`;
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) {
      toast.error("Sign in to save drafts.");
      return;
    }
    const payload = { content, embeds, trailingMessages };
    const { error } = await supabase.from("bot_say_drafts").insert({
      user_id: userId,
      bot_id: botId,
      name,
      payload: payload as any,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Draft saved.");
    setDraftName("");
    refreshDrafts();
  };

  const loadDraft = (d: SavedDraft) => {
    const p = d.payload || ({} as any);
    if (typeof p.content === "string") setContent(p.content);
    if (Array.isArray(p.embeds)) setEmbeds(p.embeds);
    if (Array.isArray(p.trailingMessages)) setTrailingMessages(p.trailingMessages);
    toast.success(`Loaded "${d.name}".`);
    setDraftsOpen(false);
  };

  const deleteDraft = async (id: string) => {
    const { error } = await supabase.from("bot_say_drafts").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDrafts((prev) => prev.filter((d) => d.id !== id));
  };


  const contentLimit = 2000;

  const updateEmbed = (id: string, patch: Partial<Embed>) =>
    setEmbeds((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const removeEmbed = (id: string) =>
    setEmbeds((prev) => prev.filter((e) => e.id !== id));

  const addField = (embedId: string) =>
    setEmbeds((prev) =>
      prev.map((e) =>
        e.id === embedId ? { ...e, fields: [...e.fields, newField()] } : e,
      ),
    );

  const updateField = (
    embedId: string,
    fieldId: string,
    patch: Partial<EmbedField>,
  ) =>
    setEmbeds((prev) =>
      prev.map((e) =>
        e.id === embedId
          ? {
              ...e,
              fields: e.fields.map((f) =>
                f.id === fieldId ? { ...f, ...patch } : f,
              ),
            }
          : e,
      ),
    );

  const removeField = (embedId: string, fieldId: string) =>
    setEmbeds((prev) =>
      prev.map((e) =>
        e.id === embedId
          ? { ...e, fields: e.fields.filter((f) => f.id !== fieldId) }
          : e,
      ),
    );

  const send = async (): Promise<boolean> => {
    if (!botId) {
      toast.error("Bot not ready yet.");
      return false;
    }
    if (!channel?.channel_id) {
      toast.error("Pick a channel to post in.");
      return false;
    }
    if (!content.trim() && embeds.length === 0 && files.length === 0) {
      toast.error("Add some content, an embed, or an image first.");
      return false;
    }
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id ?? "anon";

      // Upload images to bot-assets bucket and collect public URLs.
      const imageUrls: string[] = [];
      for (const f of files) {
        const ext = f.name.split(".").pop()?.toLowerCase() || "png";
        const path = `${userId}/${botId}/say-${Date.now()}-${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("bot-assets")
          .upload(path, f, { upsert: false, contentType: f.type });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("bot-assets").getPublicUrl(path);
        imageUrls.push(pub.publicUrl);
      }

      const hexToInt = (hex: string): number | null => {
        const m = /^#?([0-9a-fA-F]{6})$/.exec(hex || "");
        return m ? parseInt(m[1], 16) : null;
      };

      const payload = {
        channel_id: channel.channel_id,
        content: content.trim() ? content : null,
        embeds: embeds.map((e) => ({
          title: e.title || null,
          title_url: e.url || null,
          description: e.description || null,
          color: hexToInt(e.color),
          author: e.authorName
            ? { name: e.authorName, icon_url: e.authorIconUrl || null }
            : null,
          footer: e.footerText
            ? { text: e.footerText, icon_url: e.footerIconUrl || null }
            : null,
          fields: e.fields.map((f) => ({
            name: f.name,
            value: f.value,
            inline: !!f.inline,
          })),
          image_url: e.imageUrl || null,
          thumbnail_url: e.thumbnailUrl || null,
          timestamp: e.timestamp ? new Date().toISOString() : null,
        })),
        images: imageUrls,
        trailing_messages: trailingMessages
          .map((m) => m.text)
          .filter((t) => t.trim().length > 0),
      };

      const { data, error } = await supabase.rpc("enqueue_post_message", {
        _bot_id: botId,
        _payload: payload as any,
      });
      if (error) throw error;
      const result = data as { ok?: boolean; error?: string } | null;
      if (!result?.ok) {
        toast.error(result?.error || "Could not queue the message.");
        return false;
      }
      toast.success("Message queued — your bot will post it shortly.");
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send message.";
      toast.error(msg);
      return false;
    }
  };

  useImperativeHandle(ref, () => ({ send }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr,1fr] gap-4">
      {/* Editor */}
      <div className="space-y-3">
        {botId ? (
          <GuildChannelPicker
            botId={botId}
            guildId={guild?.guild_id ?? null}
            channelId={channel?.channel_id ?? null}
            onGuildChange={setGuild}
            onChannelChange={setChannel}
            guildLabel="Server to post in"
            channelLabel="Channel"
          />
        ) : (
          <div className="space-y-2">
            <Label>Channel</Label>
            <div className="flex items-start gap-2 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>Server &amp; channel picker will appear here once your bot is online.</span>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="say-content" className="font-semibold">
              Content
            </Label>
            <span className="text-xs text-muted-foreground italic">
              {content.length}/{contentLimit}
            </span>
          </div>
          <Textarea
            id="say-content"
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, contentLimit))}
            rows={5}
            placeholder="Message content (supports markdown)."
            className="resize-y"
          />
        </div>

        {embeds.map((embed, i) => (
          <Section
            key={embed.id}
            title={`Embed ${i + 1}${embed.title ? ` — ${embed.title}` : ""}`}
            onRemove={() => removeEmbed(embed.id)}
          >
            <div className="space-y-3">
              {/* Author */}
              <Section title="Author" small>
                <div className="space-y-2">
                  <Input
                    placeholder="Author name"
                    value={embed.authorName}
                    onChange={(e) =>
                      updateEmbed(embed.id, { authorName: e.target.value })
                    }
                  />
                  <Input
                    placeholder="Author icon URL"
                    value={embed.authorIconUrl}
                    onChange={(e) =>
                      updateEmbed(embed.id, { authorIconUrl: e.target.value })
                    }
                  />
                  <Input
                    placeholder="Author URL (link)"
                    value={embed.authorUrl}
                    onChange={(e) =>
                      updateEmbed(embed.id, { authorUrl: e.target.value })
                    }
                  />
                </div>
              </Section>

              {/* Body */}
              <Section title="Body" small defaultOpen>
                <div className="space-y-2">
                  <Textarea
                    placeholder="Title"
                    rows={1}
                    value={embed.title}
                    onChange={(e) =>
                      updateEmbed(embed.id, { title: e.target.value })
                    }
                  />
                  <Input
                    placeholder="Title URL (link)"
                    value={embed.url}
                    onChange={(e) =>
                      updateEmbed(embed.id, { url: e.target.value })
                    }
                  />
                  <Textarea
                    placeholder="Description (supports markdown)"
                    rows={4}
                    value={embed.description}
                    onChange={(e) =>
                      updateEmbed(embed.id, { description: e.target.value })
                    }
                  />
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`color-${embed.id}`} className="text-xs">
                      Color
                    </Label>
                    <input
                      id={`color-${embed.id}`}
                      type="color"
                      value={embed.color}
                      onChange={(e) =>
                        updateEmbed(embed.id, { color: e.target.value })
                      }
                      className="h-8 w-12 rounded border border-border bg-background cursor-pointer"
                    />
                    <Input
                      value={embed.color}
                      onChange={(e) =>
                        updateEmbed(embed.id, { color: e.target.value })
                      }
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
              </Section>

              {/* Fields */}
              <Section
                key={`fields-${embed.id}-${embed.fields.length}`}
                title={`Fields (${embed.fields.length})`}
                small
                defaultOpen={embed.fields.length > 0}
              >
                <div className="space-y-2">
                  {embed.fields.map((f) => (
                    <div
                      key={f.id}
                      className="rounded-md border border-border p-2 space-y-2 bg-card/40"
                    >
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                        <Textarea
                          placeholder="Field name"
                          rows={1}
                          value={f.name}
                          onInput={(e) =>
                            updateField(embed.id, f.id, { name: e.currentTarget.value })
                          }
                          onKeyUp={(e) =>
                            updateField(embed.id, f.id, { name: e.currentTarget.value })
                          }
                          onBlur={(e) =>
                            updateField(embed.id, f.id, { name: e.currentTarget.value })
                          }
                          className="min-h-8 py-1.5"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => removeField(embed.id, f.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <Textarea
                        placeholder="Field value"
                        rows={2}
                        value={f.value}
                        onInput={(e) =>
                          updateField(embed.id, f.id, { value: e.currentTarget.value })
                        }
                        onKeyUp={(e) =>
                          updateField(embed.id, f.id, { value: e.currentTarget.value })
                        }
                        onBlur={(e) =>
                          updateField(embed.id, f.id, { value: e.currentTarget.value })
                        }
                      />
                      <div className="flex items-center justify-between">
                        <Label className="text-xs cursor-pointer">Inline</Label>
                        <Switch
                          checked={f.inline}
                          onCheckedChange={(v) =>
                            updateField(embed.id, f.id, { inline: v })
                          }
                        />
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => addField(embed.id)}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add field
                  </Button>
                </div>
              </Section>

              {/* Images */}
              <Section title="Images" small>
                <div className="space-y-2">
                  <Input
                    placeholder="Image URL (large)"
                    value={embed.imageUrl}
                    onChange={(e) =>
                      updateEmbed(embed.id, { imageUrl: e.target.value })
                    }
                  />
                  <Input
                    placeholder="Thumbnail URL (small, top-right)"
                    value={embed.thumbnailUrl}
                    onChange={(e) =>
                      updateEmbed(embed.id, { thumbnailUrl: e.target.value })
                    }
                  />
                </div>
              </Section>

              {/* Footer */}
              <Section title="Footer" small>
                <div className="space-y-2">
                  <Input
                    placeholder="Footer text"
                    value={embed.footerText}
                    onChange={(e) =>
                      updateEmbed(embed.id, { footerText: e.target.value })
                    }
                  />
                  <Input
                    placeholder="Footer icon URL"
                    value={embed.footerIconUrl}
                    onChange={(e) =>
                      updateEmbed(embed.id, { footerIconUrl: e.target.value })
                    }
                  />
                  <div className="flex items-center justify-between pt-1">
                    <Label className="text-xs cursor-pointer">
                      Show timestamp
                    </Label>
                    <Switch
                      checked={embed.timestamp}
                      onCheckedChange={(v) =>
                        updateEmbed(embed.id, { timestamp: v })
                      }
                    />
                  </div>
                </div>
              </Section>
            </div>
          </Section>
        ))}

        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={() => setEmbeds((p) => [...p, newEmbed()])}
          disabled={embeds.length >= 10}
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Embed
        </Button>

        {trailingMessages.map((msg, idx) => (
          <div className="space-y-2" key={msg.id}>
            <div className="flex items-baseline justify-between">
              <Label htmlFor={`say-trailing-${msg.id}`} className="font-semibold">
                Message {idx + 2}
              </Label>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-destructive transition-smooth"
                onClick={() =>
                  setTrailingMessages((prev) =>
                    prev.filter((m) => m.id !== msg.id),
                  )
                }
              >
                Remove
              </button>
            </div>
            <Textarea
              id={`say-trailing-${msg.id}`}
              value={msg.text}
              onChange={(e) =>
                setTrailingMessages((prev) =>
                  prev.map((m) =>
                    m.id === msg.id
                      ? { ...m, text: e.target.value.slice(0, contentLimit) }
                      : m,
                  ),
                )
              }
              rows={4}
              placeholder="Plain message shown below."
              className="resize-y"
            />
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setTrailingMessages((prev) => [
              ...prev,
              { id: crypto.randomUUID(), text: "" },
            ])
          }
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Message
        </Button>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <Label className="font-semibold">Images</Label>
            <span className="text-xs text-muted-foreground italic">
              PNG, JPG, GIF, WebP — 25 MB max per image
            </span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="hidden"
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              const accepted: File[] = [];
              for (const f of picked) {
                if (!f.type.startsWith("image/")) {
                  toast.error(`${f.name} isn't an image.`);
                  continue;
                }
                if (f.size > MAX_FILE_BYTES) {
                  toast.error(`${f.name} is over the 25 MB limit.`);
                  continue;
                }
                accepted.push(f);
              }
              if (accepted.length) {
                setFiles((prev) => [...prev, ...accepted]);
              }
              // Allow re-selecting the same file later
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          />
          {files.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 rounded-md border border-border bg-card/40 p-2">
              {files.map((f, i) => (
                <FileThumb
                  key={`${f.name}-${i}`}
                  file={f}
                  onRemove={() =>
                    setFiles((prev) => prev.filter((_, idx) => idx !== i))
                  }
                />
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              Upload images
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setFiles([])}
              disabled={files.length === 0}
            >
              Clear
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground">
          <Dialog
            open={draftsOpen}
            onOpenChange={(o) => {
              setDraftsOpen(o);
              if (o) refreshDrafts();
            }}
          >
            <DialogTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1 hover:text-foreground transition-smooth"
              >
                <FolderOpen className="h-3 w-3" /> Saved drafts
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Saved drafts</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Draft name (e.g. Server rules)"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                  />
                  <Button type="button" size="sm" onClick={saveDraft}>
                    <Save className="h-3.5 w-3.5 mr-1" /> Save
                  </Button>
                </div>
                <div className="max-h-72 overflow-y-auto rounded-md border border-border divide-y divide-border">
                  {draftsLoading ? (
                    <div className="p-3 text-xs text-muted-foreground">Loading…</div>
                  ) : drafts.length === 0 ? (
                    <div className="p-3 text-xs text-muted-foreground">
                      No saved drafts yet.
                    </div>
                  ) : (
                    drafts.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center gap-2 p-2 hover:bg-muted/30 transition-smooth"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate">{d.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {new Date(d.updated_at).toLocaleString()}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => loadDraft(d)}
                        >
                          Load
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => deleteDraft(d.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Preview */}
      <div className="lg:sticky lg:top-2 lg:self-start">
        <Label className="text-xs text-muted-foreground">Preview</Label>
        <div className="mt-2 rounded-lg border border-border bg-[#313338] p-4 text-[#dbdee1] font-sans text-sm">
          <DiscordMessagePreview
            botName={botName}
            botAvatarUrl={botAvatarUrl ?? undefined}
            content={content}
            trailingMessages={trailingMessages.map((m) => m.text)}
            embeds={embeds}
            files={files}
          />
        </div>
      </div>
    </div>
  );
});

function Section({
  title,
  children,
  defaultOpen = false,
  onRemove,
  small = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  onRemove?: () => void;
  small?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className={`rounded-md border border-border ${small ? "bg-card/30" : "bg-card/50"}`}
    >
      <div className="flex items-center">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
          className={`flex-1 flex items-center gap-2 ${small ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm"} font-medium hover:bg-muted/30 transition-smooth text-left rounded-md`}
        >
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${open ? "" : "-rotate-90"}`}
          />
          <span className="truncate">{title}</span>
        </button>
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 mr-1 shrink-0"
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      {open && (
        <div className={small ? "px-2.5 pb-2.5" : "px-3 pb-3"}>{children}</div>
      )}
    </div>
  );
}

function DiscordMessagePreview({
  botName,
  botAvatarUrl,
  content,
  trailingMessages,
  embeds,
  files,
}: {
  botName: string;
  botAvatarUrl?: string;
  content: string;
  trailingMessages?: string[];
  embeds: Embed[];
  files?: File[];
}) {
  return (
    <div className="space-y-4">
      <SingleMessage
        botName={botName}
        botAvatarUrl={botAvatarUrl}
        content={content}
        embeds={embeds}
        files={files}
      />
      {trailingMessages
        ?.filter((t) => t.trim().length > 0)
        .map((t, i) => (
          <SingleMessage
            key={i}
            botName={botName}
            botAvatarUrl={botAvatarUrl}
            content={t}
            embeds={[]}
          />
        ))}
    </div>
  );
}

function SingleMessage({
  botName,
  botAvatarUrl,
  content,
  embeds,
  files,
}: {
  botName: string;
  botAvatarUrl?: string;
  content: string;
  embeds: Embed[];
  files?: File[];
}) {
  return (
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
        {content && (
          <p className="whitespace-pre-wrap break-words mt-0.5">{content}</p>
        )}
        {embeds.length > 0 && (
          <div className="space-y-2 mt-1">
            {embeds.map((e) => (
              <EmbedPreview key={e.id} embed={e} />
            ))}
          </div>
        )}
        {files && files.length > 0 && (
          <div className={`mt-2 ${files.length > 1 ? "grid grid-cols-2 gap-2 max-w-md" : ""}`}>
            {files.map((f, i) => (
              <PreviewImage key={`${f.name}-${i}`} file={f} single={files.length === 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewImage({ file, single }: { file: File; single?: boolean }) {
  const [url] = useState(() => URL.createObjectURL(file));
  return (
    <img
      src={url}
      alt={file.name}
      className={
        single
          ? "rounded max-w-[550px] w-full h-auto border border-[#1f2023]"
          : "rounded max-h-60 w-full object-cover border border-[#1f2023]"
      }
    />
  );
}

function FileThumb({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  const [url] = useState(() => URL.createObjectURL(file));
  return (
    <div className="relative group rounded-md overflow-hidden border border-border bg-card">
      <img src={url} alt={file.name} className="w-full h-24 object-cover" />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 py-1 text-[10px] text-white truncate">
        {file.name} · {(file.size / 1024).toFixed(0)} KB
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-1 right-1 h-6 w-6 grid place-items-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-smooth hover:bg-destructive"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

function EmbedPreview({ embed }: { embed: Embed }) {
  const hasContent =
    embed.authorName ||
    embed.title ||
    embed.description ||
    embed.fields.length > 0 ||
    embed.imageUrl ||
    embed.thumbnailUrl ||
    embed.footerText;

  if (!hasContent) {
    return (
      <div className="text-xs text-[#949ba4] italic border-l-4 border-[#4e5058] bg-[#2b2d31] rounded px-3 py-2">
        Empty embed
      </div>
    );
  }

  return (
    <div
      className="rounded bg-[#2b2d31] border-l-4 max-w-md"
      style={{ borderLeftColor: embed.color || "#5865F2" }}
    >
      <div className="p-3 grid grid-cols-[1fr,auto] gap-3">
        <div className="min-w-0 space-y-1">
          {embed.authorName && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-white">
              {embed.authorIconUrl && (
                <img
                  src={embed.authorIconUrl}
                  alt=""
                  className="h-5 w-5 rounded-full object-cover"
                />
              )}
              <span className="truncate">{embed.authorName}</span>
            </div>
          )}
          {embed.title &&
            (embed.url ? (
              <a
                href={embed.url}
                target="_blank"
                rel="noreferrer"
                className="block text-[#00a8fc] hover:underline font-semibold whitespace-pre-wrap break-words"
              >
                {embed.title}
              </a>
            ) : (
              <div className="text-white font-semibold whitespace-pre-wrap break-words">{embed.title}</div>
            ))}
          {embed.description && (
            <p className="whitespace-pre-wrap break-words text-sm text-[#dbdee1]">
              {embed.description}
            </p>
          )}
          {embed.fields.length > 0 && (
            <div className="grid grid-cols-3 gap-2 pt-1">
              {embed.fields.map((f) => (
                <div
                  key={f.id}
                  className={
                    f.inline ? "col-span-1 min-w-0" : "col-span-3 min-w-0"
                  }
                >
                  <div className="text-xs font-semibold text-white whitespace-pre-wrap break-words">
                    {f.name || "Field name"}
                  </div>
                  <div className="text-sm whitespace-pre-wrap break-words">
                    {f.value || "Field value"}
                  </div>
                </div>
              ))}
            </div>
          )}
          {embed.imageUrl && (
            <img
              src={embed.imageUrl}
              alt=""
              className="mt-2 rounded max-w-full max-h-72 object-cover"
            />
          )}
          {(embed.footerText || embed.timestamp) && (
            <div className="flex items-center gap-1.5 pt-2 text-[11px] text-[#949ba4]">
              {embed.footerIconUrl && (
                <img
                  src={embed.footerIconUrl}
                  alt=""
                  className="h-4 w-4 rounded-full object-cover"
                />
              )}
              <span>
                {embed.footerText}
                {embed.footerText && embed.timestamp && " • "}
                {embed.timestamp && new Date().toLocaleString()}
              </span>
            </div>
          )}
        </div>
        {embed.thumbnailUrl && (
          <img
            src={embed.thumbnailUrl}
            alt=""
            className="h-20 w-20 rounded object-cover"
          />
        )}
      </div>
    </div>
  );
}
