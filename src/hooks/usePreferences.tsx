import { createContext, useContext, useEffect, useMemo, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type Currency = "USD" | "EUR" | "GBP" | "CAD" | "AUD" | "JPY";
export type Language =
  | "en" | "es" | "fr" | "de" | "pt" | "it" | "nl" | "pl"
  | "ru" | "ja" | "zh" | "ko" | "ar" | "hi" | "tr";
export type ContactMethod = "email" | "discord";

export type Preferences = {
  notify_email: boolean;
  notify_discord: boolean;
  preferred_currency: Currency;
  preferred_language: Language;
  timezone: string;
  preferred_contact: ContactMethod;
};

const DEFAULTS: Preferences = {
  notify_email: true,
  notify_discord: false,
  preferred_currency: "USD",
  preferred_language: "en",
  timezone: typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" : "UTC",
  preferred_contact: "email",
};

const STORAGE_KEY = "oversite-prefs";

// Static FX rates relative to USD. Display-only conversion.
export const FX: Record<Currency, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  CAD: 1.36,
  AUD: 1.52,
  JPY: 156,
};

export const CURRENCY_LABELS: Record<Currency, string> = {
  USD: "US Dollar (USD)",
  EUR: "Euro (EUR)",
  GBP: "British Pound (GBP)",
  CAD: "Canadian Dollar (CAD)",
  AUD: "Australian Dollar (AUD)",
  JPY: "Japanese Yen (JPY)",
};

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  pt: "Português",
  it: "Italiano",
  nl: "Nederlands",
  pl: "Polski",
  ru: "Русский",
  ja: "日本語",
  zh: "中文",
  ko: "한국어",
  ar: "العربية",
  hi: "हिन्दी",
  tr: "Türkçe",
};

// Common timezones — short list, the user can pick from these.
export const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

function loadLocal(): Preferences {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

type Ctx = {
  prefs: Preferences;
  setPrefs: (patch: Partial<Preferences>) => Promise<void>;
  loading: boolean;
  formatPrice: (usdAmount: number) => string;
  formatDate: (iso: string) => string;
};

const PreferencesContext = createContext<Ctx | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [prefs, setPrefsState] = useState<Preferences>(loadLocal);
  const [loading, setLoading] = useState(false);

  // Pull from DB once we know the user; merge with local
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select(
          "notify_email,notify_discord,preferred_currency,preferred_language,timezone,preferred_contact",
        )
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled && data) {
        const merged: Preferences = {
          ...DEFAULTS,
          ...(data as Partial<Preferences>),
        };
        setPrefsState(merged);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Reflect language to <html lang>
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = prefs.preferred_language;
    }
  }, [prefs.preferred_language]);

  const setPrefs = useCallback(
    async (patch: Partial<Preferences>) => {
      const next = { ...prefs, ...patch };
      setPrefsState(next);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      if (user) {
        await supabase
          .from("profiles")
          .update(patch)
          .eq("user_id", user.id);
      }
    },
    [prefs, user],
  );

  const formatPrice = useCallback(
    (usdAmount: number) => {
      const rate = FX[prefs.preferred_currency] ?? 1;
      const converted = usdAmount * rate;
      try {
        return new Intl.NumberFormat(prefs.preferred_language, {
          style: "currency",
          currency: prefs.preferred_currency,
          maximumFractionDigits: prefs.preferred_currency === "JPY" ? 0 : 2,
        }).format(converted);
      } catch {
        return `${converted.toFixed(2)} ${prefs.preferred_currency}`;
      }
    },
    [prefs.preferred_currency, prefs.preferred_language],
  );

  const formatDate = useCallback(
    (iso: string) => {
      try {
        return new Intl.DateTimeFormat(prefs.preferred_language, {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: prefs.timezone,
        }).format(new Date(iso));
      } catch {
        return new Date(iso).toLocaleString();
      }
    },
    [prefs.preferred_language, prefs.timezone],
  );

  const value = useMemo<Ctx>(
    () => ({ prefs, setPrefs, loading, formatPrice, formatDate }),
    [prefs, setPrefs, loading, formatPrice, formatDate],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used inside <PreferencesProvider>");
  return ctx;
}
