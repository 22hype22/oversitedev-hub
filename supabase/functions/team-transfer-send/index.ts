import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return json({ ok: false, error: 'not authenticated' }, 401)
  }

  let memberId = ''
  let siteUrl = ''
  try {
    const body = await req.json()
    memberId = String(body.memberId ?? '').trim()
    siteUrl = String(body.siteUrl ?? '').trim()
  } catch {
    return json({ ok: false, error: 'invalid body' }, 400)
  }
  if (!memberId) return json({ ok: false, error: 'memberId required' }, 400)

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userResp, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userResp.user) return json({ ok: false, error: 'not authenticated' }, 401)
  const ownerEmail = userResp.user.email ?? null

  const { data: rpcResp, error: rpcErr } = await userClient.rpc(
    'team_request_ownership_transfer', { _member_id: memberId },
  )
  if (rpcErr) return json({ ok: false, error: rpcErr.message }, 400)
  const result = rpcResp as { ok: boolean; error?: string; transfer_token?: string; member_email?: string; id?: string }
  if (!result?.ok) return json({ ok: false, error: result?.error ?? 'request failed' }, 400)

  const origin = siteUrl || req.headers.get('origin') || 'https://oversite.shop'
  const confirmUrl = `${origin.replace(/\/$/, '')}/auth?team_transfer=${result.transfer_token}`

  try {
    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY)
    await adminClient.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'team-transfer-confirm',
        recipientEmail: result.member_email,
        templateData: { ownerEmail, confirmUrl },
        idempotencyKey: `team-transfer:${result.transfer_token}`,
      },
    })
  } catch (e) {
    console.error('team-transfer email failed', e)
  }

  return json({ ok: true, confirm_url: confirmUrl })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
