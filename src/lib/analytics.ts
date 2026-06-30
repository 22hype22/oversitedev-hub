// Lightweight visitor/funnel analytics. Fires events through the track_event
// RPC (anon-allowed, validated server-side). An anonymous session id is stored
// in localStorage so we can count distinct visitors and follow them through the
// funnel without any PII. Events are best-effort — failures are swallowed so
// tracking never affects the user experience.
import { supabase } from "@/integrations/supabase/client";

const SID_KEY = "os_sid";

export type TrackEvent =
  | "page_view"
  | "ping"
  | "build_started"
  | "checkout_reached"
  | "purchased"
  | "checkout_abandoned";

function sessionId(): string {
  try {
    let s = localStorage.getItem(SID_KEY);
    if (!s) {
      s =
        (typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2) + Date.now().toString(36));
      localStorage.setItem(SID_KEY, s);
    }
    return s;
  } catch {
    // private mode / storage blocked — fall back to a per-load id
    return "nostore-" + Math.random().toString(36).slice(2);
  }
}

export function track(
  type: TrackEvent,
  meta?: Record<string, unknown>,
  path?: string,
): void {
  try {
    const p =
      path ?? (typeof location !== "undefined" ? location.pathname : null);
    (supabase as any)
      .rpc("track_event", {
        _session: sessionId(),
        _type: type,
        _path: p,
        _meta: meta ?? null,
      })
      .then(
        () => {},
        () => {},
      );
  } catch {
    /* ignore */
  }
}

// Presence: a "ping" now and every 45s while the tab is visible. Live-visitor
// count = distinct sessions pinged in the last 90s.
export function startPresence(): () => void {
  const ping = () => {
    if (typeof document === "undefined" || document.visibilityState === "visible") {
      track("ping");
    }
  };
  ping();
  const iv = window.setInterval(ping, 45000);
  const onVis = () => {
    if (document.visibilityState === "visible") ping();
  };
  document.addEventListener("visibilitychange", onVis);
  return () => {
    window.clearInterval(iv);
    document.removeEventListener("visibilitychange", onVis);
  };
}
