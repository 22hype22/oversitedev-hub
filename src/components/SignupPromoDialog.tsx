import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, ShieldCheck, Lock, MailCheck } from "lucide-react";

const SESSION_KEY = "oversite-promo-shown";

export const SignupPromoDialog = () => {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || user) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    const t = setTimeout(() => setOpen(true), 5000);
    return () => clearTimeout(t);
  }, [loading, user]);

  const handleOpenChange = (next: boolean) => {
    if (!next) sessionStorage.setItem(SESSION_KEY, "1");
    setOpen(next);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast({ title: "Welcome back!", description: "You're signed in." });
      setOpen(false);
    } catch (err: any) {
      toast({
        title: "Sign in failed",
        description: err.message ?? "Check your email and password.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const goSignup = () => {
    setOpen(false);
    navigate("/auth?mode=signup");
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-6 border-b border-border">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/40 text-primary text-xs font-semibold uppercase tracking-wider mb-3">
            <Sparkles className="h-3.5 w-3.5" />
            Members only
          </div>
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle className="text-2xl md:text-3xl font-bold tracking-tight">
              Get <span className="text-5xl md:text-6xl font-black text-primary align-middle">10% OFF</span>
              <br />
              your next order
            </DialogTitle>
            <DialogDescription className="text-base text-muted-foreground">
              Sign in to claim your one-time welcome discount. New here? Create an account in seconds.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-5">
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="promo-email">Email</Label>
              <Input
                id="promo-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo-password">Password</Label>
              <Input
                id="promo-password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" variant="hero" className="w-full" disabled={busy}>
              {busy ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">No account yet?</span>
            </div>
          </div>

          <Button variant="outlineGlow" className="w-full" onClick={goSignup}>
            Create an account & claim 10% off
          </Button>

          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2 text-xs text-muted-foreground">
            <div className="flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>We'll <strong className="text-foreground">never sell</strong> your information.</span>
            </div>
            <div className="flex items-start gap-2">
              <MailCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>No spam — only order updates and important account notices.</span>
            </div>
            <div className="flex items-start gap-2">
              <Lock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>Your data stays private and is only used to power your account.</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
