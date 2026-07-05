import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import oversiteLogo from "@/assets/oversite-logo.png";
import dashboardBg from "@/assets/dashboardBg";

/**
 * Branded full-screen shell for the small "system" pages — 404, checkout,
 * verify, loading, error. Matches the new app design: the misty-mountain
 * backdrop, a dark cold-slate scrim, and a frosted-glass panel with an icy
 * accent — the same language as the dashboard, so these pages feel like part
 * of the product. Styling is self-contained (scoped .ossys CSS) so it renders
 * identically regardless of which global tokens the surrounding app defines.
 */

const OSSYS_CSS = `
.ossys{--os-heading:#E8EEF3;--os-body:#A8B4BF;--os-faint:#788591;--os-accent:#C9DBE6;
  --os-accent-ink:#1E242B;--os-hair:rgba(168,180,191,.16);
  position:relative;min-height:100vh;display:flex;flex-direction:column;overflow:hidden;
  color:var(--os-body);font-family:'Manrope',system-ui,-apple-system,sans-serif}
.ossys-bg{position:fixed;inset:0;z-index:0;background-size:cover;background-position:center 22%;background-repeat:no-repeat}
.ossys-scrim{position:fixed;inset:0;z-index:0;background:linear-gradient(180deg,rgba(18,22,27,.55),rgba(18,22,27,.72) 55%,rgba(18,22,27,.86))}
.ossys-top{position:relative;z-index:2;padding:22px 26px}
.ossys-top img{height:30px;width:auto;object-fit:contain}
.ossys-mid{position:relative;z-index:2;flex:1;display:grid;place-items:center;padding:16px 16px 64px}
.ossys-foot{position:relative;z-index:2;padding-bottom:22px;text-align:center;font-size:12px;color:var(--os-faint);letter-spacing:.02em}
.ossys-card{width:100%;border:1px solid var(--os-hair);border-radius:20px;
  background:linear-gradient(180deg,rgba(46,54,63,.72),rgba(39,46,54,.8));
  -webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);
  box-shadow:0 34px 90px -34px rgba(0,0,0,.8);padding:38px 34px;text-align:center}
.ossys-card.left{text-align:left}
.ossys-card h1{color:var(--os-heading);font-weight:800;letter-spacing:-.01em;margin:0}
.ossys-card p{color:var(--os-body)}
.ossys-badge{margin:0 auto 22px;width:64px;height:64px;border-radius:18px;display:grid;place-items:center;
  border:1px solid var(--os-hair);background:rgba(201,219,230,.1);color:var(--os-accent)}
.ossys-badge.ok{background:rgba(134,211,161,.12);border-color:rgba(134,211,161,.3);color:#86d3a1}
.ossys-badge.bad{background:rgba(233,139,139,.12);border-color:rgba(233,139,139,.3);color:#e98b8b}
.ossys-badge svg{width:30px;height:30px}
.ossys-accent{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:46px;padding:0 22px;
  border-radius:12px;font-weight:700;font-size:14.5px;border:0;cursor:pointer;text-decoration:none;
  background:var(--os-accent);color:var(--os-accent-ink);transition:filter .18s ease,transform .18s ease}
.ossys-accent:hover{filter:brightness(1.06);transform:translateY(-1px)}
.ossys-ghost{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:46px;padding:0 22px;
  border-radius:12px;font-weight:700;font-size:14.5px;cursor:pointer;text-decoration:none;
  background:transparent;color:var(--os-heading);border:1px solid var(--os-hair);transition:background .18s ease}
.ossys-ghost:hover{background:rgba(201,219,230,.08)}
.ossys-spin{width:48px;height:48px;border-radius:50%;border:3px solid var(--os-hair);border-top-color:var(--os-accent);animation:ossys-rot .8s linear infinite}
@keyframes ossys-rot{to{transform:rotate(360deg)}}
`;

export function SystemScreen({
  children,
  footer,
  maxWidth = 460,
}: {
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: number;
}) {
  return (
    <main className="ossys">
      <style>{OSSYS_CSS}</style>
      <div className="ossys-bg" style={{ backgroundImage: `url(${dashboardBg})` }} aria-hidden />
      <div className="ossys-scrim" aria-hidden />

      <div className="ossys-top">
        <Link to="/" aria-label="Oversite — home">
          <img src={oversiteLogo} alt="Oversite" />
        </Link>
      </div>


      <div className="ossys-mid">
        <div style={{ width: "100%", maxWidth }}>{children}</div>
      </div>

      {footer && <div className="ossys-foot">{footer}</div>}
    </main>
  );
}

export function SystemCard({
  children,
  align = "center",
}: {
  children: ReactNode;
  align?: "center" | "left";
}) {
  return <div className={`ossys-card${align === "left" ? " left" : ""}`}>{children}</div>;
}

export function SystemBadge({
  children,
  tone = "accent",
}: {
  children: ReactNode;
  tone?: "accent" | "success" | "error";
}) {
  const cls = tone === "success" ? "ossys-badge ok" : tone === "error" ? "ossys-badge bad" : "ossys-badge";
  return <div className={cls}>{children}</div>;
}
