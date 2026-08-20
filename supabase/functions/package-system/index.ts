// Package System storage API — drafts, submissions, terms, and the per-bot
// submission-id counter. All access is via the bot's worker token; rows are
// keyed by the resolved bot_id.
//
// Body: { action, ... }
//   draft_get    { user_id }                         -> { ok, draft }
//   draft_set    { user_id, draft }                  -> { ok, draft }   (upsert/merge)
//   draft_delete { user_id }                         -> { ok }
//   pkg_create   { pkg }                             -> { ok, pkg }     (assigns submission_id)
//   pkg_update   { submission_id, pkg }              -> { ok, pkg }
//   pkg_get      { submission_id }                   -> { ok, pkg }
//   pkg_list     { status? }                         -> { ok, packages }
//   terms_get    { user_id }                         -> { ok, agreed }
//   terms_set    { user_id }                         -> { ok }
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

// Columns the bot may write on a submission (whitelist — ignore anything else).
const PKG_FIELDS = [
  "user_id", "type", "customizable", "one_time_sell", "name", "items", "price",
  "tag", "zip_url", "preview_url", "zip_channel_id", "zip_message_id",
  "preview_channel_id", "preview_message_id", "status", "resolved_by",
  "review_channel_id", "review_message_id", "listing_channel_id",
  "listing_message_id", "game_pass_id", "claimed_by",
];
const DRAFT_FIELDS = [
  "editing_submission_id", "type", "customizable", "one_time_sell", "name",
  "items", "price", "tag", "existing_zip_url", "existing_zip_channel_id",
  "existing_zip_message_id", "existing_preview_url", "existing_preview_channel_id",
  "existing_preview_message_id",
];

function pick(obj: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const botId = await resolveBotId(req);
  if (!botId) return json({ error: "Unauthorized" }, 401);

  let body: Record<string, any>;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const action = String(body.action ?? "");

  try {
    if (action === "draft_get") {
      const { data } = await admin.from("package_drafts").select("*")
        .eq("bot_id", botId).eq("user_id", String(body.user_id ?? "")).maybeSingle();
      return json({ ok: true, draft: data ?? null });
    }
    if (action === "draft_set") {
      const uid = String(body.user_id ?? "");
      if (!uid) return json({ error: "user_id required" }, 400);
      const patch = pick((body.draft ?? {}) as Record<string, unknown>, DRAFT_FIELDS);
      const { data } = await admin.from("package_drafts").select("id")
        .eq("bot_id", botId).eq("user_id", uid).maybeSingle();
      if (data?.id) {
        const { data: upd } = await admin.from("package_drafts")
          .update({ ...patch, updated_at: new Date().toISOString() })
          .eq("id", data.id).select("*").maybeSingle();
        return json({ ok: true, draft: upd });
      }
      const { data: ins } = await admin.from("package_drafts")
        .insert({ bot_id: botId, user_id: uid, ...patch }).select("*").maybeSingle();
      return json({ ok: true, draft: ins });
    }
    if (action === "draft_delete") {
      await admin.from("package_drafts").delete()
        .eq("bot_id", botId).eq("user_id", String(body.user_id ?? ""));
      return json({ ok: true });
    }

    if (action === "pkg_create") {
      const { data: idData, error: idErr } = await admin.rpc("next_package_id", { _bot_id: botId });
      if (idErr) return json({ error: idErr.message }, 500);
      const submissionId = Number(idData);
      const patch = pick((body.pkg ?? {}) as Record<string, unknown>, PKG_FIELDS);
      const { data, error } = await admin.from("package_submissions")
        .insert({ bot_id: botId, submission_id: submissionId, ...patch })
        .select("*").maybeSingle();
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, pkg: data });
    }
    if (action === "pkg_update") {
      const sid = Number(body.submission_id);
      if (!Number.isFinite(sid)) return json({ error: "submission_id required" }, 400);
      const patch = pick((body.pkg ?? {}) as Record<string, unknown>, PKG_FIELDS);
      const { data } = await admin.from("package_submissions")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("bot_id", botId).eq("submission_id", sid).select("*").maybeSingle();
      return json({ ok: true, pkg: data ?? null });
    }
    if (action === "pkg_get") {
      const sid = Number(body.submission_id);
      const { data } = await admin.from("package_submissions").select("*")
        .eq("bot_id", botId).eq("submission_id", sid).maybeSingle();
      return json({ ok: true, pkg: data ?? null });
    }
    if (action === "pkg_list") {
      let q = admin.from("package_submissions").select("*").eq("bot_id", botId);
      if (body.status) q = q.eq("status", String(body.status));
      const { data } = await q.order("submission_id", { ascending: false }).limit(500);
      return json({ ok: true, packages: data ?? [] });
    }

    if (action === "roblox_lookup") {
      // Buyer's linked Roblox account (from the bot's own /verify).
      const { data } = await admin.from("roblox_verifications")
        .select("roblox_id, roblox_username")
        .eq("bot_id", botId).eq("discord_user_id", String(body.user_id ?? "")).maybeSingle();
      return json({ ok: true, roblox_id: data?.roblox_id ?? null, roblox_username: data?.roblox_username ?? null });
    }

    if (action === "roblox_reverse") {
      // Reverse: a Roblox id → the Discord user linked to it (purchase logs).
      const { data } = await admin.from("roblox_verifications")
        .select("discord_user_id, roblox_username")
        .eq("bot_id", botId).eq("roblox_id", String(body.roblox_id ?? "")).maybeSingle();
      return json({ ok: true, discord_user_id: data?.discord_user_id ?? null, roblox_username: data?.roblox_username ?? null });
    }

    if (action === "log_state_get") {
      // Dedup cursor for the purchase-logs sales poller (seen sale ids).
      const { data } = await admin.from("bot_config").select("config")
        .eq("bot_id", botId).eq("feature", "customs-logging-state").maybeSingle();
      const cfg = (data?.config ?? {}) as Record<string, unknown>;
      const seen = Array.isArray(cfg.seen_ids) ? cfg.seen_ids.map(String) : [];
      return json({ ok: true, seen_ids: seen });
    }
    if (action === "log_state_set") {
      const seen = Array.isArray(body.seen_ids) ? body.seen_ids.map(String).slice(-500) : [];
      await admin.from("bot_config").upsert(
        { bot_id: botId, feature: "customs-logging-state", config: { seen_ids: seen }, updated_at: new Date().toISOString() },
        { onConflict: "bot_id,feature" },
      );
      return json({ ok: true });
    }

    if (action === "terms_get") {
      const { data } = await admin.from("package_terms").select("id")
        .eq("bot_id", botId).eq("user_id", String(body.user_id ?? "")).maybeSingle();
      return json({ ok: true, agreed: Boolean(data) });
    }
    if (action === "terms_set") {
      const uid = String(body.user_id ?? "");
      if (!uid) return json({ error: "user_id required" }, 400);
      await admin.from("package_terms")
        .upsert({ bot_id: botId, user_id: uid }, { onConflict: "bot_id,user_id" });
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("package-system error:", message);
    return json({ error: message }, 500);
  }
});
