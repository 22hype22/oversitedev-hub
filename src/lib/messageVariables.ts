/**
 * Every variable the bots fill in, and which block each one belongs to.
 *
 * This is the single list the Variables side panel reads. Keep it in step
 * with the bots: a token listed here must be substituted by the bot for that
 * block, and a token the bot substitutes should be listed here.
 *
 * Scope is addon id first, then an optional key for blocks with several
 * designs (a small UI message, a session message, an ads design, a shifts
 * field). Server-wide tokens are available in every message design because
 * the bots run them over every V2 message they post.
 */

export type Variable = { token: string; desc: string };
export type VariableGroup = { title: string; note?: string; vars: Variable[] };

const SERVER: VariableGroup = {
  title: "Server",
  note: "Works in every message design. Fills in from the server the message is posted in.",
  vars: [
    { token: "{server}", desc: "Server name" },
    { token: "{count}", desc: "Total members" },
    { token: "{human_count}", desc: "Members, not counting bots" },
    { token: "{bot_count}", desc: "Bots in the server" },
    { token: "{boosts}", desc: "Total server boosts" },
    { token: "{boost_level}", desc: "Boost tier, 0 to 3" },
    { token: "{channel_count}", desc: "Number of channels" },
    { token: "{role_count}", desc: "Number of roles" },
    { token: "{player_count}", desc: "Players in the linked game right now" },
  ],
};

const JOIN: VariableGroup = {
  title: "The member",
  vars: [
    { token: "{user}", desc: "Mentions the member" },
    { token: "{username}", desc: "Their display name" },
    { token: "{emoji}", desc: "The welcome emoji set for the server" },
    { token: "{invite list}", desc: "The invites leaderboard, top inviters first" },
  ],
};

const FORM_FIELDS: VariableGroup = {
  title: "Form fields",
  note: "Each one becomes a field on the form people fill in. The answer replaces it in the posted message.",
  vars: [
    { token: "{question: Label}", desc: "A text field with that label" },
    { token: "{drop down: Name A B C}", desc: "A drop down named Name with options A, B and C" },
    { token: "{file: Name}", desc: "A file upload" },
    { token: "{user}", desc: "Whoever filled in the form" },
  ],
};

const GIVEAWAY: VariableGroup = {
  title: "Giveaway",
  vars: [
    { token: "{prize}", desc: "What is being given away" },
    { token: "{winners}", desc: "How many winners" },
    { token: "{entries}", desc: "Entry count, updates as people join" },
    { token: "{participants}", desc: "Everyone who entered" },
    { token: "{end}", desc: "Live countdown to the end" },
    { token: "{end_full}", desc: "Exact end date and time" },
    { token: "{length}", desc: "How long the giveaway runs" },
    { token: "{host}", desc: "Who started it" },
    { token: "{reactions}", desc: "How many people reacted" },
    { token: "{winner_list}", desc: "The winners, fills in when it ends" },
  ],
};

const FORM_LOG: VariableGroup = {
  title: "Log entry",
  vars: [
    { token: "{Question: Label}", desc: "A text field, asked when the log is made, then filled in" },
    { token: "{File: Label}", desc: "A file upload field" },
    { token: "{user}", desc: "Who logged it" },
    { token: "{username}", desc: "Their display name" },
    { token: "{date}", desc: "When it was logged" },
  ],
};
const ROLE_LOG: VariableGroup = {
  title: "Automatic role logs",
  note: "Only fill in when a log is written because someone's roles changed.",
  vars: [
    { token: "{target}", desc: "The member whose roles changed" },
    { token: "{infractor}", desc: "Same as {target}" },
    { token: "{roles}", desc: "The roles that changed" },
    { token: "{roles added}", desc: "Roles that were added" },
    { token: "{roles removed}", desc: "Roles that were removed" },
  ],
};

const ORDER_STATUS: VariableGroup = {
  title: "Order",
  vars: [
    { token: "{user}", desc: "Mentions the customer" },
    { token: "{username}", desc: "Their display name" },
    { token: "{payment}", desc: "How they are paying" },
    { token: "{payment_link}", desc: "The link to pay" },
  ],
};

