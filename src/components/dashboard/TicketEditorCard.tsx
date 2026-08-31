import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowRight,
  ClipboardList,
  Edit3,
  Hash,
  RefreshCw,
  DownloadCloud,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useActiveGuild } from "@/hooks/useActiveGuild";
import {
  TicketPanelBuilder,
  type TicketPanelBuilderHandle,
} from "./TicketPanelBuilder";

type PostedPanel = {
  channel_id: string;
  message_id: string;
  channel_name?: string;
  posted_at?: string;
  panel_title?: string;
};

function extractPanelTitle(ticketPanelV2: unknown): string | undefined {
  if (!Array.isArray(ticketPanelV2)) return undefined;
  // Pass 1: first component with a non-empty `title` field
  const findTitle = (nodes: any[]): string | undefined => {
    for (const n of nodes) {
      if (!n || typeof n !== "object") continue;
      const t = typeof n.title === "string" ? n.title.trim() : "";
      if (t) return t;
      if (Array.isArray(n.children)) {
        const f = findTitle(n.children);
        if (f) return f;
      }
    }
    return undefined;
  };
  // Pass 2: first non-empty text content
  const findText = (nodes: any[]): string | undefined => {
    for (const n of nodes) {
      if (!n || typeof n !== "object") continue;
      const t = typeof n.text === "string" ? n.text.trim() : "";
      if (t) return t.split("\n")[0].slice(0, 80);
      if (Array.isArray(n.children)) {
        const f = findText(n.children);
        if (f) return f;
      }
    }
    return undefined;
  };
  return findTitle(ticketPanelV2 as any[]) ?? findText(ticketPanelV2 as any[]);
}

type Props = {
  botId?: string;
  botName?: string;
  botAvatarUrl?: string | null;
  engineVersion?: "v1" | "v2";
};

/**
 * Standalone Ticket Panel Edit card.
 *
 * Intentionally does NOT go through AddonConfigCard — it owns its own outer
 * Card shell, its own list Dialog, and its own edit Modal with a Save button
 * wired directly to its own save function.
 */
