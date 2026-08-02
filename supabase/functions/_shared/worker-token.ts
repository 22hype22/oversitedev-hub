// Mint + register a per-bot worker token at deploy time.
//
// Every deployed bot needs a worker token to read the credentials its owner
// enters in the dashboard (ER:LC server key, etc.) via runtime_get_bot_secret.
// The old approach injected a single shared WORKER_TOKEN env secret that was
// never registered in the worker_tokens table, so every bot's read failed with
// `invalid_token`. This mints a fresh token, registers its hash (matching the
// SQL create_worker_token: sha256 hex of the plaintext), scopes it to the bot,
// and returns the plaintext to inject as WORKER_TOKEN. Prior tokens for the bot
// are revoked so only the newest one is valid.
//
// `admin` must be a service-role Supabase client (bypasses RLS to write
// worker_tokens).
export async function mintWorkerToken(
  admin: any,
  orderId: string,
  botName?: string | null,
): Promise<string> {
  // Retire any previous tokens for this bot so redeploys don't pile up valid
  // tokens — only the freshest one should work.
  await admin
    .from("worker_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("bot_id", orderId)
    .is("revoked_at", null);

  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const plain = `wkr_${hex}`;

  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(plain),
  );
  const tokenHash = Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");

  const { error } = await admin.from("worker_tokens").insert({
    name: `auto: ${botName ?? orderId}`.slice(0, 100),
    token_hash: tokenHash,
    token_prefix: plain.slice(0, 12),
    bot_id: orderId,
    notes: "Auto-minted by auto-deploy-bot at deploy.",
  });
  if (error) {
    throw new Error(`worker token registration failed: ${error.message}`);
  }
  return plain;
}