const PURCHASE_LOG: VariableGroup = {
  title: "Purchase",
  vars: [
    { token: "{customer}", desc: "The customer's name" },
    { token: "{customer_mention}", desc: "Mentions the customer" },
    { token: "{customer_id}", desc: "Their Discord id" },
    { token: "{roblox}", desc: "Their Roblox username" },
    { token: "{roblox_id}", desc: "Their Roblox id" },
    { token: "{purchased}", desc: "What they bought" },
    { token: "{amount}", desc: "How much they paid" },
    { token: "{payment_type}", desc: "Robux, PayPal, or Stripe" },
    { token: "{payment_id}", desc: "The payment reference" },
  ],
};

const PRICING: VariableGroup = {
  title: "Pricing",
  vars: [
    { token: "{pricing}", desc: "The price list, one line per service" },
    { token: "{service}", desc: "The service name, inside a price line" },
    { token: "{name}", desc: "The package name" },
    { token: "{title}", desc: "The display title" },
  ],
};

const ROBUX_LOCKER: VariableGroup = {
  title: "Robux locker",
  vars: [
    { token: "{funds}", desc: "Robux in the group right now" },
    { token: "{stock}", desc: "Items in stock" },
  ],
};

const FREE_RELEASE: VariableGroup = {
  title: "Free release",
  vars: [
    { token: "{user}", desc: "Who posted the release" },
    { token: "{reaction goal}", desc: "Reactions needed before it unlocks" },
  ],
};

const ADS_REGULAR: VariableGroup = {
  title: "Advertisement",
  vars: [
    { token: "{advertiser}", desc: "Mentions who booked the ad" },
    { token: "{server_link}", desc: "The invite link they gave" },
    { token: "{ping}", desc: "The role the ad pings, if one is set" },
  ],
};
const ADS_GIVEAWAY: VariableGroup = {
  title: "Advertised giveaway",
  vars: [
    { token: "{advertiser}", desc: "Mentions who booked it" },
    { token: "{prize}", desc: "What is being given away" },
    { token: "{winners}", desc: "How many winners" },
    { token: "{duration}", desc: "How long it runs" },
    { token: "{ping}", desc: "The role it pings, if one is set" },
  ],
};

const SMALL_UI: Record<string, VariableGroup> = {
  ticket_inactivity_warn: { title: "Inactivity warning", vars: [{ token: "{user}", desc: "Mentions whoever opened the ticket" }] },
  ticket_close_request: { title: "Close requested", vars: [
    { token: "{user}", desc: "Who asked to close it" },
    { token: "{reason}", desc: "The reason they gave" },
  ] },
  ticket_closing: { title: "Closing", vars: [
    { token: "{user}", desc: "Who closed it" },
    { token: "{reason}", desc: "The reason they gave" },
  ] },
  ticket_claimed: { title: "Claimed", vars: [{ token: "{user}", desc: "The staff member who claimed it" }] },
  ticket_unclaimed: { title: "Unclaimed", vars: [{ token: "{user}", desc: "The staff member who let it go" }] },
  ticket_payment_received: { title: "Payment received", vars: [
    { token: "{user}", desc: "Mentions the customer" },
    { token: "{designer}", desc: "Mentions the designer on the order" },
    { token: "{amount}", desc: "How much was paid" },
    { token: "{method}", desc: "How they paid" },
  ] },
  ticket_progress: { title: "Progress update", vars: [
    { token: "{user}", desc: "Mentions the customer" },
    { token: "{status}", desc: "The new stage, In progress or Completed" },
    { token: "{note}", desc: "The note the designer added" },
    { token: "{staff}", desc: "Who moved it" },
  ] },
  ticket_staff_reminder: { title: "Waiting on staff", vars: [
    { token: "{user}", desc: "Mentions whoever claimed the ticket" },
    { token: "{hours}", desc: "How long the customer has waited" },
    { token: "{roles}", desc: "The staff roles pinged on the 24 hour reminder" },
  ] },
  ticket_queue_update: { title: "Queue update", vars: [
    { token: "{user}", desc: "Mentions the customer" },
    { token: "{position}", desc: "Their place in line, like 3rd" },
    { token: "{previous}", desc: "Where they were before" },
    { token: "{direction}", desc: "up or back" },
  ] },
};

