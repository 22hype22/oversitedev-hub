// Shared upload guards. Client-side checks here give the uploader instant
// feedback; the real enforcement is the matching per-bucket `file_size_limit` /
// `allowed_mime_types` set on Supabase storage (see the storage-limits
// migration), which rejects anything oversized or off-type even if a request
// skips the UI. Keep the two in sync.

export interface UploadLimit {
  /** Hard size cap in bytes. */
  maxBytes: number;
  /** Allowed MIME types (empty = don't check MIME). */
  mimes: string[];
  /** Allowed lowercase extensions, no dot (empty = don't check extension). */
  exts: string[];
  /** Human-readable description of what's allowed, for error text. */
  label: string;
}

const IMAGE_MIMES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp"];
const VIDEO_MIMES = ["video/mp4", "video/webm", "video/quicktime"];
const VIDEO_EXTS = ["mp4", "webm", "mov"];
const DOC_MIMES = [
  "application/pdf",
  "text/plain",
  "application/json",
  "text/csv",
  "application/zip",
  "application/x-zip-compressed",
];
const DOC_EXTS = ["pdf", "txt", "log", "json", "csv", "zip"];

const MB = 1024 * 1024;

/** Named presets, one per upload surface. Sizes mirror the bucket limits. */
export const UPLOAD_LIMITS = {
  /** Profile/bot avatars and banners. */
  avatar: {
    maxBytes: 8 * MB,
    mimes: IMAGE_MIMES,
    exts: IMAGE_EXTS,
    label: "PNG, JPG, GIF or WebP up to 8 MB",
  },
  /** Captcha pool images (admin). */
  captcha: {
    maxBytes: 5 * MB,
    mimes: IMAGE_MIMES,
    exts: IMAGE_EXTS,
    label: "PNG, JPG, GIF or WebP up to 5 MB",
  },
  /** Portfolio media: images and short clips. */
  portfolio: {
    maxBytes: 50 * MB,
    mimes: [...IMAGE_MIMES, ...VIDEO_MIMES],
    exts: [...IMAGE_EXTS, ...VIDEO_EXTS],
    label: "images or video up to 50 MB",
  },
  /** bot-assets bucket: /say attachments plus bug/feature proof files. */
  botAsset: {
    maxBytes: 25 * MB,
    mimes: [...IMAGE_MIMES, ...DOC_MIMES],
    exts: [...IMAGE_EXTS, ...DOC_EXTS],
    label: "images or docs (PDF, TXT, LOG, JSON, CSV, ZIP) up to 25 MB",
  },
} satisfies Record<string, UploadLimit>;

/** Anything larger than this many megapixels is treated as a decompression
 *  bomb (a tiny file that expands to gigabytes of pixels when decoded). */
export const MAX_MEGAPIXELS = 40;

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / MB;
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

/** Synchronous size + type gate. Run this first, on every file. */
export function validateUpload(file: File, limit: UploadLimit): ValidationResult {
  if (file.size === 0) {
    return { ok: false, error: `"${file.name}" is empty.` };
  }
  if (file.size > limit.maxBytes) {
    return {
      ok: false,
      error: `"${file.name}" is ${formatBytes(file.size)}. The limit is ${formatBytes(limit.maxBytes)}.`,
    };
  }
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const mimeOk = limit.mimes.length === 0 || limit.mimes.includes(file.type);
  const extOk = limit.exts.length === 0 || limit.exts.includes(ext);
  // Accept when either signal matches (some browsers report an empty or odd
  // MIME for valid files), but reject when both disagree with the allowlist.
  if (!mimeOk && !extOk) {
    return { ok: false, error: `"${file.name}" isn't an allowed type. Allowed: ${limit.label}.` };
  }
  return { ok: true };
}

/** Async guard for image files: confirms the bytes actually decode to an image
 *  and that it isn't an oversized pixel bomb. Skip for non-image files. */
export function validateImageDecodes(file: File): Promise<ValidationResult> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const megapixels = (img.naturalWidth * img.naturalHeight) / 1_000_000;
      URL.revokeObjectURL(url);
      if (megapixels > MAX_MEGAPIXELS) {
        resolve({
          ok: false,
          error: `"${file.name}" is ${Math.round(megapixels)} megapixels, over the ${MAX_MEGAPIXELS} MP limit.`,
        });
      } else {
        resolve({ ok: true });
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ ok: false, error: `"${file.name}" isn't a valid image.` });
    };
    img.src = url;
  });
}

/** Convenience: size/type gate, then the image-decode gate when it's an image. */
export async function validateImageUpload(file: File, limit: UploadLimit): Promise<ValidationResult> {
  const basic = validateUpload(file, limit);
  if (!basic.ok) return basic;
  if (file.type.startsWith("image/")) return validateImageDecodes(file);
  return { ok: true };
}
