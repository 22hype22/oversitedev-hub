import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * The public site settings row (`app_settings`, id = 1), loaded once for the
 * whole page and shared by every hook that needs a column from it.
 *
 * The row is readable by anyone, so it is fetched with a plain request the
 * moment this module loads, before React mounts and without going through
 * the auth client. Requests made through the Supabase client wait for the
 * session to be restored first, and a slow token refresh (or another tab
 * holding the auth lock) used to hold the Robux option and the sales-mode
 * pills back for half a minute or more after the page had drawn. One
 * realtime channel keeps the row current for every subscriber.
 */

export type AppSettingsRow = Record<string, unknown>;

type Listener = (row: AppSettingsRow | null) => void;

const URL = import.meta.env.VITE_SUPABASE_URL as string;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

let row: AppSettingsRow | null = null;
let loaded = false;
let inflight: Promise<void> | null = null;
const listeners = new Set<Listener>();
let channelStarted = false;

const notify = () => listeners.forEach((l) => l(row));

const fetchRow = async (): Promise<void> => {
  if (!URL || !KEY) return;
  try {
    const res = await fetch(`${URL}/rest/v1/app_settings?select=*&id=eq.1`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Accept: "application/json" },
    });
    if (!res.ok) return;
    const data = (await res.json()) as AppSettingsRow[];
    row = data?.[0] ?? null;
  } catch {
    // Keep whatever we have; a later realtime event or reload will fill it.
  } finally {
    loaded = true;
    inflight = null;
    notify();
  }
};

/** Start (or reuse) the first load. Safe to call any number of times. */
export const loadAppSettings = (): Promise<void> => {
  if (loaded) return Promise.resolve();
  if (!inflight) inflight = fetchRow();
  return inflight;
};

const startChannel = () => {
  if (channelStarted || typeof window === "undefined") return;
  channelStarted = true;
  supabase
    .channel("app-settings-shared")
    .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, (payload: any) => {
      const next = payload?.new;
      if (next && typeof next === "object" && Number(next.id) === 1) {
        row = { ...(row ?? {}), ...next };
        notify();
      }
    })
    .subscribe();
};

/** Force a fresh read, for callers that just wrote to the row. */
export const refreshAppSettings = (): Promise<void> => {
  loaded = false;
  return loadAppSettings();
};

// Kick the first load off as soon as the module is imported.
if (typeof window !== "undefined") void loadAppSettings();

/**
 * The shared settings row, or null until it has loaded. `loading` is true
 * only before the first answer.
 */
export const useAppSettings = (): { row: AppSettingsRow | null; loading: boolean } => {
  const [state, setState] = useState<{ row: AppSettingsRow | null; loading: boolean }>({ row, loading: !loaded });
  useEffect(() => {
    const l: Listener = (r) => setState({ row: r, loading: false });
    listeners.add(l);
    startChannel();
    void loadAppSettings().then(() => setState({ row, loading: !loaded }));
    return () => {
      listeners.delete(l);
    };
  }, []);
  return state;
};
