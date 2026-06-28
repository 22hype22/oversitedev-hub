import { lazy, Suspense, useEffect, useRef, useState, useCallback, useLayoutEffect, useMemo } from "react";
import { useBotHealth } from "@/hooks/useBotHealth";
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
// Lazy-loaded: the add-on configuration UI pulls in a large bundle of
// per-addon editors. Defer it so the bot header/controls paint within
// 1-2s of navigation instead of waiting on all addon code to load.
const AddonConfigCard = lazy(() =>
  import("@/components/dashboard/AddonConfigCard").then((m) => ({ default: m.AddonConfigCard })),
);
import { TicketEditorCard } from "@/components/dashboard/TicketEditorCard";
import { GiveawayLaunchCard } from "@/components/dashboard/GiveawayLaunchCard";
import { FixesBar } from "@/components/dashboard/FixesBar";
import { BotIdentityEditor } from "@/components/dashboard/BotIdentityEditor";

import { HexagonLoader } from "@/components/dashboard/HexagonLoader";
import { RedeemFreeCodeBox } from "@/components/dashboard/RedeemFreeCodeBox";
import { BotControlsPanel } from "@/components/dashboard/BotControlsPanel";
import { BotUsageMetricsPanel } from "@/components/dashboard/BotUsageMetricsPanel";
import { BotServerSlotsCard } from "@/components/dashboard/BotServerSlotsCard";
import { BotInviteLinkCard } from "@/components/dashboard/BotInviteLinkCard";
import { TeamManagementHub } from "@/components/dashboard/team/TeamManagementHub";
import { NewOwnerBillingDialog } from "@/components/dashboard/team/NewOwnerBillingDialog";
import { RequestCustomFeatureDialog } from "@/components/dashboard/RequestCustomFeatureDialog";
import { ReportBugDialog } from "@/components/dashboard/ReportBugDialog";
import { BotHealthBadge } from "@/components/dashboard/BotHealthBadge";
import { DashboardServerSelector } from "@/components/dashboard/DashboardServerSelector";
import { ActiveGuildProvider } from "@/hooks/useActiveGuild";
import { useBotFreePeriods, type BotFreePeriod } from "@/hooks/useBotFreePeriods";
import { useBotServerSlots } from "@/hooks/useBotServerSlots";
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
  Code2,
  RefreshCw,
  AlertTriangle,
  Bug,
  Gift,
  ChevronDown,
  ChevronUp,
  Search,
  Loader2,
  LayoutGrid,
  Users,
  CreditCard,
  Activity as ActivityIcon,
  Bell,
  Image as ImageIcon,
  Check,
  ChevronRight,
  Megaphone,
  Home,
  Network,
} from "lucide-react";
import containers from "@/assets/containers.webp";
import heroBg from "@/assets/hero-bg.jpg";
import { useBotNotifications, type BotNotification } from "@/hooks/useBotNotifications";
import { Input } from "@/components/ui/input";
import { HostingPastDueBanner } from "@/components/dashboard/HostingPastDueBanner";
import { ReadOnlyBotScope } from "@/components/dashboard/ReadOnlyBotScope";
import { useTeamRole } from "@/hooks/useTeamRole";
import { useHostingSubscriptionSync } from "@/hooks/useHostingSubscriptionSync";

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
  "auto-role",
  "phishing-detection",
  // Remaining paid add-ons
  "nsfw-invite-scanner",
  "avatar-nsfw-detection",
  "bio-phrase-detection",
  "channel-lockdown",
  "auto-slowmode",
  "ban-tools",
  "messages",
  "rules",
];
const SUPPORT_ADDON_IDS = [
  "ticket-message-customization",
  "ticket-lifecycle-messages",
  "ticket-editor",
  "staff-performance",
  
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
  
  "starboard",
  "recurring-messages",
  "giveaway-system",
  "server-stats-channels",
  "live-notifications",
  "leveling-system",
  "economy-system",
  "remindme",
  "staff-notes",
  "messages",
];
// Shared/extras add-ons (none currently — Multi-Server License & Custom
// Branding combined card was removed per product decision).
const SHARED_ADDON_IDS: string[] = [];

// Owners can cancel/remove a bot from any pre-live state OR once it's live
// ("paid"/"ready"). Cancelling flips the order to "cancelled", which hides it
// from the dashboard (entitlements like the Web Dashboard add-on still survive
// via ENTITLEMENT_STATUSES in useOwnedBots).
const canCancelStatus = (status: string) =>
  status === "draft" || status === "submitted" || status === "paid" || status === "ready";

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
  submitted: { label: "Confirmation",     className: "bg-primary/15 text-primary border-primary/30", loading: true },
  paid:      { label: "Confirmation",     className: "bg-primary/15 text-primary border-primary/30", loading: true },
  building:  { label: "Confirmation",     className: "bg-blue-500/15 text-blue-400 border-blue-500/30", loading: true },
  ready:     { label: "Ready to invite",  className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  live:      { label: "Live",             className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  cancelled: { label: "Cancelled",        className: "bg-destructive/15 text-destructive border-destructive/30" },
};
const getStatusMeta = (s: string): StatusMeta =>
  STATUS_META[s] ?? { label: s, className: "bg-muted text-muted-foreground border-border" };

const RequestCustomFeatureCard = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Card className="bg-card/40 border-border p-6 flex flex-col h-[210px] hover:border-primary/40 transition-smooth">
        <div className="flex items-start gap-3 mb-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/30 grid place-items-center shrink-0">
            <MessageSquare className="h-5 w-5 text-primary" />
          </div>
          <h3 className="font-semibold text-base leading-tight pt-1.5">Custom feature</h3>
        </div>
        <p className="text-sm text-muted-foreground flex-1">
          Need something unique? Request a custom feature built for your bot by our team.
        </p>
        <div className="mt-3">
          <Button variant="outline" size="sm" className="w-full" onClick={() => setOpen(true)}>
            <MessageSquare className="h-4 w-4 mr-1.5" />
            Request custom feature
          </Button>
        </div>
      </Card>
      <RequestCustomFeatureDialog open={open} onOpenChange={setOpen} />
    </>
  );
};

const ReportBugCard = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Card className="bg-card/40 border-border p-6 flex flex-col h-[210px] hover:border-destructive/50 transition-smooth">
        <div className="flex items-start gap-3 mb-3">
          <div className="h-10 w-10 rounded-lg bg-destructive/10 border border-destructive/30 grid place-items-center shrink-0">
            <Bug className="h-5 w-5 text-destructive" />
          </div>
          <h3 className="font-semibold text-base leading-tight pt-1.5">Report a bug</h3>
        </div>
        <p className="text-sm text-muted-foreground flex-1">
          Hit a snag? Send us the details and we'll get it fixed.
        </p>
        <div className="mt-3">
          <Button variant="outline" size="sm" className="w-full" onClick={() => setOpen(true)}>
            <Bug className="h-4 w-4 mr-1.5" />
            Report a bug
          </Button>
        </div>
      </Card>
      <ReportBugDialog open={open} onOpenChange={setOpen} />
    </>
  );
};

