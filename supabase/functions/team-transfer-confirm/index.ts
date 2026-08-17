// team-transfer-confirm
//
// The recipient confirms an ownership transfer. This runs the ENTIRE transfer
// with the service-role client (bypasses RLS), so there is no database function
// or SQL migration to apply — deploying this edge function IS the fix.
//
// It:
//   * verifies the caller is the intended recipient,
//   * moves bot_orders.user_id to them (+ detaches the bot from the old group),
//   * moves every bot-scoped child row (secrets, logs, activity, status, …) so
//     RLS stops hiding it from the new owner,
//   * does a clean break: the previous owner keeps NO access to the bot,
//   * is idempotent — a repeat confirm just returns success.
//
// The handshake is stored on dashboard_team's existing transfer_* columns by
// team-transfer-send, so nothing new is needed in the database.

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

// Every bot-scoped table that carries its own user_id (RLS keys off it).
const CHILD_TABLES = [
  'bot_secrets', 'bot_logs', 'bot_notifications', 'bot_runtime_status',
  'bot_commands', 'bot_active_guilds', 'bot_channel_cache', 'bot_role_cache',
  'bot_server_slots', 'bot_say_drafts', 'bot_credits', 'bot_free_periods',
  'bot_free_period_redemptions', 'bot_dashboard_redemptions',
  'bot_pending_discounts', 'bot_usage_metrics',
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey =
    Deno.env.get('SERVICE_ROLE_KEY_OVERRIDE') ||
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return json({ ok: false, error: 'not authenticated' })
  }

  let token = ''
  try {
    const body = await req.json()
    token = String(body.token ?? body.team_transfer ?? '').trim()
  } catch {
    return json({ ok: false, error: 'invalid body' })
  }
  if (token.length < 16) return json({ ok: false, error: 'invalid token' })

  // Who is confirming (the recipient) — resolved from their JWT.
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userResp, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userResp.user) return json({ ok: false, error: 'not authenticated' })
  const to = userResp.user.id
  const toEmail = (userResp.user.email ?? '').toLowerCase()

  const admin = createClient(SUPABASE_URL, serviceKey)

  // Find the pending handshake.
  const { data: row } = await admin
    .from('dashboard_team')
    .select('id, owner_user_id, member_user_id, member_email, transfer_bot_ids, transfer_requested_at')
    .eq('transfer_token', token)
    .maybeSingle()

  // No row → the token was already consumed by a prior confirm. Treat a repeat
  // as success so the double-fire / refresh never shows a scary error.
  if (!row) {
    return json({ ok: true, already: true, bot_ids: [] })
  }

  // Expire after 7 days.
  const requestedAt = row.transfer_requested_at ? new Date(row.transfer_requested_at).getTime() : 0
  if (requestedAt && Date.now() - requestedAt > 7 * 24 * 60 * 60 * 1000) {
    await admin.from('dashboard_team')
      .update({ transfer_token: null, transfer_requested_at: null, transfer_requested_by: null, transfer_bot_ids: null })
      .eq('id', row.id)
    return json({ ok: false, error: 'this transfer link has expired' })
  }

  // The caller must be the intended recipient.
  const recipientMatches =
    row.member_user_id === to ||
    (row.member_email ?? '').toLowerCase() === toEmail
  if (!recipientMatches) {
    return json({ ok: false, error: 'this transfer is for a different account' })
  }

  const from = row.owner_user_id as string
  if (from === to) {
    await admin.from('dashboard_team')
      .update({ transfer_token: null, transfer_requested_at: null, transfer_requested_by: null, transfer_bot_ids: null })
      .eq('id', row.id)
    return json({ ok: false, error: 'you already own these bots' })
  }

  const botIds: string[] = Array.isArray(row.transfer_bot_ids) ? row.transfer_bot_ids : []
  if (botIds.length === 0) {
    await admin.from('dashboard_team')
      .update({ transfer_token: null, transfer_requested_at: null, transfer_requested_by: null, transfer_bot_ids: null })
      .eq('id', row.id)
    return json({ ok: false, error: 'no bots were attached to this transfer' })
  }

  // Previous owner's email (for the completion email).
  let fromEmail: string | null = null
  try {
    const { data: fromUser } = await admin.auth.admin.getUserById(from)
    fromEmail = fromUser?.user?.email ?? null
  } catch { /* non-fatal */ }

  const moved: string[] = []

  for (const bot of botIds) {
    // Move real ownership — only if the sender still owns it. .select() lets us
    // confirm a row actually moved (idempotent: an already-moved bot no-ops).
    const { data: movedRows } = await admin
      .from('bot_orders')
      .update({ user_id: to, group_id: null, updated_at: new Date().toISOString() })
      .eq('id', bot)
      .eq('user_id', from)
      .select('id')
    if (!movedRows || movedRows.length === 0) continue

    // Move every bot-scoped child row to the new owner.
    for (const tbl of CHILD_TABLES) {
      const { error } = await admin.from(tbl)
        .update({ user_id: to })
        .eq('bot_id', bot)
        .eq('user_id', from)
      // A table that doesn't exist in this project is fine — skip it.
      if (error && !/does not exist|could not find|relation|schema cache/i.test(error.message)) {
        console.error(`child move failed on ${tbl} for bot ${bot}:`, error.message)
      }
    }

    // Clean break: previous owner keeps NO access. Remove the recipient's old
    // member row (they own it now) and any row tying the old owner to this bot.
    await admin.from('dashboard_team').delete()
      .eq('bot_id', bot).eq('member_user_id', from)
    await admin.from('dashboard_team').delete()
      .eq('bot_id', bot).ilike('member_email', toEmail)

    // Re-point remaining team members (admins/mods/viewers) to the new owner.
    await admin.from('dashboard_team')
      .update({ owner_user_id: to, updated_at: new Date().toISOString() })
      .eq('bot_id', bot).eq('owner_user_id', from)

    moved.push(bot)
  }

  // Clear the handshake wherever it still lives.
  await admin.from('dashboard_team')
    .update({ transfer_token: null, transfer_requested_at: null, transfer_requested_by: null, transfer_bot_ids: null })
    .eq('transfer_token', token)

  if (moved.length === 0) {
    return json({ ok: false, error: 'these bots are no longer owned by the sender' })
  }

  return json({
    ok: true,
    owner_user_id: to,
    bot_ids: moved,
    previous_owner_email: fromEmail,
    transfer_id: row.id,
  })
})

function json(body: unknown) {
  // Always 200 so the client reads { ok, error } instead of a generic
  // "edge function returned a non-2xx" with the real reason hidden.
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
