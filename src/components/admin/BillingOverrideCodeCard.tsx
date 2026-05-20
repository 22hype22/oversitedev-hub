import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { KeyRound, Copy, RefreshCw } from "lucide-react";

type Row = { code: string; rotated_at: string; expires_at: string };

export function BillingOverrideCodeCard() {
  const [row, setRow] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("get_current_billing_override_code");
    if (error) toast.error("Couldn't load override code", { description: error.message });
    else if (data?.[0]) setRow(data[0] as Row);
    setLoading(false);
  }, []);

  const rotate = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("rotate_billing_override_code");
    if (error) toast.error("Couldn't rotate", { description: error.message });
    else if (data?.[0]) {
      setRow(data[0] as Row);
      toast.success("New code generated");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const tick = setInterval(() => setNow(Date.now()), 1000);
    // Refresh from server every minute so a rotation is picked up promptly
    const refresh = setInterval(load, 60_000);
    return () => {
      clearInterval(tick);
      clearInterval(refresh);
    };
  }, [load]);

  const expiresMs = row ? new Date(row.expires_at).getTime() : 0;
  const remaining = Math.max(0, expiresMs - now);
  const mm = Math.floor(remaining / 60_000);
  const ss = Math.floor((remaining % 60_000) / 1000);

  // When timer hits 0, pull the new one
  useEffect(() => {
    if (row && remaining === 0) load();
  }, [remaining, row, load]);

  const copy = () => {
    if (!row) return;
    navigator.clipboard.writeText(row.code);
    toast.success("Copied");
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center">
          <KeyRound className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold tracking-tight">Billing override code</h3>
          <p className="text-sm text-muted-foreground">
            Rotates every 15 minutes. Share with customers who paid off-platform (e.g. PayPal) to bypass the billing details form.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card/60 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-center sm:text-left">
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Current code</div>
          <div className="font-mono text-3xl font-bold tracking-[0.3em]">
            {loading || !row ? "••••••••" : row.code}
          </div>
        </div>
        <div className="text-center sm:text-right">
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Expires in</div>
          <div className="font-mono text-2xl font-semibold tabular-nums">
            {row ? `${mm}:${ss.toString().padStart(2, "0")}` : "--:--"}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={copy} disabled={!row} title="Copy">
            <Copy className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={rotate} disabled={loading} title="Generate new code now">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>
    </Card>
  );
}
