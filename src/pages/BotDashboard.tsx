import { lazy, Suspense, useEffect, useRef, useState } from "react";
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
  
  
} from "lucide-react";
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
                            <AddonConfigCard
                              addonId={id}
                              botId={bot.id}
                              botName={bot.bot_name}
                              botAvatarUrl={bot.icon_url}
                              engineVersion={bot.engine_version}
                            />

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


const BotDashboard = () => {
  const { user, isAdmin, loading } = useAuth();
  const { dashboardBots, hasDashboardAccess, loading: botsLoading, reload } = useOwnedBots();
  useHostingSubscriptionSync();
  const { periods: freePeriods, reload: reloadFreePeriods } = useBotFreePeriods();
  const navigate = useNavigate();
  const [cancelTarget, setCancelTarget] = useState<OwnedBot | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [addonsTarget, setAddonsTarget] = useState<OwnedBot | null>(null);
  const [search, setSearch] = useState("");

  // Find the best match: prefer a specific add-on, fall back to bot-level.
  const { matchedBotId, matchedAddonId } = (() => {
    const q = search.trim().toLowerCase();
    if (!q) return { matchedBotId: null as string | null, matchedAddonId: null as string | null };
    for (const b of dashboardBots) {
      const addonHit = b.addons?.find(
        (a) =>
          a.toLowerCase().includes(q) ||
          getAddonLabel(a).toLowerCase().includes(q),
      );
      if (addonHit) return { matchedBotId: b.id, matchedAddonId: addonHit };
    }
    const botHit = dashboardBots.find(
      (b) =>
        b.bot_name?.toLowerCase().includes(q) ||
        b.base?.toLowerCase().includes(q),
    );
    return { matchedBotId: botHit?.id ?? null, matchedAddonId: null };
  })();

  // Scroll to the matching add-on card (preferred) or bot section as the user types.
  useEffect(() => {
    if (!matchedBotId) return;
    const t = setTimeout(() => {
      const target =
        (matchedAddonId &&
          document.getElementById(`addon-card-${matchedBotId}-${matchedAddonId}`)) ||
        document.getElementById(`bot-section-${matchedBotId}`);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 250);
    return () => clearTimeout(t);
  }, [matchedBotId, matchedAddonId]);


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

  const hasAccess = isAdmin || hasDashboardAccess;

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
        <div className="flex items-center gap-3 mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-smooth shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to site
          </Link>

          {dashboardBots.length > 1 ? (
            <div className="relative flex-1 max-w-md mx-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/70 pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onBlur={() => setSearch("")}
                placeholder="Search your bots…"
                className="pl-9 h-9 bg-card/60 border-primary/20 focus-visible:border-primary/50 focus-visible:ring-primary/20 shadow-sm"
              />
            </div>
          ) : (
            <div className="flex-1" />
          )}

          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
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

        <HostingPastDueBanner />

        <div className="mb-8 space-y-6">
          <RedeemFreeCodeBox
            bots={dashboardBots}
            onRedeemed={() => {
              reloadFreePeriods();
              reload();
            }}
          />
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
            {dashboardBots.map((bot) => {
              const isMatch = matchedBotId === bot.id;
              const isDimmed = !!matchedBotId && !isMatch;
              // Only ring the whole bot when the match is bot-level (no specific add-on).
              const showBotRing = isMatch && !matchedAddonId;
              return (
                <div
                  key={bot.id}
                  id={`bot-section-${bot.id}`}
                  className={`scroll-mt-24 transition-opacity duration-300 ${
                    isDimmed ? "opacity-40" : "opacity-100"
                  } ${showBotRing ? "ring-2 ring-primary/40 rounded-2xl -m-2 p-2" : ""}`}
                >
                  <ReadOnlyBotScope
                    botId={bot.id}
                    ownerUserId={bot.ownerUserId}
                    viaTeam={bot.viaTeam}
                  >

                    <BotSection
                      bot={bot}
                      allBots={dashboardBots}
                      userId={user.id}
                      ownerEmail={user.email}
                      freePeriod={freePeriods[bot.id]}
                      onCancel={setCancelTarget}
                      onAddAddons={setAddonsTarget}
                      searchQuery={search}
                      highlightedAddonId={isMatch ? matchedAddonId : null}
                      onReload={() => {
                        reload();
                        reloadFreePeriods();
                      }}
                    />
                  </ReadOnlyBotScope>
                </div>
              );
            })}
            {search.trim() && !matchedBotId && (
              <div className="text-center text-sm text-muted-foreground -mt-8">
                No bots match "{search}".
              </div>
            )}
          </div>
        )}

        {/* One unified team panel for ALL of the viewer's owned bots. */}
        {(() => {
          const firstOwned = dashboardBots.find((b) => !b.isDemo && !b.viaTeam && !b.viaSupport);
          if (!firstOwned || !user) return null;
          return (
            <div className="mt-10">
              <TeamManagementHub
                botId={firstOwned.id}
                ownerUserId={user.id}
                ownerEmail={user.email ?? null}
              />
            </div>
          );
        })()}



        <NewOwnerBillingDialog
          forceOpen={new URLSearchParams(window.location.search).get("team_transfer") === "accepted"}
        />
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
