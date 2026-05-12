import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { MessageCircle, Globe, Mail } from "lucide-react";

const SOCIALS = [
  {
    label: "Discord",
    href: "https://discord.gg/B23N33DfUU",
    icon: MessageCircle,
  },
  {
    label: "Website",
    href: "https://www.oversite.shop",
    icon: Globe,
  },
  {
    label: "Email",
    href: "mailto:support@oversite.shop",
    icon: Mail,
  },
];

const MeetTheOwner = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 pt-28 pb-16 max-w-3xl">
        <div className="flex flex-col items-center text-center">
          {/* Avatar */}
          <div className="w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden border-4 border-primary/20 shadow-lg mb-6">
            <img
              src="/favicon.png"
              alt="Owner portrait"
              className="w-full h-full object-cover"
            />
          </div>

          {/* Name */}
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
            Meet the Owner
          </h1>
          <p className="text-lg text-muted-foreground font-medium mb-6">
            Founder of Oversite
          </p>

          {/* Bio */}
          <div className="w-full rounded-xl border border-border bg-card/40 p-6 md:p-8 text-left mb-8">
            <h2 className="text-xl font-semibold mb-3 text-foreground">About</h2>
            <div className="text-muted-foreground leading-relaxed space-y-3 text-sm">
              <p>
                Hi — I am the creator behind Oversite. What started as a passion for
                Roblox development and Discord tooling turned into a full-service studio
                building premium systems for creators and communities.
              </p>
              <p>
                I personally oversee every product, bot, and integration we ship. My goal
                is simple: deliver reliable, polished tools that actually solve problems —
                not add to them.
              </p>
              <p>
                When I am not writing code or designing UIs, you will find me in the
                Discord server talking with customers and shipping updates.
              </p>
            </div>
          </div>

          {/* Social links */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {SOCIALS.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card/40 text-sm font-medium text-foreground hover:bg-primary/10 hover:text-primary transition-colors"
              >
                <s.icon className="h-4 w-4" />
                {s.label}
              </a>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default MeetTheOwner;
