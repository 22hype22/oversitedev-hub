import { Link } from "react-router-dom";
import { ArrowUpCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

type UpgradeNoticeProps = {
  /** Show a more compact version (used inside product cards). */
  compact?: boolean;
  className?: string;
};

/**
 * Promotes a membership for free version upgrades, while making it clear
 * users can also pay USD per-upgrade if they prefer. Shown to non-members
 * after a purchase (and on product cards / dashboard rows).
 */
export function UpgradeNotice({ compact = false, className = "" }: UpgradeNoticeProps) {
  if (compact) {
    return (
      <div
        className={`flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs ${className}`}
      >
        <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
        <p className="text-muted-foreground leading-snug">
          New versions roll out for free with a{" "}
          <Link to="/products#memberships" className="text-primary font-medium hover:underline">
            membership
          </Link>
          , or upgrade for a small fee anytime.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border border-primary/30 bg-primary/5 p-4 text-left ${className}`}
    >
      <div className="flex items-start gap-3">
        <ArrowUpCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-sm font-medium">System upgrades, when they drop.</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            We ship new versions of every system over time. Stay on the latest
            release automatically with a membership — or upgrade individual
            products for a small one-time fee in USD whenever a new version is
            available.
          </p>
          <Button asChild size="sm" variant="hero" className="mt-3">
            <Link to="/products#memberships">View memberships</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
