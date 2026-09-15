// Traffic passed between the dispatch desks of one community.
//
// Police, fire and DOT dispatch are separate bots: Discord allows one voice
// connection per server per bot, and each desk needs its own channel. Separate
// bots are separate processes, so a unit asking police dispatch for an
// ambulance has no way to reach the fire desk on its own. This carries it.
//
// Invocation, always as a bot with its worker token:
//   { botId, workerToken, guildId, action: "send", fromAgency, toAgency,
//     body, callsign?, place? }
//   { botId, workerToken, guildId, action: "poll", agency }
//
// A poll returns what is waiting for that desk and marks it taken in the same
// breath, so two processes cannot both air the same request.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AGENCIES = new Set(["pd", "fd", "dot"]);
// One transmission, not an essay. Anything longer is a bug at the other end.
const MAX_BODY = 500;
// Nothing older than this is worth putting on the air: whatever it was about
// has resolved itself, and airing it would confuse rather than help.
const STALE_SECONDS = 180;

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const input = await req.json().catch(() => ({}));
    const { botId, workerToken, guildId, action } = input ?? {};
    if (!botId || !workerToken) return json(401, { error: "not a bot" });
    if (!guildId) return json(400, { error: "guildId required" });

    // The token is what says this is the bot it claims to be. Hashed, and
    // checked the same way every other worker-authenticated function does.
    const hash = await sha256Hex(String(workerToken));
    const { data: tok } = await admin
      .from("worker_tokens")
      .select("bot_id, revoked_at")
      .eq("token_hash", hash)
      .maybeSingle();
    if (!tok || tok.revoked_at !== null || tok.bot_id !== botId) {
      return json(401, { error: "not a bot" });
    }

    // And being in the server is what says it may speak for that community.
    // Without this a bot could read another customer's traffic by guessing an
    // id, which is the whole thing this table has to not allow.
    const { data: inGuild } = await admin
      .from("bot_active_guilds")
      .select("guild_id")
      .eq("bot_id", botId)
      .eq("guild_id", String(guildId))
      .maybeSingle();
    if (!inGuild) return json(403, { error: "not in that server" });

    if (action === "send") {
      const fromAgency = String(input.fromAgency ?? "").toLowerCase();
      const toAgency = String(input.toAgency ?? "").toLowerCase();
      const body = String(input.body ?? "").trim().slice(0, MAX_BODY);
      if (!AGENCIES.has(fromAgency) || !AGENCIES.has(toAgency)) {
        return json(400, { error: "unknown agency" });
      }
      if (fromAgency === toAgency) return json(400, { error: "that is your own desk" });
      if (!body) return json(400, { error: "nothing to pass on" });

      const { error } = await admin.from("dispatch_relay").insert({
        guild_id: String(guildId),
        from_bot: botId,
        from_agency: fromAgency,
        to_agency: toAgency,
        body,
        callsign: String(input.callsign ?? "").slice(0, 32),
        place: String(input.place ?? "").slice(0, 120),
      });
      if (error) throw error;

      // Whether anybody is listening decides what the asking desk tells its
      // unit: "fire has been notified" is a lie if no fire desk exists.
      const { data: peers } = await admin
        .from("bot_active_guilds")
        .select("bot_id")
        .eq("guild_id", String(guildId));
      const otherIds = [...new Set((peers ?? [])
        .map((p: any) => p.bot_id)
        .filter((id: string) => id && id !== botId))];
      let heard = false;
      if (otherIds.length) {
        const { data: siblings } = await admin
          .from("bot_orders")
          .select("id, base")
          .in("id", otherIds);
        heard = (siblings ?? []).some((b: any) =>
          String(b.base ?? "").startsWith("dispatch"));
      }
      return json(200, { ok: true, heard });
    }

    if (action === "poll") {
      const agency = String(input.agency ?? "").toLowerCase();
      if (!AGENCIES.has(agency)) return json(400, { error: "unknown agency" });
      const cutoff = new Date(Date.now() - STALE_SECONDS * 1000).toISOString();

      const { data: waiting, error } = await admin
        .from("dispatch_relay")
        .select("id, from_agency, body, callsign, place, created_at")
        .eq("guild_id", String(guildId))
        .eq("to_agency", agency)
        .is("consumed_at", null)
        .gte("created_at", cutoff)
        .order("created_at", { ascending: true })
        .limit(5);
      if (error) throw error;

      const rows = waiting ?? [];
      if (rows.length) {
        // Taken before it is returned. Two processes of one desk, which happens
        // for a moment across a redeploy, must not both put it on the air.
        await admin
          .from("dispatch_relay")
          .update({ consumed_at: new Date().toISOString() })
          .in("id", rows.map((r: any) => r.id))
          .is("consumed_at", null);
      }
      // Anything too old to air is cleared out at the same time, so the table
      // does not need a sweeper of its own.
      await admin
        .from("dispatch_relay")
        .delete()
        .lt("created_at", new Date(Date.now() - 86_400_000).toISOString());

      return json(200, { messages: rows });
    }

    return json(400, { error: "unknown action" });
  } catch (err) {
    console.error("[dispatch-relay]", (err as Error).message);
    return json(500, { error: (err as Error).message });
  }
});
