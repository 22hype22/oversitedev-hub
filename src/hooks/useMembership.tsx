import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { useAuth } from "@/hooks/useAuth";
import { getCached, peekCached, setCached } from "@/lib/swrCache";

type Membership = {
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
} | null;

const isActive = (m: Membership) => {
  if (!m) return false;
  const periodEnd = m.current_period_end ? new Date(m.current_period_end).getTime() : null;
  const future = !periodEnd || periodEnd > Date.now();
  return (
    (["active", "trialing", "past_due"].includes(m.status) && future) ||
    (m.status === "canceled" && !!periodEnd && periodEnd > Date.now())
  );
};

/**
 * Lightweight membership check. Returns `isMember = false` for signed-out users.
 * `loading = true` until we know either way. Uses an in-memory SWR cache so
 * page navigations don't trigger refetches within 30s.
 */
export function useMembership() {
  const { user } = useAuth();
  const cacheKey = user ? `membership:${user.id}:${getStripeEnvironment()}` : null;
  const seed = cacheKey ? peekCached<boolean>(cacheKey) : undefined;
  const [isMember, setIsMember] = useState<boolean>(seed ?? false);
  const [loading, setLoading] = useState<boolean>(seed === undefined);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setIsMember(false);
      setLoading(false);
      return;
    }
    // SWR: skip refetch if cache is fresh (<30s).
    if (cacheKey && getCached<boolean>(cacheKey) !== undefined) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("status,current_period_end,cancel_at_period_end")
        .eq("user_id", user.id)
        .eq("environment", getStripeEnvironment())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) {
        const active = isActive((data as Membership) ?? null);
        setIsMember(active);
        if (cacheKey) setCached(cacheKey, active);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, cacheKey]);

  return { isMember, loading };
}
