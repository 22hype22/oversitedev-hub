import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Container, Reveal } from "./primitives";

export function FinalCta() {
  return (
    <section className="mt-16 md:mt-24">
      <Container>
        <Reveal className="relative overflow-hidden rounded-[28px] border border-os-accent/30 bg-os-bg/60 p-10 text-center shadow-[inset_0_1px_0_rgb(var(--os-heading)/0.1),0_30px_80px_-34px_rgb(0_0_0/0.8)] backdrop-blur-sm sm:p-14">
          {/* accent glow */}
          <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-56 w-[28rem] max-w-[80%] -translate-x-1/2 rounded-full bg-os-accent/18 blur-3xl" />

          <h3 className="relative mx-auto max-w-[18ch] font-display text-[clamp(2rem,5vw,3.4rem)] font-extrabold uppercase leading-[0.95] tracking-[-0.02em] text-os-heading [text-shadow:0_2px_28px_rgb(var(--os-ink)/0.8)]">
            Put your server on autopilot
          </h3>
          <p className="relative mx-auto mt-4 max-w-[46ch] font-body text-[15px] leading-relaxed text-os-body [text-shadow:0_1px_16px_rgb(var(--os-ink)/0.85)]">
            Deploy the bots, set it once, and let Oversite run the rest —
            moderation, support, and utilities, always on call.
          </p>
          <div className="relative mt-8 flex justify-center">
            <Link
              to="/auth"
              className="group inline-flex items-center justify-center gap-2.5 border border-os-accent/70 px-9 py-4 font-label text-[12px] font-bold uppercase tracking-[0.14em] text-os-accent transition hover:bg-os-accent hover:text-os-accent-ink"
            >
              Deploy now
              <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
            </Link>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
