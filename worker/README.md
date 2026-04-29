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

## Setup

```bash
cd worker
cp .env.example .env
# Fill in:
#   SUPABASE_URL                  - your project URL
#   SUPABASE_SERVICE_ROLE_KEY     - service role key (server only!)
#   WORKER_TOKEN                  - generate in Admin → Worker tokens
#   WORKER_ID                     - any unique label (defaults to hostname)

bun install        # or npm install
bun run dev        # tsx watch
```

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
import { welcomeAddon } from "./addons/welcome.js";
export const ADDONS = {
  [sayAddon.id]: sayAddon,
  [welcomeAddon.id]: welcomeAddon,
};
```

## Production deploy

Recommended: Railway, Fly.io, or any VPS that runs Node 20+.
Run `bun run build && node dist/index.js`.

The worker is stateless — you can run multiple replicas and they'll cooperatively
claim commands without duplicating work (`FOR UPDATE SKIP LOCKED` on the RPC).

## Security

- The `WORKER_TOKEN` is hashed at rest in `worker_tokens`. Treat the plaintext like a password.
- Tokens can be scoped to a single bot (set `bot_id` when creating in admin) or revoked at any time.
- The service role key bypasses RLS; never expose it to clients or commit it.
