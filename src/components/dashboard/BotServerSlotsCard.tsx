import { useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useBotServerSlots } from "@/hooks/useBotServerSlots";
import { Server, Plus, RefreshCw, Infinity as InfinityIcon } from "lucide-react";
import { toast } from "sonner";

interface Props {
  botId: string;
  /** When true, the "Buy 1 extra slot" button pulses to grab attention. */
  highlightBuy?: boolean;
}

export function BotServerSlotsCard({ botId, highlightBuy = false }: Props) {
  const { limit, guilds, loading, refresh, purchase } = useBotServerSlots(botId);
  const buyRef = useRef<HTMLButtonElement | null>(null);

  // After returning from the one-time slot checkout, refresh the count.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("slot_purchase") === "success") {
      // Webhook may take a moment; poll briefly.
      const start = Date.now();
      const tick = async () => {
        await refresh();
        if (Date.now() - start < 8000) setTimeout(tick, 1500);
      };
      tick();
      toast.success("Extra server slot added!");
      params.delete("slot_purchase");
      const newUrl = window.location.pathname + (params.toString() ? `?${params}` : "");
      window.history.replaceState({}, "", newUrl);
    } else if (params.get("slot_purchase") === "cancelled") {
      toast.info("Purchase cancelled");
      params.delete("slot_purchase");
      const newUrl = window.location.pathname + (params.toString() ? `?${params}` : "");
      window.history.replaceState({}, "", newUrl);
    }
  }, [refresh]);

  // Pulse + scroll the buy button into view when the parent asks us to.
  useEffect(() => {
    if (!highlightBuy || !buyRef.current) return;
    buyRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightBuy]);

  const isUnlimited = limit?.is_unlimited === true;
  const max = limit?.limit ?? 1;
  const current = limit?.current_count ?? 0;
  const atLimit = !isUnlimited && current >= max;

  const onBuy = async () => {
    const res = await purchase(1);
    if (!res.ok) toast.error(res.error ?? "Failed to start purchase");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Discord Servers
          </span>
          <Button variant="ghost" size="icon" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-baseline justify-between">
          <div>
            {isUnlimited ? (
              <div className="flex items-center gap-2 text-3xl font-bold">
                {current}
                <span className="text-base font-normal text-muted-foreground">/</span>
                <InfinityIcon className="h-7 w-7 text-primary" />
              </div>
            ) : (
              <div className="text-3xl font-bold">
                {current}{" "}
                <span className="text-base font-normal text-muted-foreground">/ {max}</span>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              {isUnlimited
                ? "Admin account — unlimited servers"
                : limit?.extra_slots
                ? `1 included + ${limit.extra_slots} extra slot${limit.extra_slots > 1 ? "s" : ""} (shared across all your bots)`
                : "1 server included on every plan"}
            </p>
          </div>
          {isUnlimited ? (
            <Badge variant="secondary">Unlimited</Badge>
          ) : (
            <Badge variant={atLimit ? "destructive" : "secondary"}>
              {atLimit ? "At limit" : `${max - current} free`}
            </Badge>
          )}
        </div>

        {guilds.length > 0 ? (
          <ul className="space-y-2 rounded-md border p-3">
            {guilds.map((g) => (
              <li key={g.id} className="flex items-center justify-between text-sm">
                <span className="font-medium">{g.guild_name ?? g.guild_id}</span>
                <span className="text-muted-foreground">
                  {g.member_count != null ? `${g.member_count.toLocaleString()} members` : "—"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Bot isn't in any servers yet. Invite it to get started.
          </p>
        )}

        {!isUnlimited && (
          <div
            className={`rounded-md border p-3 text-sm transition-all ${
              highlightBuy || atLimit
                ? "border-primary bg-primary/10 ring-2 ring-primary/40 animate-pulse"
                : "bg-muted/30"
            }`}
          >
            <p className="font-medium">
              {atLimit ? "You've hit your server limit" : "Need more servers?"}
            </p>
            <p className="text-muted-foreground">
              Each extra slot is <strong>$2.99 one-time</strong> and is shared across every bot
              you own (Protection, Utilities, Support).
            </p>
            <Button
              ref={buyRef}
              onClick={onBuy}
              className="mt-3 w-full"
              size="sm"
              variant={highlightBuy || atLimit ? "default" : "outline"}
            >
              <Plus className="mr-1 h-4 w-4" />
              Buy 1 extra slot ($2.99)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
