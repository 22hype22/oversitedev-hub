// Verifies a Roblox gamepass purchase by checking whether the buyer now owns
// the configured gamepass. This is faster and more reliable than reading group
// sales, and it does not require special group payout permissions.
//
// Flow:
//   1. Client posts { productId, robloxUsername }.
//   2. We resolve the username -> Roblox userId, look up the product's gamepass_id,
//      and record/refresh a pending_purchase row.
//   3. We call Roblox inventory ownership for that user + gamepass.
//   4. On match: mark the pending_purchase fulfilled and return a signed URL
//      to the attached file (if any). Otherwise return a "not found yet" error.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Body = {
  productId?: string;
  robloxUsername?: string;
};

const GAMEPASS_ITEM_TYPE = 1;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: Body = await req.json().catch(() => ({}));
    const productId = (body.productId || "").trim();
    const username = (body.robloxUsername || "").trim();

    if (!productId || !username) {
      return json({ error: "Missing productId or robloxUsername" }, 400);
    }
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
      return json({ error: "Invalid Roblox username format" }, 400);
    }

    const cookie = Deno.env.get("ROBLOX_COOKIE");
    if (!cookie) {
      return json({ error: "Server isn't configured for Roblox verification yet." }, 500);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const dbId = productId.startsWith("custom-")
      ? productId.slice("custom-".length)
      : productId;

    const { data: product, error: productErr } = await supabase
      .from("products")
      .select("id, name, gamepass_id, file_url, file_name, is_available, current_version")
      .eq("id", dbId)
      .maybeSingle();

    if (productErr || !product) return json({ error: "Product not found" }, 404);
    if (!product.is_available) {
      return json({ error: "This product isn't available for purchase yet." }, 400);
    }
    if (!product.gamepass_id) {
      return json({ error: "This product has no gamepass configured." }, 400);
    }

    // 1. Resolve username -> Roblox userId.
    const userLookup = await fetch("https://users.roblox.com/v1/usernames/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
    });

    if (!userLookup.ok) {
      return json({ error: "Couldn't reach Roblox to look up that username." }, 502);
    }
    const userData = await userLookup.json();
    const robloxUser = userData?.data?.[0];
    if (!robloxUser?.id) {
      return json({ error: `Roblox user \"${username}\" not found.` }, 404);
    }
    const buyerId: number = robloxUser.id;
    const canonicalName: string = robloxUser.name || username;

    // 2. Record/refresh pending purchase intent (stamp the product's current version).
    supabase.from("pending_purchases").insert({
      product_id: product.id,
      roblox_user_id: buyerId,
      roblox_username: canonicalName,
      gamepass_id: product.gamepass_id,
      status: "pending",
      version: product.current_version ?? null,
    }).then(({ error }) => {
      if (error) console.error("pending_purchases insert failed:", error);
    });

    // 3. Verify ownership directly via Roblox inventory.
    const ownershipRes = await fetch(
      `https://inventory.roblox.com/v1/users/${buyerId}/items/${GAMEPASS_ITEM_TYPE}/${product.gamepass_id}/is-owned`,
      {
        headers: {
          Cookie: `.ROBLOSECURITY=${cookie}`,
        },
      },
    );

    if (ownershipRes.status === 401 || ownershipRes.status === 403) {
      return json(
        { error: "The Roblox bot session can't verify ownership right now. Please try again shortly." },
        502,
      );
    }
    if (!ownershipRes.ok) {
      const raw = await ownershipRes.text().catch(() => "");
      console.error("ownership check failed:", ownershipRes.status, raw);
      return json({ error: "Couldn't verify the gamepass purchase right now." }, 502);
    }

    const matched = await ownershipRes.json();

    if (!matched) {
      return json({
        success: false,
        error:
          "We couldn't find your purchase yet. If you just bought it, wait ~30 seconds and try again.",
      });
    }

    // 4. Mark pending purchase fulfilled and return signed URL if the product has a file.
    await supabase
      .from("pending_purchases")
      .update({ status: "fulfilled", fulfilled_at: new Date().toISOString() })
      .eq("product_id", product.id)
      .eq("roblox_user_id", buyerId)
      .eq("status", "pending");

    // If the caller is signed in, save the verified Roblox username to their
    // profile so the storefront can recognize ownership of gamepass purchases.
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const token = authHeader.slice(7);
        const { data: userData } = await supabase.auth.getUser(token);
        const uid = userData.user?.id;
        if (uid) {
          const { data: existingProfile } = await supabase
            .from("profiles")
            .select("id, roblox_username")
            .eq("user_id", uid)
            .maybeSingle();
          if (existingProfile) {
            if (
              !existingProfile.roblox_username ||
              existingProfile.roblox_username.toLowerCase() !==
                canonicalName.toLowerCase()
            ) {
              await supabase
                .from("profiles")
                .update({ roblox_username: canonicalName })
                .eq("user_id", uid);
            }
          } else {
            await supabase.from("profiles").insert({
              user_id: uid,
              roblox_username: canonicalName,
              discord_username: "",
            });
          }
        }
      } catch (e) {
        console.error("profile link failed:", e);
      }
    }

    let downloadUrl: string | null = null;
    let downloadFileName: string | null = product.file_name ?? null;

    // Resolve the file for this purchase: prefer the snapshot row matching the
    // product's current version (so future updates don't auto-bump this buyer);
    // fall back to the live `products.file_url`.
    let filePath: string | null = product.file_url ?? null;
    if (product.current_version) {
      const { data: vRow } = await supabase
        .from("product_versions")
        .select("file_url, file_name")
        .eq("product_id", product.id)
        .eq("version", product.current_version)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (vRow?.file_url) {
        filePath = vRow.file_url;
        downloadFileName = vRow.file_name ?? downloadFileName;
      }
    }

    if (filePath) {
      const { data: signed, error: signErr } = await supabase.storage
        .from("product-files")
        .createSignedUrl(filePath, 60 * 10);
      if (signErr) console.error("Sign URL failed:", signErr);
      else downloadUrl = signed?.signedUrl ?? null;
    }

    return json({
      success: true,
      productName: product.name,
      fileName: downloadFileName,
      downloadUrl,
      version: product.current_version ?? null,
    });
  } catch (e) {
    console.error("verify-gamepass-purchase error:", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    return json({ error: message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
