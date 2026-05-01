import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CheckoutDialog, type CheckoutItem } from "@/components/CheckoutDialog";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { Check, Shield, Headphones, Wrench, Sparkles, Plus, Minus } from "lucide-react";
import { toast } from "sonner";

// ── Base bots ──
const BASES = [
  {
    id: "protection",
    name: "Oversite Protection",
    price: 99,
    description: "Automod, anti-raid, and a full mod toolkit.",
    icon: Shield,
    color: "from-red-500/20 to-orange-500/20",
    border: "border-red-500/30",
    features: ["Verification system", "Warn, mute, ban, kick", "Anti-spam", "Anti-raid", "Basic logging", "Phishing link detection"],
  },
  {
    id: "support",
    name: "Oversite Support",
    price: 99,
    description: "Tickets, appeals, reports, and welcomes.",
    icon: Headphones,
    color: "from-blue-500/20 to-cyan-500/20",
    border: "border-blue-500/30",
    features: ["Ticket system (unlimited categories)", "Claim system", "Ban appeals", "Member reports", "Welcome / goodbye messages"],
  },
  {
    id: "utilities",
    name: "Oversite Utilities",
    price: 99,
    description: "Announcements, roles, Roblox, music, more.",
    icon: Wrench,
    color: "from-green-500/20 to-emerald-500/20",
    border: "border-green-500/30",
    features: ["/say and /announce", "Reaction roles (unlimited)", "Autorole", "Poll", "Userinfo, serverinfo, avatar", "8ball, coinflip"],
  },
  {
    id: "all-in-one",
    name: "All-in-One Pack",
    price: 199,
    description: "Protection + Support + Utilities — every base in one bot.",
    icon: Sparkles,
    color: "from-purple-500/20 to-pink-500/20",
    border: "border-purple-500/30",
    popular: true,
    features: ["Everything in Oversite Protection", "Everything in Oversite Support", "Everything in Oversite Utilities"],
  },
];

