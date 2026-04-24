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
import { Power, ShieldAlert, Lock } from "lucide-react";
import { toast } from "sonner";
import {
  useMarketingSuspended,
  setMarketingSuspended,
} from "@/hooks/useMarketingSuspended";

const SHUTDOWN_CODE = "Oversite19!";

export const MarketingKillSwitch = () => {
  const { suspended } = useMarketingSuspended();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [code, setCode] = useState("");
  const [pendingAction, setPendingAction] = useState<"shutdown" | "restore">("shutdown");
  const [busy, setBusy] = useState(false);

  const openDialog = (action: "shutdown" | "restore") => {
    setPendingAction(action);
    setCode("");
    setDialogOpen(true);
  };

  const handleConfirm = async () => {
    if (code !== SHUTDOWN_CODE) {
      toast.error("Incorrect code");
      return;
    }
    const next = pendingAction === "shutdown";
    setBusy(true);
    const { error } = await setMarketingSuspended(next);
    setBusy(false);
    if (error) {
      toast.error("Failed to update — are you signed in as an admin?");
      return;
    }
    setDialogOpen(false);
    setCode("");
    toast.success(
      next
        ? "Oversite Marketing has been shut down for everyone"
        : "Oversite Marketing has been restored"
    );
  };

  return (
    <>
      <Card
        className={`p-5 border ${
          suspended
            ? "border-destructive/50 bg-destructive/5"
            : "border-destructive/30 bg-destructive/5"
        }`}
      >
        <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg grid place-items-center shrink-0 bg-destructive/10 border border-destructive/20">
              {suspended ? (
                <ShieldAlert className="h-5 w-5 text-destructive" />
              ) : (
                <Power className="h-5 w-5 text-destructive" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-base leading-tight">
                {suspended ? "Marketing is shut down" : "Marketing is active"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {suspended
                  ? "All visitors see the suspension banner. Restore access to make changes."
                  : "Emergency shutdown disables product management and purchases site-wide."}
              </p>
            </div>
          </div>
          <Button
            variant={suspended ? "hero" : "destructive"}
            size="sm"
            onClick={() => openDialog(suspended ? "restore" : "shutdown")}
            className="shrink-0"
          >
            <Lock className="h-4 w-4 mr-2" />
            {suspended ? "Restore Marketing" : "Shut Down Marketing"}
          </Button>
        </div>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingAction === "shutdown" ? "Shut down Oversite Marketing?" : "Restore Oversite Marketing?"}
            </DialogTitle>
            <DialogDescription>
              Enter the security code to{" "}
              {pendingAction === "shutdown" ? "disable" : "re-enable"} Oversite Marketing for every visitor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="kill-switch-code">Security code</Label>
            <Input
              id="kill-switch-code"
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirm();
              }}
              placeholder="Enter code"
              autoFocus
              disabled={busy}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant={pendingAction === "shutdown" ? "destructive" : "hero"}
              onClick={handleConfirm}
              disabled={busy}
            >
              {pendingAction === "shutdown" ? "Confirm Shutdown" : "Confirm Restore"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

// Backwards-compat shim for Admin page (no longer needed but keeps imports working).
export const useMarketingShutdown = () => {
  const { suspended } = useMarketingSuspended();
  return [suspended, () => {}] as const;
};
