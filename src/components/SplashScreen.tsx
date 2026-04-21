import { useEffect, useState } from "react";

export const SplashScreen = ({ onDone }: { onDone: () => void }) => {
  const [phase, setPhase] = useState<"in" | "out">("in");

  useEffect(() => {
    const outTimer = setTimeout(() => setPhase("out"), 2000);
    const doneTimer = setTimeout(() => onDone(), 2700);
    return () => {
      clearTimeout(outTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-background overflow-hidden transition-opacity duration-700 ${
        phase === "out" ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-primary/20 blur-3xl animate-pulse-slow" />
        <div
          className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full bg-primary/15 blur-3xl animate-pulse-slow"
          style={{ animationDelay: "0.5s" }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-accent/20 blur-3xl animate-pulse-slow"
          style={{ animationDelay: "1s" }}
        />
      </div>

      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Center content */}
      <div className="relative flex flex-col items-center gap-6">
        {/* Logo with rotating ring */}
        <div className="relative w-28 h-28 flex items-center justify-center">
          <svg
            className="absolute inset-0 w-full h-full animate-spin-slow"
            viewBox="0 0 100 100"
          >
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="1.5"
              strokeDasharray="6 8"
              opacity="0.5"
            />
          </svg>
          <svg
            className="absolute inset-0 w-full h-full -rotate-90"
            viewBox="0 0 100 100"
          >
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="264"
              className="animate-draw-circle"
            />
          </svg>
          <div className="w-16 h-16 rounded-xl bg-gradient-primary shadow-glow grid place-items-center text-primary-foreground font-bold text-3xl animate-scale-in">
            O
          </div>
        </div>

        {/* Brand */}
        <div className="text-center animate-fade-in" style={{ animationDelay: "0.3s", animationFillMode: "both" }}>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            <span className="text-gradient">Oversite</span>
          </h1>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground mt-2">
            Crafting your experience
          </p>
        </div>

        {/* Loading bar */}
        <div className="w-48 h-[2px] bg-border/60 rounded-full overflow-hidden mt-4">
          <div className="h-full bg-gradient-primary animate-loading-bar" />
        </div>
      </div>
    </div>
  );
};
