import wordmark from "@/assets/oversite-wordmark.webp";
import { AccentButton } from "@/components/marketing/primitives";

const SHADOW = "[text-shadow:0_2px_30px_rgb(var(--os-ink)/0.85)]";

export function Hero() {
  return (
    <section className="relative flex min-h-[100svh] flex-col overflow-hidden px-6 pb-12 pt-20 md:px-10 md:pt-24">
      {/* tagline */}
      <div className="text-center">
        <p className={`font-label text-[11px] uppercase tracking-[0.42em] text-os-heading sm:text-[13px] ${SHADOW}`}>
          Infrastructure for serious servers
        </p>
      </div>

      {/* brand wordmark */}
      <div className="mt-[20vh] flex justify-center">
        <img
          src={wordmark}
          alt="Oversite"
          className="w-[min(820px,92%)] [filter:drop-shadow(0_6px_34px_rgb(var(--os-ink)/0.55))]"
        />
      </div>

      {/* date + CTAs */}
      <div className="mt-[26vh] flex flex-col items-center gap-6">
        <div className="flex items-center gap-3 sm:gap-4">
          <AccentButton to="/bots" tone="muted" arrow={false} scrim className="h-[52px] px-[30px]">
            Learn more
          </AccentButton>
          <AccentButton to="/auth" scrim className="h-[52px] px-[30px]">
            Deploy now
          </AccentButton>
        </div>
      </div>
    </section>
  );
}
