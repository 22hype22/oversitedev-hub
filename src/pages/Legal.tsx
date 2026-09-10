import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { SiteNav } from "@/components/marketing/SiteNav";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { LEGAL_DOCS, LEGAL_EFFECTIVE, LEGAL_STATE, LEGAL_SUPPORT } from "@/pages/Terms";

/**
 * Legal — the index at /legal. One card per document, each leading to its
 * own address, with the effective date and where to send questions.
 */
const Legal = () => (
  <div className="oversite-theme min-h-screen bg-os-bg font-body text-os-body antialiased">
    <SiteNav />
    <main className="mx-auto w-full max-w-[1000px] px-5 pb-24 pt-28">
      <header className="max-w-[560px]">
        <p className="font-label text-[11px] uppercase tracking-[0.2em] text-os-faint">Legal</p>
        <h1 className="mt-2 text-[clamp(2rem,5vw,3rem)] font-extrabold tracking-[-0.02em] text-os-heading">
          Policies &amp; terms
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-os-body">
          Everything that governs your account, your bots and what you pay, written in plain language.
          Each document has its own page.
        </p>
        <p className="mt-2 text-[13px] text-os-faint">
          Effective {LEGAL_EFFECTIVE} · Oversite · {LEGAL_STATE}
        </p>
      </header>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {LEGAL_DOCS.map((d) => {
          const Icon = d.icon;
          return (
            <Link
              key={d.slug}
              to={`/legal/${d.slug}`}
              className="group flex flex-col rounded-[18px] border border-os-hairline/30 bg-os-surface/40 p-6 transition hover:border-os-accent/40 hover:bg-os-surface/60"
            >
              <span className="grid h-10 w-10 place-items-center rounded-[12px] border border-os-accent/30 bg-os-accent/10 text-os-accent">
                <Icon size={18} aria-hidden />
              </span>
              <h2 className="mt-5 text-[18px] font-bold text-os-heading">{d.title}</h2>
              <p className="mt-1.5 flex-1 text-[13.5px] leading-relaxed text-os-faint">{d.intro}</p>
              <span className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-semibold text-os-heading">
                Read it
                <ArrowUpRight
                  size={14}
                  className="text-os-faint transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-os-heading"
                  aria-hidden
                />
              </span>
            </Link>
          );
        })}
      </div>

      <p className="mt-10 text-[13px] text-os-faint">
        Questions about any of these? Email{" "}
        <a href={`mailto:${LEGAL_SUPPORT}`} className="text-os-body underline underline-offset-4 hover:text-os-heading">
          {LEGAL_SUPPORT}
        </a>
        .
      </p>
    </main>
    <SiteFooter />
  </div>
);

export default Legal;
