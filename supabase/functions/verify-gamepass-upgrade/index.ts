// Verifies a Roblox UPGRADE gamepass purchase. When the player owns the
// upgrade gamepass for a product, we bump their existing purchase row to
// the product's current_version. Used for paid Robux version upgrades.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Body = {
  productId?: string;
  robloxUsername?: string;
  parentPurchaseId?: string;
};

const GAMEPASS_ITEM_TYPE = 1;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body: Body = await req.json().catch(() => ({}));
    const productId = (body.productId || "").trim();
    const username = (body.robloxUsername || "").trim();
    const parentPurchaseId = (body.parentPurchaseId || "").trim() || null;

    if (!productId || !username) {
      return json({ error: "Missing productId or robloxUsername" }, 400);
    }
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
      return json({ error: "Invalid Roblox username format" }, 400);
    }

    const cookie = Deno.env.get("ROBLOX_COOKIE");
    if (!cookie) return json({ error: "Server isn't configured for Roblox verification yet." }, 500);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: product, error: productErr } = await supabase
      .from("products")
      .select("id, name, upgrade_gamepass_id, current_version, is_available")
      .eq("id", productId)
      .maybeSingle();

    if (productErr || !product) return json({ error: "Product not found" }, 404);
    if (!product.is_available) return json({ error: "This product isn't available." }, 400);
    if (!product.upgrade_gamepass_id) {
      return json({ error: "This product has no upgrade gamepass configured." }, 400);
    }
    if (!product.current_version) {
      return json({ error: "No newer version is available to upgrade to." }, 400);
    }

    const userLookup = await fetch("https://users.roblox.com/v1/usernames/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
    });
    if (!userLookup.ok) return json({ error: "Couldn't reach Roblox." }, 502);
    const userData = await userLookup.json();
    const robloxUser = userData?.data?.[0];
    if (!robloxUser?.id) return json({ error: `Roblox user "${username}" not found.` }, 404);

    const buyerId: number = robloxUser.id;
    const canonicalName: string = robloxUser.name || username;

    supabase.from("pending_purchases").insert({
      product_id: product.id,
      roblox_user_id: buyerId,
      roblox_username: canonicalName,
      gamepass_id: product.upgrade_gamepass_id,
      status: "pending",
      version: product.current_version,
      purchase_type: "upgrade",
    }).then(({ error }) => {
      if (error) console.error("pending_purchases (upgrade) insert failed:", error);
    });

    const ownershipRes = await fetch(
      `https://inventory.roblox.com/v1/users/${buyerId}/items/${GAMEPASS_ITEM_TYPE}/${product.upgrade_gamepass_id}/is-owned`,
      { headers: { Cookie: `.ROBLOSECURITY=${cookie}` } },
    );
    if (!ownershipRes.ok) {
      console.error("upgrade ownership check failed:", ownershipRes.status);
      return json({ error: "Couldn't verify the upgrade right now." }, 502);
    }
    const owned = await ownershipRes.json();
    if (!owned) {
      return json({
        success: false,
        error:
          "We couldn't find the upgrade purchase yet. If you just bought it, wait ~30 seconds and try again.",
      });
    }

    // Mark the pending row fulfilled
    await supabase
      .from("pending_purchases")
      .update({ status: "fulfilled", fulfilled_at: new Date().toISOString() })
      .eq("product_id", product.id)
      .eq("roblox_user_id", buyerId)
      .eq("status", "pending")
      .eq("purchase_type", "upgrade");

    // Bump the user's purchase row to the new version.
    if (parentPurchaseId) {
      await supabase
        .from("purchases")
        .update({ version: product.current_version })
        .eq("id", parentPurchaseId);
    }

    // Return a download URL for the new version's file
    let downloadUrl: string | null = null;
    let downloadFileName: string | null = null;

    const { data: vRow } = await supabase
      .from("product_versions")
      .select("file_url, file_name")
      .eq("product_id", product.id)
      .eq("version", product.current_version)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const filePath: string | null = vRow?.file_url ?? null;
    downloadFileName = vRow?.file_name ?? null;

    if (filePath) {
      const { data: signed } = await supabase.storage
        .from("product-files")
        .createSignedUrl(filePath, 60 * 10);
      downloadUrl = signed?.signedUrl ?? null;
    }

    return json({
      success: true,
      productName: product.name,
      version: product.current_version,
      fileName: downloadFileName,
      downloadUrl,
    });
  } catch (e) {
    console.error("verify-gamepass-upgrade error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
