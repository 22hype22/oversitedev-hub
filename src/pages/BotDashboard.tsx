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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { AddAddonsDialog } from "@/components/dashboard/AddAddonsDialog";
import { SortableAddonGrid } from "@/components/dashboard/SortableAddonGrid";
import { AddonConfigCard } from "@/components/dashboard/AddonConfigCard";
import { FixesBar } from "@/components/dashboard/FixesBar";
import { BotIdentityEditor } from "@/components/dashboard/BotIdentityEditor";
import { HexagonLoader } from "@/components/dashboard/HexagonLoader";
import { RedeemFreeCodeBox } from "@/components/dashboard/RedeemFreeCodeBox";
import { BotSecretsManager } from "@/components/dashboard/BotSecretsManager";
import { SupportAccessManager } from "@/components/dashboard/SupportAccessManager";
import { useBotFreePeriods, type BotFreePeriod } from "@/hooks/useBotFreePeriods";
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
  Code2,
  RefreshCw,
  AlertTriangle,
  Gift,
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

const FAKE_SOURCE_FILES: { name: string; lang: string; code: string }[] = [
  {
    name: "index.ts",
    lang: "typescript",
    code: `import { Client, GatewayIntentBits } from "discord.js";
import { loadAddons } from "./core/addons";
import { registerCommands } from "./core/commands";
import { env } from "./config/env";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.once("ready", async () => {
  console.log(\`✅ Logged in as \${client.user?.tag}\`);
  await loadAddons(client);
  await registerCommands(client);
});

client.login(env.DISCORD_TOKEN);`,
  },
  {
    name: "core/addons.ts",
    lang: "typescript",
    code: `import type { Client } from "discord.js";
import { antiSpam } from "../addons/anti-spam";
import { moderationHistory } from "../addons/moderation-history";
import { ticketSystem } from "../addons/tickets";

const ENABLED_ADDONS = [antiSpam, moderationHistory, ticketSystem];

export async function loadAddons(client: Client) {
  for (const addon of ENABLED_ADDONS) {
    try {
      await addon.register(client);
      console.log(\`  → loaded \${addon.id}\`);
    } catch (err) {
      console.error(\`  ✗ failed to load \${addon.id}\`, err);
    }
  }
}`,
  },
  {
    name: "addons/anti-spam.ts",
    lang: "typescript",
    code: `import type { Client, Message } from "discord.js";

const recent = new Map<string, number[]>();
const WINDOW_MS = 5_000;
const LIMIT = 5;

export const antiSpam = {
  id: "anti-spam",
  register(client: Client) {
    client.on("messageCreate", (msg: Message) => {
      if (msg.author.bot) return;
      const now = Date.now();
      const list = (recent.get(msg.author.id) ?? []).filter(
        (t) => now - t < WINDOW_MS,
      );
      list.push(now);
      recent.set(msg.author.id, list);
      if (list.length > LIMIT) {
        msg.delete().catch(() => {});
        msg.channel.send(\`⚠️ <@\${msg.author.id}> slow down!\`);
      }
    });
  },
};`,
  },
];

const SourceCodeCard = ({ sourceUrl }: { sourceUrl: string | null }) => {
  const hasUrl = !!sourceUrl;
  const [previewOpen, setPreviewOpen] = useState(false);
  const [activeFile, setActiveFile] = useState(0);

  return (
    <>
      <Card className="bg-card/40 border-border p-6 flex flex-col h-[210px] hover:border-primary/40 transition-smooth">
        <div className="flex items-start gap-3 mb-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/30 grid place-items-center shrink-0">
            <Github className="h-5 w-5 text-primary" />
          </div>
          <h3 className="font-semibold text-base leading-tight pt-1.5">Source code</h3>
        </div>
        <p className="text-sm text-muted-foreground flex-1">
          {hasUrl
            ? "View, edit, revert, and submit code changes for your bot on GitHub."
            : "Preview your bot's source. The full GitHub repo unlocks once our team sets it up."}
        </p>
        <div className="mt-3">
          {hasUrl ? (
            <Button variant="outline" size="sm" className="w-full" asChild>
              <a href={sourceUrl!} target="_blank" rel="noopener noreferrer">
                <Github className="h-4 w-4 mr-1.5" />
                Open on GitHub
              </a>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setPreviewOpen(true)}
            >
              <Code2 className="h-4 w-4 mr-1.5" />
              Preview source
            </Button>
          )}
        </div>
      </Card>

      <FakeSourceDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        activeFile={activeFile}
        setActiveFile={setActiveFile}
      />
    </>
  );
};

