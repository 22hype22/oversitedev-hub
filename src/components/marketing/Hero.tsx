import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import wordmark from "@/assets/oversite-wordmark.webp";

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
          <Link
            to="/bots"
            className="rounded-full border border-os-heading/40 px-9 py-4 font-label text-[12px] font-bold uppercase tracking-[0.16em] text-os-heading backdrop-blur-sm transition hover:border-os-heading hover:bg-os-heading/[0.06] sm:px-11 sm:text-[13px]"
          >
            Learn more
          </Link>
          <Link
            to="/auth"
            className="group inline-flex items-center gap-2 rounded-full bg-os-accent px-9 py-4 font-label text-[12px] font-bold uppercase tracking-[0.16em] text-os-accent-ink shadow-[0_16px_40px_-16px_rgb(var(--os-accent)/0.7)] transition hover:brightness-105 sm:px-11 sm:text-[13px]"
          >
            Deploy now
            <ArrowRight size={17} className="transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
