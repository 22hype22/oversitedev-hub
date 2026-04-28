import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Plus, Trash2, GripVertical } from "lucide-react";

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
  title: "",
  url: "",
  description: "",
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

export function SayCommandBuilder({
  botName,
  botAvatarUrl,
}: {
  botName: string;
  botAvatarUrl?: string | null;
}) {
  const [channel, setChannel] = useState("");
  const [content, setContent] = useState(
    "Welcome to the server! 👋 Read the rules and have fun.",
  );
  const [embeds, setEmbeds] = useState<Embed[]>([
    {
      ...newEmbed(),
      title: "Server Rules",
      description:
        "1. Be respectful to everyone.\n2. No spam or self-promo.\n3. Keep it SFW in public channels.",
      color: "#5865F2",
      footerText: botName,
    },
  ]);
  const [trailingContent, setTrailingContent] = useState("");

  const updateEmbed = (id: string, patch: Partial<Embed>) =>
    setEmbeds((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const removeEmbed = (id: string) =>
    setEmbeds((prev) => prev.filter((e) => e.id !== id));

  const addField = (embedId: string) =>
    updateEmbed(embedId, {
      fields: [
        ...(embeds.find((e) => e.id === embedId)?.fields ?? []),
        newField(),
      ],
    });

  const updateField = (
    embedId: string,
    fieldId: string,
    patch: Partial<EmbedField>,
  ) => {
    const e = embeds.find((x) => x.id === embedId);
    if (!e) return;
    updateEmbed(embedId, {
      fields: e.fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)),
    });
  };

  const removeField = (embedId: string, fieldId: string) => {
    const e = embeds.find((x) => x.id === embedId);
    if (!e) return;
    updateEmbed(embedId, { fields: e.fields.filter((f) => f.id !== fieldId) });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr,1fr] gap-4">
      {/* Editor */}
      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="say-channel">Channel</Label>
          <Input
            id="say-channel"
            placeholder="#announcements"
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            The channel /say will post into.
          </p>
        </div>

        <Section title="Message" defaultOpen>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            placeholder="Plain message text shown above the embed."
          />
        </Section>

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
                  <Input
                    placeholder="Title"
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
                title={`Fields (${embed.fields.length})`}
                small
              >
                <div className="space-y-2">
                  {embed.fields.map((f) => (
                    <div
                      key={f.id}
                      className="rounded-md border border-border p-2 space-y-2 bg-card/40"
                    >
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          placeholder="Field name"
                          value={f.name}
                          onChange={(e) =>
                            updateField(embed.id, f.id, { name: e.target.value })
                          }
                          className="h-8"
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
                        onChange={(e) =>
                          updateField(embed.id, f.id, { value: e.target.value })
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
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setEmbeds((p) => [...p, newEmbed()])}
          disabled={embeds.length >= 10}
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Add embed
        </Button>
      </div>

      {/* Preview */}
      <div className="lg:sticky lg:top-2 lg:self-start">
        <Label className="text-xs text-muted-foreground">Preview</Label>
        <div className="mt-2 rounded-lg border border-border bg-[#313338] p-4 text-[#dbdee1] font-sans text-sm">
          <DiscordMessagePreview
            botName={botName}
            botAvatarUrl={botAvatarUrl ?? undefined}
            content={content}
            embeds={embeds}
          />
        </div>
      </div>
    </div>
  );
}

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
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        className={`rounded-md border border-border ${small ? "bg-card/30" : "bg-card/50"}`}
      >
        <div className="flex items-center">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className={`flex-1 flex items-center gap-2 ${small ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm"} font-medium hover:bg-muted/30 transition-smooth text-left rounded-md`}
            >
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${open ? "" : "-rotate-90"}`}
              />
              <span className="truncate">{title}</span>
            </button>
          </CollapsibleTrigger>
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
        <CollapsibleContent>
          <div className={small ? "px-2.5 pb-2.5" : "px-3 pb-3"}>{children}</div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function DiscordMessagePreview({
  botName,
  botAvatarUrl,
  content,
  embeds,
}: {
  botName: string;
  botAvatarUrl?: string;
  content: string;
  embeds: Embed[];
}) {
  return (
    <div className="flex gap-3">
      <div className="h-10 w-10 rounded-full bg-[#5865F2] grid place-items-center shrink-0 overflow-hidden">
        {botAvatarUrl ? (
          <img
            src={botAvatarUrl}
            alt=""
            className="h-full w-full object-cover"
          />
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
        <div className="space-y-2 mt-1">
          {embeds.map((e) => (
            <EmbedPreview key={e.id} embed={e} />
          ))}
        </div>
      </div>
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
                className="block text-[#00a8fc] hover:underline font-semibold"
              >
                {embed.title}
              </a>
            ) : (
              <div className="text-white font-semibold">{embed.title}</div>
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
                  <div className="text-xs font-semibold text-white">
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
