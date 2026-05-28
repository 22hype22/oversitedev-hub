import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Trash2, Upload, ImageIcon, Eye, EyeOff } from "lucide-react";

type CaptchaImage = {
  id: string;
  image_url: string;
  answer: string;
  created_at: string;
};

const BUCKET = "captcha-images";

export const CaptchaImageManager = () => {
  const [images, setImages] = useState<CaptchaImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [answer, setAnswer] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("captcha_images")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Failed to load captcha images", description: error.message, variant: "destructive" });
    } else {
      setImages((data ?? []) as CaptchaImage[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleUpload = async () => {
    if (!file || !answer.trim()) {
      toast({ title: "Missing fields", description: "Pick an image and enter the answer.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || undefined,
        upsert: false,
      });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);

      const { error: insErr } = await supabase
        .from("captcha_images")
        .insert({ image_url: pub.publicUrl, answer: answer.trim() });
      if (insErr) throw insErr;

      toast({ title: "Captcha image added" });
      setFile(null);
      setAnswer("");
      const fileInput = document.getElementById("captcha-file") as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Upload failed", description: msg, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (img: CaptchaImage) => {
    setDeletingId(img.id);
    try {
      // derive storage path from public URL
      const marker = `/object/public/${BUCKET}/`;
      const idx = img.image_url.indexOf(marker);
      const path = idx >= 0 ? img.image_url.slice(idx + marker.length) : null;

      const { error: delErr } = await supabase.from("captcha_images").delete().eq("id", img.id);
      if (delErr) throw delErr;

      if (path) {
        await supabase.storage.from(BUCKET).remove([path]);
      }

      setImages((prev) => prev.filter((x) => x.id !== img.id));
      toast({ title: "Deleted" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Delete failed", description: msg, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card className="p-5 space-y-5">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center">
          <ImageIcon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-base font-semibold">Captcha images</h3>
          <p className="text-xs text-muted-foreground">
            Upload captcha images and their answers. Bots will read from this pool.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end">
        <div className="space-y-1.5">
          <Label htmlFor="captcha-file">Image</Label>
          <Input
            id="captcha-file"
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={uploading}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="captcha-answer">Answer</Label>
          <Input
            id="captcha-answer"
            placeholder="e.g. A7B9K"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={uploading}
          />
        </div>
        <Button onClick={handleUpload} disabled={uploading || !file || !answer.trim()}>
          <Upload className="h-4 w-4 mr-2" />
          {uploading ? "Uploading..." : "Add"}
        </Button>
      </div>

      <div className="border-t pt-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : images.length === 0 ? (
          <p className="text-sm text-muted-foreground">No captcha images yet.</p>
        ) : (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {images.map((img) => (
              <div
                key={img.id}
                className="border rounded-lg overflow-hidden bg-muted/30 flex flex-col"
              >
                <div className="aspect-video bg-background grid place-items-center overflow-hidden">
                  <img
                    src={img.image_url}
                    alt={`Captcha answer ${img.answer}`}
                    className="max-h-full max-w-full object-contain"
                    loading="lazy"
                  />
                </div>
                <div className="p-2 space-y-2">
                  <div className="text-xs font-mono truncate" title={img.answer}>
                    {img.answer}
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full h-7"
                    onClick={() => handleDelete(img)}
                    disabled={deletingId === img.id}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    {deletingId === img.id ? "..." : "Delete"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};
