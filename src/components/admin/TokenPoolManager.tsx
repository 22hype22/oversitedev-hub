import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Copy, Eye, Layers, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type PoolStatus = "available" | "assigned" | "retired";

interface PoolEntry {
  id: string;
  bot_username: string;
  client_id: string;
  token_last_four: string;
  status: PoolStatus;
  notes: string | null;
  assigned_bot_id: string | null;
  assigned_at: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_VARIANTS: Record<PoolStatus, "secondary" | "default" | "destructive"> = {
  available: "secondary",
  assigned: "default",
  retired: "destructive",
};

export function TokenPoolManager() {
  const [entries, setEntries] = useState<PoolEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [revealing, setRevealing] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<{ id: string; token: string } | null>(null);

  // Edit dialog state
  const [editing, setEditing] = useState<PoolEntry | null>(null);
  const [editBotUsername, setEditBotUsername] = useState("");
  const [editClientId, setEditClientId] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editNewToken, setEditNewToken] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [botUsername, setBotUsername] = useState("");
  const [clientId, setClientId] = useState("");
  const [token, setToken] = useState("");
  const [notes, setNotes] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("bot_token_pool")
      .select(
        "id, bot_username, client_id, token_last_four, status, notes, assigned_bot_id, assigned_at, created_at, updated_at",
      )
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setEntries((data ?? []) as PoolEntry[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = async () => {
    if (!botUsername.trim() || !clientId.trim() || !token.trim()) {
      toast.error("Bot username, client ID, and token are required");
      return;
    }
    setCreating(true);
    const { data, error } = await supabase.rpc("add_bot_token_to_pool", {
      _bot_username: botUsername.trim(),
      _client_id: clientId.trim(),
      _token: token.trim(),
      _notes: notes.trim() || null,
    });
    setCreating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const result = data as { ok: boolean; error?: string };
    if (!result?.ok) {
      toast.error(result?.error ?? "Failed to add token");
      return;
    }
    toast.success("Token added to pool");
    setBotUsername("");
    setClientId("");
    setToken("");
    setNotes("");
    refresh();
  };

  const updateStatus = async (id: string, status: PoolStatus) => {
    const { data, error } = await supabase.rpc("update_bot_token_pool_entry", {
      _id: id,
      _status: status,
    });
    if (error || !(data as { ok: boolean })?.ok) {
      toast.error(error?.message ?? "Failed to update");
      return;
    }
    toast.success("Status updated");
    refresh();
  };

  const openEdit = (entry: PoolEntry) => {
    setEditing(entry);
    setEditBotUsername(entry.bot_username);
    setEditClientId(entry.client_id);
    setEditNotes(entry.notes ?? "");
    setEditNewToken("");
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!editBotUsername.trim() || !editClientId.trim()) {
      toast.error("Bot username and client ID are required");
      return;
    }
    if (editNewToken && editNewToken.trim().length < 20) {
      toast.error("New token looks too short");
      return;
    }
    setSavingEdit(true);
    const payload: Record<string, unknown> = { _id: editing.id };
    if (editBotUsername.trim() !== editing.bot_username) payload._bot_username = editBotUsername.trim();
    if (editClientId.trim() !== editing.client_id) payload._client_id = editClientId.trim();
    if ((editNotes ?? "") !== (editing.notes ?? "")) payload._notes = editNotes;
    if (editNewToken.trim()) payload._token = editNewToken.trim();

    const { data, error } = await supabase.rpc("update_bot_token_pool_entry", payload as never);
    setSavingEdit(false);
    if (error || !(data as { ok: boolean })?.ok) {
      toast.error(error?.message ?? (data as { error?: string })?.error ?? "Failed to update");
      return;
    }
    toast.success(editNewToken.trim() ? "Entry updated and token rotated" : "Entry updated");
    setEditing(null);
    refresh();
  };

  const reveal = async (id: string) => {
    setRevealing(id);
    const { data, error } = await supabase.rpc("reveal_bot_token_pool_entry", { _id: id });
    setRevealing(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    const result = data as { ok: boolean; token?: string; error?: string };
    if (!result?.ok || !result.token) {
      toast.error(result?.error ?? "Failed to reveal");
      return;
    }
    setRevealed({ id, token: result.token });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this pool entry? This cannot be undone.")) return;
    const { data, error } = await supabase.rpc("delete_bot_token_pool_entry", { _id: id });
    if (error || !(data as { ok: boolean })?.ok) {
      toast.error(error?.message ?? "Failed to delete");
      return;
    }
    toast.success("Entry deleted");
    if (revealed?.id === id) setRevealed(null);
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
          <Layers size={16} /> Token pool
        </h2>
        <p className="text-sm text-muted-foreground">
          Pre-made Discord bot tokens ready to be assigned to customer bots. Treat tokens like passwords.
        </p>
      </div>

      {/* Create form */}
      <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Bot username *</Label>
            <Input
              value={botUsername}
              onChange={(e) => setBotUsername(e.target.value)}
              placeholder="e.g. OversiteBot01"
            />
          </div>
          <div>
            <Label className="text-xs">Client ID *</Label>
            <Input
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="Discord application ID"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs">Bot token *</Label>
          <Input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Discord bot token"
            autoComplete="off"
          />
        </div>
        <div>
          <Label className="text-xs">Notes</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <Button onClick={create} disabled={creating} size="sm">
          {creating && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          Add to pool
        </Button>
      </div>

      {/* Revealed token */}
      {revealed && (
        <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/5 p-4 space-y-2">
          <p className="text-xs font-semibold text-yellow-500">⚠ Token revealed — keep it private.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono p-2 bg-background rounded border break-all">
              {revealed.token}
            </code>
            <Button size="sm" variant="outline" onClick={() => copy(revealed.token)}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setRevealed(null)}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Entries list */}
      <div className="space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tokens in pool yet.</p>
        ) : (
          entries.map((e) => (
            <div
              key={e.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 border rounded-lg text-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">{e.bot_username}</span>
                  <Badge variant={STATUS_VARIANTS[e.status]} className="text-[10px] uppercase">
                    {e.status}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground font-mono mt-0.5">
                  client: {e.client_id} · token: …{e.token_last_four}
                </div>
                <div className="text-xs text-muted-foreground">
                  Added {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                  {e.assigned_at &&
                    ` · Assigned ${formatDistanceToNow(new Date(e.assigned_at), { addSuffix: true })}`}
                </div>
                {e.notes && <div className="text-xs text-muted-foreground mt-1">{e.notes}</div>}
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={e.status}
                  onValueChange={(v) => updateStatus(e.id, v as PoolStatus)}
                >
                  <SelectTrigger className="h-8 w-[130px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="assigned">Assigned</SelectItem>
                    <SelectItem value="retired">Retired</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => reveal(e.id)}
                  disabled={revealing === e.id}
                  title="Reveal token"
                >
                  {revealing === e.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => openEdit(e)} title="Edit">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(e.id)} title="Delete">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
