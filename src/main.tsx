import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
// Import once at startup so the saved theme is applied to <html> on every
// page, not just routes (like Dashboard) that happen to import useTheme.
import "./hooks/useTheme";
// Public site settings start loading with the app, before any page mounts.
import "@/lib/appSettings";

// Stale build recovery. Every deploy renames the code chunks. A tab that was
// opened before a deploy and then tries to load a chunk it has not fetched
// yet (opening a bot pulls in the add-on editor, for example) asks for a file
// that no longer exists and lands on the "Something hiccuped" screen. When
// that happens, reload once so the tab picks up the new build. The guard
// stops a reload loop if the file is genuinely missing.
{
  const RELOAD_KEY = "oversite:chunk-reload";
  const isChunkError = (msg: unknown) =>
    typeof msg === "string" &&
    (/Failed to fetch dynamically imported module/i.test(msg) ||
      /Importing a module script failed/i.test(msg) ||
      /error loading dynamically imported module/i.test(msg) ||
      /Unable to preload CSS/i.test(msg));
  const recover = () => {
    try {
      const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
      if (Date.now() - last < 15_000) return false;
      sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    } catch { /* ignore */ }
    window.location.reload();
    return true;
  };
  window.addEventListener("vite:preloadError", (e) => {
    if (recover()) e.preventDefault();
  });
  window.addEventListener("unhandledrejection", (e) => {
    const reason = e.reason as { message?: string } | string | undefined;
    const msg = typeof reason === "string" ? reason : reason?.message;
    if (isChunkError(msg) && recover()) e.preventDefault();
  });
  window.addEventListener("error", (e) => {
    if (isChunkError(e.message) && recover()) e.preventDefault();
  });
}

// Refreshing directly on a lazy route used to wait for the whole app shell to
// boot before that route's chunk even STARTED downloading — the big
// bot-dashboard chunk arrived last on the exact page that needs it first.
// Kick the fetch off immediately so it downloads in parallel with React
// mounting (Vite dedupes with App.tsx's lazy() import of the same module).
{
  const p = window.location.pathname;
  if (p.startsWith("/bot-dashboard")) import("./pages/BotDashboard.tsx");
  else if (p.startsWith("/admin")) import("./pages/Admin.tsx");
  else if (p.startsWith("/dashboard")) import("./pages/Dashboard.tsx");
  else if (p.startsWith("/auth")) import("./pages/Auth.tsx");
}

createRoot(document.getElementById("root")!).render(<App />);

// The self-hosted fonts are ~390KB of base64 (they can't live as binary
// .woff2 files in this repo). Loading them dynamically keeps them OUT of the
// render-blocking main stylesheet — the page paints immediately with system
// fallbacks and the brand fonts swap in a beat later (font-display: swap).
import("./marketing-fonts.css");