const SESSIONS: Record<string, VariableGroup> = {
  vote: { title: "Vote", vars: [
    { token: "{ping}", desc: "The role that gets pinged" },
    { token: "{votes}", desc: "Votes so far" },
    { token: "{needed}", desc: "Votes needed to pass" },
    { token: "{user}", desc: "Who started the vote" },
  ] },
  start: { title: "Start", vars: [
    { token: "{ping}", desc: "The role that gets pinged" },
    { token: "{user}", desc: "Who started the session" },
    { token: "{started_at}", desc: "When it started" },
  ] },
  boost: { title: "Boost", vars: [
    { token: "{ping}", desc: "The role that gets pinged" },
    { token: "{user}", desc: "Who asked for more players" },
  ] },
  end: { title: "End", vars: [
    { token: "{ping}", desc: "The role that gets pinged" },
    { token: "{user}", desc: "Who ended it" },
    { token: "{started_at}", desc: "When it started" },
    { token: "{started_by}", desc: "Who started it" },
  ] },
};

const SHIFTS: Record<string, VariableGroup> = {
  manage_message: { title: "Shift panel", vars: [
    { token: "{user}", desc: "Mentions the staff member" },
    { token: "{status}", desc: "On shift, on break, or off" },
    { token: "{total_time}", desc: "Time on shift this week" },
    { token: "{break_time}", desc: "Time on break this week" },
    { token: "{quota}", desc: "How much of the weekly quota is done" },
    { token: "{shifts}", desc: "How many shifts this week" },
    { token: "{recent}", desc: "Their last few shifts" },
    { token: "{week_start}", desc: "The Monday the week started" },
  ] },
  leaderboard_message: { title: "Leaderboard", vars: [
    { token: "{leaderboard}", desc: "One line per person, most time first" },
    { token: "{period}", desc: "this week or all time" },
    { token: "{week_start}", desc: "The Monday the week started" },
  ] },
  online_message: { title: "On shift now", vars: [
    { token: "{online}", desc: "One line per person on shift, with how long" },
    { token: "{count}", desc: "How many are on shift" },
  ] },
};

const MUSIC: VariableGroup = {
  title: "Music",
  vars: [
    { token: "{channel}", desc: "The voice channel the bot joined" },
    { token: "{user}", desc: "Who asked it to join" },
  ],
};

/**
 * The variable groups for a block. `key` narrows blocks that hold several
 * designs or fields. Returns an empty list when a block has no variables.
 */
export function variablesFor(addonId: string, key?: string | null): VariableGroup[] {
  switch (addonId) {
    case "invite-message":
      return [JOIN, SERVER];
    case "customs-messages":
    case "customs-announce":
    case "customs-blacklist":
    case "customs-verification":
    case "customs-tickets":
    case "customs-portfolio":
    case "customs-packages":
    case "marketplace":
    case "ticket-message-customization":
    case "ticket-lifecycle-messages":
    case "ticket-editor":
    case "messages":
      return [SERVER];
    case "customs-suggestions":
    case "customs-feedback":
    case "customs-reportbug":
      return [FORM_FIELDS, SERVER];
    case "customs-giveaway":
    case "giveaway-system":
      return [GIVEAWAY, SERVER];
    case "customs-orderlog":
    case "customs-qualitycheck":
      return [FORM_LOG, SERVER];
    case "customs-infraction":
    case "customs-promotion":
      return [FORM_LOG, ROLE_LOG, SERVER];
    case "customs-order-status":
      return [ORDER_STATUS, FORM_FIELDS, SERVER];
    case "customs-payment":
      return [PURCHASE_LOG, SERVER];
    case "customs-pricing":
      return [PRICING, SERVER];
    case "customs-robux-locker":
      return [ROBUX_LOCKER, SERVER];
    case "customs-freerelease":
      return [FREE_RELEASE, SERVER];
    case "ads":
      return key === "giveaway" ? [ADS_GIVEAWAY, SERVER] : key === "regular" ? [ADS_REGULAR, SERVER] : [ADS_REGULAR, ADS_GIVEAWAY, SERVER];
    case "customs-smallui": {
      if (key && SMALL_UI[key]) return [SMALL_UI[key], SERVER];
      return [...Object.values(SMALL_UI), SERVER];
    }
    case "roleplay-sessions": {
      if (key === "panel") return [SERVER];
      if (key && SESSIONS[key]) return [SESSIONS[key], SERVER];
      return [...Object.values(SESSIONS), SERVER];
    }
    case "roleplay-shifts": {
      if (key && SHIFTS[key]) return [SHIFTS[key]];
      return Object.values(SHIFTS);
    }
    case "music-addon":
      return key === "join_message" ? [MUSIC] : [];
    default:
      return [];
  }
}

/** Total number of variables across groups, for the button label. */
export function countVariables(groups: VariableGroup[]): number {
  return groups.reduce((n, g) => n + g.vars.length, 0);
}
