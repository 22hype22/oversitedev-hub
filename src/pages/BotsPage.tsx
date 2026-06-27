import { Shield, LifeBuoy, Wrench, Check, Sparkles, type LucideIcon } from "lucide-react";
import { SiteNav } from "@/components/marketing/SiteNav";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { Container, Mono, Reveal, AccentButton, ArrowLink } from "@/components/marketing/primitives";
import { BotForge } from "@/components/marketing/BotForge";
import { PageNav } from "@/components/marketing/PageNav";
import { cn } from "@/lib/utils";

import containers from "@/assets/containers.webp";
import protectionArt from "@/assets/banner-protection.png";
import supportArt from "@/assets/banner-support.png";
import utilitiesArt from "@/assets/banner-utilities.png";

type Bot = {
  id: string;
  icon: LucideIcon;
  kicker: string;
  name: string;
  line: string;
  included: string[];
  price: number;
  oldPrice: number;
  art: string;
};

const BOTS: Bot[] = [
  {
    id: "protection",
    icon: Shield,
    kicker: "Protection",
    name: "Oversite Protection",
    line: "Automod, anti-raid, verification, and a full moderation arsenal — the wall your server stands behind.",
    included: ["Verification system", "Warn · mute · ban · kick", "Anti-spam & anti-raid", "Phishing link detection"],
    price: 99,
    oldPrice: 149,
    art: protectionArt,
  },
  {
    id: "support",
    icon: LifeBuoy,
    kicker: "Support",
    name: "Oversite Support",
    line: "Tickets, appeals, reports, and welcomes — a real support desk running quietly inside your server.",
    included: ["Ticket system, unlimited categories", "Claim system", "Ban appeals & member reports", "Welcome / goodbye messages"],
    price: 99,
    oldPrice: 149,
    art: supportArt,
  },
  {
    id: "utilities",
    icon: Wrench,
    kicker: "Utilities",
    name: "Oversite Utilities",
    line: "Announcements, roles, Roblox, music and the long tail of everyday tools — everything in between.",
    included: ["/say and /announce", "Reaction roles & autorole", "Roblox integration", "Music, polls, 8ball & more"],
    price: 99,
    oldPrice: 149,
    art: utilitiesArt,
  },
];

/** Dimmed container-yard backdrop + accent glow, kept dark for legibility. */
function BotsBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <img src={containers} alt="" className="absolute inset-0 h-full w-full select-none object-cover opacity-[0.16]" />
      <div className="absolute inset-0 bg-[radial-gradient(75%_55%_at_50%_-8%,rgb(var(--os-accent)/0.10),transparent_60%)]" />
      <div className="absolute inset-0 bg-os-bg/82" />
    </div>
  );
}

const SHADOW = "[text-shadow:0_2px_24px_rgb(var(--os-ink)/0.85)]";

function BotSpotlight({ bot, flip }: { bot: Bot; flip: boolean }) {
  const Icon = bot.icon;
  return (
    <Reveal className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      {/* art */}
      <div className={cn("relative", flip && "lg:order-2")}>
        <div className="relative overflow-hidden rounded-[26px] border border-os-hairline/40 bg-os-surface/30 backdrop-blur-sm">
          <div aria-hidden className="pointer-events-none absolute -inset-10 bg-[radial-gradient(60%_60%_at_50%_30%,rgb(var(--os-accent)/0.14),transparent_70%)]" />
          <div className="relative grid aspect-[5/4] place-items-center p-8">
            <img src={bot.art} alt={`${bot.name} emblem`} className="max-h-full w-auto max-w-[78%] object-contain drop-shadow-[0_18px_40px_rgb(0_0_0/0.55)]" />
          </div>
          <span className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full border border-os-hairline/50 bg-os-bg/60 px-3 py-1 font-label text-[10px] uppercase tracking-[0.16em] text-os-body backdrop-blur-sm">
            <Icon size={12} className="text-os-accent" aria-hidden />
            {bot.kicker}
          </span>
        </div>
      </div>

      {/* copy */}
      <div className={cn(flip && "lg:order-1")}>
        <Mono className="text-os-accent">Bot {String(BOTS.indexOf(bot) + 1).padStart(2, "0")}</Mono>
        <h3 className="mt-3 font-display text-[clamp(2rem,4.5vw,3.2rem)] font-bold leading-[0.95] tracking-[-0.02em] text-os-heading">
          {bot.name}
        </h3>
        <p className="mt-4 max-w-[46ch] font-body text-[15.5px] leading-relaxed text-os-body">{bot.line}</p>

        <ul className="mt-6 grid max-w-[460px] grid-cols-1 gap-2.5 sm:grid-cols-2">
          {bot.included.map((f) => (
            <li key={f} className="flex items-start gap-2.5 font-body text-[13px] leading-snug text-os-body">
              <Check size={15} className="mt-0.5 flex-none text-os-accent" aria-hidden />
              {f}
            </li>
          ))}
        </ul>

        <div className="mt-7 flex flex-wrap items-center gap-4">
          <div className="flex items-baseline gap-2.5">
            <span className="font-body text-[15px] text-os-faint line-through">${bot.oldPrice}</span>
            <span className="font-display text-[26px] font-bold tracking-[-0.01em] text-os-heading">${bot.price}</span>
            <span className="font-label text-[11px] uppercase tracking-[0.14em] text-os-faint">one-time</span>
          </div>
          <span className="rounded-full border border-os-accent/40 bg-os-accent/10 px-2.5 py-1 font-label text-[10px] font-bold uppercase tracking-[0.12em] text-os-accent">
            Preorder sale
          </span>
        </div>
      </div>
    </Reveal>
  );
}

