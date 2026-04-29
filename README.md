# Oversite

Discord bot hosting platform — dashboard, ordering, payments, and runtime.

## Repo layout

- **`/` (root)** — React + Vite dashboard, deployed via Lovable / any static host.
- **`/worker`** — Node.js worker that runs the actual Discord bots.
  Deploys separately to Railway / Fly.io / a VPS.
  See [`worker/README.md`](./worker/README.md) and [`worker/CLAUDE.md`](./worker/CLAUDE.md).
- **`/supabase`** — database migrations + edge functions (auto-deployed by Lovable Cloud).

## Quick start

**Dashboard (this repo root):**
```bash
npm install
npm run dev
```

**Worker (separate process, separate deploy):**
```bash
cd worker
cp .env.example .env   # fill in Supabase + worker token
npm install
npm run dev
```

## Deploying

- **Dashboard** — push to GitHub, Lovable auto-publishes. Custom domains in
  Project Settings → Domains.
- **Worker** — push to GitHub, deploy `/worker` as a Railway service
  (root directory = `worker`). See [`worker/README.md`](./worker/README.md#deploy-to-railway).

## For AI agents

See [`CLAUDE.md`](./CLAUDE.md) for repo-wide conventions.
