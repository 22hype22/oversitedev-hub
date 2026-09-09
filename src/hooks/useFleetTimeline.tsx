import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAddonLabel } from "@/lib/botCatalog";

/**
 * The dashboard's Activity feed: one timeline of what the viewer's bots and
 * team have been doing, from several sources, newest first.
 *   uptime      went offline, came back, started, restarted, shut down
 *   settings    a feature's settings applied, status or bio changed
 *   moderation  what the Protection bot watched or flagged
 *   members     members who verified with Roblox
 *   messages    messages the bots posted from the dashboard
 *   team        people invited to or joining the team
 */
export type TimelineKind = "uptime" | "settings" | "moderation" | "members" | "messages" | "team";
export type TimelineItem = {
  id: string;
  at: string;
  kind: TimelineKind;
  title: string;
  meta: string;
  /** Warning tone: offline, failed, flagged. */
  bad?: boolean;
};
export type BotRef = { id: string; name: string };

const DAYS = 30;
const CAP = 200;

const minutesBetween = (a: string, b: string) => Math.max(1, Math.round((Date.parse(b) - Date.parse(a)) / 60000));
const spell = (m: number) => (m < 60 ? `${m} min` : m < 60 * 48 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`);
const humanize = (s: string) => s.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export function useFleetTimeline(userId: string | null | undefined, bots: BotRef[]) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const idsKey = bots.map((b) => b.id).join(",");

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const ids = idsKey ? idsKey.split(",") : [];
    const nameOf = (id: string) => bots.find((b) => b.id === id)?.name ?? "A bot";
    const since = new Date(Date.now() - DAYS * 86400000).toISOString();
    let cancelled = false;
    (async () => {
      const sb = supabase as any;
      const [notes, cmds, watched, prot, team] = await Promise.all([
        sb.from("bot_notifications").select("id, bot_id, event_type, title, body, created_at").eq("user_id", userId).gte("created_at", since).order("created_at", { ascending: true }).limit(2000),
        ids.length ? sb.from("bot_commands").select("id, bot_id, action, status, payload, created_at").in("bot_id", ids).gte("created_at", since).order("created_at", { ascending: false }).limit(400) : Promise.resolve({ data: [] }),
        ids.length ? sb.from("nuke_actions").select("id, bot_id, action_type, created_at").in("bot_id", ids).gte("created_at", since).order("created_at", { ascending: false }).limit(600) : Promise.resolve({ data: [] }),
        ids.length ? sb.from("protection_events").select("id, bot_id, event_type, action_taken, metadata, created_at").in("bot_id", ids).gte("created_at", since).order("created_at", { ascending: false }).limit(200) : Promise.resolve({ data: [] }),
        sb.from("dashboard_team").select("id, member_email, invited_at, accepted_at, bot_id").eq("owner_user_id", userId).order("invited_at", { ascending: false }).limit(100),
      ]);
      if (cancelled) return;
      const out: TimelineItem[] = [];

      // Uptime: pair each offline with the return that follows it, so a
      // flapping bot reads as one line with how long it was gone.
      const downAt = new Map<string, string>();
      for (const n of (notes?.data ?? []) as { id: string; bot_id: string | null; event_type: string; title: string; body: string; created_at: string }[]) {
        const bot = n.bot_id ?? "";
        if (n.event_type === "bot_down") {
          downAt.set(bot, n.created_at);
        } else if (n.event_type === "bot_restored") {
          const d = downAt.get(bot);
          downAt.delete(bot);
          out.push({ id: `n:${n.id}`, at: n.created_at, kind: "uptime", title: `${nameOf(bot)} is back online`, meta: d ? `Was offline for ${spell(minutesBetween(d, n.created_at))}` : "Back after being offline" });
        } else {
          out.push({ id: `n:${n.id}`, at: n.created_at, kind: "settings", title: n.title, meta: n.body });
        }
      }
      for (const [bot, at] of downAt) {
        out.push({ id: `down:${bot}:${at}`, at, kind: "uptime", title: `${nameOf(bot)} went offline`, meta: "Not back yet", bad: true });
      }

      for (const c of (cmds?.data ?? []) as { id: string; bot_id: string; action: string; status: string; payload: any; created_at: string }[]) {
        const p = c.payload ?? {};
        const bot = nameOf(c.bot_id);
        const failed = c.status === "failed";
        const meta = failed ? `Failed on ${bot}${c.status ? "" : ""}` : bot;
        let item: TimelineItem | null = null;
        switch (c.action) {
          case "apply_config":
            item = { id: `c:${c.id}`, at: c.created_at, kind: "settings", title: `${getAddonLabel(String(p.feature ?? ""))} settings applied`, meta };
            break;
          case "roblox_apply":
            item = { id: `c:${c.id}`, at: c.created_at, kind: "members", title: `A member verified as ${String(p.roblox_username ?? "a Roblox user")}`, meta };
            break;
          case "set_status":
            item = { id: `c:${c.id}`, at: c.created_at, kind: "settings", title: `Status set to "${String(p.status_text ?? p.activity_text ?? "")}"`, meta };
            break;
          case "bio_update_request":
            item = { id: `c:${c.id}`, at: c.created_at, kind: "settings", title: "Bio updated", meta };
            break;
          case "post_message":
          case "send_channel_message":
            item = { id: `c:${c.id}`, at: c.created_at, kind: "messages", title: "Message posted to a channel", meta };
            break;
          case "start":
          case "restart":
          case "shutdown":
          case "update":
            item = { id: `c:${c.id}`, at: c.created_at, kind: "uptime", title: `${bot} ${c.action === "start" ? "started" : c.action === "restart" ? "restarted" : c.action === "shutdown" ? "shut down" : "updated"}`, meta: failed ? "The command failed" : "From the dashboard" };
            break;
          case "leave_all_guilds":
            item = { id: `c:${c.id}`, at: c.created_at, kind: "uptime", title: `${bot} left its servers`, meta, bad: true };
            break;
          default:
            item = { id: `c:${c.id}`, at: c.created_at, kind: "settings", title: humanize(c.action), meta };
        }
        if (failed) item.bad = true;
        out.push(item);
      }

      // Moderation: a burst of the same watched action reads as one line.
      const bursts: { bot: string; type: string; count: number; first: string; last: string; id: string }[] = [];
      for (const w of (watched?.data ?? []) as { id: string; bot_id: string; action_type: string; created_at: string }[]) {
        const last = bursts[bursts.length - 1];
        if (last && last.bot === w.bot_id && last.type === w.action_type && Date.parse(last.first) - Date.parse(w.created_at) < 10 * 60000) {
          last.count += 1;
          last.first = w.created_at;
        } else {
          bursts.push({ bot: w.bot_id, type: w.action_type, count: 1, first: w.created_at, last: w.created_at, id: w.id });
        }
      }
      const watchWord: Record<string, [string, string]> = {
        channel_create: ["a channel being created", "channels being created"],
        channel_delete: ["a channel being deleted", "channels being deleted"],
        role_create: ["a role being created", "roles being created"],
        role_delete: ["a role being deleted", "roles being deleted"],
        ban: ["a ban", "bans"],
        kick: ["a kick", "kicks"],
      };
      for (const b of bursts) {
        const [one, many] = watchWord[b.type] ?? [humanize(b.type).toLowerCase(), humanize(b.type).toLowerCase()];
        out.push({ id: `w:${b.id}`, at: b.last, kind: "moderation", title: b.count === 1 ? `${nameOf(b.bot)} watched ${one}` : `${nameOf(b.bot)} watched ${b.count} ${many}`, meta: b.count === 1 ? "Anti-nuke tracking" : `Within ${spell(minutesBetween(b.first, b.last))}, anti-nuke tracking` });
      }
      for (const e of (prot?.data ?? []) as { id: string; bot_id: string; event_type: string; action_taken: string | null; metadata: any; created_at: string }[]) {
        const m = e.metadata ?? {};
        const who = m.bot ?? m.user ?? m.target ?? "";
        out.push({ id: `p:${e.id}`, at: e.created_at, kind: "moderation", title: `${nameOf(e.bot_id)} ${e.action_taken ? e.action_taken : "noticed"} ${humanize(e.event_type).toLowerCase()}${who ? `: ${who}` : ""}`, meta: m.added_by ? `Added by ${m.added_by}` : "Protection", bad: !!e.action_taken });
      }

      for (const t of (team?.data ?? []) as { id: string; member_email: string; invited_at: string | null; accepted_at: string | null; bot_id: string | null }[]) {
        if (t.accepted_at) out.push({ id: `t:${t.id}:a`, at: t.accepted_at, kind: "team", title: `${t.member_email} joined your team`, meta: t.bot_id ? nameOf(t.bot_id) : "All bots" });
        else if (t.invited_at && Date.parse(t.invited_at) >= Date.parse(since)) out.push({ id: `t:${t.id}:i`, at: t.invited_at, kind: "team", title: `Invited ${t.member_email}`, meta: "Waiting for them to accept" });
      }

      out.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
      setItems(out.slice(0, CAP));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, idsKey]);

  return { items, loading };
}
