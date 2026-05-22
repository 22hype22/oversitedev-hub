import { useState } from "react";
import { Loader2, ExternalLink, MessageSquare, Clock, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DISCORD_INVITE = "https://discord.gg/oversite";

type Phase =
  | { kind: "join" }
  | { kind: "in_stock" }
  | { kind: "waitlist"; botsNeeded: number };

/**
 * Post-payment gate shown on /checkout/return for bot orders.
 *
 *  1. Asks the customer to join the Discord server (mandatory).
 *  2. On "I've joined", calls confirm-order-discord-join which decides
 *     server-side whether the order takes the in-stock path (status -> ready,
 *     auto-deploy fires) or the waitlist path (status -> waitlisted, customer
 *     gets a "still want to proceed?" DM the moment a slot opens up).
 */
export const DiscordJoinGate = ({ orderId }: { orderId: string }) => {
  const [phase, setPhase] = useState<Phase>({ kind: "join" });
  const [busy, setBusy] = useState(false);

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
        setPhase({ kind: "waitlist", botsNeeded: data.botsNeeded ?? 1 });
      }
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

  // waitlist
  return (
    <div className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/5 p-5 text-left">
      <div className="flex items-start gap-3">
        <Clock className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold">
            You're on the waitlist
            {phase.botsNeeded > 1 ? ` (${phase.botsNeeded} bots)` : ""}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            All bot slots are currently allocated. The moment one opens up,
            we'll DM you on Discord asking if you'd like us to deploy — just
            reply <strong>YES</strong> and your bot goes live.
          </p>
        </div>
      </div>
    </div>
  );
};
