import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUp, ArrowUpRight, Plus, Square, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * The Support view: conversations with Oversite's assistant. Past chats
 * run down the left; the open one fills the right, your messages in a
 * soft bubble on the right edge and the answers on the left as plain text,
 * arriving a few words at a time. Chats are kept in this browser per user.
 *
 * Rendered inside the `.osd` shell so the dashboard's own variables apply.
 */
type Msg = { id: string; role: "user" | "assistant"; content: string; failed?: boolean };
type Thread = { id: string; title: string; createdAt: number; updatedAt: number; msgs: Msg[] };

const SUPPORT_EMAIL = "support@oversite.shop";
const STARTERS = [
  "How do I invite my bot to my server?",
  "Can I pay with Robux?",
  "How do refunds work?",
  "What happens when I cancel?",
];
const MAX_THREADS = 40;
const MAX_MSGS = 60;

const EASE = "cubic-bezier(.16,1,.3,1)";
const CSS = `
.osd .sc{display:grid;grid-template-columns:232px minmax(0,1fr);height:calc(100dvh - 150px);min-height:540px;max-height:960px;border:1px solid rgba(168,180,191,.14);border-radius:18px;background:linear-gradient(180deg,rgba(46,54,63,.7),rgba(39,46,54,.76));overflow:hidden}
.osd .sc .chats{display:flex;flex-direction:column;min-height:0;border-right:1px solid var(--hair);background:rgba(33,39,46,.35)}
.osd .sc .chats .hd{padding:14px 14px 10px}
.osd .sc .newc{display:flex;align-items:center;justify-content:space-between;width:100%;padding:9px 10px 9px 12px;border-radius:10px;border:1px solid var(--hair);background:var(--panel);color:var(--heading);font-family:var(--bodyf);font-weight:600;font-size:12.5px;cursor:pointer;transition:background .3s ${EASE},border-color .3s ${EASE},transform .3s ${EASE}}
.osd .sc .newc svg{width:14px;height:14px;color:var(--faint);transition:color .3s ${EASE}}
.osd .sc .newc:hover{background:var(--surface);border-color:color-mix(in srgb,var(--accent) 30%,var(--hair))}
.osd .sc .newc:hover svg{color:var(--heading)}
.osd .sc .newc:active{transform:scale(.985)}
.osd .sc .list{flex:1;min-height:0;overflow-y:auto;padding:0 8px 12px}
.osd .sc .grp{padding:12px 8px 6px;font-family:var(--bodyf);font-weight:600;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--faint)}
.osd .sc .th{position:relative;display:flex;align-items:center;width:100%;padding:8px 30px 8px 10px;border:0;border-radius:9px;background:transparent;color:var(--body);font-family:var(--bodyf);font-weight:500;font-size:12.5px;line-height:1.35;text-align:left;cursor:pointer;transition:background .25s ${EASE},color .25s ${EASE}}
.osd .sc .th span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.osd .sc .th:hover{background:var(--surface);color:var(--heading)}
.osd .sc .th.on{background:var(--surface2);color:var(--heading)}
.osd .sc .th .rm{position:absolute;right:6px;top:50%;transform:translateY(-50%);height:20px;width:20px;border-radius:6px;border:0;background:transparent;color:var(--faint);display:grid;place-items:center;padding:0;opacity:0;cursor:pointer;transition:opacity .2s ${EASE},background .2s ${EASE},color .2s ${EASE}}
.osd .sc .th:hover .rm,.osd .sc .th.on .rm,.osd .sc .th:focus-within .rm{opacity:1}
.osd .sc .th .rm:hover{background:var(--panel);color:var(--heading)}
.osd .sc .th .rm svg{width:11px;height:11px}
.osd .sc .none{padding:14px 10px;font-size:12px;line-height:1.5;color:var(--faint)}
.osd .sc .conv{display:flex;flex-direction:column;min-width:0;min-height:0}
.osd .sc .top{display:flex;align-items:baseline;gap:10px;padding:16px 26px 14px;border-bottom:1px solid var(--hair)}
.osd .sc .top .t{font-family:var(--disp);font-weight:700;font-size:14px;color:var(--heading);letter-spacing:-.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.osd .sc .top small{flex:none;font-family:var(--bodyf);font-weight:500;font-size:12px;color:var(--faint)}
.osd .sc .start:focus-visible,.osd .sc .send:focus-visible,.osd .sc .th:focus-visible,.osd .sc .newc:focus-visible{outline:2px solid color-mix(in srgb,var(--accent) 60%,transparent);outline-offset:2px}
.osd .sc .body{flex:1;min-height:0;overflow-y:auto;padding:30px 26px 22px}
.osd .sc .empty{max-width:64ch}
.osd .sc .empty h3{font-family:var(--disp);font-weight:700;font-size:26px;line-height:1.05;letter-spacing:-.025em;color:var(--heading);text-wrap:balance}
.osd .sc .empty p{margin-top:10px;font-size:13.5px;line-height:1.6;color:var(--faint);max-width:44ch}
.osd .sc .starts{margin-top:26px;border-top:1px solid var(--hair)}
.osd .sc .start{display:flex;align-items:center;justify-content:space-between;gap:16px;width:100%;padding:13px 0;border:0;border-bottom:1px solid var(--hair);background:transparent;color:var(--body);font-family:var(--bodyf);font-weight:500;font-size:13.5px;text-align:left;cursor:pointer;transition:color .25s ${EASE},padding-left .35s ${EASE}}
.osd .sc .start svg{width:14px;height:14px;flex:none;color:var(--faint);transition:transform .35s ${EASE},color .25s ${EASE}}
.osd .sc .start:hover{color:var(--heading);padding-left:6px}
.osd .sc .start:hover svg{color:var(--heading);transform:translate(2px,-2px)}
.osd .sc .start:active{transform:scale(.995)}
.osd .sc .m{display:flex;margin-bottom:22px;animation:sc-in .55s ${EASE} both}
.osd .sc .m:last-child{margin-bottom:6px}
.osd .sc .m.me{justify-content:flex-end}
.osd .sc .m.me + .m.me{margin-top:-12px}
@keyframes sc-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.osd .sc .q{max-width:min(72%,52ch);padding:10px 15px;border-radius:14px 14px 4px 14px;background:var(--surface2);box-shadow:inset 0 1px 0 rgba(255,255,255,.05);font-size:13.5px;line-height:1.55;color:var(--heading);white-space:pre-wrap;overflow-wrap:anywhere;text-wrap:pretty}
.osd .sc .a{max-width:64ch;font-size:13.5px;line-height:1.7;color:var(--body);white-space:pre-wrap;overflow-wrap:anywhere;text-wrap:pretty}
.osd .sc .a.bad{color:var(--bad)}
.osd .sc .a a{color:var(--heading);text-decoration:underline;text-underline-offset:3px;text-decoration-color:color-mix(in srgb,var(--heading) 35%,transparent)}
.osd .sc .wait{margin-top:4px;display:grid;gap:9px;width:min(100%,56ch)}
.osd .sc .wait i{display:block;height:10px;border-radius:5px;background:linear-gradient(90deg,var(--surface) 0%,var(--surface2) 45%,var(--surface) 90%);background-size:220% 100%;animation:sc-sheen 1.6s ${EASE} infinite}
.osd .sc .wait i:nth-child(2){width:82%;animation-delay:.12s}.osd .sc .wait i:nth-child(3){width:58%;animation-delay:.24s}
@keyframes sc-sheen{from{background-position:120% 0}to{background-position:-100% 0}}
.osd .sc .foot{padding:14px 26px 16px;border-top:1px solid var(--hair)}
.osd .sc .tray{padding:5px;border-radius:14px;background:rgba(33,39,46,.55);border:1px solid rgba(168,180,191,.1)}
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
.osd .sc .note{margin-top:10px;font-size:11.5px;line-height:1.5;color:var(--faint)}
.osd .sc .note a{color:var(--body);text-decoration:none;border-bottom:1px solid var(--hair);transition:color .2s ${EASE},border-color .2s ${EASE}}
.osd .sc .note a:hover{color:var(--heading);border-color:var(--heading)}
@media (max-width:760px){
  .osd .sc{grid-template-columns:1fr;grid-template-rows:auto minmax(0,1fr);height:calc(100dvh - 120px)}
  .osd .sc .chats{flex-direction:row;align-items:center;gap:6px;border-right:0;border-bottom:1px solid var(--hair);padding:10px 12px}
  .osd .sc .chats .hd{padding:0;flex:none}
  .osd .sc .newc{padding:7px 9px;gap:6px}
  .osd .sc .list{display:flex;gap:6px;padding:0;overflow-x:auto;overflow-y:hidden;scrollbar-width:none}
  .osd .sc .list > div{display:contents}
  .osd .sc .grp,.osd .sc .none{display:none}
  .osd .sc .th{width:auto;flex:none;max-width:46vw;padding:7px 10px;border:1px solid var(--hair);border-radius:999px}
  .osd .sc .th .rm{display:none}
  .osd .sc .top,.osd .sc .body,.osd .sc .foot{padding-left:16px;padding-right:16px}
  .osd .sc .top small{display:none}
  .osd .sc .q{max-width:88%}
}
@media (prefers-reduced-motion:reduce){.osd .sc .m{animation:none}.osd .sc .wait i{animation:none;background:var(--surface)}.osd .sc *{transition:none!important}}
`;

