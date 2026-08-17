import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import { Container, Mono } from "./primitives";

function DiscordIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.317 4.369a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.249a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.036A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.891.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

type LinkItem = { label: string; to: string };
const COLUMNS: { heading: string; links: LinkItem[] }[] = [
  {
    heading: "Explore",
    links: [
      { label: "Home", to: "/" },
      { label: "Our Process", to: "/process" },
      { label: "Bots", to: "/bots" },
      { label: "Meet the Team", to: "/explore/team" },
      { label: "Support and Ideas", to: "/support-ideas" },
      { label: "FAQ", to: "#faq" },
    ],
  },
  {
    heading: "Account",
    links: [
      { label: "Sign In", to: "/auth" },
      { label: "Create Account", to: "/auth" },
      { label: "Dashboard", to: "/dashboard" },
      { label: "Memberships", to: "/products" },
    ],
  },
];

const LINK_CLS =
  "font-label text-[13px] tracking-[0.01em] text-os-ink-body transition-colors hover:text-os-heading";

function FooterLink({ to, label }: LinkItem) {
  return to.startsWith("#") ? (
    <a href={to} className={LINK_CLS}>{label}</a>
  ) : (
    <Link to={to} className={LINK_CLS}>{label}</Link>
  );
}

export function SiteFooter() {
  return (
    <footer className="relative mt-24 border-t border-os-ink-line/70 bg-os-ink/95 pt-12 shadow-[inset_0_1px_0_rgb(var(--os-ink-heading)/0.06)] md:mt-32">
      <Container>
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3 lg:grid-cols-6">
          <div className="col-span-2 sm:col-span-3 lg:col-span-2">
            <Link to="/" className="font-display text-[20px] font-extrabold uppercase tracking-[-0.02em] text-os-heading">Oversite</Link>
            <p className="mt-3 max-w-[220px] font-label text-[11px] uppercase leading-relaxed tracking-[0.08em] text-os-faint">
              Managed Discord bots. Remote-first. Est. 2025.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <Mono className="text-os-heading">{col.heading}</Mono>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}><FooterLink {...l} /></li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <Mono className="text-os-heading">Contact</Mono>
            <ul className="mt-4 space-y-2.5">
              <li>
                <a
                  href="mailto:support@oversite.shop"
                  className="group inline-flex items-center gap-2 font-label text-[13px] tracking-[0.01em] text-os-ink-body transition-colors hover:text-os-heading"
                >
                  <Mail size={14} strokeWidth={2} className="flex-none text-os-faint transition-colors group-hover:text-os-accent" aria-hidden />
                  support@oversite.shop
                </a>
              </li>
              <li>
                <a
                  href="https://discord.gg/oversite"
                  target="_blank"
                  rel="noreferrer"
                  className="group inline-flex items-center gap-2 font-label text-[13px] tracking-[0.01em] text-os-ink-body transition-colors hover:text-os-heading"
                >
                  <span className="flex-none text-os-faint transition-colors group-hover:text-os-accent">
                    <DiscordIcon size={14} />
                  </span>
                  .gg/oversite
                </a>
              </li>
            </ul>
          </div>

          <div>
            <Mono className="text-os-heading">Legal</Mono>
            <ul className="mt-4 space-y-2.5">
              <li><FooterLink to="/terms#privacy" label="Privacy Policy" /></li>
              <li><FooterLink to="/terms#terms" label="Terms of Use" /></li>
              <li><FooterLink to="/terms#refunds" label="Sales and Refunds" /></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-os-ink-line/70 py-6 sm:flex-row sm:items-center sm:justify-between">
          <Mono className="text-os-faint">© 2026 Oversite — All rights reserved</Mono>
          <Mono className="text-os-faint">Not affiliated with Discord Inc.</Mono>
        </div>
      </Container>
    </footer>
  );
}
