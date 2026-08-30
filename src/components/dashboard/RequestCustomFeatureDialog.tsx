import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Paperclip, X, ArrowRight } from "lucide-react";
import { isBlockedFileType, resolveContentType } from "@/lib/uploadValidation";
import { OS_DIALOG_CSS } from "./osDialogTheme";

const SUPPORT_BOT_ID = "a6be529f-a7f3-4a58-84c5-bcac5dbc97df";
// Always deliver submissions through the Oversite Network bot (Discord id
// 1507024469192081598 → this dashboard/order id). Hardcoded on purpose.
const POSTER_BOT_ID = "50927258-eb0f-4756-88d0-e7396aaab220";
const TARGET_CHANNEL_ID = "1503905197695569950";
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The bot that posts the request. Must be a bot the signer owns — the shared
   *  SUPPORT_BOT_ID is not a real bot_order, so posting through it fails with
   *  "Bot not found." Falls back to it only when no real bot is available. */
  botId?: string;
}

export const RequestCustomFeatureDialog = ({ open, onOpenChange }: Props) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setTitle("");
    setDescription("");
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
    if (!title.trim()) return toast.error("Please enter a feature title.");
    if (!description.trim()) return toast.error("Please enter a description.");

    setSubmitting(true);
    try {
      // Owner's global config (from the hidden Extras cog) sets the channel +
      // designed message; fall back to the shared support channel.
      // Always post through the Oversite Network bot.
      const targetBotId = POSTER_BOT_ID;
      let targetChannel = TARGET_CHANNEL_ID;
      let design: any[] | null = null;
      const { data: globalRow } = await (supabase as any)
        .from("platform_settings")
        .select("value")
        .eq("key", "extras-customfeature")
        .maybeSingle();
      const gcfg = (globalRow?.value ?? {}) as Record<string, any>;
      if (gcfg.channel_id) {
        targetChannel = String(gcfg.channel_id);
        design = Array.isArray(gcfg.components) && gcfg.components.length ? gcfg.components : null;
      }

      // Identify the submitter automatically (no username field to fill).
      // Use their nickname (Discord username / handle) or the email they
      // signed up with — never their real name (full_name / name).
      const { data: userData } = await supabase.auth.getUser();
      const authUser = userData?.user;
      const userName =
        (authUser?.user_metadata?.user_name as string) ||
        (authUser?.user_metadata?.preferred_username as string) ||
        (authUser?.user_metadata?.nickname as string) ||
        authUser?.email ||
        "Unknown";

      let proofUrl: string | null = null;
      let proofIsImage = false;

      if (proofFile) {
        if (!authUser) throw new Error("You must be signed in to upload a file.");
        const ext = proofFile.name.split(".").pop()?.toLowerCase() || "bin";
        const path = `${authUser.id}/feature-requests/${Date.now()}-${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("bot-assets")
          .upload(path, proofFile, { upsert: false, contentType: resolveContentType(proofFile) });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("bot-assets").getPublicUrl(path);
        proofUrl = pub.publicUrl;
        proofIsImage = IMAGE_EXTS.includes(ext);
      }

      const exampleValue = proofUrl
        ? proofIsImage
          ? proofUrl
          : `[${proofFile!.name}](${proofUrl})`
        : "—";

      // Tokens the owner can use in a designed message via the Extras cog.
      const map: Record<string, string> = {
        user: userName,
        title: title.trim(),
        description: description.trim(),
        example: exampleValue,
        proof: exampleValue,
      };

      let components_v2: any[];
      if (design) {
        // Escape a value so it drops safely inside a JSON string literal.
        const jesc = (v: string) => JSON.stringify(String(v)).slice(1, -1);
        let raw = JSON.stringify(design);

        // 1) Simple tokens: {user} {title} {description} {example} {proof}.
        for (const [k, v] of Object.entries(map)) {
          raw = raw.split(`{${k}}`).join(jesc(v));
        }

        // 2) Prompt-engine tokens the server builder uses, e.g.
        //    {Question: Feature Title:}  {long question: Description:}  {File: Example:}
        //    {drop down: …}  {user}. Match by label so title/description land in
        //    the right slot; text questions fall back to document order.
        const textQueue = [title.trim(), description.trim()];
        const PF_RE = /\{\s*(user|long\s*question|question|drop\s*down|dropdown|select|file)\s*\d*\s*(?::\s*([^{}]*?))?\s*\}/gi;
        raw = raw.replace(PF_RE, (_m, kindRaw: string, labelRaw?: string) => {
          const kind = kindRaw.toLowerCase().replace(/\s+/g, " ");
          if (kind === "user") return jesc(userName);
          if (kind === "file") return jesc(exampleValue);
          if (kind === "drop down" || kind === "dropdown" || kind === "select") return "";
          // question / long question → answer by label, else next in order
          const label = String(labelRaw || "").replace(/[*_`]/g, "").replace(/:/g, "").trim().toLowerCase();
          if (label.includes("title") || label.includes("feature")) return jesc(title.trim());
          if (label.includes("desc")) return jesc(description.trim());
          if (label.includes("example") || label.includes("proof")) return jesc(exampleValue);
          return jesc(textQueue.shift() ?? "");
        });

        components_v2 = JSON.parse(raw);
      } else {
        // Default layout — clean Components V2 card matching the requested format.
        const text =
          `## Oversite Customs | Custom Feature\n` +
          `**User:** ${userName}\n` +
          `**Feature Title:** ${title.trim()}\n` +
          `**Description:** ${description.trim()}\n` +
          `**Example:** ${exampleValue}`;
        components_v2 = [{ type: "container", children: [{ type: "text", text }] }];
      }

      const payload: Record<string, any> = {
        channel_id: targetChannel,
        components_v2,
        images: proofUrl && proofIsImage ? [proofUrl] : [],
      };

      const { data, error } = await supabase.rpc("enqueue_post_message", {
        _bot_id: targetBotId,
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
      <DialogContent
        overlayClassName="bg-black/35 backdrop-blur-[2px]"
        className="osdlg gap-0 overflow-hidden rounded-[18px] border-[rgba(201,219,230,0.14)] bg-[#2b333b] p-0 sm:max-w-[500px]"
      >
        <style>{OS_DIALOG_CSS}</style>

        <div className="oscontent">
        <div className="mhead">
          <div className="mtt">
            <div className="eyebrow">Custom build</div>
            <DialogTitle>Custom feature</DialogTitle>
            <DialogDescription>
              Tell us what you'd like built and attach an example if you have one.
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

          <div className="mrow">
            <label className="lbl">
              Example <span className="opt">optional</span>
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
                <b>{proofFile ? "Replace file" : "Attach an example"}</b>
                <span>An image, mockup, or reference · max 10 MB</span>
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
            {!submitting && <ArrowRight className="arw" size={15} />}
          </button>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
