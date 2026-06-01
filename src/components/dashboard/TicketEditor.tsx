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
import {
  TicketPanelBuilder,
  type TicketPanelBuilderHandle,
} from "./TicketPanelBuilder";

export type TicketEditorHandle = {
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

    // Fetch fresh Discord channel list for cleanup cross-reference. Returns
    // a Set of currently-existing channel_ids, or null if the lookup failed
    // (in which case we skip cleanup rather than mass-delete by mistake).
    const fetchLiveChannelIds = useCallback(async (): Promise<Set<string> | null> => {
      if (!botId || !guildId) return null;
      try {
        const { data, error } = await supabase.functions.invoke("bot-list-channels", {
          body: { bot_id: botId, guild_id: guildId },
        });
        if (error || !data?.ok) {
          console.warn("[TicketEditor] bot-list-channels failed, skipping cleanup", error ?? data);
          return null;
        }
        const { data: rows } = await supabase
          .from("bot_channel_cache")
          .select("channel_id")
          .eq("bot_id", botId)
          .eq("guild_id", guildId);
        return new Set((rows ?? []).map((r) => String(r.channel_id)));
      } catch (e) {
        console.warn("[TicketEditor] bot-list-channels threw", e);
        return null;
      }
    }, [botId, guildId]);

    const fetchPanels = useCallback(async () => {
      if (!botId) return;
      setLoading(true);
      const { data, error } = await supabase
        .from("bot_config")
        .select("config")
        .eq("bot_id", botId)
        .eq("feature", "ticket-panels")
        .maybeSingle();
      if (error) {
        setLoading(false);
        toast.error(`Could not load ticket panels: ${error.message}`);
        return;
      }
      const cfg = (data?.config ?? {}) as Record<string, any>;
      const postedPanels = cfg.posted_panels ?? {};
      let raw: any[] = [];
      if (Array.isArray(postedPanels)) {
        raw = postedPanels;
      } else if (guildId && Array.isArray(postedPanels[guildId])) {
        raw = postedPanels[guildId];
      }
      let cleaned: PostedPanel[] = raw
        .filter((p: any) => p && p.channel_id && p.message_id)
        .map((p: any) => ({
          channel_id: String(p.channel_id),
          message_id: String(p.message_id),
          channel_name: p.channel_name ? String(p.channel_name) : undefined,
          posted_at: p.posted_at ? String(p.posted_at) : undefined,
        }));

      // Auto-cleanup: cross-reference against fresh Discord channel list.
      const live = await fetchLiveChannelIds();
      if (live && guildId) {
        const stale = cleaned.filter((p) => !live.has(p.channel_id));
        if (stale.length > 0) {
          console.log(
            `[TicketEditor] Pruning ${stale.length} panel(s) for deleted channels:`,
            stale.map((p) => `${p.channel_id} (msg ${p.message_id})`),
          );
          await Promise.all(
            stale.map((p) =>
              supabase.functions
                .invoke("save-ticket-panel", {
                  body: {
                    bot_id: botId,
                    guild_id: guildId,
                    channel_id: p.channel_id,
                    message_id: p.message_id,
                    delete: true,
                  },
                })
                .then(({ error: e }) => {
                  if (e) console.warn("[TicketEditor] prune failed", p, e);
                  else console.log("[TicketEditor] pruned panel", p);
                }),
            ),
          );
          cleaned = cleaned.filter((p) => live.has(p.channel_id));
        }
      }

      setPanels(cleaned);
      setLoading(false);
    }, [botId, guildId, fetchLiveChannelIds]);

    // Map channel_id -> channel_name from the cache (refreshed by cleanup).
    const [channelNames, setChannelNames] = useState<Map<string, string>>(new Map());
    useEffect(() => {
      if (!botId || !guildId) return;
      let cancelled = false;
      void supabase
        .from("bot_channel_cache")
        .select("channel_id, channel_name")
        .eq("bot_id", botId)
        .eq("guild_id", guildId)
        .then(({ data }) => {
          if (cancelled || !data) return;
          const m = new Map<string, string>();
          for (const c of data) m.set(String(c.channel_id), String(c.channel_name));
          setChannelNames(m);
        });
      return () => {
        cancelled = true;
      };
    }, [botId, guildId, panels]);

    useEffect(() => {
      void fetchPanels();
    }, [fetchPanels]);

    useImperativeHandle(ref, () => ({
      save: async () => true,
      clear: () => {},
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
            onClick={() => void fetchPanels()}
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
        ) : panels.length === 0 ? (
          <div className="rounded-md border border-border bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
            {loading
              ? "Loading panels…"
              : "No ticket panels posted yet. Post one from the Post Ticket card and it'll appear here."}
          </div>
        ) : (
          <div className="space-y-2">
            {panels.map((p) => {
              const name = channelNames.get(p.channel_id) ?? p.channel_name ?? p.channel_id;
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
                  <div className="flex items-center gap-2 shrink-0">
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
                </div>
              );
            })}
          </div>
        )}

        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Edit ticket panel
                {editing
                  ? ` · #${
                      channelNames.get(editing.channel_id) ??
                      editing.channel_name ??
                      editing.channel_id
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
              <Button variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button
                disabled={savingEdit}
                onClick={async () => {
                  if (!editing || !botId || !guildId) return;
                  setSavingEdit(true);
                  try {
                    // 1) Build the config payload from the inner builder
                    //    (validates the form, no DB writes).
                    const payload = innerBuilderRef.current?.buildPayload();
                    console.log("[TicketEditor] Edit dialog Save clicked", {
                      editing,
                      hasBuilder: !!innerBuilderRef.current,
                      payload,
                    });
                    if (!payload) {
                      setSavingEdit(false);
                      return;
                    }

                    // 2) Persist the updated ticket panel config to bot_config.
                    const { error: cfgErr } = await supabase
                      .from("bot_config")
                      .upsert(payload, { onConflict: "bot_id,feature" });
                    if (cfgErr) {
                      toast.error(`Save failed: ${cfgErr.message}`);
                      return;
                    }

                    // 3) Separately enqueue an edit_ticket_panel bot command.
                    const { data: orderRow } = await supabase
                      .from("bot_orders")
                      .select("user_id")
                      .eq("id", botId)
                      .maybeSingle();
                    const ownerId = orderRow?.user_id;
                    const { data: authData } = await supabase.auth.getUser();
                    const requesterId = authData.user?.id;
                    if (!ownerId || !requesterId) {
                      toast.warning(
                        "Saved, but could not enqueue panel edit (auth context missing).",
                      );
                    } else {
                      const commandPayload = {
                        bot_id: botId,
                        user_id: ownerId,
                        requested_by: requesterId,
                        action: "edit_ticket_panel",
                        payload: {
                          channel_id: editing.channel_id,
                          message_id: editing.message_id,
                          config: payload.config,
                        },
                      };
                      console.log(
                        "[TicketEditor] Enqueuing bot_commands edit_ticket_panel:",
                        commandPayload,
                      );
                      const { error: cmdErr } = await supabase
                        .from("bot_commands")
                        .insert(commandPayload);
                      if (cmdErr) {
                        toast.warning(
                          `Saved, but failed to queue panel edit: ${cmdErr.message}`,
                        );
                      } else {
                        toast.success(
                          "Panel update queued — the bot will edit the message shortly.",
                        );
                      }
                    }

                    // 4) Refresh posted_panels entry (touch posted_at / channel_name).
                    const liveName = channelNames.get(editing.channel_id);
                    const { error: spErr } = await supabase.functions.invoke(
                      "save-ticket-panel",
                      {
                        body: {
                          bot_id: botId,
                          guild_id: guildId,
                          channel_id: editing.channel_id,
                          message_id: editing.message_id,
                          channel_name: liveName ?? editing.channel_name ?? null,
                        },
                      },
                    );
                    if (spErr) {
                      console.warn("[TicketEditor] save-ticket-panel refresh failed", spErr);
                    }
                    setEditing(null);
                    await fetchPanels();
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
