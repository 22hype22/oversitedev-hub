// Verifies a Roblox gamepass purchase by checking the user's public inventory.
// On success, returns a short-lived signed URL for the product's attached file.
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Strip "custom-" prefix that the storefront uses internally.
    const dbId = productId.startsWith("custom-")
      ? productId.slice("custom-".length)
      : productId;

    const { data: product, error: productErr } = await supabase
      .from("products")
      .select("id, name, gamepass_id, file_url, file_name, is_available")
      .eq("id", dbId)
      .maybeSingle();

    if (productErr || !product) {
      return json({ error: "Product not found" }, 404);
    }
    if (!product.is_available) {
      return json({ error: "This product isn't available for purchase yet." }, 400);
    }
    if (!product.gamepass_id) {
      return json({ error: "This product has no gamepass configured." }, 400);
    }

    // 1. Resolve username -> Roblox userId
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
      return json({ error: `Roblox user "${username}" not found.` }, 404);
    }

    // 2. Check if the user owns the gamepass (requires public inventory).
    const inv = await fetch(
      `https://inventory.roblox.com/v1/users/${robloxUser.id}/items/GamePass/${product.gamepass_id}`,
    );
    if (inv.status === 403) {
      return json(
        {
          error:
            "Your Roblox inventory is private. Please make it public temporarily (Settings → Privacy → Inventory: Everyone) and try again.",
          inventoryPrivate: true,
        },
        403,
      );
    }
    if (!inv.ok) {
      return json({ error: "Couldn't verify the gamepass purchase right now." }, 502);
    }
    const invData = await inv.json();
    const owns = Array.isArray(invData?.data) && invData.data.length > 0;
    if (!owns) {
      return json(
        {
          error:
            "We couldn't find this gamepass in your inventory yet. If you just bought it, wait a moment and try again.",
        },
        403,
      );
    }

    // 3. Generate a short-lived signed URL for the file (if any).
    let downloadUrl: string | null = null;
    if (product.file_url) {
      const { data: signed, error: signErr } = await supabase.storage
        .from("product-files")
        .createSignedUrl(product.file_url, 60 * 10); // 10 minutes
      if (signErr) {
        console.error("Sign URL failed:", signErr);
      } else {
        downloadUrl = signed?.signedUrl ?? null;
      }
    }

    return json({
      success: true,
      productName: product.name,
      fileName: product.file_name,
      downloadUrl,
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
