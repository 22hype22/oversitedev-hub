import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type HostingSubscription = {
  status: string;
  past_due_since: string | null;
  grace_period_ends_at: string | null;
};

export type HostingState = {
  loading: boolean;
  subscription: HostingSubscription | null;
  isPastDue: boolean;
  graceDaysRemaining: number | null;
  graceEndsAt: Date | null;
};

export function useHostingSubscription(): HostingState {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<HostingSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setSubscription(null);
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await (supabase as any)
        .from("hosting_subscriptions")
        .select("status,past_due_since,grace_period_ends_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setSubscription((data as HostingSubscription) ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const isPastDue = subscription?.status === "past_due";
  const graceEndsAt = subscription?.grace_period_ends_at
    ? new Date(subscription.grace_period_ends_at)
    : null;
  const graceDaysRemaining = graceEndsAt
    ? Math.max(0, Math.ceil((graceEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return { loading, subscription, isPastDue, graceDaysRemaining, graceEndsAt };
}
