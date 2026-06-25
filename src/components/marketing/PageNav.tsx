import { useEffect, useState } from "react";

const SHADOW = "[text-shadow:0_2px_30px_rgb(var(--os-ink)/0.85)]";

/**
 * Fixed page indicator for the full-screen "pages" — a vertical dot rail on the
 * right and a NN — NN counter bottom-left. Tracks which [data-page] section is
 * crossing the viewport centre and jumps to a page when a dot is clicked.
 */
export function PageNav() {
  const [active, setActive] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-page]"));
    setTotal(sections.length);
    if (!sections.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.page));
        });
      },
      // fire when a section crosses the vertical centre line of the viewport
      { rootMargin: "-50% 0px -50% 0px", threshold: 0 },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  const go = (i: number) => {
    document.querySelector<HTMLElement>(`[data-page="${i}"]`)?.scrollIntoView({ behavior: "smooth" });
  };

  if (total < 2) return null;

  return (
    <>
      {/* right dot rail */}
      <div className="fixed right-5 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-center gap-3.5 md:flex">
        {Array.from({ length: total }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => go(i)}
            aria-label={`Go to page ${i + 1}`}
            aria-current={active === i}
            className={
              active === i
                ? "h-2.5 w-2.5 rounded-full bg-os-accent ring-2 ring-os-accent/30 transition"
                : "h-2 w-2 rounded-full border border-os-heading/50 transition hover:border-os-heading"
            }
          />
        ))}
      </div>

      {/* bottom-left counter */}
      <div className={`fixed bottom-12 left-6 z-40 hidden items-center gap-3 font-label text-[12px] tracking-[0.25em] md:left-10 md:flex ${SHADOW}`}>
        <span className="text-os-heading">{String(active + 1).padStart(2, "0")}</span>
        <span className="h-px w-10 bg-os-heading/40" />
        <span className="text-os-faint">{String(total).padStart(2, "0")}</span>
      </div>
    </>
  );
}
