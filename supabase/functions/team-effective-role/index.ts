// team-effective-role
//
// Returns the caller's effective role + permissions for a bot. This used to be
// the team_get_effective_role database function, which depended on a migration
// that never deployed — so it returned nothing and the dashboard collapsed to
// just "Dashboard + Support" for invited members. Running it as an
// auto-deploying edge function (service role) means it always works.

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

type Perms = {
  view_dashboard: boolean; edit_bot_config: boolean; manage_secrets: boolean;
  manage_settings: boolean; view_logs: boolean; edit_billing: boolean;
  manage_team: boolean; transfer_ownership: boolean;
}

// Mirrors DEFAULT_PERMISSIONS in src/hooks/useTeamRole.tsx.
const DEFAULTS: Record<string, Perms> = {
  owner:     { view_dashboard: true, edit_bot_config: true,  manage_secrets: true,  manage_settings: true,  view_logs: true,  edit_billing: true,  manage_team: true,  transfer_ownership: true },
  co_owner:  { view_dashboard: true, edit_bot_config: true,  manage_secrets: true,  manage_settings: true,  view_logs: true,  edit_billing: true,  manage_team: true,  transfer_ownership: false },
  admin:     { view_dashboard: true, edit_bot_config: true,  manage_secrets: true,  manage_settings: true,  view_logs: true,  edit_billing: false, manage_team: false, transfer_ownership: false },
  moderator: { view_dashboard: true, edit_bot_config: true,  manage_secrets: false, manage_settings: false, view_logs: true,  edit_billing: false, manage_team: false, transfer_ownership: false },
  viewer:    { view_dashboard: true, edit_bot_config: false, manage_secrets: false, manage_settings: false, view_logs: false, edit_billing: false, manage_team: false, transfer_ownership: false },
}
const EMPTY: Perms = {
  view_dashboard: false, edit_bot_config: false, manage_secrets: false, manage_settings: false,
  view_logs: false, edit_billing: false, manage_team: false, transfer_ownership: false,
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
    return json({ role: null, permissions: EMPTY })
  }

  let botId = ''
  try {
    const body = await req.json()
    botId = String(body.botId ?? body.bot_id ?? '').trim()
  } catch {
    return json({ role: null, permissions: EMPTY })
  }
  if (!botId) return json({ role: null, permissions: EMPTY })

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userResp } = await userClient.auth.getUser()
  const uid = userResp?.user?.id
  const email = (userResp?.user?.email ?? '').toLowerCase()
  if (!uid) return json({ role: null, permissions: EMPTY })

  const admin = createClient(SUPABASE_URL, serviceKey)

  // Who owns the bot, and which group is it in?
  const { data: bot } = await admin
    .from('bot_orders')
    .select('user_id, group_id')
    .eq('id', botId)
    .maybeSingle()
  if (!bot) return json({ role: null, permissions: EMPTY })
  const owner = bot.user_id as string
  const botGroup = (bot as any).group_id ? String((bot as any).group_id) : null

  // The bot's owner has full owner permissions.
  if (uid === owner) {
    return json({ role: 'owner', permissions: DEFAULTS.owner })
  }

  // Otherwise resolve their team-member role (accepted rows win).
  const orFilter = email
    ? `member_user_id.eq.${uid},member_email.ilike.${email}`
    : `member_user_id.eq.${uid}`
  const { data: memberRows } = await admin
    .from('dashboard_team')
    .select('role, accepted_at')
    .eq('bot_id', botId)
    .or(orFilter)
  const rows = (memberRows ?? []) as Array<{ role: string; accepted_at: string | null }>
  if (rows.length === 0) return json({ role: null, permissions: EMPTY })
  rows.sort((a, b) => (b.accepted_at ? 1 : 0) - (a.accepted_at ? 1 : 0))
  const role = rows[0].role

  let permissions: Perms = DEFAULTS[role] ?? EMPTY
  // Overlay the owner's custom permissions for this role. Owners can set them
  // per group, so prefer the row for the bot's own group, then the
  // account-wide row (no group, or the all-zero group id).
  const GLOBAL_GROUP = '00000000-0000-0000-0000-000000000000'
  try {
    const { data: rows } = await admin
      .from('dashboard_role_permissions')
      .select('*')
      .eq('owner_user_id', owner)
      .eq('role', role)
    const list = (rows ?? []) as Array<{ permissions?: unknown; group_id?: string | null }>
    const pick =
      (botGroup ? list.find((r) => r.group_id === botGroup) : undefined) ??
      list.find((r) => !r.group_id || r.group_id === GLOBAL_GROUP) ??
      (list.length === 1 && list[0].group_id === undefined ? list[0] : undefined)
    if (pick?.permissions && typeof pick.permissions === 'object') {
      permissions = { ...permissions, ...(pick.permissions as Partial<Perms>) }
    }
  } catch {
    /* table/row absent — defaults are fine */
  }

  return json({ role, permissions })
})

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