const EngineVersionSwitcher = ({
  bot,
  onReload,
}: {
  bot: OwnedBot;
  onReload: () => void;
}) => {
  const [confirmTarget, setConfirmTarget] = useState<"v1" | "v2" | null>(null);
  const [saving, setSaving] = useState(false);
  const current = bot.engine_version === "v2" ? "v2" : "v1";

  const switchTo = async (target: "v1" | "v2") => {
    setSaving(true);
    const { error } = await (supabase as any)
      .from("bot_orders")
      .update({ engine_version: target, updated_at: new Date().toISOString() })
      .eq("id", bot.id);
    setSaving(false);
    setConfirmTarget(null);
    if (error) {
      toast.error("Couldn't switch engine version", { description: error.message });
      return;
    }
    toast.success(`Switching to Component ${target.toUpperCase()}`, {
      description:
        "Your bot may experience a short period of downtime while the engine swaps over.",
    });
    onReload();
  };

  return (
    <>
      <Card className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <Code2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="text-sm flex-1">
            <div className="font-semibold text-foreground">Bot engine version</div>
            <p className="text-muted-foreground mt-1 text-xs">
              Switch between Component V1 (stable) and V2 (newest features).
              Switching causes a short period of downtime while we swap engines.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(["v1", "v2"] as const).map((id) => {
            const active = current === id;
            return (
              <button
                key={id}
                type="button"
                disabled={saving || active}
                onClick={() => setConfirmTarget(id)}
                className={`text-left rounded-lg border p-3 transition-all ${
                  active
                    ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                    : "border-border hover:border-primary/40 hover:bg-card disabled:opacity-50"
                }`}
              >
                <div className="text-sm font-medium text-foreground flex items-center justify-between">
                  Component {id.toUpperCase()}
                  {active && (
                    <Badge variant="secondary" className="text-[10px]">Active</Badge>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {id === "v1" ? "Stable — recommended" : "Newest — latest features"}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <AlertDialog
        open={confirmTarget !== null}
        onOpenChange={(o) => !o && !saving && setConfirmTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              Switch to Component {confirmTarget?.toUpperCase()}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Your bot may experience a short period of downtime while the engine
              swaps over. Commands and events may be briefly unavailable. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              onClick={() => confirmTarget && switchTo(confirmTarget)}
            >
              <RefreshCw className="h-4 w-4 mr-1.5" />
              {saving ? "Switching…" : "Switch version"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};


const BotSection = ({
  bot,
  allBots,
  userId,
  ownerEmail,
  freePeriod,
  onCancel,
  onAddAddons,
  onReload,
  searchQuery,
  highlightedAddonId,
}: {
  bot: OwnedBot;
  allBots: OwnedBot[];
  userId: string;
  ownerEmail?: string | null;
  freePeriod?: BotFreePeriod;
  onCancel: (bot: OwnedBot) => void;
  onAddAddons: (bot: OwnedBot) => void;
  onReload: () => void;
  searchQuery?: string;
  highlightedAddonId?: string | null;
}) => {
  const { health, loading: healthLoading, reload: reloadHealth } = useBotHealth(bot.isDemo ? null : bot.id);
  // Optimistic lockout: only "stop" forces offline until health confirms
  // offline. We deliberately do NOT lock the UI on "start"/"restart"/"redeploy"
  // — the Start action returns as soon as Railway accepts the request, and the
  // dashboard should flip from offline → online on its own once the next
  // heartbeat lands (useBotHealth polls every 10s).
  const [optimisticAction, setOptimisticAction] = useState<"stop" | null>(null);
  // Non-blocking "starting" indicator — set when the user clicks
  // Start/Restart/Redeploy and Railway accepts the request. Cleared as soon
  // as the worker's heartbeat confirms it's online. The dashboard is NOT
  // locked while starting — the user can still browse settings.
  const [isStarting, setIsStarting] = useState(false);
  useEffect(() => {
    if (!optimisticAction || !health?.effective_status) return;
    if (optimisticAction === "stop" && health.effective_status === "offline") {
      setOptimisticAction(null);
    }
  }, [optimisticAction, health?.effective_status]);
  useEffect(() => {
    if (!isStarting) return;
    // Clear as soon as the bot reports any non-offline status (online, ready,
    // live, starting, etc.) — the heartbeat is back, so the "Starting…" banner
    // has served its purpose.
    const status = health?.effective_status;
    if (status && status !== "offline") setIsStarting(false);
  }, [isStarting, health?.effective_status]);
  // Safety net: never let the "Starting…" banner stick around longer than
  // 90 seconds, even if the heartbeat never lands.
  useEffect(() => {
    if (!isStarting) return;
    const t = setTimeout(() => setIsStarting(false), 90_000);
    return () => clearTimeout(t);
  }, [isStarting]);
  // Debug: log health resolution per bot/viewer to diagnose team-member lockout issues.
  useEffect(() => {
    if (bot.isDemo) return;
    // eslint-disable-next-line no-console
    console.log("[BotHealth]", {
      botId: bot.id,
      viaTeam: bot.viaTeam,
      viaSupport: bot.viaSupport,
      ownerUserId: bot.ownerUserId,
      loading: healthLoading,
      health,
      effective_status: health?.effective_status ?? null,
    });
  }, [bot.id, bot.isDemo, bot.viaTeam, bot.viaSupport, bot.ownerUserId, healthLoading, health]);
  // Offline lockout is based ONLY on actual runtime status. Loading or null
  // health (e.g., RPC error, first paint) must NOT trigger the lockout —
  // we only lock when we have confirmed effective_status === "offline".
  // A bot is "deploying" when auto-deploy hasn't finished yet — either it's
  // actively deploying, it's queued waiting on a token from the pool, it
  // failed, or it succeeded but the worker hasn't sent its first heartbeat yet.
  const isQueued = !bot.isDemo && bot.deployment_status === "queued";
  // Only show the deploying banner when the order is actively mid-deploy.
  // Once deployment_status flips to 'deployed' (with a railway_service_id),
  // never show it again — even if a heartbeat hasn't landed yet.
  const isDeploying =
    !bot.isDemo &&
    bot.deployment_status !== "deployed" &&
    (bot.deployment_status === "deploying" ||
      bot.deployment_status === "failed" ||
      isQueued);
  const deployFailed = !bot.isDemo && bot.deployment_status === "failed";
  const isOffline =
    !bot.isDemo &&
    !isDeploying &&
    !isStarting &&
    (optimisticAction !== null ||
      (!healthLoading && health?.effective_status === "offline"));
  const { guilds: connectedGuilds, loading: guildsLoading } = useBotServerSlots(
    !bot.isDemo ? bot.id : undefined,
  );
  // Only show the "no servers" lockout when we're confident the bot is fully
  // online AND the guild fetch returned zero. During Starting / deploying /
  // offline phases the guild count can't be trusted (runtime_status hasn't
  // been refreshed yet), so we skip the lockout in those cases.
  const hasNoServers =
    !bot.isDemo &&
    !isDeploying &&
    !isOffline &&
    !isStarting &&
    !guildsLoading &&
    health?.effective_status === "online" &&
    connectedGuilds.length === 0;
  const [retrying, setRetrying] = useState(false);
  const retryInFlight = useRef(false);
  const retryDeploy = async () => {
    if (retryInFlight.current) return;
    retryInFlight.current = true;
    setRetrying(true);
    try {
      const { data, error } = await supabase.functions.invoke("auto-deploy-bot", {
        body: { orderId: bot.id },
      });
      if (error) {
        toast.error("Retry failed", { description: error.message });
      } else if ((data as { alreadyInProgress?: boolean } | null)?.alreadyInProgress) {
        toast.info("A deployment is already in progress for this bot.");
        onReload();
      } else {
        toast.success("Deployment retried — refreshing…");
        onReload();
      }
    } finally {
      setRetrying(false);
      // Brief cooldown to absorb rapid double-clicks across re-renders.
      setTimeout(() => {
        retryInFlight.current = false;
      }, 2000);
    }
  };

  const handleCommandSent = (action: "start" | "stop" | "restart" | "redeploy") => {
    if (action === "stop") {
      setOptimisticAction("stop");
      setIsStarting(false);
    } else {
      // Show non-blocking "Starting…" indicator until the heartbeat lands.
      setIsStarting(true);
    }
    reloadHealth();
  };
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
  ]);
  // Merged "Ban Tools" pseudo-card represents both /softban-massban and
  // /temp-ban. Show it whenever the user owns either underlying add-on.
  if (ownedAddons.has("softban-massban") || ownedAddons.has("temp-ban")) {
    ownedAddons.add("ban-tools");
  }
  // Group owned add-ons by category for the configuration boxes section.
  // "messages" lives inside every category list so it shows under the bot's
  // main section, but we don't want a standalone group (e.g. "Utilities") to
  // appear just because of Messages — drop groups whose only item is Messages.
  // Only show groups that match this bot's base (plus the shared "Extras" group).
  // "scratch" (All-in-One) shows every category.
  const allowedGroupKeys = new Set<string>(
    bot.base === "scratch"
      ? ["protection", "support", "utilities", "shared"]
      : [bot.base, "shared"],
  );
  const groupedAddons = ADDON_GROUPS
    .filter((g) => allowedGroupKeys.has(g.key))
    .map((g) => ({ ...g, owned: g.ids.filter((id) => ownedAddons.has(id)) }))
    // Keep the "shared" group even when empty so the Source code card still renders.
    .filter((g) => g.owned.length > 0 || (g.key === "shared" && !bot.isDemo));
  const totalConfigurable =
    groupedAddons.reduce((n, g) => n + g.owned.length, 0) + (!bot.isDemo ? 1 : 0);

  // ── Search-driven section auto-expand ──────────────────────────────────────
  // When the user types in the dashboard search bar, expand whichever section
  // (Manage / Add-on config) contains a match for their query, and collapse
  // the one that doesn't. User clicks still override afterwards.
  const [manageOpen, setManageOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [addonsOpen, setAddonsOpen] = useState(false);
  const [highlightSlots, setHighlightSlots] = useState(false);
  const q = (searchQuery ?? "").trim().toLowerCase();

  useEffect(() => {
    if (!q) return; // keep whatever the user had — don't auto-collapse on clear
    const manageKeywords = [
      "manage", "banner", "engine", "secret", "control", "log", "metric",
      "version", "delivery", "hosting", "summary", "build",
      (BOT_BASE_LABELS[bot.base] ?? bot.base ?? "").toLowerCase(),
      bot.base?.toLowerCase() ?? "",
    ];
    const addonTerms = Array.from(ownedAddons).flatMap((id) => [
      id.toLowerCase(),
      getAddonLabel(id).toLowerCase(),
    ]);
    const addonKeywords = [
      "add-on", "addon", "configuration", "config",
      "ticket", "say", "protection", "utilities", "utility", "extras",
      ...addonTerms,
    ];
    const inManage = manageKeywords.some((k) => k && k.includes(q));
    const inAddons = addonKeywords.some((k) => k && k.includes(q));
    setManageOpen(inManage);
    setAddonsOpen(inAddons);
  }, [q, bot.base, bot.addons.join("|")]);
  // ───────────────────────────────────────────────────────────────────────────

  const showPreorderBanner = !bot.isDemo && (bot.status === "submitted" || bot.status === "paid");
  const showReadyBanner = !bot.isDemo && bot.status === "ready" && bot.delivery_url;
  const freeActive =
    freePeriod && new Date(freePeriod.free_until).getTime() > Date.now();
  const freeUntilLabel = freeActive
    ? new Date(freePeriod!.free_until).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  const headerBadges = (
    <>
      <Badge variant="outline" className={`text-xs gap-1.5 ${statusMeta.className}`}>
        {statusMeta.loading && !bot.isDemo && <HexagonLoader size={12} />}
        {statusMeta.label}
      </Badge>
      <Badge variant="secondary" className="text-xs">
        {baseLabel}
      </Badge>
      {!bot.isDemo && (
        <Badge variant="outline" className="text-xs gap-1">
          <Code2 className="h-3 w-3" />
          Component {bot.engine_version === "v2" ? "V2" : "V1"}
        </Badge>
      )}
      {bot.monthly_hosting && (
        <Badge variant="outline" className="text-xs gap-1">
          <Server className="h-3 w-3" />
          Hosting
        </Badge>
      )}
      {freeActive && (
        <Badge
          variant="outline"
          className="text-xs gap-1 bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
        >
          <Gift className="h-3 w-3" />
          Free until {freeUntilLabel}
        </Badge>
      )}
      {bot.isDemo && (
        <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
          Practice bot
        </Badge>
      )}
      {bot.viaSupport && (
        <Badge
          variant="outline"
          className="text-xs gap-1 bg-amber-500/10 text-amber-400 border-amber-500/30"
        >
          <LifeBuoy className="h-3 w-3" />
          Support session
        </Badge>
      )}
      {!bot.isDemo && (
        <div className="basis-full mt-1">
          <BotHealthBadge botId={bot.id} />
        </div>
      )}
    </>
  );

  // Effective perms on this bot. For non-team viewers (owners, admins,
  // support sessions) this resolves to full perms.
  const { permissions: teamPerms } = useTeamRole(bot.viaTeam ? bot.id : null);
  const canEditBilling = !bot.viaTeam || teamPerms.edit_billing;


  const [leaving, setLeaving] = useState(false);
  const leaveBot = async () => {
    if (leaving) return;
    if (!window.confirm(`Leave "${bot.bot_name}"? You'll lose access to this bot's dashboard. The owner will need to re-invite you to get back in.`)) return;
    setLeaving(true);
    const { data, error } = await (supabase as any).rpc("team_leave_bot", { _bot_id: bot.id });
    setLeaving(false);
    if (error || !data?.ok) {
      toast.error(error?.message ?? data?.error ?? "Failed to leave bot");
      return;
    }
    toast.success(`You left "${bot.bot_name}"`);
    onReload();
  };

  const headerActions = !bot.isDemo ? (
    <>
      {!bot.viaTeam && canEditBilling && (
        <Button variant="outline" size="sm" onClick={() => onAddAddons(bot)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add add-ons
        </Button>
      )}
      {!bot.viaTeam && cancellable && canEditBilling && (
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
      {bot.viaTeam && (
        <Button
          variant="outline"
          size="sm"
          className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
          onClick={leaveBot}
          disabled={leaving}
        >
          <LogOut className="h-4 w-4 mr-1.5" />
          {leaving ? "Leaving…" : "Leave bot"}
        </Button>
      )}
    </>
  ) : null;

  const sectionInner = (
    <section className="space-y-5">
      <BotIdentityEditor
        bot={bot}
        onUpdated={onReload}
        badges={headerBadges}
        actions={headerActions}
        enableDiscordEdits={!bot.isDemo && !isDeploying}
      />

      {deployFailed && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm flex items-center justify-between gap-3">
          <span className="font-medium text-destructive">Deployment failed.</span>
          <Button size="sm" variant="outline" onClick={retryDeploy} disabled={retrying}>
            {retrying ? "Retrying…" : "Retry deployment"}
          </Button>
        </div>
      )}

      <details
        open={manageOpen}
        onToggle={(e) => setManageOpen((e.target as HTMLDetailsElement).open)}
        className="group rounded-xl border border-border bg-card/30 overflow-hidden"
      >
        <summary className="flex items-center justify-between gap-3 px-5 py-4 cursor-pointer list-none hover:bg-card/60 transition-smooth">
          <div className="flex items-center gap-2 text-sm">
            <Settings className="h-4 w-4 text-primary" />
            <span className="font-medium">Manage this bot</span>
            <span className="text-muted-foreground">
              · banners, engine, secrets, controls, logs
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary group-open:hidden">
            <ChevronDown className="h-3.5 w-3.5" />
            Expand
          </span>
          <span className="hidden group-open:inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground">
            <ChevronUp className="h-3.5 w-3.5" />
            Collapse
          </span>
        </summary>
        <div className="px-5 pb-5 pt-2 space-y-5 border-t border-border">

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

      {!bot.isDemo && (
        <EngineVersionSwitcher bot={bot} onReload={onReload} />
      )}

      {/* Compact build summary — collapsible (controlled, default closed) */}
      <div className="rounded-lg border border-border bg-card/40">
        <button
          type="button"
          data-readonly-allow
          onClick={(e) => {
            e.stopPropagation();
            setSummaryOpen((v) => !v);
          }}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
          aria-expanded={summaryOpen}
        >
          <div className="flex items-center gap-2 text-sm min-w-0">
            <Package className="h-4 w-4 text-primary shrink-0" />
            <span className="font-medium truncate">{baseLabel}</span>
            <span className="text-muted-foreground shrink-0">
              · {bot.addons.length} add-on{bot.addons.length === 1 ? "" : "s"}
            </span>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            {summaryOpen ? "Hide" : "Show"}
          </span>
        </button>
        {summaryOpen && (
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
        )}
      </div>




      {!bot.isDemo && !isDeploying && <BotControlsPanel botId={bot.id} isOffline={isOffline} onCommandSent={handleCommandSent} />}

      {isDeploying && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm flex items-center justify-center gap-3 ${
            deployFailed
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : isQueued
                ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                : "border-blue-500/30 bg-blue-500/10 text-blue-300"
          }`}
        >
          {deployFailed ? (
            <>
              <span className="font-medium">Deployment failed.</span>
              <Button size="sm" variant="outline" onClick={retryDeploy} disabled={retrying}>
                {retrying ? "Retrying…" : "Retry deployment"}
              </Button>
            </>
          ) : isQueued ? (
            <>
              <span className="h-2 w-2 rounded-full bg-amber-300 animate-pulse" />
              <span className="font-medium text-center">
                We're currently preparing your bot — our team is on it and you'll receive a Discord DM as soon as it's live. Thank you for your patience!
              </span>
            </>
          ) : (
            <>
              <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
              <span className="font-medium">
                Deploying your bot… this usually takes 1–2 minutes.
              </span>
            </>
          )}
        </div>
      )}

      {isOffline && !isStarting && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-center text-xs text-amber-300 font-medium">
          Bot is offline — start the bot to make changes.
        </div>
      )}

      {isStarting && (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2.5 text-center text-xs text-blue-300 font-medium flex items-center justify-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Starting… your bot will be online in ~30 seconds. You can keep editing settings.
        </div>
      )}

      {hasNoServers && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-center text-xs text-amber-300 font-medium">
          Add your bot to a server to configure these settings.
        </div>
      )}

      <div
        className={(isOffline || isDeploying) ? "space-y-5 opacity-40 pointer-events-none select-none" : "space-y-5"}
        aria-disabled={isOffline}
      >
        {!bot.isDemo && (
          <BotInviteLinkCard
            botId={bot.id}
            status={bot.status}
            onRequestBuySlot={() => {
              setHighlightSlots(true);
              setTimeout(() => setHighlightSlots(false), 4000);
            }}
          />
        )}

        {!bot.isDemo && <BotServerSlotsCard botId={bot.id} highlightBuy={highlightSlots} />}

        {!bot.isDemo && <BotUsageMetricsPanel botId={bot.id} />}
      </div>

        </div>
      </details>

      <div
        className={(isOffline || isDeploying || hasNoServers) ? "opacity-40 pointer-events-none select-none" : ""}
        aria-disabled={isOffline || hasNoServers}
      >
      <details
        open={addonsOpen && !isOffline && !hasNoServers}
        onToggle={(e) => setAddonsOpen((e.target as HTMLDetailsElement).open)}
        className="group rounded-xl border border-border bg-card/30 overflow-hidden"
      >
        <summary className="flex items-center justify-between gap-3 px-5 py-4 cursor-pointer list-none hover:bg-card/60 transition-smooth">
          <div className="flex items-center gap-2 text-sm">
            <Layers className="h-4 w-4 text-primary" />
            <span className="font-medium">Add-on configuration</span>
            <span className="text-muted-foreground">
              · tickets, say command, protection, utilities
              {totalConfigurable > 0 && ` · ${totalConfigurable} block${totalConfigurable === 1 ? "" : "s"}`}
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary group-open:hidden">
            <ChevronDown className="h-3.5 w-3.5" />
            Expand
          </span>
          <span className="hidden group-open:inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground">
            <ChevronUp className="h-3.5 w-3.5" />
            Collapse
          </span>
        </summary>
        <div className="px-5 pb-5 pt-2 space-y-5 border-t border-border">
      {!bot.isDemo && <DashboardServerSelector botId={bot.id} />}
      <div className="space-y-10">

        {totalConfigurable === 0 ? (
          <Card className="bg-card/40 border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No add-ons on this bot yet. Add one to unlock its configuration box.
            </p>
            {!bot.isDemo && canEditBilling && (
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
            return (
              <div key={group.key} className="space-y-4">
                <div className="flex items-center gap-2">
                  <GroupIcon className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                    {group.label} ({group.owned.length})
                  </h4>
                </div>
                {group.key === "shared" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    <RequestCustomFeatureCard />
                    <ReportBugCard />
                    {group.owned.map((id) => {
                      const isHighlighted = highlightedAddonId === id;
                      return (
                        <div
                          key={`${bot.id}-${id}`}
                          id={`addon-card-${bot.id}-${id}`}
                          data-addon-id={id}
                          className={`scroll-mt-28 rounded-xl transition-all ${
                            isHighlighted
                              ? "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg shadow-primary/20"
                              : ""
                          }`}
                        >
                          <Suspense fallback={<div className="h-24 rounded-xl border border-border/40 bg-card/40 animate-pulse" />}>
                            {id === "ticket-editor" ? (
                              <TicketEditorCard
                                botId={bot.id}
                                botName={bot.bot_name}
                                botAvatarUrl={bot.icon_url}
                                engineVersion={bot.engine_version}
                              />
                            ) : (
                              <AddonConfigCard
                                addonId={id}
                                botId={bot.id}
                                botName={bot.bot_name}
                                botAvatarUrl={bot.icon_url}
                                engineVersion={bot.engine_version}
                              />
                            )}

                          </Suspense>
                          {id === "giveaway-system" && (
                            <div className="mt-3">
                              <GiveawayLaunchCard botId={bot.id} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <>
                    <SortableAddonGrid
                      userId={userId}
                      botId={bot.id}
                      botName={bot.bot_name}
                      botAvatarUrl={bot.icon_url}
                      engineVersion={bot.engine_version}
                      groupKey={group.key}
                      ids={group.owned}
                      highlightedAddonId={highlightedAddonId}
                    />

                    {group.owned.includes("giveaway-system") && (
                      <GiveawayLaunchCard botId={bot.id} />
                    )}
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
        </div>
      </details>
      </div>
      {/* Team panel rendered once at the bottom of the dashboard, not per bot. */}
    </section>
  );


  if (bot.isDemo) return sectionInner;
  return (
    <ActiveGuildProvider userId={userId} botId={bot.id}>
      {sectionInner}
    </ActiveGuildProvider>
  );
};


// ============================================================================
//  Dashboard shell — sidebar of bots + views over the mountain backdrop.
//  The per-bot screen reuses <BotSection> (and every per-bot block) verbatim;
//  everything else here is the navigation / design layer.
// ============================================================================

const BG_PRESETS: { key: string; label: string; url: string | null }[] = [
  { key: "mountain", label: "Mountain", url: containers },
  { key: "dusk", label: "Dusk", url: heroBg },
  { key: "none", label: "None", url: null },
];

const LS = {
  ws: "os_ws_mode",
  onboarded: "os_onboarded",
  tour: "os_tour_seen",
  bg: "os_bg",
  order: "os_bot_order",
  groups: "os_groups",
};
const lsGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };
const lsDel = (k: string) => { try { localStorage.removeItem(k); } catch { /* ignore */ } };

const timeAgo = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); return `${d}d ago`;
};

type TourStep = { sel: string; title: string; body: string; place: "right" | "left" | "top" | "bottom" };
const TOUR_STEPS: TourStep[] = [
  { sel: '[data-tour="menu"]', title: "Your menu", body: "Jump between your bots, groups, activity, billing and settings from here.", place: "right" },
  { sel: '[data-tour="bots"]', title: "Your bots", body: "Every bot you own lives here — click one to open its full control panel.", place: "right" },
  { sel: '[data-tour="add"]', title: "Add a bot", body: "Grow your fleet anytime — build and add a new bot.", place: "bottom" },
  { sel: '[data-tour="bell"]', title: "Notifications", body: "Service alerts, billing, and team announcements land here.", place: "bottom" },
  { sel: '[data-tour="settings-nav"]', title: "Make it yours", body: "Switch solo/team, change the background, and manage your account in Settings.", place: "right" },
];

/** Spotlight tour: dims the screen except the highlighted element, with a popover. */
function TourGuide({ steps, onClose }: { steps: TourStep[]; onClose: () => void }) {
  const [i, setI] = useState(0);
  const ringRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const step = steps[i];
    if (!step) return;
    const el = document.querySelector(step.sel) as HTMLElement | null;
    const ring = ringRef.current, pop = popRef.current;
    if (!el || !ring || !pop) return;
    const b = el.getBoundingClientRect(), pad = 6;
    ring.style.top = `${b.top - pad}px`;
    ring.style.left = `${b.left - pad}px`;
    ring.style.width = `${b.width + pad * 2}px`;
    ring.style.height = `${b.height + pad * 2}px`;
    const pw = pop.offsetWidth, ph = pop.offsetHeight, gap = 14, vw = window.innerWidth, vh = window.innerHeight;
    let top: number, left: number;
    if (step.place === "right") { left = b.right + gap; top = Math.max(b.top, 16); }
    else if (step.place === "left") { left = b.left - gap - pw; top = b.top; }
    else if (step.place === "top") { top = b.top - gap - ph; left = b.left + b.width / 2 - pw / 2; }
    else { top = b.bottom + gap; left = b.left + b.width / 2 - pw / 2; }
    left = Math.max(12, Math.min(left, vw - pw - 12));
    top = Math.max(12, Math.min(top, vh - ph - 12));
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
  }, [i, steps]);

  useLayoutEffect(() => {
    const step = steps[i];
    if (!step) return;
    const el = document.querySelector(step.sel) as HTMLElement | null;
    if (el) {
      const b = el.getBoundingClientRect();
      if (b.top < 8 || b.bottom > window.innerHeight - 8) el.scrollIntoView({ block: "center" });
    }
    const raf = requestAnimationFrame(place);
    return () => cancelAnimationFrame(raf);
  }, [i, place, steps]);

  useEffect(() => {
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [place]);

  const step = steps[i];
  if (!step) return null;
  const last = i === steps.length - 1;
  const ease = "cubic-bezier(.22,1,.36,1)";
  return (
    <>
      <div className="fixed inset-0 z-[199]" />
      <div
        ref={ringRef}
        className="fixed z-[200] rounded-[14px] border-2 border-os-accent pointer-events-none"
        style={{ boxShadow: "0 0 0 9999px rgb(var(--os-ink) / 0.72)", transition: `top .42s ${ease}, left .42s ${ease}, width .42s ${ease}, height .42s ${ease}` }}
      />
      <div
        ref={popRef}
        className="fixed z-[201] max-w-[300px] rounded-[14px] border border-os-hairline/50 bg-os-surface/95 backdrop-blur-md p-4 shadow-2xl"
        style={{ transition: `top .42s ${ease}, left .42s ${ease}` }}
      >
        <div className="font-display font-extrabold text-os-heading text-[14.5px]">{step.title}</div>
        <div className="text-[12.5px] leading-relaxed text-os-body mt-1.5 mb-3.5">{step.body}</div>
        <div className="flex items-center gap-2.5">
          <span className="font-label text-[11px] text-os-faint">{i + 1} / {steps.length}</span>
          <button className="ml-auto text-[11.5px] text-os-faint hover:text-os-heading" onClick={onClose}>Skip</button>
          {i > 0 && (
            <button className="rounded-[10px] border border-os-hairline px-3.5 py-2 text-[12.5px] font-semibold text-os-heading hover:bg-os-surface-2" onClick={() => setI(i - 1)}>Back</button>
          )}
          <button className="rounded-[10px] bg-os-accent px-3.5 py-2 text-[12.5px] font-semibold text-os-accent-ink hover:brightness-105" onClick={() => (last ? onClose() : setI(i + 1))}>
            {last ? "Done" : "Next"}
          </button>
        </div>
      </div>
    </>
  );
}

/** First-run owner screen: choose solo vs team over the mountain backdrop. */
function OnboardingOverlay({ name, transfer, onChoose }: { name: string; transfer?: boolean; onChoose: (mode: "solo" | "team") => void }) {
  const [picked, setPicked] = useState<"solo" | "team" | null>(null);
  return (
    <div className="fixed inset-0 z-[120] grid place-items-center p-6 bg-os-ink/55 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-[560px] rounded-[22px] border border-os-hairline/40 bg-os-surface/80 backdrop-blur-xl p-9 text-center shadow-2xl">
        <div className="font-display font-extrabold text-os-heading text-[18px]">
          Oversite
          <span className="block mt-1 font-label text-[10px] tracking-[0.2em] text-os-faint">BOT DASHBOARD</span>
        </div>
        <h1 className="font-display font-extrabold text-os-heading tracking-tight text-[clamp(24px,3.4vw,30px)] leading-tight mt-5">
          {transfer ? "These bots are now yours" : `Let's get you set up, ${name}`}
        </h1>
        <p className="text-[13.5px] leading-relaxed text-os-body mt-3">
          {transfer
            ? "You're the new owner. Choose how you want to run them — you can change it anytime."
            : "Your bots are ready. Choose how you want to run them — you can change it anytime."}
        </p>
        <div className="font-display font-bold text-[10.5px] tracking-[0.14em] uppercase text-os-faint mt-7 mb-3.5">How do you want to run them?</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-left">
          {([
            { id: "solo", icon: <Bot className="h-5 w-5" />, title: "Just me", desc: "Private — only you can see and manage the bots." },
            { id: "team", icon: <Users className="h-5 w-5" />, title: "With my team", desc: "Invite people, assign roles, and post announcements." },
          ] as const).map((o) => {
            const sel = picked === o.id;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => setPicked(o.id)}
                className={`relative rounded-2xl border p-[18px] text-left transition-all ${sel ? "border-os-accent bg-os-accent/10" : "border-os-hairline/60 bg-os-ink/40 hover:-translate-y-0.5 hover:border-os-accent/50"}`}
              >
                <span className={`absolute top-3.5 right-3.5 grid h-[18px] w-[18px] place-items-center rounded-full border ${sel ? "border-os-accent bg-os-accent text-os-accent-ink" : "border-os-hairline"}`}>
                  {sel && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                </span>
                <span className={`grid h-[42px] w-[42px] place-items-center rounded-xl mb-3 ${sel ? "bg-os-accent text-os-accent-ink" : "bg-os-ink/60 text-os-accent"}`}>{o.icon}</span>
                <div className="font-display font-bold text-os-heading text-[15px]">{o.title}</div>
                <div className="text-[11.5px] leading-snug text-os-faint mt-1.5">{o.desc}</div>
              </button>
            );
          })}
        </div>
        <button
          disabled={!picked}
          onClick={() => picked && onChoose(picked)}
          className="w-full mt-5 rounded-[13px] bg-os-accent py-3.5 font-semibold text-[14px] text-os-accent-ink transition disabled:opacity-40 enabled:hover:brightness-105"
        >
          Continue
        </button>
        <div className="text-[11.5px] text-os-faint mt-3.5">You can switch this anytime in Dashboard → Settings → Workspace.</div>
      </div>
    </div>
  );
}

type Group = { id: string; name: string; botIds: string[] };

const BotDashboard = () => {
  const { user, isAdmin, loading } = useAuth();
  const { dashboardBots, hasDashboardAccess, loading: botsLoading, reload } = useOwnedBots();
  useHostingSubscriptionSync();
  const { periods: freePeriods, reload: reloadFreePeriods } = useBotFreePeriods();
  const { items: notifications, unread } = useBotNotifications();
  const navigate = useNavigate();

  const [view, setView] = useState<string>("home");
  const [botId, setBotId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<OwnedBot | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [addonsTarget, setAddonsTarget] = useState<OwnedBot | null>(null);
  const [search, setSearch] = useState("");

  // ── Workspace mode / onboarding / tour / appearance (localStorage) ──────────
  const isOwner = useMemo(
    () => dashboardBots.some((b) => !b.isDemo && !b.viaTeam && !b.viaSupport),
    [dashboardBots],
  );
  const [wsMode, setWsMode] = useState<"solo" | "team">(() => (lsGet(LS.ws) === "team" ? "team" : "solo"));
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeTransfer, setWelcomeTransfer] = useState(false);
  const [askTour, setAskTour] = useState(false);
  const [tourOn, setTourOn] = useState(false);
  const [bgKey, setBgKey] = useState<string>(() => lsGet(LS.bg) || "mountain");
  const bgUrl = BG_PRESETS.find((p) => p.key === bgKey)?.url ?? null;

  // Decide whether to show the first-run welcome (owner + not yet onboarded).
  useEffect(() => {
    if (loading || botsLoading || !user) return;
    if (isOwner && !lsGet(LS.onboarded)) {
      setShowWelcome(true);
    } else if (!lsGet(LS.tour)) {
      const t = setTimeout(() => setAskTour(true), 900);
      return () => clearTimeout(t);
    }
  }, [loading, botsLoading, user, isOwner]);

  const chooseMode = (mode: "solo" | "team") => {
    setWsMode(mode);
    lsSet(LS.ws, mode);
    lsSet(LS.onboarded, "1");
    setShowWelcome(false);
    setWelcomeTransfer(false);
    if (!lsGet(LS.tour)) setTimeout(() => setAskTour(true), 700);
  };

  // ── Bot ordering (drag to reorder) ──────────────────────────────────────────
  const botIdsKey = dashboardBots.map((b) => b.id).join(",");
  const [order, setOrder] = useState<string[]>([]);
  useEffect(() => {
    let saved: string[] = [];
    try { saved = JSON.parse(lsGet(LS.order) || "[]"); } catch { saved = []; }
    const ids = dashboardBots.map((b) => b.id);
    const merged = [...saved.filter((id) => ids.includes(id)), ...ids.filter((id) => !saved.includes(id))];
    setOrder(merged);
  }, [botIdsKey]);
  useEffect(() => { if (order.length) lsSet(LS.order, JSON.stringify(order)); }, [order]);

  const byId = useMemo(() => {
    const m: Record<string, OwnedBot> = {};
    dashboardBots.forEach((b) => { m[b.id] = b; });
    return m;
  }, [dashboardBots]);
  const orderedBots = useMemo(() => order.map((id) => byId[id]).filter(Boolean) as OwnedBot[], [order, byId]);

  const dragId = useRef<string | null>(null);
  const onDragStart = (id: string) => { dragId.current = id; };
  const onDragOver = (e: React.DragEvent, overId: string) => {
    e.preventDefault();
    const from = dragId.current;
    if (!from || from === overId) return;
    setOrder((prev) => {
      const a = [...prev];
      const fi = a.indexOf(from), oi = a.indexOf(overId);
      if (fi < 0 || oi < 0) return prev;
      a.splice(fi, 1); a.splice(oi, 0, from);
      return a;
    });
  };
  const onDragEnd = () => { dragId.current = null; };

  // ── Groups (local-only preview until a backend table exists) ────────────────
  const [groups, setGroups] = useState<Group[]>(() => { try { return JSON.parse(lsGet(LS.groups) || "[]"); } catch { return []; } });
  useEffect(() => { lsSet(LS.groups, JSON.stringify(groups)); }, [groups]);
  const addGroup = () => {
    const name = window.prompt("Name this group (e.g. Community Server)");
    if (!name?.trim()) return;
    setGroups((g) => [...g, { id: `g_${Date.now()}`, name: name.trim(), botIds: [] }]);
  };
  const toggleBotInGroup = (gid: string, bid: string) => {
    setGroups((gs) => gs.map((g) => g.id === gid
      ? { ...g, botIds: g.botIds.includes(bid) ? g.botIds.filter((x) => x !== bid) : [...g.botIds, bid] }
      : g));
  };
  const removeGroup = (gid: string) => setGroups((gs) => gs.filter((g) => g.id !== gid));

  const cancelOrder = async (bot: OwnedBot) => {
    if (!user) return;
    setCancelling(true);
    const { error } = await (supabase as any)
      .from("bot_orders").update({ status: "cancelled" }).eq("id", bot.id).eq("user_id", user.id);
    setCancelling(false);
    if (error) { toast.error("Couldn't cancel — " + error.message); return; }
    toast.success(`Cancelled "${bot.bot_name}"`);
    setCancelTarget(null);
    reload();
  };

  const openBot = (id: string) => { setBotId(id); setView("bot"); window.scrollTo({ top: 0 }); };
  const go = (v: string) => { setView(v); window.scrollTo({ top: 0 }); };

  const openPortal = async () => {
    const { data, error } = await supabase.functions.invoke("customer-portal");
    if (error) { toast.error("Couldn't open billing portal", { description: error.message }); return; }
    const url = (data as { url?: string } | null)?.url;
    if (url) window.location.href = url; else toast.error("No billing portal available yet.");
  };

  const signOut = async () => { await supabase.auth.signOut(); navigate("/auth", { replace: true }); };

  useEffect(() => {
    if (loading) return;
    if (!user) navigate("/auth", { replace: true });
  }, [user, loading, navigate]);

  if (loading || botsLoading) {
    return <div className="min-h-screen bg-background grid place-items-center text-muted-foreground">Loading...</div>;
  }
  if (!user) return null;

  const hasAccess = isAdmin || hasDashboardAccess;
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background grid place-items-center px-4">
        <div className="max-w-md text-center space-y-5">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 border border-primary/20 grid place-items-center">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Web Dashboard not enabled</h1>
          <p className="text-muted-foreground">
            The <span className="text-foreground font-medium">Web Dashboard</span> add-on unlocks bot management from this site.
            Without it, you can still configure your bot in Discord with{" "}
            <code className="text-foreground bg-muted px-1.5 py-0.5 rounded text-sm">/cmds</code>.
          </p>
          <div className="flex gap-3 justify-center">
            <Button asChild><Link to="/bots"><Globe className="h-4 w-4 mr-2" />Add Web Dashboard</Link></Button>
            <Button variant="outline" asChild><Link to="/">Back to site</Link></Button>
          </div>
        </div>
      </div>
    );
  }

  const owned = dashboardBots.filter((b) => !b.isDemo);
  const liveCount = owned.filter((b) => b.status === "live" || b.status === "ready").length;
  const activeBot = botId ? byId[botId] : null;
  const firstOwned = dashboardBots.find((b) => !b.isDemo && !b.viaTeam && !b.viaSupport);

  const NAV: { key: string; label: string; icon: React.ReactNode; teamOnly?: boolean; tour?: string }[] = [
    { key: "home", label: "Overview", icon: <Home className="h-[17px] w-[17px]" /> },
    { key: "bots", label: "My Bots", icon: <LayoutGrid className="h-[17px] w-[17px]" /> },
    { key: "groups", label: "Groups", icon: <Network className="h-[17px] w-[17px]" /> },
    { key: "activity", label: "Activity", icon: <ActivityIcon className="h-[17px] w-[17px]" /> },
    { key: "billing", label: "Billing", icon: <CreditCard className="h-[17px] w-[17px]" /> },
    { key: "team", label: "Team", icon: <Users className="h-[17px] w-[17px]" />, teamOnly: true },
    { key: "settings", label: "Settings", icon: <Settings className="h-[17px] w-[17px]" />, tour: "settings-nav" },
    { key: "support", label: "Support", icon: <LifeBuoy className="h-[17px] w-[17px]" /> },
  ];

  const titleFor = (v: string): [string, string] => ({
    home: ["Overview", `${owned.length} bot${owned.length === 1 ? "" : "s"} · ${liveCount} live`],
    bots: ["My Bots", `${owned.length} bot${owned.length === 1 ? "" : "s"} in your fleet`],
    groups: ["Groups", "Bundle bots and share access"],
    activity: ["Activity", "Live event stream"],
    billing: ["Billing", "Plan, invoices & payment"],
    team: ["Team", "Manage who can access your bots"],
    settings: ["Settings", "Account, workspace & appearance"],
    support: ["Support", "We're here to help"],
    bot: [activeBot?.bot_name ?? "Bot", "Bot control panel"],
  }[v] ?? ["Dashboard", ""]);
  const [pageTitle, pageSub] = titleFor(view);

  const botAvatar = (b: OwnedBot, size = "h-9 w-9") =>
    b.icon_url ? (
      <img src={b.icon_url} alt="" className={`${size} rounded-xl object-cover`} />
    ) : (
      <span className={`${size} grid place-items-center rounded-xl bg-os-ink/60 text-os-accent font-display font-extrabold`}>
        {b.bot_name?.[0]?.toUpperCase() ?? "B"}
      </span>
    );
  const statusDot = (b: OwnedBot) => {
    const live = b.status === "live" || b.status === "ready";
    return <span className={`inline-block h-1.5 w-1.5 rounded-full ${live ? "bg-emerald-400" : "bg-os-faint"}`} />;
  };

  const CARD = "rounded-2xl border border-os-hairline/40 bg-os-surface/70 backdrop-blur-md";

  return (
    <div className="oversite-theme relative min-h-screen text-os-body font-body bg-os-bg">
      {/* backdrop */}
      {bgUrl && (
        <div className="fixed inset-0 -z-20 bg-cover" style={{ backgroundImage: `url(${bgUrl})`, backgroundPosition: "center 20%" }} />
      )}
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-os-ink/80 via-os-ink/90 to-os-ink/95" />

      <div className="flex min-h-screen">
        {/* ───────── Sidebar ───────── */}
        <aside data-tour="menu" className="hidden md:flex w-[236px] flex-none flex-col gap-1.5 p-3.5 sticky top-0 h-screen overflow-y-auto bg-os-ink-2/70 backdrop-blur-xl border-r border-os-hairline/30 [scrollbar-width:none]">
          <div className="px-2 pb-3.5 mb-1 border-b border-os-hairline/30">
            <div className="font-display font-extrabold text-os-heading text-[15px] leading-none">Oversite</div>
            <div className="font-label text-[9px] tracking-[0.18em] text-os-faint mt-1.5">BOT DASHBOARD</div>
          </div>

          <div className="font-display text-[9.5px] font-bold tracking-[0.16em] uppercase text-os-faint px-2.5 pt-1 pb-1">Menu</div>
          {NAV.filter((n) => !n.teamOnly || wsMode === "team").map((n) => (
            <button
              key={n.key}
              data-tour={n.tour}
              onClick={() => go(n.key)}
              className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13.5px] transition ${view === n.key ? "bg-os-surface-2 text-os-heading font-semibold" : "text-os-body hover:bg-os-surface hover:text-os-heading"}`}
            >
              {n.icon}{n.label}
              {n.key === "activity" && unread > 0 && (
                <span className="ml-auto rounded-md bg-os-accent px-1.5 text-[10px] font-bold text-os-accent-ink">{unread}</span>
              )}
            </button>
          ))}

          <div data-tour="bots" className="font-display text-[9.5px] font-bold tracking-[0.16em] uppercase text-os-faint px-2.5 pt-3 pb-1">Your bots</div>
          <div className="flex flex-col gap-1">
            {orderedBots.filter((b) => !b.isDemo).map((b) => (
              <button
                key={b.id}
                draggable
                onDragStart={() => onDragStart(b.id)}
                onDragOver={(e) => onDragOver(e, b.id)}
                onDragEnd={onDragEnd}
                onClick={() => openBot(b.id)}
                title={b.bot_name}
                className={`flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-[13px] cursor-grab active:cursor-grabbing transition ${view === "bot" && botId === b.id ? "bg-os-surface-2 text-os-heading" : "text-os-body hover:bg-os-surface hover:text-os-heading"}`}
              >
                {botAvatar(b, "h-7 w-7")}
                <span className="truncate">{b.bot_name}</span>
                <span className="ml-auto">{statusDot(b)}</span>
              </button>
            ))}
            {owned.length === 0 && <div className="px-2.5 py-2 text-[12px] text-os-faint">No bots yet.</div>}
          </div>

          {wsMode === "team" && (
            <div className="mt-auto rounded-2xl border border-os-hairline/40 bg-os-surface/60 p-3.5">
              <div className="flex items-center gap-2 mb-2.5">
                <Megaphone className="h-3.5 w-3.5 text-os-accent" />
                <span className="font-display text-[9.5px] font-bold tracking-[0.14em] uppercase text-os-heading">Announcements</span>
              </div>
              <div className="border-l-2 border-os-accent pl-2.5">
                <div className="font-display font-bold text-os-heading text-[12.5px] leading-tight">Welcome to the team</div>
                <div className="text-[11px] text-os-faint leading-snug mt-1">Post updates here for everyone with dashboard access.</div>
              </div>
              <button onClick={() => go("team")} className="mt-3 w-full rounded-lg border border-os-hairline bg-os-ink/50 py-2 text-[11.5px] font-semibold text-os-heading hover:bg-os-surface-2 flex items-center justify-center gap-1.5">
                <Plus className="h-3 w-3" /> Manage team
              </button>
            </div>
          )}

          <button onClick={signOut} className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13.5px] text-os-body hover:bg-os-surface hover:text-os-heading ${wsMode === "team" ? "mt-3" : "mt-auto"}`}>
            <LogOut className="h-[17px] w-[17px]" /> Sign out
          </button>
        </aside>

        {/* ───────── Main ───────── */}
        <main className="flex-1 min-w-0 px-5 md:px-7 py-6 pb-16">
          {/* header */}
          <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
            <div>
              <div className="text-[12px] text-os-faint">
                Oversite / <span className="text-os-heading font-medium">{pageTitle}</span>
              </div>
              <h1 className="font-display font-extrabold text-os-heading tracking-tight text-[clamp(24px,3vw,34px)] leading-none mt-2">{pageTitle}</h1>
              {pageSub && <div className="text-[12.5px] text-os-faint mt-2">{pageSub}</div>}
            </div>
            <div className="flex items-center gap-2.5">
              <div className="hidden sm:flex items-center gap-2 rounded-xl border border-os-hairline/50 bg-os-ink/50 px-3 py-2 text-[13px] text-os-faint">
                <Search className="h-[15px] w-[15px]" />
                <input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); if (e.target.value) go("bots"); }}
                  placeholder="Search bots…"
                  className="bg-transparent outline-none placeholder:text-os-faint text-os-body w-[120px]"
                />
              </div>
              <button data-tour="bell" onClick={() => go("activity")} className="relative grid h-10 w-10 place-items-center rounded-xl border border-os-hairline/50 bg-os-ink/50 text-os-body hover:text-os-heading">
                <Bell className="h-[17px] w-[17px]" />
                {unread > 0 && <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-os-accent" />}
              </button>
              <Button data-tour="add" asChild className="rounded-xl">
                <Link to="/bots"><Plus className="h-4 w-4 mr-1.5" />Add a bot</Link>
              </Button>
            </div>
          </div>

          <FixesBar />
          <HostingPastDueBanner />

          {/* ───────── Views ───────── */}
          {view === "home" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { k: "Bots", v: String(owned.length) },
                  { k: "Live now", v: String(liveCount) },
                  { k: "Unread alerts", v: String(unread) },
                  { k: "Workspace", v: wsMode === "team" ? "Team" : "Solo" },
                ].map((s) => (
                  <div key={s.k} className={`${CARD} p-4`}>
                    <div className="font-display text-[10px] tracking-[0.08em] uppercase text-os-faint">{s.k}</div>
                    <div className="font-display font-extrabold text-os-heading text-[26px] mt-1.5">{s.v}</div>
                  </div>
                ))}
              </div>

              <div className="grid lg:grid-cols-3 gap-5 items-start">
                <div className={`${CARD} p-5 lg:col-span-2`}>
                  <div className="flex items-center justify-between mb-3.5">
                    <span className="font-display font-bold text-os-heading text-[14.5px]">Your bots</span>
                    <button onClick={() => go("bots")} className="text-[12px] text-os-accent flex items-center gap-1">View all <ChevronRight className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className="divide-y divide-os-hairline/30">
                    {owned.slice(0, 5).map((b) => (
                      <button key={b.id} onClick={() => openBot(b.id)} className="w-full flex items-center gap-3 py-2.5 text-left hover:opacity-90">
                        {botAvatar(b)}
                        <div className="min-w-0">
                          <div className="font-display font-semibold text-os-heading text-[13.5px] truncate">{b.bot_name}</div>
                          <div className="text-[11px] text-os-faint flex items-center gap-1.5">{statusDot(b)}{getStatusMeta(b.status).label}</div>
                        </div>
                        <ChevronRight className="ml-auto h-4 w-4 text-os-faint" />
                      </button>
                    ))}
                    {owned.length === 0 && <div className="py-6 text-center text-[13px] text-os-faint">No bots yet — add one to get started.</div>}
                  </div>
                </div>

                <div className={`${CARD} p-5`}>
                  <div className="font-display font-bold text-os-heading text-[14.5px] mb-3.5">Recent activity</div>
                  <div className="space-y-3">
                    {notifications.slice(0, 5).map((n: BotNotification) => (
                      <div key={n.id} className="flex gap-2.5">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-os-accent flex-none" />
                        <div className="min-w-0">
                          <div className="text-[12.5px] text-os-heading font-medium truncate">{n.title}</div>
                          <div className="text-[11px] text-os-faint">{timeAgo(n.created_at)}</div>
                        </div>
                      </div>
                    ))}
                    {notifications.length === 0 && <div className="text-[12.5px] text-os-faint">You're all caught up.</div>}
                  </div>
                </div>
              </div>

              <RedeemFreeCodeBox bots={dashboardBots} onRedeemed={() => { reloadFreePeriods(); reload(); }} />
            </div>
          )}

          {view === "bots" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
              {orderedBots
                .filter((b) => !b.isDemo && (!search.trim() || b.bot_name?.toLowerCase().includes(search.trim().toLowerCase())))
                .map((b) => (
                  <div
                    key={b.id}
                    draggable
                    onDragStart={() => onDragStart(b.id)}
                    onDragOver={(e) => onDragOver(e, b.id)}
                    onDragEnd={onDragEnd}
                    onClick={() => openBot(b.id)}
                    className={`${CARD} p-[18px] flex flex-col min-h-[262px] cursor-grab active:cursor-grabbing hover:-translate-y-0.5 hover:border-os-accent/35 transition`}
                  >
                    {botAvatar(b, "h-[46px] w-[46px]")}
                    <div className="font-display font-bold text-os-heading text-[16px] mt-3.5">{b.bot_name}</div>
                    <div className="text-[11px] mt-1 flex items-center gap-1.5">{statusDot(b)}<span className="text-os-faint">{getStatusMeta(b.status).label}</span></div>
                    <div className="flex flex-col gap-2 my-4">
                      <div className="flex items-center justify-between rounded-[10px] border border-os-hairline/40 bg-os-ink/40 px-3 py-2">
                        <span className="text-[11px] text-os-faint">Base</span>
                        <span className="font-display font-bold text-os-heading text-[13px]">{BOT_BASE_LABELS[b.base] ?? b.base}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-[10px] border border-os-hairline/40 bg-os-ink/40 px-3 py-2">
                        <span className="text-[11px] text-os-faint">Add-ons</span>
                        <span className="font-display font-bold text-os-heading text-[13px]">{b.addons.length}</span>
                      </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); openBot(b.id); }} className="mt-auto rounded-[11px] border border-os-hairline bg-os-ink/50 py-2.5 font-semibold text-[13px] text-os-heading hover:bg-os-surface-2">Open</button>
                  </div>
                ))}
              <Link to="/bots" className="rounded-2xl border-[1.5px] border-dashed border-os-hairline grid place-items-center min-h-[262px] text-os-faint hover:border-os-accent hover:text-os-heading transition">
                <div className="flex flex-col items-center gap-2.5"><Plus className="h-6 w-6" /><span className="text-[13px]">Add a bot</span></div>
              </Link>
            </div>
          )}

          {view === "bot" && activeBot && (
            <div className="space-y-5">
              <button onClick={() => go("bots")} className="inline-flex items-center gap-1.5 text-[12px] text-os-faint hover:text-os-heading">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to my bots
              </button>
              <ReadOnlyBotScope botId={activeBot.id} ownerUserId={activeBot.ownerUserId} viaTeam={activeBot.viaTeam}>
                <BotSection
                  bot={activeBot}
                  allBots={dashboardBots}
                  userId={user.id}
                  ownerEmail={user.email}
                  freePeriod={freePeriods[activeBot.id]}
                  onCancel={setCancelTarget}
                  onAddAddons={setAddonsTarget}
                  searchQuery={search}
                  highlightedAddonId={null}
                  onReload={() => { reload(); reloadFreePeriods(); }}
                />
              </ReadOnlyBotScope>
            </div>
          )}

          {view === "groups" && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={addGroup} className="rounded-xl"><Plus className="h-4 w-4 mr-1.5" />New group</Button>
              </div>
              {groups.length === 0 && (
                <div className={`${CARD} p-8 text-center text-[13px] text-os-faint`}>
                  No groups yet. Bundle bots from a server together, then give a team access to just that bundle.
                </div>
              )}
              {groups.map((g) => (
                <div key={g.id} className={`${CARD} p-[18px]`}>
                  <div className="flex items-center gap-3 border-b border-os-hairline/40 pb-3.5 mb-4">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-os-ink/60 text-os-accent"><Network className="h-4 w-4" /></span>
                    <div>
                      <div className="font-display font-bold text-os-heading text-[15px]">{g.name}</div>
                      <div className="text-[11.5px] text-os-faint">{g.botIds.length} bot{g.botIds.length === 1 ? "" : "s"}</div>
                    </div>
                    <button onClick={() => removeGroup(g.id)} className="ml-auto text-[12px] text-os-faint hover:text-destructive">Remove</button>
                  </div>
                  <div className="font-display text-[10px] tracking-[0.12em] uppercase text-os-faint mb-2.5">Bots in this group</div>
                  <div className="flex flex-wrap gap-2">
                    {owned.map((b) => {
                      const inG = g.botIds.includes(b.id);
                      return (
                        <button
                          key={b.id}
                          onClick={() => toggleBotInGroup(g.id, b.id)}
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px] transition ${inG ? "border-os-accent bg-os-accent/10 text-os-heading" : "border-os-hairline/60 border-dashed text-os-faint hover:text-os-heading"}`}
                        >
                          {inG ? <Check className="h-3.5 w-3.5 text-os-accent" /> : <Plus className="h-3.5 w-3.5" />}
                          {b.bot_name}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-4 text-[11.5px] text-os-faint">
                    Team access for this group is managed from the <button onClick={() => go("team")} className="text-os-accent underline-offset-2 hover:underline">Team</button> panel.
                  </div>
                </div>
              ))}
            </div>
          )}

          {view === "activity" && (
            <div className={`${CARD} overflow-hidden`}>
              {notifications.length === 0 && <div className="p-8 text-center text-[13px] text-os-faint">No activity yet.</div>}
              {notifications.map((n: BotNotification) => (
                <div key={n.id} className="flex gap-3 p-4 border-t border-os-hairline/30 first:border-t-0">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-os-accent flex-none" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] text-os-heading font-medium">{n.title}</div>
                    {n.body && <div className="text-[12px] text-os-faint mt-0.5">{n.body}</div>}
                  </div>
                  <span className="font-label text-[11px] text-os-faint whitespace-nowrap">{timeAgo(n.created_at)}</span>
                </div>
              ))}
            </div>
          )}

          {view === "billing" && (
            <div className={`${CARD} p-6 max-w-xl`}>
              <div className="font-display font-bold text-os-heading text-[15px] mb-1">Billing &amp; payments</div>
              <p className="text-[13px] text-os-faint mb-5">Manage your subscription, payment method, and invoices in the secure billing portal.</p>
              <Button onClick={openPortal} className="rounded-xl"><CreditCard className="h-4 w-4 mr-1.5" />Open billing portal</Button>
            </div>
          )}

          {view === "team" && firstOwned && (
            <TeamManagementHub botId={firstOwned.id} ownerUserId={user.id} ownerEmail={user.email ?? null} />
          )}
          {view === "team" && !firstOwned && (
            <div className={`${CARD} p-8 text-center text-[13px] text-os-faint`}>You need an owned bot to manage a team.</div>
          )}

          {view === "settings" && (
            <div className="space-y-5 max-w-3xl">
              <div className={`${CARD} p-[18px]`}>
                <div className="font-display font-bold text-os-heading text-[14.5px] mb-1">Workspace</div>
                <p className="text-[12.5px] text-os-faint mb-3.5">Switching to team unlocks members, roles, and announcements.</p>
                <div className="grid grid-cols-2 gap-3">
                  {(["solo", "team"] as const).map((m) => (
                    <button key={m} onClick={() => { setWsMode(m); lsSet(LS.ws, m); }} className={`rounded-xl border p-4 text-left transition ${wsMode === m ? "border-os-accent bg-os-accent/10" : "border-os-hairline bg-os-ink/40"}`}>
                      <div className="font-display font-bold text-os-heading text-[14px] flex items-center justify-between">
                        {m === "solo" ? "Just me" : "With my team"}
                        <span className={`grid h-4 w-4 place-items-center rounded-full border ${wsMode === m ? "border-os-accent bg-os-accent text-os-accent-ink" : "border-os-hairline"}`}>{wsMode === m && <Check className="h-2.5 w-2.5" strokeWidth={3} />}</span>
                      </div>
                      <div className="text-[11.5px] text-os-faint mt-1.5">{m === "solo" ? "Private. Only you can manage the bots." : "Invite people, assign roles, broadcast announcements."}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className={`${CARD} p-[18px]`}>
                <div className="font-display font-bold text-os-heading text-[14.5px] mb-1 flex items-center gap-2"><ImageIcon className="h-4 w-4 text-os-accent" />Appearance</div>
                <p className="text-[12.5px] text-os-faint mb-3.5">Pick the dashboard background.</p>
                <div className="grid grid-cols-3 gap-2.5">
                  {BG_PRESETS.map((p) => (
                    <button
                      key={p.key}
                      onClick={() => { setBgKey(p.key); lsSet(LS.bg, p.key); }}
                      className={`relative h-[78px] rounded-xl border-[1.5px] overflow-hidden bg-cover bg-center ${bgKey === p.key ? "border-os-accent" : "border-os-hairline"}`}
                      style={p.url ? { backgroundImage: `url(${p.url})`, backgroundPosition: "center 22%" } : { backgroundImage: "repeating-linear-gradient(45deg, rgb(var(--os-surface-2)) 0 8px, rgb(var(--os-ink)) 8px 16px)" }}
                    >
                      {bgKey === p.key && <span className="absolute top-1.5 right-1.5 grid h-[18px] w-[18px] place-items-center rounded-full bg-os-accent text-os-accent-ink"><Check className="h-2.5 w-2.5" strokeWidth={3} /></span>}
                      <span className="absolute inset-x-0 bottom-0 px-2 py-1 font-display text-[10.5px] font-bold text-os-heading bg-gradient-to-t from-os-ink/80 to-transparent">{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className={`${CARD} p-[18px]`}>
                <div className="font-display font-bold text-os-heading text-[14.5px] mb-1">Notifications</div>
                <p className="text-[12.5px] text-os-faint">Configure Discord DM alerts (offline, errors, free-period) per bot inside each bot's panel.</p>
              </div>

              <div className={`${CARD} p-[18px]`}>
                <div className="font-display font-bold text-os-heading text-[14.5px] mb-1">Replay onboarding</div>
                <p className="text-[12.5px] text-os-faint mb-3.5">See the welcome and the guided tour again.</p>
                <div className="flex gap-2.5">
                  <button onClick={() => { lsDel(LS.onboarded); setWelcomeTransfer(false); setShowWelcome(true); }} className="rounded-lg border border-os-hairline bg-os-ink/50 px-3.5 py-2 text-[12.5px] font-semibold text-os-heading hover:bg-os-surface-2">↺ Welcome screen</button>
                  <button onClick={() => { lsDel(LS.tour); setTourOn(true); go("home"); }} className="rounded-lg border border-os-hairline bg-os-ink/50 px-3.5 py-2 text-[12.5px] font-semibold text-os-heading hover:bg-os-surface-2">↺ Dashboard tour</button>
                </div>
              </div>
            </div>
          )}

          {view === "support" && (
            <div className="grid md:grid-cols-2 gap-5 max-w-3xl">
              <div className={`${CARD} p-[18px]`}>
                <div className="font-display font-bold text-os-heading text-[14.5px] mb-2">Contact us</div>
                <p className="text-[12.5px] text-os-faint leading-relaxed mb-3.5">Email <span className="text-os-accent">support@oversite.shop</span> or open a ticket in our Discord. Include your bot ID for the fastest help.</p>
                <button onClick={() => { lsDel(LS.tour); setTourOn(true); go("home"); }} className="w-full rounded-lg border border-os-hairline bg-os-ink/50 py-2.5 text-[12.5px] font-semibold text-os-heading hover:bg-os-surface-2">↺ Replay dashboard tour</button>
              </div>
              <div className={`${CARD} p-[18px]`}>
                <RequestCustomFeatureCard />
              </div>
            </div>
          )}
        </main>
      </div>

      {/* one team panel for new-owner billing dialog handoff */}
      <NewOwnerBillingDialog forceOpen={new URLSearchParams(window.location.search).get("team_transfer") === "accepted"} />

      {/* onboarding + tour */}
      {showWelcome && <OnboardingOverlay name={user.email?.split("@")[0] ?? "there"} transfer={welcomeTransfer} onChoose={chooseMode} />}
      {askTour && !tourOn && (
        <div className="fixed bottom-5 right-5 z-[150] w-[300px] rounded-2xl border border-os-hairline/40 bg-os-surface/95 backdrop-blur-md p-[18px] shadow-2xl">
          <div className="font-display font-extrabold text-os-heading text-[15px]">Welcome in</div>
          <div className="text-[12.5px] text-os-body leading-relaxed mt-2 mb-3.5">Want a quick tour of your dashboard?</div>
          <div className="flex gap-2.5">
            <button onClick={() => { setAskTour(false); setTourOn(true); go("home"); }} className="flex-1 rounded-[10px] bg-os-accent py-2.5 text-[12.5px] font-bold text-os-accent-ink hover:brightness-105">Show me around</button>
            <button onClick={() => { setAskTour(false); lsSet(LS.tour, "1"); }} className="rounded-[10px] border border-os-hairline px-3.5 py-2.5 text-[12.5px] font-bold text-os-heading hover:bg-os-surface-2">Maybe later</button>
          </div>
        </div>
      )}
      {tourOn && <TourGuide steps={TOUR_STEPS} onClose={() => { setTourOn(false); lsSet(LS.tour, "1"); }} />}

      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && !cancelling && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel subscription for "{cancelTarget?.bot_name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This is a full shutdown for this bot — all recurring payments and hosting stop, the bot goes offline,
              and it's removed from your dashboard. This can't be undone, but you can always build a new bot later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Keep subscription</AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); if (cancelTarget) cancelOrder(cancelTarget); }}
            >
              {cancelling ? "Cancelling…" : "Yes, cancel subscription"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AddAddonsDialog bot={addonsTarget} open={!!addonsTarget} onOpenChange={(o) => !o && setAddonsTarget(null)} />
    </div>
  );
};

export default BotDashboard;
