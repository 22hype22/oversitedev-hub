import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * The Support view: a conversation with Oversite's assistant, laid out like
 * a chat app. Your messages sit on the right in a bubble; the assistant's
 * answers read as plain text on the left and arrive a few words at a time.
 * The thread is kept in this browser per user, and a New chat clears it.
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

const CSS = `
.osd .sc{display:flex;flex-direction:column;height:calc(100vh - 150px);min-height:520px;max-height:900px;border:1px solid rgba(168,180,191,.14);border-radius:18px;background:linear-gradient(180deg,rgba(46,54,63,.7),rgba(39,46,54,.76));backdrop-filter:blur(12px);overflow:hidden}
.osd .sc .top{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--hair)}
.osd .sc .top .who{display:flex;align-items:center;gap:9px;flex:1;min-width:0}
.osd .sc .top .who b{font-family:var(--disp);font-weight:700;font-size:13.5px;color:var(--heading);letter-spacing:-.01em}
.osd .sc .top .who span{font-size:11.5px;color:var(--faint)}
.osd .sc .mark{height:26px;width:26px;flex:none;border-radius:8px;display:grid;place-items:center;background:var(--accent);color:var(--accentink);font-family:var(--disp);font-weight:800;font-size:12.5px}
.osd .sc .newc{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:9px;border:1px solid var(--hair);background:var(--panel);color:var(--heading);font-family:var(--bodyf);font-weight:600;font-size:12px;cursor:pointer;transition:.15s}
.osd .sc .newc:hover{background:var(--surface2)}
.osd .sc .newc svg{width:13px;height:13px;stroke:currentColor;stroke-width:2;fill:none}
.osd .sc .log{flex:1;min-height:0;overflow-y:auto;padding:22px 0;scroll-behavior:smooth}
.osd .sc .col{width:min(720px,calc(100% - 40px));margin:0 auto;display:flex;flex-direction:column;gap:22px}
.osd .sc .empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:20px;text-align:center}
.osd .sc .empty .mark{height:44px;width:44px;border-radius:13px;font-size:20px}
.osd .sc .empty h3{font-family:var(--disp);font-weight:700;font-size:24px;color:var(--heading);letter-spacing:-.02em;line-height:1.1}
.osd .sc .empty p{font-size:12.5px;color:var(--faint);max-width:420px;line-height:1.5;margin-top:-8px}
.osd .sc .starts{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;max-width:560px}
.osd .sc .start{padding:8px 13px;border-radius:999px;border:1px solid var(--hair);background:var(--panel);color:var(--body);font-family:var(--bodyf);font-size:12.5px;cursor:pointer;transition:.15s}
.osd .sc .start:hover{background:var(--surface2);color:var(--heading);border-color:color-mix(in srgb,var(--accent) 40%,var(--hair))}
.osd .sc .m{display:flex;gap:12px;align-items:flex-start}
.osd .sc .m.me{justify-content:flex-end}
.osd .sc .m.me .bub{max-width:78%;padding:10px 14px;border-radius:16px 16px 4px 16px;background:var(--surface2);color:var(--heading);font-size:13.5px;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}
.osd .sc .m.ai .mark{margin-top:2px}
.osd .sc .m.ai .txt{flex:1;min-width:0;color:var(--body);font-size:13.5px;line-height:1.65;white-space:pre-wrap;overflow-wrap:anywhere;padding-top:3px}
.osd .sc .m.ai .txt.bad{color:var(--bad)}
.osd .sc .cur{display:inline-block;width:7px;height:14px;margin-left:2px;vertical-align:-2px;background:var(--accent);border-radius:2px;animation:sc-blink 1s steps(2,start) infinite}
@keyframes sc-blink{to{visibility:hidden}}
.osd .sc .think{display:inline-flex;gap:4px;padding-top:8px}
.osd .sc .think i{width:6px;height:6px;border-radius:999px;background:var(--faint);animation:sc-dot 1.2s infinite ease-in-out}
.osd .sc .think i:nth-child(2){animation-delay:.15s}.osd .sc .think i:nth-child(3){animation-delay:.3s}
@keyframes sc-dot{0%,80%,100%{opacity:.3;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}
.osd .sc .foot{padding:12px 16px 14px;border-top:1px solid var(--hair);background:rgba(33,39,46,.35)}
.osd .sc .box{width:min(720px,100%);margin:0 auto;display:flex;align-items:flex-end;gap:8px;padding:8px 8px 8px 14px;border-radius:16px;border:1px solid var(--hair);background:var(--panel);transition:border-color .15s}
.osd .sc .box:focus-within{border-color:color-mix(in srgb,var(--accent) 45%,var(--hair))}
.osd .sc textarea{flex:1;min-width:0;resize:none;border:0;outline:0;background:transparent;color:var(--heading);font-family:var(--bodyf);font-size:13.5px;line-height:1.5;padding:6px 0;max-height:160px}
.osd .sc textarea::placeholder{color:var(--faint)}
.osd .sc .send{flex:none;height:34px;width:34px;border-radius:10px;border:0;background:var(--accent);color:var(--accentink);display:grid;place-items:center;cursor:pointer;transition:.15s}
.osd .sc .send:disabled{opacity:.35;cursor:default}
.osd .sc .send svg{width:16px;height:16px;stroke:currentColor;stroke-width:2.2;fill:none}
.osd .sc .send.stop svg{fill:currentColor;stroke:none;width:12px;height:12px}
.osd .sc .hint{width:min(720px,100%);margin:9px auto 0;text-align:center;font-size:11.5px;color:var(--faint)}
.osd .sc .hint a{color:var(--accent);text-decoration:none}
.osd .sc .hint a:hover{text-decoration:underline}
@media (max-width:640px){.osd .sc{height:calc(100vh - 120px)}.osd .sc .m.me .bub{max-width:92%}.osd .sc .top .who span{display:none}}
@media (prefers-reduced-motion:reduce){.osd .sc .cur,.osd .sc .think i{animation:none}}
`;

