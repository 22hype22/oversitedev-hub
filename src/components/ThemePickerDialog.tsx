import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const CHOSEN_KEY = "oversite-theme-chosen";
const THEME_KEY = "oversite-theme";

function applyTheme(theme: "light" | "dark") {
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  localStorage.setItem(THEME_KEY, theme);
  localStorage.setItem(CHOSEN_KEY, "1");
}

export const ThemePickerDialog = ({ enabled }: { enabled: boolean }) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    const chosen = localStorage.getItem(CHOSEN_KEY) || localStorage.getItem(THEME_KEY);
    if (!chosen) setOpen(true);
  }, [enabled]);

  if (!open) return null;

  const pick = (theme: "light" | "dark") => {
    applyTheme(theme);
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-background/70 backdrop-blur-md animate-fade-in">
      <div className="relative mx-4 w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl p-8 animate-scale-in">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold tracking-tight">Choose your theme</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Pick how Oversite should look. You can change this anytime from the navbar.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => pick("light")}
            className="group flex flex-col items-center gap-3 rounded-xl border border-border bg-background p-6 hover:border-primary hover:shadow-glow transition-smooth"
          >
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-200 to-amber-400 grid place-items-center text-amber-900 group-hover:scale-110 transition-transform">
              <Sun size={26} />
            </div>
            <span className="font-semibold">Light</span>
          </button>
          <button
            onClick={() => pick("dark")}
            className="group flex flex-col items-center gap-3 rounded-xl border border-border bg-background p-6 hover:border-primary hover:shadow-glow transition-smooth"
          >
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 grid place-items-center text-slate-100 group-hover:scale-110 transition-transform">
              <Moon size={26} />
            </div>
            <span className="font-semibold">Dark</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ThemePickerDialog;
