import { MessageSquare, FileText, Code2, Rocket, Clock, Shield, Users, Sparkles, CheckCircle2, GitBranch, Headphones, Zap } from "lucide-react";

const steps = [
  {
    n: "01",
    icon: MessageSquare,
    title: "Share your concept",
    desc: "Bring us anything from a one-liner to a full game design doc — we'll take it from there.",
    details: ["Free discovery call", "NDA available on request", "Reference material welcome"],
  },
  {
    n: "02",
    icon: FileText,
    title: "Scope & quote",
    desc: "Receive clear pricing, milestones, and timelines upfront. No surprises.",
    details: ["Fixed-price options", "Milestone breakdown", "Written agreement"],
  },
  {
    n: "03",
    icon: Code2,
    title: "Build & iterate",
    desc: "Our team designs, scripts, and ships in tight feedback loops with you.",
    details: ["Weekly progress builds", "Direct line to your developer", "Unlimited revisions in scope"],
  },
  {
    n: "04",
    icon: Rocket,
    title: "Launch & support",
    desc: "We polish, optimize, and stand by your project from launch into the future.",
    details: ["Launch-day monitoring", "Post-launch patches", "Long-term care plans"],
  },
];

const principles = [
  { icon: Clock, title: "On-time delivery", desc: "We commit to dates and we hit them. If something slips, you hear about it first." },
  { icon: Shield, title: "Built to last", desc: "Clean, documented code that your team — or ours — can extend for years." },
  { icon: Users, title: "You stay in the loop", desc: "Direct line to the developers actually building your project. No middlemen." },
  { icon: Sparkles, title: "Polish over hype", desc: "We obsess over the details that make a project feel professional." },
  { icon: GitBranch, title: "Transparent process", desc: "Live progress, version history, and source access from day one." },
  { icon: Zap, title: "Fast iteration", desc: "Tight feedback loops mean changes land in days, not weeks." },
];

const faqs = [
  { q: "How long does a typical project take?", a: "Most builds ship in 2–6 weeks depending on scope. Smaller systems and assets can launch in days; full game experiences take longer. We give you a firm timeline before any work begins." },
  { q: "Do you work with NDAs?", a: "Absolutely. We sign NDAs before discovery whenever needed and treat every project as confidential by default." },
  { q: "What happens after launch?", a: "Every project comes with a free post-launch window for fixes. After that, we offer monthly care plans or pay-as-you-go support — whichever fits you best." },
  { q: "Can you take over an existing project?", a: "Yes. We regularly inherit codebases, audit them, and either continue development or refactor them into something maintainable." },
  { q: "How do payments work?", a: "We split projects into milestones with a deposit upfront. You pay as work is delivered and approved — never for promises." },
];

export const Process = () => (
  <>
    {/* Hero */}
    <section className="pt-20 pb-12 md:pt-28 md:pb-16">
      <div className="container mx-auto px-4 text-center max-w-3xl">
        <div className="text-primary text-sm font-medium mb-3">How we work</div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-5">
          Built right. <span className="text-gradient">Delivered on time.</span>
        </h1>
        <p className="text-lg text-muted-foreground leading-relaxed">
          A clear, four-step process designed to take your idea from a rough concept to a polished, production-ready product — without the chaos.
        </p>
      </div>
    </section>

    {/* Steps */}
    <section className="py-12 md:py-16 bg-accent/40 border-y border-border">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {steps.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.n} className="p-6 rounded-xl bg-gradient-card border border-border hover:border-primary/40 transition-smooth">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-3xl font-bold text-gradient">{s.n}</div>
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                </div>
                <h3 className="font-semibold text-lg mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">{s.desc}</p>
                <ul className="space-y-1.5 pt-4 border-t border-border">
                  {s.details.map((d) => (
                    <li key={d} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>

    {/* Timeline */}
    <section className="py-20 md:py-28">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-14">
          <div className="text-primary text-sm font-medium mb-3">Typical timeline</div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            From kickoff to <span className="text-gradient">launch day</span>
          </h2>
        </div>
        <div className="relative">
          <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-px bg-border md:-translate-x-px" />
          {[
            { day: "Day 0", title: "Kickoff call", desc: "Goals, scope, and success criteria locked in." },
            { day: "Day 1–3", title: "Proposal delivered", desc: "Detailed quote, milestone plan, and signed agreement." },
            { day: "Week 1", title: "First playable / preview", desc: "Early build in your hands so we can adjust direction fast." },
            { day: "Week 2+", title: "Iteration cycles", desc: "Weekly drops, your feedback, and steady forward progress." },
            { day: "Launch", title: "Ship & monitor", desc: "Deployment, real-time monitoring, and rapid hotfixes if needed." },
            { day: "Ongoing", title: "Support & growth", desc: "Updates, new features, and care plans tailored to your needs." },
          ].map((item, i) => {
            const isLeft = i % 2 === 0;
            return (
              <div key={item.day} className="relative md:grid md:grid-cols-2 md:gap-8 mb-10 last:mb-0">
                <div className="absolute left-4 md:left-1/2 top-2 w-3 h-3 rounded-full bg-primary ring-4 ring-background -translate-x-1/2" />
                {isLeft ? (
                  <>
                    <div className="pl-12 md:pl-0 md:pr-10 md:text-right">
                      <div className="text-xs text-primary font-semibold mb-1">{item.day}</div>
                      <h4 className="font-semibold mb-1">{item.title}</h4>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                    <div className="hidden md:block" />
                  </>
                ) : (
                  <>
                    <div className="hidden md:block" />
                    <div className="pl-12 md:pl-10 md:pr-0">
                      <div className="text-xs text-primary font-semibold mb-1">{item.day}</div>
                      <h4 className="font-semibold mb-1">{item.title}</h4>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>

    {/* Principles */}
    <section className="py-20 md:py-28 bg-accent/40 border-y border-border">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mb-14">
          <div className="text-primary text-sm font-medium mb-3">What you can expect</div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
            Principles we <span className="text-gradient">never compromise on</span>
          </h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {principles.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.title} className="p-6 rounded-xl bg-gradient-card border border-border">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{p.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>

    {/* FAQ */}
    <section id="faq" className="py-20 md:py-28 scroll-mt-24">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="text-center mb-12">
          <div className="text-primary text-sm font-medium mb-3">FAQ</div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Common <span className="text-gradient">questions</span>
          </h2>
        </div>
        <div className="space-y-3">
          {faqs.map((f) => (
            <details key={f.q} className="group p-5 rounded-xl bg-gradient-card border border-border hover:border-primary/30 transition-smooth">
              <summary className="flex items-center justify-between cursor-pointer font-medium list-none">
                <span>{f.q}</span>
                <span className="text-primary text-xl transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>

    {/* CTA */}
    <section className="pb-24">
      <div className="container mx-auto px-4">
        <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background p-10 md:p-14 text-center">
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative">
            <Headphones className="w-10 h-10 text-primary mx-auto mb-4" />
            <h2 className="text-2xl md:text-4xl font-bold mb-3">
              Ready to start your <span className="text-gradient">project?</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto mb-6">
              Book a free discovery call. No pressure, no commitment — just a conversation about what you want to build.
            </p>
            <a href="/#contact" className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-smooth shadow-elegant">
              Start a project
            </a>
          </div>
        </div>
      </div>
    </section>
  </>
);
