import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import containers from "@/assets/containers.webp";

// Self-contained "system page" shell — same mountain backdrop + frosted slate
// glass + icy accent used by NotFound / Checkout / Verify, inlined so no shared
// file is required. The mountain image is passed in via the --os-mtn CSS var so
// the background can stay inside this string.
const OSSYS_CSS = `
.ossys{--os-heading:#E8EEF3;--os-body:#A8B4BF;--os-faint:#788591;--os-accent:#C9DBE6;--os-accent-ink:#1E242B;--os-hair:rgba(168,180,191,.16);position:relative;min-height:100vh;display:flex;flex-direction:column;overflow:hidden;color:var(--os-body);font-family:'Manrope',system-ui,-apple-system,sans-serif;background:radial-gradient(120% 80% at 50% 120%,rgba(201,219,230,.10),transparent 55%),linear-gradient(180deg,rgba(28,34,41,.58),rgba(20,25,31,.82)),var(--os-mtn,none) center 20%/cover no-repeat,#1e242b}
.ossys-top{position:relative;z-index:2;padding:22px 26px}
.ossys-top img{height:30px;width:auto;object-fit:contain}
.ossys-mid{position:relative;z-index:2;flex:1;display:grid;place-items:center;padding:16px 16px 64px}
.ossys-foot{position:relative;z-index:2;padding-bottom:22px;text-align:center;font-size:12px;color:var(--os-faint)}
.ossys-card{width:100%;border:1px solid var(--os-hair);border-radius:20px;background:linear-gradient(180deg,rgba(46,54,63,.72),rgba(39,46,54,.8));-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);box-shadow:0 34px 90px -34px rgba(0,0,0,.8);padding:38px 34px;text-align:center}
.ossys-card h1{color:var(--os-heading);font-weight:800;letter-spacing:-.01em;margin:0}
.ossys-card p{color:var(--os-body)}
.ossys-badge{margin:0 auto 22px;width:64px;height:64px;border-radius:18px;display:grid;place-items:center;border:1px solid var(--os-hair);background:rgba(201,219,230,.1);color:var(--os-accent)}
.ossys-badge.bad{background:rgba(233,139,139,.12);border-color:rgba(233,139,139,.3);color:#e98b8b}
.ossys-accent{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:46px;padding:0 22px;border-radius:12px;font-weight:700;font-size:14.5px;border:0;cursor:pointer;text-decoration:none;background:var(--os-accent);color:var(--os-accent-ink);transition:filter .18s ease,transform .18s ease}
.ossys-accent:hover{filter:brightness(1.06);transform:translateY(-1px)}
.ossys-ghost{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:46px;padding:0 22px;border-radius:12px;font-weight:700;font-size:14.5px;cursor:pointer;text-decoration:none;background:transparent;color:var(--os-heading);border:1px solid var(--os-hair)}
.ossys-ghost:hover{background:rgba(201,219,230,.08)}
`;

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

/**
 * App-wide error boundary. Catches render/runtime errors in the route tree and
 * shows the branded mountain "system page" instead of a blank/unbranded crash
 * screen. Reloading remounts the tree from a clean state.
 */
class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("App error boundary caught an error:", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="ossys" style={{ ["--os-mtn" as any]: `url(${containers})` }}>
        <style>{OSSYS_CSS}</style>
        <div className="ossys-mid">
          <div style={{ width: "100%", maxWidth: 460 }}>
            <div className="ossys-card">
              <div className="ossys-badge bad">
                <AlertTriangle />
              </div>
              <h1 style={{ fontSize: 22, marginBottom: 10 }}>This page ran into an issue</h1>
              <p style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 28 }}>
                Something went wrong while loading this page. Reloading usually clears it — if it
                keeps happening, head back home and try again.
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                <a className="ossys-ghost" href="/">
                  Return home
                </a>
                <button className="ossys-accent" onClick={() => window.location.reload()}>
                  Reload page
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="ossys-foot">Oversite</div>
      </main>
    );
  }
}

export default ErrorBoundary;
