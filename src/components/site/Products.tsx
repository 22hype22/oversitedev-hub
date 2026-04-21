import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const tiers = [
  {
    name: "Starter",
    price: "$499",
    blurb: "For small experiences or single mechanics.",
    features: ["Single core mechanic", "Basic UI pass", "Up to 2 weeks delivery", "1 round of revisions"],
    featured: false,
  },
  {
    name: "Studio",
    price: "$1,999",
    blurb: "Most popular — full mid-size game build.",
    features: ["Custom systems & scripting", "Full UI/UX design", "Optimization pass", "3 rounds of revisions", "Launch support"],
    featured: true,
  },
  {
    name: "Flagship",
    price: "Custom",
    blurb: "Large-scale, long-term game projects.",
    features: ["Dedicated dev team", "Architecture & scaling", "Live-ops & updates", "Unlimited revisions", "Priority support"],
    featured: false,
  },
];

export const Products = () => (
  <section id="products" className="py-24 md:py-32 relative">
    <div className="container mx-auto px-4">
      <div className="max-w-2xl mb-14">
        <div className="text-primary text-sm font-medium mb-3">Packages</div>
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
          Pick a package or <span className="text-gradient">build your own</span>
        </h2>
        <p className="mt-4 text-muted-foreground text-lg">
          Transparent pricing for every stage. Need something different? We'll tailor a quote to your scope.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {tiers.map((t) => (
          <div
            key={t.name}
            className={`relative p-7 rounded-2xl border transition-smooth ${
              t.featured
                ? "bg-gradient-card border-primary/50 shadow-elegant scale-[1.02]"
                : "bg-gradient-card border-border hover:border-primary/30"
            }`}
          >
            {t.featured && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold bg-gradient-primary text-primary-foreground shadow-glow">
                Most popular
              </div>
            )}
            <h3 className="font-semibold text-xl">{t.name}</h3>
            <p className="text-sm text-muted-foreground mt-1">{t.blurb}</p>
            <div className="mt-5 flex items-baseline gap-1">
              <span className="text-4xl font-bold tracking-tight">{t.price}</span>
              {t.price !== "Custom" && <span className="text-muted-foreground text-sm">/ project</span>}
            </div>

            <ul className="mt-6 space-y-3">
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check size={16} className="text-primary mt-0.5 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <Button
              variant={t.featured ? "hero" : "outlineGlow"}
              className="w-full mt-7"
              asChild
            >
              <a href="#contact">{t.price === "Custom" ? "Request a quote" : "Get started"}</a>
            </Button>
          </div>
        ))}
      </div>
    </div>
  </section>
);
