import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useBotServerSlots } from "@/hooks/useBotServerSlots";
import { Server, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Props {
  botId: string;
}

export function BotServerSlotsCard({ botId }: Props) {
  const { limit, guilds, loading, refresh, purchase, syncFromStripe } = useBotServerSlots(botId);

  // After returning from Checkout, sync the subscription state.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("slot_purchase") === "success") {
      syncFromStripe().then(() => {
        toast.success("Extra server slot activated!");
        params.delete("slot_purchase");
        const newUrl = window.location.pathname + (params.toString() ? `?${params}` : "");
        window.history.replaceState({}, "", newUrl);
      });
    } else if (params.get("slot_purchase") === "cancelled") {
      toast.info("Purchase cancelled");
      params.delete("slot_purchase");
      const newUrl = window.location.pathname + (params.toString() ? `?${params}` : "");
      window.history.replaceState({}, "", newUrl);
    }
  }, [syncFromStripe]);

  const max = limit?.limit ?? 1;
  const current = limit?.current_count ?? 0;
  const atLimit = current >= max;

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
            <div className="text-3xl font-bold">
              {current} <span className="text-base font-normal text-muted-foreground">/ {max}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {limit?.extra_slots
                ? `1 included + ${limit.extra_slots} extra slot${limit.extra_slots > 1 ? "s" : ""}`
                : "1 server included on every plan"}
            </p>
          </div>
          <Badge variant={atLimit ? "destructive" : "secondary"}>
            {atLimit ? "At limit" : `${max - current} free`}
          </Badge>
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

        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <p className="font-medium">Need more servers?</p>
          <p className="text-muted-foreground">
            Each extra slot is <strong>$5/month</strong>. Cancel anytime — your bot will leave any
            servers over the limit on the next renewal.
          </p>
          <Button onClick={onBuy} className="mt-3 w-full" size="sm">
            <Plus className="mr-1 h-4 w-4" />
            Buy 1 extra slot ($5/mo)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
