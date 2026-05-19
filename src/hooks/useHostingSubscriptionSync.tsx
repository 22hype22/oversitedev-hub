import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Fire-and-forget: asks the backend to reconcile the user's monthly bot-hosting
 * Stripe subscription with their current paid-bot count. Idempotent — the
 * edge function returns `unchanged` when nothing needs to happen. Runs once
 * per signed-in session per page mount.
 */
export function useHostingSubscriptionSync() {
  const { user } = useAuth();
  const ranForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    if (ranForRef.current === user.id) return;
    ranForRef.current = user.id;
    supabase.functions
      .invoke("sync-hosting-subscription", { body: {} })
      .catch((err) => console.warn("sync-hosting-subscription failed:", err));
  }, [user?.id]);
}