const BotsPage = () => (
  <div className="oversite-theme relative min-h-screen bg-os-bg font-body text-os-body antialiased">
    <BotsBackdrop />
    <SiteNav />

    <main className="relative z-10">
      {/* hero */}
      <section className="flex min-h-[88svh] items-center px-5 pt-28 md:px-8">
        <Container>
          <Reveal className="flex max-w-[64ch] flex-col items-start gap-5">
            <Mono className={`text-os-accent ${SHADOW}`}>The Oversite fleet</Mono>
            <h1 className={`font-display text-[clamp(2.8rem,8vw,6rem)] font-extrabold uppercase leading-[0.9] tracking-[-0.02em] text-os-heading ${SHADOW}`}>
              Three bots,<br />one server.
            </h1>
            <p className={`max-w-[54ch] font-body text-[16px] leading-relaxed text-os-body ${SHADOW}`}>
              Protection, Support, and Utilities — purpose-built to work as one. Pick a base,
              shape its identity, stack the add-ons you want, and we deploy it managed and online.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-5">
              <AccentButton href="#build">Build your bot</AccentButton>
              <ArrowLink href="#fleet" className={SHADOW}>Meet the fleet</ArrowLink>
            </div>
          </Reveal>
        </Container>
      </section>

      {/* fleet — alternating spotlights */}
      <section id="fleet" data-page="0" className="px-5 py-10 md:px-8">
        <Container className="space-y-24 md:space-y-32">
          {BOTS.map((bot, i) => (
            <BotSpotlight key={bot.id} bot={bot} flip={i % 2 === 1} />
          ))}
        </Container>
      </section>

      {/* all-in-one callout */}
      <section className="px-5 py-16 md:px-8">
        <Container>
          <Reveal className="relative overflow-hidden rounded-[26px] border border-os-accent/30 bg-os-ink/70 p-8 backdrop-blur-sm sm:p-12">
            <div aria-hidden className="pointer-events-none absolute -top-20 right-0 h-56 w-[26rem] max-w-[70%] rounded-full bg-os-accent/12 blur-3xl" />
            <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="max-w-[52ch]">
                <div className="flex items-center gap-2.5">
                  <Sparkles size={16} className="text-os-accent" aria-hidden />
                  <Mono className="text-os-accent">Bundle &amp; save</Mono>
                </div>
                <h2 className="mt-3 font-display text-[clamp(1.7rem,3.6vw,2.6rem)] font-bold leading-[0.98] tracking-[-0.02em] text-os-heading">
                  Any two bots for $149. All three in one for $199.
                </h2>
                <p className="mt-3 font-body text-[15px] leading-relaxed text-os-body">
                  Mix and match — protection, support, or utilities, same price whichever two you pick.
                  Or grab the All-in-One Pack and ship the whole fleet as three focused bots.
                </p>
              </div>
              <AccentButton href="#build" className="flex-none">Start building</AccentButton>
            </div>
          </Reveal>
        </Container>
      </section>

      {/* the builder — real purchase flow, re-themed */}
      <section data-page="1" className="px-5 pb-24 md:px-8">
        <Container>
          <BotForge />
        </Container>
      </section>
    </main>

    <PageNav />
    <SiteFooter />
  </div>
);

export default BotsPage;
