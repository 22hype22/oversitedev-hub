import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const RESET_CODE = "Oversite19!";

type RangeKey = "1h" | "24h" | "7d" | "30d" | "90d" | "all";

const RANGE_OPTIONS: { value: RangeKey; label: string; hours: number | null }[] = [
  { value: "1h", label: "Last 1 hour", hours: 1 },
  { value: "24h", label: "Last 24 hours", hours: 24 },
  { value: "7d", label: "Last 7 days", hours: 24 * 7 },
  { value: "30d", label: "Last 30 days", hours: 24 * 30 },
  { value: "90d", label: "Last 90 days", hours: 24 * 90 },
  { value: "all", label: "All time", hours: null },
];

export const ResetPurchases = () => {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [range, setRange] = useState<RangeKey>("24h");
  const [busy, setBusy] = useState(false);

  const reset = async () => {
    if (code !== RESET_CODE) {
      toast.error("Incorrect code");
      return;
    }
    setBusy(true);
    try {
      const opt = RANGE_OPTIONS.find((r) => r.value === range)!;
      const cutoff = opt.hours
        ? new Date(Date.now() - opt.hours * 60 * 60 * 1000).toISOString()
        : null;

      // Delete Stripe purchases
      let purchasesQ = supabase.from("purchases").delete();
      if (cutoff) purchasesQ = purchasesQ.gte("created_at", cutoff);
      else purchasesQ = purchasesQ.not("id", "is", null);
      const { error: pErr, count: pCount } = await purchasesQ.select("*", {
        count: "exact",
        head: true,
      });

      // Delete fulfilled gamepass purchases
      let pendingQ = supabase.from("pending_purchases").delete();
      if (cutoff) pendingQ = pendingQ.gte("created_at", cutoff);
      else pendingQ = pendingQ.not("id", "is", null);
      const { error: gErr, count: gCount } = await pendingQ.select("*", {
        count: "exact",
        head: true,
      });

      if (pErr || gErr) {
        console.error(pErr || gErr);
        toast.error("Failed to reset purchases");
        return;
      }

      const total = (pCount ?? 0) + (gCount ?? 0);
      toast.success(`Reset complete — removed ${total} purchase record(s)`);
      setOpen(false);
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card className="p-5 mb-6 border border-border bg-card">
        <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg grid place-items-center shrink-0 bg-destructive/10 border border-destructive/20">
              <RotateCcw className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <h3 className="font-semibold text-base leading-tight">
                Reset Product Purchases
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Permanently delete purchase records (Stripe + Roblox gamepass) from
                a chosen time range.
              </p>
            </div>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              setCode("");
              setOpen(true);
            }}
            className="shrink-0"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Reset Purchases
          </Button>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset product purchases?</DialogTitle>
            <DialogDescription>
              This permanently deletes purchase records in the selected time
              range. Users will lose ownership of those products. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Time range</Label>
              <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RANGE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reset-code">Security code</Label>
              <Input
                id="reset-code"
                type="password"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") reset();
                }}
                placeholder="Enter code"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={reset} disabled={busy}>
              {busy ? "Resetting…" : "Confirm Reset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
