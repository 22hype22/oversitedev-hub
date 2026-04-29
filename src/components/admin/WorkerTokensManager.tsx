import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Copy, KeyRound, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface WorkerToken {
  id: string;
  name: string;
  token_prefix: string;
  bot_id: string | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  notes: string | null;
}

export function WorkerTokensManager() {
  const [tokens, setTokens] = useState<WorkerToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [botId, setBotId] = useState("");
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("worker_tokens")
      .select("id, name, token_prefix, bot_id, created_at, last_used_at, revoked_at, notes")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setTokens((data ?? []) as WorkerToken[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setCreating(true);
    const { data, error } = await supabase.rpc("create_worker_token", {
      _name: name.trim(),
      _bot_id: botId.trim() || null,
      _notes: notes.trim() || null,
    });
    setCreating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const result = data as { ok: boolean; token?: string; error?: string };
    if (!result?.ok || !result.token) {
      toast.error(result?.error ?? "Failed to create token");
      return;
    }
    setRevealed(result.token);
    setName("");
    setBotId("");
    setNotes("");
    refresh();
  };

  const revoke = async (id: string) => {
    if (!confirm("Revoke this token? Workers using it will stop working immediately.")) return;
    const { data, error } = await supabase.rpc("revoke_worker_token", { _id: id });
    if (error || !(data as { ok: boolean })?.ok) {
      toast.error(error?.message ?? "Failed to revoke");
      return;
    }
    toast.success("Token revoked");
    refresh();
  };

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <Card className="p-6 space-y-5">
      <div>
        <h2 className="font-semibold flex items-center gap-2">
          <KeyRound size={16} /> Worker tokens
        </h2>
        <p className="text-sm text-muted-foreground">
          Tokens authorize bot worker processes to claim commands and report status. Treat them like passwords.
        </p>
      </div>

      {/* Create form */}
      <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. railway-prod"
            />
          </div>
          <div>
            <Label className="text-xs">Bot ID (optional — restricts token to one bot)</Label>
            <Input
              value={botId}
              onChange={(e) => setBotId(e.target.value)}
              placeholder="UUID, leave empty for all bots"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs">Notes</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <Button onClick={create} disabled={creating} size="sm">
          {creating && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          Create token
        </Button>
      </div>

      {/* Revealed token */}
      {revealed && (
        <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/5 p-4 space-y-2">
          <p className="text-xs font-semibold text-yellow-500">
            ⚠ Copy this token now — it will not be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono p-2 bg-background rounded border break-all">
              {revealed}
            </code>
            <Button size="sm" variant="outline" onClick={() => copy(revealed)}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setRevealed(null)}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Tokens list */}
      <div className="space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : tokens.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tokens yet.</p>
        ) : (
          tokens.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between gap-3 p-3 border rounded-lg text-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{t.name}</span>
                  {t.revoked_at && (
                    <Badge variant="destructive" className="text-[10px]">REVOKED</Badge>
                  )}
                  {t.bot_id && (
                    <Badge variant="secondary" className="text-[10px] font-mono">bot-scoped</Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  {t.token_prefix}…
                </div>
                <div className="text-xs text-muted-foreground">
                  Created {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                  {t.last_used_at && ` · Last used ${formatDistanceToNow(new Date(t.last_used_at), { addSuffix: true })}`}
                  {!t.last_used_at && " · Never used"}
                </div>
              </div>
              {!t.revoked_at && (
                <Button size="sm" variant="ghost" onClick={() => revoke(t.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
