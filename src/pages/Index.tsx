import { useEffect, useState } from "react";
import { ContainerBackground } from "@/components/marketing/ContainerBackground";
import { SiteNav } from "@/components/marketing/SiteNav";
import { Hero } from "@/components/marketing/Hero";
import { BotWalkthrough } from "@/components/marketing/BotWalkthrough";
import { RadioFeature } from "@/components/marketing/RadioFeature";
import { Faq } from "@/components/marketing/Faq";
import { FinalCta } from "@/components/marketing/FinalCta";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { PageNav } from "@/components/marketing/PageNav";

/**
 * Oversite marketing site — a four-page full-screen experience. Each [data-page]
 * is a snap target tracked by the fixed PageNav (dot rail + NN—NN counter) and
 * the radio player; the native scrollbar is hidden via the `snap-pages` class.
 *
 *   1 — Hero
 *   2 — The Fleet   (bots)
 *   3 — Radio        (Inside Utilities — the live station)
 *   4 — Briefing    (FAQ + final CTA + footer)
 */

// Launch intro — plays once per browser session (until the tab is closed). On
// first load only the dark backdrop shows; the content then rises/fades up into
// place while the top nav drops in from above. Skipped entirely for visitors
// who prefer reduced motion. Driven by a class on the page root + a scoped
// <style> block so the whole effect lives in this one file.
const INTRO_KEY = "oversite-intro-seen";
const INTRO_MS = 2900;

// Staged launch: the backdrop pans up (handled in ContainerBackground, ~1.4s),
// THEN the nav drops in, THEN the content builds in — so the timings below are
// delayed to fire after the pan rather than alongside it.
const INTRO_CSS = `
  html.os-intro-lock, html.os-intro-lock body { overflow: hidden !important; }

  /* Start state: backdrop only. Content sits low and hidden, the nav is lifted
     above the top edge, the page-dots are faded out. */
  .oversite-theme.os-intro main { opacity: 0; transform: translateY(6vh); will-change: transform, opacity; }
  .oversite-theme.os-intro header { opacity: 0; transform: translateY(-120%); }
  .oversite-theme.os-intro [data-os-pagenav] { opacity: 0; }

  /* Reveal (after the pan): nav drops down, then the content builds in, then
     the page-dots fade in last. */
  .oversite-theme.os-intro.os-intro-go header {
    opacity: 1; transform: translateY(0);
    transition: transform 0.85s cubic-bezier(0.16, 1, 0.3, 1) 1.35s, opacity 0.6s ease 1.35s;
  }
  .oversite-theme.os-intro.os-intro-go main {
    opacity: 1; transform: translateY(0);
    transition: opacity 1.1s ease-out 1.7s, transform 1.2s cubic-bezier(0.16, 1, 0.3, 1) 1.7s;
  }
  .oversite-theme.os-intro.os-intro-go [data-os-pagenav] {
    opacity: 1; transition: opacity 0.7s ease 2.1s;
  }
`;

const Index = () => {
  // "play" = hidden start state, "reveal" = animating in, "done" = normal.
  const [phase, setPhase] = useState<"play" | "reveal" | "done">(() => {
    if (typeof window === "undefined") return "done";
    try {
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return "done";
      return sessionStorage.getItem(INTRO_KEY) ? "done" : "play";
    } catch {
      return "done";
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("snap-pages");
    return () => root.classList.remove("snap-pages");
  }, []);

  useEffect(() => {
    if (phase === "done") return;
    const root = document.documentElement;
    root.classList.add("os-intro-lock");
    // Paint the hidden start state for a couple of frames, then flip to reveal
    // so the transitions actually run.
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => setPhase("reveal")),
    );
    // Failsafe: whatever happens, the page is fully shown + unlocked by INTRO_MS.
    const done = window.setTimeout(() => {
      try {
        sessionStorage.setItem(INTRO_KEY, "1");
      } catch {
        /* sessionStorage may be unavailable (private mode) — ignore */
      }
      root.classList.remove("os-intro-lock");
      setPhase("done");
    }, INTRO_MS);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(done);
      root.classList.remove("os-intro-lock");
    };
    // Runs once on mount; intentionally not re-run when `phase` changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const introClass =
    phase === "done" ? "" : phase === "reveal" ? "os-intro os-intro-go" : "os-intro";

  return (
    <div
      className={`oversite-theme relative min-h-screen font-body text-os-body antialiased ${introClass}`}
    >
      {phase !== "done" && <style>{INTRO_CSS}</style>}
      <ContainerBackground />

      <div className="relative z-10">
        <SiteNav />
        <main>
          <div data-page="0" className="snap-start">
            <Hero />
          </div>
          <div data-page="1" className="min-h-[100svh] snap-start [&>section:first-child]:!mt-0">
            <BotWalkthrough />
          </div>
          <div data-page="2" className="min-h-[100svh] snap-start [&>section:first-child]:!mt-0">
            <RadioFeature />
          </div>
          <div data-page="3" className="min-h-[100svh] snap-start [&>section:first-child]:!mt-0">
            <Faq />
            <FinalCta />
            <SiteFooter />
          </div>
        </main>
      </div>

      <div data-os-pagenav>
        <PageNav />
      </div>
    </div>
  );
};

export default Index;
