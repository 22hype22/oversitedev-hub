import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, X, Edit3, Check, Hash } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useActiveGuild } from "@/hooks/useActiveGuild";
import { useBotChannels } from "@/hooks/useGuildChannels";

export type TicketEditorHandle = {
  save: () => Promise<boolean>;
  clear: () => void;
};

type OpenTicket = {
  id: string;
  channel_id: string;
  channel_name: string;
  category: string | null;
  opener_username: string | null;
  opener_user_id: string | null;
  status: string | null;
};

type Draft = {
  // id -> partial overrides
  [ticketId: string]: { category?: string; channel_name?: string };
};

type Props = {
  botId?: string;
};

export const TicketEditor = forwardRef<TicketEditorHandle, Props>(
  function TicketEditor({ botId }, ref) {
    const { guild } = useActiveGuild();
    const guildId = guild?.guild_id ?? null;

    const draftKey = botId && guildId
      ? `ticket-editor-draft:${botId}:${guildId}`
      : null;

    const [tickets, setTickets] = useState<OpenTicket[]>([]);
    const [loading, setLoading] = useState(false);
    const [deletedCount, setDeletedCount] = useState(0);
    const [editing, setEditing] = useState<string | null>(null);
    const [drafts, setDrafts] = useState<Draft>({});
    const hydratedRef = useRef(false);

    // Hydrate drafts once from localStorage.
    useEffect(() => {
      if (!draftKey) return;
      try {
        const raw = localStorage.getItem(draftKey);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          setDrafts(parsed as Draft);
          hydratedRef.current = true;
        }
      } catch {
        /* ignore */
      }
    }, [draftKey]);

    // Persist drafts on every change.
    useEffect(() => {
      if (!draftKey) return;
      try {
        if (Object.keys(drafts).length === 0) {
          localStorage.removeItem(draftKey);
        } else {
          localStorage.setItem(draftKey, JSON.stringify(drafts));
        }
      } catch {
        /* ignore */
      }
    }, [draftKey, drafts]);

    const fetchTickets = async () => {
      if (!botId || !guildId) return;
      setLoading(true);
      const { data, error } = await supabase
        .from("tickets")
        .select(
          "id, channel_id, channel_name, category, opener_username, opener_user_id, status",
        )
        .eq("bot_id", botId)
        .eq("guild_id", guildId)
        .neq("status", "closed")
        .order("created_at", { ascending: false });
      setLoading(false);
      if (error) {
        toast.error(`Could not load tickets: ${error.message}`);
        return;
      }
      setTickets((data ?? []) as OpenTicket[]);
    };

    useEffect(() => {
      void fetchTickets();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [botId, guildId]);

    // Auto-prune tickets whose Discord channel no longer exists.
    const { channels: allChannels } = useBotChannels(botId, guildId ?? undefined);
    const channelIdSet = useMemo(
      () => new Set(allChannels.map((c) => c.channel_id)),
      [allChannels],
    );
    useEffect(() => {
      if (tickets.length === 0 || allChannels.length === 0) return;
      const missing = tickets.filter((t) => !channelIdSet.has(t.channel_id));
      if (missing.length === 0) {
        setDeletedCount(0);
        return;
      }
      setDeletedCount(missing.length);
      setTickets((prev) => prev.filter((t) => channelIdSet.has(t.channel_id)));
      void supabase
        .from("tickets")
        .update({ status: "closed", closed_at: new Date().toISOString() })
        .in("id", missing.map((m) => m.id));
    }, [tickets, channelIdSet, allChannels.length]);

    const closeTicket = async (t: OpenTicket) => {
      const { error } = await supabase
        .from("tickets")
        .update({ status: "closed", closed_at: new Date().toISOString() })
        .eq("id", t.id);
      if (error) {
        toast.error(`Failed to close: ${error.message}`);
        return;
      }
      setTickets((prev) => prev.filter((x) => x.id !== t.id));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[t.id];
        return next;
      });
      toast.success(
        `Ticket #${t.channel_name} marked closed. The bot will delete the channel shortly.`,
      );
    };

    const updateDraft = (id: string, patch: Partial<Draft[string]>) =>
      setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

    useImperativeHandle(ref, () => ({
      save: async () => {
        if (!botId) {
          toast.error("Bot is not ready yet");
          return false;
        }
        const entries = Object.entries(drafts);
        if (entries.length === 0) {
          toast.info("No ticket edits to save");
          return true;
        }
        for (const [id, patch] of entries) {
          if (!patch || (patch.category == null && patch.channel_name == null)) {
            continue;
          }
          const update: { category?: string; channel_name?: string } = {};
          if (patch.category != null) update.category = patch.category;
          if (patch.channel_name != null) update.channel_name = patch.channel_name;
          const { error } = await supabase
            .from("tickets")
            .update(update)
            .eq("id", id);
          if (error) {
            toast.error(`Failed to save ticket: ${error.message}`);
            return false;
          }
        }
        setDrafts({});
        if (draftKey) {
          try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
        }
        toast.success("Ticket edits saved");
        await fetchTickets();
        return true;
      },
      clear: () => {
        setDrafts({});
        setEditing(null);
        if (draftKey) {
          try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
        }
        toast.info("Edits cleared");
      },
    }));

    const getCurrent = (t: OpenTicket) => ({
      category: drafts[t.id]?.category ?? t.category ?? "",
      channel_name: drafts[t.id]?.channel_name ?? t.channel_name,
    });

    return (
      <div className="space-y-4 py-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Currently open tickets for this bot. Tickets whose Discord
            channel no longer exists are removed automatically.
          </p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-xs gap-1.5"
            onClick={fetchTickets}
            disabled={loading || !guildId}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {deletedCount > 0 && (
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Removed {deletedCount} ticket{deletedCount === 1 ? "" : "s"} whose channel was deleted in Discord.
          </div>
        )}

        {!guildId ? (
          <div className="rounded-md border border-border bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
            Select a server to view its open tickets.
          </div>
        ) : tickets.length === 0 ? (
          <div className="rounded-md border border-border bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
            {loading ? "Loading tickets…" : "No open tickets right now."}
          </div>
        ) : (
          <div className="space-y-2">
            {tickets.map((t) => {
              const cur = getCurrent(t);
              const isEditing = editing === t.id;
              const isDirty = !!drafts[t.id];
              return (
                <div
                  key={t.id}
                  className="rounded-md border border-border bg-card/40 px-3 py-2.5 space-y-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-foreground truncate">
                        <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                        {cur.channel_name}
                        {isDirty && (
                          <span className="text-[10px] uppercase tracking-wide text-amber-500">
                            unsaved
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {cur.category || "Uncategorised"}
                        {t.opener_username ? ` · opened by ${t.opener_username}` : ""}
                        {t.status ? ` · ${t.status}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5"
                        onClick={() => setEditing(isEditing ? null : t.id)}
                      >
                        {isEditing ? <Check className="h-3.5 w-3.5" /> : <Edit3 className="h-3.5 w-3.5" />}
                        {isEditing ? "Done" : "Edit"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 gap-1.5 text-muted-foreground hover:text-destructive"
                        onClick={() => closeTicket(t)}
                      >
                        <X className="h-3.5 w-3.5" />
                        Close
                      </Button>
                    </div>
                  </div>

                  {isEditing && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <Input
                        value={cur.channel_name}
                        placeholder="channel name"
                        onChange={(e) => updateDraft(t.id, { channel_name: e.target.value })}
                      />
                      <Input
                        value={cur.category}
                        placeholder="category"
                        onChange={(e) => updateDraft(t.id, { category: e.target.value })}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  },
);
