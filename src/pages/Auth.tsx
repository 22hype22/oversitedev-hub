import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Mono, Reveal } from "@/components/marketing/primitives";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Loader2, ArrowLeft } from "lucide-react";
import containers from "@/assets/containers.webp";

const FIELD =
  "w-full rounded-lg border border-os-hairline/50 bg-os-bg/60 px-3.5 py-2.5 font-body text-[14px] text-os-heading placeholder:text-os-faint outline-none transition focus:border-os-accent/70";
const FIELD_LABEL = "mb-1.5 block font-label text-[11px] uppercase tracking-[0.14em] text-os-faint";

const VALUE_PROPS = [
  "Manage every bot from one dashboard",
  "Track orders and deployments live",
  "Your config carries across servers",
];

/** Brand glyphs — small inline marks so the social buttons read as real. */
function DiscordMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.317 4.369a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.6 12.6 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .078-.01c3.927 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .079.009c.12.099.245.198.372.292a.077.077 0 0 1-.006.127c-.598.349-1.225.645-1.873.891a.076.076 0 0 0-.04.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 0 0-.031-.028zM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}
function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M23.52 12.273c0-.851-.076-1.67-.218-2.455H12v4.642h6.458a5.52 5.52 0 0 1-2.394 3.622v3.011h3.878c2.27-2.09 3.578-5.168 3.578-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.957-1.075 7.942-2.907l-3.878-3.011c-1.075.72-2.45 1.146-4.064 1.146-3.125 0-5.77-2.11-6.715-4.947H1.276v3.11A11.997 11.997 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.285 14.281A7.213 7.213 0 0 1 4.91 12c0-.79.136-1.558.375-2.281v-3.11H1.276A11.997 11.997 0 0 0 0 12c0 1.937.464 3.769 1.276 5.391l4.009-3.11z" />
      <path fill="#EA4335" d="M12 4.773c1.762 0 3.344.605 4.589 1.794l3.44-3.44C17.952 1.187 15.235 0 12 0A11.997 11.997 0 0 0 1.276 6.609l4.009 3.11C6.23 6.882 8.875 4.773 12 4.773z" />
    </svg>
  );
}

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">(
    params.get("mode") === "signup" ? "signup" : "signin",
  );
  const [identifier, setIdentifier] = useState(""); // sign-in: email OR username
  const [username, setUsername] = useState("");      // sign-up
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState<"discord" | "google" | null>(null);

  const inviteToken = params.get("team_invite");
  const transferToken = params.get("team_transfer");
  const postAuthPath = inviteToken
    ? "/bot-dashboard?team_invite=accepted"
    : transferToken
      ? "/bot-dashboard?team_transfer=accepted"
      : "/";
  const redirectSuffix = inviteToken
    ? `?team_invite=${inviteToken}`
    : transferToken
      ? `?team_transfer=${transferToken}`
      : "";

  const runPostAuthActions = async () => {
    if (inviteToken) {
      // Accept by token (works even if the invitee signs in with a different
      // email than the invite was sent to). Fall back to email-based acceptance
      // for any other pending invites tied to this user's email.
      try {
        await (supabase as any).rpc("team_accept_invite_by_token", { _token: inviteToken });
      } catch (e) {
        console.error("team_accept_invite_by_token failed", e);
      }
      try {
        await (supabase as any).rpc("team_accept_invites_for_current_user");
      } catch (e) {
        console.error("team_accept_invites_for_current_user failed", e);
      }
    }
    if (transferToken) {
      const { data, error } = await (supabase as any).rpc(
        "team_confirm_ownership_transfer",
        { _token: transferToken },
      );
      if (error || !data?.ok) {
        toast({
          title: "Couldn't confirm transfer",
          description: error?.message ?? data?.error ?? "Try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Ownership transferred",
          description: "You are now the owner of this account.",
        });
        try {
          const { data: userResp } = await supabase.auth.getUser();
          const newOwnerEmail = userResp?.user?.email;
          const previousOwnerEmail = (data as any)?.previous_owner_email ?? null;
          const transferId = (data as any)?.transfer_id ?? transferToken;
          const dashboardUrl = `${window.location.origin}/bot-dashboard`;
          if (newOwnerEmail) {
            await supabase.functions.invoke("send-transactional-email", {
              body: {
                templateName: "team-transfer-complete",
                recipientEmail: newOwnerEmail,
                templateData: { previousOwnerEmail, dashboardUrl },
                idempotencyKey: `team-transfer-complete:${transferId}`,
              },
            });
          }
        } catch (e) {
          console.error("team-transfer-complete email failed", e);
        }
      }
    }
  };

  useEffect(() => {
    let cancelled = false;
    const go = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled || !session) return;
      if (inviteToken || transferToken) {
        // Always navigate, even if post-auth actions fail — otherwise the page
        // can hang forever on a silent RPC error.
        try {
          await runPostAuthActions();
        } catch (e) {
          console.error("post-auth actions failed", e);
        }
        if (!cancelled) navigate(postAuthPath, { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    };
    void go();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, inviteToken, transferToken, postAuthPath]);

  const signInWithProvider = async (provider: "discord" | "google") => {
    setOauthBusy(provider);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth${redirectSuffix}` },
    });
    if (error) {
      toast({
        title: "Couldn't continue",
        description: error.message ?? "Try again.",
        variant: "destructive",
      });
      setOauthBusy(null);
    }
    // On success the browser redirects to the provider, then back to /auth.
  };

  const forgotPassword = async () => {
    let target = identifier.trim();
    if (!target) {
      toast({ title: "Enter your email first", description: "Type your email (or username) above, then tap Forgot password.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      if (!target.includes("@")) {
        const { data, error } = await (supabase as any).rpc("email_for_username", { uname: target });
        if (error || !data) throw new Error("Enter the email on your account to reset your password.");
        target = data as string;
      }
      const { error } = await supabase.auth.resetPasswordForEmail(target, { redirectTo: `${window.location.origin}/auth` });
      if (error) throw error;
      toast({ title: "Reset link sent", description: "Check your email for a link to reset your password." });
    } catch (err: any) {
      toast({ title: "Couldn't send reset", description: err.message ?? "Try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (mode === "signup" && password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please re-enter your password.",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const emailRedirectTo = `${window.location.origin}/auth${redirectSuffix}`;
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo,
            data: {
              // Username chosen at sign-up — also used for "log in with username".
              username: username.trim(),
              // roblox_username is no longer collected, but the profile-creation
              // trigger expects the key to exist — send it empty so a profile is
              // still created on sign-up.
              roblox_username: "",
              // Discord username comes from a real Discord link (OAuth), not a
              // typed field. Stored empty here and filled when Discord is linked.
              discord_username: "",
            },
          },
        });
        if (error) throw error;
        toast({
          title: "Check your email",
          description: "Confirm your email to finish creating your account — be sure to check your spam or junk folder if you don't see it. Your first two months free are waiting!",
        });
      } else {
        // Sign in by email OR username.
        let loginEmail = identifier.trim();
        if (!loginEmail.includes("@")) {
          const { data, error } = await (supabase as any).rpc("email_for_username", { uname: loginEmail });
          if (error) throw new Error("Username sign-in isn't available yet — please use your email.");
          if (!data) throw new Error("No account found with that username.");
          loginEmail = data as string;
        }
        const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
        if (error) throw error;
        await runPostAuthActions();
        navigate(postAuthPath, { replace: true });
      }
    } catch (err: any) {
      toast({
        title: "Authentication failed",
        description: err.message ?? "Try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const busyAny = busy || !!oauthBusy;

  return (
    <div className="oversite-theme min-h-screen bg-os-bg font-body text-os-body antialiased">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
        {/* ── Left: branded panel ── */}
        <aside className="relative hidden flex-col justify-between overflow-hidden p-12 xl:p-16 lg:flex">
          <img src={containers} alt="" aria-hidden className="absolute inset-0 h-full w-full select-none object-cover" />
          <div aria-hidden className="absolute inset-0 bg-[linear-gradient(120deg,rgb(var(--os-ink)/0.94)_0%,rgb(var(--os-ink)/0.74)_52%,rgb(var(--os-bg)/0.55)_100%)]" />
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(55%_45%_at_28%_26%,rgb(var(--os-accent)/0.14),transparent_70%)]" />
          {/* hairline frame */}
          <div aria-hidden className="absolute inset-6 rounded-2xl border border-os-heading/[0.06]" />

          <Link to="/" className="relative z-10 inline-flex items-center font-display text-[18px] font-extrabold uppercase tracking-[-0.02em] text-os-heading">
            Oversite
          </Link>

          <Reveal className="relative z-10 max-w-[30ch]">
            <Mono className="text-os-accent">Operator access</Mono>
            <h2 className="mt-4 font-display text-[clamp(2.2rem,3.4vw,3.4rem)] font-bold leading-[0.98] tracking-[-0.02em] text-os-heading">
              One login.<br />Your whole fleet.
            </h2>
            <ul className="mt-8 space-y-3.5">
              {VALUE_PROPS.map((v) => (
                <li key={v} className="flex items-center gap-3 font-body text-[14px] text-os-body">
                  <span aria-hidden className="h-px w-5 flex-none bg-os-accent" />
                  {v}
                </li>
              ))}
            </ul>
          </Reveal>

          <div className="relative z-10 font-label text-[10px] uppercase tracking-[0.18em] text-os-faint">
            Est. 2025
          </div>
        </aside>

        {/* ── Right: form ── */}
        <div className="relative flex items-center justify-center overflow-hidden px-5 py-14 sm:px-10">
          {/* faint backdrop for the mobile view (no left panel there) */}
          <div aria-hidden className="pointer-events-none absolute inset-0 lg:hidden">
            <img src={containers} alt="" className="absolute inset-0 h-full w-full object-cover opacity-[0.12]" />
            <div className="absolute inset-0 bg-os-bg/85" />
          </div>

          <Link to="/" className="absolute right-5 top-5 z-20 inline-flex items-center gap-1.5 font-label text-[11px] uppercase tracking-[0.14em] text-os-faint transition-colors hover:text-os-accent sm:right-8">
            <ArrowLeft size={13} aria-hidden /> Back to site
          </Link>

          <Reveal className="relative z-10 w-full max-w-[420px]">
            {/* mobile wordmark */}
            <Link to="/" className="mb-8 inline-flex font-display text-[18px] font-extrabold uppercase tracking-[-0.02em] text-os-heading lg:hidden">
              Oversite
            </Link>

            {mode === "signup" && (
              <div className="mb-6 border-l-2 border-os-accent pl-4">
                <p className="font-display text-[15px] font-bold leading-snug text-os-heading">
                  Your first two months free
                </p>
                <p className="mt-1 font-body text-[13px] leading-relaxed text-os-body">
                  Applied automatically the moment you create your account.
                </p>
              </div>
            )}

            <Mono className="text-os-accent">{mode === "signin" ? "Welcome back" : "Join Oversite"}</Mono>
            <h1 className="mt-3 font-display text-[clamp(2rem,5vw,2.8rem)] font-extrabold leading-[0.95] tracking-[-0.02em] text-os-heading">
              {mode === "signin" ? "Sign in" : "Create your account"}
            </h1>
            <p className="mt-3 font-body text-[15px] leading-relaxed text-os-body">
              {mode === "signin"
                ? "Pick up right where you left off."
                : "We'll never spam, sell, or share your info."}
            </p>

            {/* Social */}
            <div className="mt-7 grid gap-2.5">
              <button
                type="button"
                onClick={() => signInWithProvider("discord")}
                disabled={busyAny}
                className="group inline-flex w-full items-center justify-center gap-2.5 rounded-xl border border-os-hairline/60 bg-os-surface/40 px-5 py-3 font-label text-[12px] font-semibold tracking-[0.04em] text-os-heading transition hover:border-os-accent/60 hover:bg-os-surface/70 disabled:pointer-events-none disabled:opacity-50"
              >
                {oauthBusy === "discord" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <DiscordMark />}
                Continue with Discord
              </button>
              <button
                type="button"
                onClick={() => signInWithProvider("google")}
                disabled={busyAny}
                className="group inline-flex w-full items-center justify-center gap-2.5 rounded-xl border border-os-hairline/60 bg-os-surface/40 px-5 py-3 font-label text-[12px] font-semibold tracking-[0.04em] text-os-heading transition hover:border-os-accent/60 hover:bg-os-surface/70 disabled:pointer-events-none disabled:opacity-50"
              >
                {oauthBusy === "google" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <GoogleMark />}
                Continue with Google
              </button>
            </div>

            {/* divider */}
            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-os-hairline/40" />
              <span className="font-label text-[10px] uppercase tracking-[0.18em] text-os-faint">or with email</span>
              <span className="h-px flex-1 bg-os-hairline/40" />
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              {mode === "signup" && (
                <div>
                  <label htmlFor="username" className={FIELD_LABEL}>Username</label>
                  <input id="username" type="text" required value={username} onChange={(e) => setUsername(e.target.value)} className={FIELD} placeholder="yourname" autoComplete="username" />
                </div>
              )}

              {mode === "signin" ? (
                <div>
                  <label htmlFor="identifier" className={FIELD_LABEL}>Email or username</label>
                  <input id="identifier" type="text" required value={identifier} onChange={(e) => setIdentifier(e.target.value)} className={FIELD} placeholder="you@email.com or username" autoComplete="username" />
                </div>
              ) : (
                <div>
                  <label htmlFor="email" className={FIELD_LABEL}>Email</label>
                  <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={FIELD} placeholder="you@email.com" autoComplete="email" />
                </div>
              )}

              <div>
                <label htmlFor="password" className={FIELD_LABEL}>Password</label>
                <input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className={FIELD} placeholder="••••••••" autoComplete={mode === "signup" ? "new-password" : "current-password"} />
              </div>

              {mode === "signup" && (
                <div>
                  <label htmlFor="confirm-password" className={FIELD_LABEL}>Confirm password</label>
                  <input id="confirm-password" type="password" required minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={FIELD} placeholder="••••••••" autoComplete="new-password" />
                </div>
              )}

              <button
                type="submit"
                disabled={busyAny}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-os-accent px-6 py-3.5 font-label text-[12px] font-bold uppercase tracking-[0.14em] text-os-accent-ink transition hover:brightness-105 active:translate-y-px disabled:pointer-events-none disabled:opacity-50"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
              </button>

              {mode === "signup" && (
                <p className="text-[12px] leading-relaxed text-os-faint">
                  Your Discord links automatically when you use{" "}
                  <span className="text-os-heading">Continue with Discord</span> above — or connect it
                  later in Settings. A linked Discord is required before you can purchase a bot.
                </p>
              )}
            </form>

            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
                className="font-label text-[11px] uppercase tracking-[0.12em] text-os-faint transition-colors hover:text-os-accent"
              >
                {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
              </button>
              {mode === "signup" && (
                <span className="hidden items-center gap-1.5 font-body text-[11px] text-os-faint sm:inline-flex">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                  NO SPAM, EVER
                </span>
              )}
            </div>

            {mode === "signin" && (
              <button
                type="button"
                onClick={forgotPassword}
                disabled={busyAny}
                className="mt-3 font-label text-[11px] uppercase tracking-[0.12em] text-os-faint transition-colors hover:text-os-accent disabled:opacity-50"
              >
                Forgot your password?
              </button>
            )}
          </Reveal>
        </div>
      </div>
    </div>
  );
};

export default Auth;
