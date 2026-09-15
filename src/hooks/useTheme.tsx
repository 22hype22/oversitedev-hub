import { useEffect, useState } from "react";

export type Theme = "dark";

const STORAGE_KEY = "oversite-theme";

// Oversite is dark. There used to be a light theme that nobody could choose —
// there is no toggle anywhere in the app — but it was the DEFAULT for any
// browser without an `oversite-theme=dark` key already in localStorage. So a
// fresh browser, a cleared cache, an incognito window or a team member's first
// visit got a light dashboard with no way back, while the owner's own browser,
// which happened to hold the key, stayed dark. The class is now applied
// unconditionally, and a stale "light" value is removed rather than honoured.

function apply() {
  const root = document.documentElement;
  root.classList.add("dark");
  try {
    if (localStorage.getItem(STORAGE_KEY) !== "dark") localStorage.setItem(STORAGE_KEY, "dark");
  } catch {
    /* storage unavailable — the class is what matters */
  }
}

// Apply immediately on module load so no page paints light first.
if (typeof window !== "undefined") {
  apply();
}

export function useTheme() {
  const [theme] = useState<Theme>("dark");

  useEffect(() => {
    apply();
  }, [theme]);

  return {
    theme,
    // Kept for callers that expect the old shape. There is one theme.
    setTheme: (_: Theme) => apply(),
    toggle: () => apply(),
  };
}
