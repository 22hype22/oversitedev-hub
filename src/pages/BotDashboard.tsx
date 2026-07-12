import { lazy, Suspense, useEffect, useRef, useState, useCallback, useLayoutEffect, useMemo, type ReactNode } from "react";
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
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
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
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS as DndCSS } from "@dnd-kit/utilities";
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
import { BotManagePanel } from "@/components/dashboard/BotManagePanel";
import { BotInviteLinkCard } from "@/components/dashboard/BotInviteLinkCard";
import { GroupTeamHub } from "@/components/dashboard/team/GroupTeamHub";
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
import heroBg from "@/assets/hero-bg.jpg";

const BOTSEC_CSS = `
.botsec{background:linear-gradient(180deg,#272e36,#242b32);border:1px solid #3a434d;border-radius:16px;overflow:hidden;
  box-shadow:0 24px 60px -32px rgba(0,0,0,.6)}
.botsec>.bsum{display:flex;align-items:center;gap:13px;padding:16px 20px;cursor:pointer;list-style:none}
.botsec>.bsum::-webkit-details-marker{display:none}
.botsec>.bsum:hover{background:rgba(255,255,255,.014)}
.botsec .bico{height:36px;width:36px;border-radius:10px;flex:none;display:grid;place-items:center;background:#2d353e;color:#C9DBE6}
.botsec .bico svg{width:18px;height:18px;stroke:currentColor;stroke-width:1.8;fill:none}
.botsec .btx{flex:1;min-width:0}
.botsec .btx .ba{font-family:"Bricolage Grotesque",system-ui,sans-serif;font-weight:700;font-size:14.5px;color:#E8EEF3;
  display:flex;align-items:center;gap:8px}
.botsec .btx .ba .ct{font-family:"Space Mono",monospace;font-size:10px;font-weight:400;color:#788591;border:1px solid #3a434d;
  border-radius:20px;padding:1px 8px;flex:none}
.botsec .btx .bb{font-size:11.5px;color:#788591;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.botsec .bchev{height:20px;width:20px;color:#788591;transition:transform .2s,color .2s;flex:none}
.botsec[open] .bchev{transform:rotate(180deg);color:#C9DBE6}
.botsec .bbody{border-top:1px solid #3a434d;padding:12px 10px 14px}
/* Flatten the inner panel wrappers so they don't read as cramped secondary
   boxes inside the section; their inner tiles/content keep their own framing. */
.botsec .bbody .bg-card\\/40{background-color:transparent;border-color:transparent;box-shadow:none}
`;
import { useBotNotifications, type BotNotification } from "@/hooks/useBotNotifications";

