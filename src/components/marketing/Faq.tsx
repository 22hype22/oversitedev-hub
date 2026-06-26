import { useState } from "react";
import { Plus } from "lucide-react";
import { Container, Mono, Reveal } from "./primitives";
import { cn } from "@/lib/utils";

const ITEMS = [
  { q: "Do I have to host anything myself?", a: "No. Every bot runs on Oversite's infrastructure. There's no VPS to rent, no process to keep alive, and no token to babysit — you connect your server and we run it." },
  { q: "How fast can I get set up?", a: "Minutes. Authorize the bots, choose what you want enabled, and our auto-deploy pipeline has you live in under sixty seconds — all from the dashboard." },
  { q: "Can my moderators and staff get access?", a: "Yes. Invite your staff, assign roles to control what they can touch, and every change is written to an audit log so nothing happens off the record." },
  { q: "What happens if I cancel?", a: "Cancel anytime. Your bots keep running until the end of the billing period, and your configuration is preserved in case you come back." },
  { q: "Do my settings survive updates and restarts?", a: "Yes. Your configuration is saved and reloads automatically, so updates and restarts never wipe your setup — everything stays exactly where you left it." },
  { q: "Do I have to use everything at once?", a: "No. Turn on only what your server needs and add the rest whenever you're ready — the platform scales with you, not the other way around." },
  { q: "Is my server's data kept separate from other customers?", a: "Yes. Every server's configuration and data is isolated, and access is permission-gated — nothing you set up is visible to anyone outside your authorized team." },
  { q: "Do I need to be technical to run it?", a: "No. Everything is managed from one visual dashboard — toggle features, fill in settings, and changes apply live with no code, config files, or restarts." },
  { q: "Will my setup keep working as you release updates?", a: "Yes. Updates roll out without downtime or resets — your bots keep running and your configuration carries straight through every release." },
  { q: "How is everything managed?", a: "From a single dashboard. You configure every bot, your team, and all your settings in one place, with changes applying live across your server." },
];

const INITIAL = 5;

function Row({ q, a, n }: { q: string; a: string; n: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border bg-os-bg/55 shadow-[inset_0_1px_0_rgb(var(--os-heading)/0.06),0_18px_50px_-30px_rgb(0_0_0/0.7)] backdrop-blur-sm transition-colors",
        open ? "border-os-accent/45" : "border-os-hairline/50 hover:border-os-hairline",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-5 px-5 py-5 text-left sm:px-6"
      >
        <span className="flex items-baseline gap-4">
          <Mono className="text-os-accent">{n}</Mono>
          <span className="font-display text-[16.5px] font-bold uppercase tracking-[0.01em] text-os-heading sm:text-[19px]">{q}</span>
        </span>
        <span
          className={cn(
            "grid h-8 w-8 flex-none place-items-center rounded-full border transition-all duration-300",
            open ? "rotate-45 border-os-accent bg-os-accent text-os-accent-ink" : "border-os-hairline/60 text-os-faint",
          )}
        >
          <Plus size={16} strokeWidth={2.5} aria-hidden />
        </span>
      </button>
      <div className={cn("grid transition-all duration-300 ease-out", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
        <div className="overflow-hidden">
          <p className="max-w-[680px] px-5 pb-6 font-body text-[14.5px] leading-relaxed text-os-body sm:px-6 sm:pl-[60px]">{a}</p>
        </div>
      </div>
    </div>
  );
}

export function Faq() {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? ITEMS : ITEMS.slice(0, INITIAL);
  return (
    <section id="faq" className="mt-24 pt-24 md:mt-32 md:pt-28">
      <Container>
        <Reveal className="mx-auto flex max-w-[640px] flex-col items-center gap-4 text-center">
          <h2 className="font-display text-[clamp(2.4rem,6vw,4rem)] font-extrabold uppercase leading-[0.9] tracking-[-0.02em] text-os-heading [text-shadow:0_2px_28px_rgb(var(--os-ink)/0.8)]">
            Frequently asked
          </h2>
          <p className="max-w-[46ch] font-body text-[15px] leading-relaxed text-os-body [text-shadow:0_1px_16px_rgb(var(--os-ink)/0.85)]">
            Everything worth knowing before you deploy. Still curious? Open a ticket
            in the Discord and we&apos;ll sort you out.
          </p>
        </Reveal>

        <div className="mx-auto mt-12 grid max-w-[760px] gap-3">
          {visible.map((it, i) => (
            <Reveal key={it.q} delayMs={i >= INITIAL ? 0 : i * 50}>
              <Row n={String(ITEMS.indexOf(it) + 1).padStart(2, "0")} {...it} />
            </Reveal>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
          className="group mx-auto mt-9 flex w-full max-w-[760px] items-center gap-5"
        >
          <span className="h-px flex-1 bg-os-accent/35 transition-colors group-hover:bg-os-accent/70" />
          <span className="font-label text-[11px] font-bold uppercase tracking-[0.24em] text-os-accent transition-opacity group-hover:opacity-80">
            {showAll ? "Show less" : "Show more"}
          </span>
          <span className="h-px flex-1 bg-os-accent/35 transition-colors group-hover:bg-os-accent/70" />
        </button>
      </Container>
    </section>
  );
}
