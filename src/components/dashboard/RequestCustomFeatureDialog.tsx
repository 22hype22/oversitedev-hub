import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Paperclip, X, Sparkles } from "lucide-react";

const SUPPORT_BOT_ID = "a6be529f-a7f3-4a58-84c5-bcac5dbc97df";
const TARGET_CHANNEL_ID = "1503905197695569950";
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp"];

type Priority = "Low" | "Normal" | "Urgent";
const PRIORITIES: Priority[] = ["Low", "Normal", "Urgent"];

const PRIORITY_COLORS: Record<Priority, number> = {
  Low: 0x10b981,
  Normal: 0x3b82f6,
  Urgent: 0xef4444,
};

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
.osdlg .ta{resize:vertical;min-height:100px;line-height:1.5;font-family:inherit}
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
}

export const RequestCustomFeatureDialog = ({ open, onOpenChange }: Props) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("Normal");
  const [discordUsername, setDiscordUsername] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setTitle("");
    setDescription("");
    setPriority("Normal");
    setDiscordUsername("");
    setProofFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    if (f && f.size > MAX_FILE_BYTES) {
      toast.error("File is too large (max 10 MB).");
      e.target.value = "";
      return;
    }
    setProofFile(f);
  };

  const handleSubmit = async () => {
    if (!title.trim()) return toast.error("Please enter a feature title.");
    if (!description.trim()) return toast.error("Please enter a description.");
    if (!discordUsername.trim()) return toast.error("Please enter your Discord username.");

    setSubmitting(true);
    try {
      let proofUrl: string | null = null;
      let proofIsImage = false;

      if (proofFile) {
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userData?.user) throw new Error("You must be signed in to upload a file.");
        const userId = userData.user.id;
        const ext = proofFile.name.split(".").pop()?.toLowerCase() || "bin";
        const path = `${userId}/feature-requests/${Date.now()}-${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("bot-assets")
          .upload(path, proofFile, { upsert: false, contentType: proofFile.type });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("bot-assets").getPublicUrl(path);
        proofUrl = pub.publicUrl;
        proofIsImage = IMAGE_EXTS.includes(ext);
      }

      const fields: Array<{ name: string; value: string; inline?: boolean }> = [
        { name: "Priority", value: priority, inline: true },
        { name: "Requested by", value: discordUsername.trim(), inline: true },
      ];
      if (proofUrl && !proofIsImage) {
        fields.push({ name: "Proof", value: `[${proofFile!.name}](${proofUrl})` });
      }

      const payload = {
        channel_id: TARGET_CHANNEL_ID,
        content: null,
        embeds: [
          {
            title: `New Custom Feature Request: ${title.trim()}`,
            description: description.trim(),
            color: PRIORITY_COLORS[priority],
            fields,
            image_url: proofUrl && proofIsImage ? proofUrl : null,
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
      <DialogContent className="osdlg gap-0 border-[rgba(255,255,255,0.09)] bg-[#2b333b] p-6 sm:max-w-[520px] max-h-[88vh] overflow-y-auto">
        <style>{OSDLG_CSS}</style>

        <div className="mhead">
          <span className="mico acc">
            <Sparkles />
          </span>
          <div className="mtt">
            <DialogTitle>Request a custom feature</DialogTitle>
            <DialogDescription>
              Tell us what you'd like built and how it should work. Our team scopes it and follows up.
            </DialogDescription>
          </div>
        </div>

        <div className="mbody">
          <div className="mrow">
            <label className="lbl" htmlFor="cf-title">Feature title</label>
            <input
              id="cf-title"
              className="inp"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Auto-DM new server members"
              maxLength={120}
              disabled={submitting}
            />
          </div>

          <div className="mrow">
            <label className="lbl" htmlFor="cf-desc">Description</label>
            <textarea
              id="cf-desc"
              className="ta"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what you want, when it should trigger, and any edge cases."
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
              <label className="lbl" htmlFor="cf-username">Discord username</label>
              <input
                id="cf-username"
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
                <span>Screenshots, PDFs, or logs · max 10 MB</span>
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
              id="cf-proof"
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
            Submit request
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
