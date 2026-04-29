# Oversite Bot Worker

A Node.js worker that:

1. Polls `bot_commands` for pending start/stop/restart/update actions
2. Updates `bot_runtime_status` with heartbeats every 30s while a bot is running
3. Records usage metrics (commands, errors) hourly
4. Reads the bot's encrypted secrets via `runtime_get_bot_secret` RPC

> The worker authenticates with the **service role key** so it can use
> `runtime_set_bot_status` / `runtime_get_bot_secret` / `runtime_record_bot_metrics`.
> Never deploy this to a browser or expose the service key.

## Setup

```bash
cd worker
cp .env.example .env   # fill in SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
npm install
npm run dev            # tsx watch
# or
npm run build && npm start
```

## Environment variables

| Name | Purpose |
| --- | --- |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-only) |
| `WORKER_ID` | Unique ID for this worker instance (default: hostname) |
| `POLL_INTERVAL_MS` | How often to poll for commands (default: 5000) |
| `HEARTBEAT_INTERVAL_MS` | How often running bots beat (default: 30000) |

## Where to deploy

Anywhere you can run a long-lived Node.js process: Railway, Fly.io,
Render, a small VPS, or a Docker container. **Not** Vercel/Lambda —
the worker is stateful and needs persistent processes per running bot.

## What you still need to implement

The current scaffold simulates a bot lifecycle. Replace `runBot()` in
`src/runtime.ts` with your actual Discord client (e.g. `discord.js`) that:

1. Reads its token via `runtime_get_bot_secret(botId, 'DISCORD_TOKEN')`
2. Logs in and listens for events
3. Calls `recordMetrics()` and `appendLog()` as activity happens
4. Catches uncaught errors and reports them via `setStatus('crashed', err)`
