import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const SUPPORT_BOT_ID = "a6be529f-a7f3-4a58-84c5-bcac5dbc97df";
const TARGET_CHANNEL_ID = "1503905197695569950";

type Priority = "Low" | "Normal" | "Urgent";

const PRIORITY_COLORS: Record<Priority, number> = {
  Low: 0x10b981, // emerald
  Normal: 0x3b82f6, // blue
  Urgent: 0xef4444, // red
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const RequestCustomFeatureDialog = ({ open, onOpenChange }: Props) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("Normal");
  const [discordUsername, setDiscordUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setTitle("");
    setDescription("");
    setPriority("Normal");
    setDiscordUsername("");
  };

  const handleSubmit = async () => {
    if (!title.trim()) return toast.error("Please enter a feature title.");
    if (!description.trim()) return toast.error("Please enter a description.");
    if (!discordUsername.trim()) return toast.error("Please enter your Discord username.");

    setSubmitting(true);
    try {
      const payload = {
        channel_id: TARGET_CHANNEL_ID,
        content: null,
        embeds: [
          {
            title: `New Custom Feature Request: ${title.trim()}`,
            description: description.trim(),
            color: PRIORITY_COLORS[priority],
            fields: [
              { name: "Priority", value: priority, inline: true },
              { name: "Requested by", value: discordUsername.trim(), inline: true },
            ],
            footer: { text: "Submitted via Oversite dashboard" },
            timestamp: new Date().toISOString(),
          },
        ],
        images: [],
        trailing_messages: [],
      };

      const { data, error } = await supabase.rpc("enqueue_post_message", {
        _bot_id: SUPPORT_BOT_ID,
        _payload: payload as any,
      });
      if (error) throw error;
      const result = data as { ok?: boolean; error?: string } | null;
      if (!result?.ok) {
        toast.error(result?.error || "Could not submit your request.");
        return;
      }
      toast.success("Request submitted — our team will review it shortly.");
      reset();
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to submit request.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request a custom feature</DialogTitle>
          <DialogDescription>
            Tell us what you'd like built. Our team will review and reach out.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="cf-title">Feature title</Label>
            <Input
              id="cf-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Auto-DM new server members"
              maxLength={120}
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cf-desc">Description</Label>
            <Textarea
              id="cf-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what you want, when it should trigger, and any edge cases."
              rows={5}
              maxLength={2000}
              disabled={submitting}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cf-priority">Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as Priority)}
                disabled={submitting}
              >
                <SelectTrigger id="cf-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Normal">Normal</SelectItem>
                  <SelectItem value="Urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cf-username">Discord username</Label>
              <Input
                id="cf-username"
                value={discordUsername}
                onChange={(e) => setDiscordUsername(e.target.value)}
                placeholder="yourname"
                maxLength={64}
                disabled={submitting}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Submit request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
