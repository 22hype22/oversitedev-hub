import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, Search, Bell, CircleUser, LayoutDashboard, Settings, ShieldCheck, LogOut, LogIn, UserPlus } from "lucide-react";
import { Command } from "cmdk";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBotNotifications } from "@/hooks/useBotNotifications";
import { HelpLounge } from "./HelpLounge";

const ICON_BTN =
  "grid h-10 w-10 place-items-center rounded-full text-os-heading transition-colors hover:bg-os-heading/[0.07] hover:text-os-accent";

const NAV_LINKS = [
  { to: "/", label: "Home" },
  { to: "/process", label: "Our Process" },
  { to: "/bots", label: "Bots" },
];
const NAV_HELP = { to: "#faq", label: "Help" };

type Notif = { title: string; body: string; time: string; unread?: boolean };
/** Compact relative time for the notification list (e.g. "Just now", "2h", "3d"). */
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return `${Math.floor(d / 7)}w`;
}

type SearchItem = { label: string; to: string; kind: string; keywords?: string };
const SEARCH_ITEMS: SearchItem[] = [
  { label: "Home", to: "/", kind: "Page", keywords: "landing start" },
  { label: "Process", to: "/process", kind: "Page", keywords: "how it works onboarding" },
  { label: "Products", to: "/products", kind: "Page", keywords: "plans catalog pricing" },
  { label: "Bots", to: "/bots", kind: "Page", keywords: "discord bots fleet" },
  { label: "Protection", to: "/bots", kind: "Bot", keywords: "anti-raid verification moderation" },
  { label: "Support", to: "/bots", kind: "Bot", keywords: "tickets transcripts help" },
  { label: "Utilities", to: "/bots", kind: "Bot", keywords: "levels giveaways radio dj" },
  { label: "Oversite Radio", to: "/bots", kind: "Feature", keywords: "music live ai dj carla" },
  { label: "Pricing", to: "/products", kind: "Action", keywords: "cost plans access tiers" },
  { label: "Deploy a bot", to: "/auth", kind: "Action", keywords: "start setup add" },
  { label: "Sign in", to: "/auth", kind: "Action", keywords: "account login" },
];