// Mountain backdrop — imported as a real asset so it is a separately
// cacheable file instead of a ~220KB base64 blob inside this JS chunk.
import containers from "@/assets/containers.webp";
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

  // Icon for the bot's base ("what it originally was").
  const BaseIcon =
    bot.base === "support" ? LifeBuoy
    : bot.base === "utilities" ? Wrench
    : bot.base === "scratch" ? Sparkles
    : ShieldCheck;

  // Secondary meta chips (engine · hosting · free · health) shown on row two.
  const secondaryMeta: ReactNode[] = [];
  if (!bot.isDemo) {
    secondaryMeta.push(
      <span key="engine" className="inline-flex items-center gap-1">
        <Code2 className="h-3 w-3" />
        Component {bot.engine_version === "v2" ? "V2" : "V1"}
      </span>,
    );
  }
  if (bot.monthly_hosting) {
    secondaryMeta.push(
      <span key="hosting" className="inline-flex items-center gap-1">
        <Server className="h-3 w-3" />
        Hosting
      </span>,
    );
  }
  if (freeActive) {
    secondaryMeta.push(
      <span key="free" className="inline-flex items-center gap-1 text-emerald-400">
        <Gift className="h-3 w-3" />
        Free until {freeUntilLabel}
      </span>,
    );
  }
  if (!bot.isDemo) {
    secondaryMeta.push(<BotHealthBadge key="health" botId={bot.id} />);
  }

  const headerBadges = (
    <>
      <div className="meta1">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${statusMeta.className}`}
          /* Inline padding: the .osd *{padding:0} reset zeroes Tailwind px-*
             utilities here, which made the label rub the pill edges. */
          style={{ padding: "3px 11px" }}
        >
          {statusMeta.loading && !bot.isDemo && <HexagonLoader size={10} />}
          {statusMeta.label}
        </span>
        <span className="basetype">
          <BaseIcon />
          {baseLabel}
        </span>
        {bot.isDemo && (
          <span className="text-primary text-xs font-medium">Practice bot</span>
        )}
        {bot.viaSupport && (
          <span className="inline-flex items-center gap-1 text-amber-400 text-xs font-medium">
            <LifeBuoy className="h-3 w-3" />
            Support session
          </span>
        )}
      </div>
      {secondaryMeta.length > 0 && (
        <div className="meta2">
          {secondaryMeta.map((node, i) => (
            <span key={i} className="inline-flex items-center gap-2">
              {i > 0 && <span className="text-muted-foreground/40">·</span>}
              {node}
            </span>
          ))}
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

  const headerActions =
    !bot.isDemo && !bot.viaTeam && canEditBilling ? (
      <button type="button" className="pbtn" onClick={() => onAddAddons(bot)}>
        <Plus />
        Add-ons
      </button>
    ) : null;

  const showCancel = !bot.isDemo && !bot.viaTeam && cancellable && canEditBilling;
  const showLeave = !bot.isDemo && bot.viaTeam;
  const headerMenuItems =
    showCancel || showLeave ? (
      <>
        {showCancel && (
          <DropdownMenuItem
            onSelect={() => onCancel(bot)}
            className="gap-2 text-destructive focus:text-destructive"
          >
            <XCircle className="h-4 w-4" />
            Cancel subscription
          </DropdownMenuItem>
        )}
        {showLeave && (
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              leaveBot();
            }}
            disabled={leaving}
            className="gap-2 text-destructive focus:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            {leaving ? "Leaving…" : "Leave bot"}
          </DropdownMenuItem>
        )}
      </>
    ) : null;

  const sectionInner = (
    <section className="space-y-5">
      <style>{BOTSEC_CSS}</style>
      <BotIdentityEditor
        bot={bot}
        onUpdated={onReload}
        badges={headerBadges}
        actions={headerActions}
        menuItems={headerMenuItems}
        enableDiscordEdits={!bot.isDemo}
        onRefresh={() => { reloadHealth(); onReload(); }}
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
        className="botsec"
      >
        <summary className="bsum">
          <span className="bico">
            <Settings />
          </span>
          <div className="btx">
            <div className="ba">Manage this bot</div>
            <div className="bb">Engine, power controls, servers, usage &amp; logs</div>
          </div>
          <ChevronDown className="bchev" />
        </summary>
        <div className="bbody space-y-5">

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
        <BotManagePanel
          bot={bot}
          health={health}
          isOffline={isOffline}
          isDeploying={isDeploying}
          isStarting={isStarting}
          highlightSlots={highlightSlots}
          onCommandSent={handleCommandSent}
          onReload={onReload}
        />
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




      {/* Only the actionable deploy states get a banner now — the plain
          "Deploying…" strip is redundant with the Manage panel's live status
          beam, so we no longer render it. */}
      {(deployFailed || isQueued) && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm flex items-center justify-center gap-3 ${
            deployFailed
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-amber-500/30 bg-amber-500/10 text-amber-200"
          }`}
        >
          {deployFailed ? (
            <>
              <span className="font-medium">Deployment failed.</span>
              <Button size="sm" variant="outline" onClick={retryDeploy} disabled={retrying}>
                {retrying ? "Retrying…" : "Retry deployment"}
              </Button>
            </>
          ) : (
            <>
              <span className="h-2 w-2 rounded-full bg-amber-300 animate-pulse" />
              <span className="font-medium text-center">
                We're currently preparing your bot — our team is on it and you'll receive a Discord DM as soon as it's live. Thank you for your patience!
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
        className="botsec"
      >
        <summary className="bsum">
          <span className="bico">
            <Layers />
          </span>
          <div className="btx">
            <div className="ba">
              Add-on configuration
              {totalConfigurable > 0 && (
                <span className="ct">
                  {totalConfigurable} block{totalConfigurable === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <div className="bb">Tickets, say command, protection, utilities</div>
          </div>
          <ChevronDown className="bchev" />
        </summary>
        <div className="bbody space-y-5">
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
                <div className="flex items-center gap-3 mb-1">
                  <span className="h-6 w-6 rounded-md grid place-items-center shrink-0 bg-[rgba(201,219,230,0.1)] border border-[rgba(201,219,230,0.42)] text-primary">
                    <GroupIcon className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-[11px] font-extrabold tracking-[0.14em] uppercase text-muted-foreground font-['Manrope',system-ui,sans-serif]">
                    {group.label}
                  </span>
                  <span className="text-[11px] font-bold text-foreground bg-white/[0.04] border border-border rounded-full px-2 py-0.5">
                    {group.owned.length}
                  </span>
                  <span className="flex-1 h-px bg-white/[0.055]" />
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
//  Dashboard — 1:1 port of the approved preview. The preview's exact (scoped)
//  CSS lives in OSD_CSS; markup below mirrors the preview with live data.
//  The per-bot configuration screen reuses the real <BotSection> block.
// ============================================================================

const OSD_CSS = `.osd{font-family:var(--bodyf);color:var(--body);min-height:100vh;position:relative;--bg:#21272e;--panel:#272e36;--surface:#2d353e;--surface2:#343d46;--hair:#3a434d;--heading:#E8EEF3;--body:#A8B4BF;--faint:#788591;--accent:#C9DBE6;--accentink:#1E242B;--ok:#86d3a1;--bad:#e98b8b;--gold:#cbb277;--disp:"Bricolage Grotesque",system-ui,sans-serif;--bodyf:"Space Grotesk",system-ui,sans-serif;--mono:"Space Mono",monospace}
.osd-bg{position:fixed;inset:0;z-index:0;background-size:cover;background-position:center 20%;background-repeat:no-repeat}
.osd-scrim{position:fixed;inset:0;z-index:0;background:linear-gradient(180deg,rgba(18,22,27,.42),rgba(18,22,27,.6) 60%,rgba(18,22,27,.74))}
.osd-dim{position:fixed;inset:0;z-index:0;background:rgba(14,18,23,.62);opacity:0;transition:opacity 1.1s ease}
.osd.app .osd-dim{opacity:1}
.osd.instant .osd-dim,.osd.instant .appwrap,.osd.instant .side{transition:none!important}
.osd-stage{position:relative;z-index:10}
/* Remap shadcn/Tailwind theme tokens to the muted palette for every inner
   panel rendered inside the dashboard — visual only, no component changes. */
.osd{--background:212 16% 15%;--foreground:206 33% 93%;--card:213 16% 18%;--card-foreground:206 33% 93%;--popover:213 16% 18%;--popover-foreground:206 33% 93%;--primary:202 40% 85%;--primary-foreground:213 18% 14%;--primary-glow:202 40% 85%;--secondary:212 16% 21%;--secondary-foreground:206 33% 93%;--muted:212 16% 21%;--muted-foreground:209 16% 70%;--accent-foreground:206 33% 93%;--border:213 14% 26%;--input:213 14% 26%;--ring:202 40% 85%}
/* Neutralize hardcoded blue utility classes inside the dashboard to the accent */
.osd .text-blue-400,.osd .text-blue-300{color:#C9DBE6}
.osd .border-blue-500\\/30{border-color:rgba(201,219,230,.32)}
.osd .bg-blue-500\\/15{background-color:rgba(201,219,230,.14)}
.osd .bg-blue-500\\/10{background-color:rgba(201,219,230,.10)}
.osd .bg-blue-400{background-color:#C9DBE6}
.osd :root{--bg:#21272e;--panel:#272e36;--surface:#2d353e;--surface2:#343d46;--hair:#3a434d;
        --heading:#E8EEF3;--body:#A8B4BF;--faint:#788591;--accent:#C9DBE6;--accentink:#1E242B;
        --ok:#86d3a1;--bad:#e98b8b;--gold:#cbb277;
        --disp:"Bricolage Grotesque",system-ui,sans-serif;--bodyf:"Space Grotesk",system-ui,sans-serif;--mono:"Space Mono",monospace}
.osd *{box-sizing:border-box;margin:0;padding:0}
.osd.instant::after, .osd.instant .appwrap, .osd.instant .side{transition:none!important}
.osd .appwrap{display:flex;flex-direction:column;min-height:100vh;opacity:0;transform:translateY(16px);pointer-events:none;
    transition:opacity .9s ease .18s,transform 1s cubic-bezier(.22,1,.36,1) .18s}
.osd .appwrap.show{opacity:1;transform:none;pointer-events:auto}
.osd .approw{display:flex;flex:1;min-height:0}
.osd a{color:inherit;text-decoration:none}
.osd svg{display:block}
.osd .num{font-family:var(--mono);font-variant-numeric:tabular-nums}
.osd .overlay{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;padding:24px;overflow-y:auto;
    background:transparent;transition:opacity .65s ease,visibility .65s}
.osd .overlay.hide{opacity:0;visibility:hidden;pointer-events:none}
.osd .overlay.hide .wcard{transform:translateY(-16px) scale(.965);opacity:0}
.osd .wcard{transition:transform .65s cubic-bezier(.22,1,.36,1),opacity .5s ease}
.osd .wcard{width:100%;max-width:560px;border:1px solid rgba(168,180,191,.16);border-radius:22px;text-align:center;
    background:linear-gradient(180deg,rgba(45,53,62,.74),rgba(39,46,54,.8));backdrop-filter:blur(18px);
    padding:36px;box-shadow:0 44px 100px -44px rgba(0,0,0,.85)}
.osd .wcard .wmark{font-family:var(--disp);font-weight:800;color:var(--heading);font-size:18px;letter-spacing:-.01em;margin-bottom:20px}
.osd .wcard .wmark span{display:block;margin-top:5px;color:var(--faint);font-weight:700;font-size:10px;letter-spacing:.2em;text-transform:uppercase}
.osd .wcard h1{font-family:var(--disp);font-weight:800;color:var(--heading);font-size:clamp(24px,3.4vw,30px);letter-spacing:-.022em;line-height:1.05}
.osd .wcard .lead{font-size:13.5px;color:var(--body);line-height:1.55;margin-top:11px}
.osd .wcard .lead b{color:var(--heading);font-weight:600}
.osd .qlab{font-family:var(--disp);font-weight:700;font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--faint);margin:26px 0 13px}
.osd .choices{display:grid;grid-template-columns:1fr 1fr;gap:13px;text-align:left}
.osd .choice{position:relative;border:1.5px solid var(--hair);border-radius:16px;background:rgba(32,38,45,.5);padding:18px;cursor:pointer;transition:.16s}
.osd .choice:hover{border-color:color-mix(in srgb,var(--accent) 45%,transparent);transform:translateY(-2px)}
.osd .choice.sel{border-color:var(--accent);background:rgba(201,219,230,.08)}
.osd .choice .ci{height:42px;width:42px;border-radius:12px;background:var(--panel);display:grid;place-items:center;color:var(--accent);margin-bottom:12px;transition:.16s}
.osd .choice.sel .ci{background:var(--accent);color:var(--accentink)}
.osd .choice .ci svg{width:20px;height:20px;stroke:currentColor;stroke-width:1.7;fill:none}
.osd .choice .ct2{font-family:var(--disp);font-weight:700;color:var(--heading);font-size:15px}
.osd .choice .cd{font-size:11.5px;color:var(--faint);line-height:1.45;margin-top:5px}
.osd .choice .tick{position:absolute;top:14px;right:14px;height:18px;width:18px;border-radius:999px;border:1.5px solid var(--hair);display:grid;place-items:center;color:var(--accentink);transition:.16s}
.osd .choice .tick svg{width:11px;height:11px;stroke:currentColor;stroke-width:3;fill:none;opacity:0}
.osd .choice.sel .tick{background:var(--accent);border-color:var(--accent)}
.osd .choice.sel .tick svg{opacity:1}
.osd .wgo{width:100%;margin-top:20px;background:var(--accent);color:var(--accentink);border:0;border-radius:13px;padding:13px;font-family:var(--bodyf);font-weight:700;font-size:14px;cursor:pointer;transition:.15s;opacity:.45;pointer-events:none}
.osd .wgo.ready{opacity:1;pointer-events:auto}
.osd .wgo.ready:hover{filter:brightness(1.06)}
.osd .wnote{font-size:11.5px;color:var(--faint);margin-top:14px}
@media(max-width:520px){.osd .choices{grid-template-columns:1fr}.osd .wcard{padding:26px 20px}}
.osd .side{width:236px;flex:none;display:flex;flex-direction:column;gap:6px;padding:18px 14px;
        background:rgba(34,40,47,.66);backdrop-filter:blur(16px);border-right:1px solid rgba(168,180,191,.12);position:sticky;top:0;height:100vh;overflow-y:auto;
        transform:translateX(-20px);transition:transform .95s cubic-bezier(.22,1,.36,1) .22s}
.osd .appwrap.show .side{transform:none}
.osd .side{scrollbar-width:none;-ms-overflow-style:none}
.osd .side::-webkit-scrollbar{width:0;height:0;display:none}
/* Kill the custom scrollbar BAR everywhere in the dashboard (viewport + any inner
   scroller). Overrides the global index.css scrollbar. Scrolling still works via
   wheel/trackpad; any dot/indicator UI is unaffected. */
html:has(.osd.app),body:has(.osd.app),.osd.app,.osd.app *{scrollbar-width:none !important;-ms-overflow-style:none !important}
html:has(.osd.app)::-webkit-scrollbar,body:has(.osd.app)::-webkit-scrollbar,.osd.app::-webkit-scrollbar,.osd.app *::-webkit-scrollbar{width:0 !important;height:0 !important;display:none !important}
.osd .prof{display:flex;align-items:center;gap:10px;padding:8px 8px 14px;border-bottom:1px solid var(--hair);margin-bottom:8px}
.osd .prof .av{height:38px;width:38px;border-radius:11px;background:linear-gradient(135deg,#46525E,#343D46);
            display:grid;place-items:center;color:var(--heading);font-weight:800;font-family:var(--disp);font-size:15px;flex:none}
.osd .prof .nm{font-family:var(--disp);font-weight:700;color:var(--heading);font-size:13.5px;display:flex;align-items:center;gap:6px}
.osd .prof .pro{font-family:var(--disp);font-size:8px;font-weight:800;letter-spacing:.08em;color:var(--accentink);background:var(--accent);border-radius:5px;padding:1px 5px}
.osd .prof .h{font-size:11px;color:var(--faint);margin-top:1px}
.osd .prof .ed{margin-left:auto;color:var(--faint);cursor:pointer}
.osd .glab{font-family:var(--disp);font-size:9.5px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--faint);padding:12px 10px 5px}
.osd .nav{display:flex;align-items:center;gap:11px;padding:9px 11px;border-radius:11px;color:var(--body);font-size:13.5px;cursor:pointer;transition:.14s}
.osd .nav svg{width:17px;height:17px;stroke:currentColor;stroke-width:1.7;fill:none;flex:none}
.osd .nav:hover{background:var(--surface);color:var(--heading)}
.osd .nav.on{background:var(--surface2);color:var(--heading);font-weight:600}
.osd .annc{position:fixed;bottom:22px;right:22px;z-index:140;width:330px;max-width:calc(100vw - 36px);border:1px solid var(--hair);border-radius:18px;background:linear-gradient(180deg,color-mix(in srgb,var(--accent) 7%,var(--surface)),var(--panel));box-shadow:0 26px 64px -20px rgba(0,0,0,.75);overflow:hidden;animation:annc-in .42s cubic-bezier(.22,1,.36,1)}
@keyframes annc-in{from{opacity:0;transform:translateY(16px) scale(.97)}to{opacity:1;transform:none}}
.osd .annc .bar{height:3px;background:linear-gradient(90deg,var(--accent),color-mix(in srgb,var(--accent) 25%,transparent))}
.osd .annc .in{padding:15px 16px 14px}
.osd .annc .hd{display:flex;align-items:center;gap:10px}
.osd .annc .ic{height:34px;width:34px;border-radius:11px;flex:none;display:grid;place-items:center;background:color-mix(in srgb,var(--accent) 15%,transparent);color:var(--accent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--accent) 24%,transparent)}
.osd .annc .ic svg{width:17px;height:17px;stroke:currentColor;stroke-width:1.8;fill:none}
.osd .annc .ht{min-width:0}
.osd .annc .ht .t{font-family:var(--disp);font-weight:700;font-size:13px;color:var(--heading);display:flex;align-items:center;gap:7px;line-height:1.1}
.osd .annc .ht .t .ndot{height:6px;width:6px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 24%,transparent);animation:annc-pulse 2.4s ease-in-out infinite}
@keyframes annc-pulse{0%,100%{opacity:1}50%{opacity:.45}}
.osd .annc .ht .s{font-family:var(--mono);font-size:10px;color:var(--faint);margin-top:3px;letter-spacing:.02em;text-transform:uppercase}
.osd .annc .x{margin-left:auto;height:27px;width:27px;border-radius:8px;flex:none;border:1px solid var(--hair);background:transparent;color:var(--faint);display:grid;place-items:center;cursor:pointer;transition:.15s;padding:0}
.osd .annc .x:hover{background:var(--surface2);color:var(--heading);border-color:var(--surface2)}
.osd .annc .x svg{width:13px;height:13px;stroke:currentColor;stroke-width:2;fill:none}
.osd .annc .bd{margin-top:14px}
.osd .annc .bd .h{font-family:var(--disp);font-weight:700;font-size:14.5px;color:var(--heading);line-height:1.3;letter-spacing:-.01em}
.osd .annc .bd .p{font-size:12px;color:var(--body);line-height:1.5;margin-top:5px}
.osd .annc .ft{display:flex;align-items:center;gap:9px;margin-top:15px;padding-top:13px;border-top:1px solid var(--hair)}
.osd .annc .by{display:flex;align-items:center;gap:8px;min-width:0}
.osd .annc .av{height:26px;width:26px;border-radius:8px;flex:none;display:grid;place-items:center;background:linear-gradient(135deg,var(--accent),color-mix(in srgb,var(--accent) 55%,#000));color:var(--accentink);font-family:var(--disp);font-weight:800;font-size:10.5px}
.osd .annc .by .nm{font-size:11.5px;color:var(--heading);font-weight:600;line-height:1.15}
.osd .annc .by .tm{font-size:10px;color:var(--faint);margin-top:1px}
.osd .annc .act{margin-left:auto;flex:none;display:inline-flex;align-items:center;gap:6px;background:var(--accent);color:var(--accentink);border:0;border-radius:9px;padding:7px 13px;font-family:var(--bodyf);font-weight:700;font-size:11.5px;cursor:pointer;transition:.15s}
.osd .annc .act:hover{filter:brightness(1.07)}
.osd .annc .act svg{width:13px;height:13px;stroke:currentColor;stroke-width:2.2;fill:none;transition:transform .15s}
.osd .annc .act:hover svg{transform:translateX(2px)}
@media(max-width:760px){.osd .annc{left:14px;right:14px;width:auto}}
.osd .main{flex:1;min-width:0;padding:24px 26px 50px}
.osd .head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:22px}
.osd .crumb{font-size:12px;color:var(--faint)}
.osd .crumb b{color:var(--heading);font-weight:600}
.osd .head h1{font-family:var(--disp);font-size:clamp(26px,3.2vw,38px);color:var(--heading);letter-spacing:-.025em;margin-top:7px;line-height:1}
.osd .head .sub{font-size:12.5px;color:var(--faint);margin-top:8px}
.osd .head .sub b{color:var(--ok);font-weight:600}
.osd .htools{display:flex;align-items:center;gap:11px}
.osd .search{display:flex;align-items:center;gap:9px;background:var(--panel);border:1px solid var(--hair);border-radius:11px;padding:9px 13px;color:var(--faint);font-size:13px;min-width:170px}
.osd .search svg{width:15px;height:15px;stroke:currentColor;stroke-width:1.8;fill:none}
.osd .bell{height:40px;width:40px;border-radius:11px;background:var(--panel);border:1px solid var(--hair);display:grid;place-items:center;color:var(--body);cursor:pointer;position:relative}
.osd .bell svg{width:17px;height:17px;stroke:currentColor;stroke-width:1.7;fill:none}
.osd .bell .d{position:absolute;top:9px;right:11px;height:6px;width:6px;border-radius:999px;background:var(--accent)}
.osd .cta{background:var(--accent);color:var(--accentink);border:0;border-radius:11px;padding:11px 20px;font-family:var(--bodyf);font-weight:700;font-size:13px;cursor:pointer;transition:.15s;white-space:nowrap}
.osd .cta:hover{filter:brightness(1.06)}
.osd .view{display:none;animation:osd-fade .3s ease}
.osd .view.on{display:block}
@keyframes osd-fade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.osd .grid{display:grid;grid-template-columns:2fr 1fr;gap:16px;align-items:start}
.osd .left{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.osd .right{display:flex;flex-direction:column;gap:16px}
.osd .dashgrid{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start}
.osd .dashgrid .dashcell{min-width:0}
.osd .dashgrid .dashcell.wide{grid-column:1/-1}
.osd .dashgrid .dashcell.dragging{box-shadow:0 22px 60px -16px rgba(0,0,0,.65);border-radius:18px}
.osd .card{border:1px solid rgba(168,180,191,.14);border-radius:18px;background:linear-gradient(180deg,rgba(46,54,63,.7),rgba(39,46,54,.76));backdrop-filter:blur(12px);padding:18px}
.osd .ch{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px}
.osd .ct{font-family:var(--disp);font-weight:700;color:var(--heading);font-size:14.5px}
.osd .dots{color:var(--faint);cursor:pointer;font-size:18px;line-height:0}
.osd .cust .ph{height:96px;border-radius:13px;background:
     linear-gradient(90deg,transparent,rgba(168,180,191,.08) 40%,transparent),
     repeating-linear-gradient(180deg,transparent 0 16px,rgba(168,180,191,.06) 16px 17px),var(--panel);
     display:flex;align-items:center;justify-content:center;color:var(--faint);margin-bottom:16px}
.osd .cust .ph svg{width:30px;height:30px;stroke:currentColor;stroke-width:1.5;fill:none;opacity:.5}
.osd .cust h3{font-family:var(--disp);font-weight:700;color:var(--heading);font-size:17px;margin-bottom:7px}
.osd .cust p{font-size:12.5px;color:var(--faint);line-height:1.5;margin-bottom:16px}
.osd .ghost{width:100%;background:var(--panel);border:1px solid var(--hair);color:var(--heading);border-radius:11px;padding:11px;font-family:var(--bodyf);font-weight:600;font-size:13px;cursor:pointer;transition:.15s}
.osd .ghost:hover{background:var(--surface2)}
.osd .leg{display:flex;gap:14px;font-size:11px;color:var(--faint)}
.osd .leg span{display:inline-flex;align-items:center;gap:6px}
.osd .leg i{height:8px;width:8px;border-radius:3px;display:inline-block}
.osd .chart{display:flex;align-items:flex-end;gap:8px;height:120px;margin:6px 0 14px}
.osd .chart .col{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px}
.osd .chart .bars{flex:1;width:100%;display:flex;align-items:flex-end;justify-content:center;gap:3px}
.osd .chart .bar{width:7px;border-radius:3px;transition:height .3s}
.osd .chart .bar.buy{background:var(--accent)}
.osd .chart .bar.sell{background:var(--surface2)}
.osd .chart .x{font-size:9.5px;color:var(--faint)}
.osd .kpis{display:flex;align-items:center;gap:12px}
.osd .kpis .big{font-family:var(--disp);font-size:30px;font-weight:800;color:var(--heading);letter-spacing:-.02em}
.osd .kpis .big sup{font-size:15px;color:var(--faint);font-weight:600}
.osd .updelta{font-size:11px;color:var(--ok);background:rgba(134,211,161,.12);border-radius:999px;padding:3px 9px;font-weight:700}
.osd .kpis .vs{font-size:11px;color:var(--faint);margin-left:auto}
.osd .tabs{display:flex;gap:5px;background:var(--panel);border:1px solid var(--hair);border-radius:10px;padding:4px;margin-bottom:14px;flex-wrap:wrap}
.osd .tabs button{border:0;background:transparent;color:var(--faint);font-family:var(--bodyf);font-size:11.5px;font-weight:600;padding:6px 11px;border-radius:7px;cursor:pointer;transition:.14s}
.osd .tabs button.on{background:var(--surface2);color:var(--heading)}
.osd .tok{display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid var(--hair)}
.osd .tok:last-child{border-bottom:0}
.osd .tok .ic{height:34px;width:34px;border-radius:10px;background:var(--panel);display:grid;place-items:center;color:var(--accent);flex:none}
.osd .tok .ic svg{width:16px;height:16px;stroke:currentColor;stroke-width:1.7;fill:none}
.osd .tok .v{font-family:var(--disp);font-weight:700;color:var(--heading);font-size:13.5px}
.osd .tok .s{font-size:11px;color:var(--faint);margin-top:1px}
.osd .tok .act{margin-left:auto;border:1px solid var(--hair);background:transparent;color:var(--heading);border-radius:9px;padding:7px 13px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:var(--bodyf);transition:.14s}
.osd .tok .act:hover{background:var(--accent);color:var(--accentink);border-color:transparent}
.osd .assets{grid-column:1 / -1}
.osd .thead{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:6px}
.osd .seg{display:flex;gap:3px;background:var(--panel);border:1px solid var(--hair);border-radius:9px;padding:3px}
.osd .seg button{border:0;background:transparent;color:var(--faint);font-family:var(--bodyf);font-size:11px;font-weight:700;padding:5px 10px;border-radius:6px;cursor:pointer}
.osd .seg button.on{background:var(--surface2);color:var(--heading)}
.osd .tscroll{overflow-x:auto;margin:0 -4px}
.osd table{width:100%;border-collapse:collapse;min-width:560px}
.osd thead th{text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--faint);font-weight:600;padding:12px 14px;font-family:var(--disp)}
.osd tbody td{padding:13px 14px;border-top:1px solid var(--hair);font-size:13px}
.osd .coin{display:flex;align-items:center;gap:11px}
.osd .coin .a{height:30px;width:30px;border-radius:9px;background:var(--panel);display:grid;place-items:center;color:var(--accent);flex:none}
.osd .coin .a svg{width:14px;height:14px;stroke:currentColor;stroke-width:1.8;fill:none}
.osd .coin .nm{color:var(--heading);font-weight:600}
.osd .coin .tk{font-size:11px;color:var(--faint)}
.osd .dyn{font-family:var(--mono);font-size:12px;font-weight:700;border-radius:7px;padding:3px 8px}
.osd .dyn.up{color:var(--ok);background:rgba(134,211,161,.12)}
.osd .dyn.dn{color:var(--bad);background:rgba(233,139,139,.12)}
.osd .trade{border:1px solid var(--hair);background:transparent;color:var(--heading);border-radius:9px;padding:6px 16px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:var(--bodyf);transition:.14s}
.osd .trade:hover{background:var(--accent);color:var(--accentink);border-color:transparent}
.osd .mhead{display:flex;align-items:flex-start;justify-content:space-between}
.osd .mout{height:34px;width:34px;border-radius:10px;border:1px solid var(--hair);display:grid;place-items:center;color:var(--body);cursor:pointer}
.osd .mout svg{width:15px;height:15px;stroke:currentColor;stroke-width:1.8;fill:none}
.osd .mname{font-family:var(--disp);font-weight:800;color:var(--heading);font-size:21px;margin-top:14px;display:flex;align-items:baseline;gap:7px}
.osd .mname .x{font-size:12px;color:var(--faint);font-weight:600}
.osd .mhot{font-size:11.5px;color:var(--faint);margin-top:3px}
.osd .mrow{display:flex;justify-content:space-between;font-size:12.5px;padding:12px 0;border-bottom:1px solid var(--hair)}
.osd .mrow .k{color:var(--faint)}
.osd .mrow .v{color:var(--heading);font-family:var(--mono)}
.osd .mbtns{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px}
.osd .ph2{margin-bottom:18px}
.osd .ph2 h2{font-family:var(--disp);font-size:24px;color:var(--heading);letter-spacing:-.02em}
.osd .ph2 p{font-size:12.5px;color:var(--faint);margin-top:5px}
.osd .botgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.osd .bcard{border:1px solid rgba(168,180,191,.14);border-radius:16px;background:linear-gradient(180deg,rgba(46,54,63,.7),rgba(39,46,54,.76));backdrop-filter:blur(12px);padding:18px;cursor:pointer;transition:.16s;display:flex;flex-direction:column;min-height:262px}
.osd .bcard:hover{border-color:color-mix(in srgb,var(--accent) 35%,transparent);transform:translateY(-2px)}
.osd .bcard .a{height:46px;width:46px;border-radius:13px;background:var(--panel);display:grid;place-items:center;color:var(--accent);flex:none;margin-bottom:15px}
.osd .bcard .a svg{width:22px;height:22px;stroke:currentColor;stroke-width:1.7;fill:none}
.osd .bcard .nm{font-family:var(--disp);font-weight:700;color:var(--heading);font-size:16px}
.osd .bcard .st{font-size:11px;margin-top:3px}
.osd .bstats{display:flex;flex-direction:column;gap:8px;margin:16px 0}
.osd .bstats .bx{display:flex;align-items:center;justify-content:space-between;background:var(--panel);border:1px solid var(--hair);border-radius:10px;padding:9px 12px}
.osd .bstats .k{font-size:11px;color:var(--faint)}
.osd .bstats .v{font-family:var(--disp);font-weight:800;color:var(--heading);font-size:15px}
.osd .bcard .ghost{margin-top:auto}
.osd .addbot{border:1.5px dashed var(--hair);border-radius:16px;background:transparent;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--faint);cursor:pointer;min-height:262px;transition:.16s}
.osd .addbot:hover{border-color:var(--accent);color:var(--heading)}
.osd .addbot svg{width:26px;height:26px;stroke:currentColor;stroke-width:1.6;fill:none}
.osd .feed{border:1px solid rgba(168,180,191,.14);border-radius:16px;background:linear-gradient(180deg,rgba(46,54,63,.7),rgba(39,46,54,.76));backdrop-filter:blur(12px);overflow:hidden}
.osd .fitem{display:flex;gap:13px;padding:14px 18px;border-top:1px solid var(--hair)}
.osd .fitem:first-child{border-top:0}
.osd .fitem .fi{height:32px;width:32px;border-radius:9px;display:grid;place-items:center;flex:none}
.osd .fitem .fi svg{width:15px;height:15px;stroke:currentColor;stroke-width:1.8;fill:none}
.osd .fitem .ttl{color:var(--heading);font-size:13px;font-weight:600}
.osd .fitem .meta{font-size:11px;color:var(--faint);margin-top:2px}
.osd .fitem .tm{margin-left:auto;font-family:var(--mono);font-size:11px;color:var(--faint);white-space:nowrap}
.osd .bgrid{display:grid;grid-template-columns:1.4fr 1fr;gap:16px;align-items:start}
.osd .planrow{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}
.osd .planname{font-family:var(--disp);font-weight:800;color:var(--heading);font-size:22px}
.osd .pillok{font-size:11px;color:var(--ok);background:rgba(134,211,161,.12);border-radius:999px;padding:4px 11px;font-weight:700}
.osd .pm{display:flex;align-items:center;gap:12px;background:var(--panel);border:1px solid var(--hair);border-radius:12px;padding:14px}
.osd .pm .cc{height:34px;width:46px;border-radius:7px;background:linear-gradient(135deg,#46525E,#343D46);flex:none}
.osd .pmno{font-family:var(--mono);color:var(--heading);font-size:13px}
.osd .lvl{font-family:var(--mono);font-size:10px;font-weight:700;padding:2px 7px;border-radius:6px}
.osd .lvl.ok{color:var(--ok);background:rgba(134,211,161,.12)}
.osd .lvl.warn{color:var(--gold);background:rgba(203,178,119,.14)}
.osd .lvl.err{color:var(--bad);background:rgba(233,139,139,.12)}
.osd .cfg{font-size:11px;color:var(--accent);cursor:pointer;font-weight:600}
.osd .role{font-family:var(--mono);font-size:10px;font-weight:700;padding:3px 9px;border-radius:7px;color:var(--accent);background:rgba(201,219,230,.1)}
.osd .role.admin{color:var(--gold);background:rgba(203,178,119,.13)}
.osd .form{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.osd .field label{display:block;font-size:11px;color:var(--faint);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;font-family:var(--disp);font-weight:600}
.osd .field input{width:100%;background:var(--panel);border:1px solid var(--hair);border-radius:10px;padding:11px 13px;color:var(--heading);font-family:var(--bodyf);font-size:13px}
.osd .field.full{grid-column:1 / -1}
.osd .togrow{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 0;border-top:1px solid var(--hair)}
.osd .togrow:first-child{border-top:0}
.osd .togrow .tl{color:var(--heading);font-size:13px;font-weight:600}
.osd .togrow .td{font-size:11.5px;color:var(--faint);margin-top:2px}
.osd .modeopts{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.osd .modeopt{border:1px solid var(--hair);border-radius:13px;background:var(--panel);padding:15px;cursor:pointer;transition:.15s}
.osd .modeopt.on{border-color:var(--accent);background:rgba(201,219,230,.07)}
.osd .modeopt .mt{font-family:var(--disp);font-weight:700;color:var(--heading);font-size:14px;display:flex;align-items:center;justify-content:space-between}
.osd .modeopt .check{height:16px;width:16px;border-radius:999px;border:1.5px solid var(--hair);display:grid;place-items:center;color:var(--accentink)}
.osd .modeopt .check svg{width:10px;height:10px;stroke:currentColor;stroke-width:3;fill:none;opacity:0}
.osd .modeopt.on .check{border-color:var(--accent);background:var(--accent)}
.osd .modeopt.on .check svg{opacity:1}
.osd .modeopt .md{font-size:11.5px;color:var(--faint);margin-top:6px;line-height:1.45}
.osd .bgopts{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px}
.osd .bgopt{position:relative;height:78px;border-radius:12px;border:1.5px solid var(--hair);cursor:pointer;overflow:hidden;
    background-image:var(--thumb,none);background-color:var(--panel);background-size:cover;background-position:center 22%;transition:.15s}
.osd .bgopt:hover{border-color:color-mix(in srgb,var(--accent) 45%,transparent)}
.osd .bgopt.sel{border-color:var(--accent)}
.osd .bgopt.none{background-image:repeating-linear-gradient(45deg,#2a323b 0 8px,#252c34 8px 16px)}
.osd .bgopt .lbl{position:absolute;left:0;right:0;bottom:0;padding:6px 9px;font-family:var(--disp);font-size:10.5px;font-weight:700;color:var(--heading);background:linear-gradient(transparent,rgba(0,0,0,.65))}
.osd .bgopt .tk2{position:absolute;top:7px;right:7px;height:18px;width:18px;border-radius:999px;background:var(--accent);display:grid;place-items:center;opacity:0;transition:.15s}
.osd .bgopt.sel .tk2{opacity:1}
.osd .bgopt .tk2 svg{width:11px;height:11px;stroke:var(--accentink);stroke-width:3;fill:none}
.osd .swt{position:relative;width:40px;height:23px;flex:none}
.osd .swt input{display:none}
.osd .swt .tk{position:absolute;inset:0;border-radius:999px;background:var(--surface2);cursor:pointer;transition:.2s}
.osd .swt .tk:before{content:"";position:absolute;height:17px;width:17px;left:3px;top:3px;border-radius:999px;background:#cfd8df;transition:.2s}
.osd .swt input:checked + .tk{background:var(--accent)}
.osd .swt input:checked + .tk:before{transform:translateX(17px);background:#1E242B}
.osd .strip{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:16px}
.osd .stat{border:1px solid rgba(168,180,191,.14);border-radius:14px;background:linear-gradient(180deg,rgba(46,54,63,.7),rgba(39,46,54,.76));backdrop-filter:blur(12px);padding:15px 16px}
.osd .stat .k{font-family:var(--disp);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--faint)}
.osd .stat .v{font-family:var(--disp);font-size:23px;font-weight:800;color:var(--heading);margin-top:6px}
.osd .stat .d{font-size:11px;color:var(--faint);margin-top:2px}
.osd .feat{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.osd .fcard{border:1px solid rgba(168,180,191,.14);border-radius:14px;background:linear-gradient(180deg,rgba(46,54,63,.7),rgba(39,46,54,.76));backdrop-filter:blur(12px);padding:18px;display:flex;flex-direction:column;min-height:208px}
.osd .fcard .fi{height:42px;width:42px;border-radius:12px;background:var(--panel);display:grid;place-items:center;color:var(--accent);flex:none;margin-bottom:13px}
.osd .fcard .fi svg{width:19px;height:19px;stroke:currentColor;stroke-width:1.7;fill:none}
.osd .fcard .nm{font-family:var(--disp);font-size:14px;color:var(--heading);font-weight:700}
.osd .fcard .ds{font-size:11.5px;color:var(--faint);margin-top:6px;line-height:1.45}
.osd .fcard .re{margin-top:auto;display:flex;align-items:center;justify-content:space-between;gap:9px;padding-top:14px}
.osd .back{font-size:12px;color:var(--faint);cursor:pointer;margin-bottom:13px;display:inline-flex;gap:6px;align-items:center}
.osd .back svg{width:13px;height:13px;stroke:currentColor;stroke-width:2;fill:none}
.osd .sech{font-family:var(--disp);font-weight:700;color:var(--heading);font-size:15px;margin:24px 0 12px}
.osd .bcard, .osd .fcard{cursor:grab}
.osd .bcard:active, .osd .fcard:active{cursor:grabbing}
.osd .dragging{opacity:.35;transform:scale(.98)!important}
.osd .drophint{font-size:11px;color:var(--faint)}
.osd .dragging-active .bcard:not(.dragging), .osd .dragging-active .fcard:not(.dragging){pointer-events:none}
.osd .dragging-active .bcard:hover, .osd .dragging-active .fcard:hover{transform:none;border-color:rgba(168,180,191,.14);box-shadow:none}
.osd .groups{display:flex;flex-direction:column;gap:16px}
.osd .gcard{border:1px solid rgba(168,180,191,.14);border-radius:16px;background:linear-gradient(180deg,rgba(46,54,63,.7),rgba(39,46,54,.76));backdrop-filter:blur(12px);padding:18px}
.osd .ghd{display:flex;align-items:center;gap:11px;border-bottom:1px solid var(--hair);padding-bottom:14px;margin-bottom:16px}
.osd .ghd .gi{height:36px;width:36px;border-radius:10px;background:var(--panel);display:grid;place-items:center;color:var(--accent);flex:none}
.osd .ghd .gi svg{width:17px;height:17px;stroke:currentColor;stroke-width:1.7;fill:none}
.osd .gname{font-family:var(--disp);font-weight:700;color:var(--heading);font-size:16px}
.osd .gmeta{font-size:11.5px;color:var(--faint);margin-top:1px}
.osd .ghd .dots{margin-left:auto}
.osd .gbody{display:grid;grid-template-columns:1fr 1fr;gap:22px}
.osd .gcl{font-family:var(--disp);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--faint);margin-bottom:11px}
.osd .chips{display:flex;flex-wrap:wrap;gap:8px}
.osd .chip{display:inline-flex;align-items:center;gap:7px;background:var(--panel);border:1px solid var(--hair);border-radius:999px;padding:7px 12px;font-size:12.5px;color:var(--heading)}
.osd .chip svg{width:14px;height:14px;stroke:var(--accent);stroke-width:1.8;fill:none}
.osd .chip .x{color:var(--faint);cursor:pointer;font-size:13px;line-height:1;margin-left:1px}
.osd .chip.add{cursor:pointer;color:var(--faint);border-style:dashed}
.osd .chip.add:hover{color:var(--heading);border-color:var(--accent)}
.osd .gmem{display:inline-flex;align-items:center;gap:8px;background:var(--panel);border:1px solid var(--hair);border-radius:999px;padding:5px 11px 5px 5px;font-size:12.5px;color:var(--heading)}
.osd .gmem .pa{height:22px;width:22px;border-radius:7px;background:linear-gradient(135deg,#46525E,#343D46);display:grid;place-items:center;font-family:var(--disp);font-weight:800;font-size:9px;color:var(--heading)}
.osd .tourask{position:fixed;bottom:22px;right:22px;z-index:150;max-width:300px;border:1px solid rgba(168,180,191,.16);border-radius:16px;
    background:linear-gradient(180deg,rgba(46,54,63,.96),rgba(39,46,54,.98));backdrop-filter:blur(14px);padding:18px;
    box-shadow:0 26px 64px -26px rgba(0,0,0,.85);opacity:0;transform:translateY(14px);pointer-events:none;transition:.45s cubic-bezier(.22,1,.36,1)}
.osd .tourask.show{opacity:1;transform:none;pointer-events:auto}
.osd .tourask .tt{font-family:var(--disp);font-weight:800;color:var(--heading);font-size:15px;display:flex;align-items:center;gap:8px}
.osd .tourask .tb{font-size:12.5px;color:var(--body);line-height:1.5;margin:8px 0 14px}
.osd .row{display:flex;gap:9px}
.osd .btn-sm{border:1px solid var(--hair);background:transparent;color:var(--heading);border-radius:10px;padding:9px 14px;font-family:var(--bodyf);font-weight:700;font-size:12.5px;cursor:pointer;transition:.15s}
.osd .btn-sm:hover{background:var(--surface2)}
.osd .btn-pri{background:var(--accent);color:var(--accentink);border:0}
.osd .btn-pri:hover{filter:brightness(1.06)}
.osd .tourblock{position:fixed;inset:0;z-index:199;display:none}
.osd .tourblock.on{display:block}
.osd .tourring{position:fixed;z-index:200;border:2px solid var(--accent);border-radius:14px;box-shadow:0 0 0 9999px rgba(8,11,15,.72);
    pointer-events:none;display:none;transition:top .42s cubic-bezier(.22,1,.36,1),left .42s cubic-bezier(.22,1,.36,1),width .42s cubic-bezier(.22,1,.36,1),height .42s cubic-bezier(.22,1,.36,1)}
.osd .tourring.on{display:block}
.osd .tourpop{position:fixed;z-index:201;max-width:300px;border:1px solid rgba(168,180,191,.16);border-radius:14px;
    background:linear-gradient(180deg,rgba(46,54,63,.98),rgba(39,46,54,.99));backdrop-filter:blur(14px);padding:16px;
    box-shadow:0 26px 64px -26px rgba(0,0,0,.9);display:none;
    transition:top .42s cubic-bezier(.22,1,.36,1),left .42s cubic-bezier(.22,1,.36,1),opacity .25s ease}
.osd .tourpop.on{display:block}
.osd .tourring.notrans, .osd .tourpop.notrans{transition:none}
.osd .tourpop .tt{font-family:var(--disp);font-weight:800;color:var(--heading);font-size:14.5px}
.osd .tourpop .tb{font-size:12.5px;color:var(--body);line-height:1.5;margin:7px 0 14px}
.osd .tourpop .nav{display:flex;align-items:center;gap:9px}
.osd .tourpop .ct3{font-family:var(--mono);font-size:11px;color:var(--faint)}
.osd .tourpop .skip{font-size:11.5px;color:var(--faint);cursor:pointer}
.osd .tourpop .sp{margin-left:auto}
@media(max-width:1180px){.osd .grid, .osd .bgrid{grid-template-columns:1fr}}
@media(max-width:1180px){.osd .botgrid{grid-template-columns:repeat(3,1fr)}.osd .feat{grid-template-columns:repeat(2,1fr)}}
@media(max-width:980px){.osd .botgrid{grid-template-columns:repeat(2,1fr)}.osd .strip{grid-template-columns:repeat(2,1fr)}}
@media(max-width:760px){.osd .side{position:fixed;left:-260px;transition:.2s;z-index:50}.osd .main{padding:18px 14px 40px}.osd .left, .osd .form, .osd .feat, .osd .choices, .osd .gbody, .osd .dashgrid{grid-template-columns:1fr}.osd .dashgrid .dashcell.wide{grid-column:auto}.osd .head h1{font-size:24px}}
@media(max-width:560px){.osd .botgrid{grid-template-columns:1fr}.osd .search{display:none}}`;

const LS = { ws: "os_ws_mode", onboarded: "os_onboarded", tour: "os_tour_seen", bg: "os_bg", order: "os_bot_order", groups: "os_groups", accent: "os_accent", accentHex: "os_accent_hex", view: "os_view", bot: "os_bot" };

// readable text color (dark/light) for an arbitrary accent hex
const inkFor = (hex: string) => {
  const m = (hex || "").replace("#", "");
  const n = m.length === 3 ? m.split("").map((x) => x + x).join("") : m;
  if (!/^[0-9a-fA-F]{6}$/.test(n)) return "#1E242B";
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#1E242B" : "#E8EEF3";
};

// Primary (accent) color presets — recolor buttons, highlights, badges across the dashboard.
const ACCENTS: { key: string; label: string; c: string; ink: string }[] = [
  { key: "icy", label: "Icy", c: "#C9DBE6", ink: "#1E242B" },
  { key: "gold", label: "Gold", c: "#cbb277", ink: "#241e12" },
  { key: "mint", label: "Mint", c: "#86d3a1", ink: "#10231a" },
  { key: "sky", label: "Sky", c: "#8fbce8", ink: "#0f1f2b" },
  { key: "lavender", label: "Lavender", c: "#b9a8e6", ink: "#1b1430" },
  { key: "rose", label: "Rose", c: "#e6a8bf", ink: "#2b1019" },
  { key: "coral", label: "Coral", c: "#e8a487", ink: "#2b1410" },
];
const lsGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };
const lsDel = (k: string) => { try { localStorage.removeItem(k); } catch { /* ignore */ } };

const BG_PRESETS: { key: string; label: string; url: string | null }[] = [
  { key: "mountain", label: "Mountain", url: containers },
  { key: "dusk", label: "Dusk", url: heroBg },
  { key: "none", label: "None", url: null },
];

const osTimeAgo = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  const m = Math.floor(s / 60); if (m < 60) return m + "m";
  const h = Math.floor(m / 60); if (h < 24) return h + "h";
  return Math.floor(h / 24) + "d";
};

const IconShield = () => (<svg viewBox="0 0 24 24"><path d="M12 3 4 6v6c0 5 3.5 7.5 8 9 4.5-1.5 8-4 8-9V6Z"/></svg>);
const IconChat = () => (<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/></svg>);
const IconGear = () => (<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/></svg>);
const botSvg = (base: string) => base === "support" ? <IconChat /> : base === "utilities" ? <IconGear /> : <IconShield />;
const isLive = (b: OwnedBot) => b.status === "live" || b.status === "ready";
const stColor = (b: OwnedBot) => isLive(b) ? "var(--ok)" : (b.status === "submitted" || b.status === "paid" || b.status === "building") ? "var(--gold)" : "var(--faint)";
const stWord = (b: OwnedBot) => isLive(b) ? "Online" : (b.status === "submitted" || b.status === "paid" || b.status === "building") ? "Building" : (getStatusMeta(b.status).label);

const CHART = [[40,22],[55,30],[35,18],[70,40],[48,26],[80,44],[60,33]];
const CDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

type Group = { id: string; name: string; botIds: string[] };

const DEFAULT_DASH_ORDER = ["setup", "activity", "table", "bots", "spotlight"];

// One draggable dashboard box. Whole card is the grab area; a small movement
// threshold on the sensor lets clicks on inner buttons/rows still register.
function DashSortableCard({
  id,
  wide,
  children,
}: {
  id: string;
  wide?: boolean;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      className={"dashcell" + (wide ? " wide" : "") + (isDragging ? " dragging" : "")}
      style={{
        transform: DndCSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 60 : undefined,
        opacity: isDragging ? 0.9 : 1,
        cursor: "grab",
      }}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}

const BotDashboard = () => {
  const { user, isAdmin, loading } = useAuth();
  const { dashboardBots, hasDashboardAccess, loading: botsLoading, reload } = useOwnedBots();
  useHostingSubscriptionSync();
  const { periods: freePeriods, reload: reloadFreePeriods } = useBotFreePeriods();
  const { items: notifications, unread } = useBotNotifications();
  const navigate = useNavigate();

  // Persist the active view + open bot so a refresh keeps you exactly where
  // you were instead of dropping you back on the dashboard home.
  const [view, setView] = useState(() => lsGet(LS.view) || "dashboard");
  // Shared, owner-set dashboard box layout (an ordered array of card ids).
  const [dashOrder, setDashOrder] = useState<string[]>(DEFAULT_DASH_ORDER);
  const dashSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );
  const [botId, setBotId] = useState<string | null>(() => lsGet(LS.bot) || null);
  const [cancelTarget, setCancelTarget] = useState<OwnedBot | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [addonsTarget, setAddonsTarget] = useState<OwnedBot | null>(null);

  // The currently-rendered dashboard order (subset of dashOrder that has a
  // visible card); the drag handler reorders against this.
  const dashOrderedRef = useRef<string[]>(DEFAULT_DASH_ORDER);

  // Load the shared layout and keep it live — an owner change applies for
  // everyone. Defensive: bad/missing data just keeps the default order.
  useEffect(() => {
    let alive = true;
    (supabase as any)
      .from("app_settings")
      .select("dashboard_layout")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }: any) => {
        if (alive && Array.isArray(data?.dashboard_layout) && data.dashboard_layout.length) {
          setDashOrder(data.dashboard_layout as string[]);
        }
      });
    const ch = (supabase as any)
      .channel("dash-layout-shared")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "app_settings", filter: "id=eq.1" },
        (payload: any) => {
          const dl = payload?.new?.dashboard_layout;
          if (Array.isArray(dl) && dl.length) setDashOrder(dl as string[]);
        },
      )
      .subscribe();
    return () => {
      alive = false;
      (supabase as any).removeChannel(ch);
    };
  }, []);

  // Admin drags a box → reorder the rendered set and persist globally.
  const onDashDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const cur = dashOrderedRef.current;
    const from = cur.indexOf(String(active.id));
    const to = cur.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    const next = arrayMove(cur, from, to);
    setDashOrder(next);
    (supabase as any)
      .from("app_settings")
      .update({ dashboard_layout: next, updated_at: new Date().toISOString() })
      .eq("id", 1)
      .then(({ error }: any) => {
        if (error) toast.error("Couldn't save layout", { description: error.message });
      });
  };

  const [wsMode, setWsMode] = useState<"solo" | "team">(() => (lsGet(LS.ws) === "team" ? "team" : "solo"));
  const [appOn, setAppOn] = useState(() => !!lsGet(LS.onboarded));
  const [instant, setInstant] = useState(() => !!lsGet(LS.onboarded));
  const [picked, setPicked] = useState<"solo" | "team" | null>(null);
  // Floating announcement: shown each time the dashboard mounts. Dismiss hides
  // it for this visit only — it deliberately returns on the next launch.
  const [annOpen, setAnnOpen] = useState(true);
  const [bgKey, setBgKey] = useState<string>(() => lsGet(LS.bg) || "mountain");
  const bgUrl = BG_PRESETS.find((p) => p.key === bgKey)?.url ?? null;
  // profile name fallback: preferred name → display name → discord username → email
  const [profile, setProfile] = useState<{ preferred_name?: string | null; display_name?: string | null; discord_username?: string | null }>({});
  const [accentKey, setAccentKey] = useState<string>(() => lsGet(LS.accent) || "icy");
  const [customHex, setCustomHex] = useState<string>(() => lsGet(LS.accentHex) || "#C9DBE6");
  const accent = accentKey === "custom"
    ? { key: "custom", label: "Custom", c: customHex, ink: inkFor(customHex) }
    : (ACCENTS.find((a) => a.key === accentKey) ?? ACCENTS[0]);
  const applyCustom = (v: string) => { setCustomHex(v); setAccentKey("custom"); lsSet(LS.accent, "custom"); lsSet(LS.accentHex, v); };
  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      const { data } = await (supabase as any).from("profiles").select("preferred_name, display_name, discord_username").eq("user_id", user.id).maybeSingle();
      if (alive && data) setProfile(data);
    })();
    return () => { alive = false; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [tableFilter, setTableFilter] = useState("all");
  const [listFilter, setListFilter] = useState("all");
  const [actTab, setActTab] = useState("All");
  const [chartRange, setChartRange] = useState("1M");

  // clear the no-animation flag after first paint
  useEffect(() => { if (instant) { const t = setTimeout(() => setInstant(false), 60); return () => clearTimeout(t); } }, []); // eslint-disable-line
  // lock page scroll while the welcome screen is up
  useEffect(() => { document.body.style.overflow = appOn ? "" : "hidden"; return () => { document.body.style.overflow = ""; }; }, [appOn]);
  // Hide the native page scrollbar while the dashboard is mounted (same pattern
  // the Process page uses). Removed on unmount so other pages keep theirs.
  useEffect(() => { const r = document.documentElement; r.classList.add("dash-hide-scroll"); return () => { r.classList.remove("dash-hide-scroll"); }; }, []);

  // ---- tour ----
  const TOUR = useMemo(() => ([
    { sel: ".osd .side", title: "Your menu", body: "Jump between your bots, groups, activity, billing and settings from here.", place: "right" },
    { sel: "#tour-bots", title: "Your bots", body: "Every bot you own lives here — click one to open its control panel.", place: "left" },
    { sel: "#tour-activity", title: "Fleet activity", body: "A quick pulse of what your bots have been up to.", place: "top" },
    { sel: "#tour-bell", title: "Notifications", body: "Service alerts, billing, and team announcements land here.", place: "bottom" },
    { sel: "#tour-add", title: "Add a bot", body: "Grow your fleet anytime.", place: "bottom" },
  ]), []);
  const [tourAsk, setTourAsk] = useState(false);
  const [tourOn, setTourOn] = useState(false);
  const [ti, setTi] = useState(0);
  const ringRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const askTour = useCallback(() => { if (!lsGet(LS.tour)) setTimeout(() => setTourAsk(true), 850); }, []);
  useEffect(() => { if (appOn && !lsGet(LS.tour)) askTour(); }, [appOn, askTour]);
  const placeTour = useCallback(() => {
    const step = TOUR[ti]; if (!step) return;
    const el = document.querySelector(step.sel) as HTMLElement | null;
    const ring = ringRef.current, pop = popRef.current;
    if (!el || !ring || !pop) return;
    const b = el.getBoundingClientRect(), pad = 6;
    ring.style.top = (b.top - pad) + "px"; ring.style.left = (b.left - pad) + "px";
    ring.style.width = (b.width + pad * 2) + "px"; ring.style.height = (b.height + pad * 2) + "px";
    const pw = pop.offsetWidth, ph = pop.offsetHeight, gap = 14, vw = window.innerWidth, vh = window.innerHeight;
    let top: number, left: number;
    if (step.place === "right") { left = b.right + gap; top = Math.max(b.top, 16); }
    else if (step.place === "left") { left = b.left - gap - pw; top = b.top; }
    else if (step.place === "top") { top = b.top - gap - ph; left = b.left + b.width / 2 - pw / 2; }
    else { top = b.bottom + gap; left = b.left + b.width / 2 - pw / 2; }
    left = Math.max(12, Math.min(left, vw - pw - 12)); top = Math.max(12, Math.min(top, vh - ph - 12));
    pop.style.left = left + "px"; pop.style.top = top + "px";
  }, [ti, TOUR]);
  useLayoutEffect(() => { if (!tourOn) return; const r = requestAnimationFrame(placeTour); return () => cancelAnimationFrame(r); }, [tourOn, ti, placeTour]);
  useEffect(() => { if (!tourOn) return; const f = () => placeTour(); window.addEventListener("resize", f); window.addEventListener("scroll", f, true); return () => { window.removeEventListener("resize", f); window.removeEventListener("scroll", f, true); }; }, [tourOn, placeTour]);
  const startTour = () => { setTourAsk(false); setTi(0); setView("dashboard"); setTourOn(true); };
  const endTour = () => { setTourOn(false); lsSet(LS.tour, "1"); };

  // ---- ordering / drag ----
  const idsKey = dashboardBots.map((b) => b.id).join(",");
  const [order, setOrder] = useState<string[]>([]);
  useEffect(() => {
    let saved: string[] = []; try { saved = JSON.parse(lsGet(LS.order) || "[]"); } catch { saved = []; }
    const ids = dashboardBots.map((b) => b.id);
    setOrder([...saved.filter((id) => ids.includes(id)), ...ids.filter((id) => !saved.includes(id))]);
  }, [idsKey]);
  useEffect(() => { if (order.length) lsSet(LS.order, JSON.stringify(order)); }, [order]);
  const byId = useMemo(() => { const m: Record<string, OwnedBot> = {}; dashboardBots.forEach((b) => { m[b.id] = b; }); return m; }, [dashboardBots]);

  // Remember where the user is across refreshes: persist the active view and
  // the open bot, and recover gracefully if the remembered bot is gone.
  useEffect(() => { lsSet(LS.view, view); }, [view]);
  useEffect(() => {
    if (botId) lsSet(LS.bot, botId);
    else { try { localStorage.removeItem(LS.bot); } catch { /* ignore */ } }
  }, [botId]);
  useEffect(() => {
    if (!botsLoading && view === "bot" && botId && !byId[botId]) {
      setView("bots");
      setBotId(null);
    }
  }, [botsLoading, view, botId, byId]);

  const orderedBots = useMemo(() => order.map((id) => byId[id]).filter(Boolean) as OwnedBot[], [order, byId]);
  const owned = orderedBots.filter((b) => !b.isDemo);
  const dragId = useRef<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const onDragStart = (id: string) => { dragId.current = id; setDragActive(true); };
  const onDragOver = (e: React.DragEvent, overId: string) => { e.preventDefault(); const from = dragId.current; if (!from || from === overId) return; setOrder((p) => { const a = [...p]; const fi = a.indexOf(from), oi = a.indexOf(overId); if (fi < 0 || oi < 0) return p; a.splice(fi, 1); a.splice(oi, 0, from); return a; }); };
  const onDragEnd = () => { dragId.current = null; setDragActive(false); };

  // ---- groups (local) ----
  const [groups, setGroups] = useState<Group[]>(() => { try { return JSON.parse(lsGet(LS.groups) || "[]"); } catch { return []; } });
  useEffect(() => { lsSet(LS.groups, JSON.stringify(groups)); }, [groups]);

  const chooseMode = (m: "solo" | "team") => { setWsMode(m); lsSet(LS.ws, m); lsSet(LS.onboarded, "1"); setAppOn(true); askTour(); };
  const openBot = (id: string) => { setBotId(id); setView("bot"); window.scrollTo({ top: 0 }); };
  const go = (v: string) => { setView(v); window.scrollTo({ top: 0 }); };
  const openPortal = async () => { const { data, error } = await supabase.functions.invoke("customer-portal"); if (error) { toast.error("Couldn't open billing portal", { description: error.message }); return; } const url = (data as { url?: string } | null)?.url; if (url) window.location.href = url; else toast.error("No billing portal available yet."); };
  const [confirmOut, setConfirmOut] = useState(false);
  const signOut = async () => { await supabase.auth.signOut(); navigate("/auth", { replace: true }); };
  const cancelOrder = async (bot: OwnedBot) => { if (!user) return; setCancelling(true); const { error } = await (supabase as any).from("bot_orders").update({ status: "cancelled" }).eq("id", bot.id).eq("user_id", user.id); setCancelling(false); if (error) { toast.error("Couldn't cancel — " + error.message); return; } toast.success(`Cancelled "${bot.bot_name}"`); setCancelTarget(null); reload(); };

  useEffect(() => { if (loading) return; if (!user) navigate("/auth", { replace: true }); }, [user, loading, navigate]);

  if (loading || botsLoading) return <div className="min-h-screen bg-background grid place-items-center text-muted-foreground">Loading...</div>;
  if (!user) return null;
  const hasAccess = isAdmin || hasDashboardAccess;
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background grid place-items-center px-4">
        <div className="max-w-md text-center space-y-5">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 border border-primary/20 grid place-items-center"><Lock className="h-5 w-5 text-primary" /></div>
          <h1 className="text-2xl font-bold">No bots yet</h1>
          <p className="text-muted-foreground">Once you <span className="text-foreground font-medium">own a bot</span> — by buying one or having it transferred to you — it'll show up here to manage. Team members get access when an owner shares a bot with them.</p>
          <div className="flex gap-3 justify-center"><Button asChild><Link to="/bots"><Globe className="h-4 w-4 mr-2" />Browse bots</Link></Button><Button variant="outline" asChild><Link to="/">Back to site</Link></Button></div>
        </div>
      </div>
    );
  }

  const handle =
    (profile.preferred_name && profile.preferred_name.trim()) ||
    (profile.display_name && profile.display_name.trim()) ||
    (profile.discord_username && profile.discord_username.trim()) ||
    (user.email ? user.email.split("@")[0] : "") ||
    "you";
  const initial = (user.email?.[0] ?? "U").toUpperCase();
  const liveCount = owned.filter(isLive).length;
  const activeBot = botId ? byId[botId] : null;
  const firstOwned = dashboardBots.find((b) => !b.isDemo && !b.viaTeam && !b.viaSupport);
  const spotlight = owned[0];
  const isTeam = wsMode === "team";

  const navItem = (v: string, icon: React.ReactNode, label: string, extraId?: string) => (
    <div className={"nav" + (view === v ? " on" : "")} data-view={v} id={extraId} onClick={() => go(v)}>{icon}{label}</div>
  );

  const filt = (f: string) => (b: OwnedBot) => f === "all" ? true : f === "online" ? isLive(b) : !isLive(b);

  // Dashboard boxes, addressable by id so they can be reordered. The shared
  // order lives in dashOrder; admins drag to rearrange (saved for everyone),
  // customers get the same order as plain cells (no drag code at all).
  const renderDash = () => {
    const cells: Record<string, ReactNode> = {
      setup: (
        <div className="card cust">
          <div className="ch"><span className="ct">Setup</span><span className="dots">···</span></div>
          <div className="ph"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 21V9"/></svg></div>
          <h3>Almost there</h3>
          <p>{isTeam ? "Connect billing, invite your team, then set each bot's commands." : "Connect billing, then set each bot's commands."}</p>
          <button className="ghost" onClick={() => go("settings")}>Pick up where you left off</button>
        </div>
      ),
      activity: (
        <div className="card" id="tour-activity">
          <div className="ch"><div><span className="ct">Fleet activity</span><div style={{ fontSize: "11px", color: "var(--faint)", marginTop: "2px" }}>This week</div></div><span className="dots">···</span></div>
          <div className="leg"><span><i style={{ background: "var(--accent)" }} />Events</span><span><i style={{ background: "var(--surface2)" }} />Blocked</span></div>
          <div className="chart">{CHART.map((d, i) => (<div className="col" key={i}><div className="bars"><div className="bar buy" style={{ height: d[0] + "%" }} /><div className="bar sell" style={{ height: d[1] + "%" }} /></div><div className="x">{CDAYS[i]}</div></div>))}</div>
          <div className="kpis"><span className="big num">{owned.length ? "8.9" : "0"}<sup>%</sup></span><span className="updelta">▲ 2%</span><span className="vs">vs last week</span></div>
        </div>
      ),
      table: (
        <div className="card assets">
          <div className="thead">
            <div className="tabs" style={{ margin: 0 }}>
              <button className={tableFilter === "all" ? "on" : ""} onClick={() => setTableFilter("all")}>All bots</button>
              <button className={tableFilter === "online" ? "on" : ""} onClick={() => setTableFilter("online")}>Online</button>
              <button className={tableFilter === "warn" ? "on" : ""} onClick={() => setTableFilter("warn")}>Needs attention</button>
            </div>
            <div className="seg"><button className="on">1D</button><button>2W</button><button>1M</button></div>
          </div>
          <div className="tscroll"><table>
            <thead><tr><th>Bot</th><th>Status</th><th>Base</th><th>Add-ons</th><th></th></tr></thead>
            <tbody>
              {owned.filter(filt(tableFilter)).map((b) => (
                <tr key={b.id} onClick={() => openBot(b.id)}>
                  <td><div className="coin"><div className="a">{botSvg(b.base)}</div><div><div className="nm">{b.bot_name}</div><div className="tk">{BOT_BASE_LABELS[b.base] ?? b.base}</div></div></div></td>
                  <td><span style={{ color: stColor(b) }}>● {stWord(b)}</span></td>
                  <td className="num">{BOT_BASE_LABELS[b.base] ?? b.base}</td>
                  <td className="num">{b.addons.length}</td>
                  <td><button className="trade" onClick={(e) => { e.stopPropagation(); openBot(b.id); }}>Manage</button></td>
                </tr>
              ))}
              {owned.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--faint)" }}>No bots yet.</td></tr>}
            </tbody>
          </table></div>
        </div>
      ),
      bots: (
        <div className="card" id="tour-bots">
          <div className="ch"><span className="ct">Your bots</span><span className="dots">···</span></div>
          <div className="tabs">
            <button className={listFilter === "all" ? "on" : ""} onClick={() => setListFilter("all")}>All</button>
            <button className={listFilter === "online" ? "on" : ""} onClick={() => setListFilter("online")}>Online</button>
            <button className={listFilter === "warn" ? "on" : ""} onClick={() => setListFilter("warn")}>Other</button>
          </div>
          <div>
            {owned.filter(filt(listFilter)).map((b) => (
              <div className="tok" key={b.id} onClick={() => openBot(b.id)}>
                <div className="ic">{botSvg(b.base)}</div>
                <div><div className="v">{b.bot_name}</div><div className="s">{stWord(b).toLowerCase()}</div></div>
                <button className="act" onClick={(e) => { e.stopPropagation(); openBot(b.id); }}>Open</button>
              </div>
            ))}
            {owned.length === 0 && <div className="tok"><div><div className="s">No bots yet.</div></div></div>}
          </div>
        </div>
      ),
      spotlight: spotlight ? (
        <div className="card">
          <div className="mhead"><div /><div className="mout" onClick={() => openBot(spotlight.id)}><svg viewBox="0 0 24 24"><path d="M7 17 17 7M9 7h8v8"/></svg></div></div>
          <div className="mname">{spotlight.bot_name} <span className="x">{BOT_BASE_LABELS[spotlight.base] ?? spotlight.base}</span></div>
          <div className="mhot">Your fleet</div>
          <div style={{ marginTop: "14px" }}>
            <div className="mrow"><span className="k">Status</span><span className="v">{stWord(spotlight)}</span></div>
            <div className="mrow"><span className="k">Add-ons</span><span className="v">{spotlight.addons.length}</span></div>
            <div className="mrow" style={{ borderBottom: 0 }}><span className="k">Engine</span><span className="v">{spotlight.engine_version === "v2" ? "V2" : "V1"}</span></div>
          </div>
          <div className="mbtns"><button className="ghost" onClick={() => openBot(spotlight.id)}>Configure</button><button className="cta" style={{ width: "100%" }} onClick={() => openBot(spotlight.id)}>Open bot</button></div>
        </div>
      ) : null,
    };
    const wide = new Set(["table"]);
    const ordered = [
      ...dashOrder.filter((id) => DEFAULT_DASH_ORDER.includes(id) && cells[id] != null),
      ...DEFAULT_DASH_ORDER.filter((id) => !dashOrder.includes(id) && cells[id] != null),
    ];
    dashOrderedRef.current = ordered;

    if (!isAdmin) {
      return (
        <div className="dashgrid">
          {ordered.map((id) => (
            <div key={id} className={"dashcell" + (wide.has(id) ? " wide" : "")}>{cells[id]}</div>
          ))}
        </div>
      );
    }
    return (
      <DndContext sensors={dashSensors} collisionDetection={closestCenter} onDragEnd={onDashDragEnd}>
        <SortableContext items={ordered} strategy={rectSortingStrategy}>
          <div className="dashgrid">
            {ordered.map((id) => (
              <DashSortableCard key={id} id={id} wide={wide.has(id)}>{cells[id]}</DashSortableCard>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    );
  };

  return (
    <div className={"osd" + (appOn ? " app" : "") + (instant ? " instant" : "")} style={{ ["--accent" as any]: accent.c, ["--accentink" as any]: accent.ink }}>
      <style>{OSD_CSS}</style>
      {bgKey !== "none" && bgUrl && <div className="osd-bg" style={{ backgroundImage: `url(${bgUrl})` }} />}
      {bgKey === "none" && <div className="osd-bg" style={{ background: "#1b2026" }} />}
      <div className="osd-scrim" />
      <div className="osd-dim" />

      <div className="osd-stage">
        {/* ONBOARDING */}
        <div className={"overlay" + (appOn ? " hide" : "")}>
          <div className="wcard">
            <div className="wmark">Oversite<span>Bot Dashboard</span></div>
            <h1>Let&apos;s get you set up, {handle}</h1>
            <div className="lead">Your bots are built and ready. Choose how you want to run them.</div>
            <div className="qlab">How do you want to run them?</div>
            <div className="choices">
              <div className={"choice" + (picked === "solo" ? " sel" : "")} onClick={() => setPicked("solo")}>
                <span className="tick"><svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-11"/></svg></span>
                <div className="ci"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg></div>
                <div className="ct2">Just me</div><div className="cd">Private — only you can see and manage the bots.</div>
              </div>
              <div className={"choice" + (picked === "team" ? " sel" : "")} onClick={() => setPicked("team")}>
                <span className="tick"><svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-11"/></svg></span>
                <div className="ci"><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><circle cx="17" cy="9" r="2.6"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M15 20a5 5 0 0 1 6-4"/></svg></div>
                <div className="ct2">With my team</div><div className="cd">Invite people, assign roles, and post announcements.</div>
              </div>
            </div>
            <button className={"wgo" + (picked ? " ready" : "")} onClick={() => picked && chooseMode(picked)}>Continue</button>
            <div className="wnote">You can switch this anytime in Dashboard → Settings → Workspace.</div>
          </div>
        </div>

        {/* FLOATING ANNOUNCEMENT — bottom-right, above dashboard UI. Returns each launch. */}
        {isTeam && annOpen && (
          <div className="annc">
            <div className="bar" />
            <div className="in">
              <div className="hd">
                <span className="ic"><svg viewBox="0 0 24 24"><path d="m3 11 14-6v14L3 13Z"/><path d="M7 19a2 2 0 0 1-4 0v-6"/><path d="M19 9a3 3 0 0 1 0 6"/></svg></span>
                <div className="ht">
                  <div className="t">Announcement <span className="ndot" /></div>
                  <div className="s">From your team</div>
                </div>
                <button className="x" aria-label="Dismiss" onClick={() => setAnnOpen(false)}><svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
              </div>
              <div className="bd">
                <div className="h">Welcome to the team</div>
                <div className="p">Post updates here for everyone with dashboard access.</div>
              </div>
              <div className="ft">
                <div className="by"><span className="av">O</span><div><div className="nm">Oversite Team</div><div className="tm">just now</div></div></div>
                <button className="act" onClick={() => go("team")}>Post<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
              </div>
            </div>
          </div>
        )}

        {/* TOUR */}
        <div className={"tourask" + (tourAsk ? " show" : "")}>
          <div className="tt">Welcome in</div>
          <div className="tb">Want a quick 30-second tour of your dashboard?</div>
          <div className="row">
            <button className="btn-sm btn-pri" style={{ flex: 1 }} onClick={startTour}>Show me around</button>
            <button className="btn-sm" onClick={() => { setTourAsk(false); lsSet(LS.tour, "1"); }}>Maybe later</button>
          </div>
        </div>
        <div className={"tourblock" + (tourOn ? " on" : "")} />
        <div className={"tourring" + (tourOn ? " on" : "")} ref={ringRef} />
        <div className={"tourpop" + (tourOn ? " on" : "")} ref={popRef}>
          <div className="tt">{TOUR[ti]?.title}</div>
          <div className="tb">{TOUR[ti]?.body}</div>
          <div className="nav">
            <span className="ct3">{ti + 1} / {TOUR.length}</span>
            <span className="skip sp" onClick={endTour}>Skip</span>
            {ti > 0 && <button className="btn-sm" onClick={() => setTi(ti - 1)}>Back</button>}
            <button className="btn-sm btn-pri" onClick={() => ti >= TOUR.length - 1 ? endTour() : setTi(ti + 1)}>{ti >= TOUR.length - 1 ? "Done" : "Next"}</button>
          </div>
        </div>

        {/* APP */}
        <div className={"appwrap" + (appOn ? " show" : "")}>
          {/* Admin notice — flush bar across the very top of the screen. */}
          <FixesBar />
          <div className="approw">
          <aside className="side">
            <div className="prof">
              <div className="av">{initial}</div>
              <div>
                <div className="nm">{handle} <span className="pro">{firstOwned ? "OWNER" : "TEAM"}</span></div>
                <div className="h">{user.email}</div>
              </div>
              <span className="ed" onClick={() => go("settings")}><svg width="14" height="14" viewBox="0 0 24 24" style={{ stroke: "currentColor", strokeWidth: 1.8, fill: "none" }}><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></span>
            </div>

            <div className="glab">Menu</div>
            {navItem("dashboard", <svg viewBox="0 0 24 24"><path d="M3 11 12 4l9 7"/><path d="M5 10v9h14v-9"/></svg>, "Dashboard")}
            {navItem("bots", <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>, "My Bots")}
            {navItem("groups", <svg viewBox="0 0 24 24"><circle cx="7" cy="8" r="3"/><circle cx="17" cy="8" r="3"/><path d="M2 19a5 5 0 0 1 10 0M12 19a5 5 0 0 1 10 0"/></svg>, "Groups")}
            {navItem("activity", <svg viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="m7 14 4-4 3 3 5-6"/></svg>, "Activity")}

            <div className="glab">Account</div>
            {navItem("billing", <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/></svg>, "Billing")}
            {isTeam && navItem("team", <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>, "Team")}

            <div className="glab">More</div>
            {navItem("settings", <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.7-1l-.4-2.5H9.6L9.2 6a7 7 0 0 0-1.7 1l-2.4-1-2 3.4L5 11a7 7 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.4 2.5h4.8l.4-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6a7 7 0 0 0 .1-1Z"/></svg>, "Settings")}
            {navItem("support", <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 2.5"/><path d="M12 17h.01"/></svg>, "Support")}

            <div style={{ marginTop: "auto" }} />
            <div className="nav" onClick={() => navigate("/")}><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14.5 14.5 0 0 0 0 18 14.5 14.5 0 0 0 0-18"/></svg>Back to website</div>
            <div className="nav" onClick={() => setConfirmOut(true)}><svg viewBox="0 0 24 24"><path d="M9 21H5V3h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>Sign out</div>
          </aside>

          <div className="main">
            <div className="head">
              <div>
                <div className="crumb">Oversite / <b>{view === "bot" ? "My Bots" : view.charAt(0).toUpperCase() + view.slice(1)}</b>{view === "bot" && activeBot && <> / <b>{activeBot.bot_name}</b></>}</div>
                <h1>{view === "dashboard" ? `Hey, ${handle}` : view === "bot" ? (activeBot?.bot_name ?? "Bot") : view === "bots" ? "My Bots" : view.charAt(0).toUpperCase() + view.slice(1)}</h1>
                <div className="sub">{owned.length} bots · <b>{liveCount} live</b></div>
              </div>
              <div className="htools">
                <label className="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>Search</label>
                <div className="bell" id="tour-bell" onClick={() => go("activity")}><svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>{unread > 0 && <span className="d" />}</div>
                <button className="cta" id="tour-add" onClick={() => go("bots")}>+ Add a bot</button>
              </div>
            </div>

            {/* Hosting payment overdue — renders nothing unless past due. */}
            <HostingPastDueBanner />

            {/* DASHBOARD */}
            <div className={"view" + (view === "dashboard" ? " on" : "")}>
              {renderDash()}
            </div>

            {/* MY BOTS */}
            <div className={"view" + (view === "bots" ? " on" : "")}>
              <div className="ph2"><h2>My Bots</h2><p>{owned.length} bots in your fleet · <span className="drophint">drag to reorder</span></p></div>
              <div className={"botgrid" + (dragActive ? " dragging-active" : "")}>
                {owned.map((b) => (
                  <div className="bcard" key={b.id} draggable onDragStart={() => onDragStart(b.id)} onDragOver={(e) => onDragOver(e, b.id)} onDragEnd={onDragEnd} onClick={() => openBot(b.id)}>
                    <div className="a">{botSvg(b.base)}</div>
                    <div className="nm">{b.bot_name}</div><div className="st" style={{ color: stColor(b) }}>● {stWord(b)}</div>
                    <div className="bstats"><div className="bx"><span className="k">Base</span><span className="v num">{BOT_BASE_LABELS[b.base] ?? b.base}</span></div><div className="bx"><span className="k">Add-ons</span><span className="v num">{b.addons.length}</span></div></div>
                    <button className="ghost" onClick={(e) => { e.stopPropagation(); openBot(b.id); }}>Open</button>
                  </div>
                ))}
                <Link to="/bots" className="addbot" style={{ textDecoration: "none" }}><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Add a bot</Link>
              </div>
            </div>

            {/* GROUPS */}
            <div className={"view" + (view === "groups" ? " on" : "")}>
              <div className="ph2" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "14px", flexWrap: "wrap" }}>
                <div><h2>Groups</h2><p>Bundle bots from a server together, then give a team access to just that bundle.</p></div>
                <button className="cta" onClick={() => { const n = window.prompt("Name this group"); if (n && n.trim()) setGroups((g) => [...g, { id: "g_" + Date.now(), name: n.trim(), botIds: [] }]); }}>+ New group</button>
              </div>
              <div className="groups">
                {groups.length === 0 && <div className="card" style={{ textAlign: "center", color: "var(--faint)", fontSize: "13px" }}>No groups yet. Create one to bundle bots and share access.</div>}
                {groups.map((g) => (
                  <div className="gcard" key={g.id}>
                    <div className="ghd"><div className="gi"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/></svg></div><div><div className="gname">{g.name}</div><div className="gmeta">{g.botIds.length} bots</div></div><span className="dots" style={{ cursor: "pointer" }} onClick={() => setGroups((gs) => gs.filter((x) => x.id !== g.id))}>×</span></div>
                    <div className="gbody">
                      <div>
                        <div className="gcl">Bots in this group</div>
                        <div className="chips">
                          {owned.map((b) => { const inG = g.botIds.includes(b.id); return (<span className={"chip" + (inG ? "" : " add")} key={b.id} style={{ cursor: "pointer" }} onClick={() => setGroups((gs) => gs.map((x) => x.id === g.id ? { ...x, botIds: inG ? x.botIds.filter((y) => y !== b.id) : [...x.botIds, b.id] } : x))}>{inG ? botSvg(b.base) : null}{b.bot_name}{inG && <span className="x">×</span>}</span>); })}
                        </div>
                      </div>
                      <div>
                        <div className="gcl">Team access</div>
                        <div className="chips"><span className="chip add" onClick={() => go("team")}>+ Invite</span></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ACTIVITY */}
            <div className={"view" + (view === "activity" ? " on" : "")}>
              <div className="ph2"><h2>Activity</h2><p>Everything your bots have done, newest first.</p></div>
              <div className="feed" style={{ marginTop: "6px" }}>
                {notifications.length === 0 && <div className="fitem"><div><div className="ttl">No activity yet</div><div className="meta">Events from your bots will show up here.</div></div></div>}
                {notifications.map((n: BotNotification) => (
                  <div className="fitem" key={n.id}><div className="fi" style={{ color: "var(--accent)", background: "rgba(201,219,230,.1)" }}><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg></div><div><div className="ttl">{n.title}</div><div className="meta">{n.body}</div></div><div className="tm">{osTimeAgo(n.created_at)}</div></div>
                ))}
              </div>
            </div>

            {/* BILLING */}
            <div className={"view" + (view === "billing" ? " on" : "")}>
              <div className="ph2"><h2>Billing</h2><p>Plan, payment method, and invoices.</p></div>
              <div className="bgrid">
                <div>
                  <div className="card" style={{ marginBottom: "16px" }}>
                    <div className="planrow"><div><div className="ct">Current plan</div><div className="planname">{owned.length} bot{owned.length === 1 ? "" : "s"} · monthly</div></div><span className="pillok">Active</span></div>
                    <div className="mrow"><span className="k">Bots</span><span className="v">{owned.length}</span></div>
                    <div className="mrow" style={{ borderBottom: 0 }}><span className="k">Manage</span><span className="v">Stripe portal</span></div>
                    <div className="mbtns"><button className="ghost" onClick={() => firstOwned && setCancelTarget(firstOwned)}>Cancel a bot</button><button className="cta" style={{ width: "100%" }} onClick={openPortal}>Manage in portal</button></div>
                  </div>
                  <div className="card"><div className="ch"><span className="ct">Invoices</span></div><p style={{ fontSize: "12.5px", color: "var(--faint)" }}>Your invoices and receipts live in the billing portal.</p></div>
                </div>
                <div className="card"><div className="ch"><span className="ct">Payment method</span></div><div className="pm"><div className="cc" /><div><div className="pmno">Managed in portal</div><div style={{ fontSize: "11px", color: "var(--faint)", marginTop: "2px" }}>Secure Stripe billing</div></div></div><button className="ghost" style={{ marginTop: "12px" }} onClick={openPortal}>Open portal</button></div>
              </div>
            </div>

            {/* TEAM */}
            <div className={"view" + (view === "team" ? " on" : "")}>
              {firstOwned ? (
                <div style={{ position: "relative" }}><GroupTeamHub ownerUserId={user.id} ownerEmail={user.email ?? null} /></div>
              ) : (<div className="ph2"><h2>Team</h2><p>You need an owned bot to manage a team.</p></div>)}
            </div>

            {/* SETTINGS */}
            <div className={"view" + (view === "settings" ? " on" : "")}>
              <div className="ph2"><h2>Settings</h2><p>Your account, workspace, and notifications.</p></div>
              <div className="card" style={{ marginBottom: "16px" }}>
                <div className="ch"><span className="ct">Workspace</span></div>
                <p style={{ fontSize: "12.5px", color: "var(--faint)", marginBottom: "14px" }}>Choose how you run your fleet. Switching to team unlocks members, roles, and announcements.</p>
                <div className="modeopts">
                  <div className={"modeopt" + (wsMode === "solo" ? " on" : "")} onClick={() => { setWsMode("solo"); lsSet(LS.ws, "solo"); }}><div className="mt">Just me <span className="check"><svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-11"/></svg></span></div><div className="md">Private. Only you can see and manage the bots.</div></div>
                  <div className={"modeopt" + (wsMode === "team" ? " on" : "")} onClick={() => { setWsMode("team"); lsSet(LS.ws, "team"); }}><div className="mt">With my team <span className="check"><svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-11"/></svg></span></div><div className="md">Invite people, assign roles, and broadcast announcements.</div></div>
                </div>
                <div style={{ marginTop: "14px" }}><span className="cfg" onClick={() => { lsDel(LS.onboarded); setPicked(null); setInstant(false); setAppOn(false); go("dashboard"); }}>↺ Replay welcome screen</span></div>
              </div>
              <div className="card" style={{ marginBottom: "16px" }}>
                <div className="ch"><span className="ct">Appearance</span></div>
                <p style={{ fontSize: "12.5px", color: "var(--faint)", marginBottom: "14px" }}>Pick the background image for your dashboard.</p>
                <div className="bgopts">
                  {BG_PRESETS.map((p) => (
                    <div className={"bgopt" + (p.key === "none" ? " none" : "") + (bgKey === p.key ? " sel" : "")} key={p.key} onClick={() => { setBgKey(p.key); lsSet(LS.bg, p.key); }} style={p.url ? { backgroundImage: `url(${p.url})` } : undefined}><span className="tk2"><svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-11"/></svg></span><span className="lbl">{p.label}</span></div>
                  ))}
                </div>
                <button className="ghost"><svg viewBox="0 0 24 24" width="14" height="14" style={{ display: "inline-block", verticalAlign: "-2px", marginRight: "6px", stroke: "currentColor", strokeWidth: 1.8, fill: "none" }}><path d="M12 16V4m0 0L8 8m4-4 4 4"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>Upload your own</button>
                <div style={{ fontFamily: "var(--disp)", fontSize: "10px", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--faint)", margin: "20px 0 10px" }}>Primary color</div>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                  {ACCENTS.map((a) => (
                    <button key={a.key} title={a.label} onClick={() => { setAccentKey(a.key); lsSet(LS.accent, a.key); }}
                      style={{ height: "30px", width: "30px", borderRadius: "999px", background: a.c, cursor: "pointer", border: accentKey === a.key ? "2px solid var(--heading)" : "2px solid transparent", boxShadow: "0 0 0 1px var(--hair)" }} />
                  ))}
                  {/* custom color: native picker swatch + hex field */}
                  <label title="Pick a custom color" style={{ position: "relative", height: "30px", width: "30px", borderRadius: "999px", overflow: "hidden", cursor: "pointer", display: "inline-block", background: /^#[0-9a-fA-F]{6}$/.test(customHex) ? customHex : "var(--panel)", border: accentKey === "custom" ? "2px solid var(--heading)" : "2px dashed var(--hair)", boxShadow: "0 0 0 1px var(--hair)" }}>
                    <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(customHex) ? customHex : "#C9DBE6"} onChange={(e) => applyCustom(e.target.value)} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }} />
                  </label>
                  <input value={customHex} onChange={(e) => { const v = e.target.value; setCustomHex(v); if (/^#[0-9a-fA-F]{6}$/.test(v)) applyCustom(v); }} placeholder="#C9DBE6" maxLength={7} spellCheck={false}
                    style={{ background: "var(--panel)", border: "1px solid var(--hair)", borderRadius: "8px", padding: "7px 10px", color: "var(--heading)", fontFamily: "var(--mono)", fontSize: "12px", width: "104px", textTransform: "uppercase" }} />
                </div>
              </div>
              <div className="card" style={{ marginTop: "16px" }}><div className="ch"><span className="ct">Tour</span></div><p style={{ fontSize: "12.5px", color: "var(--faint)", marginBottom: "14px" }}>Replay the guided dashboard tour.</p><button className="ghost" style={{ maxWidth: "240px" }} onClick={() => { lsDel(LS.tour); go("dashboard"); startTour(); }}>↺ Replay dashboard tour</button></div>
            </div>

            {/* SUPPORT */}
            <div className={"view" + (view === "support" ? " on" : "")}>
              <div className="ph2"><h2>Support</h2><p>We usually reply within a few hours.</p></div>
              <div className="bgrid">
                <div className="card"><div className="ch"><span className="ct">Contact us</span></div><p style={{ fontSize: "12.5px", color: "var(--faint)", lineHeight: 1.5, marginBottom: "14px" }}>Email <span style={{ color: "var(--accent)" }}>support@oversite.shop</span> or open a ticket in our Discord.</p><div className="mbtns"><a className="ghost" href="mailto:support@oversite.shop" style={{ textDecoration: "none", textAlign: "center" }}>Email us</a><a className="cta" href="https://discord.gg/oversite" target="_blank" rel="noreferrer" style={{ width: "100%", textDecoration: "none", textAlign: "center" }}>Join Discord</a></div><button className="ghost" style={{ marginTop: "10px" }} onClick={() => { lsDel(LS.tour); go("dashboard"); startTour(); }}>↺ Replay dashboard tour</button></div>
                <div className="card"><div className="ch"><span className="ct">Quick answers</span></div><div className="togrow" style={{ cursor: "pointer" }}><div className="tl">How do I add a bot to my server?</div><span className="dots">›</span></div><div className="togrow" style={{ cursor: "pointer" }}><div className="tl">Can I cancel anytime?</div><span className="dots">›</span></div><div className="togrow" style={{ cursor: "pointer" }}><div className="tl">How do refunds work?</div><span className="dots">›</span></div></div>
              </div>
            </div>

            {/* PER-BOT — real working blocks */}
            <div className={"view" + (view === "bot" ? " on" : "")}>
              {activeBot && (
                <>
                  <span className="back" onClick={() => go("bots")}><svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg> Back to my bots</span>
                  <ReadOnlyBotScope botId={activeBot.id} ownerUserId={activeBot.ownerUserId} viaTeam={activeBot.viaTeam}>
                    <BotSection bot={activeBot} allBots={dashboardBots} userId={user.id} ownerEmail={user.email} freePeriod={freePeriods[activeBot.id]} onCancel={setCancelTarget} onAddAddons={setAddonsTarget} searchQuery="" highlightedAddonId={null} onReload={() => { reload(); reloadFreePeriods(); }} />
                  </ReadOnlyBotScope>
                </>
              )}
            </div>
          </div>
          </div>
        </div>
      </div>

      <NewOwnerBillingDialog forceOpen={new URLSearchParams(window.location.search).get("team_transfer") === "accepted"} />
      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && !cancelling && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Cancel subscription for "{cancelTarget?.bot_name}"?</AlertDialogTitle><AlertDialogDescription>This stops recurring payments and hosting, takes the bot offline, and removes it from your dashboard.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={cancelling}>Keep subscription</AlertDialogCancel><AlertDialogAction disabled={cancelling} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={(e) => { e.preventDefault(); if (cancelTarget) cancelOrder(cancelTarget); }}>{cancelling ? "Cancelling…" : "Yes, cancel"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AddAddonsDialog bot={addonsTarget} open={!!addonsTarget} onOpenChange={(o) => !o && setAddonsTarget(null)} />
      <AlertDialog open={confirmOut} onOpenChange={setConfirmOut}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Sign out?</AlertDialogTitle><AlertDialogDescription>You'll need to sign back in to access your dashboard.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={(e) => { e.preventDefault(); setConfirmOut(false); signOut(); }}>Sign out</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default BotDashboard;
