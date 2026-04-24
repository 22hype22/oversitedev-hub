import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type OwnedProduct = {
  productId: string;
  /** purchaseId is set for Stripe purchases; gamepass purchases leave it undefined. */
  purchaseId?: string;
  version: string | null;
  /** Where this ownership came from (Stripe checkout vs Roblox gamepass). */
  source: "stripe" | "gamepass";
};

/**
 * Loads the signed-in user's ownership records and exposes a map keyed by
 * `product_id` -> latest owned record. Combines:
 * - Paid `purchases` rows (Stripe checkouts) matched by user_id/email
 * - Fulfilled `pending_purchases` rows (Roblox gamepass) matched by the
 *   user's profile.roblox_username
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

    // 1. Stripe purchases keyed by user_id / email.
    const filters = [`user_id.eq.${user.id}`];
    if (user.email) filters.push(`email.eq.${user.email.toLowerCase()}`);
    const stripeReq = supabase
      .from("purchases")
      .select("id,product_id,version,created_at")
      .or(filters.join(","))
      .eq("status", "paid")
      .order("created_at", { ascending: false });

    // 2. Profile -> roblox_username so we can also pick up gamepass purchases.
    const profileReq = supabase
      .from("profiles")
      .select("roblox_username")
      .eq("user_id", user.id)
      .maybeSingle();

    const [{ data: stripeRows }, { data: profile }] = await Promise.all([
      stripeReq,
      profileReq,
    ]);

    let gamepassRows: any[] = [];
    if (profile?.roblox_username) {
      const { data } = await supabase
        .from("pending_purchases")
        .select("product_id,version,fulfilled_at,created_at")
        .eq("status", "fulfilled")
        .ilike("roblox_username", profile.roblox_username)
        .order("fulfilled_at", { ascending: false });
      gamepassRows = data ?? [];
    }

    const map = new Map<string, OwnedProduct>();
    for (const row of (stripeRows ?? []) as any[]) {
      if (!row.product_id) continue;
      if (!map.has(row.product_id)) {
        map.set(row.product_id, {
          productId: row.product_id,
          purchaseId: row.id,
          version: row.version ?? null,
          source: "stripe",
        });
      }
    }
    for (const row of gamepassRows) {
      if (!row.product_id) continue;
      // Only fill in if Stripe didn't already establish ownership for this product.
      if (!map.has(row.product_id)) {
        map.set(row.product_id, {
          productId: row.product_id,
          version: row.version ?? null,
          source: "gamepass",
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
