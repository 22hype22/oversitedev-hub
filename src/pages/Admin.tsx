import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, ArrowLeft, Megaphone } from "lucide-react";

import { ProductManager } from "@/components/admin/ProductManager";
import { MarketingKillSwitch, useMarketingShutdown } from "@/components/admin/MarketingKillSwitch";
import { ResetPurchases } from "@/components/admin/ResetPurchases";
import { AdminManager } from "@/components/admin/AdminManager";
import { CategoryManager } from "@/components/admin/CategoryManager";
import { UserVersionUpgrader } from "@/components/admin/UserVersionUpgrader";
import { PurchaseLog } from "@/components/admin/PurchaseLog";
import { AccountsLog } from "@/components/admin/AccountsLog";
import { BotOrdersLog } from "@/components/admin/BotOrdersLog";
import { FixesManager } from "@/components/admin/FixesManager";
import { CodesManager } from "@/components/admin/CodesManager";

const SUPER_ADMIN_EMAIL = "everant00@gmail.com";

import { Card } from "@/components/ui/card";

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

        {/* Section: Managing Oversite Marketing */}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              <div className="sm:col-span-2 lg:col-span-3 xl:col-span-4">
                <CategoryManager />
              </div>
              <ProductManager userId={user.id} />
            </div>
          )}

          {!marketingShutdown && (
            <div className="mt-10 pt-6 border-t border-border space-y-6">
              <FixesManager />
              <CodesManager />
              <UserVersionUpgrader />
              <BotOrdersLog />
              <PurchaseLog />
              <AccountsLog />
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
