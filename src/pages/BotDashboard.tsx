import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useOwnedBots, type OwnedBot } from "@/hooks/useOwnedBots";
import {
  BOT_BASE_LABELS,
  BOT_BASE_TAGLINES,
  getAddonLabel,
} from "@/lib/botCatalog";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { AddAddonsDialog } from "@/components/dashboard/AddAddonsDialog";
import { AddonConfigCard } from "@/components/dashboard/AddonConfigCard";
import {
  LogOut,
  Settings,
  Bot,
  Sparkles,
  Clock,
  Lock,
  ArrowRight,
  ArrowLeft,
  Globe,
  Terminal,
  Package,
  Layers,
  Server,
  XCircle,
  Plus,
  ShieldCheck,
  LifeBuoy,
  Wrench,
  Star,
} from "lucide-react";

/** Add-on ids grouped by category — used to render config boxes per group. */
const PROTECTION_ADDON_IDS = [
  "advanced-logging",
  "nsfw-invite-scanner",
  "avatar-nsfw-detection",
  "bio-phrase-detection",
  "account-age-gating",
  "auto-escalating-warnings",
  "softban-massban",
  "channel-lockdown",
  "staff-notes",
  "moderation-history",
  "auto-slowmode",
  "temp-bans",
];
const SUPPORT_ADDON_IDS = [
  "staff-performance",
  "ticket-logs",
  "per-category-roles",
  "ticket-notes",
  "ticket-add-remove",
  "close-all-tickets",
  "ticket-message-customization",
  "priority-flagging",
  "auto-close-inactive",
  "anonymous-reporting",
];
const UTILITIES_ADDON_IDS = [
  "music-addon",
  "auto-radio",
  "roblox-verification",
  "starboard",
  "recurring-messages",
  "giveaway-system",
  "birthday-announcements",
  "server-stats-channels",
  "live-notifications",
  "leveling-system",
  "economy-system",
  "remindme",
];
const SHARED_ADDON_IDS = ["branding", "dashboard", "multi-server"];

const canCancelStatus = (status: string) =>
  status === "draft" || status === "submitted";

type Plugin = {
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Addon ids that unlock this plugin. If omitted, plugin is always shown (core). */
  requires?: string[];
};

const plugins: Plugin[] = [
  // Core — always available
  { name: "Settings", description: "Configure your bot's core settings.", icon: Settings },
  // Add-on gated
  { name: "Auto Reply", description: "Have your bot respond automatically to certain triggers.", icon: MessageSquare, requires: ["auto-response"] },
  { name: "Automod", description: "Let your bot automatically moderate your server and give your mods a break.", icon: Bot, requires: ["anti-spam","profanity-filter","link-filter","scam-detector","caps-filter","emoji-spam","attachment-filter","mention-guard","nsfw-filter"] },
  { name: "Ban Appeal", description: "Ditch Google forms, handle your ban appeals with your bot!", icon: ShieldAlert, requires: ["application-system","ticket-system"] },
  { name: "Custom Commands", description: "Create commands with your own code to run with your bot.", icon: Code2, requires: ["custom-commands"] },
  { name: "Logging", description: "Log everything that happens in your server to a text channel (or multiple).", icon: ScrollText, requires: ["logging-system","audit-logger"] },
  { name: "Moderation", description: "Defend your server with a large arsenal of moderation commands.", icon: Gavel, requires: ["auto-mute","auto-kick","auto-ban","slowmode","invite-control","new-account-guard","alt-detection","verification-gate","vpn-blocker"] },
  { name: "Reaction Roles", description: "Allow your server members to easily assign themselves roles via buttons or reactions.", icon: Sparkles, requires: ["reaction-roles"] },
  { name: "Report", description: "Give your members a way to easily report rule-breaking messages to your moderators.", icon: Flag, requires: ["report-system"] },
  { name: "Recurring Reminders", description: "Send repeating messages on a set interval to a channel of your choice.", icon: Clock, requires: ["scheduled-messages","reminder-system","rule-reminder"] },
  { name: "Roblox", description: "Link Roblox accounts to Discord users, assign roles to users based on their group rank.", icon: Lock, requires: ["role-manager"] },
  { name: "Starboard", description: "Save messages directly to a text channel by reacting with a star.", icon: Star, requires: ["starboard"] },
  { name: "Welcome", description: "Set an autorole and welcome/goodbye messages.", icon: Hand, requires: ["welcome","goodbye","onboarding"] },
];

