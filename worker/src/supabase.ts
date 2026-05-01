import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import os from "node:os";

const SUPABASE_URL = process.env.SUPABASE_URL;
// Worker now authenticates via WORKER_TOKEN passed to runtime_* RPCs,
// so we use the public anon/publishable key — no service role needed.
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY; // fallback for old deployments
const WORKER_TOKEN = process.env.WORKER_TOKEN;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_ANON_KEY (set SUPABASE_ANON_KEY in your .env)",
  );
  process.exit(1);
}
if (!WORKER_TOKEN) {
  console.error(
    "Missing WORKER_TOKEN — generate one in Admin → Worker tokens and set it in your .env",
  );
  process.exit(1);
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const WORKER_ID = process.env.WORKER_ID ?? `worker-${os.hostname()}`;
export const WORKER_TOKEN_VALUE = WORKER_TOKEN;
export const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 5000);
export const HEARTBEAT_INTERVAL_MS = Number(
  process.env.HEARTBEAT_INTERVAL_MS ?? 30000,
);
