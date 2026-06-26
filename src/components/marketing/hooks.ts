import { useEffect, useRef, useState } from "react";

/**
 * Respect the user's reduced-motion preference. Every scroll-driven effect on
 * the marketing site checks this and falls back to a static layout.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

/**
 * Fade-up on first entry into the viewport. Fires once, then disconnects so
 * scrolling back up doesn't re-trigger it.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(
  options?: { rootMargin?: string; threshold?: number },
) {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            obs.disconnect();
          }
        }
      },
      {
        rootMargin: options?.rootMargin ?? "0px 0px -10% 0px",
        threshold: options?.threshold ?? 0.15,
      },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [options?.rootMargin, options?.threshold]);

  return { ref, shown };
}

/**
 * Whole-page scroll progress, 0 → 1. Drives the thin accent line at the top of
 * the viewport. Uses rAF so we never thrash layout on the scroll event.
 */
export function useScrollProgress(): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      setProgress(max > 0 ? Math.min(1, Math.max(0, doc.scrollTop / max)) : 0);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return progress;
}

/**
 * Progress of a single element through the viewport, 0 (just entering from the
 * bottom) → 1 (about to leave from the top). Used for the hero tilt and the
 * music-section parallax. Returns a stable 0.5 when motion is reduced.
 */
export function useElementProgress<T extends HTMLElement = HTMLDivElement>(
  enabled = true,
) {
  const ref = useRef<T>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setProgress(0.5);
      return;
    }
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0 when the element's top hits the bottom of the viewport,
      // 1 when its bottom passes the top of the viewport.
      const total = vh + rect.height;
      const passed = vh - rect.top;
      setProgress(Math.min(1, Math.max(0, passed / total)));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [enabled]);

  return { ref, progress };
}

/**
 * Count a number up from zero once it scrolls into view. Honours reduced
 * motion by snapping straight to the target.
 */
export function useCountUp(target: number, durationMs = 1400) {
  const { ref, shown } = useReveal<HTMLSpanElement>();
  const reduced = usePrefersReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!shown) return;
    if (reduced) {
      setValue(target);
      return;
    }
    let frame = 0;
    let start = 0;
    const step = (now: number) => {
      if (!start) start = now;
      const t = Math.min(1, (now - start) / durationMs);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [shown, reduced, target, durationMs]);

  return { ref, value };
}

/** True once the viewport is at least `bp` px wide (e.g. desktop-only effects). */
export function useMinWidth(bp: number): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${bp}px)`);
    setOk(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setOk(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [bp]);
  return ok;
}
