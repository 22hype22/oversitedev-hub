import { Button } from "@/components/ui/button";
import { Check, X, Crown, Building2, Building, Sparkles, Star } from "lucide-react";

type TierId = "basic" | "standard" | "premium" | "enterprise";

type Tier = {
  id: TierId;
  name: string;
  icon: typeof Crown;
  tagline: string;
  price: number;
  popular?: boolean;
  accent: string;
  border: string;
  iconColor: string;
};

const TIERS: Tier[] = [
  {
    id: "basic",
    name: "Basic",
    icon: Star,
    tagline: "Stay current with every system you already own.",
    price: 9.99,
    accent: "from-[hsl(70_30%_70%)]/15 to-transparent",
    border: "border-[hsl(70_30%_70%)]/30 hover:border-[hsl(70_30%_70%)]/60",
    iconColor: "text-[hsl(70_30%_70%)]",
  },
  {
    id: "standard",
    name: "Standard",
    icon: Crown,
    tagline: "Faster support, early access, and savings on every order.",
    price: 24.99,
    accent: "from-[hsl(200_40%_70%)]/15 to-transparent",
    border: "border-[hsl(200_40%_70%)]/30 hover:border-[hsl(200_40%_70%)]/60",
    iconColor: "text-[hsl(200_40%_70%)]",
  },
  {
    id: "premium",
    name: "Premium",
    icon: Building,
    tagline: "Free monthly products and custom builds tailored to your server.",
    price: 49.99,
    popular: true,
    accent: "from-[hsl(280_30%_70%)]/15 to-transparent",
    border: "border-[hsl(280_30%_70%)]/40 hover:border-[hsl(280_30%_70%)]/70",
    iconColor: "text-[hsl(280_30%_70%)]",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    icon: Building2,
    tagline: "Direct line to our developers and the deepest discount we offer.",
    price: 99.99,
    accent: "from-primary/20 to-transparent",
    border: "border-primary/40 hover:border-primary/70",
    iconColor: "text-primary",
  },
];

type FeatureRow = {
  label: string;
  values: Partial<Record<TierId, string | true>>;
};

// `true` => included as-is (renders a check + label)
// string => included with specific value (renders a check + "label: value")
// missing key => not included (renders an X + strikethrough)
const FEATURES: FeatureRow[] = [
  {
    label: "Latest version downloads for owned products",
    values: { basic: true, standard: true, premium: true, enterprise: true },
  },
  {
    label: "Priority support",
    values: { standard: true, premium: true, enterprise: true },
  },
  {
    label: "Early access to new system releases",
    values: { standard: true, premium: true, enterprise: true },
  },
  {
    label: "Discount on all products",
    values: { standard: "10%", premium: "15%", enterprise: "25%" },
  },
  {
    label: "Free products each month",
    values: { premium: "2", enterprise: "3" },
  },
  {
    label: "Custom system requests",
    values: { premium: true, enterprise: true },
  },
  {
    label: "Direct access to developers",
    values: { enterprise: true },
  },
  {
    label: "Preview access to all upcoming releases",
    values: { enterprise: true },
  },
];

export const Memberships = () => {
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
          Every membership keeps your systems up to date. Upgrade for faster support,
          exclusive releases, monthly free products, and direct access to our team.
        </p>
      </div>

      {/* Tier cards */}
      <div className="mt-10 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {TIERS.map((tier) => {
          const Icon = tier.icon;

          return (
            <article
              key={tier.id}
              className={`group relative overflow-hidden rounded-2xl border bg-card/60 backdrop-blur p-7 transition-smooth ${tier.border} ${
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
                <p className="text-sm text-muted-foreground leading-relaxed mb-6 min-h-[60px]">
                  {tier.tagline}
                </p>

                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-bold tracking-tight">
                    ${tier.price.toFixed(2).replace(/\.00$/, "")}
                  </span>
                  <span className="text-muted-foreground">/mo</span>
                </div>

                <Button
                  variant={tier.popular ? "hero" : "outlineGlow"}
                  size="lg"
                  className="w-full"
                  asChild
                >
                  <a href="/#contact">Get {tier.name}</a>
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
                          {typeof raw === "string"
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
