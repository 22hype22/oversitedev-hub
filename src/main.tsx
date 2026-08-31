import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
// Import once at startup so the saved theme is applied to <html> on every
// page, not just routes (like Dashboard) that happen to import useTheme.
import "./hooks/useTheme";

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
