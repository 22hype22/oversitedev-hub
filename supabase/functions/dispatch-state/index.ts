// dispatch-state
//
// Durable memory for a dispatch bot: unit statuses, BOLOs, callsign links,
// learned callsigns, active stops and the like. The bot writes it whenever it
// changes and right before it shuts down for a redeploy, and reads it back on
// boot, so nothing the units told dispatch is forgotten between builds.
//
// Stored in bot_config (feature = 'dispatch_state', config = { ...state }).
// Auth: the bot's worker token only.
// Body: { botId, workerToken, state? }
//   - state omitted  -> read  (returns the saved state, or {})
//   - state provided -> write (replaces the saved state)

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const FEATURE = 'dispatch_state'
const MAX_BYTES = 512 * 1024

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SERVICE_ROLE_KEY_OVERRIDE') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  let botId = ''
  let workerToken = ''
  let state: Record<string, unknown> | undefined
  let rawLen = 0
  try {
    const raw = await req.text()
    rawLen = raw.length
    const body = JSON.parse(raw)
    botId = String(body.botId ?? body.bot_id ?? '').trim()
    workerToken = String(body.workerToken ?? body._token ?? '').trim()
    if (body.state !== undefined && body.state !== null) {
      if (typeof body.state !== 'object' || Array.isArray(body.state)) return json({ ok: false, error: 'state must be an object' }, 400)
      state = body.state as Record<string, unknown>
    }
  } catch {
    return json({ ok: false, error: 'invalid body' }, 400)
  }
  if (!botId || !workerToken) return json({ ok: false, error: 'botId and workerToken required' }, 400)
  if (rawLen > MAX_BYTES) return json({ ok: false, error: 'state too large' }, 413)

  const admin = createClient(SUPABASE_URL, serviceKey)
  const hash = await sha256Hex(workerToken)
  const { data: tok } = await admin
    .from('worker_tokens')
    .select('bot_id, revoked_at')
    .eq('token_hash', hash)
    .maybeSingle()
  if (!tok || tok.revoked_at !== null || tok.bot_id !== botId) return json({ ok: false, error: 'unauthorized' }, 401)

  if (state === undefined) {
    const { data } = await admin
      .from('bot_config')
      .select('config, updated_at')
      .eq('bot_id', botId)
      .eq('feature', FEATURE)
      .maybeSingle()
    return json({ ok: true, state: (data?.config as Record<string, unknown>) ?? {}, updated_at: data?.updated_at ?? null })
  }

  const { error } = await admin
    .from('bot_config')
    .upsert({ bot_id: botId, feature: FEATURE, config: state, updated_at: new Date().toISOString() }, { onConflict: 'bot_id,feature' })
  if (error) return json({ ok: false, error: error.message }, 500)
  return json({ ok: true })
})
