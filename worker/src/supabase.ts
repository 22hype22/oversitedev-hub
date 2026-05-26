import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import ws from "ws";
import os from "node:os";

const SUPABASE_URL = process.env.SUPABASE_URL;
// Worker MUST use the service_role key. Anonymous policies on bot_commands,
// bot_runtime_status, and utility_bot_dm_state were removed for security —
// the anon key no longer has access to those tables. WORKER_TOKEN is still
// validated by `runtime_*` SECURITY DEFINER RPCs as a second layer.
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  process.env.SUPABASE_PUBLISHABLE_KEY;
const WORKER_TOKEN = process.env.WORKER_TOKEN;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — set SUPABASE_SERVICE_ROLE_KEY in your .env (anon key no longer has worker access)",
  );
  process.exit(1);
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    "[worker] SUPABASE_SERVICE_ROLE_KEY is not set; falling back to anon key. Worker DB writes will fail — set SUPABASE_SERVICE_ROLE_KEY in Railway.",
  );
}
if (!WORKER_TOKEN) {
  console.error(
    "Missing WORKER_TOKEN — generate one in Admin → Worker tokens and set it in your .env",
  );
  process.exit(1);
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws as unknown as any },
});

export const WORKER_ID = process.env.WORKER_ID ?? `worker-${os.hostname()}`;
export const WORKER_TOKEN_VALUE = WORKER_TOKEN;
export const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 5000);
export const HEARTBEAT_INTERVAL_MS = Number(
  process.env.HEARTBEAT_INTERVAL_MS ?? 30000,
);
