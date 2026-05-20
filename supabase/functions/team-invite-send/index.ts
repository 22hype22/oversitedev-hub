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

  let email = ''
  let role = ''
  let siteUrl = ''
  try {
    const body = await req.json()
    email = String(body.email ?? '').trim()
    role = String(body.role ?? '').trim()
    siteUrl = String(body.siteUrl ?? '').trim()
  } catch {
    return json({ ok: false, error: 'invalid body' }, 400)
  }

  if (!email || !role) return json({ ok: false, error: 'email and role required' }, 400)

  // Caller-scoped client → RPC runs as the inviting user
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: userResp, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userResp.user) return json({ ok: false, error: 'not authenticated' }, 401)
  const inviterEmail = userResp.user.email ?? null

  const { data: inviteResp, error: inviteErr } = await userClient.rpc('team_invite_member', {
    _email: email,
    _role: role,
  })
  if (inviteErr) return json({ ok: false, error: inviteErr.message }, 400)
  const result = inviteResp as { ok: boolean; error?: string; invite_token?: string; id?: string }
  if (!result?.ok) return json({ ok: false, error: result?.error ?? 'invite failed' }, 400)

  const origin = siteUrl || req.headers.get('origin') || 'https://oversite.shop'
  const acceptUrl = `${origin.replace(/\/$/, '')}/auth?team_invite=${result.invite_token}`

  // Fire-and-forget the email via the existing transactional sender (service-role)
  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
      },
      body: JSON.stringify({
        templateName: 'team-invite',
        recipientEmail: email,
        templateData: { inviterEmail, role, acceptUrl },
        idempotencyKey: `team-invite:${result.id}`,
      }),
    })
    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      console.error('send-transactional-email failed', resp.status, text)
    } else {
      await resp.text().catch(() => '')
    }
  } catch (e) {
    console.error('team-invite email failed', e)
    // Don't fail the whole call — the invite row + link still exist.
  }

  return json({ ok: true, invite_token: result.invite_token, id: result.id, accept_url: acceptUrl })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
