// Single source of truth for which bot bases are billed monthly hosting.
//
// Only Discord bots are billed a recurring monthly hosting fee. ER:LC / Roblox
// bots (dispatch, erlc-spec, customs) are ONE-TIME purchases, hosted free, and
// must NEVER:
//   * count toward the monthly hosting subscription tier, or
//   * be cancelled when a hosting subscription lapses.
//
// This is an allowlist on purpose: any future ER:LC / Roblox base defaults to
// "free hosting" rather than being charged by mistake. If you add a new Discord
// bot base, add it here.
export const BILLABLE_BASES = new Set<string>([
  "protection",
  "support",
  "utilities",
  "scratch",
]);

// A `base` column can be a compound value for packs/multi orders (e.g.
// "protection+utilities"). Treat the order as billable if ANY of its parts is a
// billable Discord base.
export function isBillableBase(base: string | null | undefined): boolean {
  if (!base) return false;
  return String(base)
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .some((part) => BILLABLE_BASES.has(part));
}
