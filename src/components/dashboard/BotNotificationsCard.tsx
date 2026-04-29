import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bell, Link2, Unlink, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type Prefs = {
  notify_bot_offline: boolean;
  notify_error_spike: boolean;
  notify_command_finished: boolean;
  notify_free_period_expiring: boolean;
  error_spike_threshold: number;
  discord_user_id: string | null;
  discord_username: string | null;
  discord_linked_at: string | null;
};

const DEFAULTS: Prefs = {
  notify_bot_offline: true,
  notify_error_spike: true,
  notify_command_finished: true,
  notify_free_period_expiring: true,
  error_spike_threshold: 10,
  discord_user_id: null,
  discord_username: null,
  discord_linked_at: null,
};

const STATE_KEY = "discord-link-state";

export function BotNotificationsCard() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualId, setManualId] = useState("");

  // Load
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("user_notification_prefs")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setPrefs({ ...DEFAULTS, ...(data as Partial<Prefs>) });
      setLoading(false);
    })();
  }, [user]);

  // Handle OAuth callback (?code=...&state=... from Discord)
  useEffect(() => {
    const code = searchParams.get("code");
    const returnedState = searchParams.get("state");
    const expected = sessionStorage.getItem(STATE_KEY);
    // Only act if the state matches what *we* stored (don't hijack other OAuth flows)
    if (!code || !user || !expected || expected !== returnedState) return;

    (async () => {
      setLinking(true);
      const redirect_uri = `${window.location.origin}/dashboard`;
      const { data, error } = await supabase.functions.invoke("discord-link", {
        body: { action: "exchange_code", code, redirect_uri },
      });
      setLinking(false);
      sessionStorage.removeItem(STATE_KEY);
      searchParams.delete("discord_code");
      searchParams.delete("state");
      setSearchParams(searchParams, { replace: true });

      if (error || !data?.ok) {
        toast.error(data?.error || error?.message || "Failed to link Discord");
        return;
      }
      setPrefs((p) => ({
        ...p,
        discord_user_id: data.discord_user_id,
        discord_username: data.discord_username,
        discord_linked_at: new Date().toISOString(),
      }));
      toast.success(`Linked @${data.discord_username || data.discord_user_id}`);
    })();
  }, [searchParams, user, setSearchParams]);

  const persist = async (patch: Partial<Prefs>) => {
    if (!user) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    const { error } = await supabase
      .from("user_notification_prefs")
      .upsert({ user_id: user.id, ...next }, { onConflict: "user_id" });
    if (error) toast.error(error.message);
  };

  const startLink = async () => {
    setLinking(true);
    const redirect_uri = `${window.location.origin}/dashboard`;
    const { data, error } = await supabase.functions.invoke("discord-link", {
      body: { action: "get_authorize_url", redirect_uri },
    });
    setLinking(false);
    if (error || !data?.url) {
      toast.error(data?.error || error?.message || "Couldn't start Discord link");
      return;
    }
    sessionStorage.setItem(STATE_KEY, data.state);
    // Discord will redirect back with ?code=...&state=...; we rename code to discord_code via callback page below
    window.location.href = data.url;
  };

  const unlink = async () => {
    const { error } = await supabase.functions.invoke("discord-link", {
      body: { action: "unlink" },
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setPrefs((p) => ({ ...p, discord_user_id: null, discord_username: null, discord_linked_at: null }));
    toast.success("Discord unlinked");
  };

  const submitManual = async () => {
    const id = manualId.trim();
    const { data, error } = await supabase.functions.invoke("discord-link", {
      body: { action: "set_manual_id", discord_user_id: id },
    });
    if (error || !data?.ok) {
      toast.error(data?.error || error?.message || "Couldn't save ID");
      return;
    }
    setPrefs((p) => ({
      ...p,
      discord_user_id: id,
      discord_username: null,
      discord_linked_at: new Date().toISOString(),
    }));
    setManualOpen(false);
    setManualId("");
    toast.success("Discord ID saved");
  };

  const linked = !!prefs.discord_user_id;

  return (
    <Card className="p-6 space-y-5">
      <div>
        <h2 className="font-semibold flex items-center gap-2">
          <Bell size={16} /> Bot notifications
        </h2>
        <p className="text-sm text-muted-foreground">
          Get a Discord DM from our bot when something needs your attention. Applies to all your bots.
        </p>
      </div>

      {/* Discord link status */}
      <div className="rounded-lg border p-4 space-y-3">
        {linked ? (
          <>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 size={16} className="text-primary" />
              <span>
                Linked to{" "}
                <span className="font-medium">
                  {prefs.discord_username ? `@${prefs.discord_username}` : `ID ${prefs.discord_user_id}`}
                </span>
              </span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={startLink} disabled={linking}>
                {linking ? <Loader2 size={14} className="animate-spin mr-1" /> : <Link2 size={14} className="mr-1" />}
                Re-link
              </Button>
              <Button size="sm" variant="ghost" onClick={unlink}>
                <Unlink size={14} className="mr-1" /> Unlink
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Link your Discord so the bot knows where to DM you.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={startLink} disabled={linking}>
                {linking ? <Loader2 size={14} className="animate-spin mr-1" /> : <Link2 size={14} className="mr-1" />}
                Link Discord
              </Button>
              <Button size="sm" variant="outline" onClick={() => setManualOpen((v) => !v)}>
                {manualOpen ? "Cancel" : "Enter ID manually"}
              </Button>
            </div>
            {manualOpen && (
              <div className="space-y-2 pt-2">
                <Label className="text-xs">Discord user ID</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. 123456789012345678"
                    value={manualId}
                    onChange={(e) => setManualId(e.target.value)}
                  />
                  <Button size="sm" onClick={submitManual} disabled={!manualId.trim()}>Save</Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Discord → User Settings → Advanced → Developer Mode, then right-click your name → Copy User ID.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Toggles */}
      <div className="space-y-3 opacity-100" style={{ opacity: linked ? 1 : 0.6 }}>
        <Toggle
          label="Bot goes offline / crashes"
          desc="Alert me when one of my bots stops responding."
          checked={prefs.notify_bot_offline}
          onChange={(v) => persist({ notify_bot_offline: v })}
          disabled={loading}
        />
        <Toggle
          label="Error spike"
          desc={`Alert me when a bot logs ${prefs.error_spike_threshold}+ errors in an hour.`}
          checked={prefs.notify_error_spike}
          onChange={(v) => persist({ notify_error_spike: v })}
          disabled={loading}
        />
        <Toggle
          label="Manual command finished"
          desc="Alert me when a start/stop/restart/update finishes (or fails)."
          checked={prefs.notify_command_finished}
          onChange={(v) => persist({ notify_command_finished: v })}
          disabled={loading}
        />
        <Toggle
          label="Free period expiring"
          desc="Remind me 3 days before a redeemed free period ends."
          checked={prefs.notify_free_period_expiring}
          onChange={(v) => persist({ notify_free_period_expiring: v })}
          disabled={loading}
        />
        {!linked && (
          <p className="text-xs text-muted-foreground">
            Link Discord above to start receiving these.
          </p>
        )}
      </div>
    </Card>
  );
}

function Toggle({
  label, desc, checked, onChange, disabled,
}: {
  label: string; desc: string; checked: boolean;
  onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <Label className="font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}
