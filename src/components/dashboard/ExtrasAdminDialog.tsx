import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  MessagesV2Builder,
  normalizeV2Items,
  type MessagesV2BuilderHandle,
  type V2Item,
} from "./MessagesV2Builder";

/**
 * Hidden owner-only editor behind the small icon on the Extras cards. Lets the
 * platform owner design the embed that gets posted when someone submits the
 * Report a bug / Custom feature form, and set the destination channel. Stored
 * globally under the support bot's bot_config so it applies everywhere.
 */
export function ExtrasAdminDialog({
  open,
  onOpenChange,
  feature,
  supportBotId,
  title,
  tokens,
  mirror,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** bot_config feature key, e.g. "extras-reportbug" | "extras-customfeature". */
  feature: string;
  supportBotId: string;
  title: string;
  /** Variable tokens the form fills in (shown as a hint). */
  tokens: string[];
  /**
   * Optional: also mirror this global setting into a real bot's prompt-form
   * config so the matching Discord slash command works with the same channel.
   * `template` is the prompt-form message (with {Question:}/{File:} tokens) the
   * bot posts when someone runs the command.
   */
  mirror?: { botId?: string; feature: string; template: string };
}) {
  const builderRef = useRef<MessagesV2BuilderHandle>(null);
  const [items, setItems] = useState<V2Item[]>([]);
  const [mountKey, setMountKey] = useState(0);
  const [channelId, setChannelId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      // Global, admin-owned setting — stored in platform_settings (not bot_config,
      // which foreign-keys a real bot). `as any` because this table isn't in the
      // generated Supabase types yet.
      const { data } = await (supabase as any)
        .from("platform_settings")
        .select("value")
        .eq("key", feature)
        .maybeSingle();
      if (cancelled) return;
      const cfg = (data?.value ?? {}) as Record<string, any>;
      setChannelId(String(cfg.channel_id ?? ""));
      setItems(Array.isArray(cfg.components) ? (cfg.components as V2Item[]) : []);
      setMountKey((k) => k + 1);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, feature]);

  const save = async () => {
    const ch = channelId.replace(/[^0-9]/g, "");
    if (!ch) return toast.error("Enter the destination channel ID.");
    const components = normalizeV2Items(builderRef.current?.getItems() ?? items ?? []);
    setSaving(true);
    const { error } = await (supabase as any).from("platform_settings").upsert(
      {
        key: feature,
        value: { channel_id: ch, components },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
    if (error) {
      setSaving(false);
      return toast.error(`Save failed: ${error.message}`);
    }

    // Link the matching Discord slash command (/suggestion, /reportbug) to this
    // same setup: write the bot's prompt-form config to the SAME channel and
    // enqueue an apply so it takes effect without a redeploy. Best-effort — the
    // global setting is already saved, so we never fail the whole save on this.
    if (mirror?.botId && mirror.feature) {
      try {
        const { error: cfgErr } = await supabase.from("bot_config").upsert(
          {
            bot_id: mirror.botId,
            feature: mirror.feature,
            config: {
              messages: [
                {
                  channel_id: ch,
                  components: [
                    { id: `mirror-${Date.now()}`, type: "text", text: mirror.template },
                  ],
                },
              ],
            },
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: "bot_id,feature" },
        );
        if (cfgErr) {
          toast.warning(`Saved, but couldn't link the slash command: ${cfgErr.message}`);
        } else {
          await supabase.rpc("enqueue_apply_config" as any, {
            _bot_id: mirror.botId,
            _feature: mirror.feature,
          });
        }
      } catch (e: any) {
        toast.warning(`Saved, but couldn't link the slash command: ${e?.message ?? e}`);
      }
    }

    setSaving(false);
    toast.success("Saved");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Owner-only. Design the message that gets posted when someone submits, and set where it goes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          <div className="space-y-2">
            <Label htmlFor="extras-admin-channel">Destination channel ID</Label>
            <Input
              id="extras-admin-channel"
              value={channelId}
              placeholder="123456789012345678"
              onChange={(e) => setChannelId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              The channel where each submission is posted.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Posted message</Label>
              <p className="text-xs text-muted-foreground">
                Variables:{" "}
                {tokens.map((t) => (
                  <code key={t} className="font-mono text-os-accent mr-1">{`{${t}}`}</code>
                ))}
              </p>
            </div>
            <MessagesV2Builder
              key={`extras-${feature}-${mountKey}`}
              ref={builderRef}
              embedded
              botId={supportBotId}
              botName="Oversite"
              initialItems={items}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
