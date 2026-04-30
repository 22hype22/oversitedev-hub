import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Bot, Plus, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface BotToken {
  id: string;
  bot_username: string;
  client_id: string;
  token_preview: string;
  status: "available" | "assigned" | "retired";
  assigned_to_order_id: string | null;
  created_at: string;
}

const LOW_POOL_THRESHOLD = 5;

export function BotTokenPool() {
  const [tokens, setTokens] = useState<BotToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<BotToken | null>(null);

  // Form state
  const [botUsername, setBotUsername] = useState("");
  const [clientId, setClientId] = useState("");
  const [botToken, setBotToken] = useState("");
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("bot_token_pool")
      .select("id, bot_username, client_id, token_preview, status, assigned_to_order_id, created_at")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setTokens((data ?? []) as BotToken[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const available = tokens.filter((t) => t.status === "available").length;
  const assigned = tokens.filter((t) => t.status === "assigned").length;
  const isLow = available < LOW_POOL_THRESHOLD;

  const save = async () => {
    if (!botUsername.trim() || !clientId.trim() || !botToken.trim()) {
      toast.error("All fields are required.");
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).from("bot_token_pool").insert({
      bot_username: botUsername.trim(),
      client_id: clientId.trim(),
      discord_token_encrypted: botToken.trim(), // Will be encrypted server-side
      token_preview: `${botToken.slice(0, 8)}...${botToken.slice(-4)}`,
      status: "available",
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Token for ${botUsername} added to pool`);
    setBotUsername("");
    setClientId("");
    setBotToken("");
    setAdding(false);
    refresh();
  };

  const retire = async (token: BotToken) => {
    const { error } = await (supabase as any)
      .from("bot_token_pool")
      .update({ status: "retired" })
      .eq("id", token.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Token for ${token.bot_username} retired`);
    setDeleting(null);
    refresh();
  };

  const statusColor = (status: string) => {
    if (status === "available") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
    if (status === "assigned") return "bg-blue-500/10 text-blue-400 border-blue-500/30";
    return "bg-muted text-muted-foreground";
  };

  return (
    <Card className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="font-semibold">Discord Bot Token Pool</div>
            <p className="text-xs text-muted-foreground">
              Pre-made bot tokens assigned to customers automatically on order.
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add token
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
          <div className="text-2xl font-bold text-emerald-400">{available}</div>
          <div className="text-xs text-muted-foreground">Available</div>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
          <div className="text-2xl font-bold text-blue-400">{assigned}</div>
          <div className="text-xs text-muted-foreground">Assigned</div>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
          <div className="text-2xl font-bold">{tokens.length}</div>
          <div className="text-xs text-muted-foreground">Total</div>
        </div>
      </div>

      {/* Low pool warning */}
      {isLow && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Pool is low — only <strong>{available}</strong> token{available !== 1 ? "s" : ""} available. Add more soon.
          </span>
        </div>
      )}

      {/* Add form */}
      {adding && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <p className="text-sm font-medium">Add a new bot token</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Bot Username *</Label>
              <Input
                value={botUsername}
                onChange={(e) => setBotUsername(e.target.value)}
                placeholder="e.g. OversiteBot-12"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs">Client ID *</Label>
              <Input
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Discord Application Client ID"
                className="mt-1.5 font-mono"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Bot Token *</Label>
            <Input
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="MTxxxxxxx.Gxxxxx.xxxxxxxxxx"
              className="mt-1.5 font-mono"
              type="password"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Token is stored encrypted and only shown as a preview after saving.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Save token
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Token list */}
      {loading ? (
        <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Loading…
        </div>
      ) : tokens.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          No tokens in pool yet. Add your first bot token above.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {tokens.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{t.bot_username}</span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] py-0 h-4 ${statusColor(t.status)}`}
                  >
                    {t.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <code className="text-[10px] text-muted-foreground font-mono">
                    ID: {t.client_id}
                  </code>
                  <code className="text-[10px] text-muted-foreground font-mono">
                    Token: {t.token_preview}
                  </code>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Added {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                  {t.assigned_to_order_id && (
                    <span className="ml-2 text-blue-400">
                      · Assigned to order {t.assigned_to_order_id.slice(0, 8)}…
                    </span>
                  )}
                </div>
              </div>
              {t.status !== "retired" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setDeleting(t)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Retire confirm */}
      {deleting && (
        <AlertDialog open onOpenChange={(open) => !open && setDeleting(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Retire token for "{deleting.bot_username}"?</AlertDialogTitle>
              <AlertDialogDescription>
                {deleting.status === "assigned"
                  ? "⚠️ This token is currently assigned to a customer. Retiring it will stop their bot. Are you sure?"
                  : "This token will be marked as retired and won't be assigned to new orders."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => retire(deleting)}
              >
                Retire token
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </Card>
  );
}
