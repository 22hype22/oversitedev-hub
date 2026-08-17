import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

// The Oversite support bot that posts the embeds.
const SUPPORT_BOT_ID = 'a6be529f-a7f3-4a58-84c5-bcac5dbc97df'
const SUPPORT_COLOR = 0x86d3a1
const IDEA_COLOR = 0xc9dbe6

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  let type = ''
  let subject = ''
  let message = ''
  let contact = ''
  try {
    const body = await req.json()
    type = String(body.type ?? '').trim()
    subject = String(body.subject ?? '').trim()
    message = String(body.message ?? '').trim()
    contact = String(body.contact ?? '').trim()
  } catch {
    return json({ ok: false, error: 'invalid body' }, 400)
  }

  if (type !== 'support' && type !== 'idea') {
    return json({ ok: false, error: 'invalid type' }, 400)
  }
  if (!message) return json({ ok: false, error: 'Please write a message.' }, 400)
  if (message.length > 4000) {
    return json({ ok: false, error: 'Message is too long.' }, 400)
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY)

  // Resolve the destination channel for this type.
  const { data: settings } = await admin
    .from('feedback_settings')
    .select('support_channel_id, idea_channel_id')
    .eq('id', true)
    .maybeSingle()

  const channelId =
    type === 'support' ? settings?.support_channel_id : settings?.idea_channel_id
  if (!channelId) {
    return json({ ok: false, error: 'This channel isn\'t configured yet.' }, 400)
  }

  // The support bot's owner — used to attribute the queued command.
  const { data: bot } = await admin
    .from('bot_orders')
    .select('user_id')
    .eq('id', SUPPORT_BOT_ID)
    .maybeSingle()
  if (!bot?.user_id) {
    return json({ ok: false, error: 'Support bot is unavailable.' }, 500)
  }

  const isSupport = type === 'support'
  const title = subject || (isSupport ? 'Support request' : 'New idea')

  const payload = {
    channel_id: channelId,
    content: null,
    embeds: [
      {
        author: { name: isSupport ? '🛟 Support request' : '💡 Idea / Suggestion' },
        title,
        description: message,
        color: isSupport ? SUPPORT_COLOR : IDEA_COLOR,
        fields: contact ? [{ name: 'Contact', value: contact }] : [],
        footer: { text: 'Submitted via oversite.shop' },
        timestamp: new Date().toISOString(),
      },
    ],
    images: [],
    trailing_messages: [],
  }

  const { error } = await admin.from('bot_commands').insert({
    bot_id: SUPPORT_BOT_ID,
    user_id: bot.user_id,
    requested_by: bot.user_id,
    action: 'post_message',
    payload,
  })
  if (error) return json({ ok: false, error: error.message }, 500)

  return json({ ok: true })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
