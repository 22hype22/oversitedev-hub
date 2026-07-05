import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import oversiteLogo from "@/assets/oversite-logo.png";

// Self-contained "system page" shell (mountain backdrop + frosted slate glass
// + icy accent). Inlined rather than shared so no extra file is required.
const OSSYS_CSS = `
.ossys{--os-heading:#E8EEF3;--os-body:#A8B4BF;--os-faint:#788591;--os-accent:#C9DBE6;--os-accent-ink:#1E242B;--os-hair:rgba(168,180,191,.16);position:relative;min-height:100vh;display:flex;flex-direction:column;overflow:hidden;color:var(--os-body);font-family:'Manrope',system-ui,-apple-system,sans-serif;background:radial-gradient(130% 85% at 50% 118%,rgba(201,219,230,.14),transparent 55%),radial-gradient(95% 70% at 50% -15%,rgba(70,82,94,.55),transparent 60%),linear-gradient(180deg,#293038,#1e242b)}
.ossys-top{position:relative;z-index:2;padding:22px 26px}
.ossys-top img{height:30px;width:auto;object-fit:contain}
.ossys-mid{position:relative;z-index:2;flex:1;display:grid;place-items:center;padding:16px 16px 64px}
.ossys-foot{position:relative;z-index:2;padding-bottom:22px;text-align:center;font-size:12px;color:var(--os-faint)}
.ossys-card{width:100%;border:1px solid var(--os-hair);border-radius:20px;background:linear-gradient(180deg,rgba(46,54,63,.72),rgba(39,46,54,.8));-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);box-shadow:0 34px 90px -34px rgba(0,0,0,.8);padding:38px 34px;text-align:center}
.ossys-card h1{color:var(--os-heading);font-weight:800;letter-spacing:-.01em;margin:0}
.ossys-card p{color:var(--os-body)}
.ossys-badge{margin:0 auto 22px;width:64px;height:64px;border-radius:18px;display:grid;place-items:center;border:1px solid var(--os-hair);background:rgba(201,219,230,.1);color:var(--os-accent)}
.ossys-badge.ok{background:rgba(134,211,161,.12);border-color:rgba(134,211,161,.3);color:#86d3a1}
.ossys-badge.bad{background:rgba(233,139,139,.12);border-color:rgba(233,139,139,.3);color:#e98b8b}
`;

declare global {
  interface Window {
    hcaptcha?: any;
    turnstile?: any;
    onHCaptchaLoad?: () => void;
    onTurnstileLoad?: () => void;
  }
}

type Status = "loading" | "ready" | "verifying" | "success" | "error";

const loadScript = (src: string, id: string) =>
  new Promise<void>((resolve, reject) => {
    if (document.getElementById(id)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.id = id;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });

const Verify = () => {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const provider = (params.get("provider") ?? "hcaptcha").toLowerCase();
  const siteKey = params.get("sitekey") ?? "";

  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("Loading captcha...");
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<any>(null);

  const completeVerification = async (captchaResponse: string) => {
    setStatus("verifying");
    setMessage("Verifying...");
    try {
      const { data, error } = await supabase.functions.invoke("complete-verification", {
        body: { token, captcha_response: captchaResponse, provider },
      });
      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "Verification failed");
      }
      setStatus("success");
      setMessage("Verification complete! You may close this tab.");
    } catch (e: any) {
      setStatus("error");
      setMessage(e.message ?? "Verification failed");
    }
  };

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Missing verification token.");
      return;
    }
    if (!siteKey) {
      setStatus("error");
      setMessage("Missing captcha site key.");
      return;
    }

    let cancelled = false;

    const init = async () => {
      try {
        if (provider === "turnstile" || provider === "cloudflare" || provider === "cloudflare_turnstile") {
          await loadScript("https://challenges.cloudflare.com/turnstile/v0/api.js", "cf-turnstile");
          await new Promise<void>((r) => {
            const check = () => (window.turnstile ? r() : setTimeout(check, 100));
            check();
          });
          if (cancelled || !containerRef.current) return;
          widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            callback: (resp: string) => completeVerification(resp),
          });
        } else {
          await loadScript("https://js.hcaptcha.com/1/api.js?render=explicit", "hcaptcha-script");
          await new Promise<void>((r) => {
            const check = () => (window.hcaptcha ? r() : setTimeout(check, 100));
            check();
          });
          if (cancelled || !containerRef.current) return;
          widgetIdRef.current = window.hcaptcha.render(containerRef.current, {
            sitekey: siteKey,
            callback: (resp: string) => completeVerification(resp),
          });
        }
        setStatus("ready");
        setMessage("Complete the captcha to verify.");
      } catch (e: any) {
        setStatus("error");
        setMessage(e.message ?? "Failed to load captcha");
      }
    };

    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, provider, siteKey]);

  const badgeTone = status === "success" ? " ok" : status === "error" ? " bad" : "";

  return (
    <main className="ossys">
      <style>{OSSYS_CSS}</style>
      <div className="ossys-top">
        <Link to="/" aria-label="Oversite — home">
          <img src={oversiteLogo} alt="Oversite" />
        </Link>
      </div>
      <div className="ossys-mid">
        <div style={{ width: "100%", maxWidth: 460 }}>
          <div className="ossys-card">
            <div className={`ossys-badge${badgeTone}`}>
              <ShieldCheck className="h-8 w-8" />
            </div>
            <h1 style={{ fontSize: 24, marginBottom: 8 }}>Server Verification</h1>
            <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>{message}</p>
            {status !== "success" && status !== "error" && (
              <div ref={containerRef} className="flex justify-center" />
            )}
            {status === "success" && (
              <div style={{ fontWeight: 600, color: "#86d3a1" }}>✓ Verified</div>
            )}
            {status === "error" && (
              <div style={{ fontWeight: 600, color: "#e98b8b" }}>✗ {message}</div>
            )}
          </div>
        </div>
      </div>
      <div className="ossys-foot">
        Protected by captcha · We never store personal data from this check
      </div>
    </main>
  );
};

export default Verify;
