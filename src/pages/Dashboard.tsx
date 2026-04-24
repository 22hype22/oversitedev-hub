import { useEffect, useState } from "react";
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
} from "lucide-react";

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
};

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

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [purchasesLoading, setPurchasesLoading] = useState(true);

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

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  const loadPurchases = async () => {
    if (!user) return;
    setPurchasesLoading(true);
    const filters = [`user_id.eq.${user.id}`];
    if (user.email) filters.push(`email.eq.${user.email.toLowerCase()}`);
    const { data, error } = await supabase
      .from("purchases")
      .select(
        "id,product_name,amount_cents,currency,status,created_at,file_url,file_name,environment",
      )
      .or(filters.join(","))
      .eq("status", "paid")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Couldn't load your purchases");
    } else {
      setPurchases((data as Purchase[]) ?? []);
    }
    setPurchasesLoading(false);
  };

  const handleDownload = async (p: Purchase) => {
    if (!p.file_url) return;
    // file_url may be either a full public URL or a storage path; normalize.
    let path = p.file_url;
    const marker = "/product-files/";
    const idx = path.indexOf(marker);
    if (idx !== -1) path = path.slice(idx + marker.length);
    const { data, error } = await supabase.storage
      .from("product-files")
      .createSignedUrl(path, 60 * 10);
    if (error || !data?.signedUrl) {
      toast.error("Couldn't generate download link");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  useEffect(() => {
    if (!user) return;
    setNewEmail(user.email ?? "");
    loadPurchases();

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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
          <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="purchases">
              <ShoppingBag size={14} className="mr-1.5" />
              Purchases
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
                <ul className="divide-y divide-border">
                  {purchases.map((p) => {
                    // Stored amounts are in cents in their original currency.
                    // Convert to USD baseline first, then formatPrice converts to user's preferred currency.
                    const usd = p.amount_cents / 100;
                    return (
                      <li
                        key={p.id}
                        className="py-4 flex items-center justify-between gap-4"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium truncate">{p.product_name}</p>
                            {p.environment === "sandbox" && (
                              <Badge variant="outline" className="text-[10px]">
                                test
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDate(p.created_at)} · {formatPrice(usd)}
                          </p>
                        </div>
                        {p.file_url ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownload(p)}
                          >
                            <Download size={14} className="mr-1.5" />
                            Download
                          </Button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </TabsContent>

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
