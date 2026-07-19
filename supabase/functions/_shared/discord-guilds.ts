// Shared Discord guild-scrub helpers.
//
// SECURITY INVARIANT: a pool token released back to 'available' (or handed to
// a new customer) must not retain membership in any Discord server. Every
// function that releases or hands out a pool token uses THIS scrub — one
// implementation, verified by a final re-listing, no copies to drift apart.
// Used by: auto-deploy-bot (claim-time gate), cancel-bot-deploy (release),
// admin-token-pool (admin reclaim button).

const DISCORD_API = "https://discord.com/api/v10";

export type GuildRef = {
  id: string;
  name?: string;
  owner?: boolean;
  approximate_member_count?: number;
};

/** List every guild the bot is in. Returns null when the listing can't be
 * trusted (Discord error) — callers must treat null as "not verified". */
export async function listBotGuilds(botToken: string): Promise<GuildRef[] | null> {
  const guilds: GuildRef[] = [];
  let after: string | null = null;
  for (let i = 0; i < 50; i++) {
    const url = new URL(`${DISCORD_API}/users/@me/guilds`);
    url.searchParams.set("limit", "200");
    url.searchParams.set("with_counts", "true");
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
      // A bot can never LEAVE a guild it owns (ownership can't be transferred
      // off a bot), so an owned guild would stick the token forever. Owned +
      // near-empty means it's a shell the bot itself created — delete it.
      // Owned with real members is reported below instead of destroyed.
      const ownedShell = g.owner === true && (g.approximate_member_count ?? 999) <= 3;
      const res = await fetch(
        ownedShell
          ? `${DISCORD_API}/guilds/${g.id}`
          : `${DISCORD_API}/users/@me/guilds/${g.id}`,
        { method: "DELETE", headers: { Authorization: `Bot ${botToken}` } },
      );
      if (res.status === 429) {
        const ra = Number(res.headers.get("retry-after") ?? "1");
        await new Promise((r) => setTimeout(r, Math.min(5000, ra * 1000)));
      }
      console.log(
        `[${tag}] ${ownedShell ? "delete owned shell guild" : "leave guild"} ${g.id} (${g.name ?? ""}) status=${res.status}`,
      );
    }
  }
  const finalCheck = await listBotGuilds(botToken);
  if (finalCheck === null) return { clean: false, detail: "final verification listing failed" };
  if (finalCheck.length === 0) return { clean: true, detail: "clean after retries" };
  const names = finalCheck
    .map((g) => {
      const bits = [g.name ?? g.id];
      if (g.owner) bits.push("bot-owned");
      if (typeof g.approximate_member_count === "number") bits.push(`~${g.approximate_member_count} members`);
      return `${bits[0]}${bits.length > 1 ? ` (${bits.slice(1).join(", ")})` : ""}`;
    })
    .join(", ");
  return { clean: false, detail: `could not exit: ${names}` };
}
