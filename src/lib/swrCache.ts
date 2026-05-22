// Tiny in-memory stale-while-revalidate cache for hooks that fetch from
// Supabase directly (not via react-query). Lets pages instantly render
// the last-known data on navigation while a fresh fetch runs in the
// background.
//
// Default TTL: 30s. Entries are kept in module scope so they survive
// route changes (but not full page reloads).

type Entry<T> = { value: T; ts: number };

const store = new Map<string, Entry<unknown>>();

export function getCached<T>(key: string, maxAgeMs = 30_000): T | undefined {
  const e = store.get(key) as Entry<T> | undefined;
  if (!e) return undefined;
  if (Date.now() - e.ts > maxAgeMs) return undefined;
  return e.value;
}

/** Returns the cached value regardless of age (for instant-paint seeding). */
export function peekCached<T>(key: string): T | undefined {
  return (store.get(key) as Entry<T> | undefined)?.value;
}

export function setCached<T>(key: string, value: T): void {
  store.set(key, { value, ts: Date.now() });
}

export function invalidateCached(key: string): void {
  store.delete(key);
}

export function invalidatePrefix(prefix: string): void {
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}