const FakeSourceDialog = ({
  open,
  onOpenChange,
  activeFile,
  setActiveFile,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  activeFile: number;
  setActiveFile: (i: number) => void;
}) => {
  const file = FAKE_SOURCE_FILES[activeFile];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2">
            <Github className="h-5 w-5 text-primary" />
            Source preview
            <Badge variant="secondary" className="ml-2 text-[10px]">Demo</Badge>
          </DialogTitle>
          <DialogDescription>
            A sample of what your bot's source will look like. Real code lives on GitHub once setup is complete.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-[180px_1fr] h-[420px]">
          <div className="border-r border-border bg-card/40 overflow-y-auto py-2">
            {FAKE_SOURCE_FILES.map((f, i) => (
              <button
                key={f.name}
                type="button"
                onClick={() => setActiveFile(i)}
                className={`w-full text-left px-3 py-2 text-xs font-mono transition-smooth ${
                  i === activeFile
                    ? "bg-primary/10 text-primary border-l-2 border-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-card border-l-2 border-transparent"
                }`}
              >
                {f.name}
              </button>
            ))}
          </div>
          <div className="overflow-auto bg-background">
            <div className="px-4 py-2 border-b border-border text-xs text-muted-foreground font-mono flex items-center justify-between">
              <span>{file.name}</span>
              <span className="uppercase tracking-wide">{file.lang}</span>
            </div>
            <pre className="text-xs font-mono p-4 leading-relaxed text-foreground whitespace-pre">
              {file.code}
            </pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
  freePeriod,
  onCancel,
  onAddAddons,
  onReload,
}: {
  bot: OwnedBot;
  allBots: OwnedBot[];
  userId: string;
  freePeriod?: BotFreePeriod;
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

      {!bot.isDemo && (
        <EngineVersionSwitcher bot={bot} onReload={onReload} />
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

      {!bot.isDemo && (
        <BotSecretsManager botId={bot.id} ownedAddons={ownedAddons} />
      )}

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
            const isSharedFlat = group.key === "shared";
            return (
              <div key={group.key} className="space-y-4">
                <div className="flex items-center gap-2">
                  <GroupIcon className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                    {group.label} ({group.owned.length + (showSourceCard ? 1 : 0)})
                  </h4>
                </div>
                {isSharedFlat ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {showSourceCard && <SourceCodeCard sourceUrl={bot.source_url} />}
                    {group.owned.map((id) => (
                      <AddonConfigCard
                        key={`${bot.id}-${id}`}
                        addonId={id}
                        botName={bot.bot_name}
                        botAvatarUrl={bot.icon_url}
                      />
                    ))}
                  </div>
                ) : (
                  <SortableAddonGrid
                    userId={userId}
                    botId={bot.id}
                    botName={bot.bot_name}
                    botAvatarUrl={bot.icon_url}
                    groupKey={group.key}
                    ids={group.owned}
                  />
                )}
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
  const { periods: freePeriods, reload: reloadFreePeriods } = useBotFreePeriods();
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
            {dashboardBots.map((bot) => (
              <BotSection
                key={bot.id}
                bot={bot}
                allBots={dashboardBots}
                userId={user.id}
                freePeriod={freePeriods[bot.id]}
                onCancel={setCancelTarget}
                onAddAddons={setAddonsTarget}
                onReload={() => {
                  reload();
                  reloadFreePeriods();
                }}
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
