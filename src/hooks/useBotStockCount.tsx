import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const POLL_MS = 60_000;

/**
 * Shared poller for the global available-bot-token count.
 * Backed by the `get_available_bot_token_count` RPC.
 *
 * Returns `null` while loading (so callers can hold off rendering
 * stock-dependent UI until they have a real number).
 */
export const useBotStockCount = () => {
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

  return count;
};
