import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { LifeBuoy, ArrowRight, Clock, X, Loader2 } from "lucide-react";
import { rememberRedeemedGrant } from "@/hooks/useSupportGrants";

type Grant = {
  id: string;
  owner_user_id: string;
  granted_at: string;
  expires_at: string;
};

export function SupportAccessRedeemer() {
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("support_access_grants")
      .select("id, owner_user_id, granted_at, expires_at")
      .eq("admin_user_id", user.id)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("granted_at", { ascending: false });
    setGrants((data ?? []) as Grant[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    reload();
  }, [reload]);

  const redeem = async () => {
    if (!code.trim()) return;
    setRedeeming(true);
    const { data, error } = await (supabase as any).rpc("redeem_support_access_code", {
      _code: code.trim(),
    });
    setRedeeming(false);
    if (error || !data?.ok) {
      toast.error("Couldn't redeem", { description: error?.message ?? data?.error });
      return;
    }
    rememberRedeemedGrant(data.grant_id, data.owner_user_id);
    toast.success("Access granted", {
      description: `Active until ${new Date(data.expires_at).toLocaleString()}`,
    });
    setCode("");
    reload();
  };

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center">
          <LifeBuoy className="h-4 w-4 text-primary" />
        </div>
        <div>
          <div className="font-semibold">Support access</div>
          <p className="text-xs text-muted-foreground">
            Paste a user-issued code to enter their bot dashboard temporarily.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="SUP-XXXX-XXXX"
          className="font-mono uppercase"
          onKeyDown={(e) => {
            if (e.key === "Enter") redeem();
          }}
          disabled={redeeming}
        />
        <Button onClick={redeem} disabled={!code.trim() || redeeming}>
          {redeeming && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          Redeem
        </Button>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground text-center py-2">
          <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
          Loading active sessions…
        </div>
      ) : grants.length > 0 ? (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Active sessions
          </div>
          {grants.map((g) => (
            <div
              key={g.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/40 px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">
                  Owner <code className="text-xs">{g.owner_user_id.slice(0, 8)}…</code>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Clock className="h-3 w-3" />
                  Expires {new Date(g.expires_at).toLocaleString()}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button asChild size="sm" variant="outline">
                  <Link to="/bot-dashboard">
                    Open dashboard
                    <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={async () => {
                    // Admins can't revoke a grant directly (only owners can). Mark as no-op
                    // and tell them to ask the owner. We'll add an admin-side "release" later
                    // if needed.
                    toast.info(
                      "Only the bot owner can revoke a code. Ask them to revoke from their dashboard, or wait for it to expire.",
                    );
                  }}
                  title="Owner-only — ask them to revoke"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-2">
          No active support sessions.
        </p>
      )}
    </Card>
  );
}
