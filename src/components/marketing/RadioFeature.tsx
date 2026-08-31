import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Play, Pause, ArrowRight, SkipBack, SkipForward, Radio, ChevronLeft, ChevronRight, Shield, LifeBuoy, type LucideIcon } from "lucide-react";
import { Container, Mono } from "./primitives";
import { usePrefersReducedMotion } from "./hooks";
import { cn } from "@/lib/utils";

// ───────────────────────── Proximity radio ─────────────────────────
// Real ambient audio for the radio slide: as the visitor scrolls toward this
// section the station fades in, and it fades back out as they scroll away
// (or flip the carousel off the Radio slide). Browsers block un-muted audio
// until the page has been interacted with, so we TRY to auto-start on
// approach; if that's refused, the play button on the card pulses and one tap
// enables it — after which the proximity fade drives everything.
//
// Routed through a Web Audio GainNode (not element.volume) so the fade also
// works on iOS, where media-element volume is read-only. The mp3 only loads
// when the listener is actually enabled, so the page-load cost is zero.
// Swap the track by replacing public/radio-loop.mp3.
const RADIO_SRC = "/radio-loop.mp3";
const RADIO_MAX_VOL = 0.18; // background-ambience level, never loud

function useProximityRadio(sectionRef: React.RefObject<HTMLElement>, slideActive: boolean) {
  const [playing, setPlaying] = useState(false); // user-intent: station on
  const [needsTap, setNeedsTap] = useState(false); // autoplay refused → invite a tap
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const enabledRef = useRef(false);
  const userMutedRef = useRef(false); // explicit pause — stop auto-restarting
  const triedAutoRef = useRef(false); // one autoplay attempt per approach
  const proxRef = useRef(0);
  const slideRef = useRef(slideActive);
  slideRef.current = slideActive;

  const ensureGraph = () => {
    if (!audioRef.current) {
      const a = new Audio(RADIO_SRC);
      a.loop = true;
      a.preload = "none";
      audioRef.current = a;
    }
    if (!ctxRef.current) {
      try {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (Ctx) {
          const ctx = new Ctx();
          const src = ctx.createMediaElementSource(audioRef.current);
          const gain = ctx.createGain();
          gain.gain.value = 0;
          src.connect(gain).connect(ctx.destination);
          ctxRef.current = ctx;
          gainRef.current = gain;
        }
      } catch {
        /* no Web Audio — element.volume fallback below */
      }
    }
  };

  const applyVolume = () => {
    const a = audioRef.current;
    if (!a) return;
    const target = enabledRef.current && slideRef.current ? Math.pow(proxRef.current, 1.6) * RADIO_MAX_VOL : 0;
    const ctx = ctxRef.current;
    const gain = gainRef.current;
    if (ctx && gain) gain.gain.setTargetAtTime(target, ctx.currentTime, 0.4);
    else try { a.volume = target; } catch { /* iOS read-only volume */ }
    // Once enabled the element keeps looping at gain 0 when far away (a 27s
    // decoded loop is negligible), so coming back never needs a fresh play()
    // call — which the browser could refuse outside a user gesture.
    if (enabledRef.current && a.paused) {
      a.play().catch(() => { /* will be unlocked by the next interaction */ });
    }
  };

  const enable = async (): Promise<boolean> => {
    ensureGraph();
    try {
      await ctxRef.current?.resume();
      if (ctxRef.current && ctxRef.current.state !== "running") throw new Error("suspended");
      await audioRef.current!.play();
      enabledRef.current = true;
      userMutedRef.current = false;
      setPlaying(true);
      setNeedsTap(false);
      applyVolume();
      return true;
    } catch {
      audioRef.current?.pause();
      return false;
    }
  };

  const toggle = () => {
    if (playing) {
      // Explicit off: fade to silence and stay off until tapped again.
      enabledRef.current = false;
      userMutedRef.current = true;
      setPlaying(false);
      applyVolume();
      const a = audioRef.current;
      if (a) setTimeout(() => { if (!enabledRef.current) a.pause(); }, 900);
    } else {
      void enable();
    }
  };

  // Scroll/resize → proximity of the section's center to the viewport's
  // center (1 when centered, 0 a full viewport away), rAF-throttled.
  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      const el = sectionRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const center = r.top + r.height / 2 - vh / 2;
      proxRef.current = Math.max(0, 1 - Math.abs(center) / vh);
      // Try to self-start on every fresh approach (not just once) — if the
      // browser refuses, the first interaction anywhere unlocks it instead.
      if (proxRef.current < 0.05) triedAutoRef.current = false;
      if (!enabledRef.current && !userMutedRef.current && !triedAutoRef.current && slideRef.current && proxRef.current > 0.3) {
        triedAutoRef.current = true;
        void enable().then((ok) => { if (!ok) setNeedsTap(true); });
      }
      applyVolume();
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(measure); };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    measure();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The browser only permits sound after SOME user interaction — so the very
  // first click/tap/keypress anywhere on the page quietly unlocks the station
  // (at gain 0 unless the section is in view). By the time anyone scrolls to
  // the radio, it simply plays on its own — no button press needed.
  useEffect(() => {
    const unlock = () => {
      if (enabledRef.current || userMutedRef.current) { cleanup(); return; }
      void enable().then((ok) => { if (ok) { setNeedsTap(false); cleanup(); } });
    };
    const cleanup = () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchend", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    window.addEventListener("touchend", unlock);
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Carousel flips → refade immediately.
  useEffect(() => { applyVolume(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [slideActive]);

  // Unmount → tear the audio down completely.
  useEffect(() => () => {
    audioRef.current?.pause();
    audioRef.current = null;
    void ctxRef.current?.close().catch(() => { /* already closed */ });
    ctxRef.current = null;
  }, []);

  return { playing, needsTap, toggle };
}

function Equalizer({ bars = 20, className = "h-6", active = true }: { bars?: number; className?: string; active?: boolean }) {
  const reduced = usePrefersReducedMotion();
  // Deterministic per-bar variety — uneven peaks, durations and delays so the
  // wave reads organic and alive rather than a uniform mechanical sweep.
  const items = Array.from({ length: bars }, (_, i) => ({
    peak: Math.min(100, 34 + Math.round(62 * Math.abs(Math.sin(i * 0.7) * Math.cos(i * 0.27 + 1)))),
    dur: 720 + ((i * 67) % 680),
    delay: (i * 41) % 600,
  }));
  return (
    <div className={`flex items-center gap-[3px] ${className}`} aria-hidden>
      {items.map((b, i) => (
        <span
          key={i}
          className="flex-1 rounded-full bg-gradient-to-b from-os-accent/40 via-os-accent to-os-accent/40 shadow-[0_0_10px_-3px_rgb(var(--os-accent)/0.65)]"
          style={
            reduced || !active
              ? { height: `${b.peak}%`, transform: active ? undefined : "scaleY(0.3)", transition: "transform 600ms ease" }
              : { height: `${b.peak}%`, transformOrigin: "center", animation: `os-eqc ${b.dur}ms ease-in-out ${b.delay}ms infinite alternate` }
          }
        />
      ))}
      {!reduced && <style>{`@keyframes os-eqc { from { transform: scaleY(0.28) } to { transform: scaleY(1) } }`}</style>}
    </div>
  );
}

/** Now-playing panel — Radio is a feature of the Utilities bot. */
function NowPlayingPanel({ playing, needsTap, onToggle }: { playing: boolean; needsTap: boolean; onToggle: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-[26px] border border-os-ink-line bg-gradient-to-b from-os-ink-2/85 to-os-ink/85 p-5 shadow-[inset_0_1px_0_rgb(var(--os-ink-heading)/0.1),0_30px_70px_-30px_rgb(0_0_0/0.85)] backdrop-blur-sm sm:p-6">
      <div aria-hidden className="pointer-events-none absolute -top-20 left-1/2 h-44 w-44 -translate-x-1/2 rounded-full bg-os-accent/15 blur-3xl" />

      <div className="relative flex items-center justify-center">
        <span className="inline-flex items-center gap-1.5 text-os-faint">
          <Radio size={13} strokeWidth={2} aria-hidden />
          <Mono>Oversite Radio</Mono>
        </span>
      </div>

      <div className="relative mt-5 flex h-40 items-center justify-center overflow-hidden rounded-2xl border border-os-ink-line/70 bg-os-ink/55 px-5 shadow-[inset_0_1px_0_rgb(var(--os-ink-heading)/0.06)]">
        <Equalizer bars={26} className="h-24 w-full" active={playing} />
      </div>

      <div className="relative mt-5">
        <div className="h-1 w-full overflow-hidden rounded-full bg-os-ink-line">
          <div className="h-full w-2/3 rounded-full bg-os-accent shadow-[0_0_12px_-2px_rgb(var(--os-accent)/0.8)]" />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <Mono className="text-os-faint">2:14</Mono>
          <Mono className="text-os-accent">Live</Mono>
        </div>
      </div>

      <div className="relative mt-5 flex items-center gap-4 border-t border-os-ink-line pt-5">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[16px] font-bold uppercase tracking-[0.02em] text-os-ink-heading">Oversite Utilities</p>
          <Mono className="truncate text-os-faint">DJ Carla — live AI set</Mono>
        </div>
        <div className="flex flex-none items-center gap-3">
          <button type="button" aria-label="Previous" className="text-os-faint transition-colors hover:text-os-ink-heading">
            <SkipBack size={17} strokeWidth={2} aria-hidden />
          </button>
          <button
            type="button"
            aria-label={playing ? "Pause the station" : "Play the station"}
            aria-pressed={playing}
            onClick={onToggle}
            className={cn(
              "grid h-12 w-12 flex-none cursor-pointer place-items-center rounded-full bg-os-accent text-os-accent-ink shadow-[0_0_26px_-6px_rgb(var(--os-accent)/0.85)] transition-transform hover:scale-105",
              needsTap && !playing && "animate-pulse",
            )}
          >
            {playing ? <Pause size={17} aria-hidden /> : <Play size={17} className="ml-0.5" aria-hidden />}
          </button>
          <button type="button" aria-label="Next" className="text-os-faint transition-colors hover:text-os-ink-heading">
            <SkipForward size={17} strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

type Stat = { k: string; v: string };
/** Discord-style "in action" card used for the Protection / Support slides. */
function DemoCard({ icon: Icon, title, body, stats }: { icon: LucideIcon; title: string; body: string; stats: Stat[] }) {
  return (
    <div className="relative overflow-hidden rounded-[26px] border border-os-ink-line bg-gradient-to-b from-os-ink-2/85 to-os-ink/85 p-6 shadow-[inset_0_1px_0_rgb(var(--os-ink-heading)/0.1),0_30px_70px_-30px_rgb(0_0_0/0.85)] backdrop-blur-sm sm:p-7">
      <div aria-hidden className="pointer-events-none absolute -top-20 left-1/2 h-44 w-44 -translate-x-1/2 rounded-full bg-os-accent/15 blur-3xl" />
      <div className="relative flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-os-accent text-os-accent-ink">
          <Icon size={15} strokeWidth={2} aria-hidden />
        </span>
        <span className="font-display text-[13px] font-bold tracking-[-0.01em] text-os-ink-heading">Oversite</span>
        <span className="rounded bg-os-accent/20 px-1.5 py-0.5 font-label text-[8px] font-bold uppercase tracking-[0.12em] text-os-accent">App</span>
        <span className="ml-auto font-label text-[9px] uppercase tracking-[0.12em] text-os-faint">now</span>
      </div>
      <div className="relative mt-5 border-l-2 border-os-accent/70 pl-4">
        <p className="font-display text-[16px] font-bold tracking-[-0.01em] text-os-ink-heading">{title}</p>
        <p className="mt-1 font-body text-[13px] leading-relaxed text-os-ink-body">{body}</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {stats.map((s) => (
            <div key={s.k} className="rounded-lg border border-os-ink-line/60 bg-os-ink-2/60 px-3 py-2.5">
              <div className="font-display text-[18px] font-bold leading-none text-os-ink-heading">{s.v}</div>
              <Mono className="mt-1 block text-os-faint">{s.k}</Mono>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SlideText({ label, title, desc, cta }: { label?: string; title: React.ReactNode; desc: string; cta: { label: string; to: string } }) {
  return (
    <div>
      {label && <Mono className="text-os-accent">{label}</Mono>}
      <h2 className={cn("font-display text-[clamp(2.2rem,6vw,5rem)] font-extrabold uppercase leading-[0.9] tracking-[-0.02em] text-os-ink-heading", label && "mt-3")}>
        {title}
      </h2>
      <p className="mt-6 max-w-[48ch] font-body text-[15px] leading-relaxed text-os-ink-body">{desc}</p>
      <Link to={cta.to} className="group mt-7 inline-flex items-center gap-3">
        <span className="font-label text-[12px] font-bold uppercase tracking-[0.14em] text-os-ink-heading">{cta.label}</span>
        <ArrowRight size={16} className="text-os-accent transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
      </Link>
    </div>
  );
}

// Each slide clips its own overflow so an off-screen slide's card shadow
// can't bleed across into the visible slide's edge; the vertical padding
// keeps each card's own drop shadow from being cut.
const SLIDE_GRID = "grid w-full shrink-0 grid-cols-1 items-center gap-10 overflow-hidden py-10 lg:grid-cols-12";
const COUNT = 3;

export function RadioFeature() {
  const [slide, setSlide] = useState(0);
  const go = (d: number) => setSlide((s) => (s + d + COUNT) % COUNT);
  const sectionRef = useRef<HTMLElement>(null);
  // Live station audio: fades in as this section approaches the viewport
  // center, fades out on the way past — and only while the Radio slide is up.
  const { playing, needsTap, toggle } = useProximityRadio(sectionRef, slide === 0);
  const arrow =
    "absolute top-1/2 z-20 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full border border-os-ink-line bg-os-ink-2/70 text-os-ink-body backdrop-blur-sm transition-colors hover:border-os-accent hover:text-os-accent";

  return (
    <section ref={sectionRef} id="radio" className="relative mt-28 flex min-h-[100svh] flex-col justify-center overflow-hidden bg-os-ink py-20 md:mt-40 md:py-28">
      <button type="button" aria-label="Previous" onClick={() => go(-1)} className={cn(arrow, "left-3 md:left-12")}>
        <ChevronLeft size={20} aria-hidden />
      </button>
      <button type="button" aria-label="Next" onClick={() => go(1)} className={cn(arrow, "right-3 md:right-12")}>
        <ChevronRight size={20} aria-hidden />
      </button>

      <Container className="relative px-14 md:px-20">
        <div className="overflow-hidden">
          <div
            className="flex transition-transform duration-500 ease-[cubic-bezier(0.5,0,0.2,1)]"
            style={{ transform: `translateX(-${slide * 100}%)` }}
          >
            {/* slide 1 — Utilities / Radio */}
            <div className={SLIDE_GRID}>
              <div className="lg:col-span-7">
                <SlideText
                  title={<>When it gets loud,<br />everything else <span className="text-os-faint">goes quiet.</span></>}
                  desc="Built into the Utilities bot: a live station with a real AI DJ that talks, reads the room, and never repeats a line. Designed for nonstop 24/7 streaming."
                  cta={{ label: "Explore Utilities", to: "/bots" }}
                />
              </div>
              <div className="lg:col-span-5"><NowPlayingPanel playing={playing} needsTap={needsTap} onToggle={toggle} /></div>
            </div>

            {/* slide 2 — Protection */}
            <div className={SLIDE_GRID}>
              <div className="lg:col-span-7">
                <SlideText
                  label="Protection"
                  title="Raids stop at the door."
                  desc="Auto-moderation, verification and a real-time threat shield catch join spikes and quarantine bad actors before they ever reach your members."
                  cta={{ label: "Explore Protection", to: "/bots" }}
                />
              </div>
              <div className="lg:col-span-5">
                <DemoCard
                  icon={Shield}
                  title="Raid blocked"
                  body="Spike detected — joins quarantined and reviewed automatically."
                  stats={[{ k: "Accounts denied", v: "14" }, { k: "Members protected", v: "1,204" }]}
                />
              </div>
            </div>

            {/* slide 3 — Support */}
            <div className={SLIDE_GRID}>
              <div className="lg:col-span-7">
                <SlideText
                  label="Support"
                  title="Every ticket, handled."
                  desc="Routing, transcripts and staff tools turn the chaos into clean tickets — so nothing slips through and every answer stays on record."
                  cta={{ label: "Explore Support", to: "/bots" }}
                />
              </div>
              <div className="lg:col-span-5">
                <DemoCard
                  icon={LifeBuoy}
                  title="Ticket #0294 opened"
                  body="Routed to @staff · transcript saved automatically."
                  stats={[{ k: "Open tickets", v: "06" }, { k: "Avg. first reply", v: "2m" }]}
                />
              </div>
            </div>
          </div>
        </div>

        {/* slide dots */}
        <div className="mt-12 flex justify-center gap-2">
          {Array.from({ length: COUNT }).map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              aria-current={slide === i}
              onClick={() => setSlide(i)}
              className={cn("h-2 rounded-full transition-all duration-300", slide === i ? "w-6 bg-os-accent" : "w-2 bg-os-ink-line hover:bg-os-ink-body")}
            />
          ))}
        </div>
      </Container>
    </section>
  );
}
