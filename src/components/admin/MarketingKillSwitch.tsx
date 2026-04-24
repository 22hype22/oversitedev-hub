import { useEffect, useState } from "react";
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

const STORAGE_KEY = "oversite-marketing-shutdown";
const SHUTDOWN_CODE = "Oversite19!";

type Props = {
  shutdown: boolean;
  onChange: (shutdown: boolean) => void;
};

export const MarketingKillSwitch = ({ shutdown, onChange }: Props) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [code, setCode] = useState("");
  const [pendingAction, setPendingAction] = useState<"shutdown" | "restore">("shutdown");

  const openDialog = (action: "shutdown" | "restore") => {
    setPendingAction(action);
    setCode("");
    setDialogOpen(true);
  };

  const handleConfirm = () => {
    if (code !== SHUTDOWN_CODE) {
      toast.error("Incorrect code");
      return;
    }
    const next = pendingAction === "shutdown";
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    onChange(next);
    setDialogOpen(false);
    setCode("");
    toast.success(next ? "Oversite Marketing has been shut down" : "Oversite Marketing has been restored");
  };

  return (
    <>
      <Card
        className={`p-5 border ${
          shutdown
            ? "border-destructive/50 bg-destructive/5"
            : "border-border bg-card"
        }`}
      >
        <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg grid place-items-center shrink-0 bg-destructive/10 border border-destructive/20">
              {shutdown ? (
                <ShieldAlert className="h-5 w-5 text-destructive" />
              ) : (
                <Power className="h-5 w-5 text-destructive" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-base leading-tight">
                {shutdown ? "Marketing is shut down" : "Marketing is active"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {shutdown
                  ? "Product management is disabled. Restore access to make changes."
                  : "Emergency shutdown disables all product management until restored."}
              </p>
            </div>
          </div>
          <Button
            variant={shutdown ? "hero" : "destructive"}
            size="sm"
            onClick={() => openDialog(shutdown ? "restore" : "shutdown")}
            className="shrink-0"
          >
            <Lock className="h-4 w-4 mr-2" />
            {shutdown ? "Restore Marketing" : "Shut Down Marketing"}
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
              {pendingAction === "shutdown" ? "disable" : "re-enable"} product management.
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
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={pendingAction === "shutdown" ? "destructive" : "hero"}
              onClick={handleConfirm}
            >
              {pendingAction === "shutdown" ? "Confirm Shutdown" : "Confirm Restore"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export const useMarketingShutdown = () => {
  const [shutdown, setShutdown] = useState(false);
  useEffect(() => {
    setShutdown(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);
  return [shutdown, setShutdown] as const;
};
