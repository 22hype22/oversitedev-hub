// Translates an array of English strings into a target language using Lovable AI.
// Returns { translations: string[] } in the same order as input.
// Caches in-memory per cold start to reduce duplicate AI calls.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Body = { strings: string[]; target: string };

const cache = new Map<string, string>(); // key: `${target}::${source}`

const LANG_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  pt: "Portuguese",
  it: "Italian",
  nl: "Dutch",
  pl: "Polish",
  ru: "Russian",
  ja: "Japanese",
  zh: "Simplified Chinese",
  ko: "Korean",
  ar: "Arabic",
  hi: "Hindi",
  tr: "Turkish",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const { strings, target } = (await req.json()) as Body;
    if (!Array.isArray(strings) || typeof target !== "string") {
      return new Response(JSON.stringify({ error: "Invalid body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (target === "en" || !LANG_NAMES[target]) {
      // No-op: return input
      return new Response(JSON.stringify({ translations: strings }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (strings.length > 200) {
      return new Response(JSON.stringify({ error: "Too many strings (max 200)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduplicate and check cache
    const unique = Array.from(new Set(strings.filter((s) => typeof s === "string" && s.trim())));
    const toTranslate: string[] = [];
    const result: Record<string, string> = {};
    for (const s of unique) {
      const key = `${target}::${s}`;
      if (cache.has(key)) {
        result[s] = cache.get(key)!;
      } else {
        toTranslate.push(s);
      }
    }

    if (toTranslate.length > 0) {
      const apiKey = Deno.env.get("LOVABLE_API_KEY");
      if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

      const langName = LANG_NAMES[target];
      const systemPrompt = `You are a professional UI/website translator. Translate each English string in the input array to ${langName}. Rules:
- Preserve exact meaning, tone, and any punctuation/emoji.
- Keep brand names like "Oversite", "Roblox", "Discord", "Stripe" untranslated.
- Preserve placeholders like {name}, %s, $1 verbatim.
- Do NOT add quotes, explanations, or extra text.
- Output an object with "translations" as an array of strings, same length and order as input.`;

      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: JSON.stringify({ strings: toTranslate }) },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "return_translations",
                description: "Return the translated strings in order.",
                parameters: {
                  type: "object",
                  properties: {
                    translations: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                  required: ["translations"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "return_translations" } },
        }),
      });

      if (!aiResp.ok) {
        const text = await aiResp.text();
        console.error("AI gateway error:", aiResp.status, text);
        if (aiResp.status === 429) {
          return new Response(
            JSON.stringify({ error: "Rate limited, please try again shortly." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        if (aiResp.status === 402) {
          return new Response(
            JSON.stringify({ error: "AI credits exhausted." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        throw new Error(`AI gateway ${aiResp.status}`);
      }

      const data = await aiResp.json();
      const args =
        data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      let translations: string[] = [];
      try {
        translations = JSON.parse(args ?? "{}").translations ?? [];
      } catch {
        translations = [];
      }

      for (let i = 0; i < toTranslate.length; i++) {
        const src = toTranslate[i];
        const tr = translations[i] ?? src;
        result[src] = tr;
        cache.set(`${target}::${src}`, tr);
      }
    }

    // Return in the original (possibly duplicated) order
    const orderedTranslations = strings.map((s) => result[s] ?? s);
    return new Response(JSON.stringify({ translations: orderedTranslations }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("translate error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