// ── Addons per base ──
const ADDONS: Record<string, { id: string; name: string; price: number; description: string; requires?: string }[]> = {
  protection: [
    { id: "advanced-logging", name: "Advanced Logging", price: 2.99, description: "Message edits, deletes, and full activity logs." },
    { id: "nsfw-invite-scanner", name: "NSFW Invite Scanner + Censored Logs", price: 2.99, description: "Catches NSFW invites and stores censored evidence." },
    { id: "avatar-nsfw-detection", name: "Avatar NSFW Detection", price: 1.99, description: "Flags NSFW avatars. Requires Censored Logs.", requires: "nsfw-invite-scanner" },
    { id: "bio-phrase-detection", name: "Bio Phrase Detection", price: 0.99, description: "Catches banned phrases in user bios. Requires Censored Logs.", requires: "nsfw-invite-scanner" },
    { id: "account-age-gating", name: "New Account Age Gating", price: 0.99, description: "Flags accounts under 20 days old." },
    { id: "auto-escalating-warnings", name: "Auto-Escalating Warnings", price: 1.99, description: "Warns auto-escalate to mute/ban thresholds." },
    { id: "softban-massban", name: "/softban and /massban", price: 1.99, description: "Quick cleanup tools for serious incidents." },
    { id: "channel-lockdown", name: "Channel Lockdown Command", price: 1.99, description: "Instantly lock a channel or the whole server." },
    { id: "staff-notes", name: "Staff Notes on Users", price: 1.99, description: "Private notes staff can attach to any member." },
    { id: "moderation-history", name: "Moderation History", price: 1.99, description: "Full mod-log history per user." },
    { id: "auto-slowmode", name: "Auto Slowmode on Spam", price: 1.99, description: "Triggers slowmode when spam is detected." },
    { id: "temp-ban", name: "Temporary Bans (Auto-Unban)", price: 1.99, description: "Time-limited bans that lift themselves." },
  ],
  support: [
    { id: "staff-performance", name: "Staff Performance Tracking", price: 1.99, description: "Track tickets handled, response times, and more." },
    { id: "ticket-logs", name: "Ticket Logs", price: 0.99, description: "Full transcripts and history of every ticket." },
    { id: "per-category-roles", name: "Per Category Role Access", price: 0.99, description: "Set different staff roles per ticket category." },
    { id: "ticket-notes", name: "Ticket Notes", price: 0.99, description: "Internal staff notes inside tickets." },
    { id: "ticket-members", name: "Add / Remove Members", price: 0.99, description: "Pull people in or out of a ticket." },
    { id: "close-all-tickets", name: "Close All Tickets", price: 0.99, description: "One command to close every open ticket." },
    { id: "ticket-message-customization", name: "Ticket Message Customization", price: 1.99, description: "Customize open/close/welcome messages." },
    { id: "priority-ticket", name: "Priority Ticket Flagging", price: 0.99, description: "Mark tickets as urgent for staff." },
    { id: "auto-close-tickets", name: "Auto-Close Inactive Tickets", price: 0.99, description: "Closes tickets that go idle." },
    { id: "anonymous-reporting", name: "Anonymous Reporting", price: 0.99, description: "Members can report without revealing identity." },
  ],
  utilities: [
    { id: "music", name: "Music Add-On", price: 1.99, description: "Full music playback with queues and controls." },
    { id: "auto-radio", name: "Auto Radio by Genre", price: 0.99, description: "Non-stop radio by genre. Requires Music Add-On.", requires: "music" },
    { id: "roblox-verification", name: "Roblox Verification", price: 0.99, description: "Verify members against their Roblox account." },
    { id: "starboard", name: "Starboard", price: 0.99, description: "Highlight top reactions in a starboard channel." },
    { id: "recurring-messages", name: "Recurring Messages", price: 0.99, description: "Schedule messages on a repeating timer." },
    { id: "giveaway", name: "Giveaway System", price: 0.99, description: "Run giveaways with reactions and timers." },
    { id: "birthday", name: "Birthday Announcements", price: 0.99, description: "Auto-announce member birthdays." },
    { id: "server-stats", name: "Server Stats Channels", price: 0.99, description: "Auto-updating channel names with member counts." },
    { id: "stream-notifications", name: "Twitch / YouTube Notifications", price: 0.99, description: "Ping when streamers go live or upload." },
    { id: "leveling", name: "Leveling System", price: 2.99, description: "XP, level-ups, and role rewards." },
    { id: "economy", name: "Economy System", price: 1.99, description: "Currency, shop, and rewards." },
    { id: "remindme", name: "/remindme", price: 0.99, description: "Personal reminder commands." },
  ],
};

// All-in-one gets all addons
ADDONS["all-in-one"] = [
  ...ADDONS.protection,
  ...ADDONS.support,
  ...ADDONS.utilities,
];

