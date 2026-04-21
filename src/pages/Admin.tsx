import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Bot, ShieldCheck, LogOut } from "lucide-react";

const Admin = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [loading, user, navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="pt-32 container mx-auto px-4">
          <p className="text-muted-foreground">Loading…</p>
        </main>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="pt-32 container mx-auto px-4 max-w-2xl">
          <div className="p-8 rounded-2xl bg-gradient-card border border-border text-center">
            <ShieldCheck className="mx-auto text-primary mb-4" size={36} />
            <h1 className="text-2xl font-bold mb-2">Access restricted</h1>
            <p className="text-muted-foreground mb-6">
              Your account ({user.email}) isn't on the admin allowlist. Ask an existing admin to add you.
            </p>
            <Button variant="outlineGlow" onClick={handleSignOut}>
              <LogOut /> Sign out
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16">
        <section className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
            <div>
              <div className="text-primary text-sm font-medium mb-2">Admin</div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Discord bot dashboard</h1>
              <p className="text-muted-foreground mt-2">Signed in as {user.email}</p>
            </div>
            <Button variant="outlineGlow" onClick={handleSignOut}>
              <LogOut /> Sign out
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-7 rounded-2xl bg-gradient-card border border-border">
              <Bot className="text-primary mb-3" />
              <h2 className="font-semibold text-lg mb-2">Bot status</h2>
              <p className="text-sm text-muted-foreground">
                Connect your Discord bot here. Wire it up whenever you're ready and we'll surface live status, command logs, and controls.
              </p>
            </div>
            <div className="p-7 rounded-2xl bg-gradient-card border border-border">
              <ShieldCheck className="text-primary mb-3" />
              <h2 className="font-semibold text-lg mb-2">Admin access</h2>
              <p className="text-sm text-muted-foreground">
                Only emails on the allowlist can reach this page. Add or remove emails directly in the database.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Admin;
