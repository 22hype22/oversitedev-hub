import { useEffect, useState } from "react";
import { SiteNav } from "@/components/marketing/SiteNav";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { LifeBuoy, Lightbulb, Loader2, Send, Settings2 } from "lucide-react";
import mountainBg from "@/assets/containers.webp";

const OWNER_EMAIL = "everant00@gmail.com";

type FeedbackType = "support" | "idea";

const SupportIdeas = () => {
  const { user } = useAuth();
  const isOwner = (user?.email ?? "").toLowerCase() === OWNER_EMAIL;

  const [type, setType] = useState<FeedbackType>("support");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!message.trim()) {
      toast.error("Please write a message.");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("feedback-submit", {
        body: {
          type,
          subject: subject.trim(),
          message: message.trim(),
          contact: contact.trim(),
        },
      });
      if (error) {
        // Surface the function's own error message (it's in the response body
        // for non-2xx responses) instead of the generic wrapper text.
        let msg = error.message;
        try {
          const ctx = (error as any).context;
          const body = ctx && typeof ctx.json === "function" ? await ctx.json() : null;
          if (body?.error) msg = body.error;
        } catch {
          /* keep msg */
        }
        throw new Error(msg);
      }
      if (data && (data as any).ok === false) {
        throw new Error((data as any).error ?? "Couldn't send.");
      }
      toast.success(
        type === "support"
          ? "Support request sent — we'll get back to you."
          : "Idea sent — thanks for the suggestion!",
      );
      setSubject("");
      setMessage("");
      setContact("");
    } catch (e: any) {
      toast.error("Couldn't send", { description: e?.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div
        aria-hidden
        className="fixed inset-0 -z-10 bg-cover bg-center"
        style={{ backgroundImage: `url(${mountainBg})` }}
      />
      <div aria-hidden className="fixed inset-0 -z-10 bg-background/65" />
      <SiteNav />
      <main className="flex-1 container mx-auto px-4 pt-28 pb-16 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Support &amp; Ideas</h1>
          <p className="text-muted-foreground mt-2">
            Need a hand, or have an idea to make Oversite better? Pick one and send it
            our way — it lands straight in our Discord.
          </p>
        </div>

        {/* Type picker */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {(
            [
              {
                key: "support" as const,
                icon: <LifeBuoy className="h-5 w-5" />,
                title: "Support",
                desc: "Something's not working or you need help.",
              },
              {
                key: "idea" as const,
                icon: <Lightbulb className="h-5 w-5" />,
                title: "Idea",
                desc: "A feature or improvement you'd love to see.",
              },
            ]
          ).map((o) => {
            const on = type === o.key;
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => setType(o.key)}
                className={
                  "text-left rounded-xl border p-4 transition-colors " +
                  (on
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card/80 hover:border-primary/40")
                }
              >
                <span
                  className={
                    "inline-grid place-items-center h-10 w-10 rounded-lg mb-3 " +
                    (on ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")
                  }
                >
                  {o.icon}
                </span>
                <div className="font-semibold">{o.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{o.desc}</div>
              </button>
            );
          })}
        </div>

        {/* Form */}
        <div className="rounded-xl border border-border bg-card/80 p-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fb-subject">Subject (optional)</Label>
            <Input
              id="fb-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={type === "support" ? "e.g. Can't connect my bot" : "e.g. Add scheduled posts"}
              maxLength={120}
              disabled={sending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fb-message">
              {type === "support" ? "How can we help?" : "What's your idea?"}
            </Label>
            <Textarea
              id="fb-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                type === "support"
                  ? "Describe what's happening and what you expected."
                  : "Tell us what you'd like and why it'd help."
              }
              rows={6}
              maxLength={4000}
              disabled={sending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fb-contact">Your Discord or email (optional)</Label>
            <Input
              id="fb-contact"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="So we can follow up"
              maxLength={120}
              disabled={sending}
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={submit} disabled={sending}>
              {sending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {type === "support" ? "Send request" : "Send idea"}
            </Button>
          </div>
        </div>

        {isOwner && <OwnerSettings />}
      </main>
      <SiteFooter />
    </div>
  );
};

function OwnerSettings() {
  const [support, setSupport] = useState("");
  const [idea, setIdea] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await (supabase as any).rpc("feedback_get_settings");
        if (error) throw error;
        setSupport(data?.support_webhook_url ?? "");
        setIdea(data?.idea_webhook_url ?? "");
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const { data, error } = await (supabase as any).rpc("feedback_set_settings", {
        _support: support.trim(),
        _idea: idea.trim(),
      });
      if (error) throw error;
      if (data && data.ok === false) throw new Error(data.error ?? "Failed");
      toast.success("Channels saved");
    } catch (e: any) {
      toast.error("Couldn't save", { description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-8 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
      <div className="flex items-center gap-2 mb-1">
        <Settings2 className="h-4 w-4 text-amber-400" />
        <h2 className="font-semibold">Owner settings</h2>
        <span className="text-[10px] uppercase tracking-wide text-amber-400 border border-amber-500/40 rounded px-1.5 py-0.5">
          Only you
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Discord webhook URLs submissions post to. In Discord: channel → Edit Channel
        → Integrations → Webhooks → New Webhook → Copy Webhook URL.
      </p>
      {loading ? (
        <div className="text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
          Loading…
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="cfg-support">Support webhook URL</Label>
            <Input
              id="cfg-support"
              value={support}
              onChange={(e) => setSupport(e.target.value)}
              placeholder="https://discord.com/api/webhooks/…"
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cfg-idea">Idea webhook URL</Label>
            <Input
              id="cfg-idea"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="https://discord.com/api/webhooks/…"
              className="font-mono text-xs"
            />
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save channels
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SupportIdeas;
