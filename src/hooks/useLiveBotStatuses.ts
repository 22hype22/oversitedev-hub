import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Live runtime status for a set of bots, for the bot list/table.
 *
 * - Initial fetch + 30s fallback poll of bot_runtime_status.
 * - Realtime postgres_changes subscription so worker-reported transitions
 *   (online / starting / stopping / restarting / crashed / updating) and the
 *   optimistic 'restarting' written by bot-railway-action show up instantly.
 * - A 15s ticker re-evaluates heartbeat staleness so a hard-killed bot
 *   (which can't report anything) flips to offline within ~60–75s.
 * - Railway fallback: a bot whose heartbeat loop died still looks offline
 *   here even though the container (and the bot in Discord) is fine. When any
 *   bot reads as offline/stale, bot-status-sync asks Railway for the
 *   service's real deployment state and corrects bot_runtime_status.
 */

export type LiveBotStatus = {
  /** Raw worker-reported status. */
  status: string;
  /** Stale-aware status: 'online' with a dead heartbeat becomes 'offline'. */
  effective: string;
  last_heartbeat_at: string | null;
};

const STALE_MS = 60_000;
// Grace window after the hook mounts. On open, a bot's cached/last DB heartbeat
// can already be >STALE_MS old even though the bot is fine — it would flash
// "offline" until the Railway verification (bot-status-sync) confirms it online
// a couple seconds later. During this window we keep showing a known-online bot
// as online; a genuinely-down bot is corrected by that verification (which
// writes a non-online status, bypassing this grace) within ~2s.
const MOUNT_GRACE_MS = 7_000;
// Minimum gap between Railway verification calls (bot-status-sync). Short
// enough that every 30s poll can re-verify — a bot kept online by Railway
// checks (dead heartbeat loop) must be refreshed before the 60s staleness
// cutoff or it dips offline between checks.
const SYNC_COOLDOWN_MS = 25_000;
// While an action is in flight (Restarting… / Redeploying… / Stopping… /
// Starting…) poll and re-verify much faster so the transition plays out live.
const TRANSITIONAL = new Set(["starting", "stopping", "restarting", "updating"]);
const FAST_POLL_MS = 5_000;
const FAST_SYNC_COOLDOWN_MS = 10_000;

/**
 * Optimistic transitions ("pins"). The control panels call
 * announceBotTransition the instant an action button is clicked, so the badge
 * flips immediately — no round-trip, no realtime dependency. The pin shields
 * the label from polls that still see the pre-action DB state, and releases
 * as soon as the database reports either a transition of its own or the
 * expected end state (or after PIN_MS as a failsafe).
 */
const OPTIMISTIC_EVENT = "oversite:bot-transition";
const PIN_MS = 90_000;
const EXPECTED_TERMINAL: Record<string, string> = {
  stopping: "offline",
  starting: "online",
  restarting: "online",
  updating: "online",
};

export type BotTransition = "starting" | "stopping" | "restarting" | "updating";

export function announceBotTransition(botId: string, status: BotTransition) {
  window.dispatchEvent(new CustomEvent(OPTIMISTIC_EVENT, { detail: { botId, status } }));
}

/** Cancel an announced transition (e.g. the action request failed). */
export function clearBotTransition(botId: string) {
  window.dispatchEvent(new CustomEvent(OPTIMISTIC_EVENT, { detail: { botId, status: null } }));
}

function effectiveOf(status: string | null, hb: string | null): string {
  const s = status ?? "offline";
  if (s === "online" && (!hb || Date.now() - new Date(hb).getTime() > STALE_MS)) {
    return "offline";
  }
  return s;
}

// Per-bot last-known status, cached in localStorage so the list badges paint
// from the first frame instead of blanking until the DB read (and any Railway
// verification) lands. The live poll corrects anything within a beat.
const statusKey = (botId: string) => `oversite:botstatus:${botId}`;
function readCachedStatus(botId: string): { status: string; hb: string | null } | null {
  try {
    const raw = localStorage.getItem(statusKey(botId));
    return raw ? (JSON.parse(raw) as { status: string; hb: string | null }) : null;
  } catch { return null; }
}
function writeCachedStatus(botId: string, row: { status: string; hb: string | null }) {
  try { localStorage.setItem(statusKey(botId), JSON.stringify(row)); } catch { /* ignore */ }
}

export function useLiveBotStatuses(botIds: string[]) {
  const [rows, setRows] = useState<Record<string, { status: string; hb: string | null }>>({});
  const [tick, setTick] = useState(0);
  const lastSyncRef = useRef(0);
  const mountedAtRef = useRef(Date.now());
  const pinsRef = useRef<Record<string, { status: string; until: number }>>({});
  // Stable key so the effect doesn't resubscribe on every render.
  const key = useMemo(() => botIds.slice().sort().join(","), [botIds]);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const ids = key.split(",");
    // Restart the grace window for this bot set, and force one re-render right
    // after it ends so a bot still not confirmed online settles to its truth.
    mountedAtRef.current = Date.now();
    const graceTimer = setTimeout(() => { if (!cancelled) setTick((n) => n + 1); }, MOUNT_GRACE_MS + 100);

    // Paint last-known badges instantly from cache, then let the poll refresh.
    const seed: Record<string, { status: string; hb: string | null }> = {};
    for (const id of ids) {
      const c = readCachedStatus(id);
      if (c) seed[id] = c;
    }
    if (Object.keys(seed).length) setRows((prev) => ({ ...seed, ...prev }));

    // Overlay an active pin on top of what the database reports. Returns the
    // row to display; drops the pin once the DB has caught up (shows its own
    // transition, or reached the pinned action's expected end state).
    const withPin = (
      id: string,
      db: { status: string; hb: string | null } | undefined,
    ): { status: string; hb: string | null } | undefined => {
      const pin = pinsRef.current[id];
      if (!pin) return db;
      const expected = EXPECTED_TERMINAL[pin.status];
      if (
        Date.now() > pin.until ||
        (db && TRANSITIONAL.has(db.status)) ||
        (db && effectiveOf(db.status, db.hb) === expected)
      ) {
        delete pinsRef.current[id];
        return db;
      }
      return { status: pin.status, hb: db?.hb ?? null };
    };

    const load = async (): Promise<boolean> => {
      const { data } = await (supabase.from("bot_runtime_status") as any)
        .select("bot_id, status, last_heartbeat_at")
        .in("bot_id", ids);
      if (cancelled || !data) return false;
      const next: Record<string, { status: string; hb: string | null }> = {};
      for (const r of data as { bot_id: string; status: string; last_heartbeat_at: string | null }[]) {
        next[r.bot_id] = withPin(r.bot_id, { status: r.status, hb: r.last_heartbeat_at })!;
        // Cache the raw DB reading (not the pin) so next visit seeds truth.
        writeCachedStatus(r.bot_id, { status: r.status, hb: r.last_heartbeat_at });
      }
      // Pinned bots with no runtime row yet still need their label shown.
      for (const id of Object.keys(pinsRef.current)) {
        if (!next[id]) {
          const pinned = withPin(id, undefined);
          if (pinned) next[id] = pinned;
        }
      }
      setRows(next);

      // Anything not confidently online gets double-checked against Railway.
      // bot-status-sync only touches deployed bots the caller owns, so it's
      // safe to pass every suspect id; queued/cancelled orders are ignored.
      const suspect = ids.filter((id) => {
        const r = next[id];
        return !r || effectiveOf(r.status, r.hb) !== "online";
      });
      const inTransition = ids.some((id) => TRANSITIONAL.has(next[id]?.status ?? ""));
      const cooldown = inTransition ? FAST_SYNC_COOLDOWN_MS : SYNC_COOLDOWN_MS;
      if (suspect.length > 0 && Date.now() - lastSyncRef.current > cooldown) {
        lastSyncRef.current = Date.now();
        try {
          const { data: sync } = await supabase.functions.invoke("bot-status-sync", {
            body: { botIds: suspect },
          });
          const verified = sync?.statuses as
            | Record<string, { status: string }>
            | undefined;
          if (!cancelled && verified && Object.keys(verified).length > 0) {
            const now = new Date().toISOString();
            setRows((prev) => {
              const merged = { ...prev };
              for (const [id, v] of Object.entries(verified)) {
                const raw = { status: v.status, hb: v.status === "online" ? now : prev[id]?.hb ?? null };
                const row = withPin(id, raw);
                if (row) merged[id] = row;
                writeCachedStatus(id, raw);
              }
              return merged;
            });
            return Object.values(verified).some((v) => TRANSITIONAL.has(v.status)) || inTransition;
          }
        } catch {
          // Verification is best-effort; the heartbeat view stays authoritative.
        }
      }
      return inTransition;
    };

    // Self-scheduling poll: 30s normally, 5s while an action is in flight so
    // Restarting…/Redeploying…/Stopping… resolve on screen without a refresh.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const loop = async () => {
      const fast = await load();
      if (cancelled) return;
      timer = setTimeout(loop, fast ? FAST_POLL_MS : 30_000);
    };
    loop();

    const channel = supabase
      .channel(`live-bot-statuses-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bot_runtime_status",
          filter: `bot_id=in.(${ids.join(",")})`,
        },
        (payload) => {
          const row = payload.new as { bot_id?: string; status?: string; last_heartbeat_at?: string | null } | null;
          if (!row?.bot_id) return;
          const id = row.bot_id as string;
          const merged = withPin(id, { status: row.status ?? "offline", hb: row.last_heartbeat_at ?? null });
          if (merged) setRows((prev) => ({ ...prev, [id]: merged }));
          // A transition just started (e.g. the user hit Restart) — switch to
          // the fast poll right away instead of waiting out the 30s timer.
          if (TRANSITIONAL.has(row.status ?? "")) {
            clearTimeout(timer);
            timer = setTimeout(loop, FAST_POLL_MS);
          }
        },
      )
      .subscribe();

    // Optimistic transitions from the control panels: flip the badge the
    // moment the button is clicked and start the fast poll/verify cycle.
    const onAnnounce = (e: Event) => {
      const { botId, status } = ((e as CustomEvent).detail ?? {}) as {
        botId?: string;
        status?: string | null;
      };
      if (!botId || !ids.includes(botId)) return;
      if (status && TRANSITIONAL.has(status)) {
        pinsRef.current[botId] = { status, until: Date.now() + PIN_MS };
        setRows((prev) => ({
          ...prev,
          [botId]: { status, hb: prev[botId]?.hb ?? null },
        }));
        lastSyncRef.current = 0; // let the next poll re-verify immediately
      } else {
        delete pinsRef.current[botId];
      }
      clearTimeout(timer);
      timer = setTimeout(loop, status ? FAST_POLL_MS : 0);
    };
    window.addEventListener(OPTIMISTIC_EVENT, onAnnounce);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(graceTimer);
      window.removeEventListener(OPTIMISTIC_EVENT, onAnnounce);
      supabase.removeChannel(channel);
    };
  }, [key]);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  return useMemo(() => {
    void tick;
    const graceActive = Date.now() - mountedAtRef.current < MOUNT_GRACE_MS;
    const out: Record<string, LiveBotStatus> = {};
    for (const [id, r] of Object.entries(rows)) {
      let eff = effectiveOf(r.status, r.hb);
      // On open, don't flash a known-online bot to offline just because its
      // last heartbeat is briefly stale — the Railway verify corrects a truly
      // down bot within ~2s (it writes a non-online status, which skips this).
      if (graceActive && eff === "offline" && r.status === "online") {
        eff = "online";
      }
      out[id] = { status: r.status, effective: eff, last_heartbeat_at: r.hb };
    }
    return out;
  }, [rows, tick]);
}
