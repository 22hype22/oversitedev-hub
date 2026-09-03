import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

// A single stale "offline" reading (a heartbeat landing a moment late, a Railway
// blip, a poll in a gap) shouldn't flip the whole UI offline and back. Suppress
// an offline reading for this long if the bot was just up; only believe it once
// it persists. Genuine offline still shows after the grace window.
const OFFLINE_GRACE_MS = 25_000;

// A heartbeat older than this means the cached "online" is no longer
// trustworthy on its own — show it but keep the loading refresh going.
const HB_FRESH_MS = 60_000;

// Status order of truth: a fresh heartbeat means online. A heartbeat that has
// merely gone quiet (the row still says online, some bots heartbeat slower than
// the server's cutoff) does NOT mean offline yet — it means "checking": Railway
// is asked whether the container is running (bot-status-sync), and only its
// answer, or a heartbeat this old, turns the page offline. This is what stops
// the offline flash on open and the lockout that came with it.
const VERIFY_COOLDOWN_MS = 20_000;
const STALE_HARD_OFFLINE_MS = 10 * 60_000;

// Last-known health per bot, cached in localStorage so a return visit paints the
// status instantly (an always-on bot shows Online immediately) instead of
// sitting on "checking…" until the get_bot_health round-trip lands. The live
// read still runs and corrects anything within a beat.
const healthKey = (botId: string) => `oversite:bothealth:${botId}`;
function readCachedHealth(botId: string): BotHealth | null {
  try {
    const raw = localStorage.getItem(healthKey(botId));
    return raw ? (JSON.parse(raw) as BotHealth) : null;
  } catch { return null; }
}
function writeCachedHealth(botId: string, h: BotHealth) {
  try { localStorage.setItem(healthKey(botId), JSON.stringify(h)); } catch { /* ignore */ }
}
// True when the cached reading's heartbeat is recent enough to trust on sight.
function cacheFresh(h: BotHealth | null): boolean {
  if (!h || h.effective_status === "offline") return false;
  const hb = h.last_heartbeat_at ? new Date(h.last_heartbeat_at).getTime() : 0;
  return hb > 0 && Date.now() - hb < HB_FRESH_MS;
}

export type BotHealth = {
  bot_id: string;
  status: string;
  effective_status: string;
  stale?: boolean;
  never_started?: boolean;
  last_heartbeat_at?: string | null;
  started_at?: string | null;
  uptime_seconds?: number;
  last_error?: string | null;
  last_error_at?: string | null;
  version?: string | null;
  updated_at?: string | null;
};

