import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Send, Lock } from "lucide-react";
import { useBotServerSlots } from "@/hooks/useBotServerSlots";

interface Props {
  botId: string;
  status: string;
  /** Called when the user clicks "Buy a slot" while at limit, so the parent
   *  can pulse the slots card. */
  onRequestBuySlot?: () => void;
}

const SHOW_STATUSES = new Set(["ready", "live", "online"]);

/**
 * Add-to-Server invite card. Visible only when the bot is `ready`/`live`/`online`
 * AND the bot has a token assigned in the pool. Disables the invite when the
 * user is at their server limit and prompts them to buy a slot instead.
 */
export function BotInviteLinkCard({ botId, status, onRequestBuySlot }: Props) {
  const [clientId, setClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { limit } = useBotServerSlots(botId);

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

  const isUnlimited = limit?.is_unlimited === true;
  const current = limit?.current_count ?? 0;
  const max = limit?.limit ?? 1;
  const atLimit = !isUnlimited && current >= max;

  const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(
    clientId,
  )}&permissions=8&scope=bot+applications.commands`;

  return (
    <Card
      className={`p-4 ${
        atLimit
          ? "bg-amber-500/5 border-amber-500/40"
          : "bg-emerald-500/5 border-emerald-500/30"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`h-10 w-10 rounded-lg grid place-items-center shrink-0 border ${
            atLimit
              ? "bg-amber-500/10 border-amber-500/30"
              : "bg-emerald-500/10 border-emerald-500/30"
          }`}
        >
          {atLimit ? (
            <Lock className="h-5 w-5 text-amber-400" />
          ) : (
            <Send className="h-5 w-5 text-emerald-400" />
          )}
        </div>
        <div className="text-sm flex-1 min-w-0">
          {atLimit ? (
            <>
              <div className="font-semibold text-amber-300">
                Server limit reached ({current}/{max})
              </div>
              <p className="text-muted-foreground mt-1">
                Buy an extra slot to add this bot to another Discord server. Slots are shared
                across all your bots.
              </p>
              <Button
                variant="default"
                size="sm"
                className="mt-3"
                onClick={() => onRequestBuySlot?.()}
              >
                Buy an extra slot ($2.99)
              </Button>
            </>
          ) : (
            <>
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
                {isUnlimited
                  ? "Unlimited servers (admin)."
                  : `You can add this bot to ${max - current} more server${
                      max - current === 1 ? "" : "s"
                    }. Extra slots are $2.99 each, shared across all your bots.`}
              </p>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
