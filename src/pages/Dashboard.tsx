import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import {
  usePreferences,
  CURRENCY_LABELS,
  LANGUAGE_LABELS,
  TIMEZONES,
  type Currency,
  type Language,
  type ContactMethod,
} from "@/hooks/usePreferences";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  LayoutDashboard,
  ShoppingBag,
  Settings as SettingsIcon,
  Shield,
  Download,
  Mail,
  KeyRound,
  Trash2,
  ExternalLink,
  Sun,
  Moon,
  Bell,
  Globe,
  Clock,
  MessagesSquare,
  CreditCard,
  Sparkles,
  ArrowUpCircle,
  Bot,
  XCircle,
} from "lucide-react";
import { CheckoutDialog, type CheckoutItem } from "@/components/CheckoutDialog";
import { RobuxPurchaseDialog, type RobuxPurchaseProduct } from "@/components/RobuxPurchaseDialog";
import { UpgradeNotice } from "@/components/UpgradeNotice";
import { compareVersions } from "@/lib/utils";
import { getStripeEnvironment } from "@/lib/stripe";
import { useMarketingSuspended } from "@/hooks/useMarketingSuspended";

type Purchase = {
  id: string;
  product_id: string | null;
  product_name: string;
  amount_cents: number;
  currency: string;
  status: string;
  created_at: string;
  file_url: string | null;
  file_name: string | null;
  environment: string;
  version: string | null;
  source?: "stripe" | "gamepass";
  // Resolved client-side
  latest_version?: string | null;
  upgrade_price?: number | null;
  upgrade_price_robux?: number | null;
  upgrade_gamepass_url?: string | null;
};

type Membership = {
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
} | null;

type Profile = {
  id?: string;
  roblox_username: string;
  discord_username: string;
};

