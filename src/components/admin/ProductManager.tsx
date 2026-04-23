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
import { Upload, Package, Trash2, ImagePlus, Loader2, X, FileText, Sparkles, Wand2, Pencil } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
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
  created_at: string;
};

const CATEGORIES = ["Systems", "Assets"] as const;
const MAX_IMAGES = 6;
const MAX_FILE_MB = 50;
// Default conversion rate used to suggest a Robux price from USD.
// (Roughly tracks the Roblox Premium payout rate of ~80 R$ per $1.)
const ROBUX_PER_USD = 80;

const extractGamepassId = (url: string): string | null => {
  const m = url.match(/game-pass\/(\d+)/i) || url.match(/gamepasses?\/(\d+)/i);
  return m?.[1] ?? null;
};

type PendingImage = { file: File; preview: string };

export const ProductManager = ({ userId }: { userId: string }) => {
  const [products, setProducts] = useState<DbProduct[]>([]);
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
  const [images, setImages] = useState<PendingImage[]>([]);
  const [isAvailable, setIsAvailable] = useState(true);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [priceRobux, setPriceRobux] = useState("");
  const [gamepassUrl, setGamepassUrl] = useState("");

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
    setGamepassUrl("");
  };

  const startEdit = (p: DbProduct) => {
    setEditingId(p.id);
    setName(p.name);
    setPrice(String(p.price ?? ""));
    setDescription(p.description ?? "");
    setCategory(p.category || "Systems");
    setEmoji(p.emoji || "📦");
    setImages([]);
    setIsAvailable(p.is_available);
    setAttachedFile(null);
    setPriceRobux(p.price_robux != null ? String(p.price_robux) : "");
    setGamepassUrl(p.gamepass_url ?? "");
    setOpen(true);
  };

  const handleDialogOpenChange = (next: boolean) => {
    if (!next) {
      images.forEach((i) => URL.revokeObjectURL(i.preview));
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

  useEffect(() => {
    loadProducts();
  }, []);

  const handleFilesChange = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const incoming = Array.from(files);
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      sonnerToast.error("Image limit reached", { description: `Up to ${MAX_IMAGES} images per product.` });
      return;
    }
    const accepted: PendingImage[] = [];
    for (const file of incoming.slice(0, remaining)) {
      if (file.size > 5 * 1024 * 1024) {
        sonnerToast.error(`"${file.name}" too large`, { description: "Please keep each image under 5MB." });
        continue;
      }
      accepted.push({ file, preview: URL.createObjectURL(file) });
    }
    setImages((prev) => [...prev, ...accepted]);
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed.preview);
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
      const uploadedUrls: string[] = [];
      for (const img of images) {
        const ext = img.file.name.split(".").pop() || "png";
        const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(path, img.file, { cacheControl: "3600", upsert: false });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from("product-images").getPublicUrl(path);
        uploadedUrls.push(data.publicUrl);
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
      const trimmedGamepass = gamepassUrl.trim();
      const gamepassId = trimmedGamepass ? extractGamepassId(trimmedGamepass) : null;
      if (trimmedGamepass && !gamepassId) {
        throw new Error("Couldn't read a gamepass ID from that URL. It should look like https://www.roblox.com/game-pass/12345678/...");
      }

      if (editingId) {
        // Update existing product. Only overwrite images/file if new ones were provided.
        const updatePayload: Record<string, unknown> = {
          name: name.trim(),
          description: description.trim() || null,
          price: priceNum,
          category,
          emoji: emoji || "📦",
          is_available: isAvailable,
          price_robux: robuxNum,
          gamepass_id: gamepassId,
          gamepass_url: trimmedGamepass || null,
        };
        if (uploadedUrls.length > 0) {
          updatePayload.image_url = uploadedUrls[0];
          updatePayload.image_urls = uploadedUrls;
        }
        if (attachedFile) {
          updatePayload.file_url = fileUrl;
          updatePayload.file_name = fileName;
        }
        const { error: updateError } = await supabase
          .from("products")
          .update(updatePayload)
          .eq("id", editingId);
        if (updateError) throw updateError;
        sonnerToast.success("Product updated", {
          description: `${name} has been saved.`,
        });
      } else {
        const { error: insertError } = await supabase.from("products").insert({
          name: name.trim(),
          description: description.trim() || null,
          price: priceNum,
          category,
          emoji: emoji || "📦",
          image_url: uploadedUrls[0] ?? null,
          image_urls: uploadedUrls,
          is_available: isAvailable,
          file_url: fileUrl,
          file_name: fileName,
          price_robux: robuxNum,
          gamepass_id: gamepassId,
          gamepass_url: trimmedGamepass || null,
          created_by: userId,
        });
        if (insertError) throw insertError;

        sonnerToast.success(isAvailable ? "Product uploaded!" : "Teaser added!", {
          description: isAvailable
            ? `${name} is now live on the storefront.`
            : `${name} is showing as a teaser — purchases disabled.`,
        });
      }
      images.forEach((i) => URL.revokeObjectURL(i.preview));
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
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
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      ${Number(p.price).toFixed(2)}
                      {p.price_robux ? ` · R$${p.price_robux.toLocaleString()}` : ""}
                      {" · "}{p.category}
                      {p.file_name ? ` · ${p.file_name}` : ""}
                    </div>
                  </div>
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
              );
            })}
          </div>
        )}
      </Card>

      {/* Upload dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upload a new product</DialogTitle>
            <DialogDescription>
              Once you save, this product will appear on the public storefront.
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
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prod-emoji">Emoji (fallback icon if no images)</Label>
              <Input
                id="prod-emoji"
                placeholder="📦"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                maxLength={4}
              />
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
              <Label>Product images ({images.length}/{MAX_IMAGES})</Label>

              {images.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {images.map((img, i) => (
                    <div
                      key={img.preview}
                      className="relative aspect-video rounded-md overflow-hidden border border-border bg-muted group"
                    >
                      <img
                        src={img.preview}
                        alt={`Preview ${i + 1}`}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      {i === 0 && (
                        <span className="absolute top-1 left-1 text-[9px] font-semibold bg-primary text-primary-foreground rounded px-1.5 py-0.5 uppercase tracking-wider">
                          Cover
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="absolute top-1 right-1 h-5 w-5 rounded-full bg-background/90 hover:bg-destructive hover:text-destructive-foreground grid place-items-center transition-smooth"
                        aria-label="Remove image"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {images.length < MAX_IMAGES && (
                <label className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-smooth cursor-pointer">
                  <div className="h-12 w-16 rounded-md bg-primary/10 grid place-items-center shrink-0">
                    <ImagePlus className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 text-sm">
                    <div className="font-medium">
                      {images.length === 0 ? "Upload images" : "Add more images"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      PNG, JPG, or WebP — up to 5MB each. First image is the cover.
                    </div>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
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
                Add a Roblox gamepass so customers can pay in R$. Our bot verifies the
                purchase from group sales and fulfils via Discord DM.
              </p>
              <div className="grid grid-cols-2 gap-3">
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
                    "Auto" suggests ~{ROBUX_PER_USD} R$ per $1.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prod-gamepass">Gamepass URL</Label>
                  <Input
                    id="prod-gamepass"
                    placeholder="https://www.roblox.com/game-pass/12345678/..."
                    value={gamepassUrl}
                    onChange={(e) => setGamepassUrl(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Must be in the group set as <code>ROBLOX_GROUP_ID</code>.
                  </p>
                </div>
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
                  Uploading…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Save product
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
