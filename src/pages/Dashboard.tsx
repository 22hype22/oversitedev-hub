import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Settings as SettingsIcon,
  Mail,
  Lock,
  CreditCard,
  Link2,
  Bell,
  ShieldAlert,
  ShieldCheck,
  Loader2,
  Check,
} from "lucide-react";
import { passwordMeetsPolicy, firstUnmetRule, isPasswordBreached } from "@/lib/passwordPolicy";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SiteNav } from "@/components/marketing/SiteNav";

/**
 * Account Settings — the page the account menu's "Settings" link points to
 * (route: /dashboard). Dark oversite theme. Wires the parts that run on the
 * existing Supabase: profile, email, password, connections, notification
 * preferences and sign-out. Payment methods open Stripe's billing portal
 * (needs Stripe connected to this project to function).
 */

type NotifPrefs = {
  service: boolean;
  security: boolean;
  billing: boolean;
  support: boolean;
  weekly: boolean;
};
const DEFAULT_PREFS: NotifPrefs = {
  service: true,
  security: true,
  billing: true,
  support: true,
  weekly: false,
};

const CARD = "rounded-[18px] border border-os-hairline/30 bg-os-surface/40 overflow-hidden";
const FIELD =
  "w-full rounded-[10px] border border-os-hairline/50 bg-os-bg/60 px-3.5 py-2.5 text-[14px] text-os-heading placeholder:text-os-faint outline-none transition focus:border-os-accent/70";
const LABEL = "mb-1.5 block font-label text-[11px] uppercase tracking-[0.12em] text-os-faint";
const BTN_PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-[9px] bg-os-accent px-4 py-2.5 text-[13px] font-bold text-os-accent-ink transition hover:brightness-95 disabled:opacity-50";
const BTN_GHOST =
  "inline-flex items-center justify-center gap-2 rounded-[9px] border border-os-hairline/40 px-4 py-2.5 text-[13px] font-bold text-os-heading transition hover:bg-os-heading/[0.06] disabled:opacity-50";

/**
 * Two-factor authentication (TOTP) — enroll an authenticator app, verify with a
 * 6-digit code, or turn it off. Uses Supabase MFA; once a factor is verified,
 * sign-in asks for the code after the password.
 */
