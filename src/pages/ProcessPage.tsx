import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Link2, SlidersHorizontal, Rocket, Zap, Activity, TrendingUp, ArrowRight, type LucideIcon } from "lucide-react";
import { SiteNav } from "@/components/marketing/SiteNav";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { FocalTour } from "@/components/marketing/FocalTour";
import { Container, Mono, Reveal, AccentButton } from "@/components/marketing/primitives";
import { cn } from "@/lib/utils";

const SHADOW = "[text-shadow:0_2px_28px_rgb(var(--os-ink)/0.9)]";

type Stat = { k: string; v: string };
type Step = {
  n: string;
  icon: LucideIcon;
  title: string;
  line: string;
  features: string[];
  cta: { label: string; to: string };
  embed: { title: string; body: string; stats: Stat[] };
};

const STEPS: Step[] = [
  {
    n: "01",
    icon: Link2,
    title: "Connect",
    line: "Authorize Oversite and link your server — no tokens to generate, nothing to host, no command line.",
    features: ["One-click authorize", "No bot token", "Nothing to host", "Pick your server"],
    cta: { label: "Get started", to: "/auth" },
    embed: { title: "Server linked", body: "Authorized in two clicks — ready to configure.", stats: [{ k: "Setup time", v: "30s" }, { k: "Tokens", v: "0" }] },
  },
  {
    n: "02",
    icon: SlidersHorizontal,
    title: "Configure",
    line: "Choose your bots and toggle exactly the features you want — all from one visual dashboard.",
    features: ["Toggle features", "Per-bot settings", "Changes apply live", "No config files"],
    cta: { label: "See the dashboard", to: "/auth" },
    embed: { title: "Features enabled", body: "Verification, tickets and leveling switched on.", stats: [{ k: "Modules", v: "12" }, { k: "Restarts", v: "0" }] },
  },
  {
    n: "03",
    icon: Rocket,
    title: "Deploy",
    line: "Our auto-deploy pipeline pushes your setup live in under sixty seconds. No restarts, no downtime.",
    features: ["Auto-deploy", "Under 60 seconds", "Zero downtime", "Instant rollback"],
    cta: { label: "Deploy now", to: "/auth" },
    embed: { title: "Deployed live", body: "Your bots are online and serving your server.", stats: [{ k: "Deploy", v: "47s" }, { k: "Uptime", v: "100%" }] },
  },
  {
    n: "04",
    icon: Zap,
    title: "Automate",
    line: "Moderation, tickets and utilities run themselves around the clock — rules enforce, raids get caught.",
    features: ["Auto-moderation", "Ticket routing", "Scheduled tasks", "Always on"],
    cta: { label: "See the bots", to: "/bots" },
    embed: { title: "Rule triggered", body: "Raid attempt caught and quarantined automatically.", stats: [{ k: "Actions today", v: "318" }, { k: "Time saved", v: "6h" }] },
  },
  {
    n: "05",
    icon: Activity,
    title: "Monitor",
    line: "Watch everything from one place — live logs, server stats and a full audit trail of every change.",
    features: ["Live logs", "Server stats", "Audit trail", "Alerts"],
    cta: { label: "Open dashboard", to: "/dashboard" },
    embed: { title: "All systems green", body: "Every bot healthy — nothing needs your attention.", stats: [{ k: "Health", v: "100%" }, { k: "Open issues", v: "0" }] },
  },
  {
    n: "06",
    icon: TrendingUp,
    title: "Scale",
    line: "Add servers and bots as you grow. Your configuration carries straight through, with zero downtime.",
    features: ["Add servers", "Add bots", "Config carries over", "No downtime"],
    cta: { label: "Get started", to: "/auth" },
    embed: { title: "Server added", body: "New server live with your existing setup applied.", stats: [{ k: "Servers", v: "03" }, { k: "Migrated", v: "Instant" }] },
  },
];

// Node positions on the 0..100 timeline grid — shared by the connector path
// and the numbered node circles so they stay in sync.
const NODE_X = (i: number) => (i % 2 === 1 ? 28 : 72);
const NODE_Y = (i: number) => ((i + 0.5) / STEPS.length) * 100;

// A smooth S-curve through the alternating nodes: each segment leaves its node
// with a vertical tangent, sweeps across, then eases into the next — no hard
// diagonal kinks.
const CONNECTOR_D = STEPS.map((_, i) => {
  const x = NODE_X(i);
  const y = NODE_Y(i);
  if (i === 0) return `M ${x} ${y.toFixed(2)}`;
  const px = NODE_X(i - 1);
  const py = NODE_Y(i - 1);
  const dy = (y - py) * 0.5;
  return `C ${px} ${(py + dy).toFixed(2)} ${x} ${(y - dy).toFixed(2)} ${x} ${y.toFixed(2)}`;
}).join(" ");

function StepText({ step, textRight }: { step: Step; textRight: boolean }) {
  return (
    <Container className="relative">
      <div className={cn("relative z-10 lg:w-[42%]", textRight && "lg:ml-auto lg:text-right")}>
        <h2 className={`font-display text-[clamp(2.4rem,5.5vw,4rem)] font-bold leading-[0.92] tracking-[-0.02em] text-os-heading ${SHADOW}`}>
          {step.title}
        </h2>
        <p className={cn(`mt-4 max-w-[46ch] font-body text-[15.5px] leading-relaxed text-os-body ${SHADOW}`, textRight && "lg:ml-auto")}>{step.line}</p>
        <ul className={cn("mt-7 max-w-[440px] space-y-3 border-os-accent/40", textRight ? "lg:ml-auto lg:border-r lg:pr-5" : "border-l pl-5")}>
          {step.features.map((f) => (
            <li key={f} className={cn(`flex items-center gap-3 font-label text-[11px] uppercase tracking-[0.14em] text-os-body ${SHADOW}`, textRight && "lg:flex-row-reverse")}>
              <span aria-hidden className="h-px w-3.5 flex-none bg-os-accent" />
              {f}
            </li>
          ))}
        </ul>
        <Link
          to={step.cta.to}
          className="group mt-9 inline-flex items-center gap-2.5 border border-os-accent/70 px-7 py-3.5 font-label text-[12px] font-bold uppercase tracking-[0.14em] text-os-accent transition hover:bg-os-accent hover:text-os-accent-ink"
        >
          {step.cta.label}
          <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
        </Link>
      </div>
    </Container>
  );
}

