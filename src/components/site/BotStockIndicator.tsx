import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const THRESHOLD = 20;
const POLL_MS = 60_000;

/**
 * Shows a low-stock badge ("Only X left") when the number of available bot
 * tokens drops below THRESHOLD. Hidden otherwise. Polled every 15s and on
 * mount so it reflects current availability without requiring realtime
 * publication setup.
 *
 * Note: the token pool is a single global pool — Protection, Support,
 * Utilities and packs all draw from the same supply, so the indicator
 * reflects total remaining stock across the suite.
 */
export const BotStockIndicator = ({ className = "" }: { className?: string }) => {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchCount = async () => {
      const { data, error } = await (supabase as any).rpc(
        "get_available_bot_token_count",
      );
      if (cancelled || error) return;
      setCount(typeof data === "number" ? data : Number(data ?? 0));
    };
    fetchCount();
    const t = setInterval(fetchCount, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  if (count === null || count >= THRESHOLD || count < 0) return null;

  return (
    <div className={`flex justify-center ${className}`}>
      <span
        className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-500"
        role="status"
        aria-live="polite"
      >
        <AlertTriangle className="h-3 w-3" />
        {count === 0 ? "Out of stock — waitlist" : `Only ${count} left`}
      </span>
    </div>
  );
};
