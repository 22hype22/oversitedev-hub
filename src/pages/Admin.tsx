import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  LogOut,
  ArrowLeft,
  Megaphone,
  Bot,
  LifeBuoy,
  ScrollText,
  AlertTriangle,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

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
import { BotSecretSlotManager } from "@/components/admin/BotSecretSlotManager";
import { SupportAccessRedeemer } from "@/components/admin/SupportAccessRedeemer";
import { WorkerTokensManager } from "@/components/admin/WorkerTokensManager";
import { TokenPoolManager } from "@/components/admin/TokenPoolManager";
import { AdminAuditLog } from "@/components/admin/AdminAuditLog";
import { Card } from "@/components/ui/card";

const SUPER_ADMIN_EMAIL = "everant00@gmail.com";

function SectionHeader({
  icon: Icon,
  title,
  description,
  tone = "primary",
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  tone?: "primary" | "destructive";
}) {
  const isDanger = tone === "destructive";
  return (
    <div className="flex items-center gap-3">
      <div
        className={
          isDanger
            ? "h-9 w-9 rounded-lg bg-destructive/10 border border-destructive/20 grid place-items-center shrink-0"
            : "h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center shrink-0"
        }
      >
        <Icon className={isDanger ? "h-5 w-5 text-destructive" : "h-5 w-5 text-primary"} />
      </div>
      <div className="text-left">
        <h2
          className={
            isDanger
              ? "text-lg md:text-xl font-bold tracking-tight text-destructive"
              : "text-lg md:text-xl font-bold tracking-tight"
          }
        >
          {title}
        </h2>
        <p className="text-xs md:text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

const Admin = () => {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [marketingShutdown] = useMarketingShutdown();

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

  const isSuperAdmin = user.email?.toLowerCase() === SUPER_ADMIN_EMAIL;

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
        <div className="text-center mb-10">
          <div className="text-primary text-xs font-semibold uppercase tracking-widest mb-2">
            Admin Panel
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Manage <span className="text-gradient">Oversite</span>
          </h1>
        </div>

        <Accordion
          type="multiple"
          defaultValue={["storefront"]}
          className="space-y-3"
        >
          {/* ─── Storefront ─────────────────────────────────────────── */}
          <AccordionItem
            value="storefront"
            className="border rounded-xl bg-card px-4 sm:px-5"
          >
            <AccordionTrigger className="hover:no-underline py-4">
              <SectionHeader
                icon={Megaphone}
                title="Storefront"
                description="Categories, products, pricing, and discount codes."
              />
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-5 space-y-6">
              {marketingShutdown ? (
                <Card className="p-10 text-center border-dashed border-destructive/40 bg-destructive/5">
                  <p className="text-sm text-muted-foreground">
                    Marketing management is currently disabled. Restore access in the Danger Zone below.
                  </p>
                </Card>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    <div className="sm:col-span-2 lg:col-span-3 xl:col-span-4">
                      <CategoryManager />
                    </div>
                    <ProductManager userId={user.id} />
                  </div>
                  <CodesManager />
                  <FixesManager />
                  <UserVersionUpgrader />
                </>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* ─── Bots ──────────────────────────────────────────────── */}
          <AccordionItem
            value="bots"
            className="border rounded-xl bg-card px-4 sm:px-5"
          >
            <AccordionTrigger className="hover:no-underline py-4">
              <SectionHeader
                icon={Bot}
                title="Bots & Workers"
                description="Bot secrets, token pool, and worker auth tokens."
              />
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-5 space-y-6">
              <BotSecretSlotManager />
              <TokenPoolManager />
              <WorkerTokensManager />
            </AccordionContent>
          </AccordionItem>

          {/* ─── Support ───────────────────────────────────────────── */}
          <AccordionItem
            value="support"
            className="border rounded-xl bg-card px-4 sm:px-5"
          >
            <AccordionTrigger className="hover:no-underline py-4">
              <SectionHeader
                icon={LifeBuoy}
                title="Support access"
                description="Redeem customer support codes to access their bots."
              />
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-5">
              <SupportAccessRedeemer />
            </AccordionContent>
          </AccordionItem>

          {/* ─── Logs ──────────────────────────────────────────────── */}
          <AccordionItem
            value="logs"
            className="border rounded-xl bg-card px-4 sm:px-5"
          >
            <AccordionTrigger className="hover:no-underline py-4">
              <SectionHeader
                icon={ScrollText}
                title="Logs & history"
                description="Bot orders, purchases, accounts, and admin actions."
              />
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-5 space-y-6">
              <BotOrdersLog />
              <PurchaseLog />
              <AccountsLog />
              <AdminAuditLog />
            </AccordionContent>
          </AccordionItem>

          {/* ─── Danger Zone ───────────────────────────────────────── */}
          <AccordionItem
            value="danger"
            className="border border-destructive/30 rounded-xl bg-destructive/5 px-4 sm:px-5"
          >
            <AccordionTrigger className="hover:no-underline py-4">
              <SectionHeader
                icon={AlertTriangle}
                title="Danger zone"
                description="Destructive actions affecting the live storefront and customer data."
                tone="destructive"
              />
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-5">
              <div className="grid gap-4 md:grid-cols-2">
                <MarketingKillSwitch />
                <ResetPurchases />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ─── Super Admin ───────────────────────────────────────── */}
          {isSuperAdmin && (
            <AccordionItem
              value="super-admin"
              className="border rounded-xl bg-card px-4 sm:px-5"
            >
              <AccordionTrigger className="hover:no-underline py-4">
                <SectionHeader
                  icon={ShieldCheck}
                  title="Super admin"
                  description="Manage who has admin access to the platform."
                />
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-5">
                <AdminManager />
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      </div>
    </div>
  );
};

export default Admin;

