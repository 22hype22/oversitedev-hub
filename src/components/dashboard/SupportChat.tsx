import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUp, ArrowUpRight, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * The Support view: a conversation with Oversite's assistant, set like a
 * document rather than a messaging app. Your question is the heading of
 * each exchange, the answer runs underneath as plain text arriving a few
 * words at a time, and exchanges are separated by a single hairline.
 * The thread is kept in this browser per user, and New chat clears it.
 *
 * Rendered inside the `.osd` shell so the dashboard's own variables apply.
 */
type Msg = { id: string; role: "user" | "assistant"; content: string; failed?: boolean };

const SUPPORT_EMAIL = "support@oversite.shop";
const STARTERS = [
  "How do I invite my bot to my server?",
  "Can I pay with Robux?",
  "How do refunds work?",
  "What happens when I cancel?",
];

const EASE = "cubic-bezier(.16,1,.3,1)";
const CSS = `
.osd .sc{display:flex;flex-direction:column;height:calc(100dvh - 150px);min-height:540px;max-height:960px;border:1px solid rgba(168,180,191,.14);border-radius:18px;background:linear-gradient(180deg,rgba(46,54,63,.7),rgba(39,46,54,.76));overflow:hidden}
.osd .sc .top{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:16px 26px 14px;border-bottom:1px solid var(--hair)}
.osd .sc .top .t{font-family:var(--disp);font-weight:700;font-size:14px;color:var(--heading);letter-spacing:-.01em}
.osd .sc .top .t small{margin-left:10px;font-family:var(--bodyf);font-weight:500;font-size:12px;color:var(--faint);letter-spacing:0}
.osd .sc .lnk{border:0;background:transparent;padding:0;color:var(--faint);font-family:var(--bodyf);font-weight:600;font-size:12px;cursor:pointer;transition:color .2s ${EASE}}
.osd .sc .lnk:hover{color:var(--heading)}
.osd .sc .lnk:focus-visible,.osd .sc .start:focus-visible,.osd .sc .send:focus-visible{outline:2px solid color-mix(in srgb,var(--accent) 60%,transparent);outline-offset:2px;border-radius:6px}
.osd .sc .body{flex:1;min-height:0;overflow-y:auto;padding:30px 26px 22px}
.osd .sc .col{max-width:64ch}
.osd .sc .empty h3{font-family:var(--disp);font-weight:700;font-size:26px;line-height:1.05;letter-spacing:-.025em;color:var(--heading);text-wrap:balance}
.osd .sc .empty p{margin-top:10px;font-size:13.5px;line-height:1.6;color:var(--faint);max-width:44ch}
.osd .sc .starts{margin-top:26px;border-top:1px solid var(--hair)}
.osd .sc .start{display:flex;align-items:center;justify-content:space-between;gap:16px;width:100%;padding:13px 0;border:0;border-bottom:1px solid var(--hair);background:transparent;color:var(--body);font-family:var(--bodyf);font-weight:500;font-size:13.5px;text-align:left;cursor:pointer;transition:color .25s ${EASE},padding-left .35s ${EASE}}
.osd .sc .start svg{width:14px;height:14px;flex:none;color:var(--faint);transition:transform .35s ${EASE},color .25s ${EASE}}
.osd .sc .start:hover{color:var(--heading);padding-left:6px}
.osd .sc .start:hover svg{color:var(--heading);transform:translate(2px,-2px)}
.osd .sc .start:active{transform:scale(.995)}
.osd .sc .ex{padding:0 0 26px;margin-bottom:26px;border-bottom:1px solid var(--hair);animation:sc-in .55s ${EASE} both}
.osd .sc .ex:last-child{border-bottom:0;margin-bottom:0;padding-bottom:6px}
@keyframes sc-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.osd .sc .q{font-family:var(--disp);font-weight:700;font-size:17px;line-height:1.3;letter-spacing:-.015em;color:var(--heading);white-space:pre-wrap;overflow-wrap:anywhere;text-wrap:pretty}
.osd .sc .a{margin-top:12px;font-size:13.5px;line-height:1.7;color:var(--body);white-space:pre-wrap;overflow-wrap:anywhere;text-wrap:pretty}
.osd .sc .a.bad{color:var(--bad)}
.osd .sc .a a{color:var(--heading);text-decoration:underline;text-underline-offset:3px;text-decoration-color:color-mix(in srgb,var(--heading) 35%,transparent)}
.osd .sc .wait{margin-top:16px;display:grid;gap:9px;max-width:56ch}
.osd .sc .wait i{display:block;height:10px;border-radius:5px;background:linear-gradient(90deg,var(--surface) 0%,var(--surface2) 45%,var(--surface) 90%);background-size:220% 100%;animation:sc-sheen 1.6s ${EASE} infinite}
.osd .sc .wait i:nth-child(2){width:82%;animation-delay:.12s}.osd .sc .wait i:nth-child(3){width:58%;animation-delay:.24s}
@keyframes sc-sheen{from{background-position:120% 0}to{background-position:-100% 0}}
.osd .sc .foot{padding:14px 26px 16px;border-top:1px solid var(--hair)}
.osd .sc .tray{max-width:64ch;padding:5px;border-radius:14px;background:rgba(33,39,46,.55);border:1px solid rgba(168,180,191,.1)}
.osd .sc .field{display:flex;align-items:flex-end;gap:8px;padding:6px 6px 6px 14px;border-radius:10px;background:var(--panel);box-shadow:inset 0 1px 0 rgba(255,255,255,.04);border:1px solid transparent;transition:border-color .3s ${EASE}}
.osd .sc .tray:focus-within .field{border-color:color-mix(in srgb,var(--accent) 40%,transparent)}
.osd .sc textarea{flex:1;min-width:0;resize:none;border:0;outline:0;background:transparent;color:var(--heading);font-family:var(--bodyf);font-size:13.5px;line-height:1.5;padding:7px 0;max-height:160px}
.osd .sc textarea::placeholder{color:var(--faint)}
.osd .sc .send{flex:none;height:32px;width:32px;border-radius:8px;border:0;background:var(--accent);color:var(--accentink);display:grid;place-items:center;cursor:pointer;transition:transform .3s ${EASE},opacity .3s ${EASE},background .3s ${EASE}}
.osd .sc .send svg{width:15px;height:15px}
.osd .sc .send:hover{transform:translateY(-1px)}
.osd .sc .send:active{transform:scale(.96)}
.osd .sc .send:disabled{opacity:.3;cursor:default;transform:none}
.osd .sc .send.stop{background:var(--surface2);color:var(--heading)}
.osd .sc .send.stop svg{width:11px;height:11px;fill:currentColor}
.osd .sc .note{max-width:64ch;margin-top:10px;font-size:11.5px;line-height:1.5;color:var(--faint)}
.osd .sc .note a{color:var(--body);text-decoration:none;border-bottom:1px solid var(--hair);transition:color .2s ${EASE},border-color .2s ${EASE}}
.osd .sc .note a:hover{color:var(--heading);border-color:var(--heading)}
@media (max-width:640px){.osd .sc{height:calc(100dvh - 120px)}.osd .sc .top,.osd .sc .body,.osd .sc .foot{padding-left:16px;padding-right:16px}.osd .sc .top .t small{display:none}}
@media (prefers-reduced-motion:reduce){.osd .sc .ex{animation:none}.osd .sc .wait i{animation:none;background:var(--surface)}.osd .sc *{transition:none!important}}
`;

