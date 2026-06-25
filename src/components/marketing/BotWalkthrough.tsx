import { Link } from "react-router-dom";
import { Shield, LifeBuoy, Wrench, Sparkles, Siren, Check, ArrowRight, type LucideIcon } from "lucide-react";
import { Container, Mono, Reveal } from "./primitives";
import { cn } from "@/lib/utils";

type Stat = { k: string; v: string };
type Bot = {
  name: string;
  icon: LucideIcon;
  line: string;
  features: string[];
  embed: { title: string; body: string; stats: Stat[] };
  comingSoon?: boolean;
};

const BOTS: Bot[] = [
  {
    name: "Protection",
    icon: Shield,
    line: "Stops raids before they ever land — auto-moderation, verification and a real-time threat shield, always on.",
    features: [
      "Anti-raid + auto-mod",
      "Verification gate",
      "Warn / mute / ban / kick",
      "Phishing link detection",
      "Mod logs + audit trail",
      "Moderation history + notes",
    ],
    embed: {
      title: "Raid blocked",
      body: "Spike detected — joins quarantined and reviewed.",
      stats: [{ k: "Accounts denied", v: "14" }, { k: "Members protected", v: "1,204" }],
    },
  },
  {
    name: "Support",
    icon: LifeBuoy,
    line: "Turns the chaos into clean tickets — routing, transcripts and staff tools so nothing slips through.",
    features: [
      "Ticket routing",
      "Searchable transcripts",
      "Claim + add/remove members",
      "Ban appeals + reports",
      "Priority flagging",
      "Welcome / goodbye messages",
    ],
    embed: {
      title: "Ticket #0294 opened",
      body: "Routed to @staff · transcript saved automatically.",
      stats: [{ k: "Open tickets", v: "06" }, { k: "Avg. first reply", v: "2m" }],
    },
  },
  {
    name: "Utilities",
    icon: Wrench,
    line: "Everything else your server runs on — leveling, giveaways, live AI radio and the stats that keep it moving.",
    features: [
      "Leveling + economy",
      "Giveaways + starboard",
      "Oversite Radio — auto-DJ",
      "Server stats channels",
      "Reaction roles + autorole",
      "Twitch / YouTube alerts",
    ],
    embed: {
      title: "Level up — Lv. 12",
      body: "@member hit a new rank and earned a role reward.",
      stats: [{ k: "XP earned", v: "+250" }, { k: "On air", v: "Radio" }],
    },
  },
  {
    name: "All-in-One",
    icon: Sparkles,
    line: "Protection, Support and Utilities fused into a single bot — every base your server needs, one install.",
    features: [
      "Everything in Protection",
      "Everything in Support",
      "Everything in Utilities",
      "One bot, one dashboard",
      "Custom branding ready",
      "Multi-server license",
    ],
    embed: {
      title: "All systems online",
      body: "Three toolkits, one deploy — running zero-downtime updates.",
      stats: [{ k: "Modules", v: "All" }, { k: "Downtime", v: "0s" }],
    },
  },
  {
    name: "ERLC",
    icon: Siren,
    line: "Emergency Response: Liberty County tools — sessions, in-game moderation and live server stats. Landing soon.",
    features: [
      "Session pings",
      "In-game moderation",
      "Message-to-game linking",
      "Department roles",
      "Player tools",
      "Server stats",
    ],
    embed: {
      title: "Session monitor",
      body: "Liberty County integration — available soon.",
      stats: [{ k: "Status", v: "Soon" }, { k: "Waitlist", v: "Open" }],
    },
    comingSoon: true,
  },
];

