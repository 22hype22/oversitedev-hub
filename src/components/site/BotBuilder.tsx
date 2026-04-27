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
  { id: "multi-server", name: "Multi-Server License", desc: "Use your bot across multiple Discord servers.", icon: Globe2, price: 9.99 },
];

const ADDONS_BY_BASE: Record<string, Addon[]> = {
  protection: [],
  support: [],
  utilities: [],
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
  const { user } = useAuth();
  const { hasDashboardAccess: dashboardAlreadyOwned } = useOwnedBots();
  const [base, setBase] = useState<string>("protection");
  // Single-bot identity (for non-pack bases)
  const [identity, setIdentity] = useState<Identity>({ ...EMPTY_IDENTITY });
  // Pack identities (for All-in-One Pack)
  const [packIdentities, setPackIdentities] = useState<Record<string, Identity>>({
    protection: { ...EMPTY_IDENTITY },
    support: { ...EMPTY_IDENTITY },
    utilities: { ...EMPTY_IDENTITY },
  });
  const [activePackTab, setActivePackTab] = useState<string>("protection");
  const [tabDirection, setTabDirection] = useState<1 | -1>(1);
  const [addons, setAddons] = useState<string[]>([]);
  const [monthlyHosting, setMonthlyHosting] = useState(true);
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
  const [showSuccess, setShowSuccess] = useState(false);
  const [showSuccessText, setShowSuccessText] = useState(false);
  const [planeOrigin, setPlaneOrigin] = useState<{ x: number; y: number } | null>(null);

  const iconInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  const currentAddons = useMemo(() => getAddonsForBase(base), [base]);

  // Active identity: for the All-in-One Pack, this is the currently-shown tab's identity.
  // For all other bases, it's the single shared identity.
  const isPack = base === "scratch";
  const activeIdentity: Identity = isPack ? packIdentities[activePackTab] : identity;
  const { name, description, icon, banner } = activeIdentity;

  const updateActiveIdentity = (patch: Partial<Identity>) => {
    if (isPack) {
      setPackIdentities((prev) => ({
        ...prev,
        [activePackTab]: { ...prev[activePackTab], ...patch },
      }));
    } else {
      setIdentity((prev) => ({ ...prev, ...patch }));
    }
  };
  const setName = (v: string) => updateActiveIdentity({ name: v });
  const setDescription = (v: string) => updateActiveIdentity({ description: v });
  const setIcon = (v: string) => updateActiveIdentity({ icon: v });
  const setBanner = (v: string) => updateActiveIdentity({ banner: v });

  // When the user finishes a field on a pack tab and there's a next tab,
  // auto-advance with a slide animation.
  const advanceToNextTab = () => {
    if (!isPack) return;
    const current = packIdentities[activePackTab];
    if (!current.name.trim() || !current.description.trim()) return;
    const idx = PACK_TABS.findIndex((t) => t.id === activePackTab);
    if (idx >= 0 && idx < PACK_TABS.length - 1) {
      setTabDirection(1);
      setActivePackTab(PACK_TABS[idx + 1].id);
    }
  };
  const handleDescriptionBlur = () => advanceToNextTab();

  const goToTab = (id: string) => {
    const fromIdx = PACK_TABS.findIndex((t) => t.id === activePackTab);
    const toIdx = PACK_TABS.findIndex((t) => t.id === id);
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

  // Reset addons when base changes (since addon lists are per-base)
  const selectBase = (id: string) => {
    setBase(id);
    setAddons([]);
    setShowAllAddons({});
  };

  const total = useMemo(() => {
    const baseCost = BASES.find((b) => b.id === base)?.price ?? 0;
    const addonCost = addons.reduce((sum, id) => {
      // Dashboard add-on is a one-time, account-wide unlock.
      // If the user already owns it on any prior bot, it costs $0 here.
      if (id === "dashboard" && dashboardAlreadyOwned) return sum;
      return sum + (currentAddons.find((a) => a.id === id)?.price ?? 0);
    }, 0);
    return baseCost + addonCost;
  }, [base, addons, currentAddons, dashboardAlreadyOwned]);

  // For the All-in-One Pack we use the Protection identity as the primary record
  // and append the other two identities as a JSON block in the notes for the build team.
  const buildSubmissionPayload = () => {
    if (!isPack) {
      return {
        primary: identity,
        notesField: notes.trim() || null,
      };
    }
    const primary = packIdentities.protection;
    const extras = {
      support: packIdentities.support,
      utilities: packIdentities.utilities,
    };
    const extraNotes = `\n\n--- All-in-One Pack additional bots ---\n${JSON.stringify(extras, null, 2)}`;
    return {
      primary,
      notesField: ((notes.trim() ? notes.trim() : "") + extraNotes).trim(),
    };
  };

  const persistOrder = async () => {
    if (!user) return true; // anonymous: skip persistence, keep legacy flow
    const { primary, notesField } = buildSubmissionPayload();
    const { error } = await (supabase as any).from("bot_orders").insert({
      user_id: user.id,
      bot_name: primary.name.trim(),
      bot_description: primary.description.trim() || null,
      icon_url: primary.icon,
      banner_url: primary.banner,
      base,
      addons,
      monthly_hosting: monthlyHosting,
      notes: notesField,
      total_amount: total,
      currency: "usd",
      status: "submitted",
      submitted_at: new Date().toISOString(),
    });
    if (error) {
      sonnerToast.error("Couldn't save your order", { description: error.message });
      return false;
    }
    return true;
  };

  const submit = async () => {
    if (isPack) {
      const missing = PACK_TABS.find((t) => !packIdentities[t.id].name.trim());
      if (missing) {
        sonnerToast.error(`Name your ${missing.label}`, {
          description: "Each bot in the pack needs at least a name.",
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

    // Save the order to the database so Railway/Claude can later pick it up.
    const ok = await persistOrder();
    if (!ok) {
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

  const selectedBase = BASES.find((b) => b.id === base);
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
          {/* Step 1 — Base */}
          <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-7 w-7 rounded-full bg-primary/15 border border-primary/30 grid place-items-center text-xs font-bold text-primary">
                1
              </div>
              <h3 className="text-lg font-semibold">Pick a starting point</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {BASES.map((b) => {
                const Icon = b.icon;
                const active = base === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => selectBase(b.id)}
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
                    <div className="mt-3 text-xs text-foreground/80">
                      one-time <span className="font-semibold">${b.price}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2 — Identity */}
          <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-7 w-7 rounded-full bg-primary/15 border border-primary/30 grid place-items-center text-xs font-bold text-primary">
                2
              </div>
              <h3 className="text-lg font-semibold">
                {isPack ? "Design your three bots" : "Bot identity"}
              </h3>
            </div>

            {isPack && (
              <>
                <p className="text-xs text-muted-foreground mb-4">
                  The All-in-One Pack ships as three focused bots. Give each one its own name,
                  icon, banner, and vibe — finish the description and we'll slide you to the next.
                </p>
                <div className="relative grid grid-cols-3 gap-2 mb-5 rounded-xl border border-border/60 bg-background/40 p-1">
                  {PACK_TABS.map((t) => {
                    const TIcon = t.icon;
                    const active = activePackTab === t.id;
                    const filled = !!packIdentities[t.id].name.trim();
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
              key={isPack ? activePackTab : "single"}
              className={`${
                isPack
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

            {isPack && (() => {
              const idx = PACK_TABS.findIndex((t) => t.id === activePackTab);
              const prev = idx > 0 ? PACK_TABS[idx - 1] : null;
              const next = idx < PACK_TABS.length - 1 ? PACK_TABS[idx + 1] : null;
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
                    Bot {idx + 1} of {PACK_TABS.length}
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
            <div className="flex items-center gap-3 mb-2">
              <div className="h-7 w-7 rounded-full bg-primary/15 border border-primary/30 grid place-items-center text-xs font-bold text-primary">
                3
              </div>
              <h3 className="text-lg font-semibold">Stack on add-ons</h3>
              <span className="ml-auto text-xs text-muted-foreground">Tap to toggle</span>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              {base === "scratch"
                ? "All three categories included. Stack on extras from Protection, Support, or Utilities."
                : <>Tailored options for your <span className="text-primary font-medium">{selectedBase?.name}</span> base.</>}
            </p>
            {(() => {
              const renderAddonCard = (a: Addon) => {
                const Icon = a.icon;
                const active = addons.includes(a.id);
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
                      <div
                        className={`h-5 w-5 rounded-md border grid place-items-center transition-smooth ${
                          active ? "bg-primary border-primary" : "border-border"
                        }`}
                      >
                        {active && <Check size={12} className="text-primary-foreground" />}
                      </div>
                    </div>
                    <div className="mt-3 font-medium text-sm">{a.name}</div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {a.desc}
                    </p>
                    <div className="mt-2 text-xs text-foreground/80 flex items-center gap-2 flex-wrap">
                      {a.id === "dashboard" && dashboardAlreadyOwned ? (
                        <>
                          <span className="text-primary font-medium">Included — already unlocked</span>
                          <span className="line-through text-muted-foreground/70">${a.price.toFixed(2)}</span>
                          <span className="px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-semibold">ONE-TIME</span>
                        </>
                      ) : (
                        <>
                          <span>+${a.price.toFixed(2)}</span>
                          {a.oldPrice && (
                            <>
                              <span className="line-through text-muted-foreground/70">${a.oldPrice.toFixed(2)}</span>
                              <span className="px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-semibold">SALE</span>
                            </>
                          )}
                          {a.id === "dashboard" && (
                            <span className="px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-semibold">ONE-TIME · ALL BOTS</span>
                          )}
                        </>
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
                        <Button
                          type="button"
                          variant="outlineGlow"
                          size="sm"
                          onClick={() =>
                            setShowAllAddons((prev) => ({ ...prev, [key]: !prev[key] }))
                          }
                        >
                          {expanded ? "Show less" : `View more (${list.length - 10})`}
                        </Button>
                      </div>
                    )}
                  </>
                );
              };

              if (base === "scratch") {
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

              const baseAddons = ADDONS_BY_BASE[base] ?? [];
              return (
                <div className="space-y-8">
                  <div>
                    {renderList("default", baseAddons)}
                  </div>
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
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-700 dark:text-slate-200 bg-primary/10 dark:bg-primary/20 border border-primary/20 dark:border-primary/30 rounded-full px-2 py-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {selectedBase?.name}
                  </span>
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
                ${total.toFixed(2)}
                <span className="text-xs text-muted-foreground font-normal"> one-time*</span>
              </span>
            </div>
            {monthlyHosting && (
              <div className="mt-1 flex items-center justify-between">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  Plus
                </span>
                <span className="text-base font-semibold tracking-tight text-primary">
                  $20.00
                  <span className="text-xs text-muted-foreground font-normal"> /month</span>
                </span>
              </div>
            )}
            <div className="mt-3 rounded-lg border border-primary/20 bg-card/50 p-3">
              <div className="flex items-start gap-2">
                <div className="h-4 w-4 mt-0.5 rounded bg-primary/20 border border-primary grid place-items-center shrink-0">
                  <Check className="h-3 w-3 text-primary" />
                </div>
                <div className="flex-1 text-xs">
                  <div className="font-medium text-foreground">
                    Hosting & maintenance — $20/mo
                  </div>
                  <div className="text-muted-foreground mt-0.5">
                    Always-on hosting, updates, and priority fixes. Included by
                    default — cancel anytime.
                  </div>
                </div>
              </div>
              <label className="mt-2.5 flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors">
                <input
                  type="checkbox"
                  checked={!monthlyHosting}
                  onChange={(e) => setMonthlyHosting(!e.target.checked)}
                  className="h-3.5 w-3.5 accent-primary cursor-pointer"
                />
                <span>I'll host and maintain the bot myself (skip the $20/mo)</span>
              </label>
            </div>
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
                Preorder my bot <ArrowRight />
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
                Confirm preorder <ArrowRight />
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
    </section>
  );
};
