import { useEffect } from "react";
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
const Index = () => {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("snap-pages");
    return () => root.classList.remove("snap-pages");
  }, []);

  return (
    <div className="oversite-theme relative min-h-screen font-body text-os-body antialiased">
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

      <PageNav />
    </div>
  );
};

export default Index;