export default function BotOrderPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<"base" | "addons" | "details" | "checkout">("base");
  const [selectedBase, setSelectedBase] = useState<string | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [botName, setBotName] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutItems, setCheckoutItems] = useState<CheckoutItem[]>([]);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);

  const base = BASES.find((b) => b.id === selectedBase);
  const availableAddons = selectedBase ? (ADDONS[selectedBase] ?? []) : [];

  const toggleAddon = (addonId: string) => {
    const addon = availableAddons.find((a) => a.id === addonId);
    if (!addon) return;

    // If deselecting, also deselect anything that requires it
    if (selectedAddons.includes(addonId)) {
      const dependents = availableAddons.filter((a) => a.requires === addonId).map((a) => a.id);
      setSelectedAddons((prev) => prev.filter((id) => id !== addonId && !dependents.includes(id)));
    } else {
      // If selecting, also auto-select required addon
      const newAddons = [addonId];
      if (addon.requires && !selectedAddons.includes(addon.requires)) {
        newAddons.push(addon.requires);
      }
      setSelectedAddons((prev) => [...prev, ...newAddons.filter((id) => !prev.includes(id))]);
    }
  };

  const basePrice = base?.price ?? 0;
  const addonsPrice = selectedAddons.reduce((sum, id) => {
    const addon = availableAddons.find((a) => a.id === id);
    return sum + (addon?.price ?? 0);
  }, 0);
  const totalPrice = basePrice + addonsPrice;

  const handleStartCheckout = async () => {
    if (!user) {
      toast.error("Please sign in to order a bot.");
      navigate("/auth");
      return;
    }
    if (!selectedBase || !botName.trim()) return;

    // Create draft bot order
    const { data: order, error } = await (supabase as any)
      .from("bot_orders")
      .insert({
        user_id: user.id,
        bot_name: botName.trim(),
        base: selectedBase,
        addons: selectedAddons,
        total_amount: totalPrice,
        status: "draft",
      })
      .select("id")
      .single();

    if (error || !order) {
      toast.error("Failed to create order. Please try again.");
      return;
    }

    setPendingOrderId(order.id);

    // Build checkout items
    const items: CheckoutItem[] = [
      {
        productId: order.id,
        productName: `${base?.name} — ${botName.trim()}`,
        amountCents: Math.round(totalPrice * 100),
        currency: "usd",
        quantity: 1,
      },
    ];

    setCheckoutItems(items);
    setCheckoutOpen(true);
  };

  const handleCheckoutClose = async (open: boolean) => {
    setCheckoutOpen(open);
    if (!open && pendingOrderId) {
      // Check if order was paid
      const { data } = await (supabase as any)
        .from("bot_orders")
        .select("status")
        .eq("id", pendingOrderId)
        .single();

      if (data?.status === "paid" || data?.status === "ready") {
        navigate("/bot-dashboard");
      }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-16 max-w-5xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="text-primary text-xs font-semibold uppercase tracking-widest mb-2">
            Custom Discord Bot
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">
            Build your <span className="text-gradient">bot</span>
          </h1>
          <p className="text-muted-foreground text-lg">
            Pick a base, add features, and we'll deploy it for you.
          </p>
        </div>

        {/* Steps */}
        <div className="flex items-center justify-center gap-2 mb-12">
          {["base", "addons", "details"].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                step === s ? "border-primary bg-primary text-primary-foreground" :
                ["base", "addons", "details"].indexOf(step) > i ? "border-primary bg-primary/20 text-primary" :
                "border-border text-muted-foreground"
              }`}>
                {["base", "addons", "details"].indexOf(step) > i ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span className={`text-sm font-medium capitalize ${step === s ? "text-foreground" : "text-muted-foreground"}`}>
                {s}
              </span>
              {i < 2 && <div className="w-8 h-px bg-border mx-1" />}
            </div>
          ))}
        </div>

        {/* Step 1: Base */}
        {step === "base" && (
          <div>
            <h2 className="text-2xl font-bold mb-6 text-center">Choose your base bot</h2>
            <div className="grid sm:grid-cols-2 gap-5">
              {BASES.map((b) => {
                const Icon = b.icon;
                const selected = selectedBase === b.id;
                return (
                  <Card
                    key={b.id}
                    onClick={() => setSelectedBase(b.id)}
                    className={`relative p-6 cursor-pointer transition-all border-2 bg-gradient-to-br ${b.color} ${
                      selected ? `${b.border} shadow-lg scale-[1.02]` : "border-border hover:border-primary/40"
                    } ${b.popular ? "ring-2 ring-primary/30" : ""}`}
                  >
                    {b.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase bg-primary text-primary-foreground">
                        Best value
                      </div>
                    )}
                    {selected && (
                      <div className="absolute top-3 right-3 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-3.5 w-3.5 text-primary-foreground" />
                      </div>
                    )}
                    <div className="flex items-center gap-3 mb-3">
                      <Icon className="h-6 w-6 text-primary" />
                      <div>
                        <h3 className="font-bold">{b.name}</h3>
                        <p className="text-xs text-muted-foreground">{b.description}</p>
                      </div>
                    </div>
                    <ul className="space-y-1.5 mb-4">
                      {b.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-sm">
                          <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <div className="text-2xl font-bold">${b.price}
                      <span className="text-sm text-muted-foreground font-normal"> one-time</span>
                    </div>
                  </Card>
                );
              })}
            </div>
            <div className="flex justify-end mt-8">
              <Button
                variant="hero"
                size="lg"
                disabled={!selectedBase}
                onClick={() => setStep("addons")}
              >
                Continue to Addons →
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Addons */}
        {step === "addons" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Add optional features</h2>
              <Button variant="outline" onClick={() => setStep("base")}>← Back</Button>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
              {availableAddons.map((addon) => {
                const selected = selectedAddons.includes(addon.id);
                const requiresMissing = addon.requires && !selectedAddons.includes(addon.requires);
                return (
                  <Card
                    key={addon.id}
                    onClick={() => toggleAddon(addon.id)}
                    className={`p-4 cursor-pointer transition-all border-2 ${
                      selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{addon.name}</span>
                          {addon.requires && (
                            <Badge variant="outline" className="text-[10px]">requires {availableAddons.find(a => a.id === addon.requires)?.name}</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{addon.description}</p>
                        <p className="text-sm font-bold mt-2">${addon.price}</p>
                      </div>
                      <div className={`h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                        selected ? "border-primary bg-primary" : "border-muted-foreground"
                      }`}>
                        {selected && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Price summary */}
            <Card className="p-5 mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-muted-foreground">Base bot ({base?.name})</span>
                <span className="font-medium">${basePrice}</span>
              </div>
              {selectedAddons.length > 0 && (
                <div className="flex justify-between items-center mb-2">
                  <span className="text-muted-foreground">Addons ({selectedAddons.length})</span>
                  <span className="font-medium">${addonsPrice.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-border pt-2 mt-2 flex justify-between items-center">
                <span className="font-bold">Total</span>
                <span className="text-2xl font-bold">${totalPrice.toFixed(2)}</span>
              </div>
            </Card>

            <div className="flex justify-end">
              <Button variant="hero" size="lg" onClick={() => setStep("details")}>
                Continue to Details →
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Details */}
        {step === "details" && (
          <div className="max-w-lg mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Name your bot</h2>
              <Button variant="outline" onClick={() => setStep("addons")}>← Back</Button>
            </div>

            <Card className="p-6 mb-6">
              <div className="space-y-4">
                <div>
                  <Label>Bot Name *</Label>
                  <Input
                    value={botName}
                    onChange={(e) => setBotName(e.target.value)}
                    placeholder="e.g. Guardian, ModBot, Atlas..."
                    className="mt-1.5"
                    maxLength={32}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    This will be your bot's display name on Discord. Max 32 characters.
                  </p>
                </div>
              </div>
            </Card>

            {/* Order summary */}
            <Card className="p-5 mb-6 bg-muted/30">
              <h3 className="font-semibold mb-3">Order Summary</h3>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Base</span>
                  <span>{base?.name}</span>
                </div>
                {selectedAddons.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Addons</span>
                    <span>{selectedAddons.length} selected</span>
                  </div>
                )}
                <div className="border-t border-border pt-2 mt-2 flex justify-between font-bold">
                  <span>Total</span>
                  <span>${totalPrice.toFixed(2)}</span>
                </div>
              </div>
            </Card>

            <Button
              variant="hero"
              size="lg"
              className="w-full"
              disabled={!botName.trim()}
              onClick={handleStartCheckout}
            >
              Proceed to Payment →
            </Button>
          </div>
        )}
      </main>
      <Footer />

      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={handleCheckoutClose}
        items={checkoutItems}
        customerEmail={user?.email}
      />
    </div>
  );
}
