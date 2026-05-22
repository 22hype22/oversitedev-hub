import { AlertTriangle } from "lucide-react";
import { useBotStockCount } from "@/hooks/useBotStockCount";

const THRESHOLD = 20;

/**
 * Shows a low-stock badge ("Limited availability — X bots remaining…") when
 * the number of available bot tokens drops below THRESHOLD. Hidden otherwise.
 *
 * Note: the token pool is a single global pool — Protection, Support,
 * Utilities and packs all draw from the same supply, so the indicator
 * reflects total remaining stock across the suite.
 */
export const BotStockIndicator = ({ className = "" }: { className?: string }) => {
  const count = useBotStockCount();

  if (count === null || count >= THRESHOLD || count < 0) return null;

  return (
    <div className={`flex justify-center ${className}`}>
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-[11px] font-medium text-amber-500"
        role="status"
        aria-live="polite"
      >
        <AlertTriangle className="h-3 w-3 shrink-0" />
        {count === 0
          ? "Out of stock — we're actively restocking."
          : <><strong className="font-semibold">Limited availability</strong>{` — ${count} ${count === 1 ? "bot" : "bots"} remaining. We're actively restocking.`}</>}
      </span>
    </div>
  );
};
