// Portfolio post persistence — so /portfolio posts survive a bot redeploy and
// can be cleaned up when their owner leaves the server.
//
// Each /portfolio run creates a forum post (thread) owned by the member who ran
// it. We record who owns each post so:
//   • only the owner can re-edit/manage it, and
//   • a daily sweep can delete posts whose owner has left the server.
//
// Body:
//   { action: "get_all" }                                   -> { ok, posts: { [thread_id]: {...} } }
//   { action: "add", thread_id, channel_id, guild_id, owner_id, owner_name } -> { ok }
//   { action: "remove", thread_id }                         -> { ok }
//
// Stored in bot_config feature "portfolio-posts":
//   { posts: { [thread_id]: { channel_id, guild_id, owner_id, owner_name, created_at } } }
//
// Auth: bot worker token (x-worker-token: wkr_...) via _worker_token_lookup.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-worker-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const FEATURE = "portfolio-posts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getWorkerToken(req: Request): string {
  const raw =
    req.headers.get("x-worker-token") ??
    req.headers.get("x_worker_token") ??
    req.headers.get("authorization") ??
    "";
  const token = raw.replace(/^Bearer\s+/i, "").replace(/^['"]|['"]$/g, "").trim();
  return token.startsWith("wkr_") ? token : "";
}

async function resolveBotId(req: Request): Promise<string | null> {
  const token = getWorkerToken(req);
  if (!token) return null;
  const { data, error } = await admin.rpc("_worker_token_lookup", { _token: token });
  if (error || !data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return (row?.bot_id ?? row) || null;
}

type Post = {
  channel_id: string;
  guild_id: string;
  owner_id: string;
  owner_name: string;
  created_at: string;
};
type Posts = Record<string, Post>;

async function readPosts(botId: string): Promise<Posts> {
  const { data } = await admin
    .from("bot_config")
    .select("config")
    .eq("bot_id", botId)
    .eq("feature", FEATURE)
    .maybeSingle();
  const cfg = (data?.config ?? {}) as Record<string, unknown>;
  const p = cfg.posts;
  return (p && typeof p === "object" ? p : {}) as Posts;
}

async function writePosts(botId: string, posts: Posts): Promise<void> {
  await admin.from("bot_config").upsert(
    { bot_id: botId, feature: FEATURE, config: { posts }, updated_at: new Date().toISOString() },
    { onConflict: "bot_id,feature" },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const botId = await resolveBotId(req);
  if (!botId) return json({ error: "Unauthorized" }, 401);

  let body: {
    action?: string;
    thread_id?: string;
    channel_id?: string;
    guild_id?: string;
    owner_id?: string;
    owner_name?: string;
  };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const action = String(body.action ?? "");

  try {
    if (action === "get_all") {
      const posts = await readPosts(botId);
      return json({ ok: true, posts });
    }

    const threadId = String(body.thread_id ?? "").trim();
    if (!threadId) return json({ error: "thread_id required" }, 400);

    if (action === "add") {
      const posts = await readPosts(botId);
      posts[threadId] = {
        channel_id: String(body.channel_id ?? ""),
        guild_id: String(body.guild_id ?? ""),
        owner_id: String(body.owner_id ?? ""),
        owner_name: String(body.owner_name ?? ""),
        created_at: new Date().toISOString(),
      };
      await writePosts(botId, posts);
      return json({ ok: true });
    }
    if (action === "remove") {
      const posts = await readPosts(botId);
      delete posts[threadId];
      await writePosts(botId, posts);
      return json({ ok: true });
    }
    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("portfolio-posts error:", message);
    return json({ error: message }, 500);
  }
});
