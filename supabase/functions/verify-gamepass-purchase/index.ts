// Verifies a Roblox gamepass purchase by reading recent group sales using a bot
// account's .ROBLOSECURITY cookie. The bot account must be in the group with
// permission to view group payouts (e.g. "Manage group" role).
//
// Flow:
//   1. Client posts { productId, robloxUsername }.
//   2. We resolve the username -> Roblox userId, look up the product's gamepass_id,
//      and record/refresh a pending_purchase row.
//   3. We page recent group sales transactions and look for a Sale where
//      assetType === "GamePass", assetId === product.gamepass_id, and
//      agent.id === buyer userId, within RECENT_WINDOW_MINUTES.
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

const RECENT_WINDOW_MINUTES = 30;
const SALES_PAGES_TO_SCAN = 2; // 100 most recent sales — plenty for a recent buy.

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

    const groupId = Deno.env.get("ROBLOX_GROUP_ID");
    const cookie = Deno.env.get("ROBLOX_COOKIE");
    if (!groupId || !cookie) {
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
      .select("id, name, gamepass_id, file_url, file_name, is_available")
      .eq("id", dbId)
      .maybeSingle();

    if (productErr || !product) return json({ error: "Product not found" }, 404);
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
    const buyerId: number = robloxUser.id;
    const canonicalName: string = robloxUser.name || username;

    // 2. Record/refresh pending purchase intent.
    await supabase.from("pending_purchases").insert({
      product_id: product.id,
      roblox_user_id: buyerId,
      roblox_username: canonicalName,
      gamepass_id: product.gamepass_id,
      status: "pending",
    });

    // 3. Read recent group sales. Group transactions need an X-CSRF-TOKEN — we
    //    obtain one with a throwaway POST first.
    const csrfRes = await fetch("https://auth.roblox.com/v2/logout", {
      method: "POST",
      headers: { Cookie: `.ROBLOSECURITY=${cookie}` },
    });
    const csrfToken = csrfRes.headers.get("x-csrf-token");
    if (!csrfToken) {
      return json(
        { error: "Roblox session is invalid. The bot cookie may have expired." },
        502,
      );
    }

    const cutoff = Date.now() - RECENT_WINDOW_MINUTES * 60 * 1000;
    let cursor: string | undefined;
    let matched = false;

    pageLoop: for (let page = 0; page < SALES_PAGES_TO_SCAN; page++) {
      const url = new URL(
        `https://economy.roblox.com/v2/groups/${groupId}/transactions`,
      );
      url.searchParams.set("transactionType", "Sale");
      url.searchParams.set("limit", "50");
      if (cursor) url.searchParams.set("cursor", cursor);

      const txRes = await fetch(url.toString(), {
        headers: {
          Cookie: `.ROBLOSECURITY=${cookie}`,
          "X-CSRF-TOKEN": csrfToken,
        },
      });

      if (txRes.status === 401 || txRes.status === 403) {
        return json(
          {
            error:
              "The bot account can't read group sales. Check that it's in the group with 'View group payouts' permission.",
          },
          502,
        );
      }
      if (!txRes.ok) {
        return json({ error: "Couldn't read recent group sales." }, 502);
      }

      const tx = await txRes.json();
      const sales: any[] = tx?.data ?? [];

      for (const sale of sales) {
        const created = sale?.created ? Date.parse(sale.created) : 0;
        if (created && created < cutoff) {
          // Sales are returned newest-first; once we pass the window, stop.
          break pageLoop;
        }
        const assetType = sale?.details?.type ?? sale?.assetType;
        const assetId = sale?.details?.id ?? sale?.assetId;
        const agentId = sale?.agent?.id;
        if (
          (assetType === "GamePass" || assetType === "Game Pass") &&
          String(assetId) === String(product.gamepass_id) &&
          Number(agentId) === buyerId
        ) {
          matched = true;
          break pageLoop;
        }
      }

      cursor = tx?.nextPageCursor;
      if (!cursor) break;
    }

    if (!matched) {
      return json(
        {
          error:
            "We couldn't find your purchase yet. If you just bought it, wait ~30 seconds and try again.",
        },
        404,
      );
    }

    // 4. Mark pending purchase fulfilled and return signed URL if the product has a file.
    await supabase
      .from("pending_purchases")
      .update({ status: "fulfilled", fulfilled_at: new Date().toISOString() })
      .eq("product_id", product.id)
      .eq("roblox_user_id", buyerId)
      .eq("status", "pending");

    let downloadUrl: string | null = null;
    if (product.file_url) {
      const { data: signed, error: signErr } = await supabase.storage
        .from("product-files")
        .createSignedUrl(product.file_url, 60 * 10);
      if (signErr) console.error("Sign URL failed:", signErr);
      else downloadUrl = signed?.signedUrl ?? null;
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
