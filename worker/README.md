# Oversite Bot Worker

Node.js worker that runs Discord bots provisioned through the Oversite dashboard.

## What it does

1. Polls `bot_commands` (via `runtime_claim_next_command`) for `start` / `stop` / `restart` / `update` actions.
2. For each running bot:
   - Loads the order config + addon list from `bot_orders`
   - Pulls the bot's `DISCORD_TOKEN` from encrypted `bot_secrets`
   - Logs into Discord with `discord.js` v14
   - Registers slash commands from the enabled addons
   - Reports status, logs, and usage metrics back to the database
3. Exposes `GET /health` on `$PORT` (default 3000) for Railway/Docker healthchecks.

## Local setup

```bash
cd worker
cp .env.example .env
# Fill in:
#   SUPABASE_URL                  - your project URL
#   SUPABASE_SERVICE_ROLE_KEY     - service role key (server only!)
#   WORKER_TOKEN                  - generate in Admin → Worker tokens
#   WORKER_ID                     - any unique label (defaults to hostname)
#   PORT                          - optional, defaults to 3000

npm install
npm run dev        # tsx watch
```

## Deploy to Railway

1. Push this repo to GitHub.
2. In Railway: **New Project → Deploy from GitHub repo**.
3. Set the **Root Directory** to `worker`.
4. Add environment variables (same as `.env.example`):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `WORKER_TOKEN`
   - `WORKER_ID` (optional)
5. Railway auto-detects `railway.json` + `nixpacks.toml` and:
   - Builds with `npm install && npm run build`
   - Starts with `node dist/index.js`
   - Hits `/health` for healthchecks
   - Restarts on failure (max 10 retries)

For multiple workers, just **Duplicate Service** — they cooperate via
`FOR UPDATE SKIP LOCKED`.

## Deploy with Docker (Fly.io / generic)

```bash
docker build -t oversite-worker ./worker
docker run --env-file worker/.env -p 3000:3000 oversite-worker
```

The `Dockerfile` is multi-stage, runs as Node 20-alpine, and includes a
container-level `HEALTHCHECK` against `/health`.

## Adding an addon

Each addon is a self-contained file in `src/addons/`.

```ts
// src/addons/welcome.ts
import { Events } from "discord.js";
import type { Addon } from "./index.js";

export const welcomeAddon: Addon = {
  id: "welcome",                // must match the id in bot_orders.addons
  name: "Welcome messages",
  async register(ctx) {
    ctx.client.on(Events.GuildMemberAdd, async (member) => {
      const channel = member.guild.systemChannel;
      if (channel?.isTextBased()) {
        await channel.send(`Welcome ${member}! 🎉`);
      }
      await ctx.log("info", `Welcomed ${member.user.tag}`);
    });
  },
};
```

Then register it in `src/addons/index.ts`:

```ts
import { welcomeAddon } from "./welcome.js";
export const ADDONS = {
  [sayAddon.id]: sayAddon,
  [welcomeAddon.id]: welcomeAddon,
};
```

## Security

- The `WORKER_TOKEN` is hashed at rest in `worker_tokens`. Treat the plaintext like a password.
- Tokens can be scoped to a single bot (set `bot_id` when creating in admin) or revoked at any time.
- The service role key bypasses RLS; never expose it to clients or commit it.

## For AI agents

See [`CLAUDE.md`](./CLAUDE.md) for architectural rules and conventions.
