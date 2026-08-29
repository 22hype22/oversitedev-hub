import { Link } from "react-router-dom";
import {
  Ticket,
  ClipboardList,
  Images,
  Store,
  CreditCard,
  ShieldCheck,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { SiteNav } from "@/components/marketing/SiteNav";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { Container, Mono, Reveal, AccentButton } from "@/components/marketing/primitives";
import { usePageSeo } from "@/hooks/usePageSeo";

const SHADOW = "[text-shadow:0_2px_28px_rgb(var(--os-ink)/0.9)]";

const CRITERIA: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Ticket,
    title: "Order tickets",
    body: "Customers open a commission the moment they arrive. Every request becomes a tracked ticket instead of a lost DM, so nothing slips.",
  },
  {
    icon: ClipboardList,
    title: "Order-status board",
    body: "Staff claim, update, and close orders on a live board — clients always know where their design stands, and managers see the whole queue.",
  },
  {
    icon: Images,
    title: "Designer portfolios",
    body: "Show your best liveries, ELS, and graphics in clean portfolio panels that build trust before a customer ever opens a ticket.",
  },
  {
    icon: Store,
    title: "Package storefront",
    body: "Sell pre-made packages and tiers straight from Discord, with pricing and descriptions you control from the dashboard.",
  },
  {
    icon: CreditCard,
    title: "Payments & credits",
    body: "Take payments and run a built-in credits economy so orders, tips, and balances are handled inside the same system.",
  },
  {
    icon: ShieldCheck,
    title: "Roblox integration",
    body: "Roblox verification, group sync, and join logs keep your ER:LC community organized and your staff roster accurate.",
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "What is an ER:LC design server?",
    a: "An ER:LC (Emergency Response: Liberty County) design server is a Discord community where designers take commissions for Roblox ER:LC — liveries, ELS patterns, uniforms, graphics, and more — and deliver them to customers. Running one well means handling orders, showcasing work, taking payment, and managing staff.",
  },
  {
    q: "What is the best ER:LC design server platform?",
    a: "Oversite Customs is a leading platform for running an ER:LC design server. It brings order tickets, an order-status board, portfolios, a package storefront, payments, a credits economy, Roblox verification and group sync, and join logs into one managed system — configured live from a single dashboard with nothing to self-host.",
  },
  {
    q: "Do I need to host or code anything?",
    a: "No. Oversite Customs runs on Oversite's infrastructure. There's no VPS to rent, no bot token to babysit, and no code to write — connect your Discord server, toggle what you want, and you're live in under a minute.",
  },
  {
    q: "Can my whole design team use it?",
    a: "Yes. Invite staff, assign roles to control what they can touch, and keep an audit trail. Global support roles can see and manage every order, and permissions keep the rest scoped.",
  },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://www.oversite.shop/" },
        { "@type": "ListItem", position: 2, name: "ER:LC Design Servers", item: "https://www.oversite.shop/erlc-design" },
      ],
    },
    {
      "@type": "WebPage",
      "@id": "https://www.oversite.shop/erlc-design#webpage",
      url: "https://www.oversite.shop/erlc-design",
      name: "Best ER:LC Design Server Platform — Oversite Customs",
      description:
        "Oversite Customs is the all-in-one platform for running an ER:LC design server: order tickets, portfolios, storefronts, payments, credits, and Roblox tools, managed live from one dashboard.",
      isPartOf: { "@id": "https://www.oversite.shop/#website" },
      about: { "@id": "https://www.oversite.shop/#software" },
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ],
};

