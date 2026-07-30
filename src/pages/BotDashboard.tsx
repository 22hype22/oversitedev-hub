import { useState } from "react";
import { GuildChannelPicker } from "./GuildChannelPicker";
import type { BotGuild, BotChannel } from "@/hooks/useGuildChannels";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Radio, Check, Loader2 } from "lucide-react";
import type { OwnedBot } from "@/hooks/useOwnedBots";

export function DispatchVoiceCard({ bot }: { bot: OwnedBot }) {
  const [guild, setGuild] = useState<BotGuild | null>(null);
  const [channel, setChannel] = useState<BotChannel | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedName, setSavedName] = useState<string | null>(null);

  const onPickChannel = async (c: BotChannel | null) => {
    setChannel(c);
    if (!c) return;
    setSaving(true);
    const { data, error } = await (supabase as any).rpc("set_bot_secret", {
      _bot_id: bot.id,
      _key: "DISPATCH_VOICE_CHANNEL_ID",
      _value: c.channel_id,
    });
    setSaving(false);
    const res = data as { ok?: boolean; error?: string } | null;
    if (error || !res?.ok) {
      toast.error("Couldn't save channel", { description: res?.error ?? error?.message });
      return;
    }
    setSavedName(c.channel_name);
    toast.success("Dispatch voice channel set", { description: `#${c.channel_name}` });
  };

  return (
    <Card className="p-5 space-y-4 rounded-2xl bg-card/60 border-border shadow-lg shadow-black/5">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/25 grid place-items-center shrink-0">
          <Radio className="h-4 w-4 text-primary" />
        </div>
        <div>
          <div className="font-semibold">Dispatch voice channel</div>
          <p className="text-xs text-muted-foreground">
            Pick the voice channel your dispatcher sits in and speaks from. It joins within a
            minute of saving — no restart needed.
          </p>
        </div>
      </div>

      <GuildChannelPicker
        botId={bot.id}
        guildId={guild?.guild_id ?? null}
        channelId={channel?.channel_id ?? null}
        onGuildChange={(g) => {
          setGuild(g);
          setChannel(null);
          setSavedName(null);
        }}
        onChannelChange={onPickChannel}
        channelTypes={["voice"]}
        guildLabel="Server"
        channelLabel="Voice channel"
      />

      {saving ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
        </div>
      ) : savedName ? (
        <div className="flex items-center gap-1.5 text-xs text-emerald-400">
          <Check className="h-3.5 w-3.5" /> Saved — dispatcher will join #{savedName}.
        </div>
      ) : null}
    </Card>
  );
}
