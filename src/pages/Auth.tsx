import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, ShieldCheck } from "lucide-react";

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">(
    params.get("mode") === "signup" ? "signup" : "signin",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [robloxUsername, setRobloxUsername] = useState("");
  const [discordUsername, setDiscordUsername] = useState("");
  const [busy, setBusy] = useState(false);

  const inviteToken = params.get("team_invite");
  const transferToken = params.get("team_transfer");
  const postAuthPath = inviteToken
    ? "/bot-dashboard?team_invite=accepted"
    : transferToken
      ? "/bot-dashboard?team_transfer=accepted"
      : "/";

  const runPostAuthActions = async () => {
    if (inviteToken) {
      // Accept by token (works even if the invitee signs in with a different
      // email than the invite was sent to). Fall back to email-based acceptance
      // for any other pending invites tied to this user's email.
      try {
        await (supabase as any).rpc("team_accept_invite_by_token", { _token: inviteToken });
      } catch (e) {
        console.error("team_accept_invite_by_token failed", e);
      }
      try {
        await (supabase as any).rpc("team_accept_invites_for_current_user");
      } catch (e) {
        console.error("team_accept_invites_for_current_user failed", e);
      }
    }
    if (transferToken) {
      const { data, error } = await (supabase as any).rpc(
        "team_confirm_ownership_transfer",
        { _token: transferToken },
      );
      if (error || !data?.ok) {
        toast({
          title: "Couldn't confirm transfer",
          description: error?.message ?? data?.error ?? "Try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Ownership transferred",
          description: "You are now the owner of this account.",
        });
        try {
          const { data: userResp } = await supabase.auth.getUser();
          const newOwnerEmail = userResp?.user?.email;
          const previousOwnerEmail = (data as any)?.previous_owner_email ?? null;
          const transferId = (data as any)?.transfer_id ?? transferToken;
          const dashboardUrl = `${window.location.origin}/bot-dashboard`;
          if (newOwnerEmail) {
            await supabase.functions.invoke("send-transactional-email", {
              body: {
                templateName: "team-transfer-complete",
                recipientEmail: newOwnerEmail,
                templateData: { previousOwnerEmail, dashboardUrl },
                idempotencyKey: `team-transfer-complete:${transferId}`,
              },
            });
          }
        } catch (e) {
          console.error("team-transfer-complete email failed", e);
        }
      }
    }
  };

  useEffect(() => {
    let cancelled = false;
    const go = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled || !session) return;
      if (inviteToken || transferToken) {
        // Always navigate, even if post-auth actions fail — otherwise the page
        // can hang forever on a silent RPC error.
        try {
          await runPostAuthActions();
        } catch (e) {
          console.error("post-auth actions failed", e);
        }
        if (!cancelled) navigate(postAuthPath, { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    };
    void go();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, inviteToken, transferToken, postAuthPath]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (mode === "signup" && password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please re-enter your password.",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const redirectSuffix = inviteToken
          ? `?team_invite=${inviteToken}`
          : transferToken
            ? `?team_transfer=${transferToken}`
            : "";
        const emailRedirectTo = `${window.location.origin}/auth${redirectSuffix}`;
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo,
            data: {
              roblox_username: robloxUsername.trim(),
              discord_username: discordUsername.trim(),
            },
          },
        });
        if (error) throw error;
        toast({
          title: "Check your email",
          description: "Confirm your email to finish creating your account — be sure to check your spam or junk folder if you don't see it. Your 10% off is waiting!",
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await runPostAuthActions();
        navigate(postAuthPath, { replace: true });
      }
    } catch (err: any) {
      toast({
        title: "Authentication failed",
        description: err.message ?? "Try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-16">
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4 max-w-md">
            {mode === "signup" && (
              <div className="mb-6 rounded-xl border border-primary/40 bg-primary/10 p-4 flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-foreground">
                    Get <span className="text-primary font-bold">10% OFF</span> your next order
                  </p>
                  <p className="text-muted-foreground">
                    Your one-time welcome discount activates as soon as you create your account.
                  </p>
                </div>
              </div>
            )}

            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
              {mode === "signin" ? "Sign in" : "Create your account"}
            </h1>
            <p className="text-muted-foreground mb-8">
              {mode === "signin"
                ? "Welcome back."
                : "Join Oversite — we'll never spam, sell, or share your info."}
            </p>

            <form
              onSubmit={onSubmit}
              className="space-y-4 p-7 rounded-2xl bg-gradient-card border border-border"
            >
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {mode === "signup" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="roblox">Roblox username</Label>
                    <Input
                      id="roblox"
                      type="text"
                      required
                      maxLength={50}
                      value={robloxUsername}
                      onChange={(e) => setRobloxUsername(e.target.value)}
                      placeholder="YourRobloxName"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="discord">Discord username</Label>
                    <Input
                      id="discord"
                      type="text"
                      required
                      maxLength={50}
                      value={discordUsername}
                      onChange={(e) => setDiscordUsername(e.target.value)}
                      placeholder="yourdiscordhandle"
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              )}

              <Button type="submit" variant="hero" className="w-full" disabled={busy}>
                {busy ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}
              </Button>

              <button
                type="button"
                className="w-full text-sm text-muted-foreground hover:text-foreground"
                onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
              >
                {mode === "signin"
                  ? "Need an account? Sign up"
                  : "Already have an account? Sign in"}
              </button>
            </form>

            {mode === "signup" && (
              <p className="mt-4 text-xs text-muted-foreground text-center inline-flex items-center gap-1.5 justify-center w-full">
                <ShieldCheck className="h-3.5 w-3.5" />
                We never sell your data. No spam — ever.
              </p>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Auth;
