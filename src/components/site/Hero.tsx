import heroBg from "@/assets/hero-bg.jpg";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";

export const Hero = () => {
  return (
    <section id="home" className="relative min-h-screen flex items-center pt-16 overflow-hidden bg-gradient-hero">
      <img
        src={heroBg}
        alt=""
        aria-hidden="true"
        width={1920}
        height={1024}
        className="absolute inset-0 w-full h-full object-cover opacity-15 pointer-events-none"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/85 to-background pointer-events-none" />

      <div className="container relative mx-auto px-4 py-20 md:py-32">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-medium mb-6">
            <Sparkles size={14} />
            Professional Roblox Development
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight">
            Start with a vision. <br />
            <span className="text-gradient">We'll bring it to life.</span>
          </h1>

          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed">
            Oversite delivers professional Roblox development built around your vision — from
            simple ideas to full game plans. Clear pricing, dependable timelines, and full-service
            support in design, scripting, UI, and systems.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <Button variant="hero" size="lg" asChild>
              <a href="#contact">
                Start a project <ArrowRight />
              </a>
            </Button>
            <Button variant="outlineGlow" size="lg" asChild>
              <Link to="/products">View packages</Link>
            </Button>
          </div>

          <div className="mt-14 grid grid-cols-3 gap-6 max-w-md">
            {[
              { k: "On time", v: "Delivered" },
              { k: "Full", v: "Service" },
              { k: "Built", v: "To scale" },
            ].map((s) => (
              <div key={s.k} className="border-l-2 border-primary/60 pl-3">
                <div className="text-sm text-muted-foreground">{s.k}</div>
                <div className="font-semibold">{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
