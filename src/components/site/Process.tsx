const steps = [
  { n: "01", title: "Share your concept", desc: "Bring us anything from a one-liner to a full game design doc — we'll take it from there." },
  { n: "02", title: "Scope & quote", desc: "Receive clear pricing, milestones, and timelines upfront. No surprises." },
  { n: "03", title: "Build & iterate", desc: "Our team designs, scripts, and ships in tight feedback loops with you." },
  { n: "04", title: "Launch & support", desc: "We polish, optimize, and stand by your project from launch into the future." },
];

export const Process = () => (
  <section id="process" className="py-24 md:py-32 bg-accent/40 border-y border-border">
    <div className="container mx-auto px-4">
      <div className="max-w-2xl mb-14">
        <div className="text-primary text-sm font-medium mb-3">How we work</div>
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
          Built right. <span className="text-gradient">Delivered on time.</span>
        </h2>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
        {steps.map((s) => (
          <div key={s.n} className="p-6 rounded-xl bg-gradient-card border border-border">
            <div className="text-3xl font-bold text-gradient mb-3">{s.n}</div>
            <h3 className="font-semibold text-lg mb-2">{s.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);