export default function Dashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { prefs, setPrefs, formatPrice, formatDate } = usePreferences();
  const { suspended } = useMarketingSuspended();

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [purchasesLoading, setPurchasesLoading] = useState(true);

  type BotOrder = {
    id: string;
    bot_name: string;
    base: string;
    addons: string[] | null;
    monthly_hosting: boolean;
    status: string;
    total_amount: number | string;
    currency: string;
    created_at: string;
    submitted_at: string | null;
  };
  type BotJob = {
    order_id: string;
    status: string;
    delivery_url: string | null;
    error_message: string | null;
  };
  const [botOrders, setBotOrders] = useState<BotOrder[]>([]);
  const [botJobs, setBotJobs] = useState<Record<string, BotJob>>({});
  const [botOrdersLoading, setBotOrdersLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<BotOrder | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [robloxUsername, setRobloxUsername] = useState("");
  const [discordUsername, setDiscordUsername] = useState("");

  const [emailUpdating, setEmailUpdating] = useState(false);
  const [newEmail, setNewEmail] = useState("");

  const [passwordUpdating, setPasswordUpdating] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [portalLoading, setPortalLoading] = useState(false);

  // Membership + upgrade state
  const [membership, setMembership] = useState<Membership>(null);
  const [membershipCheckoutItems, setMembershipCheckoutItems] = useState<
    CheckoutItem[] | null
  >(null);
  const [upgradeCheckout, setUpgradeCheckout] = useState<CheckoutItem[] | null>(null);
  const [upgradeRobux, setUpgradeRobux] = useState<
    | (RobuxPurchaseProduct & { parentPurchaseId: string; upgradeMode: true })
    | null
  >(null);
  const [robuxUpgradePromptOpen, setRobuxUpgradePromptOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  const loadPurchases = useCallback(async () => {
    if (!user) return;
    setPurchasesLoading(true);
    const filters = [`user_id.eq.${user.id}`];
    if (user.email) filters.push(`email.eq.${user.email.toLowerCase()}`);

    const stripeReq = supabase
      .from("purchases")
      .select(
        "id,product_id,product_name,amount_cents,currency,status,created_at,file_url,file_name,environment,version",
      )
      .or(filters.join(","))
      .eq("status", "paid")
      .order("created_at", { ascending: false });

    const profileReq = supabase
      .from("profiles")
      .select("roblox_username")
      .eq("user_id", user.id)
      .maybeSingle();

    const [{ data: stripeData, error }, { data: profile }] = await Promise.all([
      stripeReq,
      profileReq,
    ]);

    if (error) {
      toast.error("Couldn't load your purchases");
      setPurchasesLoading(false);
      return;
    }

    const stripeRows = ((stripeData as Purchase[]) ?? []).map((row) => ({
      ...row,
      source: "stripe" as const,
    }));

    let gamepassRows: Purchase[] = [];
    if (profile?.roblox_username) {
      const { data: pendingRows } = await supabase
        .from("pending_purchases")
        .select("id,product_id,created_at,version")
        .eq("status", "fulfilled")
        .ilike("roblox_username", profile.roblox_username)
        .order("fulfilled_at", { ascending: false });

      const pendingProductIds = Array.from(
        new Set(((pendingRows as any[]) ?? []).map((r) => r.product_id).filter(Boolean)),
      );

      let pendingProductMap = new Map<string, any>();
      if (pendingProductIds.length > 0) {
        const { data: pendingProducts } = await (supabase as any)
          .from("product_catalog")
          .select("id,name")
          .in("id", pendingProductIds);
        pendingProductMap = new Map((pendingProducts ?? []).map((p: any) => [p.id, p]));
      }

      gamepassRows = ((pendingRows as any[]) ?? [])
        .filter((row) => !!row.product_id)
        .map((row) => ({
          id: row.id,
          product_id: row.product_id,
          product_name: pendingProductMap.get(row.product_id)?.name ?? "Product",
          amount_cents: 0,
          currency: "robux",
          status: "paid",
          created_at: row.created_at,
          file_url: null,
          file_name: null,
          environment: "live",
          version: row.version ?? null,
          source: "gamepass" as const,
        }));
    }

    const rows = [...stripeRows, ...gamepassRows].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    const productIds = Array.from(
      new Set(rows.map((r) => r.product_id).filter((x): x is string => !!x)),
    );
    let productMap = new Map<string, any>();
    if (productIds.length > 0) {
      const { data: prods } = await (supabase as any)
        .from("product_catalog")
        .select(
          "id,current_version,price,price_robux,gamepass_url,upgrade_price,upgrade_price_robux,upgrade_gamepass_url",
        )
        .in("id", productIds);
      productMap = new Map((prods || []).map((p: any) => [p.id, p]));
    }
    const enriched: Purchase[] = rows.map((r) => {
      const p = r.product_id ? productMap.get(r.product_id) : null;
      const fallbackPrice =
        p?.upgrade_price && Number(p.upgrade_price) > 0
          ? Number(p.upgrade_price)
          : p?.price != null
          ? Number(p.price)
          : null;
      return {
        ...r,
        latest_version: p?.current_version ?? null,
        upgrade_price: fallbackPrice,
        upgrade_price_robux: p?.upgrade_price_robux ?? p?.price_robux ?? null,
        upgrade_gamepass_url: p?.upgrade_gamepass_url ?? p?.gamepass_url ?? null,
      };
    });
    setPurchases(enriched);
    setPurchasesLoading(false);
  }, [user]);

  const loadMembership = async () => {
    if (!user) return;
    const env = getStripeEnvironment();
    const { data } = await supabase
      .from("subscriptions")
      .select("status,current_period_end,cancel_at_period_end")
      .eq("user_id", user.id)
      .eq("environment", env)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setMembership((data as Membership) ?? null);
  };

  const loadBotOrders = useCallback(async () => {
    if (!user) return;
    setBotOrdersLoading(true);
    const [{ data: orders, error }, { data: jobs }] = await Promise.all([
      (supabase as any)
        .from("bot_orders")
        .select("id,bot_name,base,addons,monthly_hosting,status,total_amount,currency,created_at,submitted_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("bot_build_jobs")
        .select("order_id,status,delivery_url,error_message")
        .eq("user_id", user.id),
    ]);
    if (error) {
      toast.error("Couldn't load your bot orders");
      setBotOrdersLoading(false);
      return;
    }
    setBotOrders((orders as BotOrder[]) ?? []);
    const jobMap: Record<string, BotJob> = {};
    ((jobs as BotJob[]) ?? []).forEach((j) => {
      jobMap[j.order_id] = j;
    });
    setBotJobs(jobMap);
    setBotOrdersLoading(false);
  }, [user]);

  // Self-serve cancel: only allowed while the order is still draft or
  // submitted (i.e. work hasn't started). Once paid, the customer must
  // contact support so we can refund + stop any in-flight build job.
  const canCancelOrder = (status: string) =>
    status === "draft" || status === "submitted";

  const cancelOrder = async (order: BotOrder) => {
    if (!user) return;
    if (!canCancelOrder(order.status)) {
      toast.error("This order can no longer be cancelled — please contact support.");
      return;
    }
    setCancelling(true);
    const { error } = await (supabase as any)
      .from("bot_orders")
      .update({ status: "cancelled" })
      .eq("id", order.id)
      .eq("user_id", user.id);
    setCancelling(false);
    if (error) {
      toast.error("Couldn't cancel — " + error.message);
      return;
    }
    toast.success(`Cancelled "${order.bot_name}"`);
    setCancelTarget(null);
    loadBotOrders();
  };

  const isMemberActive = (() => {
    if (!membership) return false;
    const periodEnd = membership.current_period_end
      ? new Date(membership.current_period_end).getTime()
      : null;
    const future = !periodEnd || periodEnd > Date.now();
    return (
      (["active", "trialing", "past_due"].includes(membership.status) && future) ||
      (membership.status === "canceled" && !!periodEnd && periodEnd > Date.now())
    );
  })();

  const handleDownload = async (p: Purchase) => {
    if (suspended) {
      toast.error("Downloads are temporarily unavailable while Oversite Marketing is suspended.");
      return;
    }
    // Members get the latest version of every product. Otherwise serve
    // the exact version they paid for.
    const targetVersion =
      isMemberActive && p.latest_version ? p.latest_version : p.version;

    let path: string | null = null;
    if (targetVersion && p.product_id) {
      const { data: vRow } = await supabase
        .from("product_versions")
        .select("file_url")
        .eq("product_id", p.product_id)
        .eq("version", targetVersion)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (vRow?.file_url) path = vRow.file_url as string;
    }
    if (!path && p.file_url) {
      path = p.file_url;
      const marker = "/product-files/";
      const idx = path.indexOf(marker);
      if (idx !== -1) path = path.slice(idx + marker.length);
    }
    if (!path) {
      toast.error("No file is available for this purchase");
      return;
    }
    const { data, error } = await supabase.storage
      .from("product-files")
      .createSignedUrl(path, 60 * 10);
    if (error || !data?.signedUrl) {
      toast.error("Couldn't generate download link");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const startUpgradeStripe = (p: Purchase) => {
    if (!p.product_id || !p.upgrade_price || !p.latest_version) return;
    setUpgradeCheckout([
      {
        productId: p.product_id,
        productName: `${p.product_name} — Upgrade to ${p.latest_version}`,
        amountCents: Math.round(Number(p.upgrade_price) * 100),
        currency: "usd",
        quantity: 1,
        purchaseType: "upgrade",
        parentPurchaseId: p.id,
        upgradeToVersion: p.latest_version,
      },
    ]);
  };

  const startUpgradeRobux = (_p: Purchase) => {
    setRobuxUpgradePromptOpen(true);
  };

  useEffect(() => {
    if (!user) return;
    setNewEmail(user.email ?? "");
    loadPurchases();
    loadMembership();
    loadBotOrders();

    (async () => {
      setProfileLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id,roblox_username,discord_username")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) {
        toast.error("Couldn't load your profile");
      } else if (data) {
        setProfile(data as Profile);
        setRobloxUsername(data.roblox_username ?? "");
        setDiscordUsername(data.discord_username ?? "");
      }
      setProfileLoading(false);
    })();
  }, [user, loadPurchases, loadBotOrders]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`dashboard-purchases-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "purchases" },
        () => loadPurchases(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pending_purchases" },
        () => loadPurchases(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles", filter: `user_id=eq.${user.id}` },
        () => loadPurchases(),
      )
      .subscribe();

    const onFocus = () => loadPurchases();
    window.addEventListener("focus", onFocus);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("focus", onFocus);
    };
  }, [user, loadPurchases]);

  const saveProfile = async () => {
    if (!user) return;
    if (!robloxUsername.trim() || !discordUsername.trim()) {
      toast.error("Both usernames are required");
      return;
    }
    if (robloxUsername.length > 50 || discordUsername.length > 50) {
      toast.error("Usernames must be 50 characters or less");
      return;
    }
    setSavingProfile(true);
    const payload = {
      user_id: user.id,
      roblox_username: robloxUsername.trim(),
      discord_username: discordUsername.trim(),
    };
    const { error } = profile?.id
      ? await supabase.from("profiles").update(payload).eq("user_id", user.id)
      : await supabase.from("profiles").insert(payload);
    setSavingProfile(false);
    if (error) {
      toast.error(error.message || "Failed to save profile");
      return;
    }
    toast.success("Profile updated");
    setProfile({ ...payload, id: profile?.id });
  };

  const updateEmail = async () => {
    if (!newEmail || newEmail === user?.email) return;
    setEmailUpdating(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    setEmailUpdating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Confirmation sent — check both your old and new email");
  };

  const updatePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    setPasswordUpdating(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordUpdating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated");
    setNewPassword("");
    setConfirmPassword("");
  };

  const openCustomerPortal = async () => {
    setPortalLoading(true);
    const { data, error } = await supabase.functions.invoke("customer-portal", {
      body: { returnUrl: window.location.origin + "/dashboard" },
    });
    setPortalLoading(false);
    if (error || !data?.url) {
      toast.error(
        "Couldn't open the payment portal. You may not have any saved payment methods yet.",
      );
      return;
    }
    window.location.href = data.url as string;
  };

  if (loading || !user) return null;

  // Purchases list is already filtered to paid rows in loadPurchases.

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto pt-24 pb-16 px-4 max-w-5xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-11 w-11 rounded-md bg-primary/10 text-primary inline-flex items-center justify-center">
            <LayoutDashboard size={22} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>

        <Tabs defaultValue="purchases" className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full max-w-2xl">
            <TabsTrigger value="purchases">
              <ShoppingBag size={14} className="mr-1.5" />
              Purchases
            </TabsTrigger>
            <TabsTrigger value="bots">
              <Bot size={14} className="mr-1.5" />
              Bot Orders
            </TabsTrigger>
            <TabsTrigger value="settings">
              <SettingsIcon size={14} className="mr-1.5" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="privacy">
              <Shield size={14} className="mr-1.5" />
              Privacy
            </TabsTrigger>
          </TabsList>

          {/* PURCHASES */}
          <TabsContent value="purchases" className="space-y-4">
            {/* Membership card */}
            <Card className="p-6 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles size={16} className="text-primary" />
                    <h2 className="font-semibold">Oversite Pro</h2>
                    {isMemberActive ? (
                      <Badge className="text-[10px]">
                        {membership?.cancel_at_period_end ? "Ending soon" : "Active"}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">
                        Not active
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {isMemberActive
                      ? `You get the latest version of every product you've purchased — automatically. ${
                          membership?.current_period_end
                            ? `${
                                membership?.cancel_at_period_end ? "Ends" : "Renews"
                              } ${formatDate(membership.current_period_end)}.`
                            : ""
                        }`
                      : "$9/month — instantly unlock the newest version of every product you own. Cancel anytime."}
                  </p>
                </div>
                <div className="flex gap-2">
                  {isMemberActive ? (
                    <Button
                      onClick={openCustomerPortal}
                      disabled={portalLoading}
                      variant="outline"
                      size="sm"
                    >
                      {portalLoading ? "Opening…" : "Manage"}
                      <ExternalLink size={12} className="ml-1.5" />
                    </Button>
                  ) : (
                    <Button
                      variant="hero"
                      size="sm"
                      disabled={suspended}
                      onClick={() => {
                        if (suspended) {
                          toast.error("Memberships are temporarily unavailable while Oversite Marketing is suspended.");
                          return;
                        }
                        setMembershipCheckoutItems([
                          { priceId: "oversite_pro_monthly", quantity: 1 },
                        ]);
                      }}
                    >
                      <Sparkles size={14} className="mr-1.5" />
                      {suspended ? "Unavailable" : "Subscribe"}
                    </Button>
                  )}
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <div>
                  <h2 className="font-semibold">Your purchases</h2>
                  <p className="text-sm text-muted-foreground">
                    {purchases.length} total
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={loadPurchases} variant="outline" size="sm">
                    Refresh
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/products">Browse products</Link>
                  </Button>
                </div>
              </div>

              {purchasesLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : purchases.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-border rounded-lg">
                  <ShoppingBag size={32} className="mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground mb-4">
                    No purchases yet.
                  </p>
                  <Button asChild variant="hero" size="sm">
                    <Link to="/products">Shop now</Link>
                  </Button>
                </div>
              ) : (
                <>
                  {!isMemberActive && (
                    <UpgradeNotice className="mb-4" />
                  )}
                  <ul className="divide-y divide-border">
                    {purchases.map((p) => {
                      const usd = p.amount_cents / 100;
                      const hasNewer =
                        !!p.latest_version &&
                        !!p.version &&
                        compareVersions(p.latest_version, p.version) > 0;
                      const canStripeUpgrade =
                        hasNewer && !!p.upgrade_price && p.upgrade_price > 0;
                      const canRobuxUpgrade = hasNewer;
                      const purchaseLabel =
                        p.source === "gamepass"
                          ? "Robux purchase"
                          : formatPrice(usd);
                      return (
                        <li key={p.id} className="py-4 space-y-2">
                          <div className="flex items-center justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium truncate">{p.product_name}</p>
                                {p.version && (
                                  <Badge variant="secondary" className="text-[10px] font-mono">
                                    {p.version}
                                  </Badge>
                                )}
                                {p.source === "gamepass" && (
                                  <Badge variant="outline" className="text-[10px]">
                                    robux
                                  </Badge>
                                )}
                                {hasNewer && !isMemberActive && (
                                  <Badge variant="outline" className="text-[10px] font-mono border-primary/40 text-primary">
                                    ↑ {p.latest_version}
                                  </Badge>
                                )}
                                {isMemberActive && hasNewer && (
                                  <Badge className="text-[10px] font-mono">
                                    Latest: {p.latest_version}
                                  </Badge>
                                )}
                                {p.environment === "sandbox" && (
                                  <Badge variant="outline" className="text-[10px]">
                                    test
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatDate(p.created_at)} · {purchaseLabel}
                              </p>
                            </div>
                          {(p.file_url || p.version) ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={suspended}
                              title={suspended ? "Downloads paused while Oversite Marketing is suspended" : undefined}
                              onClick={() => handleDownload(p)}
                            >
                              <Download size={14} className="mr-1.5" />
                              {suspended ? "Paused" : "Download"}
                            </Button>
                          ) : null}
                        </div>
                        {hasNewer && !isMemberActive && (canStripeUpgrade || canRobuxUpgrade) && (
                          <div className="flex flex-wrap items-center gap-2 pl-1">
                            <span className="text-xs text-muted-foreground">
                              Version Upgrade:
                            </span>
                            {canStripeUpgrade && (
                              <span className="text-sm font-semibold">
                                {formatPrice(Number(p.upgrade_price))}
                              </span>
                            )}
                            {canRobuxUpgrade && p.upgrade_price_robux ? (
                              <span className="text-xs text-muted-foreground">
                                {canStripeUpgrade ? "or " : ""}R$ {p.upgrade_price_robux.toLocaleString()}
                              </span>
                            ) : null}
                            <div className="flex gap-2 ml-auto">
                              {canStripeUpgrade && (
                                <Button
                                  size="sm"
                                  variant="hero"
                                  onClick={() => startUpgradeStripe(p)}
                                  aria-label={`Upgrade with card for ${formatPrice(Number(p.upgrade_price))}`}
                                  title={`Upgrade with card · ${formatPrice(Number(p.upgrade_price))}`}
                                >
                                  <CreditCard size={14} />
                                </Button>
                              )}
                              {canRobuxUpgrade && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => startUpgradeRobux(p)}
                                  aria-label="Upgrade with Robux via support ticket"
                                  title={p.upgrade_price_robux ? `Upgrade with Robux · R$ ${p.upgrade_price_robux.toLocaleString()} (via ticket)` : "Upgrade with Robux (via ticket)"}
                                >
                                  <span
                                    aria-hidden
                                    className="inline-flex h-3.5 w-3.5 items-center justify-center font-bold text-[10px] leading-none"
                                  >
                                    R$
                                  </span>
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
                </>
              )}
            </Card>
          </TabsContent>

          {/* BOT ORDERS */}
          <TabsContent value="bots" className="space-y-4">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <div>
                  <h2 className="font-semibold flex items-center gap-2">
                    <Bot size={16} className="text-primary" />
                    My Bot Orders
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {botOrders.length} total
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={loadBotOrders} variant="outline" size="sm">
                    Refresh
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/bots">Build a bot</Link>
                  </Button>
                </div>
              </div>

              {botOrdersLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : botOrders.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-border rounded-lg">
                  <Bot size={32} className="mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground mb-4">
                    No bot orders yet.
                  </p>
                  <Button asChild variant="hero" size="sm">
                    <Link to="/bots">Build your first bot</Link>
                  </Button>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {botOrders.map((o) => {
                    const job = botJobs[o.id];
                    const orderStatus = o.status;
                    const jobStatus = job?.status;
                    const statusColor: Record<string, string> = {
                      draft: "bg-muted text-muted-foreground",
                      submitted: "bg-amber-500/15 text-amber-600 border border-amber-500/30",
                      paid: "bg-blue-500/15 text-blue-600 border border-blue-500/30",
                      pending: "bg-amber-500/15 text-amber-600 border border-amber-500/30",
                      claimed: "bg-blue-500/15 text-blue-600 border border-blue-500/30",
                      building: "bg-blue-500/15 text-blue-600 border border-blue-500/30",
                      ready: "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30",
                      delivered: "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30",
                      failed: "bg-destructive/15 text-destructive border border-destructive/30",
                    };
                    const total = Number(o.total_amount) || 0;
                    return (
                      <li key={o.id} className="py-4 space-y-2">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium truncate">{o.bot_name}</p>
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${statusColor[orderStatus] ?? ""}`}
                              >
                                {orderStatus}
                              </Badge>
                              {jobStatus && (
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${statusColor[jobStatus] ?? ""}`}
                                >
                                  build: {jobStatus}
                                </Badge>
                              )}
                              {o.monthly_hosting && (
                                <Badge variant="secondary" className="text-[10px]">
                                  hosted
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Base: {o.base}
                              {o.addons && o.addons.length > 0
                                ? ` · ${o.addons.length} add-on${o.addons.length === 1 ? "" : "s"}`
                                : ""}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(o.created_at)} · {formatPrice(total)}
                            </p>
                            {job?.error_message && (
                              <p className="text-xs text-destructive mt-1">
                                {job.error_message}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {job?.delivery_url && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  window.open(job.delivery_url!, "_blank", "noopener,noreferrer")
                                }
                              >
                                <Download size={14} className="mr-1.5" />
                                Get bot
                              </Button>
                            )}
                            {canCancelOrder(orderStatus) ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => setCancelTarget(o)}
                              >
                                <XCircle size={14} className="mr-1.5" />
                                Cancel
                              </Button>
                            ) : orderStatus === "cancelled" ? null : (
                              <span className="text-[11px] text-muted-foreground">
                                Contact support to cancel
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </TabsContent>

          {/* Membership checkout dialog */}
          <CheckoutDialog
            open={!!membershipCheckoutItems}
            onOpenChange={(o) => {
              if (!o) {
                setMembershipCheckoutItems(null);
                loadMembership();
              }
            }}
            items={membershipCheckoutItems ?? []}
            customerEmail={user.email ?? undefined}
          />

          {/* Upgrade checkout dialog */}
          <CheckoutDialog
            open={!!upgradeCheckout}
            onOpenChange={(o) => {
              if (!o) {
                setUpgradeCheckout(null);
                loadPurchases();
              }
            }}
            items={upgradeCheckout ?? []}
            customerEmail={user.email ?? undefined}
          />

          {/* Upgrade Robux dialog */}
          <RobuxPurchaseDialog
            open={!!upgradeRobux}
            onOpenChange={(o) => {
              if (!o) {
                setUpgradeRobux(null);
                loadPurchases();
              }
            }}
            product={upgradeRobux}
          />

          {/* Robux upgrade ticket prompt */}
          <AlertDialog
            open={robuxUpgradePromptOpen}
            onOpenChange={setRobuxUpgradePromptOpen}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Upgrade with Robux</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-3">
                    <p>
                      Robux version upgrades are handled manually. Please open a
                      ticket in the{" "}
                      <span className="font-medium">Oversite Marketplace</span>{" "}
                      Discord and our team will set up your version upgrade gamepass.
                    </p>
                    <p className="text-xs font-mono rounded-md bg-muted px-3 py-2">
                      .gg/oversitemarketplace ➜ Support ➜ Payment Support ➜ Version Upgrade
                    </p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Close</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => setRobuxUpgradePromptOpen(false)}
                >
                  Got it
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* SETTINGS */}
          <TabsContent value="settings" className="space-y-4">
            {/* Appearance */}
            <Card className="p-6 space-y-4">
              <div>
                <h2 className="font-semibold">Appearance</h2>
                <p className="text-sm text-muted-foreground">
                  Choose how Oversite looks. Saved to this device.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 max-w-sm">
                <button
                  onClick={() => setTheme("light")}
                  className={`group relative flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-smooth ${
                    theme === "light"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  }`}
                  aria-pressed={theme === "light"}
                >
                  <Sun size={20} className="text-primary" />
                  <span className="text-sm font-medium">Light</span>
                </button>

                <button
                  onClick={() => setTheme("dark")}
                  className={`group relative flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-smooth ${
                    theme === "dark"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  }`}
                  aria-pressed={theme === "dark"}
                >
                  <Moon size={20} className="text-primary" />
                  <span className="text-sm font-medium">Dark</span>
                </button>
              </div>
            </Card>

            {/* Notifications */}
            <Card className="p-6 space-y-4">
              <div>
                <h2 className="font-semibold flex items-center gap-2">
                  <Bell size={16} /> Notifications
                </h2>
                <p className="text-sm text-muted-foreground">
                  Choose where we reach out when there's an update or a new product drop.
                </p>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Email notifications</Label>
                  <p className="text-xs text-muted-foreground">
                    Sent to {user.email}.
                  </p>
                </div>
                <Switch
                  checked={prefs.notify_email}
                  onCheckedChange={(v) => setPrefs({ notify_email: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Discord notifications</Label>
                  <p className="text-xs text-muted-foreground">
                    Our bot will DM your Discord when products drop.
                  </p>
                </div>
                <Switch
                  checked={prefs.notify_discord}
                  onCheckedChange={(v) => setPrefs({ notify_discord: v })}
                />
              </div>
            </Card>

            {/* Localization: Currency / Language / Timezone */}
            <Card className="p-6 space-y-4">
              <div>
                <h2 className="font-semibold flex items-center gap-2">
                  <Globe size={16} /> Region & language
                </h2>
                <p className="text-sm text-muted-foreground">
                  Affects how prices, dates, and text appear on this device.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Default currency</Label>
                  <Select
                    value={prefs.preferred_currency}
                    onValueChange={(v) => setPrefs({ preferred_currency: v as Currency })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CURRENCY_LABELS).map(([code, label]) => (
                        <SelectItem key={code} value={code}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Display only — checkout still charges in USD.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Language</Label>
                  <Select
                    value={prefs.preferred_language}
                    onValueChange={(v) => setPrefs({ preferred_language: v as Language })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(LANGUAGE_LABELS).map(([code, label]) => (
                        <SelectItem key={code} value={code}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Affects number and date formatting.
                  </p>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label className="flex items-center gap-1.5">
                    <Clock size={14} /> Time zone
                  </Label>
                  <Select
                    value={prefs.timezone}
                    onValueChange={(v) => setPrefs({ timezone: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>

            {/* Preferred contact */}
            <Card className="p-6 space-y-4">
              <div>
                <h2 className="font-semibold flex items-center gap-2">
                  <MessagesSquare size={16} /> Preferred contact method
                </h2>
                <p className="text-sm text-muted-foreground">
                  How should we reach you for order questions or support?
                </p>
              </div>
              <Select
                value={prefs.preferred_contact}
                onValueChange={(v) => setPrefs({ preferred_contact: v as ContactMethod })}
              >
                <SelectTrigger className="max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="discord">Discord</SelectItem>
                </SelectContent>
              </Select>
            </Card>
          </TabsContent>

          {/* PRIVACY */}
          <TabsContent value="privacy" className="space-y-4">
            <Card className="p-6 space-y-4">
              <div>
                <h2 className="font-semibold flex items-center gap-2">
                  <Shield size={16} /> Your information
                </h2>
                <p className="text-sm text-muted-foreground">
                  Update what you shared with us at sign-up. Only you can see this.
                </p>
              </div>

              {profileLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="roblox">Roblox username</Label>
                    <Input
                      id="roblox"
                      value={robloxUsername}
                      onChange={(e) => setRobloxUsername(e.target.value)}
                      maxLength={50}
                      placeholder="YourRobloxName"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="discord">Discord username</Label>
                    <Input
                      id="discord"
                      value={discordUsername}
                      onChange={(e) => setDiscordUsername(e.target.value)}
                      maxLength={50}
                      placeholder="yourdiscordhandle"
                    />
                  </div>
                  <Button onClick={saveProfile} disabled={savingProfile} size="sm">
                    {savingProfile ? "Saving…" : "Save changes"}
                  </Button>
                </>
              )}
            </Card>

            <Card className="p-6 space-y-4">
              <div>
                <h2 className="font-semibold flex items-center gap-2">
                  <Mail size={16} /> Email address
                </h2>
                <p className="text-sm text-muted-foreground">
                  Used for login and order receipts.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  maxLength={255}
                />
              </div>
              <Button
                onClick={updateEmail}
                disabled={emailUpdating || newEmail === user.email || !newEmail}
                size="sm"
              >
                {emailUpdating ? "Sending…" : "Update email"}
              </Button>
            </Card>

            <Card className="p-6 space-y-4">
              <div>
                <h2 className="font-semibold flex items-center gap-2">
                  <KeyRound size={16} /> Change password
                </h2>
                <p className="text-sm text-muted-foreground">Use at least 6 characters.</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-new-password">Confirm</Label>
                  <Input
                    id="confirm-new-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={6}
                  />
                </div>
              </div>
              <Button
                onClick={updatePassword}
                disabled={passwordUpdating || !newPassword}
                size="sm"
              >
                {passwordUpdating ? "Updating…" : "Update password"}
              </Button>
            </Card>

            {/* Payment methods */}
            <Card className="p-6 space-y-4">
              <div>
                <h2 className="font-semibold flex items-center gap-2">
                  <CreditCard size={16} /> Payment methods
                </h2>
                <p className="text-sm text-muted-foreground">
                  Manage saved cards, billing info, and view past invoices in our secure
                  payment portal.
                </p>
              </div>
              <Button onClick={openCustomerPortal} disabled={portalLoading} size="sm">
                {portalLoading ? "Opening…" : "Open payment portal"}
                <ExternalLink size={12} className="ml-1.5" />
              </Button>
            </Card>

            <Card className="p-6 space-y-3">
              <div>
                <h2 className="font-semibold">Data & privacy</h2>
                <p className="text-sm text-muted-foreground">
                  We never sell, share, or spam. Your info is only used to fulfill your
                  orders and provide support.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Account ID: <span className="font-mono">{user.id.slice(0, 8)}…</span>
                </p>
              </div>
            </Card>

            <Card className="p-6 space-y-3">
              <div>
                <h2 className="font-semibold flex items-center gap-2">
                  <Trash2 size={16} /> Delete account
                </h2>
                <p className="text-sm text-muted-foreground">
                  Want your account removed? Contact us and we'll handle it.
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/#contact">
                  Contact support <ExternalLink size={12} className="ml-1.5" />
                </Link>
              </Button>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
}
