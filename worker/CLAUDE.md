# CLAUDE.md — Oversite Bot Worker

Guidance for AI agents (Claude Code, Cursor, etc.) working in this directory.

## What this is

A standalone Node.js 20+ worker that runs Discord bots provisioned through the
Oversite dashboard. It is **deployed separately** from the main web app
(typically to Railway / Fly.io / a VPS) and talks to the same Supabase backend
via service-role RPCs.

## Architecture (read these files first)

- `src/index.ts` — poll loop, command dispatch, graceful shutdown
- `src/runtime.ts` — `BotRuntime` class: discord.js client lifecycle per bot
- `src/config.ts` — loads bot config + addon list from `bot_orders`
- `src/supabase.ts` — service-role client, env vars, worker token
- `src/runtime-api.ts` — typed wrappers around `runtime_*` RPCs
- `src/addons/index.ts` — addon registry + `Addon` / `AddonContext` types
- `src/addons/say.ts` — reference addon (slash command)
- `src/health.ts` — HTTP health endpoint for Railway/Docker

## Hard rules

1. **Never** import from `../src` (the web app). This package is standalone.
2. **Never** use the anon key here. Always service-role + worker token.
3. Every DB write must go through a `runtime_*` RPC — do not write tables directly.
4. New addons go in `src/addons/<name>.ts` and must be registered in `src/addons/index.ts`.
5. Keep the worker stateless. Multiple replicas must be safe (the RPC uses
   `FOR UPDATE SKIP LOCKED`).

## Adding an addon

See `README.md` → "Adding an addon". Pattern:

```ts
export const myAddon: Addon = {
  id: "my-addon",         // must match bot_orders.addons[].id
  name: "My addon",
  async register(ctx) {
    // ctx.client, ctx.log, ctx.botId, ctx.config
  },
};
```

## Local dev

```bash
cp .env.example .env   # fill in SUPABASE_URL, SERVICE_ROLE_KEY, WORKER_TOKEN
npm install
npm run dev            # tsx watch
```

## Deploy

Railway is the default target — `railway.json` and `nixpacks.toml` are wired up.
A `Dockerfile` is provided for Fly.io / generic container hosts. See
`README.md` → "Deploy to Railway".
