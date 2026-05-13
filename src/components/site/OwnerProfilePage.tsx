import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
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
import {
  MessageCircle,
  Globe,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  Trash2,
  Pencil,
  Plus,
  X,
  Loader2,
} from "lucide-react";

const CATEGORIES = ["Build", "Script", "Model"] as const;
type Category = (typeof CATEGORIES)[number];

type MediaItem = { url: string; kind: "image" | "video" };
type PortfolioItem = {
  id: string;
  category: string;
  title: string;
  description: string | null;
  media: MediaItem[];
  sort_order: number;
  owner_key: string;
};

const SOCIALS = [
  { label: "Discord", href: "https://discord.gg/oversite", icon: MessageCircle },
  { label: "Website", href: "https://www.oversite.shop", icon: Globe },
];

const categoryClass = (category: string) => {
  switch (category) {
    case "Build":
      return "bg-primary/10 text-primary";
    case "Script":
      return "bg-emerald-500/10 text-emerald-500";
    case "Model":
      return "bg-amber-500/10 text-amber-500";
    default:
      return "bg-muted text-muted-foreground";
  }
};

export type OwnerProfilePageProps = {
  ownerKey: string;
  adminEmail: string;
  name: string;
  role: string;
  imageSrc: string;
  about: ReactNode;
  accent?: "primary" | "gold";
};

const ACCENTS = {
  primary: {
    ringOuter: "ring-primary/25",
    ringInner: "ring-primary/15",
    border: "border-primary/40",
    shadow: "shadow-primary/20",
  },
  gold: {
    ringOuter: "ring-amber-400/30",
    ringInner: "ring-amber-400/15",
    border: "border-amber-400/50",
    shadow: "shadow-amber-400/20",
  },
} as const;

