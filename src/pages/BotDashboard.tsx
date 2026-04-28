import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useOwnedBots, type OwnedBot } from "@/hooks/useOwnedBots";
import {
  BOT_BASE_LABELS,
  BOT_BASE_TAGLINES,
  getAddonLabel,
  getIncludedAddonsForBase,
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
import { SortableAddonGrid } from "@/components/dashboard/SortableAddonGrid";
import { FixesBar } from "@/components/dashboard/FixesBar";
import { BotIdentityEditor } from "@/components/dashboard/BotIdentityEditor";
import { HexagonLoader } from "@/components/dashboard/HexagonLoader";
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
  MessageSquare,
  Github,
} from "lucide-react";

/** Add-on ids grouped by category — used to render config boxes per group.
 *  Order here is the exact left→right, top→bottom order shown in the dashboard.
 *  Base-included features come first, then paid add-ons. */
const PROTECTION_ADDON_IDS = [
  // Reordered per product: Moderation History first, Advanced Logging second,
  // Auto-Escalating Warnings third — then everything else.
  "moderation-history",
  "advanced-logging",
  "auto-escalating-warnings",
  "verification-system",
  "mod-actions",
  "anti-spam",
  "anti-raid",
  "basic-logging",
  "phishing-detection",
  // Remaining paid add-ons
  "nsfw-invite-scanner",
  "avatar-nsfw-detection",
  "bio-phrase-detection",
  "softban-massban",
  "channel-lockdown",
  "staff-notes",
  "auto-slowmode",
  "temp-bans",
  "messages",
];
const SUPPORT_ADDON_IDS = [
  "ticket-message-customization",
  "anonymous-reporting",
  "staff-performance",
  "ticket-logs",
  "ticket-notes",
  "ticket-add-remove",
  "close-all-tickets",
  "priority-flagging",
  "auto-close-inactive",
  "messages",
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
  "messages",
];
// Combined card replaces the old per-bot Custom Branding / Multi-Server / Web
// Dashboard trio. The dashboard page is already gated to users who own the
// Web Dashboard add-on, so we just always render this single combined box.
const SHARED_ADDON_IDS = ["branding-multi-server"];

const canCancelStatus = (status: string) =>
  status === "draft" || status === "submitted";

/** Visual category metadata for grouped add-on config sections. */
const ADDON_GROUPS: {
  key: "protection" | "support" | "utilities" | "shared";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  ids: string[];
}[] = [
  { key: "protection", label: "Protection", icon: ShieldCheck, ids: PROTECTION_ADDON_IDS },
  { key: "support",    label: "Support",    icon: LifeBuoy,    ids: SUPPORT_ADDON_IDS },
  { key: "utilities",  label: "Utilities",  icon: Wrench,      ids: UTILITIES_ADDON_IDS },
  { key: "shared",     label: "Extras",     icon: Star,        ids: SHARED_ADDON_IDS },
];

