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
} from "lucide-react";

type Base = {
  id: string;
  name: string;
  tagline: string;
  icon: typeof Shield;
  price: number;
  accent: string;
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
    price: 49,
    accent: "hsl(70_30%_70%)",
  },
  {
    id: "support",
    name: "Support",
    tagline: "Tickets, appeals, reports, and welcomes.",
    icon: LifeBuoy,
    price: 49,
    accent: "hsl(280_30%_70%)",
  },
  {
    id: "utilities",
    name: "Utilities",
    tagline: "Announcements, roles, Roblox, music, more.",
    icon: Wrench,
    price: 49,
    accent: "hsl(var(--primary))",
  },
  {
    id: "scratch",
    name: "From Scratch",
    tagline: "Fully bespoke — we design everything for you.",
    icon: Sparkles,
    price: 199,
    accent: "hsl(var(--primary))",
  },
];

const ADDONS: Addon[] = [
  { id: "branding", name: "Custom Branding", desc: "Match your server's identity end-to-end.", icon: Palette, price: 25 },
  { id: "analytics", name: "Advanced Analytics", desc: "Deep insights into actions and activity.", icon: BarChart3, price: 35 },
  { id: "dashboard", name: "Web Dashboard", desc: "Hosted control panel for everything.", icon: Globe, price: 60 },
  { id: "exports", name: "Data Exports", desc: "Scheduled CSV/JSON exports of your data.", icon: Database, price: 20 },
  { id: "alerts", name: "Priority Alerts", desc: "Webhook, email, or SMS for incidents.", icon: Bell, price: 30 },
  { id: "commands", name: "Custom Commands", desc: "Bespoke slash commands and workflows.", icon: Sparkles, price: 40 },
];

export const BotBuilder = () => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [bio, setBio] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [base, setBase] = useState<string>("protection");
  const [addons, setAddons] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const iconInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

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

  const total = useMemo(() => {
    const baseCost = BASES.find((b) => b.id === base)?.price ?? 0;
    const addonCost = addons.reduce((sum, id) => sum + (ADDONS.find((a) => a.id === id)?.price ?? 0), 0);
    return baseCost + addonCost;
  }, [base, addons]);

  const submit = () => {
    if (!name.trim()) {
      sonnerToast.error("Give your bot a name", {
        description: "Even a working title helps us get started.",
      });
      return;
    }
    const baseObj = BASES.find((b) => b.id === base);
    const addonObjs = addons.map((id) => ADDONS.find((a) => a.id === id)?.name).filter(Boolean);
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
                  Short description
                </Label>
                <Input
                  id="bot-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="One line that describes what your bot does."
                  className="h-11"
                />
              </div>
              <div>
                <Label htmlFor="bot-bio" className="text-xs text-muted-foreground mb-2 block">
                  Bio
                </Label>
                <Textarea
                  id="bot-bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="A longer about section — personality, purpose, vibe."
                  rows={3}
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
                    onClick={() => setBase(b.id)}
                    className={`group text-left rounded-xl border p-4 transition-smooth ${
                      active
                        ? "border-primary bg-primary/10 shadow-glow"
                        : "border-border/60 bg-background/40 hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Icon size={18} style={{ color: b.accent }} />
                        <span className="font-semibold">{b.name}</span>
                      </div>
                      {active && <Check size={16} className="text-primary" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                      {b.tagline}
                    </p>
                    <div className="mt-3 text-xs text-foreground/80">
                      from <span className="font-semibold">${b.price}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 3 — Add-ons */}
          <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-7 w-7 rounded-full bg-primary/15 border border-primary/30 grid place-items-center text-xs font-bold text-primary">
                3
              </div>
              <h3 className="text-lg font-semibold">Stack on add-ons</h3>
              <span className="ml-auto text-xs text-muted-foreground">Tap to toggle</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ADDONS.map((a) => {
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
                        <Icon size={14} className="text-primary" />
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
                    <div className="mt-2 text-xs text-foreground/80">+${a.price}</div>
                  </button>
                );
              })}
            </div>
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

        {/* Right: Discord-style live preview */}
        <aside className="lg:sticky lg:top-24 h-fit space-y-4">
          {/* Discord profile card */}
          <div className="rounded-2xl overflow-hidden border border-border/60 bg-[hsl(228_7%_14%)] shadow-elegant">
            {/* Banner */}
            <div className="relative h-24 bg-gradient-to-br from-primary/40 via-primary/20 to-background">
              {banner && (
                <img src={banner} alt="" className="absolute inset-0 w-full h-full object-cover" />
              )}
              <button
                type="button"
                className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/40 backdrop-blur grid place-items-center text-white/80"
                aria-label="More"
              >
                <MoreHorizontal size={14} />
              </button>
            </div>

            {/* Avatar */}
            <div className="px-4 pb-4 -mt-10">
              <div className="relative inline-block">
                <div className="h-20 w-20 rounded-full border-[6px] border-[hsl(228_7%_14%)] bg-[hsl(228_7%_20%)] overflow-hidden grid place-items-center">
                  {icon ? (
                    <img src={icon} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <SelectedIcon size={28} className="text-primary" />
                  )}
                </div>
                <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full bg-[hsl(139_47%_44%)] border-[3px] border-[hsl(228_7%_14%)]" />
              </div>

              {/* Name + tag */}
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <h4 className="text-white font-bold text-lg leading-tight truncate">
                  {displayName}
                </h4>
                <span className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-primary text-primary-foreground">
                  APP
                </span>
              </div>
              <div className="text-white/60 text-xs mt-0.5">{displayTag}</div>

              {/* Add App button */}
              <button
                type="button"
                className="mt-3 w-full h-9 rounded-md bg-white/95 hover:bg-white text-[hsl(228_7%_14%)] text-sm font-medium transition-smooth"
              >
                + Add App
              </button>

              {/* Description */}
              {description && (
                <p className="mt-3 text-white/80 text-xs leading-relaxed">{description}</p>
              )}

              {/* Bio block */}
              {bio && (
                <div className="mt-3 rounded-md bg-black/30 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-widest text-white/50 font-semibold mb-1">
                    About Me
                  </div>
                  <p className="text-white/85 text-xs leading-relaxed whitespace-pre-wrap">
                    {bio}
                  </p>
                </div>
              )}

              {/* Roles */}
              <div className="mt-3">
                <div className="text-[10px] uppercase tracking-widest text-white/50 font-semibold mb-1.5">
                  Roles
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1 text-[11px] text-white/90 bg-white/5 border border-white/10 rounded-full px-2 py-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {selectedBase?.name}
                  </span>
                  {addons.slice(0, 3).map((id) => {
                    const a = ADDONS.find((x) => x.id === id)!;
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 text-[11px] text-white/90 bg-white/5 border border-white/10 rounded-full px-2 py-0.5"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-[hsl(280_60%_70%)]" />
                        {a.name}
                      </span>
                    );
                  })}
                  {addons.length > 3 && (
                    <span className="text-[11px] text-white/60 px-2 py-0.5">
                      +{addons.length - 3}
                    </span>
                  )}
                </div>
              </div>

              {/* Fake message bar */}
              <div className="mt-3 flex items-center gap-2 rounded-md bg-black/40 px-3 h-9 text-white/40 text-xs">
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
                ${total}
                <span className="text-xs text-muted-foreground font-normal">/mo*</span>
              </span>
            </div>
            {addons.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {addons.map((id) => {
                  const a = ADDONS.find((x) => x.id === id)!;
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