function TwoFactorCard() {
  const [factors, setFactors] = useState<Array<{ id: string; friendly_name?: string | null; created_at?: string }>>([]);
  const [loadingFactors, setLoadingFactors] = useState(true);
  const [enrolling, setEnrolling] = useState<null | { id: string; qr: string; secret: string }>(null);
  const [code, setCode] = useState("");
  const [busy2fa, setBusy2fa] = useState(false);

  const loadFactors = async () => {
    setLoadingFactors(true);
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      setFactors((data?.totp ?? []) as any);
    } catch {
      setFactors([]);
    }
    setLoadingFactors(false);
  };

  useEffect(() => { void loadFactors(); }, []);

  const startEnroll = async () => {
    setBusy2fa(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Authenticator" });
      if (error) throw error;
      setEnrolling({ id: data.id, qr: (data as any).totp?.qr_code ?? "", secret: (data as any).totp?.secret ?? "" });
      setCode("");
    } catch (e: any) {
      toast.error(e?.message || "Couldn't start 2FA setup");
    }
    setBusy2fa(false);
  };

  const confirmEnroll = async () => {
    if (!enrolling || code.trim().length < 6) return;
    setBusy2fa(true);
    try {
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: enrolling.id });
      if (chErr) throw chErr;
      const { error: vErr } = await supabase.auth.mfa.verify({ factorId: enrolling.id, challengeId: ch.id, code: code.trim() });
      if (vErr) throw vErr;
      toast.success("Two-factor authentication is on");
      setEnrolling(null);
      setCode("");
      await loadFactors();
    } catch (e: any) {
      toast.error(e?.message || "Code didn't match — try again");
    }
    setBusy2fa(false);
  };

  const cancelEnroll = async () => {
    if (enrolling) {
      try { await supabase.auth.mfa.unenroll({ factorId: enrolling.id }); } catch { /* ignore */ }
    }
    setEnrolling(null);
    setCode("");
  };

  const turnOff = async (factorId: string) => {
    setBusy2fa(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      toast.success("Two-factor authentication is off");
      await loadFactors();
    } catch (e: any) {
      toast.error(e?.message || "Couldn't turn off 2FA");
    }
    setBusy2fa(false);
  };

  const enabled = factors.length > 0;

  return (
    <div className={`mt-5 ${CARD}`}>
      <SectionHead
        title="Two-factor authentication"
        desc="A 6-digit code from your authenticator app, required after your password."
      />
      <div className="px-6 py-5">
        {loadingFactors ? (
          <p className="flex items-center gap-2 text-[13px] text-os-faint"><Loader2 size={14} className="animate-spin" /> Checking…</p>
        ) : enrolling ? (
          <div className="space-y-4">
            <p className="text-[13px] text-os-body">
              Scan this QR code with your authenticator app (Google Authenticator, 1Password, Authy…),
              then enter the 6-digit code it shows.
            </p>
            <div className="flex flex-wrap items-start gap-5">
              {enrolling.qr ? (
                <img
                  src={`data:image/svg+xml;utf8,${encodeURIComponent(enrolling.qr)}`}
                  alt="2FA QR code"
                  className="h-[164px] w-[164px] rounded-[12px] border border-os-hairline/30 bg-white p-2"
                />
              ) : null}
              <div className="min-w-[220px] flex-1 space-y-3">
                <div>
                  <label className={LABEL}>Can't scan? Enter this key</label>
                  <p className="break-all rounded-[10px] border border-os-hairline/30 bg-os-bg/40 px-3 py-2 font-mono text-[12px] text-os-body">{enrolling.secret}</p>
                </div>
                <div>
                  <label className={LABEL}>6-digit code</label>
                  <input
                    className={`${FIELD} max-w-[180px] text-center text-[18px] tracking-[0.3em]`}
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="••••••"
                  />
                </div>
              </div>
            </div>
          </div>
        ) : enabled ? (
          <div className="flex items-center justify-between gap-4 rounded-[12px] border border-os-hairline/30 bg-os-bg/40 px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-[10px] border border-os-hairline/40 bg-os-bg/60 text-os-good">
                <ShieldCheck size={16} />
              </span>
              <div>
                <p className="text-[14px] font-semibold text-os-heading">Two-factor is on</p>
                <p className="text-[12px] text-os-faint">Signing in asks for a code from your authenticator app.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4 rounded-[12px] border border-os-hairline/30 bg-os-bg/40 px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-[10px] border border-os-hairline/40 bg-os-bg/60 text-os-accent">
                <ShieldCheck size={16} />
              </span>
              <div>
                <p className="text-[14px] font-semibold text-os-heading">Two-factor is off</p>
                <p className="text-[12px] text-os-faint">Add an authenticator app so a stolen password isn't enough to get in.</p>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t border-os-hairline/20 bg-os-bg/30 px-6 py-3.5">
        {enrolling ? (
          <>
            <button onClick={cancelEnroll} disabled={busy2fa} className={BTN_GHOST}>Cancel</button>
            <button onClick={confirmEnroll} disabled={busy2fa || code.length < 6} className={BTN_PRIMARY}>
              {busy2fa && <Loader2 size={14} className="animate-spin" />} Verify &amp; turn on
            </button>
          </>
        ) : enabled ? (
          <button onClick={() => turnOff(factors[0].id)} disabled={busy2fa} className={BTN_GHOST}>
            {busy2fa && <Loader2 size={14} className="animate-spin" />} Turn off
          </button>
        ) : (
          <button onClick={startEnroll} disabled={busy2fa || loadingFactors} className={BTN_PRIMARY}>
            {busy2fa && <Loader2 size={14} className="animate-spin" />} Turn on two-factor
          </button>
        )}
      </div>
    </div>
  );
}

function SectionHead({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="px-6 pt-5">
      <h2 className="text-[15px] font-bold text-os-heading">{title}</h2>
      <p className="mt-0.5 text-[12.5px] text-os-faint">{desc}</p>
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-[42px] flex-none rounded-full transition ${on ? "bg-os-accent" : "bg-os-hairline/60"}`}
    >
      <span
        className={`absolute top-[3px] h-[18px] w-[18px] rounded-full transition-all ${on ? "left-[21px] bg-os-accent-ink" : "left-[3px] bg-[#cfd8df]"}`}
      />
    </button>
  );
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [preferredName, setPreferredName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);
  const [prefsBusy, setPrefsBusy] = useState(false);

  const [identities, setIdentities] = useState<string[]>([]);
  const [portalBusy, setPortalBusy] = useState(false);
  const [signOutBusy, setSignOutBusy] = useState(false);

  const initials = useMemo(() => {
    const base = displayName || user?.email || "?";
    return base.trim().charAt(0).toUpperCase();
  }, [displayName, user?.email]);

  // Gate: bounce to /auth if not signed in.
  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [loading, user, navigate]);

  // Load profile + notification prefs + linked identities.
  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, preferred_name, notification_preferences")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!active) return;
      if (profile) {
        setDisplayName((profile as any).display_name ?? "");
        setPreferredName((profile as any).preferred_name ?? "");
        const p = (profile as any).notification_preferences;
        if (p && typeof p === "object") setPrefs({ ...DEFAULT_PREFS, ...p });
      }
      try {
        const { data } = await supabase.auth.getUserIdentities();
        if (active && data?.identities) {
          setIdentities(data.identities.map((i) => i.provider));
        }
      } catch {
        /* identities API unavailable — leave empty */
      }
    })();
    return () => {
      active = false;
    };
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    const payload = {
      user_id: user.id,
      display_name: displayName.trim() || null,
      preferred_name: preferredName.trim() || null,
    };
    const { error } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "user_id" });
    setSavingProfile(false);
    if (error) return toast.error(error.message || "Couldn't save profile");
    toast.success("Profile saved");
  };

  const updateEmail = async () => {
    if (!newEmail || newEmail === user?.email) return;
    setEmailBusy(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    setEmailBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Confirmation sent — check both your old and new inbox");
    setNewEmail("");
  };

  const updatePassword = async () => {
    // Same rules as sign-up — a password change must not be the weak back door.
    if (!passwordMeetsPolicy(newPassword)) {
      return toast.error(`Password doesn't meet the requirements — still needed: ${firstUnmetRule(newPassword)}.`);
    }
    if (newPassword !== confirmPassword) return toast.error("Passwords don't match");
    setPwBusy(true);
    if (await isPasswordBreached(newPassword)) {
      setPwBusy(false);
      return toast.error("That password appears in known data breaches — pick a different one.");
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPwBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    setNewPassword("");
    setConfirmPassword("");
  };

  const savePrefs = async (next: NotifPrefs) => {
    setPrefs(next);
    if (!user) return;
    setPrefsBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ notification_preferences: next })
      .eq("user_id", user.id);
    setPrefsBusy(false);
    if (error) toast.error("Couldn't save notification preferences");
  };

  const connect = async (provider: "discord" | "google") => {
    try {
      const { error } = await (supabase.auth as any).linkIdentity({
        provider,
        options: { redirectTo: `${window.location.origin}/dashboard` },
      });
      if (error) throw error;
    } catch (e: any) {
      toast.error(e?.message || "Couldn't start linking. Manual linking may be disabled.");
    }
  };

  const openPortal = async () => {
    setPortalBusy(true);
    const { data, error } = await supabase.functions.invoke("customer-portal", {
      body: { returnUrl: window.location.origin + "/dashboard" },
    });
    setPortalBusy(false);
    if (error || !(data as any)?.url) {
      return toast.error("Couldn't open billing. You may not have a payment method yet.");
    }
    window.location.href = (data as any).url as string;
  };

  const signOutEverywhere = async () => {
    setSignOutBusy(true);
    await supabase.auth.signOut({ scope: "global" });
    navigate("/", { replace: true });
  };

  if (loading || !user) {
    // Same self-drawing ridge as the route + dashboard loaders so every
    // loading state in the app reads as one system.
    return (
      <div
        role="status"
        aria-label="Loading"
        className="grid min-h-screen place-items-center"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 115%, rgba(201,219,230,.10), transparent 55%), linear-gradient(180deg, #293038, #1a1f25)",
        }}
      >
        <style>{`
          @keyframes os-ridge-draw{0%{stroke-dashoffset:340}55%{stroke-dashoffset:0}78%{stroke-dashoffset:0}100%{stroke-dashoffset:-340}}
          .os-ridge path{fill:none;stroke-linecap:round;stroke-linejoin:round;stroke-width:2}
          .os-ridge .draw{stroke:#C9DBE6;stroke-dasharray:340;stroke-dashoffset:340;animation:os-ridge-draw 2.6s cubic-bezier(.45,.05,.35,1) infinite;filter:drop-shadow(0 0 10px rgba(201,219,230,.35))}
          .os-ridge .ghost{stroke:rgba(201,219,230,.14)}
          @media (prefers-reduced-motion: reduce){.os-ridge .draw{animation:none;stroke-dashoffset:0}}
        `}</style>
        <svg className="os-ridge" width="190" height="74" viewBox="0 0 190 74" style={{ overflow: "visible" }} aria-hidden>
          <path className="ghost" d="M4 70 L44 26 L62 44 L95 6 L128 42 L148 24 L186 70" />
          <path className="draw" d="M4 70 L44 26 L62 44 L95 6 L128 42 L148 24 L186 70" />
        </svg>
      </div>
    );
  }

  const NOTIF_ROWS: { key: keyof NotifPrefs; name: string; desc: string }[] = [
    { key: "service", name: "Bot & service alerts", desc: "Downtime, deploys, important status" },
    { key: "security", name: "Account & security", desc: "Logins, email / password changes" },
    { key: "billing", name: "Billing & payments", desc: "Receipts, renewals, failed charges" },
    { key: "support", name: "Support replies", desc: "Responses to your tickets" },
    { key: "weekly", name: "Weekly summary", desc: "Usage & performance digest" },
  ];

  return (
    <div className="oversite-theme min-h-screen bg-os-bg font-body text-os-body antialiased">
      <SiteNav />
      <main className="mx-auto w-full max-w-[880px] px-5 pb-24 pt-28">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-os-accent/15 text-os-accent">
            <SettingsIcon size={18} />
          </span>
          <div>
            <h1 className="text-[30px] font-extrabold tracking-[-0.02em] text-os-heading">Settings</h1>
            <p className="text-[13px] text-os-faint">Manage your account, billing, security and notifications.</p>
          </div>
        </div>

        {/* PROFILE */}
        <div className={`mt-6 ${CARD}`}>
          <SectionHead title="Profile" desc="How you show up across the dashboard." />
          <div className="space-y-4 px-6 py-5">
            <div className="flex items-center gap-4">
              <div className="grid h-[60px] w-[60px] place-items-center rounded-full border border-os-hairline/30 bg-gradient-to-br from-os-surface-2 to-os-surface text-[22px] font-extrabold text-os-heading">
                {initials}
              </div>
              <div>
                <button type="button" onClick={() => toast("Avatar upload is coming soon")} className={BTN_GHOST}>
                  Upload avatar
                </button>
                <p className="mt-1.5 text-[12px] text-os-faint">PNG or JPG, up to 2&nbsp;MB</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={LABEL}>Preferred name</label>
                <input className={FIELD} value={preferredName} onChange={(e) => setPreferredName(e.target.value)} placeholder="What should we call you?" />
              </div>
              <div>
                <label className={LABEL}>Display name</label>
                <input className={FIELD} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Shown across the dashboard" />
              </div>
            </div>
          </div>
          <div className="flex justify-end border-t border-os-hairline/20 bg-os-bg/30 px-6 py-3.5">
            <button onClick={saveProfile} disabled={savingProfile} className={BTN_PRIMARY}>
              {savingProfile && <Loader2 size={14} className="animate-spin" />} Save profile
            </button>
          </div>
        </div>

        {/* EMAIL */}
        <div className={`mt-5 ${CARD}`}>
          <SectionHead title="Email" desc="Used for sign-in and important account notices." />
          <div className="space-y-4 px-6 py-5">
            <div>
              <label className={LABEL}>Current email</label>
              <input className={`${FIELD} opacity-60`} value={user.email ?? ""} disabled />
            </div>
            <div>
              <label className={LABEL}>New email</label>
              <input className={FIELD} type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="you@example.com" />
            </div>
          </div>
          <div className="flex justify-end border-t border-os-hairline/20 bg-os-bg/30 px-6 py-3.5">
            <button onClick={updateEmail} disabled={emailBusy} className={BTN_PRIMARY}>
              {emailBusy ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />} Update email
            </button>
          </div>
        </div>

        {/* PASSWORD */}
        <div className={`mt-5 ${CARD}`}>
          <SectionHead title="Password" desc="Use a strong, unique password." />
          <div className="space-y-4 px-6 py-5">
            <div>
              <label className={LABEL}>New password</label>
              <input className={FIELD} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <div>
              <label className={LABEL}>Confirm new password</label>
              <input className={FIELD} type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" />
            </div>
          </div>
          <div className="flex justify-end border-t border-os-hairline/20 bg-os-bg/30 px-6 py-3.5">
            <button onClick={updatePassword} disabled={pwBusy} className={BTN_PRIMARY}>
              {pwBusy ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />} Update password
            </button>
          </div>
        </div>

        {/* TWO-FACTOR AUTHENTICATION */}
        <TwoFactorCard />

        {/* PAYMENT METHODS */}
        <div className={`mt-5 ${CARD}`}>
          <SectionHead title="Payment methods" desc="Cards used for bot hosting and renewals." />
          <div className="px-6 py-5">
            <div className="flex items-center justify-between gap-4 rounded-[12px] border border-os-hairline/30 bg-os-bg/40 px-4 py-4">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-[10px] border border-os-hairline/40 bg-os-bg/60 text-os-accent">
                  <CreditCard size={16} />
                </span>
                <div>
                  <p className="text-[14px] font-semibold text-os-heading">Manage payment methods</p>
                  <p className="text-[12px] text-os-faint">Add, remove or set a default card · view invoices</p>
                </div>
              </div>
              <button onClick={openPortal} disabled={portalBusy} className={BTN_PRIMARY}>
                {portalBusy && <Loader2 size={14} className="animate-spin" />} Open billing
              </button>
            </div>
          </div>
        </div>

        {/* CONNECTIONS */}
        <div className={`mt-5 ${CARD}`}>
          <SectionHead title="Connections" desc="Link accounts to sign in faster." />
          <div className="px-6 py-2">
            {(["discord", "google"] as const).map((p, i) => {
              const linked = identities.includes(p);
              return (
                <div
                  key={p}
                  className={`flex items-center justify-between gap-4 py-4 ${i > 0 ? "border-t border-os-hairline/15" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="grid h-[38px] w-[38px] place-items-center rounded-[10px] border border-os-hairline/40 bg-os-bg/60 text-os-heading">
                      <Link2 size={16} />
                    </span>
                    <div>
                      <p className="text-[14px] font-semibold capitalize text-os-heading">{p}</p>
                      <p className="text-[12px] text-os-faint">{linked ? "Connected" : "Not connected"}</p>
                    </div>
                  </div>
                  {linked ? (
                    <span className="rounded-full bg-[#78c88c]/15 px-3 py-1 font-label text-[10px] font-bold uppercase tracking-[0.1em] text-[#8fd3a3]">
                      Connected
                    </span>
                  ) : (
                    <button onClick={() => connect(p)} className={BTN_GHOST}>Connect</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* NOTIFICATIONS */}
        <div className={`mt-5 ${CARD}`}>
          <SectionHead title="Notifications" desc="Choose what Oversite emails you about." />
          <div className="px-6 py-2">
            {NOTIF_ROWS.map((row, i) => (
              <div
                key={row.key}
                className={`flex items-center justify-between gap-4 py-4 ${i > 0 ? "border-t border-os-hairline/15" : ""}`}
              >
                <div>
                  <p className="text-[14px] font-semibold text-os-heading">{row.name}</p>
                  <p className="text-[12px] text-os-faint">{row.desc}</p>
                </div>
                <Toggle on={prefs[row.key]} onChange={(v) => savePrefs({ ...prefs, [row.key]: v })} />
              </div>
            ))}
          </div>
          {prefsBusy && (
            <div className="flex items-center gap-2 px-6 pb-4 text-[11px] text-os-faint">
              <Loader2 size={12} className="animate-spin" /> Saving…
            </div>
          )}
        </div>

        {/* DANGER ZONE */}
        <div className={`mt-5 rounded-[18px] border border-[#dc5a5a]/30 bg-os-surface/40 overflow-hidden`}>
          <div className="px-6 pt-5">
            <h2 className="flex items-center gap-2 text-[15px] font-bold text-[#e98b8b]">
              <ShieldAlert size={16} /> Danger zone
            </h2>
            <p className="mt-0.5 text-[12.5px] text-os-faint">Irreversible actions.</p>
          </div>
          <div className="px-6 py-2">
            <div className="flex items-center justify-between gap-4 py-4">
              <div>
                <p className="text-[14px] font-semibold text-os-heading">Sign out everywhere</p>
                <p className="text-[12px] text-os-faint">End all active sessions on every device</p>
              </div>
              <button onClick={signOutEverywhere} disabled={signOutBusy} className={BTN_GHOST}>
                {signOutBusy && <Loader2 size={14} className="animate-spin" />} Sign out all
              </button>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-os-hairline/15 py-4">
              <div>
                <p className="text-[14px] font-semibold text-os-heading">Delete account</p>
                <p className="text-[12px] text-os-faint">Permanently remove your account and data</p>
              </div>
              <button
                onClick={() => toast("Account deletion isn't enabled yet — contact support to remove your account.")}
                className="inline-flex items-center justify-center gap-2 rounded-[9px] border border-[#dc5a5a]/50 px-4 py-2.5 text-[13px] font-bold text-[#e98b8b] transition hover:bg-[#dc5a5a]/10"
              >
                Delete
              </button>
            </div>
          </div>
        </div>

        {/* LEGAL */}
        <div className="mt-10 flex flex-wrap justify-center gap-x-7 gap-y-2 border-t border-os-hairline/15 pt-6">
          <Link to="/terms#privacy" className="text-[12.5px] text-os-faint transition-colors hover:text-os-heading">Privacy Policy</Link>
          <Link to="/terms#terms" className="text-[12.5px] text-os-faint transition-colors hover:text-os-heading">Terms of Use</Link>
          <Link to="/terms#refunds" className="text-[12.5px] text-os-faint transition-colors hover:text-os-heading">Sales &amp; Refunds</Link>
        </div>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-os-faint">
          <Check size={12} className="text-os-accent" /> © Oversite. All rights reserved.
        </p>
      </main>
    </div>
  );
};

export default Dashboard;
