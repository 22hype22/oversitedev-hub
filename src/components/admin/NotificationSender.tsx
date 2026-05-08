import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Send, Loader2, Bell } from "lucide-react";
import { toast } from "sonner";

type Account = {
  user_id: string;
  roblox_username: string;
  discord_username: string;
};

export const NotificationSender = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [search, setSearch] = useState("");
  const [targetUserId, setTargetUserId] = useState<string>("");
  const [broadcast, setBroadcast] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, roblox_username, discord_username")
        .order("created_at", { ascending: false })
        .limit(500);
      if (data) setAccounts(data as Account[]);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts.slice(0, 50);
    return accounts
      .filter(
        (a) =>
          a.roblox_username.toLowerCase().includes(q) ||
          a.discord_username.toLowerCase().includes(q) ||
          a.user_id.toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [accounts, search]);

  const selected = accounts.find((a) => a.user_id === targetUserId);

  const send = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error("Title and body required");
      return;
    }
    if (!broadcast && !targetUserId) {
      toast.error("Pick a user or enable broadcast");
      return;
    }
    setSending(true);
    const { data, error } = await supabase.rpc("admin_send_notification", {
      _target_user_id: broadcast ? null : targetUserId,
      _title: title.trim(),
      _body: body.trim(),
      _event_type: "admin_message",
      _broadcast: broadcast,
    });
    if (error) {
      setSending(false);
      toast.error(error.message);
      return;
    }
    // Kick the dispatcher so Discord DMs go out immediately
    supabase.functions.invoke("discord-notify-dispatch", { body: {} }).catch(() => {});
    setSending(false);
    toast.success(`Sent ${data ?? 0} notification${data === 1 ? "" : "s"}`);
    setTitle("");
    setBody("");
  };

  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Bell size={16} className="text-primary" />
        <div>
          <h3 className="font-semibold">Send notification</h3>
          <p className="text-xs text-muted-foreground">
            Posts an in-app notification to the user's bell. If their Discord is linked, the bot also DMs them.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-md border p-3">
        <div>
          <Label className="font-medium">Broadcast to all users</Label>
          <p className="text-xs text-muted-foreground">Skips the user picker and sends to everyone.</p>
        </div>
        <Switch checked={broadcast} onCheckedChange={setBroadcast} />
      </div>

      {!broadcast && (
        <div className="space-y-2">
          <Label className="text-xs">Target user</Label>
          <Input
            placeholder="Search by Roblox / Discord username or user id"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-48 overflow-auto rounded-md border divide-y">
            {filtered.length === 0 ? (
              <div className="p-3 text-xs text-muted-foreground text-center">No matches</div>
            ) : (
              filtered.map((a) => (
                <button
                  key={a.user_id}
                  onClick={() => setTargetUserId(a.user_id)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors ${
                    targetUserId === a.user_id ? "bg-primary/10" : ""
                  }`}
                >
                  <div className="font-medium">{a.roblox_username}</div>
                  <div className="text-xs text-muted-foreground">
                    @{a.discord_username} · {a.user_id.slice(0, 8)}…
                  </div>
                </button>
              ))
            )}
          </div>
          {selected && (
            <p className="text-xs text-muted-foreground">
              Sending to <span className="font-medium text-foreground">{selected.roblox_username}</span>
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-xs">Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Heads up" maxLength={120} />
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Body</Label>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Message details…"
          rows={4}
          maxLength={2000}
        />
      </div>

      <Button onClick={send} disabled={sending}>
        {sending ? <Loader2 size={14} className="animate-spin mr-1" /> : <Send size={14} className="mr-1" />}
        {broadcast ? "Send to everyone" : "Send notification"}
      </Button>
    </Card>
  );
};
