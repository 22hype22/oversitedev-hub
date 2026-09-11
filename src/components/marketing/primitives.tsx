import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useReveal, usePrefersReducedMotion } from "./hooks";

/** Fade-up reveal: subtle, once. */
export function Reveal({
  children,
  className,
  delayMs = 0,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  delayMs?: number;
  as?: "div" | "section" | "li" | "header" | "footer";
}) {
  const { ref, shown } = useReveal<HTMLDivElement>();
  const reduced = usePrefersReducedMotion();
  const animate = !reduced;
  return (
    <Tag
      ref={ref as never}
      className={cn(
        // will-change and a lingering transform keep the block on its own
        // compositing layer, and Chromium then paints background-clip:text
        // labels inside it (the AccentButton) as blank. Both are dropped the
        // moment the block has shown, so the label draws.
        animate ? "transition-[opacity,transform] duration-[360ms] ease-out" : "",
        animate && !shown ? "translate-y-5 opacity-0 will-change-[opacity,transform]" : "transform-none opacity-100",
        className,
      )}
      style={animate ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}

/** Technical bracketed mono label, e.g. "[ MODEL: OVERSITE OPS.01 ]". */
export function Eyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("font-label text-[11px] uppercase tracking-[0.18em] text-os-faint", className)}>
      <span className="text-os-accent">[</span> {children} <span className="text-os-accent">]</span>
    </p>
  );
}

/** Plain mono caption (no brackets). */
export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("font-label text-[11px] uppercase tracking-[0.16em]", className)}>{children}</span>;
}

/** Outer width container. */
export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[1320px] px-5 md:px-8", className)}>{children}</div>;
}

const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

/** Outlined button whose hover is a wipe: a thick accent outline sweeps over
 *  the thin one from left to right, and the label brightens under it as it
 *  passes. The box never fills. */
export function AccentButton({
  to,
  href,
  children,
  className,
  tone = "accent",
  arrow = true,
  glass = false,
}: {
  to?: string;
  href?: string;
  children: ReactNode;
  className?: string;
  /** "accent" is the primary action; "muted" is the quiet partner beside it. */
  tone?: "accent" | "muted";
  /** The arrow belongs to the action that moves you forward. */
  arrow?: boolean;
  /** Frosted glass under the button, for when it sits over a photograph. */
  glass?: boolean;
}) {
  const thin = tone === "accent"
    ? (glass ? "border-os-accent/60" : "border-os-accent/40")
    : "border-os-heading/30";
  const thick = tone === "accent" ? "border-os-accent" : "border-os-heading/75";
  const classes = cn(
    "group relative inline-flex h-[46px] items-center gap-3 rounded-[10px] px-[22px] text-os-heading isolate",
    "transition-transform duration-[160ms] active:scale-[0.98]",
    glass && [
      // The nav pill's material, exactly: same tint, same blur, same shadow,
      // so the bar at the top and the buttons below read as one set.
      "bg-os-bg/35 backdrop-blur-sm overflow-hidden",
      "shadow-[0_12px_40px_-14px_rgb(0_0_0/0.6)]",
    ],
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-os-accent focus-visible:ring-offset-2 focus-visible:ring-offset-os-bg",
    className,
  );
  const inner = (
    <>
      {/* The light a pane of glass catches along its top edge. */}
      {glass && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[linear-gradient(180deg,rgb(var(--os-heading)/0.10),transparent_60%)]"
        />
      )}
      {/* The thin line that is always there. */}
      <span aria-hidden className={cn("pointer-events-none absolute inset-0 rounded-[inherit] border", thin)} />
      {/* The thick line, revealed left to right. */}
      <span
        aria-hidden
        style={{ transitionTimingFunction: EASE_OUT }}
        className={cn(
          "pointer-events-none absolute inset-0 rounded-[inherit] border-[2.5px] [clip-path:inset(0_100%_0_0)] transition-[clip-path] duration-[420ms] group-hover:[clip-path:inset(0_0_0_0)] motion-reduce:transition-none",
          thick,
        )}
      />
      <span
        style={{ transitionTimingFunction: EASE_OUT }}
        className={cn(
          "whitespace-nowrap font-display text-[15px] font-semibold tracking-[-0.01em] motion-reduce:transition-none",
          glass
            // On the photograph the label rests at the nav's own brightness so
            // the two match, and the wipe brightens it left to right.
            ? "text-transparent bg-clip-text bg-[length:200%_100%] bg-[position:100%_0] transition-[background-position] duration-[420ms] group-hover:bg-[position:0_0] bg-[linear-gradient(90deg,#fff_50%,rgb(var(--os-heading)/0.8)_50%)]"
            // On the dark pages the label is plain body grey that brightens
            // on hover. Clipped gradient text went blank there, so it is a
            // solid colour with no clipping at all.
            : "text-os-body transition-colors duration-[420ms] group-hover:text-os-heading",
        )}
      >
        {children}
      </span>
      {arrow && (
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          width="15"
          height="15"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transitionTimingFunction: EASE_OUT }}
          className="transition-transform duration-300 group-hover:translate-x-[3px] motion-reduce:transition-none"
        >
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      )}
    </>
  );
  if (to) return <Link to={to} className={classes}>{inner}</Link>;
  return <a href={href} className={classes}>{inner}</a>;
}

/** Outline arrow link, mono uppercase. */
export function ArrowLink({
  to,
  href,
  children,
  className,
}: {
  to?: string;
  href?: string;
  children: ReactNode;
  className?: string;
}) {
  const classes = cn(
    "group inline-flex items-center gap-2 font-label text-[12px] font-bold uppercase tracking-[0.14em] text-os-heading transition-colors hover:text-os-accent",
    className,
  );
  const inner = (
    <>
      {children}
      <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-1">→</span>
    </>
  );
  if (to) return <Link to={to} className={classes}>{inner}</Link>;
  return <a href={href} className={classes}>{inner}</a>;
}

/** Circular arrow "buy" affordance, like the reference's add-to-cart. */
export function ArrowDisc({ className }: { className?: string }) {
  return (
    <span className={cn("grid h-12 w-12 flex-none place-items-center rounded-full border border-os-heading/60 text-os-heading transition-colors group-hover:border-os-accent group-hover:text-os-accent", className)}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" /></svg>
    </span>
  );
}

/**
 * "Model" product frame — an icy panel with a faint figure silhouette and a
 * mono asset label. Drop a real product/model render in to replace it.
 */
export function ScreenshotPlaceholder({
  label,
  ratio = "16 / 10",
  className,
  children,
}: {
  label: string;
  ratio?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn("relative overflow-hidden border border-os-hairline/70", className)}
      style={{ aspectRatio: ratio }}
      data-placeholder
    >
      {/* Transparent frame — the fixed container-yard backdrop shows through as a
          window. A bottom scrim keeps the mono caption legible over the photo. */}
      <div className="absolute inset-0 bg-[linear-gradient(to_top,rgb(var(--os-bg)/0.62)_0%,rgb(var(--os-bg)/0.12)_45%,transparent_70%)]" />
      <div className="absolute inset-0 flex flex-col items-start justify-end gap-1 p-4">
        {children}
        <span className="font-label text-[10px] uppercase tracking-[0.2em] text-os-accent">[ image ]</span>
        <span className="font-label text-[11px] uppercase tracking-[0.1em] text-os-body">{label}</span>
      </div>
    </div>
  );
}