const uid = () => Math.random().toString(36).slice(2, 10);
const storeKey = (userId: string) => `os_support_chat:${userId}`;
const EMAIL_RE = /(support@oversite\.shop)/g;

// Makes the support address clickable inside an answer; everything else is
// plain text, exactly as the assistant wrote it.
function Answer({ text }: { text: string }) {
  const parts = text.split(EMAIL_RE);
  return (
    <>
      {parts.map((p, i) =>
        p === SUPPORT_EMAIL ? (
          <a key={i} href={`mailto:${SUPPORT_EMAIL}`}>{p}</a>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export function SupportChat({ userId }: { userId: string }) {
  const [msgs, setMsgs] = useState<Msg[]>(() => {
    try {
      const raw = localStorage.getItem(storeKey(userId));
      const parsed = raw ? (JSON.parse(raw) as Msg[]) : [];
      return Array.isArray(parsed) ? parsed.filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string") : [];
    } catch {
      return [];
    }
  });
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(storeKey(userId), JSON.stringify(msgs.slice(-60)));
    } catch {
      /* private mode */
    }
  }, [msgs, userId]);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, busy]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const grow = () => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(160, ta.scrollHeight) + "px";
  };

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || busy) return;
      const mine: Msg = { id: uid(), role: "user", content };
      const reply: Msg = { id: uid(), role: "assistant", content: "" };
      const history = [...msgs.filter((m) => !m.failed && m.content), mine];
      setMsgs([...history, reply]);
      setDraft("");
      requestAnimationFrame(grow);
      setBusy(true);
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const patch = (fn: (m: Msg) => Msg) => setMsgs((cur) => cur.map((m) => (m.id === reply.id ? fn(m) : m)));
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error("Sign in to chat");
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support-chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })) }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          let msg = "The assistant is not available right now.";
          try {
            const j = await res.json();
            if (j?.error) msg = String(j.error);
          } catch {
            /* not json */
          }
          throw new Error(msg);
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        let done = false;
        while (!done) {
          const chunk = await reader.read();
          done = chunk.done;
          buf += dec.decode(chunk.value ?? new Uint8Array(), { stream: !done });
          const parts = buf.split("\n\n");
          buf = parts.pop() ?? "";
          for (const part of parts) {
            const line = part.split("\n").find((l) => l.startsWith("data:"));
            if (!line) continue;
            const payload = line.slice(5).trim();
            if (payload === "[DONE]") {
              done = true;
              break;
            }
            try {
              const ev = JSON.parse(payload) as { text?: string; error?: string };
              if (ev.text) patch((m) => ({ ...m, content: m.content + ev.text }));
              if (ev.error) throw new Error(ev.error);
            } catch (e) {
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }
        patch((m) => (m.content ? m : { ...m, content: "No answer came back. Try again, or email " + SUPPORT_EMAIL + ".", failed: true }));
      } catch (e) {
        if ((e as Error)?.name === "AbortError") {
          patch((m) => (m.content ? m : { ...m, content: "Stopped.", failed: true }));
        } else {
          patch((m) => ({ ...m, content: (e as Error)?.message || "Something went wrong.", failed: true }));
        }
      } finally {
        abortRef.current = null;
        setBusy(false);
      }
    },
    [busy, msgs],
  );

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(draft);
    }
  };

  const reset = () => {
    abortRef.current?.abort();
    setMsgs([]);
    setDraft("");
    requestAnimationFrame(() => taRef.current?.focus());
  };

  // Group the flat list into question and answer pairs for the transcript.
  const exchanges: { q: Msg; a?: Msg }[] = [];
  for (const m of msgs) {
    if (m.role === "user") exchanges.push({ q: m });
    else if (exchanges.length) exchanges[exchanges.length - 1].a = m;
  }
  const lastId = msgs[msgs.length - 1]?.id;

  return (
    <section className="sc" aria-label="Support">
      <style>{CSS}</style>
      <div className="top">
        <div className="t">
          Support<small>Answered by Oversite's assistant</small>
        </div>
        {msgs.length > 0 && (
          <button type="button" className="lnk" onClick={reset}>
            New chat
          </button>
        )}
      </div>

      <div className="body" ref={bodyRef}>
        <div className="col">
          {msgs.length === 0 ? (
            <div className="empty">
              <h3>What do you need help with?</h3>
              <p>Setup, billing, refunds, paying in Robux, or anything in the dashboard. Ask in your own words.</p>
              <div className="starts">
                {STARTERS.map((s) => (
                  <button type="button" className="start" key={s} onClick={() => void send(s)}>
                    {s}
                    <ArrowUpRight strokeWidth={1.75} aria-hidden />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            exchanges.map(({ q, a }) => {
              const streaming = busy && a?.id === lastId;
              return (
                <article className="ex" key={q.id}>
                  <h4 className="q">{q.content}</h4>
                  {a && (streaming && !a.content ? (
                    <div className="wait" aria-label="Writing an answer"><i /><i /><i /></div>
                  ) : (
                    <p className={"a" + (a.failed ? " bad" : "")}><Answer text={a.content} /></p>
                  ))}
                </article>
              );
            })
          )}
        </div>
      </div>

      <div className="foot">
        <div className="tray">
          <div className="field">
            <textarea
              ref={taRef}
              rows={1}
              value={draft}
              placeholder="Ask a question"
              onChange={(e) => {
                setDraft(e.target.value);
                grow();
              }}
              onKeyDown={onKey}
              aria-label="Your question"
            />
            {busy ? (
              <button type="button" className="send stop" aria-label="Stop" onClick={() => abortRef.current?.abort()}>
                <Square strokeWidth={0} aria-hidden />
              </button>
            ) : (
              <button type="button" className="send" aria-label="Send" disabled={!draft.trim()} onClick={() => void send(draft)}>
                <ArrowUp strokeWidth={2.25} aria-hidden />
              </button>
            )}
          </div>
        </div>
        <p className="note">
          Answers come from an AI, so check anything that matters. For account changes or a person, email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> or join the{" "}
          <a href="https://discord.gg/ovs" target="_blank" rel="noreferrer">Discord</a>.
        </p>
      </div>
    </section>
  );
}
