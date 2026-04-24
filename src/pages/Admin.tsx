import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import {
  Settings,
  MessageSquare,
  Bot,
  ShieldAlert,
  Code2,
  ScrollText,
  Gavel,
  Sparkles,
  Flag,
  Clock,
  Lock,
  Star,
  Hand,
  ArrowRight,
  ArrowLeft,
  Megaphone,
} from "lucide-react";

import { ProductManager } from "@/components/admin/ProductManager";
import { MarketingKillSwitch, useMarketingShutdown } from "@/components/admin/MarketingKillSwitch";
import { ResetPurchases } from "@/components/admin/ResetPurchases";
import { AdminManager } from "@/components/admin/AdminManager";
import { CategoryManager } from "@/components/admin/CategoryManager";

const SUPER_ADMIN_EMAIL = "everant00@gmail.com";

import { Card } from "@/components/ui/card";

type Plugin = {
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

const plugins: Plugin[] = [
  { name: "Settings", description: "Configure Oversite's core settings.", icon: Settings },
  { name: "Auto Reply", description: "Have Oversite respond automatically to certain triggers.", icon: MessageSquare },
  { name: "Automod", description: "Let Oversite automatically moderate your server and give your mods a break.", icon: Bot },
  { name: "Ban Appeal", description: "Ditch Google forms, handle your ban appeals with Oversite!", icon: ShieldAlert },
  { name: "Custom Commands", description: "Create commands with your own code to run with Oversite.", icon: Code2 },
  { name: "Logging", description: "Log everything that happens in your server to a text channel (or multiple).", icon: ScrollText },
  { name: "Moderation", description: "Defend your server with a large arsenal of moderation commands.", icon: Gavel },
  { name: "Reaction Roles", description: "Allow your server members to easily assign themselves roles via buttons or reactions.", icon: Sparkles },
  { name: "Report", description: "Give your members a way to easily report rule-breaking messages to your moderators.", icon: Flag },
  { name: "Recurring Reminders", description: "Send repeating messages on a set interval to a channel of your choice.", icon: Clock },
  { name: "Roblox", description: "Link Roblox accounts to Discord users, assign roles to users based on their group rank.", icon: Lock },
  { name: "Starboard", description: "Save messages directly to a text channel by reacting with a star.", icon: Star },
  { name: "Welcome", description: "Set an autorole and welcome/goodbye messages.", icon: Hand },
];

const Admin = () => {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [marketingShutdown, setMarketingShutdown] = useMarketingShutdown();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/auth", { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background grid place-items-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!user) return null;

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background grid place-items-center px-4">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">Access denied</h1>
          <p className="text-muted-foreground">
            Your account isn't on the admin allowlist. Contact an administrator if you believe this is a mistake.
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" asChild>
              <Link to="/">Back to site</Link>
            </Button>
            <Button
              variant="hero"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate("/auth", { replace: true });
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-10 max-w-7xl">
        {/* Top bar */}
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

        {/* Header */}
        <div className="text-center mb-12">
          <div className="text-primary text-xs font-semibold uppercase tracking-widest mb-2">
            Admin Panel
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Manage <span className="text-gradient">Oversite</span>
          </h1>
        </div>

        {/* Section 1: Managing Oversite (bots) */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Managing Oversite</h2>
              <p className="text-sm text-muted-foreground">Configure plugins for our bots.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {plugins.map((p) => {
              const Icon = p.icon;
              return (
                <Card
                  key={p.name}
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
        </section>

        {/* Section 2: Managing Oversite Marketing */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center">
              <Megaphone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Managing Oversite Marketing</h2>
              <p className="text-sm text-muted-foreground">
                Manage products, pricing, and promotional content.
              </p>
            </div>
          </div>

          {marketingShutdown ? (
            <Card className="p-10 text-center border-dashed border-destructive/40 bg-destructive/5">
              <p className="text-sm text-muted-foreground">
                Marketing management is currently disabled. Restore access below to manage products.
              </p>
            </Card>
          ) : (
            <div className="space-y-6">
              <CategoryManager />
              <ProductManager userId={user.id} />
            </div>
          )}

          <div className="mt-10 pt-6 border-t border-border">
            <div className="mb-4">
              <h3 className="text-lg font-semibold tracking-tight text-destructive">Danger Zone</h3>
              <p className="text-sm text-muted-foreground">
                Destructive actions that affect the live storefront and customer data.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <MarketingKillSwitch />
              <ResetPurchases />
            </div>
          </div>

          {user.email?.toLowerCase() === SUPER_ADMIN_EMAIL && (
            <div className="mt-10 pt-6 border-t border-border">
              <AdminManager />
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Admin;
