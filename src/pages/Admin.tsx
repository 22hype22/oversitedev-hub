import { Link } from "react-router-dom";
import {
  Settings,
  MessageSquare,
  Bot,
  ShieldAlert,
  Code2,
  ScrollText,
  Gavel,
  Sparkles,
  Flag,
  Clock,
  Lock,
  Star,
  Hand,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type Plugin = {
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

const plugins: Plugin[] = [
  { name: "Settings", description: "Configure Oversite's core settings.", icon: Settings },
  { name: "Auto Reply", description: "Have Oversite respond automatically to certain triggers.", icon: MessageSquare },
  { name: "Automod", description: "Let Oversite automatically moderate your server and give your mods a break.", icon: Bot },
  { name: "Ban Appeal", description: "Ditch Google forms, handle your ban appeals with Oversite!", icon: ShieldAlert },
  { name: "Custom Commands", description: "Create commands with your own code to run with Oversite.", icon: Code2 },
  { name: "Logging", description: "Log everything that happens in your server to a text channel (or multiple).", icon: ScrollText },
  { name: "Moderation", description: "Defend your server with a large arsenal of moderation commands.", icon: Gavel },
  { name: "Reaction Roles", description: "Allow your server members to easily assign themselves roles via buttons or reactions.", icon: Sparkles },
  { name: "Report", description: "Give your members a way to easily report rule-breaking messages to your moderators.", icon: Flag },
  { name: "Recurring Reminders", description: "Send repeating messages on a set interval to a channel of your choice.", icon: Clock },
  { name: "Roblox", description: "Link Roblox accounts to Discord users, assign roles to users based on their group rank.", icon: Lock },
  { name: "Starboard", description: "Save messages directly to a text channel by reacting with a star.", icon: Star },
  { name: "Welcome", description: "Set an autorole and welcome/goodbye messages.", icon: Hand },
];

const Admin = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-10 max-w-7xl">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-smooth"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to site
          </Link>
        </div>

        {/* Header */}
        <div className="text-center mb-12">
          <div className="text-primary text-xs font-semibold uppercase tracking-widest mb-2">
            Admin Panel
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Managing <span className="text-gradient">Oversite</span>
          </h1>
          <Badge className="mt-3 bg-primary/15 text-primary border border-primary/30 hover:bg-primary/15">
            Premium Enabled
          </Badge>
        </div>

        {/* Plugin grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {plugins.map((p) => {
            const Icon = p.icon;
            return (
              <Card
                key={p.name}
                className="group cursor-pointer bg-card hover:bg-card/80 border-border hover:border-primary/50 hover:shadow-elegant transition-smooth p-6 flex flex-col min-h-[170px]"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center shrink-0 group-hover:bg-primary/15 transition-smooth">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-base leading-tight pt-1.5">{p.name}</h3>
                </div>
                <p className="text-sm text-muted-foreground flex-1">{p.description}</p>
                <div className="flex justify-end mt-3">
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-smooth" />
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Admin;
