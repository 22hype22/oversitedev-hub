import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type OwnedProduct = {
  productId: string;
  purchaseId: string;
  version: string | null;
};

/**
 * Loads the signed-in user's paid purchases and exposes a map keyed by
 * `product_id` -> latest owned record (most recent paid purchase wins).
 * Returns empty data for signed-out users.
 */
export function useUserPurchases() {
  const { user } = useAuth();
  const [owned, setOwned] = useState<Map<string, OwnedProduct>>(new Map());
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) {
      setOwned(new Map());
      setLoading(false);
      return;
    }
    setLoading(true);
    const filters = [`user_id.eq.${user.id}`];
    if (user.email) filters.push(`email.eq.${user.email.toLowerCase()}`);
    const { data } = await supabase
      .from("purchases")
      .select("id,product_id,version,created_at")
      .or(filters.join(","))
      .eq("status", "paid")
      .order("created_at", { ascending: false });
    const map = new Map<string, OwnedProduct>();
    for (const row of (data ?? []) as any[]) {
      if (!row.product_id) continue;
      // First (most recent) wins because results are ordered desc.
      if (!map.has(row.product_id)) {
        map.set(row.product_id, {
          productId: row.product_id,
          purchaseId: row.id,
          version: row.version ?? null,
        });
      }
    }
    setOwned(map);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { owned, loading, reload };
}
