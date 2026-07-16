import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
// Import once at startup so the saved theme is applied to <html> on every
// page, not just routes (like Dashboard) that happen to import useTheme.
import "./hooks/useTheme";

createRoot(document.getElementById("root")!).render(<App />);

// The self-hosted fonts are ~390KB of base64 (they can't live as binary
// .woff2 files in this repo). Loading them dynamically keeps them OUT of the
// render-blocking main stylesheet — the page paints immediately with system
// fallbacks and the brand fonts swap in a beat later (font-display: swap).
import("./marketing-fonts.css");
