import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast as sonnerToast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOwnedBots } from "@/hooks/useOwnedBots";
import { useBotSalesMode } from "@/hooks/useBotSalesMode";
import { useAddonOverrides, setAddonIncluded } from "@/hooks/useAddonOverrides";
import { CheckoutDialog, type CheckoutItem } from "@/components/CheckoutDialog";
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
  Wand2,
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
  Cake,
  AlarmClock,
  Trash2,
  Tag,
  Languages,
  Save,
  Settings2,
  MessageSquare,
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
      "Anti-spam",
      "Anti-raid",
      "Basic logging (bans/kicks/joins only)",
      "Phishing link detection",
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
      "Ban appeals",
      "Member reports",
      "Welcome / goodbye messages",
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
      "Autorole",
      "Poll",
      "Userinfo, serverinfo, avatar",
      "Basic music (no Spotify, no auto-radio)",
      "8ball, coinflip",
    ],
  },
  {
    id: "scratch",
    name: "All-in-One Pack",
    tagline: "Protection + Support + Utilities — every base in one bot.",
    icon: Sparkles,
    price: 199,
    oldPrice: 249,
    included: [
      "Everything in Oversite Protection",
      "Everything in Oversite Support",
      "Everything in Oversite Utilities",
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
    { id: "staff-notes", name: "Staff Notes on Users", desc: "Private notes staff can attach to any member.", icon: ClipboardList, price: 1.99 },
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
    { id: "roblox-verification", name: "Roblox Verification", desc: "Verify members against their Roblox account.", icon: UserCheck, price: 0.99 },
    { id: "starboard", name: "Starboard", desc: "Highlight top reactions in a starboard channel.", icon: Star, price: 0.99 },
    { id: "recurring-messages", name: "Recurring Messages", desc: "Schedule messages on a repeating timer.", icon: Calendar, price: 0.99 },
    { id: "giveaway-system", name: "Giveaway System", desc: "Run giveaways with reactions and timers.", icon: Gift, price: 0.99 },
    { id: "birthday-announcements", name: "Birthday Announcements", desc: "Auto-announce member birthdays.", icon: Cake, price: 0.99 },
    { id: "server-stats-channels", name: "Server Stats Channels", desc: "Auto-updating channel names with member counts.", icon: Hash, price: 0.99 },
    { id: "live-notifications", name: "Twitch / YouTube Notifications", desc: "Ping when streamers go live or upload.", icon: Bell, price: 0.99 },
    { id: "leveling-system", name: "Leveling System", desc: "XP, level-ups, and role rewards.", icon: BarChart3, price: 2.99 },
    { id: "economy-system", name: "Economy System", desc: "Currency, shop, and rewards.", icon: CreditCard, price: 1.99 },
    { id: "remindme", name: "/remindme", desc: "Personal reminder commands.", icon: AlarmClock, price: 0.99 },
  ],
  scratch: [],
};

const getAddonsForBase = (baseId: string): Addon[] => {
  if (baseId === "scratch") {
    return [
      ...ADDONS_BY_BASE.protection,
      ...ADDONS_BY_BASE.support,
      ...ADDONS_BY_BASE.utilities,
      ...SHARED_ADDONS,
    ];
  }
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
  icon: string | null;
  banner: string | null;
};

const EMPTY_IDENTITY: Identity = { name: "", description: "", icon: null, banner: null };

const PACK_TABS: { id: string; label: string; icon: typeof Shield }[] = [
  { id: "protection", label: "Protection bot", icon: Shield },
  { id: "support", label: "Support bot", icon: LifeBuoy },
  { id: "utilities", label: "Utilities bot", icon: Wrench },
];

