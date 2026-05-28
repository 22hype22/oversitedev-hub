import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { token, captcha_response, provider } = await req.json();

    if (!token || typeof token !== "string") {
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!captcha_response || typeof captcha_response !== "string") {
      return new Response(JSON.stringify({ error: "Missing captcha response" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the captcha response with the provider
    const p = (provider ?? "hcaptcha").toLowerCase();
    let captchaOk = false;
    if (p === "turnstile" || p === "cloudflare" || p === "cloudflare_turnstile") {
      const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
      if (!secret) {
        return new Response(JSON.stringify({ error: "Turnstile not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const form = new FormData();
      form.append("secret", secret);
      form.append("response", captcha_response);
      const r = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        { method: "POST", body: form },
      );
      const j = await r.json();
      captchaOk = !!j.success;
    } else {
      const secret = Deno.env.get("HCAPTCHA_SECRET_KEY");
      if (!secret) {
        return new Response(JSON.stringify({ error: "hCaptcha not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const body = new URLSearchParams({ secret, response: captcha_response });
      const r = await fetch("https://hcaptcha.com/siteverify", {
        method: "POST",
        body,
      });
      const j = await r.json();
      captchaOk = !!j.success;
    }

    if (!captchaOk) {
      return new Response(JSON.stringify({ error: "Captcha verification failed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: row, error: fetchErr } = await supabase
      .from("verification_tokens")
      .select("id, expires_at, completed, used")
      .eq("token", token)
      .maybeSingle();

    if (fetchErr || !row) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (row.used) {
      return new Response(JSON.stringify({ error: "Token already used" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ error: "Token expired" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updateErr } = await supabase
      .from("verification_tokens")
      .update({ completed: true })
      .eq("id", row.id);

    if (updateErr) {
      return new Response(JSON.stringify({ error: updateErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
