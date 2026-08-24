// XSS guards for anything derived from user input. React already escapes text
// rendered as JSX children, so these cover the gaps JSX does NOT: URLs placed in
// href/src (a `javascript:` link runs on click) and strings pushed through
// dangerouslySetInnerHTML.

/** Schemes that can execute script or smuggle markup when used in a link. */
const UNSAFE_URL_SCHEME = /^\s*(javascript|vbscript|data|blob|file):/i;

/**
 * Sanitize a URL destined for an <a href> (or anywhere a click navigates).
 * Allows http(s), mailto, tel, and site-relative/anchor URLs; anything with a
 * dangerous or unknown scheme collapses to `fallback` (default "#").
 */
export function safeUrl(url: string | null | undefined, fallback = "#"): string {
  if (!url) return fallback;
  const trimmed = String(url).trim();
  if (!trimmed) return fallback;
  if (UNSAFE_URL_SCHEME.test(trimmed)) return fallback;
  // Relative, anchor, protocol-relative, or an explicit allowed scheme.
  if (/^(https?:\/\/|mailto:|tel:|\/|#|\.\/|\.\.\/)/i.test(trimmed)) return trimmed;
  // A bare "example.com/x" with no scheme: treat as http to avoid it being read
  // as a scheme-relative path, but never as javascript:.
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(trimmed)) return `https://${trimmed}`;
  return fallback;
}

/**
 * Sanitize a URL destined for an <img>/<video> src. Allows http(s),
 * site-relative, and inline image data: URIs (used for local previews); blocks
 * javascript:/vbscript: and non-image data. Returns "" when unsafe so the
 * element simply renders nothing.
 */
export function safeImageSrc(url: string | null | undefined, fallback = ""): string {
  if (!url) return fallback;
  const trimmed = String(url).trim();
  if (!trimmed) return fallback;
  if (/^(https?:\/\/|\/)/i.test(trimmed)) return trimmed;
  if (/^data:image\/(png|jpe?g|gif|webp|avif|svg\+xml);/i.test(trimmed)) return trimmed;
  return fallback;
}

/** Escape the five HTML-significant characters for safe interpolation into an
 *  HTML string (dangerouslySetInnerHTML, template strings, etc.). */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
