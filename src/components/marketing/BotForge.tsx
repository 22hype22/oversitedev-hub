import { useEffect, useMemo, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { toast as sonnerToast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBotAvailability, setBotAvailability, type BotStatus } from "@/hooks/useBotAvailability";
import { useOwnedBots } from "@/hooks/useOwnedBots";
import { useBotSalesMode } from "@/hooks/useBotSalesMode";
import { useAddonOverrides, setAddonIncluded } from "@/hooks/useAddonOverrides";
import { CheckoutDialog, type CheckoutItem } from "@/components/CheckoutDialog";
import { BotStockIndicator } from "@/components/site/BotStockIndicator";
import { useBotStockCount } from "@/hooks/useBotStockCount";
import { filterAddonsForBase } from "@/lib/addonCategories";
import {
  Shield,
  LifeBuoy,
  Wrench,
  Sparkles,
  Palette,
  BarChart3,
  Globe,
  Database,
  Bell,
  Bot,
  Check,
  ArrowRight,
  Send,
  CreditCard,
  Lock as LockIcon,
  Upload,
  ImagePlus,
  MoreHorizontal,
  Smile,
  Gift,
  UserCheck,
  Megaphone,
  Music,
  Calendar,
  Code2,
  Zap,
  Ban,
  Link2,
  AtSign,
  EyeOff,
  Timer,
  FileText,
  Globe2,
  VolumeX,
  UserX,
  MailWarning,
  TextCursorInput,
  AlertTriangle,
  UserPlus,
  Smile as SmileIcon,
  Paperclip,
  Ticket,
  Hand,
  HelpCircle,
  BookOpen,
  Smile as ReactIcon,
  Mail,
  ShieldCheck,
  Flag,
  Reply,
  Lightbulb,
  ListChecks,
  Compass,
  Headphones,
  Star,
  Moon,
  BarChart2,
  ClipboardList,
  Hash,
  Clock,
  UserCog,
  Lock,
  Plus,
  AlarmClock,
  Trash2,
  Tag,
  Languages,
  Save,
  Settings2,
  MessageSquare,
  Gamepad2,
} from "lucide-react";

type Base = {
  id: string;
  name: string;
  tagline: string;
  icon: typeof Shield;
  price: number;
  oldPrice?: number;
  included: string[];
};

type Addon = {
  id: string;
  name: string;
  desc: string;
  icon: typeof Palette;
  price: number;
  oldPrice?: number;
};

const BASES: Base[] = [
  {
    id: "protection",
    name: "Oversite Protection",
    tagline: "Automod, anti-raid, and a full mod toolkit.",
    icon: Shield,
    price: 99,
    oldPrice: 149,
    included: [
      "Verification system",
      "Warn, mute, ban, kick",
      "Anti-spam & anti-raid",
      "Phishing link detection",
      "Advanced logging — edits, deletes, activity",
      "NSFW invite & avatar scanning",
      "Auto-escalating warnings",
      "Channel lockdown & temp-bans",
    ],
  },
  {
    id: "support",
    name: "Oversite Support",
    tagline: "Tickets, appeals, reports, and welcomes.",
    icon: LifeBuoy,
    price: 99,
    oldPrice: 149,
    included: [
      "Ticket system (unlimited categories)",
      "Claim system",
      "Ban appeals & member reports",
      "Welcome / goodbye messages",
      "Full ticket transcripts & logs",
      "Staff performance tracking",
      "Priority flagging & auto-close",
      "Anonymous reporting",
    ],
  },
  {
    id: "utilities",
    name: "Oversite Utilities",
    tagline: "Announcements, roles, Roblox, music, more.",
    icon: Wrench,
    price: 99,
    oldPrice: 149,
    included: [
      "/say and /announce",
      "Reaction roles (unlimited)",
      "Autorole & polls",
      "Userinfo, serverinfo, avatar",
      "Music + auto-radio by genre",
      "Starboard & giveaways",
      "Twitch / YouTube notifications",
      "Leveling, economy & reminders",
    ],
  },
  {
    id: "scratch",
    name: "All in One Pack",
    tagline: "Protection + Support + Utilities — every base in one bot.",
    icon: Sparkles,
    price: 199,
    oldPrice: 249,
    included: [
      "Everything in Protection, Support & Utilities",
      "Full automod, anti-raid & logging",
      "Complete ticket, appeals & reports system",
      "Reaction roles, autorole & welcomes",
      "Music, giveaways & starboard",
      "Leveling, economy & stream alerts",
      "Every command in one bot",
      "Best value — save vs buying separately",
    ],
  },
  {
    id: "dispatch",
    name: "Oversite Dispatch",
    tagline: "AI voice dispatcher for ER:LC — reads 911 calls and talks back.",
    icon: Megaphone,
    price: 19.99,
    included: [
      "Reads live 911 calls aloud in a real dispatcher voice",
      "Two-way voice — officers talk to dispatch",
      "Nearest-unit dispatch from live positions",
      "Automatic officer-down & pursuit alerts",
      "BOLO broadcasts & call-cleared updates",
      "Traffic-stop auto-return on pursuits",
      "Live roster & unit status board",
      "Region-accurate radio codes & phonetics",
    ],
  },
  {
    id: "erlc-spec",
    name: "ERLC Specialized",
    tagline: "Purpose-built for ERLC servers — in-game moderation and department tools.",
    icon: Gamepad2,
    price: 99,
    included: [
      "In-game moderation",
      "Message-to-game linking",
      "Department role management",
      "Session tools & server binds",
      "Live player & vehicle lookups",
      "Automated shift & activity logging",
      "Staff performance tracking",
      "Custom in-game command binds",
    ],
  },
];

const SHARED_ADDONS: Addon[] = [
  { id: "branding", name: "Custom Branding", desc: "Match your server's identity end-to-end.", icon: Palette, price: 25 },
  { id: "dashboard", name: "Web Dashboard", desc: "Hosted control panel for everything.", icon: Globe, price: 149.99, oldPrice: 300 },
  { id: "multi-server", name: "Multi-Server License", desc: "Unlimited Discord servers — no per-slot fees.", icon: Globe2, price: 19.99 },
];

const ADDONS_BY_BASE: Record<string, Addon[]> = {
  protection: [
    { id: "advanced-logging", name: "Advanced Logging", desc: "Message edits, deletes, and full activity logs.", icon: FileText, price: 2.99 },
    { id: "nsfw-invite-scanner", name: "NSFW Invite Scanner + Censored Logs", desc: "Catches NSFW invites and stores censored evidence.", icon: ShieldCheck, price: 2.99 },
    { id: "avatar-nsfw-detection", name: "Avatar NSFW Detection", desc: "Flags NSFW avatars. Requires Censored Logs.", icon: EyeOff, price: 1.99 },
    { id: "bio-phrase-detection", name: "Bio Phrase Detection", desc: "Catches banned phrases in user bios. Requires Censored Logs.", icon: TextCursorInput, price: 0.99 },

    { id: "auto-escalating-warnings", name: "Auto-Escalating Warnings", desc: "Warns auto-escalate to mute/ban thresholds.", icon: AlertTriangle, price: 1.99 },
    { id: "softban-massban", name: "/softban and /massban", desc: "Quick cleanup tools for serious incidents.", icon: Ban, price: 1.99 },
    { id: "channel-lockdown", name: "Channel Lockdown Command", desc: "Instantly lock a channel or the whole server.", icon: Lock, price: 1.99 },
    { id: "moderation-history", name: "Moderation History", desc: "Full mod-log history per user.", icon: BookOpen, price: 1.99 },
    { id: "auto-slowmode", name: "Auto Slowmode on Spam", desc: "Triggers slowmode when spam is detected.", icon: Timer, price: 1.99 },
    { id: "temp-ban", name: "Temporary Bans (Auto-Unban)", desc: "Time-limited bans that lift themselves.", icon: AlarmClock, price: 1.99 },
  ],
  support: [
    { id: "staff-performance", name: "Staff Performance Tracking", desc: "Track tickets handled, response times, and more.", icon: BarChart2, price: 1.99 },
    { id: "ticket-logs", name: "Ticket Logs", desc: "Full transcripts and history of every ticket.", icon: FileText, price: 0.99 },

    { id: "ticket-notes", name: "Ticket Notes", desc: "Internal staff notes inside tickets.", icon: ClipboardList, price: 0.99 },
    { id: "ticket-add-remove", name: "Add / Remove Members", desc: "Pull people in or out of a ticket.", icon: UserPlus, price: 0.99 },
    { id: "close-all-tickets", name: "Close All Tickets", desc: "One command to close every open ticket.", icon: Trash2, price: 0.99 },
    { id: "ticket-message-customization", name: "Ticket Message Customization", desc: "Customize open/close/welcome messages.", icon: MessageSquare, price: 1.99 },
    { id: "priority-flagging", name: "Priority Ticket Flagging", desc: "Mark tickets as urgent for staff.", icon: Flag, price: 0.99 },
    { id: "auto-close-inactive", name: "Auto-Close Inactive Tickets", desc: "Closes tickets that go idle.", icon: Clock, price: 0.99 },
    { id: "anonymous-reporting", name: "Anonymous Reporting", desc: "Members can report without revealing identity.", icon: EyeOff, price: 0.99 },
  ],
  utilities: [
    { id: "music-addon", name: "Music Add-On", desc: "Full music playback with queues and controls.", icon: Music, price: 1.99 },
    { id: "auto-radio", name: "Auto Radio by Genre", desc: "Non-stop radio by genre. Requires Music Add-On.", icon: Headphones, price: 0.99 },

    { id: "starboard", name: "Starboard", desc: "Highlight top reactions in a starboard channel.", icon: Star, price: 0.99 },
    { id: "recurring-messages", name: "Recurring Messages", desc: "Schedule messages on a repeating timer.", icon: Calendar, price: 0.99 },
    { id: "giveaway-system", name: "Giveaway System", desc: "Run giveaways with reactions and timers.", icon: Gift, price: 0.99 },

    { id: "server-stats-channels", name: "Server Stats Channels", desc: "Auto-updating channel names with member counts.", icon: Hash, price: 0.99 },
    { id: "live-notifications", name: "Twitch / YouTube Notifications", desc: "Ping when streamers go live or upload.", icon: Bell, price: 0.99 },
    { id: "leveling-system", name: "Leveling System", desc: "XP, level-ups, and role rewards.", icon: BarChart3, price: 2.99 },
    { id: "economy-system", name: "Economy System", desc: "Currency, shop, and rewards.", icon: CreditCard, price: 1.99 },
    { id: "remindme", name: "/remindme", desc: "Personal reminder commands.", icon: AlarmClock, price: 0.99 },
    { id: "staff-notes", name: "Staff Notes on Users", desc: "Private notes staff can attach to any member.", icon: ClipboardList, price: 1.99 },
  ],
  scratch: [],
  dispatch: [],
};

const ROBLOX_BASE_IDS = new Set<string>(["dispatch", "erlc-spec"]);
const isRobloxBase = (id: string) => ROBLOX_BASE_IDS.has(id);
const DEFAULT_STATUS: Record<string, BotStatus> = { "erlc-spec": "coming_soon" };

const getAddonsForBase = (baseId: string): Addon[] => {
  if (baseId === "scratch") {
    return [
      ...ADDONS_BY_BASE.protection,
      ...ADDONS_BY_BASE.support,
      ...ADDONS_BY_BASE.utilities,
      ...SHARED_ADDONS,
    ];
  }
  if (baseId === "dispatch") return [];
  return [...(ADDONS_BY_BASE[baseId] ?? []), ...SHARED_ADDONS];
};

// Build the combined add-on pool for any set of selected bases.
const getAddonsForBases = (baseIds: string[]): Addon[] => {
  if (baseIds.includes("scratch")) return getAddonsForBase("scratch");
  const seen = new Set<string>();
  const result: Addon[] = [];
  for (const id of baseIds) {
    for (const a of ADDONS_BY_BASE[id] ?? []) {
      if (!seen.has(a.id)) { seen.add(a.id); result.push(a); }
    }
  }
  for (const a of SHARED_ADDONS) {
    if (!seen.has(a.id)) { seen.add(a.id); result.push(a); }
  }
  return result;
};

const SCRATCH_CATEGORIES: { id: string; label: string; icon: typeof Shield; addons: Addon[] }[] = [
  { id: "protection", label: "Protection options", icon: Shield, addons: ADDONS_BY_BASE.protection },
  { id: "support", label: "Support options", icon: LifeBuoy, addons: ADDONS_BY_BASE.support },
  { id: "utilities", label: "Utilities options", icon: Wrench, addons: ADDONS_BY_BASE.utilities },
];

type Identity = {
  name: string;
  description: string;
  bio: string;
  icon: string | null;
  banner: string | null;
};

const EMPTY_IDENTITY: Identity = { name: "", description: "", bio: "", icon: null, banner: null };

const PACK_TABS: { id: string; label: string; icon: typeof Shield }[] = [
  { id: "protection", label: "Protection bot", icon: Shield },
  { id: "support", label: "Support bot", icon: LifeBuoy },
  { id: "utilities", label: "Utilities bot", icon: Wrench },
];

function StatusGear({ baseId, status }: { baseId: string; status: BotStatus }) {
  const [busy, setBusy] = useState(false);
  const choose = async (next: BotStatus) => {
    if (next === status) return;
    setBusy(true);
    const { data, error } = await setBotAvailability(baseId, next);
    setBusy(false);
    const res = data as { ok?: boolean; error?: string } | null;
    if (error || !res?.ok) {
      sonnerToast.error("Couldn't update status", { description: res?.error ?? error?.message });
    } else {
      sonnerToast.success("Availability updated");
    }
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Set availability"
          onClick={(e) => e.stopPropagation()}
          className="grid h-7 w-7 place-items-center rounded-lg border border-os-hairline/50 bg-os-surface/70 text-os-faint backdrop-blur-sm transition hover:border-os-accent/50 hover:text-os-heading"
        >
          <Settings2 size={13} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[9rem]">
        <DropdownMenuRadioGroup value={status} onValueChange={(v) => choose(v as BotStatus)}>
          <DropdownMenuRadioItem value="available" disabled={busy}>Available</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="preorder" disabled={busy}>Pre-order</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="coming_soon" disabled={busy}>Coming Soon</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function BotForge() {
  // Funnel: reaching the builder counts as "started a build".
  useEffect(() => {
    track("build_started");
  }, []);
  const { user, isAdmin } = useAuth();
  const { availability } = useBotAvailability();
  const canManageStatus = (user?.email ?? "").toLowerCase() === "everant00@gmail.com";
  // COMP LIST: accounts on public.comped_emails never pay. The is_comped_email()
  // RPC answers yes/no for the signed-in user (the table itself is admin-only),
  // so the estimate can show the price slashed to $0.00 up front instead of
  // only revealing the comp at the moment of checkout.
  const [comped, setComped] = useState(false);
  useEffect(() => {
    if (!user?.email) {
      setComped(false);
      return;
    }
    let cancelled = false;
    (supabase as any)
      .rpc("is_comped_email")
      .then(({ data }: { data: boolean | null }) => {
        if (!cancelled) setComped(Boolean(data));
      })
      .catch(() => {
        if (!cancelled) setComped(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.email]);
  // A comped order is always fulfilled in full at $0 — never as installments —
  // so pin the plan to "full" in case one was selected before the check resolved.
  useEffect(() => {
    if (comped) setPaymentPlan("full");
  }, [comped]);
  const { hasDashboardAccess: dashboardAlreadyOwned } = useOwnedBots();
  const { isLive: salesLive } = useBotSalesMode();
  const stockCount = useBotStockCount();
  const { isIncluded: addonIsIncluded } = useAddonOverrides();
  // Multi-select bases. Rules:
  //  • All-in-One Pack ("scratch") is exclusive — selecting it clears others.
  //  • Otherwise the user can select up to 2 single bots (Protection / Support / Utilities).
  const [bases, setBases] = useState<string[]>(["protection"]);
  // Single-bot identity (used when exactly one non-pack base is selected)
  const [identity, setIdentity] = useState<Identity>({ ...EMPTY_IDENTITY });
  // Per-category identities (used for the All-in-One Pack OR multi-select)
  const [packIdentities, setPackIdentities] = useState<Record<string, Identity>>({
    protection: { ...EMPTY_IDENTITY },
    support: { ...EMPTY_IDENTITY },
    utilities: { ...EMPTY_IDENTITY },
  });
  const [activePackTab, setActivePackTab] = useState<string>("protection");
  const [tabDirection, setTabDirection] = useState<1 | -1>(1);
  const [addons, setAddons] = useState<string[]>([]);
  // Track which addons the user has explicitly clicked (vs. auto-added by an
  // admin flipping the addon to "INCLUDED"). When an admin flips an addon
  // back to "NOT INCLUDED", we auto-deselect it ONLY if the user didn't
  // manually pick it themselves.
  const [userSelectedAddons, setUserSelectedAddons] = useState<Set<string>>(
    () => new Set(),
  );
  // Snapshot of which addons were "included" on the previous render so we
  // can detect transitions (included -> not, or not -> included) and react.
  const prevIncludedRef = useRef<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const [discordUserId, setDiscordUserId] = useState("");
  const [discordUsername, setDiscordUsername] = useState("");

  // Prefill Discord identity from the user's linked notification prefs so
  // orders always carry a discord_user_id when the user has already linked.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("user_notification_prefs")
        .select("discord_user_id, discord_username")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled || !data) return;
      setDiscordUserId((cur) => cur || (data.discord_user_id ?? ""));
      setDiscordUsername((cur) => cur || (data.discord_username ?? ""));
    })();
    return () => { cancelled = true; };
  }, [user]);
  const [showAllAddons, setShowAllAddons] = useState<Record<string, boolean>>({});
  const [showPayment, setShowPayment] = useState(false);
  const [payFullName, setPayFullName] = useState("");
  const [payEmail, setPayEmail] = useState("");
  const [payCard, setPayCard] = useState("");
  const [payExp, setPayExp] = useState("");
  const [payCvc, setPayCvc] = useState("");
  const [payZip, setPayZip] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [paymentPlan, setPaymentPlan] = useState<"full" | "3" | "6" | "10">("full");
  const [engineVersion, setEngineVersion] = useState<"v1" | "v2">("v1");
  // Managed hosting is always included on every bot — pricing is tiered
  // per bot the user already owns ($5 for bot 1, $5 for bot 2, 3rd is free).
  const monthlyHosting = true;
  const [discountCodeInput, setDiscountCodeInput] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<{
    code: string;
    kind: "percent" | "amount";
    value: number;
  } | null>(null);
  const [applyingDiscount, setApplyingDiscount] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showSuccessText, setShowSuccessText] = useState(false);
  const [planeOrigin, setPlaneOrigin] = useState<{ x: number; y: number } | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutItems, setCheckoutItems] = useState<CheckoutItem[]>([]);
  // Discord contact gate (shown at order time in live mode). Linking is
  // optional — "No thanks" proceeds to the same checkout unchanged. It only
  // controls whether we can DM the customer when their bot is ready.
  const [discordGateOpen, setDiscordGateOpen] = useState(false);
  const [discordSkip, setDiscordSkip] = useState(false);
  const [discordLinking, setDiscordLinking] = useState(false);
  const [resumeAfterDiscord, setResumeAfterDiscord] = useState(false);

  const iconInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  const isPack = bases.includes("scratch");
  const isMulti = !isPack && bases.length > 1;
  // When more than one identity is needed (pack OR multi-select)
  const usesPackTabs = isPack || isMulti;
  // Which tabs to show in the identity step
  const visibleIdentityTabs = useMemo(() => {
    if (isPack) return PACK_TABS;
    return PACK_TABS.filter((t) => bases.includes(t.id));
  }, [isPack, bases]);

  // Keep the active pack tab valid as `bases` changes
  if (usesPackTabs && !visibleIdentityTabs.find((t) => t.id === activePackTab)) {
    // defer state update to next tick by scheduling via setTimeout would
    // create churn; instead just use the first visible tab during render.
  }
  const effectiveActiveTab = visibleIdentityTabs.find((t) => t.id === activePackTab)
    ? activePackTab
    : visibleIdentityTabs[0]?.id ?? "protection";

  const currentAddons = useMemo(() => getAddonsForBases(bases), [bases]);

  // How many bot tokens this order would consume (1 per identity).
  const botsNeeded = usesPackTabs ? visibleIdentityTabs.length : 1;
  // In stock = admin sales mode is live AND we have enough tokens for this order.
  // While stockCount is still loading (null) we conservatively assume preorder so
  // the button doesn't flip mid-render.
  const inStock = salesLive && stockCount !== null && stockCount >= botsNeeded;
  const primaryCtaLabel = inStock ? "Order my bot" : "Preorder my bot";
  const confirmCtaLabel = inStock ? "Confirm order" : "Confirm preorder";


  // React to admin "INCLUDED" toggles in real time:
  //   - When an addon flips to INCLUDED → auto-select it (so the customer
  //     gets the freebie without having to click).
  //   - When an addon flips back to NOT INCLUDED → auto-deselect it, but
  //     ONLY if the customer didn't manually pick it themselves.
  useEffect(() => {
    const ids = currentAddons.map((a) => a.id);
    if (ids.length === 0) return;
    const prev = prevIncludedRef.current;
    const next: Record<string, boolean> = {};
    let toAdd: string[] = [];
    let toRemove: string[] = [];
    for (const id of ids) {
      const inc = addonIsIncluded(id);
      next[id] = inc;
      const wasInc = prev[id];
      if (wasInc === undefined) continue; // first observation, skip
      if (!wasInc && inc) toAdd.push(id);
      else if (wasInc && !inc && !userSelectedAddons.has(id)) toRemove.push(id);
    }
    prevIncludedRef.current = next;
    if (toAdd.length === 0 && toRemove.length === 0) return;
    setAddons((curr) => {
      let out = curr;
      if (toAdd.length) {
        const set = new Set(out);
        for (const id of toAdd) set.add(id);
        out = Array.from(set);
      }
      if (toRemove.length) {
        const rm = new Set(toRemove);
        out = out.filter((id) => !rm.has(id));
      }
      return out;
    });
  }, [currentAddons, addonIsIncluded, userSelectedAddons]);

  const activeIdentity: Identity = usesPackTabs ? packIdentities[effectiveActiveTab] : identity;
  const { name, description, bio, icon, banner } = activeIdentity;

  const updateActiveIdentity = (patch: Partial<Identity>) => {
    if (usesPackTabs) {
      setPackIdentities((prev) => ({
        ...prev,
        [effectiveActiveTab]: { ...prev[effectiveActiveTab], ...patch },
      }));
    } else {
      setIdentity((prev) => ({ ...prev, ...patch }));
    }
  };
  const setName = (v: string) => updateActiveIdentity({ name: v });
  const setDescription = (v: string) => updateActiveIdentity({ description: v });
  const setBio = (v: string) => updateActiveIdentity({ bio: v });
  const setIcon = (v: string) => updateActiveIdentity({ icon: v });
  const setBanner = (v: string) => updateActiveIdentity({ banner: v });

  // Auto-advance to the next visible identity tab when finishing a description
  const advanceToNextTab = () => {
    if (!usesPackTabs) return;
    const current = packIdentities[effectiveActiveTab];
    if (!current?.name.trim() || !current?.description.trim()) return;
    const idx = visibleIdentityTabs.findIndex((t) => t.id === effectiveActiveTab);
    if (idx >= 0 && idx < visibleIdentityTabs.length - 1) {
      setTabDirection(1);
      setActivePackTab(visibleIdentityTabs[idx + 1].id);
    }
  };
  const handleBioBlur = () => advanceToNextTab();

  const goToTab = (id: string) => {
    const fromIdx = visibleIdentityTabs.findIndex((t) => t.id === effectiveActiveTab);
    const toIdx = visibleIdentityTabs.findIndex((t) => t.id === id);
    setTabDirection(toIdx >= fromIdx ? 1 : -1);
    setActivePackTab(id);
  };


  const handleFile = (file: File | undefined, setter: (v: string) => void) => {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      sonnerToast.error("Image too large", { description: "Please keep it under 4MB." });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setter(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const toggleAddon = (id: string) => {
    setAddons((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    );
    // Record/erase the user's manual intent so admin "included" toggles
    // don't override an explicit choice.
    setUserSelectedAddons((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Toggle a base with the multi-select rules.
  const toggleBase = (id: string) => {
    setAddons([]);
    setShowAllAddons({});

    // ER:LC / Roblox bots are their own category — they never mix with the
    // Discord bots or the pack. Selecting one clears every Discord bot / the
    // pack; ER:LC bots may still stack with each other.
    if (isRobloxBase(id)) {
      setBases((prev) => {
        if (prev.includes(id)) {
          if (prev.length === 1) {
            sonnerToast.info("Pick at least one bot", {
              description: "You need to keep one bot selected.",
            });
            return prev;
          }
          return prev.filter((b) => b !== id);
        }
        // Add — drop every Discord bot / pack, keep only the ER:LC selection.
        return [...prev.filter((b) => isRobloxBase(b)), id];
      });
      return;
    }

    if (id === "scratch") {
      // The pack is a Discord product — selecting it clears any ER:LC bot too.
      setBases(["scratch"]);
      setActivePackTab("protection");
      return;
    }

    setBases((prev) => {
      // A Discord single drops the pack AND any ER:LC bot (categories never
      // mix), but keeps the other Discord bots so they can still stack.
      const discord = prev.filter((b) => b !== "scratch" && !isRobloxBase(b));
      if (discord.includes(id)) {
        if (discord.length === 1) {
          sonnerToast.info("Pick at least one bot", {
            description: "You need to keep one bot selected.",
          });
          return prev;
        }
        const next = discord.filter((b) => b !== id);
        if (!next.includes(activePackTab)) setActivePackTab(next[0]);
        return next;
      }
      const next = [...discord, id];
      // Selecting all three Discord singles collapses into the All-in-One Pack
      // (same three bots, same $199) instead of stacking them separately.
      if (["protection", "support", "utilities"].every((s) => next.includes(s))) {
        setActivePackTab("protection");
        sonnerToast.success("Switched to the All-in-One Pack", {
          description: "All three bots together — best value.",
        });
        return ["scratch"];
      }
      setActivePackTab(id);
      return next;
    });
  };

  const total = useMemo(() => {
    const SECOND_BOT_PRICE = 50;
    // ER:LC / Roblox bots are always their own flat price — never part of the
    // Discord "first full, each additional $50" ladder.
    const roblocCost = bases
      .filter((id) => isRobloxBase(id))
      .reduce((sum, id) => sum + (BASES.find((b) => b.id === id)?.price ?? 0), 0);
    const discord = bases.filter((id) => !isRobloxBase(id));
    let discordCost = 0;
    if (discord.includes("scratch")) {
      discordCost = BASES.find((b) => b.id === "scratch")?.price ?? 0;
    } else {
      discordCost = discord.reduce((sum, id, idx) => {
        const b = BASES.find((x) => x.id === id);
        if (!b) return sum;
        return sum + (idx === 0 ? b.price : SECOND_BOT_PRICE);
      }, 0);
    }
    return discordCost + roblocCost;
  }, [bases]);

  const discountAmount = useMemo(() => {
    if (!appliedDiscount) return 0;
    const raw =
      appliedDiscount.kind === "percent"
        ? (total * appliedDiscount.value) / 100
        : appliedDiscount.value;
    return Math.min(total, Math.max(0, Number(raw.toFixed(2))));
  }, [appliedDiscount, total]);

  const finalTotal = Math.max(0, Number((total - discountAmount).toFixed(2)));

  const applyDiscount = async () => {
    const code = discountCodeInput.trim().toUpperCase();
    if (!code) return;
    setApplyingDiscount(true);
    // Use the server-side validator RPC so we never expose the full
    // discount_codes table to the client.
    const { data, error } = await (supabase as any).rpc("validate_discount_code", {
      _code: code,
    });
    setApplyingDiscount(false);
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) {
      sonnerToast.error("Invalid or expired code");
      return;
    }
    setAppliedDiscount({
      code: row.code,
      kind: row.kind,
      value: Number(row.value),
    });
    sonnerToast.success(`Code ${row.code} applied`);
  };

  const removeDiscount = () => {
    setAppliedDiscount(null);
    setDiscountCodeInput("");
  };

  // For the All-in-One Pack OR multi-select, we use the first selected category's
  // identity as the primary record and append the others as a JSON block in notes.
  const buildSubmissionPayload = () => {
    if (!usesPackTabs) {
      return {
        primary: identity,
        notesField: notes.trim() || null,
      };
    }
    const tabs = isPack ? PACK_TABS : visibleIdentityTabs;
    const primary = packIdentities[tabs[0].id];
    const extras: Record<string, Identity> = {};
    for (const t of tabs.slice(1)) extras[t.id] = packIdentities[t.id];
    const header = isPack
      ? "--- All-in-One Pack additional bots ---"
      : "--- Additional bots in this order ---";
    const extraNotes = `\n\n${header}\n${JSON.stringify(extras, null, 2)}`;
    return {
      primary,
      notesField: ((notes.trim() ? notes.trim() : "") + extraNotes).trim(),
    };
  };

  const persistOrder = async (): Promise<string | null> => {
    if (!user) return null; // anonymous: skip persistence, keep legacy flow
    const { primary, notesField } = buildSubmissionPayload();
    const planMonths = paymentPlan === "full" ? null : parseInt(paymentPlan, 10);
    const installmentAmount = planMonths ? Number((finalTotal / planMonths).toFixed(2)) : null;

    // For the All-in-One Pack OR multi-select, the parent row represents the
    // FIRST selected category (e.g. "protection"), NOT "scratch". Each row
    // (parent + siblings) is its own real bot — its own Railway service,
    // its own Discord token, its own dashboard — with addons filtered to
    // only those that belong to that bot's category. The old behaviour of
    // a single base="scratch" bot with every addon combined caused the
    // dashboard to render Protection + Support + Utilities blocks all on
    // one bot, which is not what the pack is supposed to do.
    const tabsForPack = usesPackTabs ? (isPack ? PACK_TABS : visibleIdentityTabs) : [];
    const parentBase = usesPackTabs ? tabsForPack[0].id : bases.join("+");
    const parentAddons = usesPackTabs ? filterAddonsForBase(addons, parentBase) : addons;
    const parentIdentity = usesPackTabs
      ? (packIdentities[tabsForPack[0].id] ?? primary)
      : primary;

    // Last-chance fallback: if the form fields are empty but the user has
    // already linked Discord via notification prefs, use that so the order
    // is never persisted without a discord_user_id.
    let finalDiscordId = discordUserId.trim();
    let finalDiscordName = discordUsername.trim();
    if (!finalDiscordId) {
      const { data: prefs } = await (supabase as any)
        .from("user_notification_prefs")
        .select("discord_user_id, discord_username")
        .eq("user_id", user.id)
        .maybeSingle();
      if (prefs?.discord_user_id) {
        finalDiscordId = String(prefs.discord_user_id);
        finalDiscordName = finalDiscordName || (prefs.discord_username ?? "");
      }
    }

    const { data: inserted, error } = await (supabase as any)
      .from("bot_orders")
      .insert({
        user_id: user.id,
        bot_name: parentIdentity.name.trim() || primary.name.trim(),
        bot_description: (parentIdentity.description || primary.description).trim() || null,
        bot_bio: (parentIdentity.bio || primary.bio || "").trim().slice(0, 190) || null,
        icon_url: parentIdentity.icon ?? primary.icon,
        banner_url: parentIdentity.banner ?? primary.banner,
        base: parentBase,
        addons: parentAddons,
        monthly_hosting: monthlyHosting,
        notes: notesField,
        total_amount: finalTotal,
        currency: "usd",
        // Order awaits Stripe payment confirmation. Webhook flips to 'paid'
        // on checkout.session.completed, which triggers the build job.
        status: "pending_payment",
        submitted_at: new Date().toISOString(),
        payment_plan: planMonths ? "installments" : "full",
        plan_months: planMonths,
        installment_amount: installmentAmount,
        discount_code: appliedDiscount?.code ?? null,
        discount_amount: discountAmount,
        engine_version: engineVersion,
        discord_user_id: finalDiscordId || null,
        discord_username: finalDiscordName || null,
      })
      .select("id")
      .single();
    if (error || !inserted) {
      sonnerToast.error("Couldn't save your order", { description: error?.message });
      return null;
    }

    // For a pack OR multi-bot order, create one sibling row per additional
    // bot identity, linked to the parent. Each child appears as its own
    // entry in the dashboard. Payment lives on the parent row; siblings
    // carry $0 and are status-propagated by the webhook.
    if (usesPackTabs) {
      const extras = tabsForPack.slice(1); // tabsForPack[0] is the primary already inserted
      if (extras.length > 0) {
        const siblingRows = extras.map((t) => {
          const ident = packIdentities[t.id] ?? { ...EMPTY_IDENTITY };
          return {
            user_id: user.id,
            parent_order_id: inserted.id,
            bot_name: (ident.name || `${t.label}`).trim(),
            bot_description: ident.description?.trim() || null,
            bot_bio: (ident.bio || "").trim().slice(0, 190) || null,
            icon_url: ident.icon,
            banner_url: ident.banner,
            // Sibling row's base is the specific category, not "scratch"
            base: t.id,
            // Only this category's addons go on this bot.
            addons: filterAddonsForBase(addons, t.id),
            monthly_hosting: monthlyHosting,
            notes: `Child of pack/multi order ${inserted.id}`,
            total_amount: 0,
            currency: "usd",
            status: "pending_payment",
            submitted_at: new Date().toISOString(),
            payment_plan: planMonths ? "installments" : "full",
            plan_months: planMonths,
            installment_amount: null,
            discount_code: null,
            discount_amount: 0,
            engine_version: engineVersion,
            discord_user_id: finalDiscordId || null,
            discord_username: finalDiscordName || null,
          };
        });
        const { error: childErr } = await (supabase as any)
          .from("bot_orders")
          .insert(siblingRows);
        if (childErr) {
          // Don't fail the whole order — log so we can backfill if needed.
          console.error("Failed to insert sibling bot rows:", childErr);
        }
      }
    }


    // Best-effort: bump times_used on the code (non-blocking).
    if (appliedDiscount) {
      await (supabase as any).rpc("increment_discount_code_usage", {
        _code: appliedDiscount.code,
      });
    }
    return inserted.id as string;
  };

  const submit = async () => {
    if (usesPackTabs) {
      const missing = visibleIdentityTabs.find((t) => !packIdentities[t.id]?.name.trim());
      if (missing) {
        sonnerToast.error(`Name your ${missing.label}`, {
          description: "Each bot in your order needs at least a name.",
        });
        setTabDirection(1);
        setActivePackTab(missing.id);
        return;
      }
    } else if (!name.trim()) {
      sonnerToast.error("Give your bot a name", {
        description: "Even a working title helps us get started.",
      });
      return;
    }
    if (!showPayment) {
      setShowPayment(true);
      // Scroll the payment section into view after it expands
      setTimeout(() => {
        document
          .getElementById("payment-section")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 350);
      return;
    }
    // Discord contact gate (live sales): nudge them to link Discord so we can
    // DM them the moment their bot is ready. Fully optional — "No thanks"
    // skips it. Linking or skipping both continue to the same checkout below.
    if (user && salesLive && !discordUserId.trim() && !discordSkip) {
      setDiscordGateOpen(true);
      return;
    }
    setSubmitting(true);

    // NOTE: we no longer charge at checkout or pre-insert a bare waitlist row.
    // Every order saves the card (SetupIntent) below, then the post-checkout
    // confirm gate (confirm-order-discord-join) decides stock and charges the
    // saved card ONLY when the build actually starts. So nobody is charged
    // until their bot is being built.

    // Save the order to the database (status='pending_payment' → 'preorder'
    // once the card is saved). The card is charged later, at build-start.
    const orderId = await persistOrder();
    if (user && !orderId) {
      setSubmitting(false);
      return;
    }

    // For signed-in users with a real order: save the card, no charge.
    if (user && orderId) {
      // COMP LIST: if this account's email never pays, fulfill the order for
      // free server-side (marked paid at $0, hosting waived) and skip Stripe
      // entirely. They still go through the whole build/deploy flow.
      try {
        const { data: comp } = await (supabase as any).functions.invoke("create-comped-order", {
          body: { botOrderId: orderId },
        });
        if (comp?.comped) {
          sonnerToast.success(
            comp.status === "waitlisted" ? "You're on the list — 100% off" : "You're all set — 100% off",
            {
              description:
                comp.status === "waitlisted"
                  ? "No charge. Your bot is reserved and deploys the moment a slot frees up."
                  : "No charge. Your bot is being prepared right now.",
              duration: 9000,
            },
          );
          window.location.href = `${window.location.origin}/checkout/return?order=${orderId}&comped=1`;
          return;
        }
      } catch {
        /* not comped (or check failed) — fall through to normal checkout */
      }

      // Save the card via a SetupIntent — NO charge happens here. The card is
      // only charged later, at the moment the build actually starts (in
      // confirm-order-discord-join for in-stock, or after the waitlist DM
      // "YES" for out-of-stock). So a customer is never charged for a bot that
      // isn't being built.
      import("@/lib/stripe").then((m) => m.getStripe()).catch(() => {});

      const { data, error } = await (supabase as any).functions.invoke("create-setup-intent", {
        body: { botOrderId: orderId, customerEmail: user.email },
      });
      if (error || !data?.clientSecret) {
        sonnerToast.error("Couldn't start checkout", {
          description: error?.message || "Please try again.",
        });
        setSubmitting(false);
        return;
      }
      // Send them to the hosted page that completes the SetupIntent (saves the
      // card), which redirects back to /checkout/return to finish the order.
      window.location.href = `${window.location.origin}/checkout/setup?cs=${encodeURIComponent(data.clientSecret)}&order=${orderId}`;
      return;
    }

    // Capture button center as the airplane's launch point
    const btn = confirmBtnRef.current;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      setPlaneOrigin({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    }
    setTimeout(() => {
      setShowSuccess(true);
      setSubmitting(false);
    }, 200);
    // Reveal the success message right when the plane zooms past the camera
    setTimeout(() => {
      setShowSuccessText(true);
    }, 2900);
    setTimeout(() => {
      const canUseDashboard = addons.includes("dashboard") || dashboardAlreadyOwned;
      window.location.href = user
        ? canUseDashboard
          ? "/bot-dashboard"
          : "/dashboard"
        : "/#contact";
    }, 6000);
  };

  // ── Discord contact gate ────────────────────────────────────────────────
  // Opens the linked-Discord OAuth flow in a small popup so the in-progress
  // build never loses its state. The popup postMessages us the identity.
  const startDiscordLink = async () => {
    if (!user) return;
    setDiscordLinking(true);
    const redirect_uri = `${window.location.origin}/discord/linked`;
    const { data, error } = await (supabase as any).functions.invoke("discord-link", {
      body: { action: "get_authorize_url", redirect_uri },
    });
    if (error || !data?.url) {
      setDiscordLinking(false);
      sonnerToast.error("Couldn't start Discord link", {
        description: data?.error || error?.message || "Please try again.",
      });
      return;
    }
    localStorage.setItem("oswire_discord_link_state", data.state);
    const w = 480;
    const h = 720;
    const left = window.screenX + Math.max(0, (window.outerWidth - w) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - h) / 2);
    window.open(data.url, "discord-link", `width=${w},height=${h},left=${left},top=${top}`);
  };

  const skipDiscord = () => {
    setDiscordSkip(true);
    setDiscordGateOpen(false);
    setResumeAfterDiscord(true);
  };

  // Receive the linked identity back from the popup window.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data;
      if (!d || d.type !== "oswire-discord-linked") return;
      setDiscordLinking(false);
      if (!d.ok) {
        if (d.error && d.error !== "cancelled") {
          sonnerToast.error("Discord link didn't finish", { description: "Please try again or skip." });
        }
        return;
      }
      setDiscordUserId(String(d.discord_user_id || ""));
      setDiscordUsername(String(d.discord_username || ""));
      setDiscordGateOpen(false);
      setResumeAfterDiscord(true);
      sonnerToast.success(`Linked @${d.discord_username || d.discord_user_id}`);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Once the Discord decision is made (linked or skipped), continue the order.
  useEffect(() => {
    if (resumeAfterDiscord && (discordUserId.trim() || discordSkip)) {
      setResumeAfterDiscord(false);
      submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeAfterDiscord, discordUserId, discordSkip]);

  const selectedBase = BASES.find((b) => b.id === (isPack ? "scratch" : bases[0]));
  const SelectedIcon = selectedBase?.icon ?? Bot;
  const displayName = name.trim() || "Your Bot";
  const displayTag = (name.trim() || "yourbot").toLowerCase().replace(/\s+/g, "") + "#0001";

  return (
    <section id="build" className="mt-24 scroll-mt-24">
      {/* Placing-order overlay — the submit path does real server work
          (order persist, comp check, Stripe setup) before redirecting, so
          without this the click looks dead for several seconds. Shown for
          the whole submit and kept up through the redirect (submitting is
          intentionally never reset on the success paths). */}
      {submitting && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center"
          style={{ background: "rgba(15,19,24,.72)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-os-hairline/40 bg-os-surface/90 px-10 py-8 shadow-2xl">
            {/* Same self-drawing mountain ridge as the route/dashboard loaders
                (see RouteFallback in App.tsx) so every wait screen shares one
                identity. Duplicated markup on purpose — single-paste files. */}
            <style>{`
              @keyframes os-ridge-draw{0%{stroke-dashoffset:340}55%{stroke-dashoffset:0}78%{stroke-dashoffset:0}100%{stroke-dashoffset:-340}}
              .os-ridge path{fill:none;stroke-linecap:round;stroke-linejoin:round;stroke-width:2}
              .os-ridge .draw{stroke:#C9DBE6;stroke-dasharray:340;stroke-dashoffset:340;animation:os-ridge-draw 2.6s cubic-bezier(.45,.05,.35,1) infinite;filter:drop-shadow(0 0 10px rgba(201,219,230,.35))}
              .os-ridge .ghost{stroke:rgba(201,219,230,.14)}
              @media (prefers-reduced-motion: reduce){.os-ridge .draw{animation:none;stroke-dashoffset:0}}
            `}</style>
            <svg
              className="os-ridge"
              width="150"
              height="58"
              viewBox="0 0 190 74"
              style={{ overflow: "visible" }}
              aria-hidden
            >
              <path className="ghost" d="M4 70 L44 26 L62 44 L95 6 L128 42 L148 24 L186 70" />
              <path className="draw" d="M4 70 L44 26 L62 44 L95 6 L128 42 L148 24 L186 70" />
            </svg>
            <div className="text-sm font-semibold text-os-heading">Placing your order…</div>
            <div className="text-xs text-os-faint">
              Setting everything up — this takes a few seconds. Don't close this tab.
            </div>
          </div>
        </div>
      )}
      <div className="max-w-3xl">
        <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight text-os-heading">
          Design your <span className="text-os-accent">dream bot.</span>
        </h2>
        <p className="mt-6 font-body text-lg text-os-body leading-relaxed">
          Pick a base, stack on add-ons, and tell us what you want. We'll quote your build and
          get the wheels spinning.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: configurator */}
        <div className="lg:col-span-2 space-y-8">
          {/* Two-bot deal callout */}
          <div className="rounded-xl border border-os-accent/30 bg-gradient-to-r from-os-accent/10 via-os-accent/5 to-transparent p-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-os-accent/15 border border-os-accent/30 grid place-items-center shrink-0">
              <Sparkles size={16} className="text-os-accent" />
            </div>
            <div className="text-xs sm:text-sm font-body">
              <span className="font-semibold text-os-heading">Any two bots = $149 one-time.</span>{" "}
              <span className="text-os-faint">Mix and match — protection, support, or utilities. Same price no matter which two.</span>
            </div>
          </div>
          {/* Step 1 — Base */}
          <div id="pick-base" className="rounded-2xl border border-os-hairline/40 bg-os-surface/30 backdrop-blur-sm p-6 scroll-mt-24">
            <div className="flex items-center gap-3 mb-4">
              <div className="grid h-7 w-7 place-items-center rounded-full border border-os-accent/40 bg-os-accent/10 font-label text-xs font-bold text-os-accent">
                1
              </div>
              <h3 className="font-display text-lg font-semibold text-os-heading">Pick a starting point</h3>
            </div>
            <p className="font-body text-xs text-os-faint mb-3">
              Pick one bot, mix two, or grab the All-in-One Pack to bundle all three.
            </p>
            <div className="space-y-6">
              {(() => {
                // First selected DISCORD single keeps full price; each additional
                // Discord single is the $50 add-on. ER:LC bots price on their own.
                const firstSingle = bases.find((id) => !isRobloxBase(id) && id !== "scratch");
                const renderCard = (b: Base) => {
                const Icon = b.icon;
                const active = bases.includes(b.id);
                const status: BotStatus = availability[b.id] ?? DEFAULT_STATUS[b.id] ?? "available";
                const comingSoon = status === "coming_soon";
                const preorder = status === "preorder";
                const isDiscountedSecond =
                  !comingSoon && !isRobloxBase(b.id) && b.id !== "scratch" && !!firstSingle && b.id !== firstSingle;
                const displayPrice = isDiscountedSecond ? 50 : b.price;
                const displayOldPrice = isDiscountedSecond ? b.price : b.oldPrice;
                return (
                  <div key={b.id} className="relative">
                    {canManageStatus && (
                      <div className="absolute bottom-2 right-2 z-10">
                        <StatusGear baseId={b.id} status={status} />
                      </div>
                    )}
                    <button
                      type="button"
                      disabled={comingSoon}
                      onClick={() => { if (!comingSoon) toggleBase(b.id); }}
                      className={`group flex h-full w-full flex-col items-stretch justify-start text-left rounded-xl border p-4 transition ${
                        comingSoon
                          ? "border-os-hairline/30 bg-os-bg/30 opacity-60 cursor-not-allowed"
                          : active
                            ? "border-os-accent bg-os-accent/10 shadow-[0_0_30px_-10px_rgb(var(--os-accent)/0.6)]"
                            : "border-os-hairline/40 bg-os-bg/40 hover:border-os-accent/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Icon
                            size={18}
                            className={`transition ${active && !comingSoon ? "text-os-accent" : "text-os-faint"}`}
                          />
                          <span className="font-display font-semibold text-os-heading">{b.name}</span>
                        </div>
                        {comingSoon ? (
                          <span className="px-1.5 py-0.5 rounded-full bg-os-surface/60 border border-os-hairline/50 text-os-faint text-[10px] font-semibold uppercase tracking-wide">
                            Coming Soon
                          </span>
                        ) : preorder ? (
                          <span className="px-1.5 py-0.5 rounded-full bg-os-accent/15 border border-os-accent/30 text-os-accent text-[10px] font-semibold uppercase tracking-wide">
                            Pre-order
                          </span>
                        ) : active ? (
                          <Check size={16} className="text-os-accent" />
                        ) : null}
                      </div>
                      <p className="font-body text-xs text-os-faint mt-2 leading-relaxed">
                        {b.tagline}
                      </p>
                      <ul className="mt-3 space-y-1">
                        {b.included.map((feat) => (
                          <li key={feat} className="flex items-start gap-1.5 text-[11px] text-os-body leading-snug">
                            <Check size={11} className={`mt-0.5 shrink-0 ${active && !comingSoon ? "text-os-accent" : "text-os-faint"}`} />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-auto pt-3 flex items-center gap-2 flex-wrap text-xs text-os-body">
                        <span>one-time</span>
                        {displayOldPrice && !comingSoon && (
                          <span className="text-os-faint line-through">${displayOldPrice}</span>
                        )}
                        <span className="font-semibold text-os-heading">${displayPrice}</span>
                        {comingSoon ? null : isDiscountedSecond ? (
                          <span className="px-1.5 py-0.5 rounded-full bg-os-accent/15 border border-os-accent/30 text-os-accent text-[10px] font-semibold uppercase tracking-wide">
                            Add for $50
                          </span>
                        ) : b.oldPrice ? (
                          <span className="px-1.5 py-0.5 rounded-full bg-os-accent/15 border border-os-accent/30 text-os-accent text-[10px] font-semibold uppercase tracking-wide">
                            {salesLive ? "Sale" : "Preorder sale"}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  </div>
                );
                };
                const discordBases = BASES.filter((b) => !isRobloxBase(b.id));
                const roblocBases = BASES.filter((b) => isRobloxBase(b.id));
                return (
                  <>
                    <div>
                      <div className="mb-3 flex items-center gap-2">
                        <span className="font-label text-[11px] font-semibold uppercase tracking-[0.16em] text-os-body">Discord Bots</span>
                        <span className="h-px flex-1 bg-os-hairline/40" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 auto-rows-fr">
                        {discordBases.map(renderCard)}
                      </div>
                    </div>
                    <div>
                      <div className="mb-3 flex items-center gap-2">
                        <span className="font-label text-[11px] font-semibold uppercase tracking-[0.16em] text-os-body">ER:LC / Roblox Bots</span>
                        <span className="h-px flex-1 bg-os-hairline/40" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 auto-rows-fr">
                        {roblocBases.map(renderCard)}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Step 2 — Identity */}
          <div className="rounded-2xl border border-os-hairline/40 bg-os-surface/30 backdrop-blur-sm p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="grid h-7 w-7 place-items-center rounded-full border border-os-accent/40 bg-os-accent/10 font-label text-xs font-bold text-os-accent">
                2
              </div>
              <h3 className="font-display text-lg font-semibold text-os-heading">
                {isPack
                  ? "Design your three bots"
                  : isMulti
                    ? `Design your ${visibleIdentityTabs.length} bots`
                    : "Bot identity"}
              </h3>
            </div>

            {usesPackTabs && (
              <>
                <p className="font-body text-xs text-os-faint mb-4">
                  {isPack
                    ? "The All-in-One Pack ships as three focused bots. Give each one its own name, icon, banner, and vibe — finish the description and we'll slide you to the next."
                    : "You picked more than one bot. Give each one its own name, icon, banner, and vibe — finish the description and we'll slide you to the next."}
                </p>
                <div
                  className="relative grid gap-2 mb-5 rounded-xl border border-os-hairline/40 bg-os-bg/40 p-1"
                  style={{ gridTemplateColumns: `repeat(${visibleIdentityTabs.length}, minmax(0, 1fr))` }}
                >
                  {visibleIdentityTabs.map((t) => {
                    const TIcon = t.icon;
                    const active = effectiveActiveTab === t.id;
                    const filled = !!packIdentities[t.id]?.name.trim();
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => goToTab(t.id)}
                        className={`relative flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition ${
                          active
                            ? "bg-os-accent/15 text-os-accent border border-os-accent/40 shadow-[0_0_30px_-10px_rgb(var(--os-accent)/0.6)]"
                            : "text-os-faint hover:text-os-heading border border-transparent"
                        }`}
                      >
                        <TIcon size={14} />
                        <span className="truncate">{t.label}</span>
                        {filled && (
                          <span className="ml-1 h-1.5 w-1.5 rounded-full bg-os-accent" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <div
              key={usesPackTabs ? effectiveActiveTab : "single"}
              className={`${
                usesPackTabs
                  ? tabDirection === 1
                    ? "animate-tab-slide-in-right"
                    : "animate-tab-slide-in-left"
                  : ""
              }`}
            >
              {/* Banner + Icon uploaders */}
              <div className="space-y-4 mb-5">
                <div>
                  <label className="mb-2 block font-label text-[11px] uppercase tracking-[0.14em] text-os-faint">Banner</label>
                  <button
                    type="button"
                    onClick={() => bannerInputRef.current?.click()}
                    className="relative w-full h-28 rounded-xl border border-dashed border-os-hairline/50 bg-os-bg/40 hover:border-os-accent/50 transition overflow-hidden group"
                  >
                    {banner ? (
                      <img src={banner} alt="Banner preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex items-center justify-center h-full text-os-faint gap-2 text-sm">
                        <ImagePlus size={16} />
                        Upload banner
                      </div>
                    )}
                  </button>
                  <input
                    ref={bannerInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFile(e.target.files?.[0], setBanner)}
                  />
                </div>

                <div className="flex items-end gap-4">
                  <div>
                    <label className="mb-2 block font-label text-[11px] uppercase tracking-[0.14em] text-os-faint">Icon</label>
                    <button
                      type="button"
                      onClick={() => iconInputRef.current?.click()}
                      className="relative h-20 w-20 rounded-full border border-dashed border-os-hairline/50 bg-os-bg/40 hover:border-os-accent/50 transition overflow-hidden grid place-items-center"
                    >
                      {icon ? (
                        <img src={icon} alt="Icon preview" className="w-full h-full object-cover" />
                      ) : (
                        <Upload size={18} className="text-os-faint" />
                      )}
                    </button>
                    <input
                      ref={iconInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFile(e.target.files?.[0], setIcon)}
                    />
                  </div>
                  <p className="font-body text-xs text-os-faint pb-2 leading-relaxed">
                    PNG/JPG up to 4MB. Icon shows as the bot's avatar; banner appears at the top of the profile.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="bot-name" className="mb-2 block font-label text-[11px] uppercase tracking-[0.14em] text-os-faint">
                    Name
                  </label>
                  <input
                    id="bot-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={
                      isPack
                        ? `e.g. ${PACK_TABS.find((t) => t.id === activePackTab)?.label}`
                        : "e.g. Sentinel, Helper, NovaBot..."
                    }
                    className="w-full rounded-lg border border-os-hairline/50 bg-os-bg/60 px-3 py-2.5 font-body text-[14px] text-os-heading placeholder:text-os-faint outline-none transition focus:border-os-accent/70"
                  />
                </div>
                <div>
                  <label htmlFor="bot-desc" className="mb-2 block font-label text-[11px] uppercase tracking-[0.14em] text-os-faint">
                    Description
                  </label>
                  <textarea
                    id="bot-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Tell us about your bot — what it does, its personality, the vibe you're going for, and anything that makes it uniquely yours."
                    rows={5}
                    className="w-full rounded-lg border border-os-hairline/50 bg-os-bg/60 px-3 py-2.5 font-body text-[14px] text-os-heading placeholder:text-os-faint outline-none transition focus:border-os-accent/70 resize-y leading-relaxed"
                  />
                </div>
                <div>
                  <label htmlFor="bot-bio" className="mb-2 block font-label text-[11px] uppercase tracking-[0.14em] text-os-faint">
                    Discord profile bio <span className="text-os-faint/70">(optional, max 190 chars)</span>
                  </label>
                  <textarea
                    id="bot-bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value.slice(0, 190))}
                    onBlur={handleBioBlur}
                    placeholder="Short About Me shown on your bot's Discord profile."
                    rows={2}
                    maxLength={190}
                    className="w-full rounded-lg border border-os-hairline/50 bg-os-bg/60 px-3 py-2.5 font-body text-[14px] text-os-heading placeholder:text-os-faint outline-none transition focus:border-os-accent/70 resize-y leading-relaxed"
                  />
                  <p className="mt-1 text-[11px] text-os-faint text-right">{bio.length}/190</p>
                  {isPack && (
                    <p className="mt-2 text-[11px] text-os-faint">
                      Tip: click out of this box to slide to the next bot.
                    </p>
                  )}
                </div>
              </div>
            </div>


            {usesPackTabs && visibleIdentityTabs.length > 1 && (() => {
              const tabs = visibleIdentityTabs;
              const idx = tabs.findIndex((t) => t.id === effectiveActiveTab);
              const prev = idx > 0 ? tabs[idx - 1] : null;
              const next = idx < tabs.length - 1 ? tabs[idx + 1] : null;
              return (
                <div className="mt-5 flex items-center justify-between gap-3 pt-4 border-t border-os-hairline/40">
                  <button
                    type="button"
                    disabled={!prev}
                    onClick={() => prev && goToTab(prev.id)}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-os-accent/60 px-5 py-2.5 font-label text-[11px] font-bold uppercase tracking-[0.14em] text-os-accent transition hover:bg-os-accent hover:text-os-accent-ink disabled:opacity-50"
                  >
                    ← {prev ? prev.label : "Previous"}
                  </button>
                  <span className="text-[11px] text-os-faint">
                    Bot {idx + 1} of {tabs.length}
                  </span>
                  <button
                    type="button"
                    disabled={!next}
                    onClick={() => next && goToTab(next.id)}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-os-accent px-6 py-3 font-label text-[12px] font-bold uppercase tracking-[0.14em] text-os-accent-ink transition hover:brightness-105 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {next ? `Next: ${next.label}` : "All set"} →
                  </button>
                </div>
              );
            })()}
          </div>

          {/* Step 4 — Notes */}
          <div className="rounded-2xl border border-os-hairline/40 bg-os-surface/30 backdrop-blur-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="grid h-7 w-7 place-items-center rounded-full border border-os-accent/40 bg-os-accent/10 font-label text-xs font-bold text-os-accent">
                4
              </div>
              <h3 className="font-display text-lg font-semibold text-os-heading">Anything else?</h3>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Custom commands, integrations, server size, deadlines — whatever you've got."
              rows={4}
              className="w-full rounded-lg border border-os-hairline/50 bg-os-bg/60 px-3 py-2.5 font-body text-[14px] text-os-heading placeholder:text-os-faint outline-none transition focus:border-os-accent/70 resize-y leading-relaxed"
            />
          </div>

        </div>

        {/* Right: dark live preview */}
        <aside data-no-translate className={`${showPayment ? "" : "lg:sticky lg:top-24"} h-fit space-y-4`}>
          {/* Profile card — dark themed */}
          <div className="rounded-2xl overflow-hidden border border-os-hairline/40 bg-os-ink shadow-[0_20px_60px_-30px_rgb(0_0_0/0.7)]">
            {/* Banner */}
            <div className="relative h-24 bg-gradient-to-br from-os-accent/40 via-os-accent/15 to-transparent">
              {banner && (
                <img src={banner} alt="" className="absolute inset-0 w-full h-full object-cover" />
              )}
              <button
                type="button"
                className="absolute top-2 right-2 h-7 w-7 rounded-full bg-os-bg/60 backdrop-blur grid place-items-center text-os-body"
                aria-label="More"
              >
                <MoreHorizontal size={14} />
              </button>
            </div>

            {/* Avatar */}
            <div className="px-4 pb-4 -mt-10">
              <div className="relative inline-block">
                <div className="h-20 w-20 rounded-full border-[6px] border-os-ink bg-os-surface overflow-hidden grid place-items-center">
                  {icon ? (
                    <img src={icon} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <SelectedIcon size={28} className="text-os-accent" />
                  )}
                </div>
              </div>

              {/* Name + tag */}
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <h4 className="text-os-heading font-bold text-lg leading-tight truncate">
                  {displayName}
                </h4>
                <span className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-os-accent text-os-accent-ink">
                  APP
                </span>
              </div>
              <div className="text-os-faint text-xs mt-0.5">{displayTag}</div>

              {/* Add App button */}
              <button
                type="button"
                className="mt-3 w-full h-9 rounded-md bg-os-accent hover:brightness-105 text-os-accent-ink text-sm font-medium transition"
              >
                + Add App
              </button>

              {/* Description */}
              {description && (
                <div className="mt-3 rounded-md bg-os-accent/10 border border-os-accent/20 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-widest text-os-accent font-semibold mb-1">
                    About
                  </div>
                  <p className="text-os-body text-xs leading-relaxed whitespace-pre-wrap">
                    {description}
                  </p>
                </div>
              )}

              {/* Roles */}
              <div className="mt-3">
                <div className="text-[10px] uppercase tracking-widest text-os-faint font-semibold mb-1.5">
                  Roles
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(isPack ? ["scratch"] : bases).map((bid) => {
                    const b = BASES.find((x) => x.id === bid);
                    if (!b) return null;
                    return (
                      <span
                        key={bid}
                        className="inline-flex items-center gap-1 text-[11px] text-os-body bg-os-accent/15 border border-os-accent/30 rounded-full px-2 py-0.5"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-os-accent" />
                        {b.name}
                      </span>
                    );
                  })}
                  {addons.slice(0, 3).map((id) => {
                    const a = currentAddons.find((x) => x.id === id);
                    if (!a) return null;
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 text-[11px] text-os-body bg-os-accent/10 border border-os-accent/25 rounded-full px-2 py-0.5"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-os-accent/70" />
                        {a.name}
                      </span>
                    );
                  })}
                  {addons.length > 3 && (
                    <span className="text-[11px] text-os-faint px-2 py-0.5">
                      +{addons.length - 3}
                    </span>
                  )}
                </div>
              </div>

              {/* Fake message bar */}
              <div className="mt-3 flex items-center gap-2 rounded-md bg-os-surface px-3 h-9 text-os-faint text-xs">
                <span className="flex-1 truncate">Message @{displayName}</span>
                <Gift size={14} />
                <Smile size={14} />
              </div>
            </div>
          </div>

          {/* Estimate + submit */}
          <div className="rounded-2xl border border-os-accent/30 bg-gradient-to-br from-os-accent/10 via-os-surface/30 to-os-bg/40 backdrop-blur-sm p-5">
            <div className="flex items-center justify-between">
              <span className="font-label text-xs uppercase tracking-widest text-os-faint">
                Estimated
              </span>
              <span className="text-2xl font-bold tracking-tight text-os-heading">
                {(appliedDiscount || comped) && (
                  <span className="text-base text-os-faint line-through font-normal mr-2">
                    ${total.toFixed(2)}
                  </span>
                )}
                ${(comped ? 0 : finalTotal).toFixed(2)}
                <span className="text-xs text-os-faint font-normal"> one-time*</span>
              </span>
            </div>
            {comped && (
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="text-emerald-400 font-medium">
                  Comped account — 100% off
                </span>
                <span className="text-emerald-400 font-medium">
                  −${total.toFixed(2)}
                </span>
              </div>
            )}
            {appliedDiscount && !comped && (
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="text-emerald-400 font-medium">
                  Code {appliedDiscount.code} applied
                </span>
                <span className="text-emerald-400 font-medium">
                  −${discountAmount.toFixed(2)}
                </span>
              </div>
            )}
            {/* Managed hosting — always included. Pricing is tiered across the
                user's account: $5/mo for bot 1, $5/mo for bot 2, 3rd bot free. */}
            <div className="mt-4 w-full rounded-lg border border-os-accent/40 bg-os-accent/5 p-3 flex items-start gap-3">
              <div className="h-5 w-5 rounded-md bg-os-accent border border-os-accent grid place-items-center shrink-0 mt-0.5">
                <Check size={12} className="text-os-accent-ink" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm font-medium text-os-heading">Managed hosting included</span>
                  <span className="text-sm font-semibold text-os-heading">
                    {comped ? (
                      <>
                        <span className="text-os-faint line-through font-normal mr-1.5">
                          +$5/month
                        </span>
                        <span className="text-emerald-400">waived</span>
                      </>
                    ) : (
                      <>
                        +$5<span className="text-xs text-os-faint font-normal">/month</span>
                      </>
                    )}
                  </span>
                </div>
                <p className="text-xs text-os-faint mt-1">
                  {comped ? (
                    <>We host and keep your bot online 24/7 — hosting is waived for this account.</>
                  ) : (
                    <>
                      We host and keep your bot online 24/7. <strong>Buy a 3rd bot and its
                      hosting is free</strong> — 1 bot $5/mo, 2 bots $10/mo, 3 bots still $10/mo.
                    </>
                  )}
                </p>
              </div>
            </div>
            {addons.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {addons.map((id) => {
                  const a = currentAddons.find((x) => x.id === id);
                  if (!a) return null;
                  return (
                    <span key={id} className="inline-flex items-center rounded-full border border-os-hairline/50 bg-os-surface/60 px-2 py-0.5 font-label text-[10px] uppercase tracking-[0.1em] text-os-body">
                      {a.name}
                    </span>
                  );
                })}
              </div>
            )}
            {!showPayment && (
              <>
                <button
                  className="w-full mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-os-accent px-6 py-3 font-label text-[12px] font-bold uppercase tracking-[0.14em] text-os-accent-ink transition hover:brightness-105 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none"
                  onClick={submit}
                  disabled={submitting}
                >
                  {primaryCtaLabel} <ArrowRight />
                </button>
                <BotStockIndicator className="mt-2" />
              </>
            )}


            {/* Collapsible payment / contact details */}
            <div
              id="payment-section"
              className={`grid transition-all duration-500 ease-out ${
                showPayment
                  ? "grid-rows-[1fr] opacity-100 mt-4"
                  : "grid-rows-[0fr] opacity-0 mt-0"
              }`}
            >
              <div className="overflow-hidden">
                <div className="rounded-xl border border-os-hairline/40 bg-os-surface/30 backdrop-blur-sm p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-os-heading">
                    <LockIcon size={12} className="text-os-accent" />
                    Secure payment details
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <input
                      placeholder="Full name"
                      value={payFullName}
                      onChange={(e) => setPayFullName(e.target.value)}
                      className="w-full rounded-lg border border-os-hairline/50 bg-os-bg/60 px-3 py-2.5 font-body text-[14px] text-os-heading placeholder:text-os-faint outline-none transition focus:border-os-accent/70"
                    />
                    <input
                      type="email"
                      placeholder="Email address"
                      value={payEmail}
                      onChange={(e) => setPayEmail(e.target.value)}
                      className="w-full rounded-lg border border-os-hairline/50 bg-os-bg/60 px-3 py-2.5 font-body text-[14px] text-os-heading placeholder:text-os-faint outline-none transition focus:border-os-accent/70"
                    />
                    <div className="relative">
                      <input
                        placeholder="Card number"
                        inputMode="numeric"
                        value={payCard}
                        onChange={(e) => setPayCard(e.target.value)}
                        className="w-full rounded-lg border border-os-hairline/50 bg-os-bg/60 py-2.5 pr-3 pl-9 font-body text-[14px] text-os-heading placeholder:text-os-faint outline-none transition focus:border-os-accent/70"
                      />
                      <CreditCard
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-os-faint"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        placeholder="MM/YY"
                        value={payExp}
                        onChange={(e) => setPayExp(e.target.value)}
                        className="w-full rounded-lg border border-os-hairline/50 bg-os-bg/60 px-3 py-2.5 font-body text-[14px] text-os-heading placeholder:text-os-faint outline-none transition focus:border-os-accent/70"
                      />
                      <input
                        placeholder="CVC"
                        value={payCvc}
                        onChange={(e) => setPayCvc(e.target.value)}
                        className="w-full rounded-lg border border-os-hairline/50 bg-os-bg/60 px-3 py-2.5 font-body text-[14px] text-os-heading placeholder:text-os-faint outline-none transition focus:border-os-accent/70"
                      />
                      <input
                        placeholder="ZIP"
                        value={payZip}
                        onChange={(e) => setPayZip(e.target.value)}
                        className="w-full rounded-lg border border-os-hairline/50 bg-os-bg/60 px-3 py-2.5 font-body text-[14px] text-os-heading placeholder:text-os-faint outline-none transition focus:border-os-accent/70"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-os-faint leading-relaxed">
                    This locks in your spot in the build queue. We'll only finalize the charge once we've confirmed your build scope.
                  </p>
                </div>

                {/* Discount code */}
                <div className="mt-3 rounded-xl border border-os-hairline/40 bg-os-surface/30 backdrop-blur-sm p-4">
                  <div className="flex items-center gap-2 text-xs font-medium text-os-heading mb-2">
                    <Tag size={12} className="text-os-accent" />
                    Have a discount code?
                  </div>
                  {appliedDiscount ? (
                    <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                      <div className="text-xs">
                        <div className="font-mono font-semibold text-os-heading">{appliedDiscount.code}</div>
                        <div className="text-emerald-400">
                          {appliedDiscount.kind === "percent"
                            ? `${appliedDiscount.value}% off`
                            : `$${appliedDiscount.value} off`}{" "}
                          (−${discountAmount.toFixed(2)})
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={removeDiscount}
                        className="text-os-faint hover:text-os-heading transition-colors text-xs font-medium px-2 py-1"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        value={discountCodeInput}
                        onChange={(e) => setDiscountCodeInput(e.target.value.toUpperCase())}
                        placeholder="WELCOME10"
                        maxLength={32}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            applyDiscount();
                          }
                        }}
                        className="w-full rounded-lg border border-os-hairline/50 bg-os-bg/60 px-3 py-2.5 font-body text-[14px] text-os-heading placeholder:text-os-faint outline-none transition focus:border-os-accent/70"
                      />
                      <button
                        type="button"
                        onClick={applyDiscount}
                        disabled={applyingDiscount || !discountCodeInput.trim()}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-os-accent/60 px-5 py-2.5 font-label text-[11px] font-bold uppercase tracking-[0.14em] text-os-accent transition hover:bg-os-accent hover:text-os-accent-ink disabled:opacity-50"
                      >
                        {applyingDiscount ? "…" : "Apply"}
                      </button>
                    </div>
                  )}
                </div>

                {/* Engine version picker */}
                <div className="mt-3 rounded-xl border border-os-hairline/40 bg-os-surface/30 backdrop-blur-sm p-4">
                  <div className="flex items-center gap-2 text-xs font-medium text-os-heading mb-2">
                    <Code2 size={12} className="text-os-accent" />
                    Bot engine version
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { id: "v1", label: "Component V1", sub: "Stable — recommended" },
                      { id: "v2", label: "Component V2", sub: "Newest — latest features" },
                    ] as const).map((opt) => {
                      const active = engineVersion === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setEngineVersion(opt.id)}
                          className={`text-left rounded-lg border p-2.5 transition ${
                            active
                              ? "border-os-accent bg-os-accent/10 shadow-[0_0_30px_-10px_rgb(var(--os-accent)/0.6)]"
                              : "border-os-hairline/40 bg-os-bg/40 hover:border-os-accent/50"
                          }`}
                        >
                          <div className="text-xs font-medium text-os-heading flex items-center justify-between">
                            {opt.label}
                            {active && <Check size={12} className="text-os-accent" />}
                          </div>
                          <div className="text-[10px] text-os-faint mt-0.5">{opt.sub}</div>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-os-faint mt-2.5 leading-relaxed">
                    You can switch versions later from your bot's dashboard.
                  </p>
                </div>

                {/* Financing — split the total into monthly installments.
                    Comped accounts never pay, so the plan picker is replaced
                    with a single "no payment required" panel. */}
                <div className="mt-3 rounded-xl border border-os-hairline/40 bg-os-surface/30 backdrop-blur-sm p-4">
                  <div className="flex items-center gap-2 text-xs font-medium text-os-heading mb-2">
                    <CreditCard size={12} className="text-os-accent" />
                    How would you like to pay?
                  </div>
                  {comped ? (
                    <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3">
                      <div className="text-xs font-medium text-emerald-400 flex items-center gap-1.5">
                        <Check size={12} /> No payment required
                      </div>
                      <div className="text-[10px] text-os-faint mt-1 leading-relaxed">
                        This account is comped —{" "}
                        <span className="line-through">${total.toFixed(2)} once</span>{" "}
                        <span className="text-emerald-400 font-medium">$0.00</span>. No card
                        needed; your build starts as soon as you place the order.
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          { id: "full", label: "Pay in full", sub: `$${finalTotal.toFixed(2)} once` },
                          { id: "3", label: "3 months", sub: `$${(finalTotal / 3).toFixed(2)}/mo` },
                          { id: "6", label: "6 months", sub: `$${(finalTotal / 6).toFixed(2)}/mo` },
                          { id: "10", label: "10 months", sub: `$${(finalTotal / 10).toFixed(2)}/mo` },
                        ] as const).map((opt) => {
                          const active = paymentPlan === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setPaymentPlan(opt.id)}
                              className={`text-left rounded-lg border p-2.5 transition ${
                                active
                                  ? "border-os-accent bg-os-accent/10 shadow-[0_0_30px_-10px_rgb(var(--os-accent)/0.6)]"
                                  : "border-os-hairline/40 bg-os-bg/40 hover:border-os-accent/50"
                              }`}
                            >
                              <div className="text-xs font-medium text-os-heading flex items-center justify-between">
                                {opt.label}
                                {active && <Check size={12} className="text-os-accent" />}
                              </div>
                              <div className="text-[10px] text-os-faint mt-0.5">{opt.sub}</div>
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-os-faint mt-2.5 leading-relaxed">
                        {paymentPlan === "full"
                          ? "One charge once we confirm your build scope."
                          : `${paymentPlan} equal monthly payments — no fees, no interest. Build starts after the first payment clears.`}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {showPayment && (
              <>
                <button
                  ref={confirmBtnRef}
                  className="w-full mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-os-accent px-6 py-3 font-label text-[12px] font-bold uppercase tracking-[0.14em] text-os-accent-ink transition hover:brightness-105 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none"
                  onClick={submit}
                  disabled={submitting}
                >
                  {confirmCtaLabel} <ArrowRight />
                </button>
                <BotStockIndicator className="mt-2" />
              </>
            )}



            <p className="text-[10px] text-os-faint mt-3 leading-relaxed">
              *Final pricing depends on scope. We'll confirm everything before any work begins.
            </p>
          </div>
        </aside>
      </div>

      {/* Cinematic success overlay */}
      {showSuccess && (
        <div
          className={`fixed inset-0 z-[100] overflow-hidden transition-colors duration-500 ${
            showSuccessText ? "bg-os-bg/85 backdrop-blur-md" : "bg-transparent pointer-events-none"
          }`}
        >
          {/* Confetti — only after the plane zooms past */}
          {showSuccessText &&
            Array.from({ length: 24 }).map((_, i) => {
              const left = (i * 4.3) % 100;
              const delay = (i % 8) * 0.12;
              const colors = ["bg-os-accent", "bg-os-accent-deep", "bg-os-heading", "bg-os-accent"];
              const color = colors[i % colors.length];
              return (
                <span
                  key={i}
                  className={`absolute top-0 w-2 h-3 rounded-sm ${color} animate-confetti-fall`}
                  style={{ left: `${left}%`, animationDelay: `${delay}s` }}
                />
              );
            })}

          {/* Expanding rings — burst on impact */}
          {showSuccessText && (
            <>
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border-2 border-os-accent/40 animate-ring-expand" />
              <span
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border-2 border-os-accent/30 animate-ring-expand"
                style={{ animationDelay: "0.3s" }}
              />
            </>
          )}

          {/* Flying paper airplane — launches from the button */}
          {!showSuccessText && planeOrigin && (
            <div
              className="absolute text-os-accent animate-plane-fly"
              style={{
                left: planeOrigin.x,
                top: planeOrigin.y,
                marginLeft: "-36px",
                marginTop: "-36px",
                filter: "drop-shadow(0 8px 22px rgb(var(--os-accent)/0.45))",
                transformOrigin: "center",
              }}
            >
              <svg
                width="72"
                height="72"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 2 11 13" />
                <path d="M22 2 15 22l-4-9-9-4 20-7Z" fill="currentColor" fillOpacity="0.18" />
              </svg>
            </div>
          )}

          {/* Center message — appears right when the plane flies past */}
          {showSuccessText && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative text-center px-6 animate-burst-in max-w-lg">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-os-accent shadow-[0_0_30px_-10px_rgb(var(--os-accent)/0.6)] mb-6">
                  <Check size={42} className="text-os-accent-ink" strokeWidth={3} />
                </div>
                <h3 className="font-display text-3xl md:text-5xl font-bold tracking-tight text-os-heading">
                  It's <span className="text-os-accent">sent!</span>
                </h3>
                {user ? (
                  addons.includes("dashboard") || dashboardAlreadyOwned ? (
                    <>
                      <p className="mt-3 font-body text-base md:text-lg text-os-body">
                        We're getting right to work on your build. Manage{" "}
                        <span className="text-os-heading font-medium">{displayName}</span>{" "}
                        any time from your{" "}
                        <span className="text-os-heading font-medium">Bot Dashboard</span>.
                      </p>
                      <p className="mt-3 font-body text-sm text-os-faint">
                        Open the account menu (top-right) → <span className="text-os-heading">Dashboard</span>,
                        or we'll redirect you in a moment.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="mt-3 font-body text-base md:text-lg text-os-body">
                        We're getting right to work on your build. Track{" "}
                        <span className="text-os-heading font-medium">{displayName}</span>{" "}
                        from <span className="text-os-heading font-medium">Settings → Bot Orders</span>.
                      </p>
                      <p className="mt-3 font-body text-sm text-os-faint">
                        Tip: add the <span className="text-os-heading">Web Dashboard</span> add-on
                        to manage your bot from this site. Otherwise use{" "}
                        <code className="text-os-heading bg-os-surface/60 px-1.5 py-0.5 rounded text-xs">/cmds</code>{" "}
                        in your Discord server.
                      </p>
                    </>
                  )
                ) : (
                  <p className="mt-3 font-body text-base md:text-lg text-os-body">
                    We're getting right to work on your build. Check your inbox — we'll
                    be in touch shortly.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      {discordGateOpen && (
        <div
          className="fixed inset-0 z-[70] grid place-items-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setDiscordGateOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-os-hairline/50 bg-os-surface p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="grid h-10 w-10 place-items-center rounded-full border border-os-accent/40 bg-os-accent/10 text-os-accent">
                <Bell size={18} />
              </div>
              <h3 className="font-display text-lg font-semibold text-os-heading">
                Link your Discord
              </h3>
            </div>
            <p className="font-body text-sm text-os-faint mb-5 leading-relaxed">
              Link your Discord so we can message you the moment your bot is ready — and reach
              you if we ever need to confirm your order. Takes two clicks.
            </p>
            <button
              type="button"
              onClick={startDiscordLink}
              disabled={discordLinking}
              className="w-full rounded-lg bg-os-accent px-4 py-2.5 font-label text-sm font-semibold text-os-accent-ink transition hover:brightness-110 disabled:opacity-60"
            >
              {discordLinking ? "Waiting for Discord…" : "Link Discord"}
            </button>
            <button
              type="button"
              onClick={skipDiscord}
              className="mt-3 block w-full text-center font-body text-xs text-os-faint/70 underline-offset-2 transition hover:text-os-faint hover:underline"
            >
              No thanks — just build it
            </button>
          </div>
        </div>
      )}

      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={(o) => {
          setCheckoutOpen(o);
          // If the user closes the dialog without paying, just leave the
          // bot_order in 'pending_payment'. They can retry by re-submitting.
        }}
        items={checkoutItems}
        customerEmail={user?.email ?? undefined}
      />
    </section>
  );
}
