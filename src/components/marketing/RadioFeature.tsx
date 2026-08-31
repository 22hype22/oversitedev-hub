import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Play, Pause, ArrowRight, SkipBack, SkipForward, Radio, ChevronLeft, ChevronRight, Shield, LifeBuoy, type LucideIcon } from "lucide-react";
import { Container, Mono } from "./primitives";
import { usePrefersReducedMotion } from "./hooks";
import { cn } from "@/lib/utils";

// ───────────────────────── Proximity radio ─────────────────────────
// Real ambient audio for the radio slide: as the visitor scrolls toward this
// section the station fades in, fades back out on the way past, and fades
// out/in when the carousel is flipped off/onto the Radio slide.
//
// Autoplay reality: browsers refuse audible playback until the visitor has
// interacted with the page (a wheel/trackpad scroll does NOT count). So the
// element loops MUTED from shortly after load — always warm — and we grab the
// earliest legal moment to make it audible: repeated attempts near the
// section, plus every kind of interaction event (including wheel/scroll, for
// browsers whose policy already allows it). If everything is refused, the
// card's play button pulses and one tap starts it.
//
// Volume rides a Web Audio GainNode (not element.volume) so the fade also
// works on iOS, where media-element volume is read-only.
// Swap the track by replacing public/radio-loop.mp3.
const RADIO_SRC = "/radio-loop.mp3";
const RADIO_MAX_VOL = 0.4;

function useProximityRadio(sectionRef: React.RefObject<HTMLElement>, slideActive: boolean) {
  const [playing, setPlaying] = useState(false); // station audibly on
  const [needsTap, setNeedsTap] = useState(false); // every auto-start refused → invite a tap
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const runningRef = useRef(false); // audio is audible-capable (unmuted + ctx running)
  const userMutedRef = useRef(false); // explicit pause — stop auto-starting
  const proxRef = useRef(0);
  const lastTryRef = useRef(0);
  const slideRef = useRef(slideActive);
  slideRef.current = slideActive;

  const ensureGraph = () => {
    if (!audioRef.current) {
      const a = new Audio(RADIO_SRC);
      a.loop = true;
      a.preload = "auto";
      // Warm silent loop: muted autoplay is always allowed, so the element is
      // already playing when permission to be audible finally arrives — the
      // start is then just an unmute, never a fresh (refusable) play().
      a.muted = true;
      a.play().catch(() => { /* will start on the first attempt below */ });
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
    const target = !userMutedRef.current && slideRef.current ? Math.pow(proxRef.current, 1.6) * RADIO_MAX_VOL : 0;
    const ctx = ctxRef.current;
    const gain = gainRef.current;
    if (ctx && gain) gain.gain.setTargetAtTime(target, ctx.currentTime, 0.45);
    else try { a.volume = target; } catch { /* iOS read-only volume */ }
  };

  /** Attempt to make the station audible. Safe to call often — it no-ops once
   * running and quietly restores the warm muted loop on refusal. */
  const tryStart = async (): Promise<boolean> => {
    if (runningRef.current || userMutedRef.current) return runningRef.current;
    ensureGraph();
    const a = audioRef.current!;
    const ctx = ctxRef.current;
    try {
      a.muted = false;
      const played = a.paused ? a.play() : Promise.resolve();
      if (ctx && ctx.state !== "running") await ctx.resume();
      await played;
      if (ctx && ctx.state !== "running") throw new Error("suspended");
      if (a.paused) throw new Error("paused");
      runningRef.current = true;
      setPlaying(true);
      setNeedsTap(false);
      applyVolume();
      return true;
    } catch {
      // Refused — go back to the warm silent loop and wait for the next chance.
      a.muted = true;
      if (a.paused) a.play().catch(() => { /* still locked */ });
      return false;
    }
  };

  const toggle = () => {
    if (playing) {
      // Explicit off: fade to silence and stay off until tapped again.
      userMutedRef.current = true;
      setPlaying(false);
      applyVolume();
    } else {
      userMutedRef.current = false;
      if (runningRef.current) {
        setPlaying(true);
        applyVolume();
      } else {
        void tryStart();
      }
    }
  };

  // Scroll/resize → proximity of the section's center to the viewport's
  // center (1 when centered, 0 a full viewport away), rAF-throttled. While the
  // section is near, keep re-attempting the start about once a second.
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
      const now = Date.now();
      if (!runningRef.current && !userMutedRef.current && slideRef.current && proxRef.current > 0.2 && now - lastTryRef.current > 1000) {
        lastTryRef.current = now;
        void tryStart().then((ok) => { if (!ok && proxRef.current > 0.3) setNeedsTap(true); });
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

  // Any interaction anywhere unlocks the station at the earliest legal moment
  // (kept at gain 0 unless the section is near). Wheel/scroll are included for
  // browsers whose policy already permits audio — where they don't, the
  // attempt is a harmless no-op.
  useEffect(() => {
    const events = ["pointerdown", "mousedown", "keydown", "touchstart", "touchend", "click", "wheel"] as const;
    const unlock = () => {
      if (runningRef.current || userMutedRef.current) { cleanup(); return; }
      void tryStart().then((ok) => { if (ok) cleanup(); });
    };
    const cleanup = () => events.forEach((e) => window.removeEventListener(e, unlock));
    events.forEach((e) => window.addEventListener(e, unlock, { passive: true }));
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Boot the warm muted loop shortly after load (off the critical path), so
  // the track is downloaded and looping before anyone reaches the section.
  useEffect(() => {
    const t = setTimeout(ensureGraph, 3500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Carousel flips → refade immediately (out when leaving the Radio slide,
  // back in when returning to it).
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
                  desc="Routing, transcripts and staff tools turn the chaos into clean tickets, so nothing slips through and every answer stays on record."
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
