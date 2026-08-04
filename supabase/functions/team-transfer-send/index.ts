// team-transfer-send
//
// The owner initiates an ownership transfer of a set of bots to a team member.
// Fully self-contained: it validates and stores the handshake with the
// service-role client (no database function / SQL migration), then emails the
// recipient a confirmation link. The handshake lives on dashboard_team's
// existing transfer_* columns; team-transfer-confirm reads it back.

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
  const serviceKey =
    Deno.env.get('SERVICE_ROLE_KEY_OVERRIDE') ||
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return json({ ok: false, error: 'not authenticated' }, 401)
  }

  let memberId = ''
  let siteUrl = ''
  let botIds: string[] = []
  try {
    const body = await req.json()
    memberId = String(body.memberId ?? '').trim()
    siteUrl = String(body.siteUrl ?? '').trim()
    if (Array.isArray(body.botIds)) {
      botIds = body.botIds.map((v: unknown) => String(v)).filter(Boolean)
    }
  } catch {
    return json({ ok: false, error: 'invalid body' }, 400)
  }
  if (!memberId) return json({ ok: false, error: 'memberId required' }, 400)
  if (botIds.length === 0) return json({ ok: false, error: 'select at least one bot' }, 400)

  // Who is initiating (must own the bots).
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userResp, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userResp.user) return json({ ok: false, error: 'not authenticated' }, 401)
  const owner = userResp.user.id
  const ownerEmail = userResp.user.email ?? null

  const admin = createClient(SUPABASE_URL, serviceKey)

  // The target member row.
  const { data: member } = await admin
    .from('dashboard_team')
    .select('id, owner_user_id, member_user_id, member_email, accepted_at')
    .eq('id', memberId)
    .maybeSingle()
  if (!member) return json({ ok: false, error: 'member not found' }, 400)
  if (member.owner_user_id !== owner) return json({ ok: false, error: 'not owner' }, 400)
  if (!member.accepted_at || !member.member_user_id) {
    return json({ ok: false, error: 'member has not accepted their invite yet' }, 400)
  }
  if (member.member_user_id === owner) {
    return json({ ok: false, error: 'cannot transfer to yourself' }, 400)
  }

  // Keep only bots the caller actually owns.
  const { data: ownRows } = await admin
    .from('bot_orders')
    .select('id, bot_name')
    .in('id', botIds)
    .eq('user_id', owner)
  const validBots = (ownRows ?? []) as Array<{ id: string; bot_name: string | null }>
  if (validBots.length === 0) {
    return json({ ok: false, error: 'no transferable bots selected' }, 400)
  }
  const validIds = validBots.map((b) => b.id)

  const token =
    crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')

  // Store the handshake on the recipient's dashboard_team row.
  const { error: storeErr } = await admin
    .from('dashboard_team')
    .update({
      transfer_token: token,
      transfer_bot_ids: validIds,
      transfer_requested_at: new Date().toISOString(),
      transfer_requested_by: owner,
    })
    .eq('id', memberId)
  if (storeErr) return json({ ok: false, error: storeErr.message }, 400)

  const origin = siteUrl || req.headers.get('origin') || 'https://oversite.shop'
  const confirmUrl = `${origin.replace(/\/$/, '')}/auth?team_transfer=${token}`
  const botNames = validBots.map((b) => b.bot_name).filter(Boolean) as string[]

  // Fire-and-forget emails (don't fail the transfer if email is down).
  const sendEmail = async (payload: Record<string, unknown>) => {
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
          apikey: ANON_KEY,
        },
        body: JSON.stringify(payload),
      })
      await resp.text().catch(() => '')
    } catch (e) {
      console.error('transfer email failed', e)
    }
  }

  await Promise.all([
    sendEmail({
      templateName: 'team-transfer-confirm',
      recipientEmail: member.member_email,
      templateData: { ownerEmail, confirmUrl, botNames },
      idempotencyKey: `team-transfer-confirm:${token}`,
    }),
    ownerEmail
      ? sendEmail({
          templateName: 'team-transfer-notice',
          recipientEmail: ownerEmail,
          templateData: { memberEmail: member.member_email, botNames },
          idempotencyKey: `team-transfer-notice:${token}`,
        })
      : Promise.resolve(),
  ])

  return json({ ok: true, confirm_url: confirmUrl })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
