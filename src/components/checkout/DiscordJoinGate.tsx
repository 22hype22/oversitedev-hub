import { useState } from "react";
import { Loader2, ExternalLink, MessageSquare, CheckCircle2, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DISCORD_INVITE = "https://discord.gg/oversite";

type Phase =
  | { kind: "join" }
  | { kind: "in_stock" }
  | { kind: "low_stock"; expectedUsername: string; botsNeeded: number }
  | { kind: "confirmed"; status: "ready" | "waitlist" };

/**
 * Post-payment gate shown on /checkout/return for bot orders.
 *
 *  1. Asks the customer to join the Discord server (mandatory).
 *  2. On "I've joined", calls confirm-order-discord-join which decides
 *     server-side whether the order takes the in-stock path (status -> ready,
 *     auto-deploy fires) or the low-stock path (status -> confirmation +
 *     single DM asking for username confirmation).
 *  3. In the low-stock path, surfaces a quick inline confirm-username form
 *     as a fallback to the DM reply flow.
 */
export const DiscordJoinGate = ({ orderId }: { orderId: string }) => {
  const [phase, setPhase] = useState<Phase>({ kind: "join" });
  const [busy, setBusy] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");

  const onJoinConfirmed = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "confirm-order-discord-join",
        { body: { orderId } },
      );
      if (error || !data?.ok) {
        toast.error(error?.message || data?.error || "Couldn't confirm — please try again.");
        return;
      }
      if (data.path === "in_stock" || data.alreadyHandled) {
        setPhase({ kind: "in_stock" });
      } else {
        setPhase({
          kind: "low_stock",
          expectedUsername: data.expectedUsername ?? "",
          botsNeeded: data.botsNeeded ?? 1,
        });
        setUsernameInput(data.expectedUsername ?? "");
      }
    } finally {
      setBusy(false);
    }
  };

  const onConfirmUsername = async () => {
    if (!usernameInput.trim()) {
      toast.error("Type your Discord username to confirm.");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "confirm-order-username",
        { body: { orderId, username: usernameInput.trim() } },
      );
      if (error) {
        toast.error(error.message);
        return;
      }
      if (!data?.ok) {
        toast.error(data?.message || "That didn't match — try again.");
        return;
      }
      setPhase({ kind: "confirmed", status: data.status });
    } finally {
      setBusy(false);
    }
  };

  if (phase.kind === "join") {
    return (
      <div className="mb-6 rounded-lg border border-primary/30 bg-primary/5 p-5 text-left">
        <div className="flex items-start gap-3">
          <MessageSquare className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold">One more step — join our Discord</p>
            <p className="text-xs text-muted-foreground mt-1">
              Join the Oversite Discord server so we can DM you build progress, deployment
              notifications, and (if needed) confirm your order details.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outlineGlow">
                <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer">
                  Open Discord <ExternalLink className="h-3.5 w-3.5 ml-1" />
                </a>
              </Button>
              <Button
                size="sm"
                variant="hero"
                onClick={onJoinConfirmed}
                disabled={busy}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "I've joined"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase.kind === "in_stock") {
    return (
      <div className="mb-6 rounded-lg border border-primary/30 bg-primary/5 p-5 text-left">
        <div className="flex items-start gap-3">
          <Bot className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">Your bot is being built!</p>
            <p className="text-xs text-muted-foreground mt-1">
              A bot slot has been reserved and your build has been queued. You'll get a
              Discord DM the moment it's live. This usually takes less than a minute.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (phase.kind === "low_stock") {
    return (
      <div className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/5 p-5 text-left">
        <div className="flex items-start gap-3">
          <MessageSquare className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Confirm your preorder</p>
            <p className="text-xs text-muted-foreground mt-1">
              We're at capacity right now. We just sent you a Discord DM asking you to
              confirm your username so we can lock in your spot
              {phase.botsNeeded > 1 ? ` for all ${phase.botsNeeded} bots` : ""}. Reply
              there, or type it below to confirm now.
            </p>
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              <Input
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder={phase.expectedUsername || "Your Discord username"}
                disabled={busy}
              />
              <Button onClick={onConfirmUsername} disabled={busy} variant="hero">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // confirmed
  return (
    <div className="mb-6 rounded-lg border border-primary/30 bg-primary/5 p-5 text-left">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold">
            {phase.status === "ready" ? "You're confirmed — deploying now!" : "You're confirmed — added to the queue"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {phase.status === "ready"
              ? "A bot slot was just reserved for you. You'll get a Discord DM when it's live."
              : "All slots are currently allocated. You'll get a Discord DM the moment one frees up and your bot is deployed."}
          </p>
        </div>
      </div>
    </div>
  );
};
