import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { OwnedBot } from "@/hooks/useOwnedBots";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Gift, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface RedeemFreeCodeBoxProps {
  bots: OwnedBot[];
  defaultBotId?: string;
  onRedeemed?: () => void;
}

/**
 * Generic redeem-code box. Accepts:
 *  - Free-period codes (e.g. giveaway winners — adds free months to a bot)
 *  - $-off discount codes (added as credit to the bot, rolls over month to month)
 *  - %-off discount codes (queued for next month's hosting charge)
 *
 * All three are handled atomically by the redeem_bot_code RPC.
 */
export function RedeemFreeCodeBox({ bots, defaultBotId, onRedeemed }: RedeemFreeCodeBoxProps) {
  const eligibleBots = bots.filter((b) => !b.isDemo);
  const [code, setCode] = useState("");
  const [botId, setBotId] = useState<string>(
    defaultBotId ?? eligibleBots[0]?.id ?? "",
  );
  const [submitting, setSubmitting] = useState(false);

  if (eligibleBots.length === 0) return null;

  const submit = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      toast.error("Enter a code first");
      return;
    }
    if (!botId) {
      toast.error("Pick a bot to apply the code to");
      return;
    }
    setSubmitting(true);
    const { data, error } = await (supabase as any).rpc(
      "redeem_bot_code",
      { _code: trimmed, _bot_id: botId },
    );
    setSubmitting(false);

    if (error) {
      toast.error("Couldn't redeem code", { description: error.message });
      return;
    }
    if (!data?.ok) {
      toast.error(data?.error ?? "Couldn't redeem that code");
      return;
    }

    if (data.type === "free_period") {
      const months = data.months_granted as number;
      const until = new Date(data.free_until as string);
      toast.success(
        data.stacked
          ? `Added ${months} more free month${months === 1 ? "" : "s"}!`
          : `${months} free month${months === 1 ? "" : "s"} unlocked!`,
        {
          description: `Your bot is free until ${until.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}.`,
        },
      );
    } else if (data.type === "discount_amount") {
      const added = ((data.credit_added_cents as number) / 100).toFixed(2);
      const balance = ((data.new_balance_cents as number) / 100).toFixed(2);
      toast.success(`$${added} credit added!`, {
        description: `New balance: $${balance}. It rolls over each month until used up.`,
      });
    } else if (data.type === "discount_percent") {
      toast.success(`${data.percent_off}% off your next month!`, {
        description: "We'll apply it to your next monthly hosting charge.",
      });
    } else {
      toast.success("Code redeemed!");
    }

    setCode("");
    onRedeemed?.();
  };

  return (
    <Card className="p-4 bg-gradient-to-br from-primary/5 to-transparent border-primary/30">
      <div className="flex items-start gap-3 mb-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/30 grid place-items-center shrink-0">
          <Gift className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm flex items-center gap-2">
            Redeem code
            <Badge variant="secondary" className="text-[10px]">
              <Sparkles className="h-2.5 w-2.5 mr-0.5" />
              Bonus
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Got a code? Paste it here — works for free months, $ off (rolls over month to month), or % off your next month.
          </p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_220px_auto]">
        <Input
          placeholder="Paste your code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={100}
          disabled={submitting}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
        <Select value={botId} onValueChange={setBotId} disabled={submitting}>
          <SelectTrigger>
            <SelectValue placeholder="Apply to bot" />
          </SelectTrigger>
          <SelectContent>
            {eligibleBots.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.bot_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={submit} disabled={submitting || !code.trim()}>
          <Gift className="h-4 w-4 mr-1.5" />
          {submitting ? "Redeeming…" : "Redeem"}
        </Button>
      </div>
    </Card>
  );
}
