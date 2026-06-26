import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

type QA = { q: string; a: string; k?: string };
type Topic = { id: string; label: string; qs: QA[] };

/**
 * Topic-grouped knowledge the assistant answers from — PayPal/Apple-style
 * guided help. Plain data so it's trivial to expand or later feed to an LLM
 * edge function as grounding context.
 */
const TOPICS: Topic[] = [
  {
    id: "start",
    label: "Getting started",
    qs: [
      { q: "How fast can I get set up?", a: "Minutes. Authorize the bots, choose what you want enabled, and the auto-deploy pipeline has you live in under sixty seconds — all from the dashboard.", k: "fast setup quick start install time live" },
      { q: "Do I have to host anything myself?", a: "No — every bot runs on Oversite's infrastructure. No VPS to rent, no process to keep alive, no token to babysit. You connect your server and we run it.", k: "host hosting vps server self infrastructure" },
      { q: "Do I need to be technical?", a: "Not at all. Everything is managed from one visual dashboard — toggle features, fill in settings, and changes apply live with no code, config files, or restarts.", k: "technical code coding beginner easy non-technical" },
      { q: "How is everything managed?", a: "From a single dashboard. You configure every bot, your team, and all your settings in one place, with changes applying live across your server.", k: "manage managed dashboard control where panel" },
    ],
  },
  {
    id: "bots",
    label: "The bots",
    qs: [
      { q: "What bots do you offer?", a: "Three core bots — Protection (anti-raid + moderation), Support (tickets) and Utilities (leveling, giveaways, live radio and more) — plus an All-in-One pack, with ERLC tools coming soon.", k: "bots offer products which what all" },
      { q: "What does Protection do?", a: "Protection is your shield: anti-raid, verification, auto-moderation, phishing detection, logging and a real-time threat shield that quarantines bad actors before they reach your members.", k: "protection raid moderation security anti-raid verify shield" },
      { q: "What does Support do?", a: "Support turns chaos into clean tickets — routing, claim system, searchable transcripts, ban appeals, reports and staff tools so nothing slips through.", k: "support tickets help transcripts appeals reports" },
      { q: "What does Utilities do?", a: "Utilities is everything else your server runs on — leveling, economy, giveaways, reaction roles, server stats, Twitch/YouTube alerts and the live AI radio.", k: "utilities leveling giveaways radio roles stats economy music" },
    ],
  },
  {
    id: "billing",
    label: "Billing & plans",
    qs: [
      { q: "How much does it cost?", a: "You can run a single bot, mix two, or grab the All-in-One pack — so you only pay for what you need. For exact current pricing, open a ticket and the team will walk you through it.", k: "cost price pricing how much plans tiers" },
      { q: "Can I use just one bot?", a: "Yes. Turn on only what your server needs and add the rest whenever you're ready — the platform scales with you, not the other way around.", k: "one bot single only just everything modular" },
      { q: "What happens if I cancel?", a: "Cancel anytime. Your bots keep running until the end of the billing period, and your configuration is preserved in case you come back.", k: "cancel refund billing stop subscription quit" },
    ],
  },
  {
    id: "account",
    label: "Account & data",
    qs: [
      { q: "Can my staff get access?", a: "Yes. Invite your staff, assign roles to control what they can touch, and every change is written to an audit log so nothing happens off the record.", k: "staff mods team access roles permissions audit" },
      { q: "Is my data kept separate?", a: "Yes. Every server's configuration and data is isolated and permission-gated — nothing you set up is visible to anyone outside your authorized team.", k: "data privacy isolated separate secure security" },
      { q: "Do settings survive updates?", a: "Yes. Your configuration is saved and reloads automatically, so updates and restarts never wipe your setup — everything stays exactly where you left it.", k: "settings save survive updates restart persist config reset wipe" },
    ],
  },
];

const FLAT: QA[] = TOPICS.flatMap((t) => t.qs);

const HUMAN_TEXT =
  "No problem — the team can take it from here. Open a ticket in the Discord at .gg/oversite, or email support@oversite.shop and we'll jump in.";

function match(query: string): string {
  const tokens = query.toLowerCase().match(/[a-z]{3,}/g) ?? [];
  let best: QA | null = null;
  let score = 0;
  for (const item of FLAT) {
    const hay = `${item.q} ${item.k ?? ""}`.toLowerCase();
    let s = 0;
    for (const t of tokens) if (hay.includes(t)) s++;
    if (s > score) {
      score = s;
      best = item;
    }
  }
  if (best && score > 0) return best.a;
  return `I'm not sure on that one yet — but I can get you to someone who is. ${HUMAN_TEXT}`;
}

type Msg = { from: "bot" | "user"; text: string };
type Chip = { label: string; run: () => void };

