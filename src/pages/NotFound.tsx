import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import dashboardBg from "@/assets/dashboardBg";
import oversiteLogo from "@/assets/oversite-logo.png";

// Self-contained "system page" shell (mountain backdrop + frosted slate glass
// + icy accent). Inlined rather than shared so no extra file is required.
const OSSYS_CSS = `
.ossys{--os-heading:#E8EEF3;--os-body:#A8B4BF;--os-faint:#788591;--os-accent:#C9DBE6;--os-accent-ink:#1E242B;--os-hair:rgba(168,180,191,.16);position:relative;min-height:100vh;display:flex;flex-direction:column;overflow:hidden;color:var(--os-body);font-family:'Manrope',system-ui,-apple-system,sans-serif}
.ossys-bg{position:fixed;inset:0;z-index:0;background-size:cover;background-position:center 22%;background-repeat:no-repeat}
.ossys-scrim{position:fixed;inset:0;z-index:0;background:linear-gradient(180deg,rgba(18,22,27,.55),rgba(18,22,27,.72) 55%,rgba(18,22,27,.86))}
.ossys-top{position:relative;z-index:2;padding:22px 26px}
.ossys-top img{height:30px;width:auto;object-fit:contain}
.ossys-mid{position:relative;z-index:2;flex:1;display:grid;place-items:center;padding:16px 16px 64px}
.ossys-foot{position:relative;z-index:2;padding-bottom:22px;text-align:center;font-size:12px;color:var(--os-faint)}
.ossys-card{width:100%;border:1px solid var(--os-hair);border-radius:20px;background:linear-gradient(180deg,rgba(46,54,63,.72),rgba(39,46,54,.8));-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);box-shadow:0 34px 90px -34px rgba(0,0,0,.8);padding:38px 34px;text-align:center}
.ossys-card.left{text-align:left}
.ossys-card h1{color:var(--os-heading);font-weight:800;letter-spacing:-.01em;margin:0}
.ossys-card p{color:var(--os-body)}
.ossys-badge{margin:0 auto 22px;width:64px;height:64px;border-radius:18px;display:grid;place-items:center;border:1px solid var(--os-hair);background:rgba(201,219,230,.1);color:var(--os-accent)}
.ossys-badge.ok{background:rgba(134,211,161,.12);border-color:rgba(134,211,161,.3);color:#86d3a1}
.ossys-badge.bad{background:rgba(233,139,139,.12);border-color:rgba(233,139,139,.3);color:#e98b8b}
.ossys-accent{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:46px;padding:0 22px;border-radius:12px;font-weight:700;font-size:14.5px;border:0;cursor:pointer;text-decoration:none;background:var(--os-accent);color:var(--os-accent-ink);transition:filter .18s ease,transform .18s ease}
.ossys-accent:hover{filter:brightness(1.06);transform:translateY(-1px)}
.ossys-ghost{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:46px;padding:0 22px;border-radius:12px;font-weight:700;font-size:14.5px;cursor:pointer;text-decoration:none;background:transparent;color:var(--os-heading);border:1px solid var(--os-hair)}
.ossys-ghost:hover{background:rgba(201,219,230,.08)}
`;

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

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
        <div style={{ width: "100%", maxWidth: 460 }}>
          <div className="ossys-card">
            <div className="ossys-badge">
              <Search />
            </div>
            <h1 style={{ fontSize: 64, lineHeight: 1, marginBottom: 4 }}>404</h1>
            <h1 style={{ fontSize: 20, marginBottom: 10 }}>This page wandered off</h1>
            <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 28 }}>
              We couldn't find what you were looking for. It may have been moved, or the link
              was mistyped.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button className="ossys-ghost" onClick={() => navigate(-1)}>
                Go back
              </button>
              <Link className="ossys-accent" to="/">
                Return home
              </Link>
            </div>
          </div>
        </div>
      </div>
      <div className="ossys-foot">404 — {location.pathname}</div>
    </main>
  );
};

export default NotFound;
