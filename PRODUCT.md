# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Owners and staff of Roblox roleplay communities, overwhelmingly built around
Emergency Response: Liberty County (ER:LC). They run a Discord server and a
private game server together, and most are hobbyists paying out of pocket, not
businesses. The buyer is usually one person: the server owner, who is also the
one who will configure the bot afterwards.

The job at checkout is to work out which Oversite bot covers what their
community actually needs, and to leave with it running rather than with
something to set up later.

## Product Purpose

Oversite sells Discord bots as a service. A customer orders a bot, and Oversite
provisions a dedicated instance for them: its own Discord application, its own
hosted process, and a web dashboard where the customer configures it without
touching code or hosting.

Success is a customer whose bot is in their server doing its job within minutes
of paying, and who can change how it behaves from the dashboard afterwards.

## Positioning

Every customer gets their own bot instance rather than inviting one shared bot.
That is what lets Oversite offer per-customer branding, per-customer
configuration, and features that need the customer's own credentials, such as an
ER:LC private server key.

Oversite Dispatch is the distinctive product: an AI voice dispatcher that sits in
a Discord voice channel, reads live in-game 911 calls aloud in a dispatcher
voice, and answers units who talk back to it.

## Operating Context

- The customer's community lives in Discord; the roleplay happens in the ER:LC
  game server. Both are in use at the same time, and staff move between them.
- Dispatch runs in a Discord voice channel while units are in-game. Units talk
  to it over voice, and can also type `;` commands in game when they are in a
  channel the bot cannot hear them from.
- Configuration happens on the Oversite dashboard: keys, channels, region,
  message designs, and per-feature settings.
- Bots are ordered through a builder on the marketing site: pick a base product,
  add optional add-ons, check out.

## Capabilities and Constraints

- Products today: Protection, Support, Utilities, Customs, Roleplay, Dispatch,
  and an all-in-one pack. Base products and add-ons are priced separately.
- Dispatch can run as one of three desks: police, fire and EMS, or Department of
  Transportation. The desks share one codebase and differ in which in-game teams
  are theirs and what work they do; fire and DOT do not run plates, names or
  warrants, do not work traffic stops, and do not run pursuits.
- The desks pass requests between each other. A police unit asking for an
  ambulance reaches the fire desk; a fire unit asking for a tow reaches DOT.
  With only one desk in the server, the request goes out on that desk's own
  channel instead.
- **Each desk must be a separate bot.** Discord permits one voice connection per
  server per bot, so one process cannot hold a police channel and a fire channel
  at the same time. A customer buying two desks is buying two bot instances.
- Each bot instance needs its own Discord application and token, which the
  customer creates. This is an unavoidable step in setup, not a product choice.
- Prices for the desks are set by the operator in a settings screen, not fixed in
  code. Whether taking more than one desk carries a bundle price is an operator
  decision, so no price or saving may be hardcoded or invented.
- Support is a Discord server, `discord.gg/ovs`. The storefront is
  `oversite.shop`.

## Brand Commitments

- Name: Oversite. Products are named "Oversite <thing>".
- Built by 22HYPE22, shown alongside the Oversite name in each bot's `/info`.
- Bot-authored messages avoid emoji, em dashes, and parentheses.
- The dashboard and site use semantic color tokens defined in `src/index.css`
  and `tailwind.config.ts`; components never carry raw hex.

## Evidence on Hand

- A live storefront and builder: `src/components/site/BotBuilder.tsx`.
- A live customer dashboard: `src/pages/BotDashboard.tsx`.
- Real running bots, real customers, and a real order table (`bot_orders`).
- No testimonials, case studies, press, benchmarks or customer counts are
  confirmed. None may be invented.
- Fire and DOT desks work in the bot today but are not yet sellable: nothing in
  the storefront offers them and nothing provisions them.

## Product Principles

1. A customer should leave checkout with a working bot, not a to-do list.
2. Say plainly what a thing does and does not do. A fire desk that cannot run a
   plate should say so rather than inventing an answer.
3. Anything an operator might reprice or rename belongs in settings, not in code.
4. One bot per customer per job. Shared instances are the thing Oversite is not.
5. Never claim a capability, a price, or a customer the product does not have.

## Accessibility & Inclusion

No product-specific standard has been established beyond keeping the storefront
and dashboard usable at phone widths, which customers do use.
