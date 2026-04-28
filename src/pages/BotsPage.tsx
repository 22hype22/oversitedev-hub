import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { Button } from "@/components/ui/button";
import { Shield, LifeBuoy, Wrench, Sparkles, ArrowRight, Puzzle, Palette, BarChart3, Globe, Database, Bell, Wand2 } from "lucide-react";
import { BotBuilder } from "@/components/site/BotBuilder";
import { Memberships } from "@/components/site/Memberships";
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
    accentHsl: "70 30% 70%",
  },
  {
    name: "Oversite Support",
    tagline: "Your server's support system — tickets, appeals, reports, and welcoming every new member.",
    image: supportLogo,
    icon: LifeBuoy,
    features: ["Ticket system", "Ban appeals", "User reports", "Member welcomes"],
    accentHsl: "280 30% 70%",
  },
  {
    name: "Oversite Utilities",
    tagline: "Powering your server with announcements, roles, Roblox integration, music, and everything in between.",
    image: utilitiesLogo,
    icon: Wrench,
    features: ["Announcements", "Role management", "Roblox integration", "Music & more"],
    accentHsl: "var(--primary)",
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
          <div className="mt-8 flex flex-wrap gap-4">
            <Button variant="hero" size="lg" asChild>
              <a href="#pick-base">
                <Wand2 /> Build your own bot
              </a>
            </Button>
            <Button variant="outlineGlow" size="lg" asChild>
              <a href="#bot-suite">Explore the suite</a>
            </Button>
          </div>
        </div>

        <div id="bot-suite" className="mt-16 grid grid-cols-1 lg:grid-cols-3 gap-6 scroll-mt-24">
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

        <Memberships />

        <BotBuilder />

        <section className="mt-24">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-medium mb-6">
              <Puzzle size={14} />
              Add-ons & Extras
            </div>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
              Extend the suite with <span className="text-gradient">optional add-ons.</span>
            </h2>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
              Bolt-on features that plug straight into the Oversite bot suite — no extra setup,
              no third-party tools. Pick what your community needs.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Palette,
                name: "Custom Branding",
                desc: "Recolor embeds, swap the bot avatar, and match your server's identity end-to-end.",
              },
              {
                icon: BarChart3,
                name: "Advanced Analytics",
                desc: "Deep insights into moderation actions, ticket volume, and member activity over time.",
              },
              {
                icon: Globe,
                name: "Web Dashboard",
                desc: "Manage configuration, view logs, and review tickets from a hosted control panel.",
              },
              {
                icon: Database,
                name: "Data Exports",
                desc: "Scheduled exports of logs, tickets, and reports — CSV, JSON, or piped to your stack.",
              },
              {
                icon: Bell,
                name: "Priority Alerts",
                desc: "Real-time push to webhooks, email, or SMS for raids, escalations, and incidents.",
              },
              {
                icon: Sparkles,
                name: "Custom Commands",
                desc: "Bespoke slash commands and workflows wired into your existing bot deployment.",
              },
            ].map((addon) => {
              const Icon = addon.icon;
              return (
                <div
                  key={addon.name}
                  className="group relative rounded-2xl border border-border/60 bg-card/60 backdrop-blur p-6 hover:border-primary/50 transition-smooth"
                >
                  <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center mb-4">
                    <Icon size={18} className="text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold tracking-tight mb-2">{addon.name}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{addon.desc}</p>
                </div>
              );
            })}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default BotsPage;
