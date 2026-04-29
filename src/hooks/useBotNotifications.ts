import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type BotNotification = {
  id: string;
  event_type: string;
  title: string;
  body: string;
  status: string;
  created_at: string;
  read_at: string | null;
};

const PAGE_SIZE = 25;

export function useBotNotifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<BotNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: rows }, { count }] = await Promise.all([
      supabase
        .from("bot_notifications")
        .select("id, event_type, title, body, status, created_at, read_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE),
      supabase
        .from("bot_notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("read_at", null),
    ]);
    setItems((rows as BotNotification[]) ?? []);
    setUnread(count ?? 0);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime: new notifications + read state changes
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`bot-notifs-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bot_notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refresh]);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    // Optimistic
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    setUnread(0);
    await supabase.rpc("mark_bot_notifications_read", { _ids: null as any });
  }, [user]);

  const markRead = useCallback(
    async (id: string) => {
      if (!user) return;
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n)),
      );
      setUnread((c) => Math.max(0, c - 1));
      await supabase.rpc("mark_bot_notifications_read", { _ids: [id] as any });
    },
    [user],
  );

  return { items, unread, loading, refresh, markAllRead, markRead };
}
