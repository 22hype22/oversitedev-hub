import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

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

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-foreground mb-2 text-center">
          Server Verification
        </h1>
        <p className="text-sm text-muted-foreground mb-6 text-center">{message}</p>
        {status !== "success" && status !== "error" && (
          <div ref={containerRef} className="flex justify-center" />
        )}
        {status === "success" && (
          <div className="text-center text-green-600 dark:text-green-400 font-medium">
            ✓ Verified
          </div>
        )}
        {status === "error" && (
          <div className="text-center text-destructive font-medium">✗ {message}</div>
        )}
      </div>
    </main>
  );
};

export default Verify;
