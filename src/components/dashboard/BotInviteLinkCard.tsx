import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
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
 * Add-to-Server invite panel. Visible only when the bot is `ready`/`live`/
 * `online` AND the bot has a token assigned in the pool. Disables the invite
 * when the user is at their server limit and prompts them to buy a slot.
 *
 * Visual: the completed brand ridge with a glowing summit dot — the deploy
 * climb is finished, the bot just needs a server. Mirrors the broken-ridge
 * deploy-failed banner so both states read as one system.
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
    <div
      className={`rounded-2xl border px-6 py-7 sm:px-9 ${
        atLimit
          ? "border-amber-400/30 bg-amber-400/[0.07]"
          : "border-[#C9DBE6]/25 bg-[#C9DBE6]/[0.05]"
      }`}
    >
      <style>{`
        .os-ridge-summit{animation:os-ridge-summit 2.6s ease-out infinite}
        @keyframes os-ridge-summit{0%,100%{opacity:1}50%{opacity:.35}}
        @media (prefers-reduced-motion: reduce){.os-ridge-summit{animation:none}}
      `}</style>
      <div className="flex flex-wrap items-center gap-x-10 gap-y-5">
        <svg
          width="148"
          height="58"
          viewBox="0 0 190 74"
          style={{ overflow: "visible" }}
          aria-hidden
          className="shrink-0"
        >
          <path
            d="M4 70 L44 26 L62 44 L95 6 L128 42 L148 24 L186 70"
            fill="none"
            stroke="#C9DBE6"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            className="os-ridge-summit"
            cx="95"
            cy="6"
            r="4.5"
            fill={atLimit ? "#F5C46E" : "#7DE8B2"}
          />
        </svg>
        {atLimit ? (
          <>
            <div className="min-w-[240px] flex-1">
              <div className="text-base font-semibold text-foreground">
                Server limit reached ({current}/{max})
              </div>
              <p className="mt-1.5 max-w-[52ch] text-sm leading-relaxed text-muted-foreground">
                Buy an extra slot to add this bot to another Discord server. Slots are
                shared across all your bots.
              </p>
            </div>
            <Button
              className="shrink-0 rounded-full px-7"
              onClick={() => onRequestBuySlot?.()}
            >
              Buy an extra slot ($2.99)
            </Button>
          </>
        ) : (
          <>
            <div className="min-w-[240px] flex-1">
              <div className="text-base font-semibold text-foreground">
                Your bot is ready for a server.
              </div>
              <p className="mt-1.5 max-w-[52ch] text-sm leading-relaxed text-muted-foreground">
                It's online and waiting. Invite it to your Discord server to bring it to life.
              </p>
              <p className="mt-2 text-xs text-muted-foreground/80">
                {isUnlimited
                  ? "Unlimited servers (admin)."
                  : `You can add this bot to ${max - current} more server${
                      max - current === 1 ? "" : "s"
                    }. Extra slots are $2.99 each, shared across all your bots.`}
              </p>
            </div>
            <Button asChild className="shrink-0 rounded-full px-7">
              <a href={inviteUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1.5 h-4 w-4" />
                Add to server
              </a>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
