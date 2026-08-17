// dispatch-region
//
// Single source of truth for a dispatch bot's real-world region (state/country).
// Stored in bot_config (feature = 'dispatch_region', config = { region }). Both
// the dashboard picker and the bot's /region command read+write through here, so
// the two stay in sync. Runs with the service-role client (no migration needed).
//
// Auth — either works:
//   * a signed-in OWNER / admin / team member with edit_bot_config (dashboard), or
//   * a valid worker token for the bot (the dispatch bot itself).
//
// Body: { botId, region? }  (+ workerToken for the bot).
//   - region omitted  -> read  (returns the current region)
//   - region provided -> write (sets it, returns the saved region)

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

const FEATURE = 'dispatch_region'
const DEFAULT_REGION = 'the United States'

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey =
    Deno.env.get('SERVICE_ROLE_KEY_OVERRIDE') ||
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  let botId = ''
  let region: string | undefined
  let workerToken = ''
  try {
    const body = await req.json()
    botId = String(body.botId ?? body.bot_id ?? body._bot_id ?? '').trim()
    workerToken = String(body.workerToken ?? body._token ?? '').trim()
    if (body.region !== undefined && body.region !== null) {
      region = String(body.region).trim()
    }
  } catch {
    return json({ ok: false, error: 'invalid body' })
  }
  if (!botId) return json({ ok: false, error: 'botId required' })

  const admin = createClient(SUPABASE_URL, serviceKey)

  // --- authorize --------------------------------------------------------
  let authorized = false

  // (a) worker token for this bot
  if (workerToken) {
    const hash = await sha256Hex(workerToken)
    const { data: tok } = await admin
      .from('worker_tokens')
      .select('bot_id, revoked_at')
      .eq('token_hash', hash)
      .maybeSingle()
    if (tok && tok.revoked_at === null && tok.bot_id === botId) authorized = true
  }

  // (b) signed-in owner / admin / team member with edit_bot_config
  if (!authorized) {
    const authHeader = req.headers.get('Authorization') ?? ''
    if (authHeader.startsWith('Bearer ')) {
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      })
      const { data: userResp } = await userClient.auth.getUser()
      const uid = userResp?.user?.id
      if (uid) {
        const { data: bot } = await admin
          .from('bot_orders').select('user_id').eq('id', botId).maybeSingle()
        if (bot?.user_id === uid) {
          authorized = true
        } else {
          const { data: isAdmin } = await admin.rpc('has_role', { _user_id: uid, _role: 'admin' })
          if (isAdmin === true) {
            authorized = true
          } else {
            const { data: perm } = await admin.rpc('has_bot_team_perm', {
              _viewer_id: uid, _bot_id: botId, _perm: 'edit_bot_config',
            })
            if (perm === true) authorized = true
          }
        }
      }
    }
  }

  if (!authorized) return json({ ok: false, error: 'not allowed' })

  // --- write ------------------------------------------------------------
  if (region !== undefined) {
    if (!region) return json({ ok: false, error: 'region cannot be empty' })
    if (region.length > 60) return json({ ok: false, error: 'region too long' })
    // Explicit check-then-write (don't rely on a unique constraint for upsert).
    const { data: existing } = await admin
      .from('bot_config')
      .select('id')
      .eq('bot_id', botId)
      .eq('feature', FEATURE)
      .maybeSingle()
    const now = new Date().toISOString()
    if (existing?.id) {
      const { error } = await admin
        .from('bot_config')
        .update({ config: { region }, updated_at: now })
        .eq('id', existing.id)
      if (error) return json({ ok: false, error: error.message })
    } else {
      const { error } = await admin
        .from('bot_config')
        .insert({ bot_id: botId, feature: FEATURE, config: { region }, updated_at: now })
      if (error) return json({ ok: false, error: error.message })
    }
    return json({ ok: true, region })
  }

  // --- read -------------------------------------------------------------
  const { data: row } = await admin
    .from('bot_config')
    .select('config')
    .eq('bot_id', botId)
    .eq('feature', FEATURE)
    .maybeSingle()
  const current = (row?.config as { region?: string } | null)?.region || DEFAULT_REGION
  return json({ ok: true, region: current })
})

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
