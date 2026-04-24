import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "lucide-react";

type Purchase = {
  id: string;
  product_name: string;
  amount_cents: number;
  currency: string;
  status: string;
  created_at: string;
  file_url: string | null;
  file_name: string | null;
  environment: string;
};

type Profile = {
  id?: string;
  roblox_username: string;
  discord_username: string;
};

const formatPrice = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase() || "USD",
  }).format(cents / 100);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

export default function Dashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

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

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    setNewEmail(user.email ?? "");

    (async () => {
      setPurchasesLoading(true);
      const { data, error } = await supabase
        .from("purchases")
        .select("id,product_name,amount_cents,currency,status,created_at,file_url,file_name,environment")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) {
        toast.error("Couldn't load your purchases");
      } else {
        setPurchases((data as Purchase[]) ?? []);
      }
      setPurchasesLoading(false);
    })();

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

  if (loading || !user) return null;

  const completedCount = purchases.filter((p) => p.status === "paid").length;

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
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-semibold">Your purchases</h2>
                  <p className="text-sm text-muted-foreground">
                    {completedCount} completed
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link to="/products">Browse products</Link>
                </Button>
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
                  {purchases.map((p) => (
                    <li
                      key={p.id}
                      className="py-4 flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{p.product_name}</p>
                          <Badge
                            variant={p.status === "paid" ? "default" : "secondary"}
                            className="text-[10px]"
                          >
                            {p.status}
                          </Badge>
                          {p.environment === "sandbox" && (
                            <Badge variant="outline" className="text-[10px]">
                              test
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(p.created_at)} ·{" "}
                          {formatPrice(p.amount_cents, p.currency)}
                        </p>
                      </div>
                      {p.file_url && p.status === "paid" ? (
                        <Button asChild size="sm" variant="outline">
                          <a
                            href={p.file_url}
                            download={p.file_name ?? undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Download size={14} className="mr-1.5" />
                            Download
                          </a>
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </TabsContent>

          {/* SETTINGS */}
          <TabsContent value="settings" className="space-y-4">
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
                <p className="text-sm text-muted-foreground">
                  Use at least 6 characters.
                </p>
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

          {/* PRIVACY / PROFILE */}
          <TabsContent value="privacy" className="space-y-4">
            <Card className="p-6 space-y-4">
              <div>
                <h2 className="font-semibold flex items-center gap-2">
                  <Shield size={16} /> Your information
                </h2>
                <p className="text-sm text-muted-foreground">
                  This is what you shared with us at sign-up. Update anything that's misspelled or out of date — only you can see it.
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
                  <Button
                    onClick={saveProfile}
                    disabled={savingProfile}
                    size="sm"
                  >
                    {savingProfile ? "Saving…" : "Save changes"}
                  </Button>
                </>
              )}
            </Card>

            <Card className="p-6 space-y-2">
              <h2 className="font-semibold">Data & privacy</h2>
              <p className="text-sm text-muted-foreground">
                We never sell, share, or spam. Your info is only used to fulfill your orders and provide support.
              </p>
              <p className="text-xs text-muted-foreground">
                Account ID: <span className="font-mono">{user.id.slice(0, 8)}…</span>
              </p>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
}
