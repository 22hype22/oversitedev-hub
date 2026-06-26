import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./marketing-fonts.css";
// Import once at startup so the saved theme is applied to <html> on every
// page, not just routes (like Dashboard) that happen to import useTheme.
import "./hooks/useTheme";

createRoot(document.getElementById("root")!).render(<App />);
