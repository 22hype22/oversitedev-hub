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
// All four actions go through `bot-railway-action`, which scales the bot's
// Railway service (replicas 0/1) + redeploys as needed. This is base-agnostic
// — it works for Protection, Support, and Utilities bots identically because
// it operates on the order's `railway_service_id`, not on any per-bot worker
// that has to claim a `bot_commands` row.
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
  isOffline?: boolean;
  onCommandSent?: (action: Action) => void;
}

export function BotControlsPanel({ botId, isOffline = false, onCommandSent }: BotControlsPanelProps) {
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

  const send = async (action: Action) => {
    setPending(action);
    let ok = false;
    let errorMsg: string | null = null;

    try {
      if (action === "stop") {
        // Stop is handled identically for Protection / Support / Utilities by
        // inserting a `shutdown` row into bot_commands. The worker picks it up
        // and exits cleanly. The edge-function/Railway-scale path was flaky
        // for Support and Utilities.
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData.user?.id;
        if (!uid) {
          errorMsg = "Not signed in";
        } else {
          const { error } = await supabase.from("bot_commands").insert({
            bot_id: botId,
            user_id: uid,
            requested_by: uid,
            action: "shutdown",
            status: "pending",
          });
          if (error) {
            errorMsg = error.message;
            console.error("[bot_commands.shutdown] insert failed", { botId, error });
          } else {
            ok = true;
          }
        }
      } else {
        const { data, error } = await supabase.functions.invoke("bot-railway-action", {
          body: { botId, action },
        });
        if (error) {
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
          errorMsg =
            bodyMsg ??
            (data as { error?: string } | null)?.error ??
            error.message ??
            "Request failed";
          console.error("[bot-railway-action] invoke failed", { action, botId, errorMsg, error });
        } else {
          const result = data as { ok?: boolean; error?: string } | null;
          if (!result?.ok) {
            errorMsg = result?.error ?? "Failed to perform action.";
            console.error("[bot-railway-action] returned not-ok", { action, botId, result });
          } else {
            ok = true;
          }
        }
      }
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : String(e);
    }

    setConfirm(null);
    setPending(null);

    if (!ok) {
      toast.error(errorMsg ?? "Request failed");
      refresh();
      return;
    }

    onCommandSent?.(action);

    const actionMsg: Record<Action, string> = {
      start: "Booting up — your bot should be online in ~30 seconds.",
      stop: "Shutting down — the bot will go offline shortly.",
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
        {ACTIONS.map(({ key, label, Icon, variant }) => {
          const requiresOnline = key !== "start";
          const disabledByStatus = requiresOnline ? isOffline : !isOffline;
          return (
            <Button
              key={key}
              variant={variant}
              size="sm"
              disabled={pending === key || disabledByStatus}
              onClick={() => setConfirm(key)}
              className="justify-start"
            >
              <Icon className={`h-4 w-4 mr-1.5 ${pending === key ? "animate-pulse" : ""}`} />
              {label}
            </Button>
          );
        })}
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
