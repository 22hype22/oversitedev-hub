import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast as sonnerToast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
} from "lucide-react";

type Base = {
  id: string;
  name: string;
  tagline: string;
  icon: typeof Shield;
  price: number;
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
    name: "Protection",
    tagline: "Automod, anti-raid, and a full mod toolkit.",
    icon: Shield,
    price: 99,
  },
  {
    id: "support",
    name: "Support",
    tagline: "Tickets, appeals, reports, and welcomes.",
    icon: LifeBuoy,
    price: 99,
  },
  {
    id: "utilities",
    name: "Utilities",
    tagline: "Announcements, roles, Roblox, music, more.",
    icon: Wrench,
    price: 99,
  },
  {
    id: "scratch",
    name: "From Scratch",
    tagline: "Fully bespoke — we design everything for you.",
    icon: Sparkles,
    price: 199,
  },
];

const SHARED_ADDONS: Addon[] = [
  { id: "branding", name: "Custom Branding", desc: "Match your server's identity end-to-end.", icon: Palette, price: 25 },
  { id: "dashboard", name: "Web Dashboard", desc: "Hosted control panel for everything.", icon: Globe, price: 149.99, oldPrice: 300 },
  { id: "multi-server", name: "Multi-Server License", desc: "Use your bot across multiple Discord servers.", icon: Globe2, price: 9.99 },
];

