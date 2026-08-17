# Migrating Oversite off Lovable

Goal: own and control everything — code, database, hosting, worker — through
Claude Code + Railway + your own Supabase. **The only thing that stays on
Lovable is the domain** (not worth the ~$150 transfer to GoDaddy for now); its
DNS will simply point at your Railway-hosted site.

Nothing in this repo is locked to Lovable. It's a standard Vite + React +
Supabase app. These scaffolding files are already in place and do **not** affect
your current Lovable deploy:

- `Dockerfile`, `.dockerignore`, `railway.json` — host the frontend on Railway
- `.env.example` — every variable the app needs
- `worker/` — already standalone (its own Dockerfile + railway.json)

Do the cutover steps when you're ready; until then Lovable keeps working.

---

## Target architecture

| Piece              | Today (Lovable)              | After migration                          |
| ------------------ | ---------------------------- | ---------------------------------------- |
| Frontend (dashboard) | Lovable hosting            | **Railway** (this `Dockerfile`)          |
| Database + Auth + Edge functions | Lovable-managed Supabase | **Your own Supabase project**   |
| Worker (Discord)   | Railway                      | Railway (unchanged)                      |
| Email send         | Lovable API (`LOVABLE_*`)    | **Your provider** (Resend/Postmark/…)    |
| Domain             | Lovable                      | **Stays on Lovable**, DNS → Railway      |
| Builder/IDE        | Lovable                      | **Claude Code**                          |

---

## 1. Create your own Supabase project

1. Sign up / log in at <https://supabase.com> and create a new project. You now
   own the dashboard, the database, and all keys.
2. Note these from **Project Settings → API**:
   - Project URL  → `VITE_SUPABASE_URL`
   - `anon` public key → `VITE_SUPABASE_PUBLISHABLE_KEY`
   - Project ref (the subdomain) → `VITE_SUPABASE_PROJECT_ID`
   - `service_role` key → a **server secret** (functions only — never in the frontend)

## 2. Recreate the schema + functions (from this repo)

Everything is reproducible from version control — install the Supabase CLI
(`npm i -g supabase`), then:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push          # applies every file in supabase/migrations/
supabase functions deploy # ships every function in supabase/functions/
```

## 3. Move your existing data + users (the one real catch)

Your current rows and signed-up **auth users** live inside Lovable's managed
project, which you can't reach directly. The schema/functions rebuild perfectly
from step 2, but the **data does not**. Options:

- **Ask Lovable support** to export your database (`pg_dump`) and your auth
  users, then import into your new project (`psql` / Supabase import). This is
  the only way to keep existing accounts and orders.
- Or **start fresh** if there's little to lose.

## 4. Set the Edge Function secrets

In your Supabase dashboard → **Edge Functions → Secrets**, set everything the
functions read (see `.env.example` bottom block):

```
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
STRIPE_LIVE_API_KEY, STRIPE_ENVIRONMENT, INTERNAL_CHARGE_SECRET
DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_BOT_TOKEN,
OVERSITE_UTILITIES_BOT_TOKEN, WORKER_TOKEN
RAILWAY_API_TOKEN, RAILWAY_PROJECT_ID, RAILWAY_ENVIRONMENT_ID,
RAILWAY_PRODUCTION_ENVIRONMENT_ID
ROBLOX_COOKIE, HCAPTCHA_SECRET_KEY, TURNSTILE_SECRET_KEY, LEGACY_ANON_JWT
```

### Email
The transactional-email functions send through Lovable's API
(`LOVABLE_API_KEY` / `LOVABLE_SEND_URL`). Off Lovable, pick a provider
(**Resend** is the easiest drop-in) and update the send call in
`supabase/functions/*` that posts to `LOVABLE_SEND_URL` to call your provider's
API instead, with your provider key as a new secret. (Ask Claude Code to do
this swap — it's a small, contained change.)

### Auth providers (Discord / Google login)
In **Authentication → Providers**, enable Discord and Google with the OAuth
app credentials you create (callback:
`https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`). In
**Authentication → URL Configuration**, set the Site URL and add your domain +
`http://localhost:5173` to the redirect allowlist.

## 5. Point the app at your Supabase

1. Copy `.env.example` → `.env` and fill in your `VITE_*` values.
2. Regenerate the typed client against your project:
   ```bash
   supabase gen types typescript --project-id YOUR_PROJECT_REF > src/integrations/supabase/types.ts
   ```
   (Once you're off Lovable, you own `types.ts` / `client.ts` / `.env` — the
   "do not edit" rule only existed because Lovable regenerated them.)
3. Remove the Lovable dev tagger:
   - delete the `lovable-tagger` import + `componentTagger()` from `vite.config.ts`
   - `npm remove lovable-tagger`

## 6. Host the frontend on Railway

1. In Railway, **New Service → Deploy from GitHub repo**, pick this repo, root
   directory = repo root. It uses the included `Dockerfile` / `railway.json`.
2. Add the `VITE_*` variables (step 5) as **service variables** — they're passed
   into the Docker build and baked into the bundle.
3. Deploy. Railway gives you a `*.up.railway.app` URL — verify the site loads.

## 7. Worker (already on Railway)

The worker keeps running from `worker/`. Just update its env to point at the new
Supabase (URL + keys + `WORKER_TOKEN`). No code change.

## 8. Domain (stays on Lovable)

Keep the domain registered on Lovable. To make it serve the Railway site you
need **DNS record control** in Lovable's domain settings:

- Add a custom domain in Railway (service → Settings → Networking → Custom
  Domain); Railway gives you a target (a `CNAME` value, or `A`/`AAAA` records).
- In Lovable's DNS settings for the domain, point the root/`www` records at that
  Railway target.

> ⚠️ This only works if Lovable lets you **edit DNS records** for the domain. If
> Lovable fully locks DNS to its own hosting, the domain can only serve Lovable —
> in that case you'd either keep the frontend on Lovable (backend still yours) or
> transfer the domain later to control DNS. Check Lovable's domain/DNS panel
> first.

## 9. Cutover order (minimise downtime)

1. Stand up Supabase (steps 1–4) and Railway frontend (step 6) **alongside**
   Lovable — nothing is switched yet.
2. Test the Railway URL end to end (sign up, checkout in Stripe test mode).
3. Only then repoint DNS (step 8). If anything breaks, point DNS back to Lovable.

---

## Rollback
Until DNS is repointed, Lovable stays fully live. The new stack runs in parallel,
so there's no irreversible step until step 8 — and that's a DNS change you can
revert in minutes.
