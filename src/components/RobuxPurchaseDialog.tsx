import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ExternalLink, CheckCircle2, Copy, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast as sonnerToast } from "sonner";

function normalizeGamepassUrl(rawUrl: string) {
  const url = (rawUrl || "").trim();
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url.replace(/^\/+/, "")}`;
}

export interface RobuxPurchaseProduct {
  /** Storefront product ID (may be prefixed with "custom-"). */
  id: string;
  name: string;
  priceRobux: number;
  gamepassUrl: string;
  /** When true, this purchase is a paid upgrade for an existing purchase. */
  upgradeMode?: boolean;
  /** Existing purchase row to bump on success (required when upgradeMode). */
  parentPurchaseId?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: RobuxPurchaseProduct | null;
}

type Step = "username" | "purchase" | "success";

export function RobuxPurchaseDialog({ open, onOpenChange, product }: Props) {
  const [step, setStep] = useState<Step>("username");
  const [username, setUsername] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const reset = () => {
    setStep("username");
    setUsername("");
    setVerifying(false);
    setDownloadUrl(null);
    setFileName(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleContinue = () => {
    const trimmed = username.trim();
    if (!/^[A-Za-z0-9_]{3,20}$/.test(trimmed)) {
      sonnerToast.error("Invalid Roblox username", {
        description: "3–20 letters, numbers, or underscores.",
      });
      return;
    }
    if (!product) return;
    setStep("purchase");
  };

  const handleVerify = async () => {
    if (!product) return;
    setVerifying(true);
    // Auto-poll up to 5 times with a short delay between attempts. Roblox can
    // take 5-20s to record the sale, so silently retrying spares the user from
    // mashing the button.
    const MAX_ATTEMPTS = 5;
    const DELAY_MS = 4000;
    try {
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const fnName = product.upgradeMode
          ? "verify-gamepass-upgrade"
          : "verify-gamepass-purchase";
        const { data, error } = await supabase.functions.invoke(fnName, {
          body: {
            productId: product.id,
            robloxUsername: username.trim(),
            ...(product.upgradeMode && product.parentPurchaseId
              ? { parentPurchaseId: product.parentPurchaseId }
              : {}),
          },
        });
        if (data?.success) {
          const result = data as { downloadUrl?: string | null; fileName?: string | null };
          setDownloadUrl(result.downloadUrl ?? null);
          setFileName(result.fileName ?? null);
          setStep("success");
          return;
        }
        const fallbackMessage = "Couldn't verify the purchase.";
        let message =
          (data as { error?: string } | undefined)?.error ||
          error?.message ||
          fallbackMessage;

        if (message === "Edge Function returned a non-2xx status code" && error && typeof error === "object" && "context" in error) {
          try {
            const response = (error as { context?: Response }).context;
            const payload = response ? await response.json().catch(() => null) : null;
            message = payload?.error || message;
          } catch {
            // keep fallback message
          }
        }

        const notFoundYet = /couldn't find your purchase yet|find your purchase/i.test(message);
        if (!notFoundYet || attempt === MAX_ATTEMPTS - 1) {
          sonnerToast.error(notFoundYet ? "Still processing" : "Not verified yet", {
            description: notFoundYet
              ? "Roblox hasn't recorded the sale yet. Wait a moment and try again."
              : message,
          });
          return;
        }
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong.";
      sonnerToast.error("Verification failed", { description: message });
    } finally {
      setVerifying(false);
    }
  };

  if (!product) return null;

  const gamepassUrl = normalizeGamepassUrl(product.gamepassUrl);

  const handleCopyGamepass = async () => {
    try {
      await navigator.clipboard.writeText(gamepassUrl);
      sonnerToast.success("Gamepass link copied", {
        description: "Paste it into a new browser tab to open Roblox.",
      });
    } catch {
      sonnerToast.error("Couldn't copy the link", {
        description: "Select the URL and copy it manually.",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[min(calc(100vw-2rem),56rem)] max-w-[56rem] overflow-x-hidden max-h-[90vh] overflow-y-auto p-0">
        {step === "username" && (
          <>
            <DialogHeader className="px-6 pt-6">
              <DialogTitle>Buy with Robux</DialogTitle>
              <DialogDescription>
                {product.name} — <span className="font-semibold">R$ {product.priceRobux.toLocaleString()}</span>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 px-6 py-4">
              <Label htmlFor="roblox-username">Your Roblox username</Label>
              <Input
                id="roblox-username"
                placeholder="e.g. Builderman"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                We'll match your purchase against this account before confirming it.
              </p>
            </div>
            <DialogFooter className="px-6 pb-6">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button variant="hero" onClick={handleContinue}>
                Continue
                <ExternalLink className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "purchase" && (
          <>
            <DialogHeader className="px-6 pt-6">
              <DialogTitle>Complete your purchase on Roblox</DialogTitle>
              <DialogDescription>
                The preview can block Roblox links. Open the gamepass manually, buy it as{" "}
                <span className="font-semibold">{username}</span>, then come back here.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 px-6 py-4">
              <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm space-y-3">
                <p>
                  <span className="font-semibold">1.</span> Copy or open the gamepass link below.
                </p>
                <p>
                  <span className="font-semibold">2.</span> Buy the gamepass on Roblox.
                </p>
                <p>
                  <span className="font-semibold">3.</span> Wait a few seconds for Roblox to record the purchase.
                </p>
                <p>
                  <span className="font-semibold">4.</span> Click "I've purchased" — we'll
                  check Roblox and confirm ownership.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="gamepass-url">Gamepass link</Label>
                <div
                  id="gamepass-url"
                  className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs leading-relaxed break-all text-foreground"
                >
                  {gamepassUrl}
                </div>
              </div>
            </div>
            <DialogFooter className="grid grid-cols-1 gap-2 px-6 pb-6 sm:grid-cols-3">
              <Button variant="outline" onClick={handleCopyGamepass} className="w-full">
                <Copy className="h-4 w-4" />
                Copy link
              </Button>
              <Button
                variant="outline"
                asChild
                className="w-full"
              >
                <a
                  href={gamepassUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open anyway
                </a>
              </Button>
              <Button variant="hero" onClick={handleVerify} disabled={verifying} className="w-full">
                {verifying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking…
                  </>
                ) : (
                  "I've purchased"
                )}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "success" && (
          <>
            <DialogHeader className="px-6 pt-6">
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Purchase verified!
              </DialogTitle>
              <DialogDescription>
                Thanks, {username}! We've matched your gamepass purchase of{" "}
                <span className="font-semibold">{product.name}</span>.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 px-6 py-4">
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
                Your purchase has been confirmed.
              </div>
              {downloadUrl ? (
                <a
                  href={downloadUrl}
                  download={fileName ?? undefined}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 text-sm hover:bg-accent transition-smooth"
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <Download className="h-5 w-5 text-primary shrink-0" />
                    <span className="truncate font-medium">
                      {fileName ?? "Download your file"}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">Click to download</span>
                </a>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No file is attached to this product. If you expected one, contact support.
                </p>
              )}
            </div>
            <DialogFooter className="px-6 pb-6">
              <Button variant="hero" className="w-full" onClick={() => handleOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
