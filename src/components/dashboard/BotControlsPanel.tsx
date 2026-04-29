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

type Action = "start" | "stop" | "restart" | "update";

interface CommandRow {
  id: string;
  action: Action;
  status: "pending" | "claimed" | "completed" | "failed" | "canceled";
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
    key: "restart",
    label: "Restart",
    Icon: RotateCw,
    variant: "outline",
    description:
      "Stop the bot and immediately start it again. Useful after changing secrets or config.",
  },
  {
    key: "update",
    label: "Update",
    Icon: Download,
    variant: "outline",
    description:
      "Pull the latest build for this bot, then restart. The bot will be offline briefly.",
  },
  {
    key: "stop",
    label: "Stop",
    Icon: Square,
    variant: "destructive",
    description: "Take the bot offline. It will stay off until you start it again.",
  },
];

const STATUS_LABEL: Record<CommandRow["status"], string> = {
  pending: "Queued",
  claimed: "Running",
  completed: "Done",
  failed: "Failed",
  canceled: "Canceled",
};

const STATUS_CLASS: Record<CommandRow["status"], string> = {
  pending: "bg-muted text-muted-foreground border-border",
  claimed: "bg-primary/10 text-primary border-primary/30",
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

  const send = async (action: Action) => {
    setPending(action);
    const { data, error } = await supabase.rpc("enqueue_bot_command", {
      _bot_id: botId,
      _action: action,
    });
    setPending(null);
    setConfirm(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    const result = data as { ok: boolean; error?: string } | null;
    if (!result?.ok) {
      toast.error(result?.error ?? "Failed to queue command.");
      return;
    }
    toast.success(`${action.charAt(0).toUpperCase() + action.slice(1)} command queued.`);
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

      {history.length > 0 && (
        <div className="mt-5 pt-4 border-t border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Recent commands
          </p>
          <ul className="space-y-1.5">
            {history.map((cmd) => (
              <li
                key={cmd.id}
                className="flex items-center justify-between text-xs gap-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono font-semibold capitalize">{cmd.action}</span>
                  <span className="text-muted-foreground tabular-nums shrink-0">
                    {formatDistanceToNow(new Date(cmd.created_at), { addSuffix: true })}
                  </span>
                  {cmd.error_message && (
                    <span className="text-destructive truncate">· {cmd.error_message}</span>
                  )}
                </div>
                <span
                  className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold shrink-0 ${STATUS_CLASS[cmd.status]}`}
                >
                  {STATUS_LABEL[cmd.status]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

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
