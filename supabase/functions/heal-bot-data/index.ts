// heal-bot-data
//
// Re-points any bot-scoped child rows (secrets, logs, activity, status, …) to
// the CURRENT owner, for bots the caller owns. Called by the dashboard on load
// so a bot transferred before the fixed flow existed repairs itself the moment
// the new owner opens it — no SQL. A no-op once everything already matches, and
// a caller can only ever affect bots they own.

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

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

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userResp, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userResp.user) return json({ ok: false, error: 'not authenticated' })
  const uid = userResp.user.id

  const admin = createClient(SUPABASE_URL, serviceKey)

  // The bots this user currently owns.
  const { data: bots } = await admin
    .from('bot_orders')
    .select('id')
    .eq('user_id', uid)
  const botIds = (bots ?? []).map((b: { id: string }) => b.id)
  if (botIds.length === 0) return json({ ok: true, fixed: 0 })

  let fixed = 0
  for (const tbl of CHILD_TABLES) {
    // Re-point any row for one of my bots whose user_id isn't me.
    const { data, error } = await admin
      .from(tbl)
      .update({ user_id: uid })
      .in('bot_id', botIds)
      .neq('user_id', uid)
      .select('bot_id')
    if (error) {
      if (!/does not exist|could not find|relation|schema cache/i.test(error.message)) {
        console.error(`heal failed on ${tbl}:`, error.message)
      }
      continue
    }
    fixed += data?.length ?? 0
  }

  return json({ ok: true, fixed })
})

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
