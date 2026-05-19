import { AlertTriangle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHostingSubscription } from "@/hooks/useHostingSubscription";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

const SUPPORT_DISCORD_URL = "https://discord.gg/B23N33DfUU";

export function HostingPastDueBanner() {
  const { isPastDue, graceDaysRemaining, graceEndsAt } = useHostingSubscription();
  const [opening, setOpening] = useState(false);

  if (!isPastDue) return null;

  const days = graceDaysRemaining ?? 0;
  const dateLabel = graceEndsAt
    ? graceEndsAt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : null;

  const openPortal = async () => {
    setOpening(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal", {
        body: { returnUrl: window.location.href },
      });
      if (error || !data?.url) throw new Error(error?.message ?? "Could not open billing portal");
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to open billing portal");
    } finally {
      setOpening(false);
    }
  };

  return (
    <div
      role="alert"
      className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive-foreground"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden />
        <div className="flex-1 space-y-2 text-sm">
          <p className="font-semibold text-destructive">
            Payment overdue — action required
          </p>
          <p className="text-foreground/90">
            We weren't able to process this month's hosting charge for your bot
            {days === 1 ? "" : "s"}. You have{" "}
            <span className="font-semibold">
              {days} day{days === 1 ? "" : "s"}
            </span>{" "}
            {dateLabel ? `(until ${dateLabel}) ` : ""}to update your payment method before
            your bot{days === 1 ? " is" : "s are"} automatically cancelled and removed from
            your servers.
          </p>
          <p className="text-foreground/80">
            If you believe this is a mistake, please open a ticket in our{" "}
            <a
              href={SUPPORT_DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Discord support server
            </a>
            .
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              variant="destructive"
              size="sm"
              onClick={openPortal}
              disabled={opening}
            >
              {opening ? "Opening..." : "Update payment method"}
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={SUPPORT_DISCORD_URL} target="_blank" rel="noopener noreferrer">
                Open a support ticket
                <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