type StatusMeta = { label: string; className: string };
const STATUS_META: Record<string, StatusMeta> = {
  draft:     { label: "Draft",            className: "bg-muted text-muted-foreground border-border" },
  submitted: { label: "Preorder placed",  className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  paid:      { label: "Paid — queued",    className: "bg-primary/15 text-primary border-primary/30" },
  building:  { label: "In build",         className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  ready:     { label: "Ready to invite",  className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  live:      { label: "Live",             className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  cancelled: { label: "Cancelled",        className: "bg-destructive/15 text-destructive border-destructive/30" },
};
const getStatusMeta = (s: string): StatusMeta =>
  STATUS_META[s] ?? { label: s, className: "bg-muted text-muted-foreground border-border" };

const BotSection = ({
  bot,
  queuePosition,
  onCancel,
  onAddAddons,
}: {
  bot: OwnedBot;
  queuePosition: number | null;
  onCancel: (bot: OwnedBot) => void;
  onAddAddons: (bot: OwnedBot) => void;
}) => {
  const baseLabel = BOT_BASE_LABELS[bot.base] ?? bot.base;
  const baseTagline = BOT_BASE_TAGLINES[bot.base];
  const cancellable = canCancelStatus(bot.status);
  const statusMeta = getStatusMeta(bot.status);
  const ownedAddons = new Set(bot.addons);
  const enabledPlugins = plugins.filter(
    (p) => !p.requires || p.requires.some((id) => ownedAddons.has(id))
  );
  const showQueue = queuePosition && (bot.status === "submitted" || bot.status === "paid");
  const showPreorderBanner = bot.status === "submitted";
  const showReadyBanner = bot.status === "ready" && bot.delivery_url;

  return (
    <section className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 grid place-items-center overflow-hidden shrink-0">
            {bot.icon_url ? (
              <img src={bot.icon_url} alt={bot.bot_name} className="h-full w-full object-cover" />
            ) : (
              <Bot className="h-6 w-6 text-primary" />
            )}
          </div>
          <div className="min-w-0">
            <h2 className="text-2xl font-bold tracking-tight truncate">
              Managing <span className="text-gradient">{bot.bot_name}</span>
            </h2>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <Badge variant="outline" className={`text-xs ${statusMeta.className}`}>
                {statusMeta.label}
              </Badge>
              {showQueue && (
                <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-400 border-amber-500/30">
                  Queue position #{queuePosition}
                </Badge>
              )}
              <Badge variant="secondary" className="text-xs">
                {baseLabel}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {bot.addons.length} add-on{bot.addons.length === 1 ? "" : "s"}
              </span>
              {bot.monthly_hosting && (
                <Badge variant="outline" className="text-xs gap-1">
                  <Server className="h-3 w-3" />
                  Hosting
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAddAddons(bot)}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add more add-ons
          </Button>
          {cancellable ? (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onCancel(bot)}
            >
              <XCircle className="h-4 w-4 mr-1.5" />
              Cancel subscription
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground self-center">
              Contact support to cancel subscription
            </span>
          )}
        </div>
      </div>

      {showPreorderBanner && (
        <Card className="p-4 bg-amber-500/5 border-amber-500/30">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
            <div className="text-sm">
              <div className="font-semibold text-amber-300">Preorder received</div>
              <p className="text-muted-foreground mt-1">
                {queuePosition
                  ? `You're #${queuePosition} in the build queue. `
                  : "We've added your bot to the build queue. "}
                We'll reach out within 24 hours to confirm scope and finalize payment.
              </p>
            </div>
          </div>
        </Card>
      )}

      {showReadyBanner && (
        <Card className="p-4 bg-emerald-500/5 border-emerald-500/30">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
            <div className="text-sm flex-1">
              <div className="font-semibold text-emerald-300">Your bot is ready</div>
              <p className="text-muted-foreground mt-1">
                Use the link below to invite or download your bot.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <a href={bot.delivery_url ?? "#"} target="_blank" rel="noopener noreferrer">
                  <ArrowRight className="h-4 w-4 mr-1.5" />
                  Open delivery link
                </a>
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* What you bought — system + add-ons summary */}
      <Card className="bg-card/60 border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <Package className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
            Your build
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-2">
              <Layers className="h-3.5 w-3.5" />
              System
            </div>
            <div className="font-semibold">{baseLabel}</div>
            {baseTagline && (
              <p className="text-sm text-muted-foreground mt-1">{baseTagline}</p>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-2">
              <Sparkles className="h-3.5 w-3.5" />
              Add-ons ({bot.addons.length})
            </div>
            {bot.addons.length === 0 ? (
              <p className="text-sm text-muted-foreground">No add-ons selected.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {bot.addons.map((id) => (
                  <Badge key={id} variant="secondary" className="text-xs font-normal">
                    {getAddonLabel(id)}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      <div>
        <div className="flex items-center gap-2 mb-4 mt-2">
          <Settings className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
            Plugins ({enabledPlugins.length})
          </h3>
        </div>
        {enabledPlugins.length === 0 ? (
          <Card className="bg-card/40 border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No plugins enabled yet. Add an add-on to unlock plugins for{" "}
              <span className="text-foreground font-medium">{bot.bot_name}</span>.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => onAddAddons(bot)}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Browse add-ons
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {enabledPlugins.map((p) => {
              const Icon = p.icon;
              return (
                <Card
                  key={`${bot.id}-${p.name}`}
                  className="group cursor-pointer bg-card hover:bg-card/80 border-border hover:border-primary/50 hover:shadow-elegant transition-smooth p-6 flex flex-col min-h-[170px]"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center shrink-0 group-hover:bg-primary/15 transition-smooth">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-semibold text-base leading-tight pt-1.5">{p.name}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground flex-1">{p.description}</p>
                  <div className="flex justify-end mt-3">
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-smooth" />
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};


const BotDashboard = () => {
  const { user, isAdmin, loading } = useAuth();
  const { dashboardBots, loading: botsLoading, reload } = useOwnedBots();
  const navigate = useNavigate();
  const [cancelTarget, setCancelTarget] = useState<OwnedBot | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [addonsTarget, setAddonsTarget] = useState<OwnedBot | null>(null);
  const [queuePositions, setQueuePositions] = useState<Map<string, number>>(new Map());

  // Compute global queue position for any of the user's bots that are still
  // pending build. Anonymous-friendly: we only read submitted_at + id of
  // queueable orders (no other PII), and the read is filtered to those rows
  // owned by the user — but the position is computed against the global queue
  // by counting earlier submitted_at values across all queueable orders.
  useEffect(() => {
    if (!dashboardBots.length) {
      setQueuePositions(new Map());
      return;
    }
    let cancelled = false;
    (async () => {
      const myQueueable = dashboardBots.filter(
        (b) => (b.status === "submitted" || b.status === "paid") && b.submitted_at,
      );
      if (!myQueueable.length) {
        setQueuePositions(new Map());
        return;
      }
      const positions = new Map<string, number>();
      for (const b of myQueueable) {
        const { count } = await (supabase as any)
          .from("bot_orders")
          .select("id", { count: "exact", head: true })
          .in("status", ["submitted", "paid"])
          .lt("submitted_at", b.submitted_at);
        positions.set(b.id, (count ?? 0) + 1);
      }
      if (!cancelled) setQueuePositions(positions);
    })();
    return () => {
      cancelled = true;
    };
  }, [dashboardBots]);

  const cancelOrder = async (bot: OwnedBot) => {
    if (!user) return;
    setCancelling(true);
    const { error } = await (supabase as any)
      .from("bot_orders")
      .update({ status: "cancelled" })
      .eq("id", bot.id)
      .eq("user_id", user.id);
    setCancelling(false);
    if (error) {
      toast.error("Couldn't cancel — " + error.message);
      return;
    }
    toast.success(`Cancelled "${bot.bot_name}"`);
    setCancelTarget(null);
    reload();
  };

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/auth", { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading || botsLoading) {
    return (
      <div className="min-h-screen bg-background grid place-items-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!user) return null;

  const hasAccess = isAdmin || dashboardBots.length > 0;

  // No Web Dashboard add-on on any of their bots — show locked / explainer state.
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background grid place-items-center px-4">
        <div className="max-w-md text-center space-y-5">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 border border-primary/20 grid place-items-center">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Web Dashboard not enabled</h1>
          <p className="text-muted-foreground">
            The <span className="text-foreground font-medium">Web Dashboard</span>{" "}
            add-on unlocks bot management from this site. Without it, you can
            still configure your bot in Discord with{" "}
            <code className="text-foreground bg-muted px-1.5 py-0.5 rounded text-sm">
              /cmds
            </code>
            .
          </p>
          <div className="flex gap-3 justify-center">
            <Button asChild>
              <Link to="/bots">
                <Globe className="h-4 w-4 mr-2" />
                Add Web Dashboard
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/">Back to site</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-10 max-w-7xl">
        <div className="flex items-center justify-between mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-smooth"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to site
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate("/auth", { replace: true });
            }}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign out
          </Button>
        </div>

        <div className="text-center mb-12">
          <div className="text-primary text-xs font-semibold uppercase tracking-widest mb-2">
            Bot Dashboard
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Manage <span className="text-gradient">Your Bots</span>
          </h1>
          <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
            Each section below is one of your bots. Configure plugins,
            settings, and behavior per bot.
          </p>
        </div>

        {dashboardBots.length === 0 && isAdmin ? (
          <div className="max-w-md mx-auto text-center space-y-4 py-12">
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 border border-primary/20 grid place-items-center">
              <Terminal className="h-5 w-5 text-primary" />
            </div>
            <p className="text-muted-foreground">
              You're viewing as admin but don't have any bots with the Web
              Dashboard add-on yet.
            </p>
          </div>
        ) : (
          <div className="space-y-16">
            {dashboardBots.map((bot) => (
              <BotSection
                key={bot.id}
                bot={bot}
                queuePosition={queuePositions.get(bot.id) ?? null}
                onCancel={setCancelTarget}
                onAddAddons={setAddonsTarget}
              />
            ))}
          </div>
        )}
      </div>

      <AlertDialog
        open={!!cancelTarget}
        onOpenChange={(o) => !o && !cancelling && setCancelTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Cancel subscription for "{cancelTarget?.bot_name}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This is a full shutdown for this bot — all recurring payments
              and hosting stop, the bot goes offline, and it's removed from
              your dashboard. Use this if you've shut your server down or
              don't need this bot anymore. This can't be undone, but you can
              always build a new bot later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Keep subscription</AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (cancelTarget) cancelOrder(cancelTarget);
              }}
            >
              {cancelling ? "Cancelling…" : "Yes, cancel subscription"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AddAddonsDialog
        bot={addonsTarget}
        open={!!addonsTarget}
        onOpenChange={(o) => !o && setAddonsTarget(null)}
      />
    </div>
  );
};

export default BotDashboard;
