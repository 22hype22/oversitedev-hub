import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Edit3, Hash, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useActiveGuild } from "@/hooks/useActiveGuild";
import { useBotChannels } from "@/hooks/useGuildChannels";
import {
  TicketPanelBuilder,
  type TicketPanelBuilderHandle,
} from "./TicketPanelBuilder";

export type TicketEditorHandle = {
  /** No-op — editing is performed in the nested edit dialog. */
  save: () => Promise<boolean>;
  clear: () => void;
};

type PostedPanel = {
  channel_id: string;
  message_id: string;
  channel_name?: string;
  posted_at?: string;
};

type Props = {
  botId?: string;
  botName?: string;
  botAvatarUrl?: string | null;
  engineVersion?: "v1" | "v2";
};

export const TicketEditor = forwardRef<TicketEditorHandle, Props>(
  function TicketEditor(
    { botId, botName = "Bot", botAvatarUrl = null, engineVersion = "v1" },
    ref,
  ) {
    const { guild } = useActiveGuild();
    const guildId = guild?.guild_id ?? null;

    const [panels, setPanels] = useState<PostedPanel[]>([]);
    const [loading, setLoading] = useState(false);
    const [editing, setEditing] = useState<PostedPanel | null>(null);
    const innerBuilderRef = useRef<TicketPanelBuilderHandle>(null);
    const [savingEdit, setSavingEdit] = useState(false);

    const fetchPanels = useCallback(async () => {
      if (!botId) return;
      setLoading(true);
      const { data, error } = await supabase
        .from("bot_config")
        .select("config")
        .eq("bot_id", botId)
        .eq("feature", "ticket-panels")
        .maybeSingle();
      setLoading(false);
      if (error) {
        toast.error(`Could not load ticket panels: ${error.message}`);
        return;
      }
      const cfg = (data?.config ?? {}) as Record<string, any>;
      const postedPanels = cfg.posted_panels ?? {};
      // posted_panels is keyed by guild_id: { [guildId]: PostedPanel[] }.
      // Older configs may have stored a flat array — keep that as fallback.
      let raw: any[] = [];
      if (Array.isArray(postedPanels)) {
        raw = postedPanels;
      } else if (guildId && Array.isArray(postedPanels[guildId])) {
        raw = postedPanels[guildId];
      }
      console.log("[TicketEditor] posted_panels lookup", {
        botId,
        guildId,
        hasConfig: !!data,
        postedPanelsShape: Array.isArray(postedPanels) ? "array" : typeof postedPanels,
        keys: postedPanels && !Array.isArray(postedPanels) ? Object.keys(postedPanels) : undefined,
        matched: raw.length,
      });
      const cleaned: PostedPanel[] = raw
        .filter((p: any) => p && p.channel_id && p.message_id)
        .map((p: any) => ({
          channel_id: String(p.channel_id),
          message_id: String(p.message_id),
          channel_name: p.channel_name ? String(p.channel_name) : undefined,
          posted_at: p.posted_at ? String(p.posted_at) : undefined,
        }));
      setPanels(cleaned);
    }, [botId, guildId]);

    useEffect(() => {
      void fetchPanels();
    }, [fetchPanels]);

    // Resolve channel names from cache.
    const { channels: allChannels } = useBotChannels(botId, guildId ?? undefined);
    const channelById = useMemo(() => {
      const m = new Map<string, string>();
      for (const c of allChannels) m.set(c.channel_id, c.channel_name);
      return m;
    }, [allChannels]);

    // posted_panels is keyed by guild_id, so panels in state already match the
    // active guild — no extra filtering needed.
    const matchesActiveGuild = true;
    const visiblePanels = panels;

    useImperativeHandle(ref, () => ({
      save: async () => true,
      clear: () => {
        /* nothing to clear here — drafts live in the inner edit dialog */
      },
    }));

    return (
      <div className="space-y-4 py-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Ticket panels you've already posted in this server. Edit a panel to
            change its title, description, color, or buttons — the bot will
            update the existing Discord message in-place.
          </p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-xs gap-1.5"
            onClick={fetchPanels}
            disabled={loading || !botId}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {!guildId ? (
          <div className="rounded-md border border-border bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
            Select a server to view its posted ticket panels.
          </div>
        ) : !matchesActiveGuild ? (
          <div className="rounded-md border border-border bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
            No ticket panels have been posted in this server. Switch to the
            server where you posted the panel, or post a new one from the
            <span className="font-medium text-foreground"> Post Ticket </span>
            card.
          </div>
        ) : visiblePanels.length === 0 ? (
          <div className="rounded-md border border-border bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
            {loading
              ? "Loading panels…"
              : "No ticket panels posted yet. Post one from the Post Ticket card and it'll appear here."}
          </div>
        ) : (
          <div className="space-y-2">
            {visiblePanels.map((p) => {
              const name = p.channel_name ?? channelById.get(p.channel_id) ?? p.channel_id;
              return (
                <div
                  key={`${p.channel_id}:${p.message_id}`}
                  className="rounded-md border border-border bg-card/40 px-3 py-2.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-foreground truncate">
                      <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                      {name}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      Message {p.message_id}
                      {p.posted_at
                        ? ` · posted ${new Date(p.posted_at).toLocaleString()}`
                        : ""}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5"
                    onClick={() => setEditing(p)}
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Edit ticket panel
                {editing
                  ? ` · #${
                      editing.channel_name ?? channelById.get(editing.channel_id) ?? editing.channel_id
                    }`
                  : ""}
              </DialogTitle>
            </DialogHeader>
            {editing && (
              <TicketPanelBuilder
                ref={innerBuilderRef}
                botId={botId}
                botName={botName}
                botAvatarUrl={botAvatarUrl}
                variant="ticket"
                engineVersion={engineVersion}
                editTarget={{
                  channel_id: editing.channel_id,
                  message_id: editing.message_id,
                }}
              />
            )}
            <DialogFooter className="gap-2">
              <Button
                variant="ghost"
                onClick={() => innerBuilderRef.current?.clear()}
              >
                Clear
              </Button>
              <Button variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button
                disabled={savingEdit}
                onClick={async () => {
                  setSavingEdit(true);
                  try {
                    const ok = await innerBuilderRef.current?.save();
                    if (ok) {
                      setEditing(null);
                      await fetchPanels();
                    }
                  } finally {
                    setSavingEdit(false);
                  }
                }}
              >
                {savingEdit ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  },
);
