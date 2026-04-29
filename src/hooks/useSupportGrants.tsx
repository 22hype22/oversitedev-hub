import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type SupportGrant = {
  id: string;
  owner_user_id: string;
  expires_at: string;
  granted_at: string;
};

const STORAGE_KEY = "active-support-grant-ids";

/** Tracks active support grants the current admin holds. */
export function useSupportGrants() {
  const { user, isAdmin } = useAuth();
  const [grants, setGrants] = useState<SupportGrant[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user || !isAdmin) {
      setGrants([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await (supabase as any)
      .from("support_access_grants")
      .select("id, owner_user_id, expires_at, granted_at")
      .eq("admin_user_id", user.id)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("granted_at", { ascending: false });
    setGrants((data ?? []) as SupportGrant[]);
    setLoading(false);
  }, [user, isAdmin]);

  useEffect(() => {
    reload();
    const id = setInterval(reload, 60_000); // re-check expiry every minute
    return () => clearInterval(id);
  }, [reload]);

  return { grants, loading, reload };
}

/** Remembers the most recent grant the admin redeemed (for banner copy). */
export function rememberRedeemedGrant(grantId: string, ownerId: string) {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const list: { grantId: string; ownerId: string }[] = raw ? JSON.parse(raw) : [];
    if (!list.find((x) => x.grantId === grantId)) {
      list.unshift({ grantId, ownerId });
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 10)));
    }
  } catch {
    /* ignore */
  }
}
