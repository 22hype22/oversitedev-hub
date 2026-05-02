import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export const useAuth = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const checkAdmin = async (userId: string) => {
      setRoleLoading(true);
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (!mounted) return;
      if (error) {
        // Don't lock the user out on transient errors — try again next auth event
        console.warn("admin role check failed", error.message);
      }
      setIsAdmin(!!data);
      setRoleLoading(false);
    };

    let lastCheckedUserId: string | null = null;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      const newUserId = sess?.user?.id ?? null;
      if (newUserId) {
        // Only re-check admin role when the user actually changes.
        // Without this guard, TOKEN_REFRESHED events (fired when the tab
        // regains focus) flip loading back to true and unmount the page.
        if (newUserId !== lastCheckedUserId) {
          lastCheckedUserId = newUserId;
          setTimeout(() => checkAdmin(newUserId), 0);
        }
      } else {
        lastCheckedUserId = null;
        setIsAdmin(false);
        setRoleLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        checkAdmin(session.user.id);
      } else {
        setRoleLoading(false);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, user, isAdmin, loading: loading || (!!user && roleLoading) };
};