export const BotBuilder = () => {
  const { user, isAdmin } = useAuth();
  const { hasDashboardAccess: dashboardAlreadyOwned } = useOwnedBots();
  const { isLive: salesLive } = useBotSalesMode();
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
  const [notes, setNotes] = useState("");
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
  const [monthlyHosting, setMonthlyHosting] = useState(false);
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

  const activeIdentity: Identity = usesPackTabs ? packIdentities[effectiveActiveTab] : identity;
  const { name, description, icon, banner } = activeIdentity;


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
  const handleDescriptionBlur = () => advanceToNextTab();

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

  const toggleAddon = (id: string) =>
    setAddons((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));

  // Toggle a base with the multi-select rules.
  const toggleBase = (id: string) => {
    setAddons([]);
    setShowAllAddons({});
    if (id === "scratch") {
      // Pack is exclusive
      setBases(["scratch"]);
      setActivePackTab("protection");
      return;
    }
    setBases((prev) => {
      // If pack is currently selected, replace with this single
      if (prev.includes("scratch")) {
        setActivePackTab(id);
        return [id];
      }
      // Toggle off (but keep at least one selected)
      if (prev.includes(id)) {
        if (prev.length === 1) {
          sonnerToast.info("Pick at least one bot", {
            description: "You need to keep one base selected.",
          });
          return prev;
        }
        const next = prev.filter((b) => b !== id);
        if (!next.includes(activePackTab)) setActivePackTab(next[0]);
        return next;
      }
      // Add — cap at 2 single bots
      if (prev.length >= 2) {
        sonnerToast.info("Two-bot limit", {
          description: "You can pick up to two bots — or grab the All-in-One Pack for all three.",
        });
        return prev;
      }
      const next = [...prev, id];
      setActivePackTab(next[0]);
      return next;
    });
  };

  const total = useMemo(() => {
    // Pack is its own flat price. For singles: first bot full price,
    // each additional single bot is a discounted $50 add-on.
    const SECOND_BOT_PRICE = 50;
    let baseCost = 0;
    if (bases.includes("scratch")) {
      baseCost = BASES.find((b) => b.id === "scratch")?.price ?? 0;
    } else {
      baseCost = bases.reduce((sum, id, idx) => {
        const b = BASES.find((x) => x.id === id);
        if (!b) return sum;
        return sum + (idx === 0 ? b.price : SECOND_BOT_PRICE);
      }, 0);
    }
    // Add-ons default to INCLUDED (free). Admins can flip individual ones to
    // NOT INCLUDED — those then add their listed price to the total when
    // the customer selects them.
    const addonLookup = new Map<string, Addon>();
    for (const list of Object.values(ADDONS_BY_BASE)) for (const a of list) addonLookup.set(a.id, a);
    for (const a of SHARED_ADDONS) addonLookup.set(a.id, a);
    const addonCost = addons.reduce((sum, id) => {
      if (addonIsIncluded(id)) return sum;
      const a = addonLookup.get(id);
      return sum + (a?.price ?? 0);
    }, 0);
    return baseCost + addonCost;
  }, [bases, addons, addonIsIncluded]);

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
    const { data, error } = await (supabase as any)
      .from("discount_codes")
      .select("code, kind, value, max_uses, times_used, expires_at, is_active")
      .ilike("code", code)
      .maybeSingle();
    setApplyingDiscount(false);
    if (error || !data) {
      sonnerToast.error("Invalid code");
      return;
    }
    if (!data.is_active) {
      sonnerToast.error("This code is disabled");
      return;
    }
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      sonnerToast.error("This code has expired");
      return;
    }
    if (data.max_uses != null && data.times_used >= data.max_uses) {
      sonnerToast.error("This code has reached its limit");
      return;
    }
    setAppliedDiscount({
      code: data.code,
      kind: data.kind,
      value: Number(data.value),
    });
    sonnerToast.success(`Code ${data.code} applied`);
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
    const baseField = isPack ? "scratch" : bases.join("+");
    const planMonths = paymentPlan === "full" ? null : parseInt(paymentPlan, 10);
    const installmentAmount = planMonths ? Number((finalTotal / planMonths).toFixed(2)) : null;
    const { data: inserted, error } = await (supabase as any)
      .from("bot_orders")
      .insert({
        user_id: user.id,
        bot_name: primary.name.trim(),
        bot_description: primary.description.trim() || null,
        icon_url: primary.icon,
        banner_url: primary.banner,
        base: baseField,
        addons,
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
      })
      .select("id")
      .single();
    if (error || !inserted) {
      sonnerToast.error("Couldn't save your order", { description: error?.message });
      return null;
    }
    // Best-effort: bump times_used on the code (non-blocking).
    if (appliedDiscount) {
      const { data: row } = await (supabase as any)
        .from("discount_codes")
        .select("id, times_used")
        .ilike("code", appliedDiscount.code)
        .maybeSingle();
      if (row) {
        await (supabase as any)
          .from("discount_codes")
          .update({ times_used: (row.times_used ?? 0) + 1 })
          .eq("id", row.id);
      }
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
    setSubmitting(true);

    // Save the order to the database (status='pending_payment'). Stripe webhook
    // flips it to 'paid' on checkout.session.completed, which triggers the build.
    const orderId = await persistOrder();
    if (user && !orderId) {
      setSubmitting(false);
      return;
    }

    // For signed-in users with a real order: open Stripe checkout.
    // The first installment amount (or full total) is what gets charged now.
    if (user && orderId) {
      const { primary } = buildSubmissionPayload();
      const planMonths = paymentPlan === "full" ? null : parseInt(paymentPlan, 10);
      const chargeNow = planMonths
        ? Number((finalTotal / planMonths).toFixed(2))
        : finalTotal;
      const amountCents = Math.max(50, Math.round(chargeNow * 100));
      setCheckoutItems([
        {
          productName: planMonths
            ? `${primary.name.trim() || "Custom Bot"} — installment 1 of ${planMonths}`
            : primary.name.trim() || "Custom Bot",
          amountCents,
          currency: "usd",
          quantity: 1,
          botOrderId: orderId,
        },
      ]);
      setCheckoutOpen(true);
      setSubmitting(false);
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

  const selectedBase = BASES.find((b) => b.id === (isPack ? "scratch" : bases[0]));
  const SelectedIcon = selectedBase?.icon ?? Bot;
  const displayName = name.trim() || "Your Bot";
  const displayTag = (name.trim() || "yourbot").toLowerCase().replace(/\s+/g, "") + "#0001";

  return (
    <section id="build" className="mt-24 scroll-mt-24">
      <div className="max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-medium mb-6">
          <Wand2 size={14} />
          Bot Builder
        </div>
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
          Design your <span className="text-gradient">dream bot.</span>
        </h2>
        <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
          Pick a base, stack on add-ons, and tell us what you want. We'll quote your build and
          get the wheels spinning.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: configurator */}
        <div className="lg:col-span-2 space-y-8">
          {/* Two-bot deal callout */}
          <div className="rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/15 border border-primary/30 grid place-items-center shrink-0">
              <Sparkles size={16} className="text-primary" />
            </div>
            <div className="text-xs sm:text-sm">
              <span className="font-semibold text-foreground">Any two bots = $149 one-time.</span>{" "}
              <span className="text-muted-foreground">Mix and match — protection, support, or utilities. Same price no matter which two.</span>
            </div>
          </div>
          {/* Step 1 — Base */}
          <div id="pick-base" className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur p-6 scroll-mt-24">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-7 w-7 rounded-full bg-primary/15 border border-primary/30 grid place-items-center text-xs font-bold text-primary">
                1
              </div>
              <h3 className="text-lg font-semibold">Pick a starting point</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Pick one bot, mix two, or grab the All-in-One Pack to bundle all three.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(() => {
                // First selected single bot keeps full price; any other single bot
                // (whether already selected or available) shows the $50 add-on price.
                const firstSingle = bases.find((id) => id !== "scratch");
                return BASES.map((b) => {
                const Icon = b.icon;
                const active = bases.includes(b.id);
                const isDiscountedSecond =
                  b.id !== "scratch" && !!firstSingle && b.id !== firstSingle;
                const displayPrice = isDiscountedSecond ? 50 : b.price;
                const displayOldPrice = isDiscountedSecond ? b.price : b.oldPrice;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => toggleBase(b.id)}
                    className={`group text-left rounded-xl border p-4 transition-smooth ${
                      active
                        ? "border-primary bg-primary/10 shadow-glow"
                        : "border-border/60 bg-background/40 hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Icon
                          size={18}
                          className={`transition-smooth ${active ? "text-primary" : "text-muted-foreground"}`}
                        />
                        <span className="font-semibold">{b.name}</span>
                      </div>
                      {active && <Check size={16} className="text-primary" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                      {b.tagline}
                    </p>
                    <ul className="mt-3 space-y-1">
                      {b.included.map((feat) => (
                        <li key={feat} className="flex items-start gap-1.5 text-[11px] text-foreground/75 leading-snug">
                          <Check size={11} className={`mt-0.5 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`} />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 flex items-center gap-2 flex-wrap text-xs text-foreground/80">
                      <span>one-time</span>
                      {displayOldPrice && (
                        <span className="text-muted-foreground line-through">${displayOldPrice}</span>
                      )}
                      <span className="font-semibold">${displayPrice}</span>
                      {isDiscountedSecond ? (
                        <span className="px-1.5 py-0.5 rounded-full bg-primary/15 border border-primary/30 text-primary text-[10px] font-semibold uppercase tracking-wide">
                          Add for $50
                        </span>
                      ) : b.oldPrice && (
                        <span className="px-1.5 py-0.5 rounded-full bg-primary/15 border border-primary/30 text-primary text-[10px] font-semibold uppercase tracking-wide">
                          {salesLive ? "Sale" : "Preorder sale"}
                        </span>
                      )}
                    </div>
                  </button>
                );
              });
              })()}
            </div>
          </div>

          {/* Step 2 — Identity */}
          <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-7 w-7 rounded-full bg-primary/15 border border-primary/30 grid place-items-center text-xs font-bold text-primary">
                2
              </div>
              <h3 className="text-lg font-semibold">
                {isPack
                  ? "Design your three bots"
                  : isMulti
                    ? `Design your ${visibleIdentityTabs.length} bots`
                    : "Bot identity"}
              </h3>
            </div>

            {usesPackTabs && (
              <>
                <p className="text-xs text-muted-foreground mb-4">
                  {isPack
                    ? "The All-in-One Pack ships as three focused bots. Give each one its own name, icon, banner, and vibe — finish the description and we'll slide you to the next."
                    : "You picked more than one bot. Give each one its own name, icon, banner, and vibe — finish the description and we'll slide you to the next."}
                </p>
                <div
                  className="relative grid gap-2 mb-5 rounded-xl border border-border/60 bg-background/40 p-1"
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
                        className={`relative flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-smooth ${
                          active
                            ? "bg-primary/15 text-primary border border-primary/40 shadow-glow"
                            : "text-muted-foreground hover:text-foreground border border-transparent"
                        }`}
                      >
                        <TIcon size={14} />
                        <span className="truncate">{t.label}</span>
                        {filled && (
                          <span className="ml-1 h-1.5 w-1.5 rounded-full bg-primary" />
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
                  <Label className="text-xs text-muted-foreground mb-2 block">Banner</Label>
                  <button
                    type="button"
                    onClick={() => bannerInputRef.current?.click()}
                    className="relative w-full h-28 rounded-xl border border-dashed border-border/60 bg-background/40 hover:border-primary/50 transition-smooth overflow-hidden group"
                  >
                    {banner ? (
                      <img src={banner} alt="Banner preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground gap-2 text-sm">
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
                    <Label className="text-xs text-muted-foreground mb-2 block">Icon</Label>
                    <button
                      type="button"
                      onClick={() => iconInputRef.current?.click()}
                      className="relative h-20 w-20 rounded-full border border-dashed border-border/60 bg-background/40 hover:border-primary/50 transition-smooth overflow-hidden grid place-items-center"
                    >
                      {icon ? (
                        <img src={icon} alt="Icon preview" className="w-full h-full object-cover" />
                      ) : (
                        <Upload size={18} className="text-muted-foreground" />
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
                  <p className="text-xs text-muted-foreground pb-2 leading-relaxed">
                    PNG/JPG up to 4MB. Icon shows as the bot's avatar; banner appears at the top of the profile.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="bot-name" className="text-xs text-muted-foreground mb-2 block">
                    Name
                  </Label>
                  <Input
                    id="bot-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={
                      isPack
                        ? `e.g. ${PACK_TABS.find((t) => t.id === activePackTab)?.label}`
                        : "e.g. Sentinel, Helper, NovaBot..."
                    }
                    className="h-11"
                  />
                </div>
                <div>
                  <Label htmlFor="bot-desc" className="text-xs text-muted-foreground mb-2 block">
                    Description
                  </Label>
                  <Textarea
                    id="bot-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onBlur={handleDescriptionBlur}
                    placeholder="Tell us about your bot — what it does, its personality, the vibe you're going for, and anything that makes it uniquely yours."
                    rows={5}
                  />
                  {isPack && (
                    <p className="mt-2 text-[11px] text-muted-foreground">
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
                <div className="mt-5 flex items-center justify-between gap-3 pt-4 border-t border-border/40">
                  <Button
                    type="button"
                    variant="outlineGlow"
                    size="sm"
                    disabled={!prev}
                    onClick={() => prev && goToTab(prev.id)}
                  >
                    ← {prev ? prev.label : "Previous"}
                  </Button>
                  <span className="text-[11px] text-muted-foreground">
                    Bot {idx + 1} of {tabs.length}
                  </span>
                  <Button
                    type="button"
                    variant="hero"
                    size="sm"
                    disabled={!next}
                    onClick={() => next && goToTab(next.id)}
                  >
                    {next ? `Next: ${next.label}` : "All set"} →
                  </Button>
                </div>
              );
            })()}
          </div>

          {/* Step 3 — Add-ons (depend on base) */}
          <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur p-6">
            {(() => {
              // Select all should NOT auto-pick the manual-only extras
              // (Custom Branding, Web Dashboard, Multi-Server License) —
              // those have a per-bot/account cost and need explicit opt-in.
              const SELECT_ALL_EXCLUDE = new Set(["branding", "dashboard", "multi-server"]);
              const allAvailableIds = (
                isPack
                  ? [
                      ...ADDONS_BY_BASE.protection,
                      ...ADDONS_BY_BASE.support,
                      ...ADDONS_BY_BASE.utilities,
                      ...SHARED_ADDONS,
                    ]
                  : [
                      ...bases.flatMap((b) => ADDONS_BY_BASE[b] ?? []),
                      ...SHARED_ADDONS,
                    ]
              )
                .map((a) => a.id)
                .filter((id) => !SELECT_ALL_EXCLUDE.has(id));
              const allSelected =
                allAvailableIds.length > 0 &&
                allAvailableIds.every((id) => addons.includes(id));
              const toggleAll = () =>
                setAddons(allSelected ? [] : Array.from(new Set(allAvailableIds)));
              return (
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-7 w-7 rounded-full bg-primary/15 border border-primary/30 grid place-items-center text-xs font-bold text-primary">
                    3
                  </div>
                  <h3 className="text-lg font-semibold">Stack on add-ons</h3>
                  <Button
                    type="button"
                    variant="outlineGlow"
                    size="sm"
                    className="ml-auto h-7 text-xs"
                    onClick={toggleAll}
                  >
                    {allSelected ? "Clear all" : "Select all"}
                  </Button>
                  <span className="text-xs text-muted-foreground">Tap to toggle</span>
                </div>
              );
            })()}
            <p className="text-xs text-muted-foreground mb-4">
              {isPack
                ? "All three categories included. Stack on extras from Protection, Support, or Utilities."
                : isMulti
                  ? <>Tailored options for each of your selected bots — stacked separately so you can mix &amp; match.</>
                  : <>Tailored options for your <span className="text-primary font-medium">{selectedBase?.name}</span> base.</>}
            </p>
            {(() => {
              const renderAddonCard = (a: Addon) => {
                const Icon = a.icon;
                const active = addons.includes(a.id);
                const included = addonIsIncluded(a.id);
                const toggleIncluded = async (e: React.MouseEvent) => {
                  e.stopPropagation();
                  e.preventDefault();
                  const { error } = await setAddonIncluded(a.id, !included, user?.id);
                  if (error) {
                    sonnerToast.error("Couldn't update — admin only", {
                      description: error.message,
                    });
                    return;
                  }
                  sonnerToast.success(
                    !included
                      ? `"${a.name}" marked as INCLUDED`
                      : `"${a.name}" marked as NOT INCLUDED`,
                  );
                };
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleAddon(a.id)}
                    className={`group text-left rounded-xl border p-4 transition-smooth ${
                      active
                        ? "border-primary bg-primary/10"
                        : "border-border/60 bg-background/40 hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center shrink-0">
                        <Icon size={14} className={active ? "text-primary" : "text-muted-foreground"} />
                      </div>
                      <div className="flex items-center gap-2">
                        {isAdmin && (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={toggleIncluded}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                toggleIncluded(e as unknown as React.MouseEvent);
                              }
                            }}
                            title={
                              included
                                ? "Admin: mark as NOT INCLUDED"
                                : "Admin: mark as INCLUDED"
                            }
                            className="h-5 w-5 rounded-md border border-border/70 bg-background/70 grid place-items-center text-muted-foreground hover:text-foreground hover:border-primary/60 transition-smooth"
                          >
                            <Settings2 size={12} />
                          </span>
                        )}
                        <div
                          className={`h-5 w-5 rounded-md border grid place-items-center transition-smooth ${
                            active ? "bg-primary border-primary" : "border-border"
                          }`}
                        >
                          {active && <Check size={12} className="text-primary-foreground" />}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 font-medium text-sm">{a.name}</div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {a.desc}
                    </p>
                    <div className="mt-2 text-xs text-foreground/80 flex items-center gap-2 flex-wrap">
                      {included ? (
                        <span className="px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-semibold">
                          INCLUDED
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-semibold">
                          NOT INCLUDED
                        </span>
                      )}
                      {a.price > 0 && (
                        <span className={included ? "line-through text-muted-foreground/70" : "text-foreground font-semibold"}>
                          ${a.price.toFixed(2)}
                        </span>
                      )}
                      {a.id === "dashboard" && (
                        <span className="px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-semibold">
                          ALL BOTS
                        </span>
                      )}
                    </div>
                  </button>
                );
              };

              const renderList = (key: string, list: Addon[]) => {
                const expanded = !!showAllAddons[key];
                const visible = expanded ? list : list.slice(0, 10);
                return (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {visible.map(renderAddonCard)}
                    </div>
                    {list.length > 10 && (
                      <div className="mt-4 flex justify-center">
                        {expanded ? (
                          <Button
                            key={`${key}-less`}
                            type="button"
                            variant="outlineGlow"
                            size="sm"
                            onClick={() =>
                              setShowAllAddons((prev) => ({ ...prev, [key]: false }))
                            }
                          >
                            Show less
                          </Button>
                        ) : (
                          <Button
                            key={`${key}-more`}
                            type="button"
                            variant="outlineGlow"
                            size="sm"
                            onClick={() =>
                              setShowAllAddons((prev) => ({ ...prev, [key]: true }))
                            }
                          >
                            View more ({list.length - 10})
                          </Button>
                        )}
                      </div>
                    )}
                  </>
                );
              };

              if (isPack) {
                return (
                  <div className="space-y-8">
                    {SCRATCH_CATEGORIES.map((cat) => {
                      const CatIcon = cat.icon;
                      return (
                        <div key={cat.id}>
                          <div className="flex items-center gap-2 mb-3">
                            <CatIcon size={16} className="text-primary" />
                            <h4 className="text-sm font-semibold tracking-tight">{cat.label}</h4>
                          </div>
                          {renderList(cat.id, cat.addons)}
                        </div>
                      );
                    })}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles size={16} className="text-primary" />
                        <h4 className="text-sm font-semibold tracking-tight">Extras</h4>
                      </div>
                      {renderList("shared", SHARED_ADDONS)}
                    </div>
                  </div>
                );
              }

              // One section per selected base, then Extras at the bottom.
              return (
                <div className="space-y-8">
                  {bases.map((bid) => {
                    const cat = SCRATCH_CATEGORIES.find((c) => c.id === bid);
                    const list = ADDONS_BY_BASE[bid] ?? [];
                    const CatIcon = cat?.icon ?? Sparkles;
                    return (
                      <div key={bid}>
                        {isMulti && (
                          <div className="flex items-center gap-2 mb-3">
                            <CatIcon size={16} className="text-primary" />
                            <h4 className="text-sm font-semibold tracking-tight">
                              {cat?.label ?? bid} stack-ons
                            </h4>
                          </div>
                        )}
                        {renderList(bid, list)}
                      </div>
                    );
                  })}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles size={16} className="text-primary" />
                      <h4 className="text-sm font-semibold tracking-tight">Extras</h4>
                    </div>
                    {renderList("shared", SHARED_ADDONS)}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Step 4 — Notes */}
          <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-7 w-7 rounded-full bg-primary/15 border border-primary/30 grid place-items-center text-xs font-bold text-primary">
                4
              </div>
              <h3 className="text-lg font-semibold">Anything else?</h3>
            </div>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Custom commands, integrations, server size, deadlines — whatever you've got."
              rows={4}
            />
          </div>
        </div>

        {/* Right: light/blue live preview */}
        <aside data-no-translate className={`${showPayment ? "" : "lg:sticky lg:top-24"} h-fit space-y-4`}>
          {/* Profile card — adapts to light/dark mode */}
          <div className="rounded-2xl overflow-hidden border border-primary/20 bg-white dark:bg-[hsl(220_8%_14%)] dark:border-white/10 shadow-elegant">
            {/* Banner */}
            <div className="relative h-24 bg-gradient-to-br from-primary/60 via-primary/30 to-primary/10">
              {banner && (
                <img src={banner} alt="" className="absolute inset-0 w-full h-full object-cover" />
              )}
              <button
                type="button"
                className="absolute top-2 right-2 h-7 w-7 rounded-full bg-white/70 dark:bg-black/40 backdrop-blur grid place-items-center text-slate-700 dark:text-slate-200"
                aria-label="More"
              >
                <MoreHorizontal size={14} />
              </button>
            </div>

            {/* Avatar */}
            <div className="px-4 pb-4 -mt-10">
              <div className="relative inline-block">
                <div className="h-20 w-20 rounded-full border-[6px] border-white dark:border-[hsl(220_8%_14%)] bg-slate-100 dark:bg-[hsl(220_8%_20%)] overflow-hidden grid place-items-center">
                  {icon ? (
                    <img src={icon} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <SelectedIcon size={28} className="text-primary" />
                  )}
                </div>
                <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full bg-[hsl(139_47%_44%)] border-[3px] border-white dark:border-[hsl(220_8%_14%)]" />
              </div>

              {/* Name + tag */}
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <h4 className="text-slate-900 dark:text-white font-bold text-lg leading-tight truncate">
                  {displayName}
                </h4>
                <span className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-primary text-primary-foreground">
                  APP
                </span>
              </div>
              <div className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">{displayTag}</div>

              {/* Add App button */}
              <button
                type="button"
                className="mt-3 w-full h-9 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium transition-smooth"
              >
                + Add App
              </button>

              {/* Description */}
              {description && (
                <div className="mt-3 rounded-md bg-primary/5 dark:bg-primary/10 border border-primary/10 dark:border-primary/20 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-widest text-primary/80 dark:text-primary-glow font-semibold mb-1">
                    About
                  </div>
                  <p className="text-slate-700 dark:text-slate-200 text-xs leading-relaxed whitespace-pre-wrap">
                    {description}
                  </p>
                </div>
              )}

              {/* Roles */}
              <div className="mt-3">
                <div className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-semibold mb-1.5">
                  Roles
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(isPack ? ["scratch"] : bases).map((bid) => {
                    const b = BASES.find((x) => x.id === bid);
                    if (!b) return null;
                    return (
                      <span
                        key={bid}
                        className="inline-flex items-center gap-1 text-[11px] text-slate-700 dark:text-slate-200 bg-primary/10 dark:bg-primary/20 border border-primary/20 dark:border-primary/30 rounded-full px-2 py-0.5"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
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
                        className="inline-flex items-center gap-1 text-[11px] text-slate-700 dark:text-slate-200 bg-primary/5 dark:bg-primary/15 border border-primary/15 dark:border-primary/25 rounded-full px-2 py-0.5"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-primary/70" />
                        {a.name}
                      </span>
                    );
                  })}
                  {addons.length > 3 && (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 px-2 py-0.5">
                      +{addons.length - 3}
                    </span>
                  )}
                </div>
              </div>

              {/* Fake message bar */}
              <div className="mt-3 flex items-center gap-2 rounded-md bg-slate-100 dark:bg-[hsl(220_8%_20%)] px-3 h-9 text-slate-400 dark:text-slate-500 text-xs">
                <span className="flex-1 truncate">Message @{displayName}</span>
                <Gift size={14} />
                <Smile size={14} />
              </div>
            </div>
          </div>

          {/* Estimate + submit */}
          <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card/60 to-background backdrop-blur p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                Estimated
              </span>
              <span className="text-2xl font-bold tracking-tight">
                {appliedDiscount && (
                  <span className="text-base text-muted-foreground line-through font-normal mr-2">
                    ${total.toFixed(2)}
                  </span>
                )}
                ${finalTotal.toFixed(2)}
                <span className="text-xs text-muted-foreground font-normal"> one-time*</span>
              </span>
            </div>
            {appliedDiscount && (
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="text-emerald-500 font-medium">
                  Code {appliedDiscount.code} applied
                </span>
                <span className="text-emerald-500 font-medium">
                  −${discountAmount.toFixed(2)}
                </span>
              </div>
            )}
            {/* Monthly hosting toggle — separate recurring fee, not in one-time total */}
            <button
              type="button"
              onClick={() => setMonthlyHosting((v) => !v)}
              className={`mt-4 w-full text-left rounded-lg border p-3 transition-smooth flex items-start gap-3 ${
                monthlyHosting
                  ? "border-primary bg-primary/10"
                  : "border-border/60 bg-background/40 hover:border-primary/50"
              }`}
            >
              <div
                className={`h-5 w-5 rounded-md border grid place-items-center shrink-0 mt-0.5 ${
                  monthlyHosting ? "bg-primary border-primary" : "border-border"
                }`}
              >
                {monthlyHosting && <Check size={12} className="text-primary-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm font-medium">Managed hosting</span>
                  <span className="text-sm font-semibold">
                    +$9.99<span className="text-xs text-muted-foreground font-normal">/month</span>
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  We host and keep your bot online 24/7. Billed monthly — separate
                  from the one-time build cost.
                </p>
              </div>
            </button>
            {addons.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {addons.map((id) => {
                  const a = currentAddons.find((x) => x.id === id);
                  if (!a) return null;
                  return (
                    <Badge key={id} variant="secondary" className="text-[10px] font-medium">
                      {a.name}
                    </Badge>
                  );
                })}
              </div>
            )}
            {!showPayment && (
              <Button
                variant="hero"
                size="lg"
                className="w-full mt-4"
                onClick={submit}
                disabled={submitting}
              >
                {salesLive ? "Buy my bot" : "Preorder my bot"} <ArrowRight />
              </Button>
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
                <div className="rounded-xl border border-primary/20 bg-card/70 backdrop-blur p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                    <LockIcon size={12} className="text-primary" />
                    Secure payment details
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <Input
                      placeholder="Full name"
                      value={payFullName}
                      onChange={(e) => setPayFullName(e.target.value)}
                    />
                    <Input
                      type="email"
                      placeholder="Email address"
                      value={payEmail}
                      onChange={(e) => setPayEmail(e.target.value)}
                    />
                    <div className="relative">
                      <Input
                        placeholder="Card number"
                        inputMode="numeric"
                        value={payCard}
                        onChange={(e) => setPayCard(e.target.value)}
                        className="pl-9"
                      />
                      <CreditCard
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        placeholder="MM/YY"
                        value={payExp}
                        onChange={(e) => setPayExp(e.target.value)}
                      />
                      <Input
                        placeholder="CVC"
                        value={payCvc}
                        onChange={(e) => setPayCvc(e.target.value)}
                      />
                      <Input
                        placeholder="ZIP"
                        value={payZip}
                        onChange={(e) => setPayZip(e.target.value)}
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    This locks in your spot in the build queue. We'll only finalize the charge once we've confirmed your build scope.
                  </p>
                </div>

                {/* Discount code */}
                <div className="mt-3 rounded-xl border border-primary/20 bg-card/70 backdrop-blur p-4">
                  <div className="flex items-center gap-2 text-xs font-medium text-foreground mb-2">
                    <Tag size={12} className="text-primary" />
                    Have a discount code?
                  </div>
                  {appliedDiscount ? (
                    <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                      <div className="text-xs">
                        <div className="font-mono font-semibold text-foreground">{appliedDiscount.code}</div>
                        <div className="text-emerald-500">
                          {appliedDiscount.kind === "percent"
                            ? `${appliedDiscount.value}% off`
                            : `$${appliedDiscount.value} off`}{" "}
                          (−${discountAmount.toFixed(2)})
                        </div>
                      </div>
                      <Button type="button" size="sm" variant="ghost" onClick={removeDiscount}>
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
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
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={applyDiscount}
                        disabled={applyingDiscount || !discountCodeInput.trim()}
                      >
                        {applyingDiscount ? "…" : "Apply"}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Engine version picker */}
                <div className="mt-3 rounded-xl border border-primary/20 bg-card/70 backdrop-blur p-4">
                  <div className="flex items-center gap-2 text-xs font-medium text-foreground mb-2">
                    <Code2 size={12} className="text-primary" />
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
                          className={`text-left rounded-lg border p-2.5 transition-all ${
                            active
                              ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                              : "border-border hover:border-primary/40 hover:bg-card"
                          }`}
                        >
                          <div className="text-xs font-medium text-foreground flex items-center justify-between">
                            {opt.label}
                            {active && <Check size={12} className="text-primary" />}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">{opt.sub}</div>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2.5 leading-relaxed">
                    You can switch versions later from your bot's dashboard.
                  </p>
                </div>

                {/* Financing — split the total into monthly installments */}
                <div className="mt-3 rounded-xl border border-primary/20 bg-card/70 backdrop-blur p-4">
                  <div className="flex items-center gap-2 text-xs font-medium text-foreground mb-2">
                    <CreditCard size={12} className="text-primary" />
                    How would you like to pay?
                  </div>
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
                          className={`text-left rounded-lg border p-2.5 transition-all ${
                            active
                              ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                              : "border-border hover:border-primary/40 hover:bg-card"
                          }`}
                        >
                          <div className="text-xs font-medium text-foreground flex items-center justify-between">
                            {opt.label}
                            {active && <Check size={12} className="text-primary" />}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">{opt.sub}</div>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2.5 leading-relaxed">
                    {paymentPlan === "full"
                      ? "One charge once we confirm your build scope."
                      : `${paymentPlan} equal monthly payments — no fees, no interest. Build starts after the first payment clears.`}
                  </p>
                </div>
              </div>
            </div>

            {showPayment && (
              <Button
                ref={confirmBtnRef}
                variant="hero"
                size="lg"
                className="w-full mt-4"
                onClick={submit}
                disabled={submitting}
              >
                {salesLive ? "Confirm purchase" : "Confirm preorder"} <ArrowRight />
              </Button>
            )}

            <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed">
              *Final pricing depends on scope. We'll confirm everything before any work begins.
            </p>
          </div>
        </aside>
      </div>

      {/* Cinematic success overlay */}
      {showSuccess && (
        <div
          className={`fixed inset-0 z-[100] overflow-hidden transition-colors duration-500 ${
            showSuccessText ? "bg-background/85 backdrop-blur-md" : "bg-transparent pointer-events-none"
          }`}
        >
          {/* Confetti — only after the plane zooms past */}
          {showSuccessText &&
            Array.from({ length: 24 }).map((_, i) => {
              const left = (i * 4.3) % 100;
              const delay = (i % 8) * 0.12;
              const colors = ["bg-primary", "bg-primary-glow", "bg-accent", "bg-secondary"];
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
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border-2 border-primary/40 animate-ring-expand" />
              <span
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border-2 border-primary/30 animate-ring-expand"
                style={{ animationDelay: "0.3s" }}
              />
            </>
          )}

          {/* Flying paper airplane — launches from the button */}
          {!showSuccessText && planeOrigin && (
            <div
              className="absolute text-primary animate-plane-fly"
              style={{
                left: planeOrigin.x,
                top: planeOrigin.y,
                marginLeft: "-36px",
                marginTop: "-36px",
                filter: "drop-shadow(0 8px 22px hsl(var(--primary) / 0.55))",
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
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-primary shadow-glow mb-6">
                  <Check size={42} className="text-primary-foreground" strokeWidth={3} />
                </div>
                <h3 className="text-3xl md:text-5xl font-bold tracking-tight">
                  It's <span className="text-gradient">sent!</span>
                </h3>
                {user ? (
                  addons.includes("dashboard") || dashboardAlreadyOwned ? (
                    <>
                      <p className="mt-3 text-base md:text-lg text-muted-foreground">
                        We're getting right to work on your build. Manage{" "}
                        <span className="text-foreground font-medium">{displayName}</span>{" "}
                        any time from your{" "}
                        <span className="text-foreground font-medium">Bot Dashboard</span>.
                      </p>
                      <p className="mt-3 text-sm text-muted-foreground">
                        Open the account menu (top-right) → <span className="text-foreground">Dashboard</span>,
                        or we'll redirect you in a moment.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="mt-3 text-base md:text-lg text-muted-foreground">
                        We're getting right to work on your build. Track{" "}
                        <span className="text-foreground font-medium">{displayName}</span>{" "}
                        from <span className="text-foreground font-medium">Settings → Bot Orders</span>.
                      </p>
                      <p className="mt-3 text-sm text-muted-foreground">
                        Tip: add the <span className="text-foreground">Web Dashboard</span> add-on
                        to manage your bot from this site. Otherwise use{" "}
                        <code className="text-foreground bg-muted px-1.5 py-0.5 rounded text-xs">/cmds</code>{" "}
                        in your Discord server.
                      </p>
                    </>
                  )
                ) : (
                  <p className="mt-3 text-base md:text-lg text-muted-foreground">
                    We're getting right to work on your build. Check your inbox — we'll
                    be in touch shortly.
                  </p>
                )}
              </div>
            </div>
          )}
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
};