/** Right-rail dot scroll for the eight Process sections; hides the scrollbar. */
function ProcessScroll() {
  const [active, setActive] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("proc-hide-scroll");
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-proc]"));
    setTotal(els.length);
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.proc)); }),
      { rootMargin: "-50% 0px -50% 0px", threshold: 0 },
    );
    els.forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      root.classList.remove("proc-hide-scroll");
    };
  }, []);

  const go = (i: number) => document.querySelector<HTMLElement>(`[data-proc="${i}"]`)?.scrollIntoView({ behavior: "smooth" });
  if (total < 2) return null;

  return (
    <div className="fixed right-5 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-center gap-3.5 md:flex">
      {Array.from({ length: total }).map((_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => go(i)}
          aria-label={`Go to section ${i + 1}`}
          aria-current={active === i}
          className={
            active === i
              ? "h-2.5 w-2.5 rounded-full bg-os-accent ring-2 ring-os-accent/30 transition"
              : "h-2 w-2 rounded-full border border-os-heading/50 transition hover:border-os-heading"
          }
        />
      ))}
    </div>
  );
}

const ProcessPage = () => (
  <div className="oversite-theme relative min-h-screen bg-os-bg font-body text-os-body antialiased">
    <FocalTour />
    <SiteNav />
    <ProcessScroll />

    <main className="relative z-10">
      {/* hero — full view (point 1) */}
      <section data-proc="0" className="flex min-h-[92svh] items-center px-5 md:px-8">
        <Container>
          <Reveal className="flex max-w-[60ch] flex-col items-start gap-5">
            <Mono className={`text-os-accent ${SHADOW}`}>How it works</Mono>
            <h1 className={`font-display text-[clamp(2.8rem,8vw,6rem)] font-extrabold uppercase leading-[0.9] tracking-[-0.02em] text-os-heading ${SHADOW}`}>
              Our process
            </h1>
            <p className={`max-w-[52ch] font-body text-[16px] leading-relaxed text-os-body ${SHADOW}`}>
              From an empty server to fully managed in minutes. Scroll to climb
              through it — each step, one move down the mountain.
            </p>
            <AccentButton to="/auth" className="mt-2">Deploy now</AccentButton>
          </Reveal>
        </Container>
      </section>

      {/* steps — a sloped, zig-zag timeline connecting numbered nodes */}
      <div className="relative">
        {/* the connecting line — a polyline through alternating node positions */}
        <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 z-0 hidden h-full w-full lg:block">
          <path
            d={CONNECTOR_D}
            fill="none"
            stroke="rgb(var(--os-accent))"
            strokeOpacity="0.32"
            strokeWidth="1.25"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {/* nodes, oscillating around centre */}
        {STEPS.map((s, i) => (
          <span
            key={`node-${s.n}`}
            className="absolute z-20 hidden h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-os-accent/60 bg-os-bg/85 font-display text-[14px] font-extrabold text-os-accent shadow-[0_0_30px_-8px_rgb(var(--os-accent)/0.7)] backdrop-blur-sm lg:grid"
            style={{ left: `${NODE_X(i)}%`, top: `${NODE_Y(i).toFixed(2)}%` }}
          >
            {s.n}
          </span>
        ))}
        {STEPS.map((s, i) => (
          <section key={s.n} data-proc={i + 1} className="flex min-h-[82svh] items-center px-5 md:px-8 lg:h-[82svh] lg:min-h-0">
            <Reveal className="w-full">
              <StepText step={s} textRight={i % 2 === 1} />
            </Reveal>
          </section>
        ))}
      </div>

      {/* closing — full view (point 8) */}
      <section data-proc="7" className="flex min-h-[80svh] items-center px-5 pb-24 md:px-8">
        <Container>
          <Reveal className="relative mx-auto max-w-[760px] overflow-hidden rounded-[28px] border border-os-accent/30 bg-os-bg/70 p-10 text-center shadow-[inset_0_1px_0_rgb(var(--os-heading)/0.08),0_30px_80px_-34px_rgb(0_0_0/0.8)] backdrop-blur-sm sm:p-14">
            <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-56 w-[28rem] max-w-[80%] -translate-x-1/2 rounded-full bg-os-accent/12 blur-3xl" />
            <h2 className="relative mx-auto max-w-[18ch] font-display text-[clamp(1.8rem,4.5vw,3rem)] font-extrabold uppercase leading-[0.95] tracking-[-0.02em] text-os-heading">
              Ready in minutes, not weekends
            </h2>
            <p className="relative mx-auto mt-4 max-w-[46ch] font-body text-[15px] leading-relaxed text-os-body">
              Connect your server and let Oversite handle moderation, support and
              utilities — all from one place.
            </p>
            <div className="relative mt-8 flex justify-center">
              <AccentButton to="/auth">Get started</AccentButton>
            </div>
          </Reveal>
        </Container>
      </section>
    </main>

    <SiteFooter />
  </div>
);

export default ProcessPage;
