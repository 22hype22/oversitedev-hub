import { useState } from "react";
import { Link } from "react-router-dom";
import {
  LayoutGrid,
  Crown,
  Terminal,
  BarChart3,
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
  LifeBuoy,
  ArrowLeft,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Plugin = {
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
};

const plugins: Plugin[] = [
  { name: "Settings", description: "Configure Oversite's core settings.", icon: Settings, color: "text-slate-300" },
  { name: "Auto Reply", description: "Have Oversite respond automatically to certain triggers.", icon: MessageSquare, color: "text-sky-400" },
  { name: "Automod", description: "Let Oversite automatically moderate your server and give your mods a break.", icon: Bot, color: "text-violet-400" },
  { name: "Ban Appeal", description: "Ditch Google forms, handle your ban appeals with Oversite!", icon: ShieldAlert, color: "text-rose-400" },
  { name: "Custom Commands", description: "Create commands with your own code to run with Oversite.", icon: Code2, color: "text-amber-400" },
  { name: "Logging", description: "Log everything that happens in your server to a text channel (or multiple).", icon: ScrollText, color: "text-emerald-400" },
  { name: "Moderation", description: "Defend your server with a large arsenal of moderation commands.", icon: Gavel, color: "text-orange-400" },
  { name: "Reaction Roles", description: "Allow your server members to easily assign themselves roles via buttons or reactions.", icon: Sparkles, color: "text-pink-400" },
  { name: "Report", description: "Give your members a way to easily report rule-breaking messages to your moderators.", icon: Flag, color: "text-red-400" },
  { name: "Recurring Reminders", description: "Send repeating messages on a set interval to a channel of your choice.", icon: Clock, color: "text-cyan-400" },
  { name: "Roblox", description: "Link Roblox accounts to Discord users, assign roles to users based on their group rank.", icon: Lock, color: "text-indigo-400" },
  { name: "Starboard", description: "Save messages directly to a text channel by reacting with a star.", icon: Star, color: "text-yellow-400" },
  { name: "Welcome", description: "Set an autorole and welcome/goodbye messages.", icon: Hand, color: "text-teal-400" },
];

const sidebarItems = [
  { label: "View All Plugins", icon: LayoutGrid, active: true },
  { label: "Manage Premium", icon: Crown },
  { label: "Edit Commands", icon: Terminal },
  { label: "Usage Logs", icon: BarChart3 },
  ...plugins.map((p) => ({ label: p.name, icon: p.icon })),
];

const Admin = () => {
  const [active, setActive] = useState("View All Plugins");

  return (
    <div className="min-h-screen bg-[hsl(220_15%_8%)] text-foreground flex">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-[hsl(220_15%_10%)] border-r border-border/40 flex flex-col">
        <div className="p-4 border-b border-border/40">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-smooth">
            <ArrowLeft className="h-4 w-4" />
            Back to site
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.label;
            return (
              <button
                key={item.label}
                onClick={() => setActive(item.label)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-smooth ${
                  isActive
                    ? "bg-primary/10 text-foreground border-l-2 border-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5 border-l-2 border-transparent"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border/40 space-y-2">
          <div className="text-xs text-muted-foreground px-1">Server ID: 965953002714304573</div>
          <Button variant="hero" className="w-full" size="sm">
            <LifeBuoy className="h-4 w-4" />
            Get Support
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="px-8 py-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold tracking-tight">Managing Oversite</h1>
            <Badge className="mt-2 bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/15">
              Premium Enabled
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-w-[1400px] mx-auto">
            {plugins.map((p) => {
              const Icon = p.icon;
              return (
                <button
                  key={p.name}
                  onClick={() => setActive(p.name)}
                  className="group text-left bg-[hsl(220_15%_12%)] hover:bg-[hsl(220_15%_14%)] border border-border/40 hover:border-primary/40 rounded-lg p-5 transition-smooth flex flex-col min-h-[160px]"
                >
                  <div className="flex items-start gap-3 mb-2">
                    <Icon className={`h-7 w-7 ${p.color} shrink-0`} />
                    <h3 className="font-semibold text-base leading-tight pt-0.5">{p.name}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground flex-1">{p.description}</p>
                  <div className="flex justify-end mt-3">
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-smooth" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Admin;
