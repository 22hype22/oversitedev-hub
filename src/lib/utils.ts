import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Compare two version strings (e.g. "1.2.3" vs "1.10").
 * Returns -1 if a < b, 0 if equal, 1 if a > b. Non-numeric segments fall
 * back to a case-insensitive string comparison for that segment.
 */
export function compareVersions(a: string, b: string): number {
  const pa = String(a).replace(/^v/i, "").split(/[.\-]/);
  const pb = String(b).replace(/^v/i, "").split(/[.\-]/);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const sa = pa[i] ?? "0";
    const sb = pb[i] ?? "0";
    const na = Number(sa);
    const nb = Number(sb);
    if (Number.isFinite(na) && Number.isFinite(nb)) {
      if (na !== nb) return na < nb ? -1 : 1;
    } else {
      const cmp = sa.toLowerCase().localeCompare(sb.toLowerCase());
      if (cmp !== 0) return cmp < 0 ? -1 : 1;
    }
  }
  return 0;
}
