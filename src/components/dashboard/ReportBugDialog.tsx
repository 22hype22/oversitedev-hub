import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Paperclip, X, Bug } from "lucide-react";
import { isBlockedFileType, resolveContentType } from "@/lib/uploadValidation";

const SUPPORT_BOT_ID = "a6be529f-a7f3-4a58-84c5-bcac5dbc97df";
const TARGET_CHANNEL_ID = "1504955457448444066";
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp"];
const BUG_RED = 0xef4444;

type Priority = "Low" | "Normal" | "Urgent";
const PRIORITIES: Priority[] = ["Low", "Normal", "Urgent"];

// Scoped to .osdlg so nothing leaks; styled in the dashboard's os-* language
// (hairline surfaces, accent focus, segmented controls) instead of the default
// shadcn look.
const OSDLG_CSS = `
.osdlg{--line:rgba(255,255,255,.09);--line2:rgba(255,255,255,.055);
  --heading:#E8EEF3;--body:#A8B4BF;--faint:#788591;--accent:#C9DBE6;--accent-ink:#1c2329;
  --accent-06:rgba(201,219,230,.06);--accent-10:rgba(201,219,230,.10);--accent-20:rgba(201,219,230,.20);--accent-28:rgba(201,219,230,.28);
  --bug:#e98b8b;--bug-10:rgba(233,139,139,.10);--bug-24:rgba(233,139,139,.24);--inp:rgba(15,18,22,.5)}
.osdlg .mhead{display:flex;align-items:flex-start;gap:13px;margin-bottom:18px}
.osdlg .mico{height:40px;width:40px;flex:none;display:flex;align-items:center;justify-content:center;border-radius:11px}
.osdlg .mico.acc{background:var(--accent-10);border:1px solid var(--accent-28);color:var(--accent)}
.osdlg .mico.bug{background:var(--bug-10);border:1px solid var(--bug-24);color:var(--bug)}
.osdlg .mico svg{width:19px;height:19px}
.osdlg .mtt{flex:1;min-width:0;padding-right:28px}
.osdlg .mtt h2{margin:1px 0 0;font-size:17px;font-weight:750;color:var(--heading);letter-spacing:-.015em}
.osdlg .mtt p{margin:5px 0 0;font-size:12.5px;color:var(--faint);line-height:1.45}
.osdlg .mbody{display:flex;flex-direction:column;gap:16px}
.osdlg .mrow{display:flex;flex-direction:column;gap:7px}
.osdlg .lbl{font-size:11.5px;font-weight:700;color:var(--body)}
.osdlg .lbl .opt{color:var(--faint);font-weight:500;margin-left:5px}
.osdlg .inp,.osdlg .ta{width:100%;background:var(--inp);border:1px solid var(--line);border-radius:9px;
  padding:10px 12px;color:var(--heading);font:inherit;font-size:13.5px;outline:none;transition:border-color .15s,box-shadow .15s}
.osdlg .inp::placeholder,.osdlg .ta::placeholder{color:var(--faint)}
.osdlg .inp:focus,.osdlg .ta:focus{border-color:var(--accent-28);box-shadow:0 0 0 3px var(--accent-10)}
.osdlg .ta{resize:vertical;min-height:88px;line-height:1.5;font-family:inherit}
.osdlg .two{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:460px){.osdlg .two{grid-template-columns:1fr}}
.osdlg .seg{display:flex;gap:6px;background:var(--inp);border:1px solid var(--line);border-radius:9px;padding:4px}
.osdlg .seg button{flex:1;border:none;background:transparent;color:var(--body);font:inherit;font-size:12.5px;font-weight:600;
  padding:7px 4px;border-radius:6px;cursor:pointer;transition:background .14s,color .14s}
.osdlg .seg button:hover:not(:disabled){color:var(--heading)}
.osdlg .seg button.on{background:var(--accent);color:var(--accent-ink)}
.osdlg .seg button.on.urgent{background:var(--bug);color:#241416}
.osdlg .seg button:disabled{cursor:not-allowed;opacity:.6}
.osdlg .attach{display:flex;align-items:center;gap:11px;width:100%;text-align:left;cursor:pointer;
  border:1px dashed var(--line);background:rgba(255,255,255,.015);border-radius:10px;padding:12px 14px;color:var(--body);transition:.15s;font:inherit}
.osdlg .attach:hover:not(:disabled){border-color:var(--accent-28);color:var(--heading);background:var(--accent-06)}
.osdlg .attach:disabled{cursor:not-allowed;opacity:.6}
.osdlg .attach .pin{height:30px;width:30px;flex:none;display:flex;align-items:center;justify-content:center;border-radius:8px;background:var(--accent-10);border:1px solid var(--accent-20);color:var(--accent)}
.osdlg .attach .pin svg{width:15px;height:15px}
.osdlg .attach .at{flex:1;min-width:0}
.osdlg .attach .at b{display:block;font-size:13px;font-weight:650;color:var(--heading)}
.osdlg .attach .at span{display:block;font-size:11.5px;color:var(--faint);margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.osdlg .filerow{display:flex;align-items:center;gap:9px;margin-top:9px;padding:9px 11px;border:1px solid var(--line);border-radius:9px;background:var(--inp);font-size:12.5px;color:var(--body)}
.osdlg .filerow .fn{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.osdlg .filerow .rm{margin-left:auto;height:26px;width:26px;flex:none;border-radius:7px;border:1px solid var(--line);background:transparent;color:var(--faint);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:.15s}
.osdlg .filerow .rm:hover:not(:disabled){color:var(--bug);border-color:var(--bug-24)}
.osdlg .filerow .rm svg{width:13px;height:13px}
.osdlg .hint{font-size:11.5px;color:var(--faint);margin-top:2px}
.osdlg .mfoot{display:flex;justify-content:flex-end;gap:10px;padding-top:18px;margin-top:20px;border-top:1px solid var(--line2)}
.osdlg .btn{border-radius:9px;padding:10px 16px;font:inherit;font-weight:700;font-size:13px;cursor:pointer;transition:.15s;display:inline-flex;align-items:center;gap:7px}
.osdlg .btn:disabled{opacity:.6;cursor:not-allowed}
.osdlg .btn.ghost{background:transparent;border:1px solid var(--line);color:var(--body)}
.osdlg .btn.ghost:hover:not(:disabled){color:var(--heading);border-color:var(--accent-28)}
.osdlg .btn.primary{background:var(--accent);border:1px solid var(--accent);color:var(--accent-ink)}
.osdlg .btn.primary:hover:not(:disabled){background:#dce8f0}
.osdlg .btn svg{width:15px;height:15px}
.osdlg .spin{animation:osdlg-spin 1s linear infinite}
@keyframes osdlg-spin{to{transform:rotate(360deg)}}
`;

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
      <DialogContent className="osdlg gap-0 border-[rgba(255,255,255,0.09)] bg-[#2b333b] p-6 sm:max-w-[520px] max-h-[88vh] overflow-y-auto">
        <style>{OSDLG_CSS}</style>

        <div className="mhead">
          <span className="mico bug">
            <Bug />
          </span>
          <div className="mtt">
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
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