function Embed({ bot }: { bot: Bot }) {
  const Icon = bot.icon;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-os-hairline/40 bg-os-ink/55 p-5 shadow-[0_24px_60px_-28px_rgb(0_0_0/0.75)] backdrop-blur-sm sm:p-6">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-os-accent text-os-accent-ink">
          <Icon size={15} strokeWidth={2} aria-hidden />
        </span>
        <span className="font-display text-[13px] font-bold tracking-[-0.01em] text-os-heading">Oversite</span>
        <span className="rounded bg-os-accent/20 px-1.5 py-0.5 font-label text-[8px] font-bold uppercase tracking-[0.12em] text-os-accent">App</span>
        {!bot.comingSoon && (
          <span className="ml-auto font-label text-[9px] uppercase tracking-[0.12em] text-os-faint">now</span>
        )}
      </div>

      <div className="mt-4 border-l-2 border-os-accent/70 pl-4">
        <p className="font-display text-[15px] font-bold tracking-[-0.01em] text-os-heading">{bot.embed.title}</p>
        <p className="mt-1 font-body text-[13px] leading-relaxed text-os-ink-body">{bot.embed.body}</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {bot.embed.stats.map((s) => (
            <div key={s.k} className="rounded-lg border border-os-hairline/30 bg-os-ink-2/60 px-3 py-2.5">
              <div className="font-display text-[18px] font-bold leading-none text-os-heading">{s.v}</div>
              <Mono className="mt-1 block text-os-faint">{s.k}</Mono>
            </div>
          ))}
        </div>
      </div>

      {bot.comingSoon && (
        <span className="absolute right-5 top-5 rounded-full border border-os-accent/40 px-2.5 py-1 font-label text-[9px] font-bold uppercase tracking-[0.16em] text-os-accent">
          Coming soon
        </span>
      )}
    </div>
  );
}

function Spotlight({ bot, flip }: { bot: Bot; flip?: boolean }) {
  return (
    <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14">
      <div className={cn(flip && "lg:order-2")}>
        <h3 className="font-display text-[clamp(2.4rem,5.5vw,4rem)] font-bold leading-[0.92] tracking-[-0.02em] text-os-heading [text-shadow:0_2px_28px_rgb(var(--os-ink)/0.85)]">
          {bot.name}
          {bot.comingSoon && (
            <span className="ml-3 align-middle font-label text-[11px] font-bold uppercase tracking-[0.18em] text-os-accent">Soon</span>
          )}
        </h3>
        <p className="mt-4 max-w-[46ch] font-body text-[15.5px] leading-relaxed text-os-body [text-shadow:0_1px_16px_rgb(var(--os-ink)/0.85)]">
          {bot.line}
        </p>

        <ul className="mt-7 grid max-w-[460px] grid-cols-2 gap-x-6 gap-y-3">
          {bot.features.map((f) => (
            <li key={f} className="flex items-center gap-2.5 font-label text-[11px] uppercase tracking-[0.12em] text-os-body [text-shadow:0_1px_12px_rgb(var(--os-ink)/0.85)]">
              <Check size={14} strokeWidth={2.5} className="flex-none text-os-accent" aria-hidden />
              {f}
            </li>
          ))}
        </ul>

        {bot.comingSoon ? (
          <span className="mt-10 inline-flex cursor-default items-center gap-2 border border-os-hairline/50 px-8 py-4 font-label text-[12px] font-bold uppercase tracking-[0.14em] text-os-faint">
            Coming soon
          </span>
        ) : (
          <Link
            to="/bots"
            className="group mt-9 inline-flex items-center gap-2.5 border border-os-accent/70 px-7 py-3.5 font-label text-[12px] font-bold uppercase tracking-[0.14em] text-os-accent transition hover:bg-os-accent hover:text-os-accent-ink"
          >
            Explore {bot.name}
            <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
          </Link>
        )}
      </div>

      <div className={cn(flip && "lg:order-1")}>
        <Embed bot={bot} />
      </div>
    </div>
  );
}

export function BotWalkthrough() {
  return (
    <section id="inventory" className="mt-28 pb-24 pt-24 md:mt-40 md:pb-32 md:pt-28">
      <Container>
        <Reveal className="flex flex-col items-start gap-4">
          <h2 className="max-w-[16ch] font-display text-[40px] font-bold leading-[0.92] tracking-[-0.02em] text-os-heading [text-shadow:0_2px_28px_rgb(var(--os-ink)/0.8)] sm:text-[64px]">
            Your fleet, one command
          </h2>
          <p className="max-w-[54ch] font-body text-[15px] leading-relaxed text-os-body [text-shadow:0_1px_16px_rgb(var(--os-ink)/0.85)]">
            Run one bot, mix two, or grab the All-in-One Pack to bundle every base.
            Each one deploys in minutes from a single dashboard.
          </p>
        </Reveal>

        <div className="mt-16 flex flex-col gap-20 md:gap-28">
          {BOTS.map((bot, i) => (
            <Reveal key={bot.name} delayMs={60}>
              <Spotlight bot={bot} flip={i % 2 === 1} />
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
