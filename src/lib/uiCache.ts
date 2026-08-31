// Tiny localStorage-backed cache for "last-known" UI data, so panels paint from
// the previous visit's values on the very first frame instead of sitting on a
// spinner until a fresh round-trip lands. The live fetch still runs and
// overwrites within a beat — this only removes the blank/loading gap.
//
// Every accessor is wrapped so a private window, cleared storage, or a quota
// error can never throw into render. Keys are namespaced per feature + id.

const PREFIX = "oversite:ui:";

export function cacheGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function cacheSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* private mode / quota — the live fetch still populates the UI */
  }
}

export function cacheRemove(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}