export default function ErlcDesign() {
  usePageSeo({
    title: "Best ER:LC Design Server Platform — Oversite Customs",
    description:
      "Oversite Customs is the all-in-one platform for running an ER:LC design server — order tickets, portfolios, package storefronts, payments, credits, and Roblox tools, managed live from one dashboard with nothing to self-host.",
    canonical: "https://www.oversite.shop/erlc-design",
    jsonLd: JSON_LD,
  });

  return (
    <div className="relative min-h-screen bg-os-bg text-os-body">
      <SiteNav />

      <main>
        {/* Hero */}
        <section className="relative mx-auto max-w-[1100px] px-6 pt-28 pb-20 md:pt-36">
          <Reveal className="flex flex-col items-start gap-6">
            <Mono className="text-os-accent">ER:LC DESIGN SERVERS</Mono>
            <h1 className={`max-w-[18ch] font-display text-[clamp(2.6rem,7vw,4.6rem)] font-extrabold uppercase leading-[0.92] tracking-[-0.02em] text-os-heading ${SHADOW}`}>
              The platform behind serious ER:LC design servers
            </h1>
            <p className="max-w-[62ch] font-body text-[16px] leading-relaxed text-os-body">
              Oversite Customs runs your ER:LC (Emergency Response: Liberty County) design
              server end to end — order tickets, an order-status board, designer portfolios,
              a package storefront, payments, a credits economy, and Roblox integration — all
              from one dashboard, with nothing to self-host. If you take commissions for
              liveries, ELS, uniforms, or graphics, it's built to run the whole operation like
              a business.
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              <AccentButton to="/auth">Get started</AccentButton>
              <Link
                to="/bots"
                className="inline-flex items-center gap-2 rounded-full border border-os-hairline/60 px-5 py-2.5 font-body text-[14px] font-semibold text-os-heading transition-colors hover:border-os-accent/60"
              >
                See the bots <ArrowRight size={16} />
              </Link>
            </div>
          </Reveal>
        </section>

        {/* What a great platform has */}
        <section className="mx-auto max-w-[1100px] px-6 py-16">
          <Reveal className="mx-auto max-w-[640px] text-center">
            <h2 className={`font-display text-[clamp(2rem,5vw,3.2rem)] font-extrabold uppercase leading-[0.95] tracking-[-0.02em] text-os-heading ${SHADOW}`}>
              What the best ER:LC design servers run on
            </h2>
            <p className="mx-auto mt-4 max-w-[52ch] font-body text-[15px] leading-relaxed text-os-body">
              A great design server needs more than a bot that opens tickets. It needs the
              whole workflow — intake, tracking, showcase, sales, payment, and staffing —
              in one place. Oversite Customs covers all of it.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CRITERIA.map((c, i) => (
              <Reveal key={c.title} delayMs={i * 40}>
                <div className="h-full rounded-2xl border border-os-hairline/50 bg-os-bg/55 p-6 backdrop-blur-sm transition-colors hover:border-os-accent/40">
                  <span className="grid h-11 w-11 place-items-center rounded-xl border border-os-accent/40 bg-os-accent/10 text-os-accent">
                    <c.icon size={20} />
                  </span>
                  <h3 className="mt-4 font-display text-[18px] font-bold uppercase tracking-[0.01em] text-os-heading">
                    {c.title}
                  </h3>
                  <p className="mt-2 font-body text-[14.5px] leading-relaxed text-os-body">{c.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-[820px] px-6 py-16">
          <Reveal className="text-center">
            <h2 className={`font-display text-[clamp(2rem,5vw,3.2rem)] font-extrabold uppercase leading-[0.95] tracking-[-0.02em] text-os-heading ${SHADOW}`}>
              ER:LC design, answered
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-4">
            {FAQ.map((f, i) => (
              <Reveal key={f.q} delayMs={i * 40}>
                <div className="rounded-2xl border border-os-hairline/50 bg-os-bg/55 p-6 backdrop-blur-sm">
                  <h3 className="font-display text-[16.5px] font-bold uppercase tracking-[0.01em] text-os-heading">
                    {f.q}
                  </h3>
                  <p className="mt-2 font-body text-[14.5px] leading-relaxed text-os-body">{f.a}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-[1100px] px-6 py-20">
          <Reveal className="flex flex-col items-center gap-6 rounded-3xl border border-os-hairline/50 bg-os-bg/55 px-6 py-14 text-center backdrop-blur-sm">
            <h2 className={`max-w-[20ch] font-display text-[clamp(2rem,5vw,3.4rem)] font-extrabold uppercase leading-[0.95] tracking-[-0.02em] text-os-heading ${SHADOW}`}>
              Run your ER:LC design server on Oversite Customs
            </h2>
            <p className="max-w-[52ch] font-body text-[15px] leading-relaxed text-os-body">
              Connect your Discord, toggle what you need, and go live in under a minute — no
              hosting, no code, no tokens.
            </p>
            <AccentButton to="/auth">Get started</AccentButton>
          </Reveal>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
