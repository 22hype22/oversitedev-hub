import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { useAuth } from "@/hooks/useAuth";

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
 * `loading = true` until we know either way.
 */
export function useMembership() {
  const { user } = useAuth();
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setIsMember(false);
      setLoading(false);
      return;
    }
    setLoading(true);
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
        setIsMember(isActive((data as Membership) ?? null));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { isMember, loading };
}
