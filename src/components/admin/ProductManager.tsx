import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, Package, Trash2, ImagePlus, Loader2, X, FileText, Sparkles, Wand2, Pencil, Film } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { toast as sonnerToast } from "sonner";

type DbProduct = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  emoji: string | null;
  image_url: string | null;
  image_urls: string[] | null;
  is_available: boolean;
  file_url: string | null;
  file_name: string | null;
  price_robux: number | null;
  gamepass_id: string | null;
  gamepass_url: string | null;
  current_version: string | null;
  upgrade_price: number | null;
  upgrade_price_robux: number | null;
  created_at: string;
};

const FALLBACK_CATEGORIES = ["Systems", "Assets"] as const;
const MAX_IMAGES = 6;
const MAX_FILE_MB = 50;
const MAX_IMAGE_MB = 5;
const MAX_VIDEO_MB = 200;
const isVideoFile = (file: File) => file.type.startsWith("video/");
// Default conversion rate used to suggest a Robux price from USD.
// (Roughly tracks the Roblox Premium payout rate of ~80 R$ per $1.)
const ROBUX_PER_USD = 80;


type MediaItem =
  | { kind: "existing"; url: string; id: string }
  | { kind: "pending"; file: File; preview: string; id: string };

const isVideoUrl = (url: string) => /\.(mp4|webm|mov|m4v|ogg)(\?|#|$)/i.test(url);
const mediaId = () => `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const ProductManager = ({ userId }: { userId: string }) => {
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [categories, setCategories] = useState<string[]>([...FALLBACK_CATEGORIES]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("Systems");
  const [emoji, setEmoji] = useState("📦");
  const [images, setImages] = useState<MediaItem[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [isAvailable, setIsAvailable] = useState(true);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [priceRobux, setPriceRobux] = useState("");
  const [currentVersion, setCurrentVersion] = useState("");

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setPrice("");
    setDescription("");
    setCategory("Systems");
    setEmoji("📦");
    setImages([]);
    setIsAvailable(true);
    setAttachedFile(null);
    setPriceRobux("");
    setCurrentVersion("");
  };

  const startEdit = (p: DbProduct) => {
    setEditingId(p.id);
    setName(p.name);
    setPrice(String(p.price ?? ""));
    setDescription(p.description ?? "");
    setCategory(p.category || "Systems");
    setEmoji(p.emoji || "📦");
    const existingUrls = (p.image_urls && p.image_urls.length > 0)
      ? p.image_urls
      : (p.image_url ? [p.image_url] : []);
    setImages(
      existingUrls.map((url) => ({ kind: "existing", url, id: mediaId() })),
    );
    setIsAvailable(p.is_available);
    setAttachedFile(null);
    setPriceRobux(p.price_robux != null ? String(p.price_robux) : "");
    setCurrentVersion(p.current_version ?? "");
    setOpen(true);
  };

  const handleDialogOpenChange = (next: boolean) => {
    if (!next) {
      images.forEach((i) => {
        if (i.kind === "pending") URL.revokeObjectURL(i.preview);
      });
      resetForm();
    }
    setOpen(next);
  };

  const loadProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      sonnerToast.error("Failed to load products", { description: error.message });
    } else {
      setProducts((data as DbProduct[]) ?? []);
    }
    setLoading(false);
  };

  const loadCategories = async () => {
    const { data } = await (supabase as any)
      .from("product_categories")
      .select("name, sort_order")
      .order("sort_order", { ascending: true });
    if (data && data.length > 0) {
      const names = data.map((c: { name: string }) => c.name);
      setCategories(names);
      setCategory((prev) => (names.includes(prev) ? prev : names[0]));
    }
  };

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  const handleFilesChange = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const incoming = Array.from(files);
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      sonnerToast.error("Image limit reached", { description: `Up to ${MAX_IMAGES} images per product.` });
      return;
    }
    const accepted: MediaItem[] = [];
    for (const file of incoming.slice(0, remaining)) {
      const isVideo = isVideoFile(file);
      const limitMb = isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB;
      if (file.size > limitMb * 1024 * 1024) {
        sonnerToast.error(`"${file.name}" too large`, {
          description: isVideo
            ? `Please keep each video under ${MAX_VIDEO_MB}MB.`
            : `Please keep each image under ${MAX_IMAGE_MB}MB.`,
        });
        continue;
      }
      accepted.push({ kind: "pending", file, preview: URL.createObjectURL(file), id: mediaId() });
    }
    setImages((prev) => [...prev, ...accepted]);
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed && removed.kind === "pending") URL.revokeObjectURL(removed.preview);
      return next;
    });
  };

  const reorderImages = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return;
    setImages((prev) => {
      if (from >= prev.length || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      sonnerToast.error("Product name is required");
      return;
    }
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      sonnerToast.error("Enter a valid price");
      return;
    }
    setSubmitting(true);
    try {
      // Upload any pending files; build the final ordered URL list
      // by walking the current `images` array so the user's order is preserved.
      const finalUrls: string[] = [];
      for (const item of images) {
        if (item.kind === "existing") {
          finalUrls.push(item.url);
          continue;
        }
        const ext = item.file.name.split(".").pop() || "png";
        const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(path, item.file, { cacheControl: "3600", upsert: false });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from("product-images").getPublicUrl(path);
        finalUrls.push(data.publicUrl);
      }

      let fileUrl: string | null = null;
      let fileName: string | null = null;
      if (attachedFile) {
        const safeName = attachedFile.name.replace(/[^\w.\-]+/g, "_");
        const path = `${userId}/${Date.now()}-${safeName}`;
        const { error: fileErr } = await supabase.storage
          .from("product-files")
          .upload(path, attachedFile, { cacheControl: "3600", upsert: false });
        if (fileErr) throw fileErr;
        fileUrl = path;
        fileName = attachedFile.name;
      }

      const robuxNum = priceRobux.trim() ? parseInt(priceRobux.trim(), 10) : null;
      if (priceRobux.trim() && (robuxNum === null || isNaN(robuxNum) || robuxNum < 0)) {
        throw new Error("Robux price must be a non-negative whole number.");
      }
      // Auto-create or auto-update the Roblox gamepass when a Robux price is set.
      // The edge function uses ROBLOX_COOKIE to create/update the pass on our game.
      // Determine current gamepass id (for edits) so we can decide create vs update.
      const existingProduct = editingId
        ? products.find((p) => p.id === editingId)
        : null;
      let gamepassId: string | null = existingProduct?.gamepass_id ?? null;
      let gamepassUrl: string | null = existingProduct?.gamepass_url ?? null;

      if (robuxNum !== null && robuxNum > 0) {
        const coverImage = finalUrls[0];
        if (!coverImage) {
          throw new Error("Add at least one product image — it's used as the gamepass icon.");
        }

        if (!gamepassId) {
          // Create new gamepass.
          const { data, error } = await supabase.functions.invoke("manage-roblox-gamepass", {
            body: {
              action: "create",
              name: name.trim(),
              priceRobux: robuxNum,
              iconUrl: coverImage,
            },
          });
          if (error) throw new Error(`Couldn't create Roblox gamepass: ${error.message}`);
          if (!data?.gamepassId) throw new Error("Roblox gamepass create returned no id");
          gamepassId = String(data.gamepassId);
          gamepassUrl = String(data.gamepassUrl ?? `https://www.roblox.com/game-pass/${gamepassId}/`);
        } else if (existingProduct && existingProduct.price_robux !== robuxNum) {
          // Price changed — sync to Roblox.
          const { error } = await supabase.functions.invoke("manage-roblox-gamepass", {
            body: {
              action: "update_price",
              gamepassId,
              priceRobux: robuxNum,
            },
          });
          if (error) throw new Error(`Couldn't update Roblox gamepass price: ${error.message}`);
        }
      } else {
        // No Robux price — clear gamepass linkage.
        gamepassId = null;
        gamepassUrl = null;
      }

      const trimmedVersion = currentVersion.trim() || null;

      if (editingId) {
        // If admin typed an existing version without uploading a new file,
        // reuse the previously stored file for that version.
        let reusedFileUrl: string | null = null;
        let reusedFileName: string | null = null;
        if (!attachedFile && trimmedVersion) {
          const { data: existingVersion } = await (supabase as any)
            .from("product_versions")
            .select("file_url, file_name")
            .eq("product_id", editingId)
            .eq("version", trimmedVersion)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (existingVersion?.file_url) {
            reusedFileUrl = existingVersion.file_url;
            reusedFileName = existingVersion.file_name;
          }
        }

        // Always persist the current ordered media list (existing + new uploads),
        // so reorders and removals are saved.
        const updatePayload: TablesUpdate<"products"> = {
          name: name.trim(),
          description: description.trim() || null,
          price: priceNum,
          category,
          emoji: emoji || "📦",
          is_available: isAvailable,
          price_robux: robuxNum,
          gamepass_id: gamepassId,
          gamepass_url: gamepassUrl,
          image_url: finalUrls[0] ?? null,
          image_urls: finalUrls,
          current_version: trimmedVersion,
        };
        if (attachedFile) {
          updatePayload.file_url = fileUrl;
          updatePayload.file_name = fileName;
        } else if (reusedFileUrl) {
          updatePayload.file_url = reusedFileUrl;
          updatePayload.file_name = reusedFileName;
        }
        const { error: updateError } = await supabase
          .from("products")
          .update(updatePayload)
          .eq("id", editingId);
        if (updateError) throw updateError;

        // If a new file was uploaded, snapshot it as a versioned row.
        // Trigger keeps only the 3 most recent versions per product.
        if (attachedFile && fileUrl && trimmedVersion) {
          await (supabase as any).from("product_versions").insert({
            product_id: editingId,
            version: trimmedVersion,
            file_url: fileUrl,
            file_name: fileName,
          });
        }

        sonnerToast.success("Product updated", {
          description: `${name} has been saved.`,
        });
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from("products")
          .insert({
            name: name.trim(),
            description: description.trim() || null,
            price: priceNum,
            category,
            emoji: emoji || "📦",
            image_url: finalUrls[0] ?? null,
            image_urls: finalUrls,
            is_available: isAvailable,
            file_url: fileUrl,
            file_name: fileName,
            price_robux: robuxNum,
            gamepass_id: gamepassId,
            gamepass_url: gamepassUrl,
            current_version: trimmedVersion,
            created_by: userId,
          })
          .select("id")
          .single();
        if (insertError) throw insertError;

        // Snapshot the initial version row if both file + version were provided.
        if (inserted?.id && fileUrl && trimmedVersion) {
          await (supabase as any).from("product_versions").insert({
            product_id: inserted.id,
            version: trimmedVersion,
            file_url: fileUrl,
            file_name: fileName,
          });
        }

        sonnerToast.success(isAvailable ? "Product uploaded!" : "Teaser added!", {
          description: isAvailable
            ? `${name} is now live on the storefront.`
            : `${name} is showing as a teaser — purchases disabled.`,
        });
      }
      images.forEach((i) => {
        if (i.kind === "pending") URL.revokeObjectURL(i.preview);
      });
      resetForm();
      setOpen(false);
      await loadProducts();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      sonnerToast.error("Upload failed", { description: message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (product: DbProduct) => {
    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("products").delete().eq("id", product.id);
    if (error) {
      sonnerToast.error("Delete failed", { description: error.message });
      return;
    }
    sonnerToast.success("Product deleted");
    setProducts((prev) => prev.filter((p) => p.id !== product.id));
  };

  const thumbFor = (p: DbProduct) =>
    (p.image_urls && p.image_urls[0]) || p.image_url || null;

  return (
    <>
      {/* Upload Products card — same style as plugin tiles */}
      <Card
        onClick={() => setOpen(true)}
        className="group cursor-pointer bg-card hover:bg-card/80 border-border hover:border-primary/50 hover:shadow-elegant transition-smooth p-6 flex flex-col min-h-[170px]"
      >
        <div className="flex items-start gap-3 mb-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center shrink-0 group-hover:bg-primary/15 transition-smooth">
            <Upload className="h-5 w-5 text-primary" />
          </div>
          <h3 className="font-semibold text-base leading-tight pt-1.5">Upload Products</h3>
        </div>
        <p className="text-sm text-muted-foreground flex-1">
          Add new products to the storefront with pricing, description, and up to {MAX_IMAGES} images.
        </p>
        <div className="flex justify-end mt-3 text-xs text-primary font-medium">
          Click to open →
        </div>
      </Card>

      {/* Current Products card */}
      <Card className="bg-card border-border p-6 flex flex-col min-h-[170px] sm:col-span-2 lg:col-span-3 xl:col-span-3">
        <div className="flex items-start gap-3 mb-4">
          <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center shrink-0">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-base leading-tight">Current Products</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {loading
                ? "Loading…"
                : products.length === 0
                ? "No custom products yet. Upload your first one!"
                : `${products.length} product${products.length === 1 ? "" : "s"} live on the storefront.`}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
            {products.map((p) => {
              const thumb = thumbFor(p);
              const count = p.image_urls?.length ?? (p.image_url ? 1 : 0);
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background/50"
                >
                  {thumb ? (
                    <div className="relative h-10 w-16 shrink-0">
                      <img
                        src={thumb}
                        alt={p.name}
                        className="h-10 w-16 rounded-md object-cover border border-border"
                      />
                      {count > 1 && (
                        <span className="absolute -bottom-1 -right-1 text-[10px] font-semibold bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 leading-none">
                          {count}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="h-10 w-16 rounded-md bg-primary/10 grid place-items-center text-xl shrink-0">
                      {p.emoji || "📦"}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-sm truncate">{p.name}</div>
                      {!p.is_available && (
                        <span className="text-[9px] font-semibold uppercase tracking-wider bg-accent/30 text-accent-foreground border border-accent/40 rounded px-1.5 py-0.5">
                          Teaser
                        </span>
                      )}
                      {p.file_url && (
                        <span className="text-[9px] font-semibold uppercase tracking-wider bg-primary/15 text-primary border border-primary/30 rounded px-1.5 py-0.5">
                          File
                        </span>
                      )}
                      {p.gamepass_id && (
                        <span className="text-[9px] font-semibold uppercase tracking-wider bg-primary/15 text-primary border border-primary/30 rounded px-1.5 py-0.5">
                          R$
                        </span>
                      )}
                      {p.current_version && (
                        <span className="text-[9px] font-semibold uppercase tracking-wider bg-secondary text-secondary-foreground border border-border rounded px-1.5 py-0.5">
                          {p.current_version}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      ${Number(p.price).toFixed(2)}
                      {p.price_robux ? ` · R$${p.price_robux.toLocaleString()}` : ""}
                      {" · "}{p.category}
                      {p.file_name ? ` · ${p.file_name}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={() => startEdit(p)}
                      aria-label={`Edit ${p.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(p)}
                      aria-label={`Delete ${p.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Upload dialog */}
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit product" : "Upload a new product"}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update product details. Leave images and file untouched to keep the existing ones."
                : "Once you save, this product will appear on the public storefront."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="prod-name">Product name</Label>
              <Input
                id="prod-name"
                placeholder="e.g. Custom Welcome Pack"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="prod-price">Price (USD)</Label>
                <Input
                  id="prod-price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="29.99"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prod-category">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="prod-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prod-desc">Description</Label>
              <Textarea
                id="prod-desc"
                placeholder="What does this product do?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Product media ({images.length}/{MAX_IMAGES})</Label>
              {images.length > 1 && (
                <p className="text-[11px] text-muted-foreground -mt-1">
                  Drag tiles to reorder. The first one is the cover.
                </p>
              )}

              {images.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {images.map((item, i) => {
                    const src = item.kind === "pending" ? item.preview : item.url;
                    const video =
                      item.kind === "pending"
                        ? isVideoFile(item.file)
                        : isVideoUrl(item.url);
                    const isDragOver = overIndex === i && dragIndex !== null && dragIndex !== i;
                    return (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={(e) => {
                          setDragIndex(i);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          if (overIndex !== i) setOverIndex(i);
                        }}
                        onDragLeave={() => {
                          if (overIndex === i) setOverIndex(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (dragIndex !== null) reorderImages(dragIndex, i);
                          setDragIndex(null);
                          setOverIndex(null);
                        }}
                        onDragEnd={() => {
                          setDragIndex(null);
                          setOverIndex(null);
                        }}
                        className={`relative aspect-video rounded-md overflow-hidden border bg-muted group cursor-move transition-smooth ${
                          isDragOver
                            ? "border-primary ring-2 ring-primary/40"
                            : "border-border"
                        } ${dragIndex === i ? "opacity-50" : ""}`}
                      >
                        {video ? (
                          <video
                            src={src}
                            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                            muted
                            playsInline
                          />
                        ) : (
                          <img
                            src={src}
                            alt={`Preview ${i + 1}`}
                            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                          />
                        )}
                        {i === 0 && (
                          <span className="absolute top-1 left-1 text-[9px] font-semibold bg-primary text-primary-foreground rounded px-1.5 py-0.5 uppercase tracking-wider">
                            Cover
                          </span>
                        )}
                        {video && (
                          <span className="absolute bottom-1 left-1 text-[9px] font-semibold bg-background/80 text-foreground rounded px-1.5 py-0.5 uppercase tracking-wider flex items-center gap-1">
                            <Film className="h-2.5 w-2.5" /> Video
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeImage(i)}
                          className="absolute top-1 right-1 h-5 w-5 rounded-full bg-background/90 hover:bg-destructive hover:text-destructive-foreground grid place-items-center transition-smooth"
                          aria-label="Remove media"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {images.length < MAX_IMAGES && (
                <label className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-smooth cursor-pointer">
                  <div className="h-12 w-16 rounded-md bg-primary/10 grid place-items-center shrink-0">
                    <ImagePlus className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 text-sm">
                    <div className="font-medium">
                      {images.length === 0 ? "Upload images or videos" : "Add more media"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Images (PNG/JPG/WebP, ≤{MAX_IMAGE_MB}MB) or videos (MP4/WebM/MOV, ≤{MAX_VIDEO_MB}MB). First item is the cover.
                    </div>
                  </div>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      handleFilesChange(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>

            {/* Robux pricing + gamepass */}
            <div className="space-y-3 p-3 rounded-lg border border-border bg-background/50">
              <div className="flex items-center gap-2">
                <Wand2 className="h-4 w-4 text-primary" />
                <Label className="text-sm font-medium">Buy with Robux (optional)</Label>
              </div>
              <p className="text-xs text-muted-foreground -mt-1">
                Set a Robux price and we'll automatically create a gamepass on
                your Roblox game using the product's name and cover image. Leave
                blank to skip Robux purchases.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="prod-robux">Price (R$)</Label>
                <div className="flex gap-2">
                  <Input
                    id="prod-robux"
                    type="number"
                    step="1"
                    min="0"
                    placeholder="2400"
                    value={priceRobux}
                    onChange={(e) => setPriceRobux(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => {
                      const usd = parseFloat(price);
                      if (isNaN(usd) || usd <= 0) {
                        sonnerToast.error("Enter a USD price first");
                        return;
                      }
                      setPriceRobux(String(Math.round(usd * ROBUX_PER_USD)));
                    }}
                  >
                    Auto
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  "Auto" suggests ~{ROBUX_PER_USD} R$ per $1. Changing this
                  price on an existing product also updates it on Roblox.
                </p>
              </div>
            </div>

            {/* Attached file (digital download) */}
            <div className="space-y-2">
              <Label>Attached file (optional)</Label>
              {attachedFile ? (
                <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background/50">
                  <div className="h-10 w-10 rounded-md bg-primary/10 grid place-items-center shrink-0">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{attachedFile.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {(attachedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setAttachedFile(null)}
                    aria-label="Remove file"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-smooth cursor-pointer">
                  <div className="h-10 w-10 rounded-md bg-primary/10 grid place-items-center shrink-0">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 text-sm">
                    <div className="font-medium">Attach a file</div>
                    <div className="text-xs text-muted-foreground">
                      Any file type — up to {MAX_FILE_MB}MB. Stored privately.
                    </div>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (!f) return;
                      if (f.size > MAX_FILE_MB * 1024 * 1024) {
                        sonnerToast.error("File too large", {
                          description: `Keep it under ${MAX_FILE_MB}MB.`,
                        });
                        return;
                      }
                      setAttachedFile(f);
                    }}
                  />
                </label>
              )}
            </div>

            {/* Version label */}
            <div className="space-y-1.5">
              <Label htmlFor="prod-version">Version (optional)</Label>
              <Input
                id="prod-version"
                placeholder="e.g. v3 or 1.2.0"
                value={currentVersion}
                onChange={(e) => setCurrentVersion(e.target.value)}
                maxLength={30}
              />
              <p className="text-[11px] text-muted-foreground">
                Shown on the storefront and stamped onto each new purchase. When you
                upload a new file together with a new version, the previous file is
                kept (last 3 versions) so existing buyers can still download what
                they paid for.
              </p>
            </div>

            {/* Availability / teaser toggle */}
            <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-background/50">
              <div className="h-10 w-10 rounded-md bg-primary/10 grid place-items-center shrink-0">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="prod-available" className="text-sm font-medium cursor-pointer">
                    Available for purchase
                  </Label>
                  <Switch
                    id="prod-available"
                    checked={isAvailable}
                    onCheckedChange={setIsAvailable}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {isAvailable
                    ? "Live on the storefront — customers can buy it now."
                    : "Shown as a teaser — visible but marked “Coming soon”, purchases disabled."}
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button variant="hero" onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {editingId ? "Saving…" : "Uploading…"}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  {editingId ? "Save changes" : "Save product"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
