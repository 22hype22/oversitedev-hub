import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Play, Square, RotateCw, Download, Power } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type Action = "start" | "stop" | "restart" | "redeploy";

interface CommandRow {
  id: string;
  action: string;
  status: "pending" | "claimed" | "done" | "completed" | "failed" | "canceled";
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

const ACTIONS: Array<{
  key: Action;
  label: string;
  Icon: typeof Play;
  variant: "default" | "outline" | "destructive";
  description: string;
}> = [
  {
    key: "start",
    label: "Start",
    Icon: Play,
    variant: "default",
    description: "Boot the bot worker. It will go online once it has connected.",
  },
  {
    key: "stop",
    label: "Stop",
    Icon: Square,
    variant: "destructive",
    description: "Take the bot offline. It will stay off until you start it again.",
  },
  {
    key: "restart",
    label: "Restart",
    Icon: RotateCw,
    variant: "outline",
    description:
      "Stop the bot and immediately start it again. Useful after changing secrets or config.",
  },
  {
    key: "redeploy",
    label: "Redeploy",
    Icon: Download,
    variant: "outline",
    description:
      "Pull the latest build for this bot, then restart. The bot will be offline briefly.",
  },
];

const STATUS_LABEL: Record<CommandRow["status"], string> = {
  pending: "Queued",
  claimed: "Running",
  done: "Done",
  completed: "Done",
  failed: "Failed",
  canceled: "Canceled",
};

const STATUS_CLASS: Record<CommandRow["status"], string> = {
  pending: "bg-muted text-muted-foreground border-border",
  claimed: "bg-primary/10 text-primary border-primary/30",
  done: "bg-green-500/10 text-green-500 border-green-500/30",
  completed: "bg-green-500/10 text-green-500 border-green-500/30",
  failed: "bg-destructive/10 text-destructive border-destructive/30",
  canceled: "bg-muted text-muted-foreground border-border",
};

interface BotControlsPanelProps {
  botId: string;
}

export function BotControlsPanel({ botId }: BotControlsPanelProps) {
  const [history, setHistory] = useState<CommandRow[]>([]);
  const [pending, setPending] = useState<Action | null>(null);
  const [confirm, setConfirm] = useState<Action | null>(null);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("bot_commands")
      .select("id, action, status, error_message, created_at, completed_at")
      .eq("bot_id", botId)
      .order("created_at", { ascending: false })
      .limit(5);
    setHistory((data ?? []) as CommandRow[]);
  }, [botId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const pollStopCommand = useCallback(
    async (commandId: string) => {
      const startedAt = Date.now();
      const interval = window.setInterval(async () => {
        const { data, error } = await supabase
          .from("bot_commands")
          .select("status, error_message")
          .eq("id", commandId)
          .maybeSingle();

        if (error) return;

        const status = (data?.status ?? "pending") as CommandRow["status"];

        if (status === "done" || status === "completed") {
          window.clearInterval(interval);
          setPending(null);
          toast.success("Bot is now offline.");
          refresh();
          return;
        }

        if (status === "failed" || status === "canceled") {
          window.clearInterval(interval);
          setPending(null);
          toast.error(data?.error_message ?? "Stop command failed.");
          refresh();
          return;
        }

        if (status === "pending" && Date.now() - startedAt > 15_000) {
          window.clearInterval(interval);
          setPending(null);
          toast.error("Stop command timed out — bot did not respond within 15s.");
          refresh();
        }
      }, 2_000);
    },
    [refresh],
  );

  const send = async (action: Action) => {
    setPending(action);
    let ok = false;
    let errorMsg: string | null = null;
    let stopCommandId: string | null = null;

    try {
      if (action === "stop") {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData.user?.id;
        if (!uid) throw new Error("Not authenticated");

        const { data: bot, error: botErr } = await supabase
          .from("bot_orders")
          .select("user_id")
          .eq("id", botId)
          .maybeSingle();
        if (botErr || !bot) throw new Error(botErr?.message ?? "Bot not found");

        const { data: inserted, error: insErr } = await supabase
          .from("bot_commands")
          .insert({
            bot_id: botId,
            user_id: bot.user_id,
            requested_by: uid,
            action: "shutdown",
            status: "pending",
            payload: {},
          })
          .select("id")
          .single();
        if (insErr) throw new Error(insErr.message);
        stopCommandId = inserted?.id ?? null;
        ok = true;
      } else {
        const { data, error } = await supabase.functions.invoke("railway-control", {
          body: { botId, action },
        });
        if (error) {
          // supabase.functions.invoke returns data=null on non-2xx; the real
          // error body lives on error.context (a Response). Pull it out so we
          // surface "Bot not linked to Railway", "Forbidden", etc. instead of
          // a generic "non-2xx status code".
          let bodyMsg: string | null = null;
          const ctx = (error as { context?: Response }).context;
          if (ctx && typeof ctx.text === "function") {
            try {
              const raw = await ctx.text();
              try {
                const parsed = JSON.parse(raw) as { error?: string };
                bodyMsg = parsed?.error ?? raw;
              } catch {
                bodyMsg = raw;
              }
            } catch {
              /* ignore */
            }
          }
          errorMsg = bodyMsg ?? (data as { error?: string } | null)?.error ?? error.message ?? "Request failed";
          console.error("[railway-control] invoke failed", { action, botId, errorMsg, error });
        } else {
          const result = data as { ok?: boolean; error?: string } | null;
          if (!result?.ok) {
            errorMsg = result?.error ?? "Failed to perform action.";
            console.error("[railway-control] returned not-ok", { action, botId, result });
          } else {
            ok = true;
          }
        }
      }
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : String(e);
    }

    setConfirm(null);

    if (!ok) {
      setPending(null);
      toast.error(errorMsg ?? "Request failed");
      refresh();
      return;
    }

    if (action === "stop" && stopCommandId) {
      toast.success("Shutting down… the bot will go offline shortly.");
      refresh();
      pollStopCommand(stopCommandId);
      return;
    }

    setPending(null);
    const actionMsg: Record<Action, string> = {
      start: "Booting up — your bot should be online in ~30 seconds.",
      stop: "Shutting down…",
      restart: "Restarting now — back online in ~30 seconds.",
      redeploy: "Redeploy starting — pulling the latest build.",
    };
    toast.success(actionMsg[action]);
    refresh();
  };

  const confirmMeta = confirm ? ACTIONS.find((a) => a.key === confirm) : null;

  return (
    <Card className="bg-card/40 border-border p-5">
      <div className="flex items-center gap-2 mb-4">
        <Power className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold">Controls</h4>
        <Badge variant="secondary" className="text-xs font-normal">
          Send commands to the runtime
        </Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {ACTIONS.map(({ key, label, Icon, variant }) => (
          <Button
            key={key}
            variant={variant}
            size="sm"
            disabled={pending !== null}
            onClick={() => setConfirm(key)}
            className="justify-start"
          >
            <Icon className={`h-4 w-4 mr-1.5 ${pending === key ? "animate-pulse" : ""}`} />
            {label}
          </Button>
        ))}
      </div>

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmMeta ? `${confirmMeta.label} this bot?` : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>{confirmMeta?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirm && send(confirm)}>
              Yes, {confirmMeta?.label.toLowerCase()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
