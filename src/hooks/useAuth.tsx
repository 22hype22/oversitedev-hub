import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// useAuth is a per-component hook (no shared context), so many components run
// it at once. Realtime channels must have unique topics AND .on() must be
// called before .subscribe(); creating one channel per hook instance with the
// same name makes the duplicates throw "cannot add callbacks after subscribe".
// So we keep ONE shared channel per user_id and fan out to every instance's
// re-check callback.
const roleListeners = new Set<() => void>();
let roleChannel: ReturnType<typeof supabase.channel> | null = null;
let roleChannelUid: string | null = null;

function ensureRoleChannel(uid: string) {
  if (roleChannelUid === uid && roleChannel) return;
  if (roleChannel) {
    supabase.removeChannel(roleChannel);
    roleChannel = null;
  }
  roleChannelUid = uid;
  roleChannel = supabase
    .channel(`user-roles-${uid}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "user_roles", filter: `user_id=eq.${uid}` },
      () => roleListeners.forEach((fn) => fn()),
    )
    .subscribe();
}

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
          // Auto-accept any pending team invites for this user's email
          setTimeout(() => {
            (supabase as any).rpc("team_accept_invites_for_current_user").then(() => {});
          }, 0);
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
        lastCheckedUserId = session.user.id;
        checkAdmin(session.user.id);
        (supabase as any).rpc("team_accept_invites_for_current_user").then(() => {});
      } else {
        setRoleLoading(false);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Live admin-role changes: if a super admin grants or revokes this user's
  // admin access while they're using the app, flip isAdmin right away (no
  // manual refresh). Shares one channel across all hook instances.
  useEffect(() => {
    const uid = user?.id;
    if (!uid) return;
    const recheck = async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!data);
    };
    roleListeners.add(recheck);
    ensureRoleChannel(uid);
    return () => {
      roleListeners.delete(recheck);
      if (roleListeners.size === 0 && roleChannel) {
        supabase.removeChannel(roleChannel);
        roleChannel = null;
        roleChannelUid = null;
      }
    };
  }, [user?.id]);

  return { session, user, isAdmin, loading: loading || (!!user && roleLoading) };
};
