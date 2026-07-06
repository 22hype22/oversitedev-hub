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
  | "checkout_abandoned"
  | "leave";

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

// Fire a "leave" the instant the tab is hidden/closed, using a keepalive fetch
// so it still sends during unload. This drops the session out of "live now"
// immediately instead of waiting out the 90s presence window.
function sendLeave(): void {
  try {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return;
    fetch(`${url}/rest/v1/rpc/track_event`, {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        _session: sessionId(),
        _type: "leave",
        _path: typeof location !== "undefined" ? location.pathname : null,
        _meta: null,
      }),
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

// Presence: a "ping" now and every 30s for as long as the tab is OPEN — even
// when it's in the background — so any open tab counts as "live". A "leave" is
// sent only when the tab is actually closed or navigated away (pagehide), so a
// closed tab drops off immediately while a merely-backgrounded one keeps
// counting. (Browsers throttle background timers to ~once/min, which still lands
// inside the 90s live window.) Live-visitor count = distinct sessions whose most
// recent signal in the last 90s wasn't a leave.
export function startPresence(): () => void {
  const ping = () => track("ping");
  ping();
  const iv = window.setInterval(ping, 30000);
  // Ping immediately when the tab returns to the foreground so a background tab
  // that got its timer throttled re-enters "live" right away.
  const onVis = () => {
    if (typeof document === "undefined" || document.visibilityState === "visible") ping();
  };
  document.addEventListener("visibilitychange", onVis);
  // Fire "leave" only on real close / navigation away.
  window.addEventListener("pagehide", sendLeave);
  return () => {
    window.clearInterval(iv);
    document.removeEventListener("visibilitychange", onVis);
    window.removeEventListener("pagehide", sendLeave);
  };
}
