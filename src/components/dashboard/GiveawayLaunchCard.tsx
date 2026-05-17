import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Gift, Rocket } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Parse a free-text duration like "10m", "2h", "1d", "1w", "1mo", "1y" into minutes.
 * Returns 0 for invalid input.
 */
export function parseDuration(input: string): number {
  if (!input) return 0;
  const m = String(input).trim().toLowerCase().match(/^(\d+)\s*(mo|m|h|d|w|y)$/);
  if (!m) return 0;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return 0;
  switch (m[2]) {
    case "m": return n;
    case "h": return n * 60;
    case "d": return n * 60 * 24;
    case "w": return n * 60 * 24 * 7;
    case "mo": return n * 60 * 24 * 30;
    case "y": return n * 60 * 24 * 365;
    default: return 0;
  }
}

interface Props {
  botId: string;
}

export function GiveawayLaunchCard({ botId }: Props) {
  const [prize, setPrize] = useState("");
  const [duration, setDuration] = useState("1d");
  const [winners, setWinners] = useState(1);
  const [launching, setLaunching] = useState(false);

  const launch = async () => {
    const trimmedPrize = prize.trim();
    if (!trimmedPrize) {
      toast.error("Prize is required");
      return;
    }
    const minutes = parseDuration(duration);
    if (!minutes) {
      toast.error("Invalid duration. Use 10m, 2h, 1d, 1w, 1mo, 1y");
      return;
    }
    setLaunching(true);
    try {
      const { error } = await supabase.functions.invoke("enqueue-giveaway-start", {
        body: {
          botId,
          prize: trimmedPrize,
          duration_minutes: minutes,
          winners: Math.max(1, Number(winners) || 1),
        },
      });
      if (error) throw error;
      toast.success("Giveaway queued — the bot will post it shortly");
      setPrize("");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to launch giveaway");
    } finally {
      setLaunching(false);
    }
  };

  return (
    <Card className="p-5 space-y-4 border-4 border-red-500" style={{ borderColor: "red", borderWidth: 4 }}>
      <div className="flex items-center gap-2">
        <Gift className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Launch Giveaway</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Start a one-off giveaway using the channel and embed configured in Giveaway System settings.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5 sm:col-span-3">
          <Label htmlFor="giveaway-prize">Prize</Label>
          <Input
            id="giveaway-prize"
            value={prize}
            onChange={(e) => setPrize(e.target.value)}
            placeholder="Discord Nitro, $20 gift card, etc."
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="giveaway-duration">Duration</Label>
          <Input
            id="giveaway-duration"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="1d"
          />
          <p className="text-xs text-muted-foreground">e.g. 10m, 2h, 1d, 1w</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="giveaway-winners">Winners</Label>
          <Input
            id="giveaway-winners"
            type="number"
            min={1}
            max={100}
            value={winners}
            onChange={(e) => setWinners(Math.max(1, Number(e.target.value) || 1))}
          />
        </div>
        <div className="flex items-end gap-2">
          <Button
            type="button"
            onClick={(e) => {
              console.log("[GiveawayLaunchCard] Start Giveaway BUTTON onClick fired", e);
              launch();
            }}
            disabled={launching}
            className="flex-1 gap-2"
          >
            <Rocket className="h-4 w-4" />
            {launching ? "Launching…" : "Start Giveaway"}
          </Button>
          <span
            dangerouslySetInnerHTML={{
              __html:
                '<button type="button" onclick="alert(\'clicked\')" class="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground">Test</button>',
            }}
          />
        </div>
      </div>
    </Card>
  );
}
