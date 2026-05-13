import { Link } from "react-router-dom";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { ChevronRight } from "lucide-react";

const MEMBERS = [
  {
    href: "/explore/owner",
    name: "Owner",
    handle: "me",
    role: "Founder & Lead Developer",
    image: "/favicon.png",
  },
  {
    href: "/explore/plugyxz",
    name: "plugyxz",
    handle: "plugyxz",
    role: "Lead Developer & Director",
    image: "/favicon.png",
  },
];

const MeetTheTeam = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 pt-28 pb-16 max-w-3xl">
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">Meet the Team</h1>
          <p className="text-muted-foreground">The people behind Oversite.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {MEMBERS.map((m) => (
            <Link
              key={m.href}
              to={m.href}
              className="group rounded-xl border border-border bg-card/40 p-6 hover:bg-card/70 hover:border-primary/40 transition-colors flex items-center gap-4"
            >
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary/20 shrink-0">
                <img src={m.image} alt={m.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-foreground">{m.name}</div>
                <div className="text-sm text-muted-foreground">{m.role}</div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </Link>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default MeetTheTeam;
