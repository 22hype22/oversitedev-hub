import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast as sonnerToast } from "sonner";
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
  { id: "dashboard", name: "Web Dashboard", desc: "Hosted control panel for everything.", icon: Globe, price: 60 },
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
  scratch: [
    { id: "commands", name: "Custom Commands", desc: "Bespoke slash commands and workflows.", icon: Code2, price: 40 },
    { id: "integrations", name: "Third-Party APIs", desc: "Hook into any external service you use.", icon: Zap, price: 50 },
    { id: "analytics", name: "Custom Analytics", desc: "Dashboards tailored to your metrics.", icon: BarChart3, price: 45 },
    { id: "alerts", name: "Priority Alerts", desc: "Webhook, email, or SMS for incidents.", icon: Bell, price: 30 },
    { id: "exports", name: "Data Exports", desc: "Scheduled CSV/JSON exports of your data.", icon: Database, price: 20 },
  ],
};

const getAddonsForBase = (baseId: string): Addon[] => [
  ...(ADDONS_BY_BASE[baseId] ?? []),
  ...SHARED_ADDONS,
];

export const BotBuilder = () => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [base, setBase] = useState<string>("protection");
  const [addons, setAddons] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [showAllAddons, setShowAllAddons] = useState(false);

  const iconInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

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
    setShowAllAddons(false);
  };

  const total = useMemo(() => {
    const baseCost = BASES.find((b) => b.id === base)?.price ?? 0;
    const addonCost = addons.reduce(
      (sum, id) => sum + (currentAddons.find((a) => a.id === id)?.price ?? 0),
      0
    );
    return baseCost + addonCost;
  }, [base, addons, currentAddons]);

  const submit = () => {
    if (!name.trim()) {
      sonnerToast.error("Give your bot a name", {
        description: "Even a working title helps us get started.",
      });
      return;
    }
    const baseObj = BASES.find((b) => b.id === base);
    const addonObjs = addons
      .map((id) => currentAddons.find((a) => a.id === id)?.name)
      .filter(Boolean);
    sonnerToast.success("Build sent! 🎉", {
      description: `${name} • ${baseObj?.name}${addonObjs.length ? ` + ${addonObjs.length} add-on${addonObjs.length > 1 ? "s" : ""}` : ""} — we'll be in touch.`,
    });
    setTimeout(() => {
      window.location.href = "/#contact";
    }, 1200);
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
              Tailored options for your <span className="text-primary font-medium">{selectedBase?.name}</span> base.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(showAllAddons ? currentAddons : currentAddons.slice(0, 10)).map((a) => {
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
                    <div className="mt-2 text-xs text-foreground/80">+${a.price.toFixed(2)}</div>
                  </button>
                );
              })}
            </div>
            {currentAddons.length > 10 && (
              <div className="mt-4 flex justify-center">
                <Button
                  type="button"
                  variant="outlineGlow"
                  size="sm"
                  onClick={() => setShowAllAddons((v) => !v)}
                >
                  {showAllAddons
                    ? "Show less"
                    : `View more (${currentAddons.length - 10})`}
                </Button>
              </div>
            )}
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
        <aside className="lg:sticky lg:top-24 h-fit space-y-4">
          {/* Profile card — white & blue theme */}
          <div className="rounded-2xl overflow-hidden border border-primary/20 bg-white shadow-elegant">
            {/* Banner */}
            <div className="relative h-24 bg-gradient-to-br from-primary/60 via-primary/30 to-primary/10">
              {banner && (
                <img src={banner} alt="" className="absolute inset-0 w-full h-full object-cover" />
              )}
              <button
                type="button"
                className="absolute top-2 right-2 h-7 w-7 rounded-full bg-white/70 backdrop-blur grid place-items-center text-slate-700"
                aria-label="More"
              >
                <MoreHorizontal size={14} />
              </button>
            </div>

            {/* Avatar */}
            <div className="px-4 pb-4 -mt-10">
              <div className="relative inline-block">
                <div className="h-20 w-20 rounded-full border-[6px] border-white bg-slate-100 overflow-hidden grid place-items-center">
                  {icon ? (
                    <img src={icon} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <SelectedIcon size={28} className="text-primary" />
                  )}
                </div>
                <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full bg-[hsl(139_47%_44%)] border-[3px] border-white" />
              </div>

              {/* Name + tag */}
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <h4 className="text-slate-900 font-bold text-lg leading-tight truncate">
                  {displayName}
                </h4>
                <span className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-primary text-primary-foreground">
                  APP
                </span>
              </div>
              <div className="text-slate-500 text-xs mt-0.5">{displayTag}</div>

              {/* Add App button */}
              <button
                type="button"
                className="mt-3 w-full h-9 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium transition-smooth"
              >
                + Add App
              </button>

              {/* Description */}
              {description && (
                <div className="mt-3 rounded-md bg-primary/5 border border-primary/10 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-widest text-primary/80 font-semibold mb-1">
                    About
                  </div>
                  <p className="text-slate-700 text-xs leading-relaxed whitespace-pre-wrap">
                    {description}
                  </p>
                </div>
              )}

              {/* Roles */}
              <div className="mt-3">
                <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-1.5">
                  Roles
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-700 bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {selectedBase?.name}
                  </span>
                  {addons.slice(0, 3).map((id) => {
                    const a = currentAddons.find((x) => x.id === id);
                    if (!a) return null;
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 text-[11px] text-slate-700 bg-primary/5 border border-primary/15 rounded-full px-2 py-0.5"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-primary/70" />
                        {a.name}
                      </span>
                    );
                  })}
                  {addons.length > 3 && (
                    <span className="text-[11px] text-slate-500 px-2 py-0.5">
                      +{addons.length - 3}
                    </span>
                  )}
                </div>
              </div>

              {/* Fake message bar */}
              <div className="mt-3 flex items-center gap-2 rounded-md bg-slate-100 px-3 h-9 text-slate-400 text-xs">
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
            <Button variant="hero" size="lg" className="w-full mt-4" onClick={submit}>
              Send my build <ArrowRight />
            </Button>
            <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed">
              *Final pricing depends on scope. We'll confirm everything before any work begins.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
};