export function HelpLounge({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [chips, setChips] = useState<Chip[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const started = useRef(false);

  const userSay = (text: string) => setMsgs((m) => [...m, { from: "user", text }]);

  const botSay = (text: string, next: Chip[] = []) => {
    setChips([]);
    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      setMsgs((m) => [...m, { from: "bot", text }]);
      setChips(next);
    }, 450);
  };

  const human = () => {
    userSay("Talk to a human");
    botSay(HUMAN_TEXT, [{ label: "Back to topics", run: toTopics }]);
  };

  const toTopics = () => {
    botSay("What can I help you with?", [
      ...TOPICS.map((t) => ({ label: t.label, run: () => openTopic(t) })),
      { label: "Talk to a human", run: human },
    ]);
  };

  const openTopic = (t: Topic) => {
    userSay(t.label);
    botSay(`Sure — here's what people usually ask about ${t.label.toLowerCase()}.`, [
      ...t.qs.map((qa) => ({ label: qa.q, run: () => askQ(qa, t) })),
      { label: "Talk to a human", run: human },
    ]);
  };

  const askQ = (qa: QA, t?: Topic) => {
    userSay(qa.q);
    const related = (t?.qs ?? [])
      .filter((x) => x.q !== qa.q)
      .slice(0, 2)
      .map((x) => ({ label: x.q, run: () => askQ(x, t) }));
    botSay(qa.a, [...related, { label: "Talk to a human", run: human }, { label: "Back to topics", run: toTopics }]);
  };

  const sendText = (text: string) => {
    const q = text.trim();
    if (!q) return;
    setInput("");
    userSay(q);
    botSay(match(q), [{ label: "Back to topics", run: toTopics }, { label: "Talk to a human", run: human }]);
  };

  // Kick off the greeting + topic chips the first time it opens.
  useEffect(() => {
    if (open && !started.current) {
      started.current = true;
      setMsgs([{ from: "bot", text: "Hey — I'm Ovie, the Oversite assistant. What can I help you with?" }]);
      setChips([
        ...TOPICS.map((t) => ({ label: t.label, run: () => openTopic(t) })),
        { label: "Talk to a human", run: human },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => inputRef.current?.focus(), 350);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [open, onClose]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, chips, typing]);

  return createPortal(
    <div className={cn("oversite-theme fixed inset-0 z-[80]", open ? "pointer-events-auto" : "pointer-events-none")} aria-hidden={!open}>
      <div
        onClick={onClose}
        className={cn("absolute inset-0 bg-os-ink/60 transition-opacity duration-300", open ? "opacity-100" : "opacity-0")}
      />

      <aside
        role="dialog"
        aria-label="Help lounge"
        className={cn(
          "absolute inset-y-0 right-0 flex w-full max-w-[440px] flex-col border-l border-os-hairline/40 bg-os-bg shadow-[0_0_80px_-20px_rgb(0_0_0/0.8)] transition-transform duration-300 ease-[cubic-bezier(0.5,0,0.2,1)]",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* header */}
        <div className="flex items-center gap-3 border-b border-os-hairline/40 px-5 py-4">
          <span className="grid h-9 w-9 flex-none place-items-center rounded-xl border border-os-hairline/50 bg-os-surface font-display text-[16px] font-extrabold leading-none text-os-accent">
            O
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[15px] font-bold uppercase tracking-[0.01em] text-os-heading">Ovie</p>
            <p className="flex items-center gap-1.5 font-label text-[10px] uppercase tracking-[0.14em] text-os-faint">
              <span className="h-1.5 w-1.5 rounded-full bg-os-accent" />
              Oversite Assistant
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close help lounge"
            className="grid h-9 w-9 place-items-center rounded-full text-os-faint transition-colors hover:bg-os-heading/[0.07] hover:text-os-heading"
          >
            <X size={18} />
          </button>
        </div>

        {/* transcript */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-6">
          {msgs.map((m, i) => (
            <div key={i} className={cn("flex", m.from === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[82%] rounded-2xl px-4 py-2.5 font-body text-[13.5px] leading-relaxed",
                  m.from === "user"
                    ? "rounded-br-md bg-os-accent text-os-accent-ink"
                    : "rounded-bl-md border border-os-hairline/50 bg-os-surface/60 text-os-body",
                )}
              >
                {m.text}
              </div>
            </div>
          ))}

          {typing && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-md border border-os-hairline/50 bg-os-surface/60 px-4 py-3">
                <span className="flex gap-1">
                  {[0, 1, 2].map((d) => (
                    <span key={d} className="h-1.5 w-1.5 rounded-full bg-os-faint motion-safe:animate-bounce" style={{ animationDelay: `${d * 120}ms` }} />
                  ))}
                </span>
              </div>
            </div>
          )}

          {/* quick replies */}
          {!typing && chips.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {chips.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={c.run}
                  className={cn(
                    "rounded-full border px-3.5 py-2 font-label text-[11.5px] tracking-[0.02em] transition-colors",
                    c.label === "Talk to a human"
                      ? "border-os-accent/50 text-os-accent hover:bg-os-accent hover:text-os-accent-ink"
                      : "border-os-hairline/60 text-os-body hover:border-os-accent hover:text-os-accent",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}

          <div ref={endRef} />
        </div>

        {/* composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendText(input);
          }}
          className="flex items-center gap-2 border-t border-os-hairline/40 p-3"
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Ovie a question…"
            className="h-11 flex-1 rounded-full border border-os-hairline/50 bg-os-surface/50 px-4 font-body text-[13.5px] text-os-heading outline-none transition-colors placeholder:text-os-faint focus:border-os-accent"
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={!input.trim()}
            className="grid h-11 w-11 flex-none place-items-center rounded-full bg-os-accent text-os-accent-ink transition hover:brightness-105 disabled:opacity-40"
          >
            <ArrowUp size={18} />
          </button>
        </form>
      </aside>
    </div>,
    document.body,
  );
}
