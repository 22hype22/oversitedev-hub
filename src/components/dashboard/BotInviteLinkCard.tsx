import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Send } from "lucide-react";

interface Props {
  botId: string;
  status: string;
}

const SHOW_STATUSES = new Set(["ready", "live", "online"]);

/**
 * Add-to-Server invite card. Visible only when the bot is `ready`/`live`/`online`
 * AND the bot has a token assigned in the pool (we look up the public client_id
 * via a SECURITY DEFINER RPC that gates by ownership).
 */
export function BotInviteLinkCard({ botId, status }: Props) {
  const [clientId, setClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (!SHOW_STATUSES.has(status)) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await (supabase as any).rpc("get_bot_client_id", { _bot_id: botId });
      if (!mounted) return;
      setClientId(typeof data === "string" && data.length > 0 ? data : null);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [botId, status]);

  if (!SHOW_STATUSES.has(status)) return null;
  if (loading) return null;
  if (!clientId) return null;

  const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(
    clientId,
  )}&permissions=8&scope=bot+applications.commands`;

  return (
    <Card className="p-4 bg-emerald-500/5 border-emerald-500/30">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 grid place-items-center shrink-0">
          <Send className="h-5 w-5 text-emerald-400" />
        </div>
        <div className="text-sm flex-1 min-w-0">
          <div className="font-semibold text-emerald-300">Add your bot to a server</div>
          <p className="text-muted-foreground mt-1">
            Use the button below to invite your bot to your Discord server.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <a href={inviteUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-1.5" />
              Add to Server
            </a>
          </Button>
          <p className="text-xs text-muted-foreground mt-3">
            You can only add this bot to 1 server. Purchase extra server slots to add it to more.
          </p>
        </div>
      </div>
    </Card>
  );
}
