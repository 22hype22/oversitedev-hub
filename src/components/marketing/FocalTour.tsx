import { useEffect, useRef } from "react";
import mountain from "@/assets/containers.webp";

type Point = { x: number; y: number; zoom: number };

/**
 * Scroll-driven focal tour. A GPU transform "camera" (translate3d + scale on
 * the image — no per-frame repaints) eases toward the scroll target with
 * inertia, so it glides slowly and smoothly between points instead of
 * snapping. x/y are percentages across the image; zoom is a multiplier.
 *
 * 8 stops: full view (top) → six alternating left/right zooms descending the
 * face (three per side) → full view (bottom).
 */
const POINTS: Point[] = [
  { x: 50, y: 5, zoom: 1.0 },
  { x: 26, y: 20, zoom: 1.7 },
  { x: 74, y: 34, zoom: 1.8 },
  { x: 26, y: 50, zoom: 1.85 },
  { x: 74, y: 64, zoom: 1.85 },
  { x: 26, y: 78, zoom: 1.8 },
  { x: 74, y: 90, zoom: 1.7 },
  { x: 50, y: 97, zoom: 1.0 },
];

const AR = 3559 / 1500; // mountain image natural height / width
const EASE = 0.06; // inertia — lower = slower / smoother catch-up
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function FocalTour() {
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = ref.current;
    if (!img) return;

    // Each point gets a scroll "slot": the camera HOLDs on the point for the
    // first part of the slot, then travels to the next point in the rest — so
    // it sits at each spot for a couple of scrolls instead of gliding through.
    const N = POINTS.length;
    const HOLD = 0.55; // fraction of each slot spent parked on the point
    const smooth = (t: number) => t * t * (3 - 2 * t);
    const targetAt = (p: number): Point => {
      const slot = 1 / N;
      const idx = Math.min(N - 1, Math.floor(p / slot));
      if (idx >= N - 1) return POINTS[N - 1];
      const local = (p - idx * slot) / slot; // 0..1 within this point's slot
      if (local <= HOLD) return POINTS[idx];
      const t = smooth((local - HOLD) / (1 - HOLD));
      const a = POINTS[idx];
      const b = POINTS[idx + 1];
      return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), zoom: lerp(a.zoom, b.zoom, t) };
    };
    const progress = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      return clamp(window.scrollY / max, 0, 1);
    };
    const place = (f: Point) => {
      const W = window.innerWidth;
      const H = window.innerHeight;
      const s = f.zoom;
      const iw = s * W;
      const ih = s * W * AR;
      const tx = clamp(W / 2 - s * (f.x / 100) * W, W - iw, 0);
      const ty = clamp(H / 2 - s * (f.y / 100) * W * AR, H - ih, 0);
      img.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0) scale(${s.toFixed(4)})`;
    };

    const cur: Point = { ...POINTS[0] };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      place(cur);
      return;
    }

    let raf = 0;
    let running = false;
    const tick = () => {
      const tg = targetAt(progress());
      cur.x = lerp(cur.x, tg.x, EASE);
      cur.y = lerp(cur.y, tg.y, EASE);
      cur.zoom = lerp(cur.zoom, tg.zoom, EASE);
      place(cur);
      if (Math.abs(cur.x - tg.x) < 0.02 && Math.abs(cur.y - tg.y) < 0.02 && Math.abs(cur.zoom - tg.zoom) < 0.0008) {
        running = false;
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    const kick = () => {
      if (!running) {
        running = true;
        raf = requestAnimationFrame(tick);
      }
    };

    place(cur);
    kick();
    window.addEventListener("scroll", kick, { passive: true });
    window.addEventListener("resize", kick);
    return () => {
      window.removeEventListener("scroll", kick);
      window.removeEventListener("resize", kick);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <img
        ref={ref}
        src={mountain}
        alt=""
        className="absolute left-0 top-0 w-full origin-top-left select-none will-change-transform"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(var(--os-bg)/0.72)_0%,rgb(var(--os-bg)/0.5)_45%,rgb(var(--os-bg)/0.82)_100%)]" />
    </div>
  );
}
