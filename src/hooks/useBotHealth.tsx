import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

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

const VALID_EFFECTIVE_STATUSES = new Set([
  "online",
  "offline",
  "starting",
  "stopping",
  "crashed",
  "updating",
  "suspended",
]);

const isValidBotHealth = (value: unknown): value is BotHealth => {
  if (!value || typeof value !== "object") return false;
  const health = value as Partial<BotHealth>;
  return (
    typeof health.bot_id === "string" &&
    typeof health.status === "string" &&
    typeof health.effective_status === "string" &&
    VALID_EFFECTIVE_STATUSES.has(health.effective_status)
  );
};

const CACHE_PREFIX = "bot-health-cache:";
const CACHE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

const readCache = (botId: string): BotHealth | null => {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + botId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt: number; value: BotHealth };
    if (!parsed || typeof parsed.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > CACHE_MAX_AGE_MS) return null;
    if (!isValidBotHealth(parsed.value)) return null;
    return parsed.value;
  } catch {
    return null;
  }
};

const writeCache = (botId: string, value: BotHealth) => {
  try {
    localStorage.setItem(
      CACHE_PREFIX + botId,
      JSON.stringify({ savedAt: Date.now(), value }),
    );
  } catch {
    /* ignore quota errors */
  }
};

export const useBotHealth = (botId: string | null) => {
  // Seed health from a recent cached value so that a refresh doesn't briefly
  // flash a "locked / offline" state for team members before the first poll
  // resolves. We only treat the bot as truly offline once we have a fresh,
  // confirmed offline status from the server.
  const [health, setHealth] = useState<BotHealth | null>(() =>
    botId ? readCache(botId) : null,
  );
  const [loading, setLoading] = useState(Boolean(botId));
  const lastKnownGoodRef = useRef<BotHealth | null>(
    botId ? readCache(botId) : null,
  );

  const load = useCallback(async () => {
    if (!botId) {
      lastKnownGoodRef.current = null;
      setHealth(null);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.rpc("get_bot_health", {
      _bot_id: botId,
    });
    if (!error && isValidBotHealth(data)) {
      lastKnownGoodRef.current = data;
      writeCache(botId, data);
      setHealth(data);
    } else if (lastKnownGoodRef.current) {
      // Transient RPC error — keep the last known good status rather than
      // downgrading to null (which the dashboard treats as "loading").
      setHealth(lastKnownGoodRef.current);
    }
    setLoading(false);
  }, [botId]);

  useEffect(() => {
    if (!botId) {
      lastKnownGoodRef.current = null;
      setHealth(null);
      setLoading(false);
      return;
    }
    const cached = readCache(botId);
    lastKnownGoodRef.current = cached;
    setHealth(cached);
    setLoading(true);
    load();
    // Refresh every 30s so "last seen" stays fresh and stale flips quickly
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
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
