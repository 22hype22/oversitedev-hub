// Ghost-loading skeletons that mirror the REAL layouts they stand in for —
// not abstract boxes. Two variants:
//   • DashboardGhost — the bot dashboard shell: 236px sidebar (profile + nav),
//     main header (breadcrumb / "Hey, name" / sub + bell + CTA), then the
//     2fr/1fr card grid (fleet chart, bots table, "Your bots" list).
//   • MarketingGhost — the marketing shell: fixed-style nav (wordmark left,
//     links + pill right) over a hero (eyebrow, headline, sub, CTA pair).
// Palette matches each real surface (.osd vars / oversite-theme slate) so the
// swap to live content is seamless. Pure CSS shimmer, reduced-motion safe.

import type { CSSProperties } from "react";

const GHOST_CSS = `
@keyframes os-ghost{0%{background-position:200% 0}100%{background-position:-200% 0}}
.os-ghost{border-radius:8px;background:linear-gradient(90deg,rgba(201,219,230,.07) 25%,rgba(201,219,230,.15) 50%,rgba(201,219,230,.07) 75%);background-size:200% 100%;animation:os-ghost 1.5s ease-in-out infinite}
@media (prefers-reduced-motion: reduce){.os-ghost{animation:none;background:rgba(201,219,230,.09)}}
`;

const G = ({ w, h, r, style }: { w: number | string; h: number; r?: number; style?: CSSProperties }) => (
  <div className="os-ghost" style={{ width: w, height: h, borderRadius: r, ...style }} />
);

const card: CSSProperties = {
  border: "1px solid #3a434d",
  background: "#272e36",
  borderRadius: 16,
  padding: 16,
};

export function DashboardGhost() {
  return (
    <div
      role="status"
      aria-label="Loading dashboard"
      className="flex min-h-screen"
      style={{ background: "#21272e" }}
    >
      <style>{GHOST_CSS}</style>

      {/* Sidebar — profile row, then the Menu/Account/More nav groups */}
      <aside
        className="hidden md:flex"
        style={{ width: 236, flex: "none", flexDirection: "column", gap: 10, padding: "18px 14px", borderRight: "1px solid #3a434d" }}
      >
        <div className="flex items-center gap-3" style={{ padding: "6px 6px 16px" }}>
          <G w={40} h={40} r={999} />
          <div className="flex-1">
            <G w="70%" h={12} style={{ marginBottom: 6 }} />
            <G w="90%" h={9} />
          </div>
        </div>
        <G w={44} h={9} style={{ margin: "4px 8px" }} />
        {[0, 1, 2, 3].map((i) => <G key={i} w="100%" h={36} r={10} />)}
        <G w={58} h={9} style={{ margin: "10px 8px 4px" }} />
        {[0, 1].map((i) => <G key={i} w="100%" h={36} r={10} />)}
        <G w={40} h={9} style={{ margin: "10px 8px 4px" }} />
        {[0, 1].map((i) => <G key={i} w="100%" h={36} r={10} />)}
      </aside>

      {/* Main — header (crumb / h1 / sub + bell + CTA), then the card grid */}
      <div className="flex-1 min-w-0" style={{ padding: "24px 26px 50px" }}>
        <div className="flex items-start justify-between" style={{ marginBottom: 22 }}>
          <div>
            <G w={150} h={10} style={{ marginBottom: 10 }} />
            <G w={220} h={28} style={{ marginBottom: 8 }} />
            <G w={120} h={11} />
          </div>
          <div className="flex items-center gap-3">
            <G w={38} h={38} r={999} />
            <G w={110} h={38} r={12} />
          </div>
        </div>

        <div className="grid gap-4" style={{ gridTemplateColumns: "1fr" }}>
          <div className="grid gap-4 lg:[grid-template-columns:2fr_1fr]">
            {/* Fleet activity — title + legend + the bar chart */}
            <div style={card}>
              <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
                <G w={110} h={13} />
                <G w={22} h={10} />
              </div>
              <div className="flex items-end gap-3" style={{ height: 110, padding: "0 4px" }}>
                {[62, 40, 78, 52, 88, 45, 70].map((h, i) => (
                  <div key={i} className="flex-1"><G w="100%" h={Math.round(h)} r={4} /></div>
                ))}
              </div>
              <div className="flex items-center gap-3" style={{ marginTop: 14 }}>
                <G w={64} h={22} />
                <G w={44} h={11} />
              </div>
            </div>

            {/* Your bots — title, filter tabs, bot rows (icon / name+status / Open) */}
            <div style={card}>
              <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                <G w={72} h={13} />
                <G w={22} h={10} />
              </div>
              <div className="flex gap-2" style={{ marginBottom: 14 }}>
                <G w={44} h={24} r={8} /><G w={54} h={24} r={8} /><G w={48} h={24} r={8} />
              </div>
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3" style={{ padding: "10px 0", borderTop: i ? "1px solid #3a434d" : undefined }}>
                  <G w={34} h={34} r={9} />
                  <div className="flex-1">
                    <G w="60%" h={12} style={{ marginBottom: 6 }} />
                    <G w="35%" h={9} />
                  </div>
                  <G w={48} h={26} r={8} />
                </div>
              ))}
            </div>
          </div>

          {/* Bots table — filter tabs + header + rows */}
          <div style={card}>
            <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
              <div className="flex gap-2"><G w={58} h={24} r={8} /><G w={52} h={24} r={8} /><G w={100} h={24} r={8} /></div>
              <G w={90} h={24} r={8} />
            </div>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-4" style={{ padding: "12px 0", borderTop: "1px solid #3a434d" }}>
                <G w={30} h={30} r={999} />
                <G w="22%" h={12} />
                <G w={64} h={11} />
                <G w={54} h={11} style={{ marginLeft: "auto" }} />
                <G w={62} h={26} r={8} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function MarketingGhost() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="min-h-screen"
      style={{ background: "linear-gradient(180deg, #293038, #1a1f25)" }}
    >
      <style>{GHOST_CSS}</style>

      {/* Nav — wordmark left, link set + account pill right, same widths as SiteNav */}
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6" style={{ height: 68 }}>
        <G w={104} h={20} />
        <div className="hidden items-center gap-6 md:flex">
          <G w={52} h={11} /><G w={64} h={11} /><G w={44} h={11} /><G w={58} h={11} />
        </div>
        <div className="flex items-center gap-3">
          <G w={30} h={30} r={999} />
          <G w={92} h={34} r={999} />
        </div>
      </div>

      {/* Hero — eyebrow, two headline lines, sub, CTA pair */}
      <div className="mx-auto w-full max-w-6xl px-6" style={{ paddingTop: 72 }}>
        <G w={132} h={12} style={{ marginBottom: 20 }} />
        <G w="min(560px, 82%)" h={44} style={{ marginBottom: 12 }} />
        <G w="min(420px, 62%)" h={44} style={{ marginBottom: 22 }} />
        <G w="min(480px, 70%)" h={14} style={{ marginBottom: 8 }} />
        <G w="min(380px, 55%)" h={14} style={{ marginBottom: 30 }} />
        <div className="flex gap-3">
          <G w={150} h={46} r={14} />
          <G w={130} h={46} r={14} />
        </div>
        {/* Content band below the fold line */}
        <div className="mt-16 grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl p-4" style={{ border: "1px solid rgba(168,180,191,.10)", background: "rgba(46,54,63,.35)" }}>
              <G w={40} h={40} r={12} style={{ marginBottom: 14 }} />
              <G w="70%" h={13} style={{ marginBottom: 8 }} />
              <G w="92%" h={11} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
