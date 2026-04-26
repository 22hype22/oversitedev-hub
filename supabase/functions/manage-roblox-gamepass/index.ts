// Edge function to create and update Roblox gamepasses programmatically.
// Uses ROBLOX_COOKIE (.ROBLOSECURITY) to call Roblox's gamepass APIs.
// Place ID is hardcoded to the store's payment game.
//
// Actions:
//   - create:        { action: "create", name, priceRobux, iconUrl }       -> { gamepassId, gamepassUrl }
//   - update_price:  { action: "update_price", gamepassId, priceRobux }    -> { ok: true }
//
// Admin-only: caller must be authenticated and have role 'admin'.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PLACE_ID = "108687688483255";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ROBLOX_COOKIE = Deno.env.get("ROBLOX_COOKIE") ?? "";

type CreateBody = {
  action: "create";
  name: string;
  priceRobux: number;
  iconUrl: string;
};
type UpdateBody = {
  action: "update_price";
  gamepassId: string;
  priceRobux: number;
};
type Body = CreateBody | UpdateBody;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---------------- Roblox API helpers ----------------

let cachedUniverseId: string | null = null;

async function resolveUniverseId(): Promise<string> {
  if (cachedUniverseId) return cachedUniverseId;
  const res = await fetch(
    `https://apis.roblox.com/universes/v1/places/${PLACE_ID}/universe`,
  );
  if (!res.ok) {
    throw new Error(
      `Failed to resolve universe id (HTTP ${res.status}): ${await res.text()}`,
    );
  }
  const data = await res.json();
  if (!data?.universeId) throw new Error("Roblox returned no universeId");
  cachedUniverseId = String(data.universeId);
  return cachedUniverseId;
}

// Roblox requires an x-csrf-token for authenticated POST requests when using
// the .ROBLOSECURITY cookie. The token is returned in a 403 response header
// from a "primer" call.
async function getCsrfToken(): Promise<string> {
  const res = await fetch("https://auth.roblox.com/v2/logout", {
    method: "POST",
    headers: { Cookie: `.ROBLOSECURITY=${ROBLOX_COOKIE}` },
  });
  const token = res.headers.get("x-csrf-token");
  if (!token) {
    throw new Error(
      `Failed to get x-csrf-token (HTTP ${res.status}). Is ROBLOX_COOKIE valid?`,
    );
  }
  return token;
}

async function fetchIcon(iconUrl: string): Promise<{ blob: Blob; ext: string }> {
  const res = await fetch(iconUrl);
  if (!res.ok) {
    throw new Error(`Failed to download product image (HTTP ${res.status})`);
  }
  const contentType = res.headers.get("content-type") ?? "image/png";
  const blob = await res.blob();
  let ext = "png";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) ext = "jpg";
  else if (contentType.includes("webp")) ext = "webp";
  else if (contentType.includes("gif")) ext = "gif";
  return { blob: new Blob([blob], { type: contentType }), ext };
}

async function createGamepass(
  name: string,
  priceRobux: number,
  iconUrl: string,
): Promise<string> {
  const universeId = await resolveUniverseId();
  let csrf = await getCsrfToken();
  const { blob, ext } = await fetchIcon(iconUrl);

  const buildForm = () => {
    const form = new FormData();
    form.append("name", name.slice(0, 100));
    form.append("description", "");
    form.append("isForSale", priceRobux > 0 ? "true" : "false");
    form.append("price", String(priceRobux));
    form.append("imageFile", blob, `icon.${ext}`);
    return form;
  };

  const doCreate = async (token: string) =>
    await fetch(
      `https://apis.roblox.com/game-passes/v1/universes/${universeId}/game-passes`,
      {
        method: "POST",
        headers: {
          Cookie: `.ROBLOSECURITY=${ROBLOX_COOKIE}`,
          "x-csrf-token": token,
        },
        body: buildForm(),
      },
    );

  let res = await doCreate(csrf);
  if (res.status === 403) {
    // Token may have rotated mid-flight — refresh and retry once.
    const refreshed = res.headers.get("x-csrf-token");
    if (refreshed) {
      csrf = refreshed;
      res = await doCreate(csrf);
    }
  }

  if (!res.ok) {
    throw new Error(
      `Roblox gamepass create failed (HTTP ${res.status}): ${await res.text()}`,
    );
  }
  const data = await res.json();
  const id = String(
    data?.gamePassId ?? data?.gamepassId ?? data?.id ?? "",
  );
  if (!id) throw new Error("Roblox response missing gamepass id");

  return id;
}

async function updateGamepassPrice(
  gamepassId: string,
  priceRobux: number,
  csrfToken?: string,
): Promise<void> {
  const universeId = await resolveUniverseId();
  let csrf = csrfToken ?? (await getCsrfToken());

  const buildForm = () => {
    const form = new FormData();
    form.append("isForSale", priceRobux > 0 ? "true" : "false");
    form.append("price", String(priceRobux));
    return form;
  };

  const doUpdate = async (token: string) =>
    await fetch(
      `https://apis.roblox.com/game-passes/v1/universes/${universeId}/game-passes/${gamepassId}`,
      {
        method: "PATCH",
        headers: {
          Cookie: `.ROBLOSECURITY=${ROBLOX_COOKIE}`,
          "x-csrf-token": token,
        },
        body: buildForm(),
      },
    );

  let res = await doUpdate(csrf);
  if (res.status === 403) {
    const refreshed = res.headers.get("x-csrf-token");
    if (refreshed) {
      csrf = refreshed;
      res = await doUpdate(csrf);
    }
  }
  if (!res.ok) {
    throw new Error(
      `Roblox gamepass price update failed (HTTP ${res.status}): ${await res.text()}`,
    );
  }
}

// ---------------- HTTP handler ----------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (!ROBLOX_COOKIE) {
    return json({ error: "ROBLOX_COOKIE secret is not configured" }, 500);
  }

  // Verify caller is an admin.
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "Missing Authorization header" }, 401);
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const jwt = authHeader.slice("Bearer ".length);
  const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return json({ error: "Invalid token" }, 401);
  }
  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleData) {
    return json({ error: "Admins only" }, 403);
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  try {
    if (body.action === "create") {
      const { name, priceRobux, iconUrl } = body;
      if (!name?.trim()) return json({ error: "name is required" }, 400);
      if (!Number.isFinite(priceRobux) || priceRobux < 0) {
        return json({ error: "priceRobux must be >= 0" }, 400);
      }
      if (!iconUrl) return json({ error: "iconUrl is required" }, 400);

      const gamepassId = await createGamepass(name.trim(), priceRobux, iconUrl);
      return json({
        gamepassId,
        gamepassUrl: `https://www.roblox.com/game-pass/${gamepassId}/`,
      });
    }

    if (body.action === "update_price") {
      const { gamepassId, priceRobux } = body;
      if (!gamepassId) return json({ error: "gamepassId is required" }, 400);
      if (!Number.isFinite(priceRobux) || priceRobux < 0) {
        return json({ error: "priceRobux must be >= 0" }, 400);
      }
      await updateGamepassPrice(String(gamepassId), priceRobux);
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("manage-roblox-gamepass error:", message);
    return json({ error: message }, 500);
  }
});