const ADDONS_BY_BASE: Record<string, Addon[]> = {
  protection: [
    { id: "anti-spam", name: "Anti-Spam", desc: "Auto-detect and stop spam floods.", icon: Shield, price: 1.99 },
    { id: "anti-raid", name: "Anti-Raid Protection", desc: "Lockdown the server during raid attempts.", icon: ShieldCheck, price: 2.99 },
    { id: "link-filter", name: "Link Filter", desc: "Block unwanted or malicious links.", icon: Link2, price: 1.99 },
    { id: "profanity-filter", name: "Profanity Filter", desc: "Auto-mute or delete inappropriate language.", icon: Ban, price: 1.99 },
    { id: "alt-detection", name: "Alt Account Detection", desc: "Catch alt and throwaway accounts.", icon: UserX, price: 4.99 },
    { id: "mention-guard", name: "Mention Guard", desc: "Stop mass mention abuse.", icon: AtSign, price: 1.99 },
    { id: "nsfw-filter", name: "NSFW Filter", desc: "Block NSFW media in safe channels.", icon: EyeOff, price: 3.99 },
    { id: "verification-gate", name: "Verification Gate", desc: "Captcha & age-gate before joining.", icon: UserCheck, price: 2.99 },
    { id: "slowmode", name: "Slowmode Manager", desc: "Auto-adjust slowmode based on activity.", icon: Timer, price: 1.99 },
    { id: "audit-logger", name: "Audit Logger", desc: "Full event logging for moderation.", icon: FileText, price: 3.99 },
    { id: "vpn-blocker", name: "VPN / Proxy Blocker", desc: "Block users joining via VPN or proxy.", icon: Globe2, price: 5.99 },
    { id: "auto-mute", name: "Auto-Mute", desc: "Mute offenders automatically.", icon: VolumeX, price: 2.99 },
    { id: "auto-kick", name: "Auto-Kick", desc: "Kick rule-breakers without staff input.", icon: UserX, price: 2.99 },
    { id: "auto-ban", name: "Auto-Ban", desc: "Ban repeat or severe offenders instantly.", icon: Ban, price: 3.99 },
    { id: "invite-control", name: "Invite Control", desc: "Block external server invites.", icon: MailWarning, price: 1.99 },
    { id: "caps-filter", name: "Caps Lock Filter", desc: "Reduce shouty messages.", icon: TextCursorInput, price: 0.99 },
    { id: "scam-detector", name: "Scam Detector", desc: "Detect scam links and phishing attempts.", icon: AlertTriangle, price: 5.99 },
    { id: "new-account-guard", name: "New Account Guard", desc: "Restrict brand-new Discord accounts.", icon: UserPlus, price: 3.99 },
    { id: "emoji-spam", name: "Emoji Spam Filter", desc: "Limit excessive emoji floods.", icon: SmileIcon, price: 0.99 },
    { id: "attachment-filter", name: "Attachment Filter", desc: "Block dangerous or unwanted file types.", icon: Paperclip, price: 2.99 },
  ],
  support: [
    { id: "ticket-system", name: "Ticket System", desc: "Open, manage, and close support tickets.", icon: Ticket, price: 4.99 },
    { id: "welcome", name: "Welcome Message", desc: "Greet every new member.", icon: Hand, price: 1.99 },
    { id: "goodbye", name: "Goodbye Message", desc: "Send a farewell when members leave.", icon: Hand, price: 0.99 },
    { id: "faq-bot", name: "FAQ Bot", desc: "Answer common questions automatically.", icon: HelpCircle, price: 3.99 },
    { id: "knowledge-base", name: "Knowledge Base", desc: "Searchable in-server help docs.", icon: BookOpen, price: 4.99 },
    { id: "reaction-roles", name: "Reaction Roles", desc: "Self-assignable roles via reactions.", icon: ReactIcon, price: 2.99 },
    { id: "mod-mail", name: "Mod Mail", desc: "DM-based private staff support.", icon: Mail, price: 4.99 },
    { id: "staff-status", name: "Staff On-Duty Status", desc: "Show which staff are available.", icon: ShieldCheck, price: 2.99 },
    { id: "report-system", name: "Report System", desc: "Let members report rule-breakers.", icon: Flag, price: 3.99 },
    { id: "auto-response", name: "Auto-Response", desc: "Trigger replies to keywords.", icon: Reply, price: 2.99 },
    { id: "suggestion-box", name: "Suggestion Box", desc: "Collect and vote on community ideas.", icon: Lightbulb, price: 1.99 },
    { id: "rule-reminder", name: "Rule Reminder", desc: "Periodic gentle nudges about rules.", icon: ListChecks, price: 0.99 },
    { id: "onboarding", name: "Onboarding Guide", desc: "Walk new members through your server.", icon: Compass, price: 3.99 },
    { id: "live-chat-escalation", name: "Live Chat Escalation", desc: "Escalate tickets to live agents.", icon: Headphones, price: 5.99 },
    { id: "feedback-collector", name: "Feedback Collector", desc: "Gather post-ticket feedback.", icon: Star, price: 2.99 },
    { id: "inactivity-notifier", name: "Inactivity Notifier", desc: "Ping inactive members or staff.", icon: Moon, price: 3.99 },
    { id: "poll-creator", name: "Poll Creator", desc: "Run quick polls in any channel.", icon: BarChart2, price: 1.99 },
    { id: "application-system", name: "Application System", desc: "Staff or member application forms.", icon: ClipboardList, price: 4.99 },
    { id: "member-counter", name: "Member Counter", desc: "Live member count channel.", icon: Hash, price: 0.99 },
    { id: "support-hours", name: "Support Hours Announcer", desc: "Auto-post when staff are online.", icon: Clock, price: 1.99 },
  ],
  utilities: [
    { id: "announcements", name: "Announcement System", desc: "Post styled announcements anywhere.", icon: Megaphone, price: 2.99 },
    { id: "role-manager", name: "Role Manager", desc: "Bulk add, remove, and organize roles.", icon: UserCog, price: 3.99 },
    { id: "scheduled-messages", name: "Scheduled Messages", desc: "Plan posts hours, days, or weeks ahead.", icon: Calendar, price: 2.99 },
    { id: "stats-dashboard", name: "Server Stats Dashboard", desc: "Live server insights and counters.", icon: BarChart3, price: 4.99 },
    { id: "custom-commands", name: "Custom Commands", desc: "Create your own slash commands.", icon: Code2, price: 3.99 },
    { id: "music-player", name: "Music Player", desc: "Stream music with full queue controls.", icon: Music, price: 5.99 },
    { id: "giveaway-manager", name: "Giveaway Manager", desc: "Run timed giveaways with winners.", icon: Gift, price: 3.99 },
    { id: "birthday-tracker", name: "Birthday Tracker", desc: "Celebrate member birthdays.", icon: Cake, price: 1.99 },
    { id: "reminder-system", name: "Reminder System", desc: "Personal and channel reminders.", icon: AlarmClock, price: 1.99 },
    { id: "starboard", name: "Starboard", desc: "Highlight popular messages.", icon: Star, price: 1.99 },
    { id: "message-purge", name: "Message Purge", desc: "Bulk delete messages with filters.", icon: Trash2, price: 2.99 },
    { id: "nickname-manager", name: "Nickname Manager", desc: "Enforce or randomize nicknames.", icon: UserCog, price: 1.99 },
    { id: "channel-locker", name: "Channel Locker", desc: "Lock channels on a schedule or trigger.", icon: Lock, price: 2.99 },
    { id: "temp-channels", name: "Temp Channels", desc: "Self-destructing voice/text channels.", icon: Plus, price: 3.99 },
    { id: "afk-status", name: "AFK Status", desc: "Auto-mark members as AFK.", icon: Moon, price: 0.99 },
    { id: "logging-system", name: "Logging System", desc: "Track edits, deletes, joins, and more.", icon: FileText, price: 3.99 },
    { id: "embed-builder", name: "Embed Builder", desc: "Design rich embeds in-server.", icon: Settings2, price: 4.99 },
    { id: "tag-system", name: "Tag / Snippet System", desc: "Save and recall reusable text snippets.", icon: Tag, price: 2.99 },
    { id: "translation-bot", name: "Translation Bot", desc: "Auto-translate messages on demand.", icon: Languages, price: 5.99 },
    { id: "server-backup", name: "Server Backup", desc: "Snapshot and restore server config.", icon: Save, price: 6.99 },
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

const SCRATCH_CATEGORIES: { id: string; label: string; icon: typeof Shield; addons: Addon[] }[] = [
  { id: "protection", label: "Protection options", icon: Shield, addons: ADDONS_BY_BASE.protection },
  { id: "support", label: "Support options", icon: LifeBuoy, addons: ADDONS_BY_BASE.support },
  { id: "utilities", label: "Utilities options", icon: Wrench, addons: ADDONS_BY_BASE.utilities },
];

export const BotBuilder = () => {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [base, setBase] = useState<string>("protection");
  const [addons, setAddons] = useState<string[]>([]);
  const [monthlyHosting, setMonthlyHosting] = useState(false);
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
    const addonCost = addons.reduce(
      (sum, id) => sum + (currentAddons.find((a) => a.id === id)?.price ?? 0),
      0
    );
    return baseCost + addonCost;
  }, [base, addons, currentAddons]);

  const persistOrder = async () => {
    if (!user) return true; // anonymous: skip persistence, keep legacy flow
    const { error } = await (supabase as any).from("bot_orders").insert({
      user_id: user.id,
      bot_name: name.trim(),
      bot_description: description.trim() || null,
      icon_url: icon,
      banner_url: banner,
      base,
      addons,
      monthly_hosting: monthlyHosting,
      notes: notes.trim() || null,
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
    if (!name.trim()) {
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
      const hasDashboardAddon = addons.includes("dashboard");
      window.location.href = user
        ? hasDashboardAddon
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
          {/* Step 1 — Identity */}
          <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-7 w-7 rounded-full bg-primary/15 border border-primary/30 grid place-items-center text-xs font-bold text-primary">
                1
              </div>
              <h3 className="text-lg font-semibold">Bot identity</h3>
            </div>

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
                  placeholder="e.g. Sentinel, Helper, NovaBot..."
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
                  placeholder="Tell us about your bot — what it does, its personality, the vibe you're going for, and anything that makes it uniquely yours."
                  rows={5}
                />
              </div>
            </div>
          </div>

          {/* Step 2 — Base */}
          <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-7 w-7 rounded-full bg-primary/15 border border-primary/30 grid place-items-center text-xs font-bold text-primary">
                2
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
                    <div className="mt-3 text-xs text-foreground/80">
                      one-time <span className="font-semibold">${b.price}</span>
                    </div>
                  </button>
                );
              })}
            </div>
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
                ? "Pick from any category — Protection, Support, and Utilities."
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
                    <div className="mt-2 text-xs text-foreground/80 flex items-center gap-2">
                      <span>+${a.price.toFixed(2)}</span>
                      {a.oldPrice && (
                        <>
                          <span className="line-through text-muted-foreground/70">${a.oldPrice.toFixed(2)}</span>
                          <span className="px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-semibold">SALE</span>
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
            <label className="mt-3 flex items-start gap-2 rounded-lg border border-primary/20 bg-card/50 p-3 cursor-pointer hover:bg-card/70 transition-colors">
              <input
                type="checkbox"
                checked={monthlyHosting}
                onChange={(e) => setMonthlyHosting(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-primary cursor-pointer"
              />
              <div className="flex-1 text-xs">
                <div className="font-medium text-foreground">Add hosting & maintenance — $20/mo</div>
                <div className="text-muted-foreground mt-0.5">
                  Always-on hosting, updates, and priority fixes. Cancel anytime.
                </div>
              </div>
            </label>
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
                Submit My Details <ArrowRight />
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
                    You won't be charged until we confirm your build scope.
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
                Confirm & Submit <ArrowRight />
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
              <div className="relative text-center px-6 animate-burst-in">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-primary shadow-glow mb-6">
                  <Check size={42} className="text-primary-foreground" strokeWidth={3} />
                </div>
                <h3 className="text-3xl md:text-5xl font-bold tracking-tight">
                  It's <span className="text-gradient">sent!</span>
                </h3>
                <p className="mt-3 text-base md:text-lg text-muted-foreground max-w-md mx-auto">
                  We're getting right to work on your build. Check your inbox — we'll
                  be in touch shortly.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
