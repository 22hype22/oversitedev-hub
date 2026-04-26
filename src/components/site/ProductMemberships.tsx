import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, X, Crown, Building2, Building, Sparkles, Lock } from "lucide-react";
import { useMarketingSuspended } from "@/hooks/useMarketingSuspended";
import { CheckoutDialog, type CheckoutItem } from "@/components/CheckoutDialog";
import { useAuth } from "@/hooks/useAuth";

type Tier = {
  id: "starter" | "pro" | "studio";
  name: string;
  icon: typeof Crown;
  tagline: string;
  monthly: number;
  yearly: number;
  popular?: boolean;
  accent: string;
  border: string;
  iconColor: string;
};

const TIERS: Tier[] = [
  {
    id: "starter",
    name: "Starter",
    icon: Crown,
    tagline: "Free version upgrades on a handful of products.",
    monthly: 4.99,
    yearly: 49.99,
    accent: "from-[hsl(70_30%_70%)]/15 to-transparent",
    border: "border-[hsl(70_30%_70%)]/30 hover:border-[hsl(70_30%_70%)]/60",
    iconColor: "text-[hsl(70_30%_70%)]",
  },
  {
    id: "pro",
    name: "Pro",
    icon: Building,
    tagline: "Free upgrades across most products plus early access drops.",
    monthly: 12.99,
    yearly: 129.99,
    popular: true,
    accent: "from-[hsl(280_30%_70%)]/15 to-transparent",
    border: "border-[hsl(280_30%_70%)]/40 hover:border-[hsl(280_30%_70%)]/70",
    iconColor: "text-[hsl(280_30%_70%)]",
  },
  {
    id: "studio",
    name: "Studio",
    icon: Building2,
    tagline: "Every product, every upgrade — for serious developers.",
    monthly: 29.99,
    yearly: 299.99,
    accent: "from-primary/20 to-transparent",
    border: "border-primary/40 hover:border-primary/70",
    iconColor: "text-primary",
  },
];

type FeatureRow = {
  label: string;
  values: Record<Tier["id"], string | true>;
};

const FEATURES: FeatureRow[] = [
  { label: "Products with free version upgrades", values: { starter: "3", pro: "10", studio: "All products" } },
  { label: "New product releases", values: { starter: "Standard pricing", pro: "20% off", studio: "Free" } },
  { label: "Early access to upcoming releases", values: { pro: true, studio: true } as Record<Tier["id"], string | true> },
  { label: "Priority support", values: { pro: "Email", studio: "Dedicated" } as Record<Tier["id"], string | true> },
  { label: "Beta program access", values: { studio: true } as Record<Tier["id"], string | true> },
  { label: "Direct line to the dev team", values: { studio: true } as Record<Tier["id"], string | true> },
];

export const ProductMemberships = () => {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const { suspended } = useMarketingSuspended();
  const { user } = useAuth();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutItems, setCheckoutItems] = useState<CheckoutItem[]>([]);

  const handleSubscribe = (tierId: Tier["id"]) => {
    const priceId = `product_membership_${tierId}_${billing === "monthly" ? "monthly" : "yearly"}`;
    setCheckoutItems([{ priceId, quantity: 1 }]);
    setCheckoutOpen(true);
  };

  return (
    <section id="memberships" className="mt-24 scroll-mt-24">
      <div className="max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-medium mb-6">
          <Crown size={14} />
          Product Memberships
        </div>
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
          Free upgrades, <span className="text-gradient">forever.</span>
        </h2>
        <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
          We ship new versions of our products over time. With a membership, every new
          release lands in your library at no extra cost — no upgrade fees, ever.
        </p>
      </div>

      {/* Billing toggle */}
      <div className="mt-10 flex justify-center">
        <div className="inline-flex items-center rounded-full border border-border/60 bg-card/60 backdrop-blur p-1">
          <button
            type="button"
            onClick={() => setBilling("monthly")}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-smooth ${
              billing === "monthly"
                ? "bg-primary text-primary-foreground shadow-glow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBilling("yearly")}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-smooth flex items-center gap-2 ${
              billing === "yearly"
                ? "bg-primary text-primary-foreground shadow-glow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Yearly
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
              billing === "yearly" ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/15 text-primary"
            }`}>
              SAVE
            </span>
          </button>
        </div>
      </div>

      {/* Tier cards */}
      <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {TIERS.map((tier) => {
          const Icon = tier.icon;
          const price = billing === "monthly" ? tier.monthly : tier.yearly;
          const suffix = billing === "monthly" ? "/mo" : "/yr";

          return (
            <article
              key={tier.id}
              className={`group relative overflow-hidden rounded-2xl border bg-card/60 backdrop-blur p-8 transition-smooth ${tier.border} ${
                tier.popular ? "ring-1 ring-primary/30" : ""
              }`}
            >
              <div
                className={`absolute inset-0 bg-gradient-to-br ${tier.accent} opacity-0 group-hover:opacity-100 transition-smooth pointer-events-none`}
              />
              {tier.popular && (
                <div className="absolute top-4 right-4 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">
                  <Sparkles size={10} />
                  Most popular
                </div>
              )}

              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <Icon size={20} className={tier.iconColor} />
                  <h3 className="text-xl font-semibold tracking-tight">{tier.name}</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6 min-h-[40px]">
                  {tier.tagline}
                </p>

                <div key={billing} className="flex items-baseline gap-1 mb-6" data-no-translate>
                  <span className="text-4xl font-bold tracking-tight">
                    ${price.toFixed(2).replace(/\.00$/, "")}
                  </span>
                  <span
                    className="text-muted-foreground after:content-[attr(data-suffix)]"
                    data-suffix={suffix}
                    aria-label={billing === "monthly" ? "per month" : "per year"}
                  />
                </div>

                <Button
                  variant={tier.popular ? "hero" : "outlineGlow"}
                  size="lg"
                  className="w-full"
                  disabled={suspended}
                  onClick={() => !suspended && handleSubscribe(tier.id)}
                >
                  {suspended ? (
                    <span className="inline-flex items-center justify-center gap-2">
                      <Lock size={16} />
                      Suspended
                    </span>
                  ) : (
                    <span>Get {tier.name}</span>
                  )}
                </Button>

                <ul className="mt-6 space-y-3">
                  {FEATURES.map((f) => {
                    const raw = f.values[tier.id];
                    const included = raw === true || (typeof raw === "string" && raw.length > 0);
                    return (
                      <li key={f.label} className="flex items-start gap-2 text-sm">
                        {included ? (
                          <Check size={16} className={`${tier.iconColor} mt-0.5 shrink-0`} />
                        ) : (
                          <X size={16} className="text-muted-foreground/50 mt-0.5 shrink-0" />
                        )}
                        <span className={included ? "text-foreground/90" : "text-muted-foreground/60 line-through"}>
                          {typeof raw === "string" && raw.length > 0
                            ? `${f.label}: ${raw}`
                            : f.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </article>
          );
        })}
      </div>

      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        items={checkoutItems}
        customerEmail={user?.email}
      />
    </section>
  );
};