export const useBotHealth = (botId: string | null) => {
  // Seed from the last-known cache so the status is on screen from the first
  // paint. If the cached heartbeat is fresh we're not even "loading" — the
  // background read just confirms it.
  const seeded = botId ? readCachedHealth(botId) : null;
  const [health, setHealth] = useState<BotHealth | null>(seeded);
  const [loading, setLoading] = useState(Boolean(botId) && !cacheFresh(seeded));
  // Last non-offline reading, and when the current offline streak began — used
  // to debounce transient offline flickers.
  const lastGoodRef = useRef<BotHealth | null>(null);
  const offlineSinceRef = useRef<number | null>(null);
  const verifyRef = useRef<{ at: number; inFlight: boolean }>({ at: 0, inFlight: false });

  // Ask Railway whether the container is actually running. Returns the mapped
  // status ("online", "offline", "starting", ...) or null if it couldn't tell.
  const verifyWithRailway = useCallback(async (id: string): Promise<string | null> => {
    if (verifyRef.current.inFlight) return null;
    verifyRef.current = { at: Date.now(), inFlight: true };
    try {
      const { data } = await supabase.functions.invoke("bot-status-sync", { body: { botIds: [id] } });
      const v = (data?.statuses as Record<string, { status: string }> | undefined)?.[id];
      return v?.status ?? null;
    } catch {
      return null;
    } finally {
      verifyRef.current.inFlight = false;
    }
  }, []);

  const load = useCallback(async () => {
    if (!botId) {
      setHealth(null);
      lastGoodRef.current = null;
      offlineSinceRef.current = null;
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.rpc("get_bot_health", {
      _bot_id: botId,
    });
    if (!error && data) {
      let h = data as BotHealth;
      // Quiet heartbeat, row still says live: check with Railway before calling
      // it offline. Show "checking" meanwhile so nothing locks.
      if (h.effective_status === "offline" && h.stale) {
        const hbAge = h.last_heartbeat_at ? Date.now() - new Date(h.last_heartbeat_at).getTime() : Infinity;
        if (hbAge < STALE_HARD_OFFLINE_MS) {
          const dueForVerify = Date.now() - verifyRef.current.at > VERIFY_COOLDOWN_MS;
          setHealth(lastGoodRef.current ?? { ...h, effective_status: "checking" });
          setLoading(false);
          if (dueForVerify) {
            const verdict = await verifyWithRailway(botId);
            if (verdict === "online") {
              h = { ...h, effective_status: "online", stale: false, last_heartbeat_at: new Date().toISOString() };
            } else if (verdict && verdict !== "offline") {
              h = { ...h, effective_status: verdict, stale: false };
            } else if (verdict === null) {
              return; // couldn't tell; keep "checking" until the next poll
            }
          } else {
            return; // a verification ran moments ago; wait for its row update
          }
        }
      }
      if (h.effective_status !== "offline") {
        // Any live/starting state — trust it and remember it as the last good.
        lastGoodRef.current = h;
        offlineSinceRef.current = null;
        setHealth(h);
        writeCachedHealth(botId, h);
      } else if (lastGoodRef.current) {
        // Offline, but we were up a moment ago. Hold the last good status until
        // it's been offline continuously past the grace window; the 10s poll
        // re-evaluates, so a real outage still flips after ~25s.
        if (offlineSinceRef.current == null) offlineSinceRef.current = Date.now();
        if (Date.now() - offlineSinceRef.current >= OFFLINE_GRACE_MS) {
          setHealth(h);
          try { localStorage.removeItem(healthKey(botId)); } catch { /* ignore */ }
        } else {
          setHealth(lastGoodRef.current);
        }
      } else {
        // No prior good reading (e.g. it really is offline on first load).
        setHealth(h);
        try { localStorage.removeItem(healthKey(botId)); } catch { /* ignore */ }
      }
    }
    setLoading(false);
  }, [botId, verifyWithRailway]);

  useEffect(() => {
    if (!botId) {
      setHealth(null);
      setLoading(false);
      return;
    }
    // New bot selected — reseed smoothing + display from that bot's cache so
    // the status shows immediately; only truly gate on "loading" when the
    // cache is missing or its heartbeat is stale.
    const cached = readCachedHealth(botId);
    lastGoodRef.current = cached && cached.effective_status !== "offline" ? cached : null;
    offlineSinceRef.current = null;
    setHealth(cached);
    setLoading(!cacheFresh(cached));
    load();
    // Poll every 10s as a staleness fallback (a hard-killed worker can't
    // report anything, so only the heartbeat age reveals it's gone).
    const t = setInterval(load, 10_000);
    // Realtime: any worker/status write (online, starting, restarting,
    // crashed, …) re-fetches immediately so transitions show up instantly
    // instead of waiting out the poll interval.
    const channel = supabase
      .channel(`bot-health-${botId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bot_runtime_status", filter: `bot_id=eq.${botId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      clearInterval(t);
      supabase.removeChannel(channel);
    };
  }, [botId, load]);

  return { health, loading, reload: load };
};

export const formatUptime = (sec?: number | null) => {
  if (!sec || sec < 1) return "—";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${sec}s`;
};

export const formatRelative = (iso?: string | null) => {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
};
