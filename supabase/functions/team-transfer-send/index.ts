// team-transfer-send
//
// IMMEDIATE ownership transfer. The owner picks a team member and the bots move
// to that member right away — no email, no confirmation link, no second step.
// Runs entirely with the service-role client (bypasses RLS), so there is no
// database function or SQL migration to apply — deploying this edge function IS
// the fix. The moment it returns, the bot is gone from the old owner's account
// and fully owned by the recipient.

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

  let memberId = ''
  let botIds: string[] = []
  try {
    const body = await req.json()
    memberId = String(body.memberId ?? '').trim()
    if (Array.isArray(body.botIds)) {
      botIds = body.botIds.map((v: unknown) => String(v)).filter(Boolean)
    }
  } catch {
    return json({ ok: false, error: 'invalid body' })
  }
  if (!memberId) return json({ ok: false, error: 'memberId required' })
  if (botIds.length === 0) return json({ ok: false, error: 'select at least one bot' })

  // Who is initiating (must own the bots).
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userResp, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userResp.user) return json({ ok: false, error: 'not authenticated' })
  const from = userResp.user.id

  const admin = createClient(SUPABASE_URL, serviceKey)

  // The target member (the new owner) — must be an accepted member of this owner.
  const { data: member } = await admin
    .from('dashboard_team')
    .select('id, owner_user_id, member_user_id, member_email, accepted_at')
    .eq('id', memberId)
    .maybeSingle()
  if (!member) return json({ ok: false, error: 'member not found' })
  if (member.owner_user_id !== from) return json({ ok: false, error: 'not owner' })
  if (!member.accepted_at || !member.member_user_id) {
    return json({ ok: false, error: 'that member has not accepted their invite yet' })
  }
  const to = member.member_user_id as string
  const toEmail = (member.member_email ?? '').toLowerCase()
  if (to === from) return json({ ok: false, error: 'cannot transfer to yourself' })

  // Keep only bots the caller actually owns right now.
  const { data: ownRows } = await admin
    .from('bot_orders')
    .select('id')
    .in('id', botIds)
    .eq('user_id', from)
  const validIds = (ownRows ?? []).map((b: { id: string }) => b.id)
  if (validIds.length === 0) return json({ ok: false, error: 'no transferable bots selected' })

  const moved: string[] = []
  for (const bot of validIds) {
    // Move real ownership + detach from the old owner's group.
    const { data: movedRows } = await admin
      .from('bot_orders')
      .update({ user_id: to, group_id: null, updated_at: new Date().toISOString() })
      .eq('id', bot)
      .eq('user_id', from)
      .select('id')
    if (!movedRows || movedRows.length === 0) continue

    // Move every bot-scoped child row so the new owner can see all of it.
    for (const tbl of CHILD_TABLES) {
      const { error } = await admin.from(tbl)
        .update({ user_id: to })
        .eq('bot_id', bot)
        .eq('user_id', from)
      if (error && !/does not exist|could not find|relation|schema cache/i.test(error.message)) {
        console.error(`child move failed on ${tbl} for bot ${bot}:`, error.message)
      }
    }

    // Clean break: the previous owner keeps NO access. Remove any row tying the
    // old owner to this bot and the new owner's old member row (they own it now).
    await admin.from('dashboard_team').delete()
      .eq('bot_id', bot).eq('member_user_id', from)
    if (toEmail) {
      await admin.from('dashboard_team').delete()
        .eq('bot_id', bot).ilike('member_email', toEmail)
    }
    // Re-point remaining team members (admins/mods/viewers) to the new owner.
    await admin.from('dashboard_team')
      .update({ owner_user_id: to, updated_at: new Date().toISOString() })
      .eq('bot_id', bot).eq('owner_user_id', from)

    moved.push(bot)
  }

  if (moved.length === 0) {
    return json({ ok: false, error: 'these bots are no longer owned by you' })
  }

  return json({ ok: true, bot_ids: moved, recipient_email: member.member_email })
})

function json(body: unknown) {
  // Always 200 so the client reads { ok, error } instead of a generic
  // "edge function returned a non-2xx" with the real reason hidden.
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