type StatusMeta = { label: string; className: string; loading?: boolean };
const STATUS_META: Record<string, StatusMeta> = {
  draft:     { label: "Draft",            className: "bg-muted text-muted-foreground border-border" },
  submitted: { label: "Building",         className: "bg-primary/15 text-primary border-primary/30", loading: true },
  paid:      { label: "Building",         className: "bg-primary/15 text-primary border-primary/30", loading: true },
  building:  { label: "Building",         className: "bg-blue-500/15 text-blue-400 border-blue-500/30", loading: true },
  ready:     { label: "Ready to invite",  className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  live:      { label: "Live",             className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  cancelled: { label: "Cancelled",        className: "bg-destructive/15 text-destructive border-destructive/30" },
};
const getStatusMeta = (s: string): StatusMeta =>
  STATUS_META[s] ?? { label: s, className: "bg-muted text-muted-foreground border-border" };

const BotSection = ({
  bot,
  allBots,
  userId,
  onCancel,
  onAddAddons,
  onReload,
}: {
  bot: OwnedBot;
  allBots: OwnedBot[];
  userId: string;
  onCancel: (bot: OwnedBot) => void;
  onAddAddons: (bot: OwnedBot) => void;
  onReload: () => void;
}) => {
  const baseLabel = BOT_BASE_LABELS[bot.base] ?? bot.base;
  const baseTagline = BOT_BASE_TAGLINES[bot.base];
  const cancellable = !bot.isDemo && canCancelStatus(bot.status);
  const statusMeta = getStatusMeta(bot.status);
  // Owned add-ons + features that ship with the base — both get config boxes.
  // The combined Multi-Server / Branding card is always shown here because the
  // dashboard page itself is gated to users who own the Web Dashboard add-on.
  const ownedAddons = new Set<string>([
    ...bot.addons,
    ...getIncludedAddonsForBase(bot.base),
    "branding-multi-server",
  ]);
  // Group owned add-ons by category for the configuration boxes section.
  // "messages" lives inside every category list so it shows under the bot's
  // main section, but we don't want a standalone group (e.g. "Utilities") to
  // appear just because of Messages — drop groups whose only item is Messages.
  const groupedAddons = ADDON_GROUPS
    .map((g) => ({ ...g, owned: g.ids.filter((id) => ownedAddons.has(id)) }))
    .filter((g) => g.owned.length > 0)
    .filter((g) => !(g.owned.length === 1 && g.owned[0] === "messages"));
  const totalConfigurable = groupedAddons.reduce((n, g) => n + g.owned.length, 0);
  const showPreorderBanner = !bot.isDemo && (bot.status === "submitted" || bot.status === "paid");
  const showReadyBanner = !bot.isDemo && bot.status === "ready" && bot.delivery_url;

  const headerBadges = (
    <>
      <Badge variant="outline" className={`text-xs gap-1.5 ${statusMeta.className}`}>
        {statusMeta.loading && !bot.isDemo && <HexagonLoader size={12} />}
        {statusMeta.label}
      </Badge>
      <Badge variant="secondary" className="text-xs">
        {baseLabel}
      </Badge>
      {bot.monthly_hosting && (
        <Badge variant="outline" className="text-xs gap-1">
          <Server className="h-3 w-3" />
          Hosting
        </Badge>
      )}
      {bot.isDemo && (
        <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
          Practice bot
        </Badge>
      )}
    </>
  );

  const headerActions = !bot.isDemo ? (
    <>
      <Button variant="outline" size="sm" onClick={() => onAddAddons(bot)}>
        <Plus className="h-4 w-4 mr-1.5" />
        Add add-ons
      </Button>
      {cancellable && (
        <Button
          variant="outline"
          size="sm"
          className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onCancel(bot)}
        >
          <XCircle className="h-4 w-4 mr-1.5" />
          Cancel
        </Button>
      )}
    </>
  ) : null;

  return (
    <section className="space-y-5">
      <BotIdentityEditor
        bot={bot}
        onUpdated={onReload}
        badges={headerBadges}
        actions={headerActions}
      />

      {showPreorderBanner && (
        <Card className="p-4 bg-primary/5 border-primary/30">
          <div className="flex items-start gap-3">
            <HexagonLoader size={22} className="mt-0.5" />
            <div className="text-sm">
              <div className="font-semibold text-primary">Your bot is being built</div>
              <p className="text-muted-foreground mt-1">
                We're putting your bot together. You'll get an email the moment it's
                ready to invite — no action needed from you right now.
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

      {/* Compact build summary — collapsible details */}
      <details className="group rounded-lg border border-border bg-card/40">
        <summary className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer list-none">
          <div className="flex items-center gap-2 text-sm min-w-0">
            <Package className="h-4 w-4 text-primary shrink-0" />
            <span className="font-medium truncate">{baseLabel}</span>
            <span className="text-muted-foreground shrink-0">
              · {bot.addons.length} add-on{bot.addons.length === 1 ? "" : "s"}
            </span>
          </div>
          <span className="text-xs text-muted-foreground shrink-0 group-open:hidden">
            Show details
          </span>
          <span className="text-xs text-muted-foreground shrink-0 hidden group-open:inline">
            Hide
          </span>
        </summary>
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-border">
          {baseTagline && (
            <p className="text-sm text-muted-foreground">{baseTagline}</p>
          )}
          {bot.addons.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {bot.addons.map((id) => (
                <Badge key={id} variant="secondary" className="text-xs font-normal">
                  {getAddonLabel(id)}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </details>

      <div className="space-y-10">

        {totalConfigurable === 0 ? (
          <Card className="bg-card/40 border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No add-ons on this bot yet. Add one to unlock its configuration box.
            </p>
            {!bot.isDemo && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => onAddAddons(bot)}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Browse add-ons
              </Button>
            )}
          </Card>
        ) : (
          groupedAddons.map((group) => {
            const GroupIcon = group.icon;
            const showSourceCard = group.key === "shared" && !bot.isDemo;
            return (
              <div key={group.key} className="space-y-4">
                <div className="flex items-center gap-2">
                  <GroupIcon className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                    {group.label} ({group.owned.length + (showSourceCard ? 1 : 0)})
                  </h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {showSourceCard && <SourceCodeCard sourceUrl={bot.source_url} />}
                </div>
                <SortableAddonGrid
                  userId={userId}
                  botId={bot.id}
                  botName={bot.bot_name}
                  botAvatarUrl={bot.icon_url}
                  groupKey={group.key}
                  ids={group.owned}
                />
              </div>
            );
          })
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

        <FixesBar />

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
                allBots={dashboardBots}
                userId={user.id}
                onCancel={setCancelTarget}
                onAddAddons={setAddonsTarget}
                onReload={reload}
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
