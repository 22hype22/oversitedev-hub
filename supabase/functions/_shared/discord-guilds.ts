// Shared Discord guild-scrub helpers.
//
// SECURITY INVARIANT: a pool token released back to 'available' (or handed to
// a new customer) must not retain membership in any Discord server. Every
// function that releases or hands out a pool token uses THIS scrub — one
// implementation, verified by a final re-listing, no copies to drift apart.
// Used by: auto-deploy-bot (claim-time gate), cancel-bot-deploy (release),
// admin-token-pool (admin reclaim button).

const DISCORD_API = "https://discord.com/api/v10";

export type GuildRef = { id: string; name?: string };

/** List every guild the bot is in. Returns null when the listing can't be
 * trusted (Discord error) — callers must treat null as "not verified". */
export async function listBotGuilds(botToken: string): Promise<GuildRef[] | null> {
  const guilds: GuildRef[] = [];
  let after: string | null = null;
  for (let i = 0; i < 50; i++) {
    const url = new URL(`${DISCORD_API}/users/@me/guilds`);
    url.searchParams.set("limit", "200");
    if (after) url.searchParams.set("after", after);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bot ${botToken}` },
    });
    if (res.status === 429) {
      const ra = Number(res.headers.get("retry-after") ?? "1");
      await new Promise((r) => setTimeout(r, Math.min(5000, ra * 1000)));
      continue;
    }
    if (!res.ok) return null; // can't trust a partial listing
    const page = (await res.json()) as GuildRef[];
    if (!Array.isArray(page) || page.length === 0) break;
    guilds.push(...page);
    if (page.length < 200) break;
    after = page[page.length - 1].id;
  }
  return guilds;
}

/** Leave every guild the bot is in, up to 3 passes, then re-list to verify.
 * clean=true ONLY when a final fresh listing shows zero guilds. */
export async function scrubGuilds(
  botToken: string,
  tag = "scrub",
): Promise<{ clean: boolean; detail: string }> {
  for (let pass = 0; pass < 3; pass++) {
    const guilds = await listBotGuilds(botToken);
    if (guilds === null) return { clean: false, detail: "Discord guild listing failed" };
    if (guilds.length === 0) {
      return {
        clean: true,
        detail: pass === 0 ? "already in no servers" : `clean after ${pass} pass(es)`,
      };
    }
    for (const g of guilds) {
      const res = await fetch(`${DISCORD_API}/users/@me/guilds/${g.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bot ${botToken}` },
      });
      if (res.status === 429) {
        const ra = Number(res.headers.get("retry-after") ?? "1");
        await new Promise((r) => setTimeout(r, Math.min(5000, ra * 1000)));
      }
      console.log(`[${tag}] leave guild ${g.id} (${g.name ?? ""}) status=${res.status}`);
    }
  }
  const finalCheck = await listBotGuilds(botToken);
  if (finalCheck === null) return { clean: false, detail: "final verification listing failed" };
  return finalCheck.length === 0
    ? { clean: true, detail: "clean after retries" }
    : { clean: false, detail: `${finalCheck.length} server(s) could not be left` };
}
