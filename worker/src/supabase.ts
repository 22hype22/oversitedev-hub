import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import os from "node:os";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WORKER_TOKEN = process.env.WORKER_TOKEN;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!WORKER_TOKEN) {
  console.error(
    "Missing WORKER_TOKEN — generate one in Admin → Worker tokens and set it in your .env",
  );
  process.exit(1);
}

export const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const WORKER_ID = process.env.WORKER_ID ?? `worker-${os.hostname()}`;
export const WORKER_TOKEN_VALUE = WORKER_TOKEN;
export const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 5000);
export const HEARTBEAT_INTERVAL_MS = Number(
  process.env.HEARTBEAT_INTERVAL_MS ?? 30000,
);
