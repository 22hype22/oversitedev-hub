import heroBg from "@/assets/hero-bg.jpg";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Hero = () => {
  const STORAGE_KEY = "oversite:botsBuiltCount";
  const START_VALUE = 123;
  const AVG_INTERVAL_MS = 32500; // average of 20-45s

  const [botServers, setBotServers] = useState<number>(() => {
    if (typeof window === "undefined") return START_VALUE;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { value: number; updatedAt: number };
        if (typeof parsed?.value === "number" && typeof parsed?.updatedAt === "number") {
          // Catch up for time elapsed while away (using average interval)
          const elapsed = Date.now() - parsed.updatedAt;
          const gained = elapsed > 0 ? Math.floor(elapsed / AVG_INTERVAL_MS) : 0;
          return Math.max(START_VALUE, parsed.value + gained);
        }
      }
    } catch {
      // ignore
    }
    return START_VALUE;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ value: botServers, updatedAt: Date.now() }),
      );
    } catch {
      // ignore
    }
  }, [botServers]);

  useEffect(() => {
    const tick = () => {
      setBotServers((n) => n + 1);
    };
    const schedule = () => {
      const delay = 20000 + Math.random() * 25000;
      return window.setTimeout(() => {
        tick();
        timer = schedule();
      }, delay);
    };
    let timer = schedule();
    return () => window.clearTimeout(timer);
  }, []);

  const [membersServing, setMembersServing] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase.rpc("get_total_members_serving");
      if (!cancelled && !error && typeof data === "number") {
        setMembersServing(data);
      }
    };
    load();
    const interval = window.setInterval(load, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const formatMembers = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K+`;
    return `${n}+`;
  };


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
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-medium">
              <Sparkles size={14} />
              Professional Roblox Development
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-medium">
              <Sparkles size={14} />
              Professional Discord Bot Development
            </div>
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

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
            {[
              { value: "23B+", label: "Visits Contributed To" },
              { value: "12K+", label: "Total Members" },
              { value: botServers.toLocaleString(), label: "Bots Built" },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-border bg-card/60 backdrop-blur p-5 hover:border-primary/40 transition-smooth"
              >
                <div className="text-3xl md:text-4xl font-bold text-gradient">{s.value}</div>
                <div className="text-sm text-muted-foreground mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