export function TicketEditorCard({
  botId,
  botName = "Bot",
  botAvatarUrl = null,
  engineVersion = "v1",
}: Props) {
  const { guild } = useActiveGuild();
  const guildId = guild?.guild_id ?? null;

  const [open, setOpen] = useState(false);
  const [panels, setPanels] = useState<PostedPanel[]>([]);
  const [loading, setLoading] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [editing, setEditing] = useState<PostedPanel | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const innerBuilderRef = useRef<TicketPanelBuilderHandle>(null);
  const [channelNames, setChannelNames] = useState<Map<string, string>>(
    new Map(),
  );

  const fetchLiveChannelIds = useCallback(async (): Promise<Set<string> | null> => {
    if (!botId || !guildId) return null;
    try {
      const { data, error } = await supabase.functions.invoke(
        "bot-list-channels",
        { body: { bot_id: botId, guild_id: guildId } },
      );
      if (error || !data?.ok) {
        console.warn(
          "[TicketEditorCard] bot-list-channels failed, skipping cleanup",
          error ?? data,
        );
        return null;
      }
      const { data: rows } = await supabase
        .from("bot_channel_cache")
        .select("channel_id")
        .eq("bot_id", botId)
        .eq("guild_id", guildId);
      return new Set((rows ?? []).map((r) => String(r.channel_id)));
    } catch (e) {
      console.warn("[TicketEditorCard] bot-list-channels threw", e);
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
    const { data: ticketsRow } = await supabase
      .from("bot_config")
      .select("config")
      .eq("bot_id", botId)
      .eq("feature", "tickets")
      .maybeSingle();
    const ticketsCfg = (ticketsRow?.config ?? {}) as Record<string, any>;
    const panelTitle = extractPanelTitle(ticketsCfg.ticket_panel_v2);

    let cleaned: PostedPanel[] = raw
      .filter((p: any) => p && p.channel_id && p.message_id)
      .map((p: any) => ({
        channel_id: String(p.channel_id),
        message_id: String(p.message_id),
        channel_name: p.channel_name ? String(p.channel_name) : undefined,
        posted_at: p.posted_at ? String(p.posted_at) : undefined,
        panel_title: panelTitle,
      }));

    const live = await fetchLiveChannelIds();
    const pruneEntry = async (p: PostedPanel) => {
      const { error: e } = await supabase.functions.invoke("save-ticket-panel", {
        body: {
          bot_id: botId,
          guild_id: guildId,
          channel_id: p.channel_id,
          message_id: p.message_id,
          delete: true,
        },
      });
      if (e) console.warn("[TicketEditorCard] prune failed", p, e);
    };

    if (live && guildId) {
      const staleChannel = cleaned.filter((p) => !live.has(p.channel_id));
      if (staleChannel.length > 0) {
        await Promise.all(staleChannel.map(pruneEntry));
        cleaned = cleaned.filter((p) => live.has(p.channel_id));
      }
    }

    // Per-message existence check via bot token.
    if (guildId && cleaned.length > 0) {
      const checks = await Promise.all(
        cleaned.map(async (p) => {
          try {
            const { data: r, error: e } = await supabase.functions.invoke(
              "bot-check-message",
              {
                body: {
                  bot_id: botId,
                  channel_id: p.channel_id,
                  message_id: p.message_id,
                },
              },
            );
            if (e || !r?.ok) {
              console.warn("[TicketEditorCard] message check failed", p, e ?? r);
              return { p, exists: true }; // fail-open: don't prune on transient errors
            }
            return { p, exists: !!r.exists };
          } catch (err) {
            console.warn("[TicketEditorCard] message check threw", p, err);
            return { p, exists: true };
          }
        }),
      );
      const missing = checks.filter((c) => !c.exists).map((c) => c.p);
      if (missing.length > 0) {
        await Promise.all(missing.map(pruneEntry));
        const missingKeys = new Set(
          missing.map((m) => `${m.channel_id}:${m.message_id}`),
        );
        cleaned = cleaned.filter(
          (p) => !missingKeys.has(`${p.channel_id}:${p.message_id}`),
        );
      }
    }


    setPanels(cleaned);
    setLoading(false);
  }, [botId, guildId, fetchLiveChannelIds]);

  // Refresh channel-name cache for nicer display labels.
  useEffect(() => {
    if (!botId || !guildId || !open) return;
    let cancelled = false;
    void supabase
      .from("bot_channel_cache")
      .select("channel_id, channel_name")
      .eq("bot_id", botId)
      .eq("guild_id", guildId)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const m = new Map<string, string>();
        for (const c of data)
          m.set(String(c.channel_id), String(c.channel_name));
        setChannelNames(m);
      });
    return () => {
      cancelled = true;
    };
  }, [botId, guildId, panels, open]);

  // Keep a ref to the latest fetchPanels so the interval never calls a stale
  // closure even if botId/guildId/deps change while the dialog is open.
  const fetchPanelsRef = useRef(fetchPanels);
  useEffect(() => {
    fetchPanelsRef.current = fetchPanels;
  }, [fetchPanels]);

  // Load panels whenever the outer dialog opens. Also auto-run a Discord
  // backfill scan once per (bot, guild) per session so panels posted before
  // posted_panels sync existed get discovered without requiring a manual click.
  const autoBackfilledRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!open) return;
    if (!botId || !guildId) {
      void fetchPanelsRef.current();
      return;
    }
    const key = `${botId}:${guildId}`;
    if (autoBackfilledRef.current.has(key)) {
      void fetchPanelsRef.current();
      return;
    }
    autoBackfilledRef.current.add(key);
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke(
          "backfill-ticket-panels",
          { body: { bot_id: botId, guild_id: guildId } },
        );
        if (error || !data?.ok) {
          console.warn("[TicketEditorCard] auto-backfill failed", error ?? data);
        } else if (data.added > 0) {
          console.log(
            `[TicketEditorCard] auto-backfill added ${data.added} panel(s)`,
          );
        }
      } catch (e) {
        console.warn("[TicketEditorCard] auto-backfill threw", e);
      } finally {
        void fetchPanelsRef.current();
      }
    })();
  }, [open, botId, guildId]);


  // Auto-refresh every 30 s while the dialog is open. Always calls the latest
  // fetchPanels via ref, which re-queries bot_config from Supabase directly
  // (no cached state — see fetchPanels above).
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => {
      console.log("[TicketEditorCard] 30s auto-refresh → re-fetching bot_config");
      void fetchPanelsRef.current();
    }, 30_000);
    return () => clearInterval(id);
  }, [open]);

  // Refresh when another component signals a panel was posted/saved.
  useEffect(() => {
    const handler = () => {
      void fetchPanels();
    };
    window.addEventListener("ticket-panels-changed", handler);
    return () => window.removeEventListener("ticket-panels-changed", handler);
  }, [fetchPanels]);

  const performEditSave = useCallback(async () => {
    if (!editing || !botId || !guildId) return;
    setSavingEdit(true);
    try {
      const payload = innerBuilderRef.current?.buildPayload();
      console.log("[TicketEditorCard] Save clicked", { editing, payload });
      if (!payload) return;

      // 1) Upsert bot_config (tickets feature).
      const { error: cfgErr } = await supabase
        .from("bot_config")
        .upsert(payload, { onConflict: "bot_id,feature" });
      if (cfgErr) {
        toast.error(`Save failed: ${cfgErr.message}`);
        return;
      }

      // 2) Insert bot_commands row with action='edit_ticket_panel'.
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
            config: (payload as any).config,
          },
        };
        console.log(
          "[TicketEditorCard] Enqueuing bot_commands edit_ticket_panel:",
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

      // 3) Refresh posted_panels entry (touch posted_at / channel_name).
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
        console.warn("[TicketEditorCard] save-ticket-panel refresh failed", spErr);
      }

      setEditing(null);
      await fetchPanels();
    } finally {
      setSavingEdit(false);
    }
  }, [editing, botId, guildId, channelNames, fetchPanels]);

  return (
    <>
      {/* Same 158px .acard tile as every other config block (CSS duplicated
          on purpose — single-paste files), so all boxes line up identically. */}
      <style>{`
        .acard.acard{position:relative;height:158px;padding:15px;display:flex;flex-direction:column;border-radius:14px;
          font-family:'Manrope',system-ui,-apple-system,"Segoe UI",sans-serif;border:1px solid #3a434d;
          background:linear-gradient(180deg,#2d353e,#29313a);box-shadow:inset 0 1px 0 rgba(255,255,255,.03);
          transition:transform .17s cubic-bezier(.22,1,.36,1),border-color .17s,box-shadow .17s;cursor:pointer}
        .acard.on:hover{transform:translateY(-2px);border-color:rgba(201,219,230,.42);
          box-shadow:0 16px 34px -18px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.05)}
        .acard.off{opacity:.5;filter:grayscale(.6);cursor:default;background:#272e36}
        .acard .ac-head{display:flex;align-items:center;gap:10px}
        .acard .ac-ico{height:34px;width:34px;border-radius:10px;flex:none;display:grid;place-items:center;
          background:rgba(201,219,230,.10);border:1px solid rgba(201,219,230,.42);color:#C9DBE6;transition:.17s}
        .acard.on:hover .ac-ico{background:rgba(201,219,230,.16)}
        .acard.off .ac-ico{background:#343d46;border-color:#3a434d;color:#788591}
        .acard .ac-ico svg{width:17px;height:17px;stroke:currentColor;stroke-width:1.8;fill:none}
        .acard .ac-title{flex:1;min-width:0;font-size:20px;font-weight:700;line-height:1.2;letter-spacing:-.01em;color:#E8EEF3;padding-top:0}
        .acard.off .ac-title{color:#A8B4BF}
        /* Enable/disable toggle — sits quietly in the top-right and blends into
           the card, brightening only on hover so it never reads as a sore thumb.
           Stays fully visible when the card is OFF so its state is obvious. */
        .acard .ac-sw{padding-top:0;flex:none;opacity:.38;transform:scale(.82);transform-origin:right center;
          transition:opacity .16s ease,transform .16s ease}
        .acard:hover .ac-sw{opacity:.85}
        .acard .ac-sw:hover{opacity:1}
        .acard.off .ac-sw{opacity:1}
        .acard .ac-summary{flex:1;margin-top:10px;font-size:12px;line-height:1.45;color:#788591;
          overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3}
        .acard .ac-foot{display:flex;align-items:center;justify-content:space-between;margin-top:10px}
        .acard .ac-count{font-size:11.5px;font-weight:600;color:#788591}
        .acard .ac-arrow{height:16px;width:16px;color:#788591;transition:transform .17s,color .17s}
        .acard.on:hover .ac-arrow{color:#C9DBE6;transform:translateX(3px)}
      `}</style>
      <Card onClick={() => setOpen(true)} className="acard on">
        <div className="ac-head">
          <span className="ac-ico">
            <ClipboardList />
          </span>
          <h3 className="ac-title">Ticket Panel Edit</h3>
        </div>
        <p className="ac-summary">Edit the contents of ticket panels you've already posted.</p>
        <div className="ac-foot">
          <span className="ac-count">
            {panels.length > 0
              ? `${panels.length} panel${panels.length === 1 ? "" : "s"}`
              : "Open to edit"}
          </span>
          <ArrowRight className="ac-arrow" />
        </div>
      </Card>

      {/* Outer Dialog — the panel list. */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              Ticket Panel Edit
            </DialogTitle>
            <DialogDescription>
              Select a posted ticket panel to edit. Changes update the existing
              Discord message in-place.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-center justify-end gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-xs gap-1.5"
                onClick={async () => {
                  if (!botId || !guildId) return;
                  setBackfilling(true);
                  try {
                    const { data, error } = await supabase.functions.invoke(
                      "backfill-ticket-panels",
                      { body: { bot_id: botId, guild_id: guildId } },
                    );
                    if (error || !data?.ok) {
                      toast.error(
                        `Backfill failed: ${error?.message ?? data?.error ?? "unknown"}`,
                      );
                    } else {
                      toast.success(
                        data.added > 0
                          ? `Backfilled ${data.added} panel${data.added === 1 ? "" : "s"} (${data.total_after} total).`
                          : `No new panels found (${data.total_after} already tracked).`,
                      );
                      await fetchPanels();
                    }
                  } finally {
                    setBackfilling(false);
                  }
                }}
                disabled={backfilling || loading || !botId || !guildId}
                title="Scan the server for ticket panels the bot has posted and add any missing ones."
              >
                <DownloadCloud
                  className={`h-3.5 w-3.5 ${backfilling ? "animate-pulse" : ""}`}
                />
                {backfilling ? "Scanning…" : "Backfill"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-xs gap-1.5"
                onClick={() => void fetchPanels()}
                disabled={loading || !botId}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                />
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
                  const channel =
                    channelNames.get(p.channel_id) ??
                    p.channel_name ??
                    p.channel_id;
                  const displayTitle = p.panel_title?.trim() || channel;
                  const hasTitle = !!p.panel_title?.trim();
                  return (
                    <div
                      key={`${p.channel_id}:${p.message_id}`}
                      className="rounded-md border border-border bg-card/40 px-3 py-2.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-foreground truncate">
                          {displayTitle}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate">
                          {hasTitle && <Hash className="h-3 w-3" />}
                          {hasTitle ? channel : `Message ${p.message_id}`}
                          {p.posted_at
                            ? ` · posted ${new Date(p.posted_at).toLocaleString()}`
                            : ""}
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 shrink-0"
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
          </div>
        </DialogContent>
      </Dialog>

      {/* Inner Dialog — the actual edit modal. Standalone Save button. */}
      <Dialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
      >
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
              onClick={() => void performEditSave()}
            >
              {savingEdit ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