const uid = () => Math.random().toString(36).slice(2, 10);
const storeKey = (userId: string) => `os_support_chat:${userId}`;

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
  const logRef = useRef<HTMLDivElement>(null);
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
    const el = logRef.current;
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
        patch((m) => (m.content ? m : { ...m, content: "I did not get an answer back. Try again, or email " + SUPPORT_EMAIL + ".", failed: true }));
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

  const last = msgs[msgs.length - 1];

  return (
    <div className="sc">
      <style>{CSS}</style>
      <div className="top">
        <div className="who">
          <span className="mark">O</span>
          <b>Oversite assistant</b>
          <span>Answers about your bots, billing, and the dashboard</span>
        </div>
        {msgs.length > 0 && (
          <button type="button" className="newc" onClick={reset}>
            <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
            New chat
          </button>
        )}
      </div>

      {msgs.length === 0 ? (
        <div className="empty">
          <span className="mark">O</span>
          <h3>How can we help?</h3>
          <p>Ask about setup, billing, refunds, paying in Robux, or anything in the dashboard.</p>
          <div className="starts">
            {STARTERS.map((s) => (
              <button type="button" className="start" key={s} onClick={() => void send(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="log" ref={logRef}>
          <div className="col">
            {msgs.map((m) => {
              const streaming = busy && m.id === last?.id && m.role === "assistant";
              return m.role === "user" ? (
                <div className="m me" key={m.id}>
                  <div className="bub">{m.content}</div>
                </div>
              ) : (
                <div className="m ai" key={m.id}>
                  <span className="mark">O</span>
                  {streaming && !m.content ? (
                    <span className="think" aria-label="Thinking"><i /><i /><i /></span>
                  ) : (
                    <div className={"txt" + (m.failed ? " bad" : "")}>
                      {m.content}
                      {streaming && <span className="cur" aria-hidden />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="foot">
        <div className="box">
          <textarea
            ref={taRef}
            rows={1}
            value={draft}
            placeholder="Ask anything about Oversite"
            onChange={(e) => {
              setDraft(e.target.value);
              grow();
            }}
            onKeyDown={onKey}
            aria-label="Message"
          />
          {busy ? (
            <button type="button" className="send stop" aria-label="Stop" onClick={() => abortRef.current?.abort()}>
              <svg viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="3" /></svg>
            </button>
          ) : (
            <button type="button" className="send" aria-label="Send" disabled={!draft.trim()} onClick={() => void send(draft)}>
              <svg viewBox="0 0 24 24"><path d="M12 19V5m0 0-6 6m6-6 6 6" /></svg>
            </button>
          )}
        </div>
        <div className="hint">
          AI answers from what Oversite knows, so double check anything important. Need a person? Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> or join the{" "}
          <a href="https://discord.gg/oversite" target="_blank" rel="noreferrer">Discord</a>.
        </div>
      </div>
    </div>
  );
}
