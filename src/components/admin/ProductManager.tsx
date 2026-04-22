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
import { Upload, Package, Trash2, ImagePlus, Loader2 } from "lucide-react";
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
  created_at: string;
};

const CATEGORIES = ["Systems", "Assets"] as const;

export const ProductManager = ({ userId }: { userId: string }) => {
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("Systems");
  const [emoji, setEmoji] = useState("📦");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const resetForm = () => {
    setName("");
    setPrice("");
    setDescription("");
    setCategory("Systems");
    setEmoji("📦");
    setImageFile(null);
    setImagePreview(null);
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

  const handleFileChange = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      sonnerToast.error("Image too large", { description: "Please keep it under 5MB." });
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
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
      let imageUrl: string | null = null;
      if (imageFile) {
        const ext = imageFile.name.split(".").pop() || "png";
        const path = `${userId}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(path, imageFile, { cacheControl: "3600", upsert: false });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from("product-images").getPublicUrl(path);
        imageUrl = data.publicUrl;
      }

      const { error: insertError } = await supabase.from("products").insert({
        name: name.trim(),
        description: description.trim() || null,
        price: priceNum,
        category,
        emoji: emoji || "📦",
        image_url: imageUrl,
        created_by: userId,
      });
      if (insertError) throw insertError;

      sonnerToast.success("Product uploaded!", {
        description: `${name} is now live on the storefront.`,
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
          Add new products to the storefront with pricing, description, and an image.
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
            {products.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background/50"
              >
                {p.image_url ? (
                  <img
                    src={p.image_url}
                    alt={p.name}
                    className="h-10 w-10 rounded-md object-cover border border-border"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-md bg-primary/10 grid place-items-center text-xl">
                    {p.emoji || "📦"}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    ${Number(p.price).toFixed(2)} · {p.category}
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
            ))}
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
              <Label htmlFor="prod-emoji">Emoji (fallback icon)</Label>
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

            <div className="space-y-1.5">
              <Label>Product image</Label>
              <label className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-smooth cursor-pointer">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="h-14 w-14 rounded-md object-cover border border-border"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-md bg-primary/10 grid place-items-center">
                    <ImagePlus className="h-5 w-5 text-primary" />
                  </div>
                )}
                <div className="flex-1 text-sm">
                  <div className="font-medium">
                    {imageFile ? imageFile.name : "Upload an image"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    PNG, JPG, or WebP — up to 5MB
                  </div>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileChange(e.target.files?.[0])}
                />
              </label>
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
