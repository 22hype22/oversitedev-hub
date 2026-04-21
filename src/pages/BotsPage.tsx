import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { Button } from "@/components/ui/button";
import { Shield, LifeBuoy, Wrench, Sparkles, ArrowRight } from "lucide-react";
import protectionLogo from "@/assets/oversite-protection.png";
import supportLogo from "@/assets/oversite-support.png";
import utilitiesLogo from "@/assets/oversite-utilities.png";

const bots = [
  {
    name: "Oversite Protection",
    tagline: "Keeping your server safe with automod, anti-raid, logging, and a full moderation arsenal.",
    image: protectionLogo,
    icon: Shield,
    features: ["Automod & filters", "Anti-raid defense", "Full audit logging", "Moderation toolkit"],
    accent: "from-[hsl(70_30%_70%)]/20 to-transparent",
    border: "border-[hsl(70_30%_70%)]/30 hover:border-[hsl(70_30%_70%)]/60",
    iconColor: "text-[hsl(70_30%_70%)]",
  },
  {
    name: "Oversite Support",
    tagline: "Your server's support system — tickets, appeals, reports, and welcoming every new member.",
    image: supportLogo,
    icon: LifeBuoy,
    features: ["Ticket system", "Ban appeals", "User reports", "Member welcomes"],
    accent: "from-[hsl(280_30%_70%)]/20 to-transparent",
    border: "border-[hsl(280_30%_70%)]/30 hover:border-[hsl(280_30%_70%)]/60",
    iconColor: "text-[hsl(280_30%_70%)]",
  },
  {
    name: "Oversite Utilities",
    tagline: "Powering your server with announcements, roles, Roblox integration, music, and everything in between.",
    image: utilitiesLogo,
    icon: Wrench,
    features: ["Announcements", "Role management", "Roblox integration", "Music & more"],
    accent: "from-primary/20 to-transparent",
    border: "border-primary/30 hover:border-primary/60",
    iconColor: "text-primary",
  },
];

const BotsPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 pt-32 pb-20">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-medium mb-6">
            The Oversite Bot Suite
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            Three bots. <span className="text-gradient">One ecosystem.</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
            Purpose-built Discord bots designed to work together — protect, support, and power
            your community without the bloat of a dozen separate tools.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {bots.map((bot) => {
            const Icon = bot.icon;
            return (
              <article
                key={bot.name}
                className={`group relative overflow-hidden rounded-2xl border bg-card/60 backdrop-blur p-8 transition-smooth ${bot.border}`}
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${bot.accent} opacity-0 group-hover:opacity-100 transition-smooth pointer-events-none`}
                />
                <div className="relative">
                  <div className="aspect-[16/9] rounded-xl bg-background/40 border border-border/50 grid place-items-center mb-6 overflow-hidden">
                    <img
                      src={bot.image}
                      alt={`${bot.name} logo`}
                      className="w-full h-full object-contain p-4"
                    />
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <Icon size={18} className={bot.iconColor} />
                    <h2 className="text-xl font-semibold tracking-tight">{bot.name}</h2>
                  </div>

                  <p className="text-muted-foreground leading-relaxed mb-6">{bot.tagline}</p>

                  <ul className="space-y-2">
                    {bot.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm">
                        <span className={`h-1.5 w-1.5 rounded-full ${bot.iconColor.replace("text-", "bg-")}`} />
                        <span className="text-foreground/90">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            );
          })}
        </div>

        <section className="mt-24 relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card/60 to-background backdrop-blur p-10 md:p-14">
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
          <div className="relative max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-medium mb-6">
              <Sparkles size={14} />
              Custom Builds
            </div>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
              Interested in your own <span className="text-gradient">custom server bot?</span>
            </h2>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
              Need something the suite doesn't cover? We build fully custom Discord bots tailored
              to your community — bespoke commands, integrations, dashboards, and automations
              designed around exactly how your server runs.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button variant="hero" size="lg" asChild>
                <a href="/#contact">
                  Request a custom bot <ArrowRight />
                </a>
              </Button>
              <Button variant="outlineGlow" size="lg" asChild>
                <a href="/products">View packages</a>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default BotsPage;