function NotifPanel({
  notifs,
  onMarkAll,
  onMarkOne,
  onClose,
}: {
  notifs: Notif[];
  onMarkAll: () => void;
  onMarkOne: (idx: number) => void;
  onClose: () => void;
}) {
  const unread = notifs.filter((n) => n.unread).length;
  return (
    <>
      <button aria-hidden tabIndex={-1} onClick={onClose} className="fixed inset-0 z-40 cursor-default" />
      {/* Wrapper holds the centering transform; the inner panel runs the
          fade-in (which animates translateY) so the centering is never lost. */}
      <div className="absolute left-1/2 top-[calc(100%+0.85rem)] z-50 -translate-x-1/2">
        <div className="w-[330px] overflow-hidden rounded-2xl border border-os-hairline/40 bg-os-bg shadow-[0_24px_60px_-22px_rgb(0_0_0/0.85)] motion-safe:animate-fade-in">
        {/* caret pointing up to the bell */}
        <span aria-hidden className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-os-hairline/40 bg-os-bg" />

        <div className="relative flex items-center justify-between gap-3 border-b border-os-hairline/40 px-4 py-3">
          <span className="font-label text-[11px] uppercase tracking-[0.18em] text-os-faint">Notifications</span>
          {unread > 0 && (
            <span className="rounded-full bg-os-accent/15 px-2 py-0.5 font-label text-[10px] font-bold tracking-[0.08em] text-os-accent">{unread} new</span>
          )}
        </div>

        <ul className="max-h-[60vh] overflow-y-auto py-1">
          {notifs.length === 0 && (
            <li className="px-4 py-8 text-center font-body text-[12.5px] text-os-faint">
              You're all caught up — no notifications yet.
            </li>
          )}
          {notifs.map((n, i) => (
            <li key={n.title}>
              <button
                type="button"
                onClick={() => onMarkOne(i)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-os-heading/[0.05]"
              >
                <span className={cn("mt-1.5 h-2 w-2 flex-none rounded-full", n.unread ? "bg-os-accent" : "bg-transparent ring-1 ring-inset ring-os-hairline")} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className={cn("truncate font-display text-[13px] font-bold tracking-[-0.01em]", n.unread ? "text-os-heading" : "text-os-body")}>{n.title}</span>
                    <span className="flex-none font-label text-[9px] uppercase tracking-[0.12em] text-os-faint">{n.time}</span>
                  </span>
                  <span className="mt-1 block font-body text-[12.5px] leading-snug text-os-faint">{n.body}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={onMarkAll}
          disabled={unread === 0}
          className="block w-full border-t border-os-hairline/40 px-4 py-3 text-center font-label text-[11px] font-bold uppercase tracking-[0.14em] text-os-accent transition-colors hover:bg-os-heading/[0.05] disabled:cursor-default disabled:text-os-faint disabled:hover:bg-transparent"
        >
          {unread === 0 ? "All caught up" : "Mark all as read"}
        </button>
        </div>
      </div>
    </>
  );
}

function AccountMenu({
  email,
  isAdmin,
  onSignOut,
  onClose,
}: {
  email: string | null;
  isAdmin: boolean;
  onSignOut: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <button aria-hidden tabIndex={-1} onClick={onClose} className="fixed inset-0 z-40 cursor-default" />
      {/* Centering lives on the wrapper so the inner panel's fade-in (which
          animates translateY) never clobbers it. Falls back to right-aligned on
          narrow screens so it can't run off the edge under the rightmost icon. */}
      <div className="absolute left-1/2 top-[calc(100%+0.85rem)] z-50 -translate-x-1/2 max-[900px]:left-auto max-[900px]:right-0 max-[900px]:translate-x-0">
        <div className="relative w-[248px] overflow-hidden rounded-2xl border border-os-hairline/40 bg-os-bg shadow-[0_24px_60px_-22px_rgb(0_0_0/0.85)] motion-safe:animate-fade-in">
          <span aria-hidden className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-os-hairline/40 bg-os-bg max-[900px]:left-auto max-[900px]:right-5 max-[900px]:translate-x-0" />
          {email ? (
            <>
              <div className="border-b border-os-hairline/40 px-4 py-3">
                <p className="font-label text-[10px] uppercase tracking-[0.18em] text-os-faint">Signed in as</p>
                <p className="mt-1 truncate font-body text-[13px] text-os-heading">{email}</p>
              </div>
              <div className="py-1.5">
                <Link to="/dashboard" onClick={onClose} className="flex items-center gap-3 px-4 py-2.5 font-body text-[13px] text-os-body transition-colors hover:bg-os-heading/[0.05] hover:text-os-heading">
                  <Settings size={15} className="text-os-faint" aria-hidden /> Settings
                </Link>
                <Link to="/bot-dashboard" onClick={onClose} className="flex items-center gap-3 px-4 py-2.5 font-body text-[13px] text-os-body transition-colors hover:bg-os-heading/[0.05] hover:text-os-heading">
                  <LayoutDashboard size={15} className="text-os-faint" aria-hidden /> Dashboard
                </Link>
                {isAdmin && (
                  <Link to="/admin" onClick={onClose} className="flex items-center gap-3 px-4 py-2.5 font-body text-[13px] text-os-body transition-colors hover:bg-os-heading/[0.05] hover:text-os-heading">
                    <ShieldCheck size={15} className="text-os-accent" aria-hidden /> Admin
                  </Link>
                )}
              </div>
              <button
                type="button"
                onClick={onSignOut}
                className="flex w-full items-center gap-3 border-t border-os-hairline/40 px-4 py-3 text-left font-label text-[11px] font-bold uppercase tracking-[0.12em] text-os-accent transition-colors hover:bg-os-heading/[0.05]"
              >
                <LogOut size={15} aria-hidden /> Sign out
              </button>
            </>
          ) : (
            <div className="py-1.5">
              <Link to="/auth" onClick={onClose} className="flex items-center gap-3 px-4 py-2.5 font-body text-[13px] text-os-body transition-colors hover:bg-os-heading/[0.05] hover:text-os-heading">
                <LogIn size={15} className="text-os-faint" aria-hidden /> Sign in
              </Link>
              <Link to="/auth?mode=signup" onClick={onClose} className="flex items-center gap-3 px-4 py-2.5 font-body text-[13px] text-os-body transition-colors hover:bg-os-heading/[0.05] hover:text-os-heading">
                <UserPlus size={15} className="text-os-faint" aria-hidden /> Create account
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, isAdmin } = useAuth();
  const { items: notifItems, unread, markAllRead, markRead } = useBotNotifications();
  const notifs: Notif[] = notifItems.map((n) => ({
    title: n.title,
    body: n.body,
    time: timeAgo(n.created_at),
    unread: !n.read_at,
  }));
  const inputRef = useRef<HTMLInputElement>(null);

  const signOut = async () => {
    await supabase.auth.signOut();
    setAccountOpen(false);
    navigate("/");
  };

  // The current route's tab reads bright icy-white; the rest sit in the
  // dimmer body grey so it's obvious which page you're on.
  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ⌘K / Ctrl-K toggles the inline search, Esc closes it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      } else if (e.key === "Escape") {
        setSearchOpen(false);
        setNotifOpen(false);
        setAccountOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  const runSearch = (to: string) => {
    setSearchOpen(false);
    navigate(to);
  };

  return (
    <>
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-3 md:pt-4">
      {/* click-away closer while searching */}
      {searchOpen && (
        <button
          type="button"
          aria-hidden
          tabIndex={-1}
          onClick={() => setSearchOpen(false)}
          className="fixed inset-0 -z-10 cursor-default"
        />
      )}

      <div className="w-full max-w-[880px]">
        <div
          className={cn(
            "relative flex h-14 items-center justify-between gap-2 rounded-full border pl-5 pr-2 transition-all duration-300",
            "border-transparent backdrop-blur-sm",
            "shadow-[0_12px_40px_-14px_rgb(0_0_0/0.6)]",
            searchOpen ? "bg-os-bg/95" : scrolled ? "bg-os-bg/55" : "bg-os-bg/35",
          )}
        >
          {/* ── default content (logo / tabs / icons) ── */}
          <Link
            to="/"
            className="font-display text-[18px] font-extrabold uppercase tracking-[-0.02em] text-os-heading"
          >
            Oversite
          </Link>

          <nav
            className={cn(
              "absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 transition-all duration-300 md:flex",
              searchOpen && "pointer-events-none -translate-y-1 opacity-0",
            )}
          >
            {NAV_LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                aria-current={isActive(l.to) ? "page" : undefined}
                className={cn(
                  "rounded-full px-3.5 py-1.5 font-label text-[11px] uppercase tracking-[0.16em] transition-colors hover:bg-os-heading/[0.07]",
                  isActive(l.to) ? "text-os-heading" : "text-os-body hover:text-os-accent",
                )}
              >
                {l.label}
              </Link>
            ))}
            <span aria-hidden className="mx-2 h-4 w-px bg-os-heading/30" />
            <button type="button" onClick={() => setHelpOpen(true)} className="rounded-full px-3.5 py-1.5 font-label text-[11px] uppercase tracking-[0.16em] text-os-body transition-colors hover:bg-os-heading/[0.07] hover:text-os-accent">
              {NAV_HELP.label}
            </button>
          </nav>

          <div className="hidden items-center gap-0.5 md:flex">
            <button
              type="button"
              aria-label="Search"
              onClick={() => setSearchOpen(true)}
              className={cn(ICON_BTN, "transition-opacity duration-200", searchOpen && "pointer-events-none opacity-0")}
            >
              <Search size={18} />
            </button>
            <div className="relative">
              <button
                type="button"
                aria-label="Notifications"
                aria-expanded={notifOpen}
                onClick={() => setNotifOpen((v) => !v)}
                className={cn(ICON_BTN, "relative")}
              >
                <Bell size={18} />
                {unread > 0 && <span aria-hidden className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-os-accent ring-2 ring-os-bg" />}
              </button>
              {notifOpen && (
                <NotifPanel
                  notifs={notifs}
                  onMarkAll={markAllRead}
                  onMarkOne={(idx) => {
                    const id = notifItems[idx]?.id;
                    if (id) markRead(id);
                  }}
                  onClose={() => setNotifOpen(false)}
                />
              )}
            </div>
            <div className="relative">
              <button
                type="button"
                aria-label="Account"
                aria-expanded={accountOpen}
                onClick={() => setAccountOpen((v) => !v)}
                className={cn(ICON_BTN, "relative", user && "text-os-accent")}
              >
                <CircleUser size={19} />
                {user && <span aria-hidden className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-os-accent ring-2 ring-os-bg" />}
              </button>
              {accountOpen && (
                <AccountMenu email={user?.email ?? null} isAdmin={isAdmin} onSignOut={signOut} onClose={() => setAccountOpen(false)} />
              )}
            </div>
          </div>

          {/* mobile */}
          <div className={cn("flex items-center gap-0.5 transition-opacity duration-200 md:hidden", searchOpen && "pointer-events-none opacity-0")}>
            <button type="button" aria-label="Search" onClick={() => setSearchOpen(true)} className={ICON_BTN}>
              <Search size={18} />
            </button>
            <button type="button" className={cn(ICON_BTN, "text-os-heading")} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

          {/* ── inline search: the field's left edge sweeps in from the right,
              so the magnifier slides left and stops just past the wordmark ── */}
          {searchOpen && (
            <Command label="Site search" className="absolute inset-0">
              <div className="absolute inset-y-0 left-[126px] right-2 flex items-center motion-safe:animate-[nav-search-sweep_550ms_cubic-bezier(0.5,0,0.2,1)] md:right-[96px]">
                <Search size={18} aria-hidden className="mr-3 shrink-0 text-os-accent" />
                <Command.Input
                  ref={inputRef}
                  placeholder="Search pages, bots, actions…"
                  className="h-full min-w-0 flex-1 bg-transparent font-label text-[13px] uppercase tracking-[0.06em] text-os-heading caret-os-accent outline-none placeholder:text-os-faint placeholder:normal-case placeholder:tracking-normal"
                />
                <button type="button" aria-label="Close search" onClick={() => setSearchOpen(false)} className={cn(ICON_BTN, "shrink-0")}>
                  <X size={18} />
                </button>
              </div>

              <Command.List className="absolute left-0 right-0 top-[calc(100%+0.6rem)] max-h-[60vh] overflow-y-auto rounded-2xl border border-os-hairline/40 bg-os-bg p-2 shadow-[0_18px_50px_-18px_rgb(0_0_0/0.8)] motion-safe:animate-fade-in">
                <Command.Empty className="px-3 py-8 text-center font-label text-[11px] uppercase tracking-[0.16em] text-os-faint">
                  No matches
                </Command.Empty>
                {SEARCH_ITEMS.map((it) => (
                  <Command.Item
                    key={`${it.kind}-${it.label}`}
                    value={`${it.label} ${it.keywords ?? ""}`}
                    onSelect={() => runSearch(it.to)}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 font-label text-[12px] uppercase tracking-[0.08em] text-os-body transition-colors data-[selected=true]:bg-os-heading/[0.08] data-[selected=true]:text-os-heading"
                  >
                    <span className="truncate">{it.label}</span>
                    <span className="shrink-0 text-[10px] tracking-[0.14em] text-os-faint">{it.kind}</span>
                  </Command.Item>
                ))}
              </Command.List>
            </Command>
          )}
        </div>

        {/* Mobile floating glass menu */}
        {open && !searchOpen && (
          <div className="mt-2 rounded-3xl border border-os-hairline/30 bg-os-bg/70 p-2 shadow-[0_12px_40px_-14px_rgb(0_0_0/0.6)] backdrop-blur-sm md:hidden">
            <div className="flex flex-col gap-1">
              {NAV_LINKS.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(l.to) ? "page" : undefined}
                  className={cn(
                    "rounded-2xl px-4 py-3 font-label text-[13px] uppercase tracking-[0.16em] transition-colors hover:bg-os-heading/[0.07]",
                    isActive(l.to) ? "text-os-heading" : "text-os-body hover:text-os-accent",
                  )}
                >
                  {l.label}
                </Link>
              ))}
              <button type="button" onClick={() => { setOpen(false); setHelpOpen(true); }} className="rounded-2xl px-4 py-3 text-left font-label text-[13px] uppercase tracking-[0.16em] text-os-body transition-colors hover:bg-os-heading/[0.07] hover:text-os-accent">
                {NAV_HELP.label}
              </button>

              <span aria-hidden className="my-1 h-px bg-os-hairline/40" />
              {user ? (
                <>
                  <Link to="/dashboard" onClick={() => setOpen(false)} className="rounded-2xl px-4 py-3 font-label text-[13px] uppercase tracking-[0.16em] text-os-body transition-colors hover:bg-os-heading/[0.07] hover:text-os-accent">
                    Dashboard
                  </Link>
                  <Link to="/bot-dashboard" onClick={() => setOpen(false)} className="rounded-2xl px-4 py-3 font-label text-[13px] uppercase tracking-[0.16em] text-os-body transition-colors hover:bg-os-heading/[0.07] hover:text-os-accent">
                    Bot orders
                  </Link>
                  <button type="button" onClick={() => { setOpen(false); signOut(); }} className="rounded-2xl px-4 py-3 text-left font-label text-[13px] uppercase tracking-[0.16em] text-os-accent transition-colors hover:bg-os-heading/[0.07]">
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link to="/auth" onClick={() => setOpen(false)} className="rounded-2xl px-4 py-3 font-label text-[13px] uppercase tracking-[0.16em] text-os-body transition-colors hover:bg-os-heading/[0.07] hover:text-os-accent">
                    Sign in
                  </Link>
                  <Link to="/auth?mode=signup" onClick={() => setOpen(false)} className="mt-1 rounded-2xl bg-os-accent px-4 py-3 text-center font-label text-[12px] font-bold uppercase tracking-[0.14em] text-os-accent-ink">
                    Create account
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
    <HelpLounge open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}
