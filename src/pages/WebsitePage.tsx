import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { Globe2, Sparkles } from "lucide-react";

const WebsitePage = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 relative overflow-hidden grid place-items-center px-4 pt-24">
        {/* Animated background orbs */}
        <div
          className="pointer-events-none absolute -top-32 -left-32 h-[480px] w-[480px] rounded-full opacity-30 blur-3xl animate-pulse"
          style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.6), transparent 70%)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-40 -right-32 h-[520px] w-[520px] rounded-full opacity-25 blur-3xl animate-pulse"
          style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.5), transparent 70%)", animationDelay: "1.5s" }}
        />

        <div className="relative text-center max-w-2xl animate-fade-in">
          <div className="mx-auto mb-8 relative w-28 h-28 grid place-items-center">
            <div className="absolute inset-0 rounded-full border border-primary/30 animate-ping" />
            <div className="absolute inset-2 rounded-full border border-primary/40" style={{ animation: "ping 2.5s cubic-bezier(0,0,0.2,1) infinite", animationDelay: "0.4s" }} />
            <div className="relative h-16 w-16 rounded-full bg-primary/10 border border-primary/40 grid place-items-center backdrop-blur">
              <Globe2 size={28} className="text-primary animate-[spin_12s_linear_infinite]" />
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-medium mb-6">
            <Sparkles size={14} />
            Oversite Websites
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
            Coming <span className="text-gradient">Soon.</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
            We're crafting something special. Custom-built websites that match the same
            quality and care as the rest of the Oversite ecosystem.
          </p>

          <div className="mt-10 flex items-center justify-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary animate-bounce" />
            <span className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0.15s" }} />
            <span className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0.3s" }} />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default WebsitePage;