export const OwnerProfilePage = ({
  ownerKey,
  adminEmail,
  name,
  role,
  imageSrc,
  about,
  accent = "primary",
}: OwnerProfilePageProps) => {
  const a = ACCENTS[accent];
  const { user } = useAuth();
  const { toast } = useToast();
  const isOwner = user?.email === adminEmail;

  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("portfolio_items")
      .select("id, category, title, description, media, sort_order, owner_key")
      .eq("owner_key", ownerKey)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) {
      toast({ title: "Failed to load portfolio", description: error.message, variant: "destructive" });
    } else {
      setItems(
        ((data as any[]) ?? []).map((d) => ({
          ...d,
          media: Array.isArray(d.media) ? (d.media as MediaItem[]) : [],
        })) as PortfolioItem[],
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerKey]);

  const grouped = useMemo(() => {
    const map = new Map<string, PortfolioItem[]>();
    for (const it of items) {
      const list = map.get(it.category) ?? [];
      list.push(it);
      map.set(it.category, list);
    }
    return map;
  }, [items]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 pt-28 pb-16 max-w-3xl">
        <div className="flex flex-col items-center text-center">
          <div className="relative w-32 h-32 md:w-40 md:h-40 mb-6">
            <span
              className={`absolute -inset-1 rounded-full ring-2 ${a.ringOuter} animate-pulse [animation-duration:4s]`}
              aria-hidden="true"
            />
            <span
              className={`absolute inset-0 rounded-full ring-2 ${a.ringInner} animate-pulse [animation-duration:3s]`}
              aria-hidden="true"
            />
            <div className={`relative w-full h-full rounded-full overflow-hidden border-4 ${a.border} shadow-lg ${a.shadow}`}>
              <img src={imageSrc} alt={`${name} portrait`} className="w-full h-full object-cover" />
            </div>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">{name}</h1>
          <p className="text-lg text-muted-foreground font-medium mb-6">{role}</p>

          <div className="w-full rounded-xl border border-border bg-card/40 p-6 md:p-8 text-left mb-8">
            <h2 className="text-xl font-semibold mb-3 text-foreground">About</h2>
            <div className="text-muted-foreground leading-relaxed space-y-3 text-sm">
              {about}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            {SOCIALS.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card/40 text-sm font-medium text-foreground hover:bg-primary/10 hover:text-primary transition-colors"
              >
                <s.icon className="h-4 w-4" />
                {s.label}
              </a>
            ))}
          </div>

          {/* Portfolio */}
          <div className="w-full mt-12 text-left">
            <h2 className="text-xl font-semibold mb-1 text-foreground">Development Portfolio</h2>
            <p className="text-sm text-muted-foreground mb-6">
              A look at past work — builds, scripts, and models.
            </p>

            {loading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No portfolio items yet.
              </div>
            ) : (
              <div className="space-y-8">
                {CATEGORIES.filter((c) => grouped.has(c)).map((cat) => (
                  <section key={cat}>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                      {cat}s
                    </h3>
                    <div className="space-y-3">
                      {(grouped.get(cat) ?? []).map((item, idx, arr) => (
                        <PortfolioCard
                          key={item.id}
                          item={item}
                          expanded={expandedId === item.id}
                          onToggle={() =>
                            setExpandedId((cur) => (cur === item.id ? null : item.id))
                          }
                          isOwner={isOwner}
                          isFirst={idx === 0}
                          isLast={idx === arr.length - 1}
                          onChanged={refresh}
                          siblings={arr}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>

          {/* Admin block */}
          {isOwner && (
            <div className="w-full mt-12 text-left rounded-xl border border-primary/30 bg-primary/5 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Manage Portfolio</h2>
                  <p className="text-xs text-muted-foreground">
                    Only visible to you. Add new items, upload photos/videos, edit, and reorder.
                  </p>
                </div>
              </div>
              <PortfolioEditor onChanged={refresh} ownerKey={ownerKey} />
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Portfolio card (public view, with inline expand)
// ────────────────────────────────────────────────────────────────────────────

function PortfolioCard({
  item,
  expanded,
  onToggle,
  isOwner,
  isFirst,
  isLast,
  onChanged,
  siblings,
}: {
  item: PortfolioItem;
  expanded: boolean;
  onToggle: () => void;
  isOwner: boolean;
  isFirst: boolean;
  isLast: boolean;
  onChanged: () => void;
  siblings: PortfolioItem[];
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);

  const move = async (direction: -1 | 1) => {
    const idx = siblings.findIndex((s) => s.id === item.id);
    const swapWith = siblings[idx + direction];
    if (!swapWith) return;
    const a = item.sort_order;
    const b = swapWith.sort_order;
    const newA = b === a ? a + direction : b;
    const newB = b === a ? a : a;
    const { error: e1 } = await (supabase as any)
      .from("portfolio_items")
      .update({ sort_order: newA })
      .eq("id", item.id);
    const { error: e2 } = await (supabase as any)
      .from("portfolio_items")
      .update({ sort_order: newB })
      .eq("id", swapWith.id);
    if (e1 || e2) {
      toast({ title: "Reorder failed", description: (e1 ?? e2)?.message, variant: "destructive" });
    }
    onChanged();
  };

  const remove = async () => {
    if (!confirm(`Delete "${item.title}"? This will also remove its uploaded media.`)) return;
    const paths = item.media
      .map((m) => extractStoragePath(m.url))
      .filter((p): p is string => !!p);
    if (paths.length > 0) {
      await supabase.storage.from("portfolio").remove(paths);
    }
    const { error } = await (supabase as any).from("portfolio_items").delete().eq("id", item.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    }
    onChanged();
  };

  if (editing) {
    return (
      <PortfolioForm
        existing={item}
        ownerKey={item.owner_key}
        onCancel={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          onChanged();
        }}
      />
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-start gap-3 p-5 text-left hover:bg-card/60 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${categoryClass(item.category)}`}
            >
              {item.category}
            </span>
            {item.media.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {item.media.length} {item.media.length === 1 ? "item" : "items"}
              </span>
            )}
          </div>
          <h4 className="font-semibold text-foreground">{item.title}</h4>
          {item.description && (
            <p className="text-sm text-muted-foreground leading-relaxed mt-1 line-clamp-2">
              {item.description}
            </p>
          )}
        </div>
        <div className="text-muted-foreground shrink-0 mt-1">
          {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border p-5 space-y-4">
          {item.description && (
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {item.description}
            </p>
          )}
          {item.media.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No media added yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {item.media.map((m, i) =>
                m.kind === "video" ? (
                  <video
                    key={i}
                    src={m.url}
                    controls
                    className="w-full rounded-lg border border-border bg-black"
                  />
                ) : (
                  <a
                    key={i}
                    href={m.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-lg overflow-hidden border border-border bg-muted"
                  >
                    <img
                      src={m.url}
                      alt={`${item.title} media ${i + 1}`}
                      className="w-full h-48 object-cover hover:opacity-90 transition-opacity"
                    />
                  </a>
                ),
              )}
            </div>
          )}

          {isOwner && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isFirst}
                onClick={() => move(-1)}
              >
                <ArrowUp className="h-3.5 w-3.5 mr-1" /> Up
              </Button>
              <Button size="sm" variant="outline" disabled={isLast} onClick={() => move(1)}>
                <ArrowDown className="h-3.5 w-3.5 mr-1" /> Down
              </Button>
              <Button size="sm" variant="destructive" onClick={remove}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PortfolioEditor({ onChanged, ownerKey }: { onChanged: () => void; ownerKey: string }) {
  const [showForm, setShowForm] = useState(false);
  if (!showForm) {
    return (
      <Button onClick={() => setShowForm(true)} variant="default" size="sm">
        <Plus className="h-4 w-4 mr-1" /> Add new item
      </Button>
    );
  }
  return (
    <PortfolioForm
      ownerKey={ownerKey}
      onCancel={() => setShowForm(false)}
      onSaved={() => {
        setShowForm(false);
        onChanged();
      }}
    />
  );
}

function PortfolioForm({
  existing,
  ownerKey,
  onCancel,
  onSaved,
}: {
  existing?: PortfolioItem;
  ownerKey: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [category, setCategory] = useState<string>(existing?.category ?? "Build");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [media, setMedia] = useState<MediaItem[]>(existing?.media ?? []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const onUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const next: MediaItem[] = [...media];
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() ?? "bin";
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("portfolio").upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (error) {
          toast({ title: "Upload failed", description: error.message, variant: "destructive" });
          continue;
        }
        const { data: pub } = supabase.storage.from("portfolio").getPublicUrl(path);
        const kind: "image" | "video" = file.type.startsWith("video/") ? "video" : "image";
        next.push({ url: pub.publicUrl, kind });
      }
      setMedia(next);
    } finally {
      setUploading(false);
    }
  };

  const removeMedia = async (idx: number) => {
    const target = media[idx];
    const path = extractStoragePath(target.url);
    if (path) {
      await supabase.storage.from("portfolio").remove([path]);
    }
    setMedia(media.filter((_, i) => i !== idx));
  };

  const save = async () => {
    if (!title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      category,
      title: title.trim(),
      description: description.trim() || null,
      media,
    };
    if (existing) {
      const { error } = await (supabase as any)
        .from("portfolio_items")
        .update(payload)
        .eq("id", existing.id);
      if (error) {
        toast({ title: "Save failed", description: error.message, variant: "destructive" });
        setSaving(false);
        return;
      }
    } else {
      const { data: maxRow } = await (supabase as any)
        .from("portfolio_items")
        .select("sort_order")
        .eq("owner_key", ownerKey)
        .eq("category", category)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextOrder = ((maxRow?.sort_order as number | undefined) ?? 0) + 1;
      const { error } = await (supabase as any)
        .from("portfolio_items")
        .insert({ ...payload, sort_order: nextOrder, owner_key: ownerKey });
      if (error) {
        toast({ title: "Save failed", description: error.message, variant: "destructive" });
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    onSaved();
  };

  return (
    <div className="space-y-4 rounded-lg border border-border bg-background/60 p-4">
      <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-3">
        <div className="space-y-1.5">
          <Label>Section</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Title</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Police Cruiser Pack"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short description of this work"
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label>Photos & videos</Label>
        {media.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {media.map((m, i) => (
              <div
                key={i}
                className="relative rounded-md overflow-hidden border border-border bg-muted aspect-video"
              >
                {m.kind === "video" ? (
                  <video src={m.url} className="w-full h-full object-cover" />
                ) : (
                  <img src={m.url} alt="" className="w-full h-full object-cover" />
                )}
                <button
                  type="button"
                  onClick={() => removeMedia(i)}
                  className="absolute top-1 right-1 p-1 rounded bg-background/80 hover:bg-destructive hover:text-destructive-foreground transition-colors"
                  aria-label="Remove media"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-border bg-card/40 text-sm cursor-pointer hover:bg-card/70 transition-colors">
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {uploading ? "Uploading…" : "Upload photos / videos"}
          <input
            type="file"
            multiple
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => onUpload(e.target.files)}
          />
        </label>
      </div>

      <div className="flex gap-2 pt-2 border-t border-border">
        <Button onClick={save} disabled={saving || uploading} size="sm">
          {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          {existing ? "Save changes" : "Add item"}
        </Button>
        <Button onClick={onCancel} variant="outline" size="sm" disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function extractStoragePath(url: string): string | null {
  const marker = "/storage/v1/object/public/portfolio/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length));
}
