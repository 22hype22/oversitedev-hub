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
        animate ? "transition-[opacity,transform] duration-[360ms] ease-out will-change-[opacity,transform]" : "",
        animate && !shown ? "translate-y-5 opacity-0" : "translate-y-0 opacity-100",
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

/** Icy glass button: a thin bezel around a lit face, with the arrow in its
 *  own disc that steps up and right on hover. Same build as the checkout
 *  button, in the accent colour. */
export function AccentButton({
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
    "group relative inline-block rounded-[14px] p-[3px] bg-os-accent/15 ring-1 ring-inset ring-os-accent/45",
    "transition-transform duration-[160ms] active:scale-[0.98]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-os-accent",
    className,
  );
  const inner = (
    <span
      style={{ transitionTimingFunction: EASE_OUT }}
      className="relative flex h-11 items-center rounded-[11px] pl-6 pr-14 text-os-heading bg-[linear-gradient(180deg,rgb(var(--os-accent)/0.58),rgb(var(--os-accent)/0.40))] shadow-[inset_0_1px_0_rgba(255,255,255,0.32),inset_0_-1px_0_rgb(var(--os-accent)/0.35),0_8px_20px_-14px_rgb(var(--os-accent)/0.5)] transition-[background-color,box-shadow] duration-[340ms] group-hover:bg-os-accent/15"
    >
      <span className="whitespace-nowrap font-label text-[12px] font-bold uppercase tracking-[0.14em]">{children}</span>
      <span
        style={{ transitionTimingFunction: EASE_OUT }}
        aria-hidden
        className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-os-bg/35 text-os-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] transition-transform duration-[340ms] group-hover:translate-x-0.5 group-hover:-translate-y-[calc(50%+1px)]"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </span>
    </span>
  );
  if (to) return <Link to={to} className={classes} style={{ transitionTimingFunction: EASE_OUT }}>{inner}</Link>;
  return <a href={href} className={classes} style={{ transitionTimingFunction: EASE_OUT }}>{inner}</a>;
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
