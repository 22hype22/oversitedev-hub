import { Code2, Gamepad2, Layout, Rocket, Users, LineChart } from "lucide-react";

const services = [
  { icon: Code2, title: "Scripting & Systems", desc: "Robust Luau scripting, datastores, networking, anti-exploit, and complex game systems." },
  { icon: Layout, title: "UI & UX Design", desc: "Polished interfaces and HUDs designed to feel native and convert players." },
  { icon: Gamepad2, title: "Gameplay Design", desc: "Mechanics, progression, and economy loops that keep players coming back." },
  { icon: Rocket, title: "Optimization", desc: "High-quality, performant builds engineered to scale with your audience." },
  { icon: Users, title: "Team Support", desc: "Dedicated developers from concept to launch — and well beyond." },
  { icon: LineChart, title: "Project Scoping", desc: "Clear pricing, timelines, and scope — upfront and in writing." },
];

export const Services = () => (
  <section id="services" className="py-24 md:py-32 relative">
    <div className="container mx-auto px-4">
      <div className="max-w-2xl mb-14">
        <div className="text-primary text-sm font-medium mb-3">What we do</div>
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
          Full-service Roblox <span className="text-gradient">development</span>
        </h2>
        <p className="mt-4 text-muted-foreground text-lg">
          From small experiences to large, complex games — every part of your project handled by experts.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {services.map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="group relative p-6 rounded-xl bg-gradient-card border border-border hover:border-primary/40 transition-smooth"
          >
            <div className="w-11 h-11 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center mb-4 group-hover:bg-primary/20 group-hover:shadow-glow transition-smooth">
              <Icon className="text-primary" size={20} />
            </div>
            <h3 className="font-semibold text-lg mb-2">{title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);
