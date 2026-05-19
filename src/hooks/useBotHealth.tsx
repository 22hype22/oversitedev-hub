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

export const useBotHealth = (botId: string | null) => {
  const [health, setHealth] = useState<BotHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const lastKnownGoodRef = useRef<BotHealth | null>(null);

  const load = useCallback(async () => {
    if (!botId) {
      lastKnownGoodRef.current = null;
      setHealth(null);
      setLoading(false);
      return;
    }
    const { data, error } = await (supabase as any).rpc("get_bot_health", {
      _bot_id: botId,
    });
    if (!error && isValidBotHealth(data)) {
      lastKnownGoodRef.current = data;
      setHealth(data);
    } else if (lastKnownGoodRef.current) {
      setHealth(lastKnownGoodRef.current);
    }
    setLoading(false);
  }, [botId]);

  useEffect(() => {
    load();
    // Refresh every 30s so "last seen" stays fresh and stale flips quickly
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

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
