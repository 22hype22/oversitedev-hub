import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Paperclip, X, Bug, ArrowRight } from "lucide-react";
import { isBlockedFileType, resolveContentType } from "@/lib/uploadValidation";
import { OS_DIALOG_CSS, OsDialogBackdrop, osMtnStyle } from "./osDialogTheme";

const SUPPORT_BOT_ID = "a6be529f-a7f3-4a58-84c5-bcac5dbc97df";
const TARGET_CHANNEL_ID = "1504955457448444066";
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp"];
const BUG_RED = 0xef4444;

type Priority = "Low" | "Normal" | "Urgent";
const PRIORITIES: Priority[] = ["Low", "Normal", "Urgent"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, the report is sent through this bot to the channel the
   *  owner configured in the "Report a Bug" dashboard block, instead of the
   *  shared Oversite support channel. */
  botId?: string;
}

export const ReportBugDialog = ({ open, onOpenChange, botId }: Props) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState("");
  const [priority, setPriority] = useState<Priority>("Normal");
  const [discordUsername, setDiscordUsername] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setTitle("");
    setDescription("");
    setSteps("");
    setPriority("Normal");
    setDiscordUsername("");
    setProofFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    if (f && isBlockedFileType(f)) {
      toast.error(`"${f.name}" is a blocked file type.`);
      e.target.value = "";
      return;
    }
    if (f && f.size > MAX_FILE_BYTES) {
      toast.error("File is too large (max 10 MB).");
      e.target.value = "";
      return;
    }
    setProofFile(f);
  };

  const handleSubmit = async () => {
    if (!title.trim()) return toast.error("Please enter a bug title.");
    if (!description.trim()) return toast.error("Please describe the bug.");
    if (!steps.trim()) return toast.error("Please add steps to reproduce.");
    if (!discordUsername.trim()) return toast.error("Please enter your Discord username.");

    setSubmitting(true);
    try {
      // Resolve the destination FIRST, before any file upload. Precedence:
      //   1) the owner's global config set via the hidden Extras cog
      //   2) the per-bot Report a Bug block (customs-reportbug)
      //   3) the shared Oversite support channel
      let targetBotId = SUPPORT_BOT_ID;
      let targetChannel = TARGET_CHANNEL_ID;
      let design: any[] | null = null;

      const { data: globalRow } = await (supabase as any)
        .from("platform_settings")
        .select("value")
        .eq("key", "extras-reportbug")
        .maybeSingle();
      const gcfg = (globalRow?.value ?? {}) as Record<string, any>;
      if (gcfg.channel_id) {
        targetChannel = String(gcfg.channel_id);
        design = Array.isArray(gcfg.components) && gcfg.components.length ? gcfg.components : null;
      } else if (botId) {
        const { data: cfgRow } = await supabase
          .from("bot_config")
          .select("config")
          .eq("bot_id", botId)
          .eq("feature", "customs-reportbug")
          .maybeSingle();
        const cfg = (cfgRow?.config ?? {}) as Record<string, any>;
        const msgs = Array.isArray(cfg.messages) ? cfg.messages : [];
        const ch = String(cfg.channel_id || msgs[0]?.channel_id || "");
        if (ch) {
          targetBotId = botId;
          targetChannel = ch;
        }
      }

      let proofUrl: string | null = null;
      let proofIsImage = false;

      if (proofFile) {
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userData?.user) throw new Error("You must be signed in to upload a file.");
        const userId = userData.user.id;
        const ext = proofFile.name.split(".").pop()?.toLowerCase() || "bin";
        const path = `${userId}/bug-reports/${Date.now()}-${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("bot-assets")
          .upload(path, proofFile, { upsert: false, contentType: resolveContentType(proofFile) });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("bot-assets").getPublicUrl(path);
        proofUrl = pub.publicUrl;
        proofIsImage = IMAGE_EXTS.includes(ext);
      }

      const proofValue = proofUrl
        ? proofIsImage
          ? proofUrl
          : `[${proofFile!.name}](${proofUrl})`
        : "—";

      let payload: Record<string, any>;
      if (design) {
        // Owner-designed message: substitute the form values into its tokens.
        const map: Record<string, string> = {
          title: title.trim(),
          description: description.trim(),
          steps: steps.trim(),
          priority,
          user: discordUsername.trim(),
          proof: proofValue,
        };
        let raw = JSON.stringify(design);
        for (const [k, v] of Object.entries(map)) {
          // Insert the value into JSON string literals safely (escape quotes,
          // backslashes, newlines) by borrowing JSON.stringify's escaping.
          raw = raw.split(`{${k}}`).join(JSON.stringify(String(v)).slice(1, -1));
        }
        payload = {
          channel_id: targetChannel,
          components_v2: JSON.parse(raw),
          images: proofUrl && proofIsImage ? [proofUrl] : [],
        };
      } else {
        const fields: Array<{ name: string; value: string; inline?: boolean }> = [
          { name: "Steps to reproduce", value: steps.trim() },
          { name: "Priority", value: priority, inline: true },
          { name: "Reported by", value: discordUsername.trim(), inline: true },
        ];
        if (proofUrl && !proofIsImage) {
          fields.push({ name: "Proof", value: `[${proofFile!.name}](${proofUrl})` });
        }
        payload = {
          channel_id: targetChannel,
          content: null,
          embeds: [
            {
              author: { name: "Bug Report" },
              title: title.trim(),
              description: description.trim(),
              color: BUG_RED,
              fields,
              image_url: proofUrl && proofIsImage ? proofUrl : null,
              footer: { text: "Submitted via Oversite dashboard" },
              timestamp: new Date().toISOString(),
            },
          ],
          images: [],
          trailing_messages: [],
        };
      }

      const { data, error } = await supabase.rpc("enqueue_post_message", {
        _bot_id: targetBotId,
        _payload: payload as any,
      });
      if (error) throw error;
      const result = data as { ok?: boolean; error?: string } | null;
      if (!result?.ok) {
        toast.error(result?.error || "Could not submit your bug report.");
        return;
      }
      toast.success("Bug report submitted — thanks for the heads up!");
      reset();
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to submit bug report.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent
        className="osdlg gap-0 overflow-hidden rounded-[18px] border-[rgba(201,219,230,0.14)] bg-[#1b2127] p-0 sm:max-w-[500px]"
        style={osMtnStyle}
      >
        <style>{OS_DIALOG_CSS}</style>
        <OsDialogBackdrop />

        <div className="oscontent">
        <div className="mhead">
          <span className="mico bug">
            <Bug />
          </span>
          <div className="mtt">
            <div className="eyebrow">Bug report</div>
            <DialogTitle>Report a bug</DialogTitle>
            <DialogDescription>
              Help us squash it — the more detail you give, the faster we fix it.
            </DialogDescription>
          </div>
        </div>

        <div className="mbody">
          <div className="mrow">
            <label className="lbl" htmlFor="bug-title">Bug title</label>
            <input
              id="bug-title"
              className="inp"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Tickets aren't auto-closing after 48h"
              maxLength={120}
              disabled={submitting}
            />
          </div>

          <div className="mrow">
            <label className="lbl" htmlFor="bug-desc">Description</label>
            <textarea
              id="bug-desc"
              className="ta"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's happening? What did you expect to happen?"
              maxLength={2000}
              disabled={submitting}
            />
          </div>

          <div className="mrow">
            <label className="lbl" htmlFor="bug-steps">Steps to reproduce</label>
            <textarea
              id="bug-steps"
              className="ta"
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              placeholder={"1. Go to …\n2. Click …\n3. See error"}
              maxLength={2000}
              disabled={submitting}
            />
          </div>

          <div className="two">
            <div className="mrow">
              <label className="lbl">Priority</label>
              <div className="seg" role="group" aria-label="Priority">
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`${priority === p ? "on" : ""} ${p === "Urgent" ? "urgent" : ""}`}
                    aria-pressed={priority === p}
                    onClick={() => setPriority(p)}
                    disabled={submitting}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="mrow">
              <label className="lbl" htmlFor="bug-username">Discord username</label>
              <input
                id="bug-username"
                className="inp"
                value={discordUsername}
                onChange={(e) => setDiscordUsername(e.target.value)}
                placeholder="yourname"
                maxLength={64}
                disabled={submitting}
              />
            </div>
          </div>

          <div className="mrow">
            <label className="lbl">
              Proof <span className="opt">optional</span>
            </label>
            <button
              type="button"
              className="attach"
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting}
            >
              <span className="pin">
                <Paperclip />
              </span>
              <span className="at">
                <b>{proofFile ? "Replace file" : "Attach a file"}</b>
                <span>Screenshots, recordings, or logs · max 10 MB</span>
              </span>
            </button>
            {proofFile && (
              <div className="filerow">
                <span className="fn">{proofFile.name}</span>
                <button
                  type="button"
                  className="rm"
                  aria-label="Remove file"
                  onClick={() => {
                    setProofFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  disabled={submitting}
                >
                  <X />
                </button>
              </div>
            )}
            <input
              ref={fileInputRef}
              id="bug-proof"
              type="file"
              className="hidden"
              accept="image/*,application/pdf,.txt,.log,.json,.csv,.zip"
              onChange={handleFileChange}
            />
          </div>
        </div>

        <div className="mfoot">
          <button
            type="button"
            className="btn ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </button>
          <button type="button" className="btn primary" onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="spin" size={15} />}
            Submit bug report
            {!submitting && <ArrowRight className="arw" size={15} />}
          </button>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