const uid = () => Math.random().toString(36).slice(2, 10);
const storeKey = (userId: string) => `os_support_chats:${userId}`;
const legacyKey = (userId: string) => `os_support_chat:${userId}`;
const EMAIL_RE = /(support@oversite\.shop)/g;
const DAY = 86400000;

const isMsg = (m: any): m is Msg => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string";
const titleOf = (text: string) => {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > 48 ? t.slice(0, 46).trimEnd() + "..." : t;
};

function load(userId: string): Thread[] {
  try {
    const raw = localStorage.getItem(storeKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((t: any) => t && typeof t.id === "string" && Array.isArray(t.msgs))
          .map((t: any) => ({ id: t.id, title: String(t.title ?? "Chat"), createdAt: Number(t.createdAt) || Date.now(), updatedAt: Number(t.updatedAt) || Date.now(), msgs: t.msgs.filter(isMsg) }));
      }
    }
    // A thread saved before chats had a list becomes the first one.
    const old = localStorage.getItem(legacyKey(userId));
    if (old) {
      const msgs = (JSON.parse(old) as any[]).filter(isMsg);
      localStorage.removeItem(legacyKey(userId));
      if (msgs.length) {
        const first = msgs.find((m) => m.role === "user");
        return [{ id: uid(), title: titleOf(first?.content ?? "Chat"), createdAt: Date.now(), updatedAt: Date.now(), msgs }];
      }
    }
  } catch {
    /* nothing saved, or private mode */
  }
  return [];
}

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
  const [threads, setThreads] = useState<Thread[]>(() => load(userId));
  const [activeId, setActiveId] = useState<string | null>(() => threads[0]?.id ?? null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const active = threads.find((t) => t.id === activeId) ?? null;
  const msgs = active?.msgs ?? [];

  useEffect(() => {
    try {
      localStorage.setItem(storeKey(userId), JSON.stringify(threads.slice(0, MAX_THREADS).map((t) => ({ ...t, msgs: t.msgs.slice(-MAX_MSGS) }))));
    } catch {
      /* private mode */
    }
  }, [threads, userId]);

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
      const now = Date.now();
      let threadId = activeId;
      let history: Msg[];
      if (active) {
        history = [...active.msgs.filter((m) => !m.failed && m.content), mine];
        setThreads((cur) => {
          const t = cur.find((x) => x.id === active.id);
          if (!t) return cur;
          const next = { ...t, updatedAt: now, msgs: [...history, reply] };
          return [next, ...cur.filter((x) => x.id !== active.id)];
        });
      } else {
        threadId = uid();
        history = [mine];
        const t: Thread = { id: threadId, title: titleOf(content), createdAt: now, updatedAt: now, msgs: [mine, reply] };
        setThreads((cur) => [t, ...cur]);
        setActiveId(threadId);
      }
      setDraft("");
      requestAnimationFrame(grow);
      setBusy(true);
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const patch = (fn: (m: Msg) => Msg) =>
        setThreads((cur) => cur.map((t) => (t.id === threadId ? { ...t, msgs: t.msgs.map((m) => (m.id === reply.id ? fn(m) : m)) } : t)));
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
    [busy, active, activeId],
  );

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(draft);
    }
  };

  const open = (id: string | null) => {
    abortRef.current?.abort();
    setActiveId(id);
    setDraft("");
    requestAnimationFrame(() => taRef.current?.focus());
  };

  const remove = (id: string) => {
    if (id === activeId) abortRef.current?.abort();
    setThreads((cur) => cur.filter((t) => t.id !== id));
    if (id === activeId) setActiveId(null);
  };

  // Past chats grouped by when they were last used, newest first.
  const groups = useMemo(() => {
    const sorted = [...threads].sort((a, b) => b.updatedAt - a.updatedAt);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = today.getTime();
    const out: { label: string; items: Thread[] }[] = [];
    for (const t of sorted) {
      const label = t.updatedAt >= start ? "Today" : t.updatedAt >= start - DAY ? "Yesterday" : t.updatedAt >= start - 7 * DAY ? "This week" : "Earlier";
      const g = out[out.length - 1];
      if (g && g.label === label) g.items.push(t);
      else out.push({ label, items: [t] });
    }
    return out;
  }, [threads]);

  const lastId = msgs[msgs.length - 1]?.id;

  return (
    <section className="sc" aria-label="Support">
      <style>{CSS}</style>

      <aside className="chats">
        <div className="hd">
          <button type="button" className="newc" onClick={() => open(null)}>
            New chat
            <Plus strokeWidth={2} aria-hidden />
          </button>
        </div>
        <div className="list" aria-label="Past chats">
          {threads.length === 0 && <p className="none">Chats you start show up here.</p>}
          {groups.map((g) => (
            <div key={g.label}>
              <div className="grp">{g.label}</div>
              {g.items.map((t) => (
                <div
                  className={"th" + (t.id === activeId ? " on" : "")}
                  key={t.id}
                  role="button"
                  tabIndex={0}
                  title={t.title}
                  onClick={() => open(t.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      open(t.id);
                    }
                  }}
                >
                  <span>{t.title}</span>
                  <button
                    type="button"
                    className="rm"
                    aria-label="Delete chat"
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(t.id);
                    }}
                  >
                    <X strokeWidth={2} aria-hidden />
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      </aside>

      <div className="conv">
        <div className="top">
          <div className="t">{active ? active.title : "New chat"}</div>
          <small>Answered by Oversite's assistant</small>
        </div>

        <div className="body" ref={bodyRef}>
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
            msgs.map((m) => {
              const streaming = busy && m.id === lastId && m.role === "assistant";
              if (m.role === "user") {
                return (
                  <div className="m me" key={m.id}>
                    <div className="q">{m.content}</div>
                  </div>
                );
              }
              return (
                <div className="m" key={m.id}>
                  {streaming && !m.content ? (
                    <div className="wait" aria-label="Writing an answer"><i /><i /><i /></div>
                  ) : (
                    <p className={"a" + (m.failed ? " bad" : "")}><Answer text={m.content} /></p>
                  )}
                </div>
              );
            })
          )}
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
      </div>
    </section>
  );
}
