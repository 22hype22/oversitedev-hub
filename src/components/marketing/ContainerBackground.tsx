import { useEffect, useRef } from "react";
import containers from "@/assets/containers.webp";

/**
 * Full-page container-stack photo backdrop that pans the entire image across
 * the page scroll: the very top of the photo shows at the top of the page, and
 * the very bottom of the photo shows once you reach the bottom. Sits behind all
 * content with a cold-slate scrim so headings/body stay readable. Scoped inside
 * `.oversite-theme` so it reads the `--os-bg` token for the scrim.
 *
 * On a fresh session it also plays the launch pan: the view starts on the
 * bottom of the photo and glides up to the top, then hands off to the normal
 * scroll-driven pan (see Index.tsx, which staggers the nav + content to build
 * in after this pan).
 */
// How dark the page can get at the very bottom of the scroll. The hero
// (p≈0) stays clear so the photo reads; by the time you're into the content
// the bright snow is dimmed enough for text to sit comfortably on top.
const MAX_DIM = 0.68;
// Duration of the launch pan from the bottom of the photo up to the top.
const INTRO_PAN_MS = 1900;

export function ContainerBackground() {
  const imgRef = useRef<HTMLImageElement>(null);
  const dimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const p = Math.min(1, Math.max(0, window.scrollY / max));
      // How much taller the image is than the viewport — the full pan distance.
      const overflow = Math.max(0, img.offsetHeight - window.innerHeight);
      // p=0 → show the top of the photo, p=1 → show the very bottom.
      img.style.transform = `translate3d(0, ${(-p * overflow).toFixed(1)}px, 0)`;
      // Ramp the scrim in just past the hero so it darkens through the
      // content but leaves the first screen almost untouched.
      const dim = dimRef.current;
      if (dim) dim.style.opacity = (Math.min(1, p * 1.8) * MAX_DIM).toFixed(3);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    const startScrollSync = () => {
      if (img.complete) update();
      img.addEventListener("load", update);
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
    };

    // Only play the launch pan once per session — same flag Index.tsx uses.
    let introActive = false;
    try {
      introActive = !sessionStorage.getItem("oversite-intro-seen");
    } catch {
      introActive = false;
    }

    let introTimer = 0;
    if (!introActive) {
      startScrollSync();
      return () => {
        img.removeEventListener("load", update);
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
        if (raf) cancelAnimationFrame(raf);
      };
    }

    // Launch pan: snap to the bottom of the photo, then glide up to the top.
    const runPan = () => {
      const overflow = Math.max(0, img.offsetHeight - window.innerHeight);
      img.style.transition = "none";
      img.style.transform = `translate3d(0, ${(-overflow).toFixed(1)}px, 0)`;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          img.style.transition = `transform ${INTRO_PAN_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`;
          img.style.transform = "translate3d(0, 0, 0)";
        }),
      );
    };
    if (img.complete) runPan();
    else img.addEventListener("load", runPan, { once: true });

    // Once the pan finishes, drop the transition and hand off to scroll-sync.
    introTimer = window.setTimeout(() => {
      img.style.transition = "none";
      startScrollSync();
    }, INTRO_PAN_MS + 120);

    return () => {
      img.removeEventListener("load", update);
      img.removeEventListener("load", runPan);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
      if (introTimer) window.clearTimeout(introTimer);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <img
        ref={imgRef}
        src={containers}
        alt=""
        className="absolute left-0 top-0 w-full max-w-none will-change-transform"
      />
      {/* Scroll-driven scrim — starts invisible over the hero, deepens as you
          scroll so headings/body stay legible over the bright snow. */}
      <div
        ref={dimRef}
        className="absolute inset-0 bg-os-bg opacity-0 will-change-[opacity]"
      />
    </div>
  );
}
