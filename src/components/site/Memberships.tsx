import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, X, Crown, Building2, Building, Sparkles, Lock } from "lucide-react";
import { useMarketingSuspended } from "@/hooks/useMarketingSuspended";

type Tier = {
  id: "franchise" | "corporation" | "enterprise";
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
    id: "franchise",
    name: "Franchise",
    icon: Crown,
    tagline: "Everything a small server needs to get started.",
    monthly: 9.99,
    yearly: 99,
    accent: "from-[hsl(70_30%_70%)]/15 to-transparent",
    border: "border-[hsl(70_30%_70%)]/30 hover:border-[hsl(70_30%_70%)]/60",
    iconColor: "text-[hsl(70_30%_70%)]",
  },
  {
    id: "corporation",
    name: "Corporation",
    icon: Building,
    tagline: "Scale up with more add-ons, servers, and priority support.",
    monthly: 24.99,
    yearly: 249,
    popular: true,
    accent: "from-[hsl(280_30%_70%)]/15 to-transparent",
    border: "border-[hsl(280_30%_70%)]/40 hover:border-[hsl(280_30%_70%)]/70",
    iconColor: "text-[hsl(280_30%_70%)]",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    icon: Building2,
    tagline: "The full toolkit — white-labeled, branded, and dedicated.",
    monthly: 49.99,
    yearly: 479,
    accent: "from-primary/20 to-transparent",
    border: "border-primary/40 hover:border-primary/70",
    iconColor: "text-primary",
  },
];

type FeatureRow = {
  label: string;
  values: Record<Tier["id"], string | true>;
};

// `true` => show check (included as-is)
// string => show check + the specific value (e.g. "10 add-ons")
// missing key => show X (not included)
const FEATURES: FeatureRow[] = [
  { label: "Add-ons of your choice", values: { franchise: "3", corporation: "10", enterprise: "25" } },
  { label: "Servers supported", values: { franchise: "1", corporation: "Up to 2", enterprise: "Up to 5" } },
  { label: "Web dashboard access", values: { franchise: "Basic", corporation: "Full", enterprise: "Full + customizer" } },
  { label: "Support level", values: { franchise: "Community", corporation: "Priority email", enterprise: "Dedicated manager" } },
  { label: "Analytics", values: { franchise: "Basic", corporation: "Advanced", enterprise: "Advanced" } },
  { label: "Tickets per month", values: { franchise: "25", corporation: "100", enterprise: "Unlimited" } },
  { label: "Bot response time", values: { franchise: "Standard", corporation: "Faster", enterprise: "Faster" } },
  { label: "Custom bot avatar & username", values: { franchise: false as unknown as string, corporation: true, enterprise: true } as Record<Tier["id"], string | true> },
  { label: "White label bot", values: { corporation: false as unknown as string, enterprise: true } as Record<Tier["id"], string | true> },
  { label: "API access", values: { enterprise: true } as Record<Tier["id"], string | true> },
  { label: "Custom domain", values: { enterprise: true } as Record<Tier["id"], string | true> },
  { label: "Exportable reports", values: { enterprise: true } as Record<Tier["id"], string | true> },
  { label: "Branding kit included", values: { enterprise: true } as Record<Tier["id"], string | true> },
  { label: "Early access to new features", values: { enterprise: true } as Record<Tier["id"], string | true> },
  { label: "99.9% uptime guarantee", values: { enterprise: true } as Record<Tier["id"], string | true> },
];

export const Memberships = () => {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const { suspended } = useMarketingSuspended();

  return (
    <section id="memberships" className="mt-24 scroll-mt-24">
      <div className="max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-medium mb-6">
          <Crown size={14} />
          Memberships
        </div>
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
          Pick a plan that <span className="text-gradient">grows with your server.</span>
        </h2>
        <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
          Every tier comes with the Oversite bot suite. Choose how many add-ons, servers,
          and extras you need — upgrade any time.
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

                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-bold tracking-tight">
                    ${price.toFixed(2).replace(/\.00$/, "")}
                  </span>
                  <span className="text-muted-foreground">{suffix}</span>
                </div>

                <Button
                  variant={tier.popular ? "hero" : "outlineGlow"}
                  size="lg"
                  className="w-full"
                  asChild={!suspended}
                  disabled={suspended}
                >
                  {suspended ? (
                    <span className="inline-flex items-center justify-center gap-2">
                      <Lock size={16} />
                      Suspended
                    </span>
                  ) : (
                    <a href="/#contact">Get {tier.name}</a>
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
    </section>
  );
};
