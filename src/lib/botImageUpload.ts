import { supabase } from "@/integrations/supabase/client";

/**
 * Bot icons and banners picked in the order form arrive as inline `data:`
 * images. Storing those straight on `bot_orders` made a single row several
 * megabytes, so the dashboard's bot list took seconds to answer and on a
 * phone had to download every image before anything drew. This puts the
 * image in the public `bot-assets` bucket (under the user's own folder, which
 * is what the bucket's policies allow) and hands back its URL instead.
 *
 * Anything that is not an inline image is returned untouched. If the upload
 * fails the inline image is returned so an order is never lost over storage.
 */
export const storeBotImage = async (
  value: string | null | undefined,
  userId: string,
  kind: "icon" | "banner",
): Promise<string | null> => {
  if (!value) return null;
  if (!value.startsWith("data:")) return value;
  const m = value.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (!m) return value;
  const [, mime, b64] = m;
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const ext =
      mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : mime === "image/gif" ? "gif" : "png";
    const path = `${userId}/orders/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${kind}.${ext}`;
    const { error } = await supabase.storage
      .from("bot-assets")
      .upload(path, new Blob([bytes], { type: mime }), { contentType: mime, upsert: false });
    if (error) throw error;
    return supabase.storage.from("bot-assets").getPublicUrl(path).data.publicUrl;
  } catch (e) {
    console.warn("[botImageUpload] keeping inline image, upload failed", e);
    return value;
  }
};
