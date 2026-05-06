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
import { ShoppingCart, Hourglass, Lock } from "lucide-react";
import { toast } from "sonner";
import { useBotSalesMode, setBotSalesMode } from "@/hooks/useBotSalesMode";

const SECURITY_CODE = "Oversite19!";

export const BotSalesModeSwitch = () => {
  const { mode } = useBotSalesMode();
  const isLive = mode === "live";
  const [dialogOpen, setDialogOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const next = isLive ? "preorder" : "live";

  const openDialog = () => {
    setCode("");
    setDialogOpen(true);
  };

  const handleConfirm = async () => {
    if (code !== SECURITY_CODE) {
      toast.error("Incorrect code");
      return;
    }
    setBusy(true);
    const { error } = await setBotSalesMode(next);
    setBusy(false);
    if (error) {
      toast.error("Failed to update — are you signed in as an admin?");
      return;
    }
    setDialogOpen(false);
    setCode("");
    toast.success(
      next === "live"
        ? "Bots are now live for purchase"
        : "Bots are back in preorder mode"
    );
  };

  return (
    <>
      <Card
        className={`p-5 border ${
          isLive ? "border-primary/50 bg-primary/5" : "border-border"
        }`}
      >
        <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg grid place-items-center shrink-0 bg-destructive/10 border border-destructive/20">
              {isLive ? (
                <ShoppingCart className="h-5 w-5 text-destructive" />
              ) : (
                <Hourglass className="h-5 w-5 text-destructive" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-base leading-tight">
                {isLive ? "Bots are live for purchase" : "Bots are in preorder mode"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {isLive
                  ? "Customers can buy and get their bot built immediately."
                  : "Customers can reserve a bot at preorder pricing — builds run when you flip to live."}
              </p>
            </div>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={openDialog}
            className="shrink-0"
          >
            <Lock className="h-4 w-4 mr-2" />
            {isLive ? "Switch to Preorder" : "Go Live"}
          </Button>
        </div>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {next === "live" ? "Open bots for purchase?" : "Return to preorder mode?"}
            </DialogTitle>
            <DialogDescription>
              Enter the security code to switch the bot store to{" "}
              {next === "live" ? "live (buy now)" : "preorder"} for every visitor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="bot-sales-mode-code">Security code</Label>
            <Input
              id="bot-sales-mode-code"
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
              variant={next === "live" ? "hero" : "destructive"}
              onClick={handleConfirm}
              disabled={busy}
            >
              {next === "live" ? "Confirm Go Live" : "Confirm Preorder Mode"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
