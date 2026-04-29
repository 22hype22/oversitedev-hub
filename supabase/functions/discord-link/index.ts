import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DISCORD_CLIENT_ID = Deno.env.get('DISCORD_CLIENT_ID')!;
const DISCORD_CLIENT_SECRET = Deno.env.get('DISCORD_CLIENT_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (status: number, data: unknown) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json(401, { error: 'Missing auth' });

    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json(401, { error: 'Not authenticated' });

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    if (action === 'get_authorize_url') {
      const redirect_uri = body.redirect_uri as string;
      if (!redirect_uri) return json(400, { error: 'redirect_uri required' });
      const state = crypto.randomUUID();
      const params = new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        response_type: 'code',
        scope: 'identify',
        redirect_uri,
        state,
        prompt: 'none',
      });
      return json(200, {
        url: `https://discord.com/api/oauth2/authorize?${params}`,
        state,
      });
    }

    if (action === 'exchange_code') {
      const code = body.code as string;
      const redirect_uri = body.redirect_uri as string;
      if (!code || !redirect_uri) return json(400, { error: 'code and redirect_uri required' });

      // Exchange code for token
      const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: DISCORD_CLIENT_ID,
          client_secret: DISCORD_CLIENT_SECRET,
          grant_type: 'authorization_code',
          code,
          redirect_uri,
        }),
      });
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) {
        console.error('Discord token error', tokenData);
        return json(400, { error: 'Discord rejected the code', details: tokenData });
      }

      // Fetch identity
      const meRes = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const me = await meRes.json();
      if (!meRes.ok) return json(400, { error: 'Failed to fetch Discord identity' });

      const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const username = me.global_name || me.username || null;
      const { error: upErr } = await admin
        .from('user_notification_prefs')
        .upsert({
          user_id: user.id,
          discord_user_id: me.id,
          discord_username: username,
          discord_linked_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      if (upErr) return json(500, { error: upErr.message });

      return json(200, { ok: true, discord_user_id: me.id, discord_username: username });
    }

    if (action === 'unlink') {
      const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { error } = await admin
        .from('user_notification_prefs')
        .upsert({
          user_id: user.id,
          discord_user_id: null,
          discord_username: null,
          discord_linked_at: null,
        }, { onConflict: 'user_id' });
      if (error) return json(500, { error: error.message });
      return json(200, { ok: true });
    }

    if (action === 'set_manual_id') {
      const id = String(body.discord_user_id || '').trim();
      if (!/^\d{17,20}$/.test(id)) {
        return json(400, { error: 'That doesn\'t look like a valid Discord user ID (should be 17–20 digits).' });
      }
      const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { error } = await admin
        .from('user_notification_prefs')
        .upsert({
          user_id: user.id,
          discord_user_id: id,
          discord_username: body.discord_username || null,
          discord_linked_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      if (error) return json(500, { error: error.message });
      return json(200, { ok: true, discord_user_id: id });
    }

    return json(400, { error: 'Unknown action' });
  } catch (e) {
    console.error(e);
    return json(500, { error: (e as Error).message });
  }
});
