import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { Globe2, Sparkles, Code2, Rocket, Zap, Star, Cpu } from "lucide-react";

const flyers = [
  { Icon: Rocket, top: "12%", left: "8%", duration: "14s", delay: "0s", size: 28, rotate: "-15deg" },
  { Icon: Code2, top: "70%", left: "12%", duration: "18s", delay: "2s", size: 24, rotate: "10deg" },
  { Icon: Sparkles, top: "20%", left: "85%", duration: "16s", delay: "1s", size: 22, rotate: "20deg" },
  { Icon: Zap, top: "78%", left: "82%", duration: "13s", delay: "3s", size: 26, rotate: "-10deg" },
  { Icon: Star, top: "40%", left: "5%", duration: "20s", delay: "4s", size: 18, rotate: "0deg" },
  { Icon: Cpu, top: "55%", left: "92%", duration: "17s", delay: "1.5s", size: 22, rotate: "15deg" },
  { Icon: Sparkles, top: "8%", left: "50%", duration: "15s", delay: "2.5s", size: 16, rotate: "0deg" },
  { Icon: Star, top: "88%", left: "45%", duration: "19s", delay: "0.5s", size: 14, rotate: "0deg" },
];

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

        {/* Flying icons */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {flyers.map((f, i) => {
            const Icon = f.Icon;
            return (
              <div
                key={i}
                className="absolute text-primary/60"
                style={{
                  top: f.top,
                  left: f.left,
                  animation: `website-float ${f.duration} ease-in-out ${f.delay} infinite`,
                }}
              >
                <div
                  style={{
                    animation: `website-spin ${f.duration} linear ${f.delay} infinite`,
                    transform: `rotate(${f.rotate})`,
                  }}
                >
                  <Icon size={f.size} />
                </div>
              </div>
            );
          })}

          {/* Shooting star streaks */}
          <div
            className="absolute h-px w-32 bg-gradient-to-r from-transparent via-primary to-transparent"
            style={{ top: "25%", left: "-10%", animation: "website-shoot 6s linear infinite" }}
          />
          <div
            className="absolute h-px w-40 bg-gradient-to-r from-transparent via-primary to-transparent"
            style={{ top: "65%", left: "-10%", animation: "website-shoot 8s linear 2.5s infinite" }}
          />
          <div
            className="absolute h-px w-24 bg-gradient-to-r from-transparent via-primary to-transparent"
            style={{ top: "45%", left: "-10%", animation: "website-shoot 7s linear 4s infinite" }}
          />
        </div>

        <div className="relative text-center max-w-2xl animate-fade-in z-10">
          <div className="mx-auto mb-8 relative w-28 h-28 grid place-items-center">
            <div className="absolute inset-0 rounded-full border border-primary/30 animate-ping" />
            <div
              className="absolute inset-2 rounded-full border border-primary/40"
              style={{ animation: "ping 2.5s cubic-bezier(0,0,0.2,1) infinite", animationDelay: "0.4s" }}
            />
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

        <style>{`
          @keyframes website-float {
            0%, 100% { transform: translate(0, 0); }
            25% { transform: translate(40px, -30px); }
            50% { transform: translate(-20px, -60px); }
            75% { transform: translate(-50px, 20px); }
          }
          @keyframes website-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes website-shoot {
            0% { transform: translateX(0) translateY(0); opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { transform: translateX(120vw) translateY(40px); opacity: 0; }
          }
        `}</style>
      </main>
      <Footer />
    </div>
  );
};

export default WebsitePage;
