import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Bot, ArrowRight } from "lucide-react";

export const BotsTeaser = () => (
  <section className="py-20 md:py-28 border-t border-border">
    <div className="container mx-auto px-4">
      <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card/60 to-background backdrop-blur p-10 md:p-14">
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
        <div className="relative max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-medium mb-6">
            <Bot size={14} />
            Also from Oversite
          </div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
            Need a <span className="text-gradient">Discord bot</span> too?
          </h2>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
            Alongside our Roblox work, we design and build custom Discord bots — from our
            ready-made suite to fully bespoke server tooling.
          </p>
          <div className="mt-8">
            <Button variant="hero" size="lg" asChild>
              <Link to="/bots">
                Explore our bots <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  </section>
);
