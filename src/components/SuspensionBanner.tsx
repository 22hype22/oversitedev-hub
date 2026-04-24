import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { useMarketingSuspended } from "@/hooks/useMarketingSuspended";

// Re-export so existing imports keep working.
export { useMarketingSuspended } from "@/hooks/useMarketingSuspended";

export const SuspensionBanner = () => {
  const { suspended } = useMarketingSuspended();

  useEffect(() => {
    if (suspended) {
      document.body.classList.add("marketing-suspended");
    } else {
      document.body.classList.remove("marketing-suspended");
    }
    return () => document.body.classList.remove("marketing-suspended");
  }, [suspended]);

  if (!suspended) return null;
  return (
    <div className="fixed top-0 inset-x-0 z-[70] bg-destructive text-destructive-foreground border-b border-destructive-foreground/20 shadow-md">
      <div className="container mx-auto px-4 py-2.5 flex items-start gap-3 text-sm">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <p className="leading-snug">
          <span className="font-semibold">Service Notice:</span>{" "}
          Oversite Marketing services are temporarily suspended. Our team is
          actively reviewing operations, and updates will be shared as they become
          available. Thank you for your patience.
        </p>
      </div>
    </div>
  );
};
