import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function generateTempPassword(): string {
  // 16 chars: upper, lower, digits, symbol — easy to copy, hard to guess.
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%^&*";
  const all = upper + lower + digits + symbols;
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let out = "";
  // Ensure at least one of each class
  out += upper[bytes[0] % upper.length];
  out += lower[bytes[1] % lower.length];
  out += digits[bytes[2] % digits.length];
  out += symbols[bytes[3] % symbols.length];
  for (let i = 4; i < bytes.length; i++) out += all[bytes[i] % all.length];
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing auth" }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const targetUserId: string | undefined = body?.targetUserId;
    if (!targetUserId || typeof targetUserId !== "string") {
      return json({ error: "targetUserId required" }, 400);
    }

    // Block resetting super admin password
    const { data: target } = await admin.auth.admin.getUserById(targetUserId);
    if (target?.user?.email?.toLowerCase() === "everant00@gmail.com") {
      return json({ error: "Cannot reset the super admin password" }, 403);
    }

    const tempPassword = generateTempPassword();
    const { error: updErr } = await admin.auth.admin.updateUserById(
      targetUserId,
      { password: tempPassword },
    );
    if (updErr) return json({ error: updErr.message }, 500);

    return json({ success: true, tempPassword, email: target?.user?.email ?? null });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});
