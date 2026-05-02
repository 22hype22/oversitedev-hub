import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { BotGuild } from "@/hooks/useGuildChannels";

/**
 * Dashboard-wide "which server am I editing?" selection.
 *
 * Lives at the bot section level so all addon configuration boxes
 * (verification, ticket panel, /say builder, etc.) target the same
 * server unless the user explicitly overrides inside that addon.
 *
 * Persisted per user+bot in localStorage so refreshing or switching
 * tabs doesn't lose the choice.
 *
 * Logs are intentionally NOT scoped — they always broadcast across
 * every server the bot is in.
 */

type Ctx = {
  guild: BotGuild | null;
  setGuild: (g: BotGuild | null) => void;
};

const ActiveGuildContext = createContext<Ctx | null>(null);

const storageKey = (userId: string, botId: string) =>
  `dashboard:active-guild:${userId}:${botId}`;

export function ActiveGuildProvider({
  userId,
  botId,
  children,
}: {
  userId: string;
  botId: string;
  children: ReactNode;
}) {
  const key = useMemo(() => storageKey(userId, botId), [userId, botId]);

  const [guild, setGuildState] = useState<BotGuild | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as BotGuild) : null;
    } catch {
      return null;
    }
  });

  // Re-load if the bot changes underneath us (e.g. user switches bots in-page).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      setGuildState(raw ? (JSON.parse(raw) as BotGuild) : null);
    } catch {
      setGuildState(null);
    }
  }, [key]);

  const setGuild = useCallback(
    (g: BotGuild | null) => {
      setGuildState(g);
      try {
        if (g) window.localStorage.setItem(key, JSON.stringify(g));
        else window.localStorage.removeItem(key);
      } catch {
        /* ignore quota errors */
      }
    },
    [key],
  );

  const value = useMemo(() => ({ guild, setGuild }), [guild, setGuild]);
  return (
    <ActiveGuildContext.Provider value={value}>{children}</ActiveGuildContext.Provider>
  );
}

/** Returns the active guild context, or null if used outside a provider. */
export function useActiveGuild(): Ctx {
  const ctx = useContext(ActiveGuildContext);
  // Safe default for any render path that isn't wrapped (e.g. demo bots).
  return ctx ?? { guild: null, setGuild: () => {} };
}
