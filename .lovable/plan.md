# Offline Bot Dashboard Lockout

## Goal
When a bot's `effective_status` is `offline` (from `bot_runtime_status`), grey out and disable every interactive element below the Controls panel. The Start button in Controls must stay active so the user can bring the bot back online. Everything re-enables automatically when the bot comes back online.

## Approach

1. **Read health status in `BotSection`**
   - Import and call `useBotHealth(bot.id)` inside `BotSection`.
   - Derive `isOffline = health?.effective_status === 'offline'` (only when health is loaded; do not lock while loading).

2. **Restructure JSX in `BotDashboard.tsx`**
   - The Controls panel (`BotControlsPanel`) is inside the first `<details>` ("Manage this bot").
   - Everything after it in that details + the entire second `<details>` ("Add-on configuration") must be wrapped in a lockout container.
   - Move the closing `</div></details>` of the first section so that the lockout wrapper starts right after `BotControlsPanel` and spans both the remainder of the first details and the entire second details.

3. **Visual lockout layer**
   - Wrap the post-Controls content in a `<div className="relative">`.
   - When `isOffline`:
     - Apply `opacity-40 pointer-events-none` to the wrapper content.
     - Render a subtle top banner inside the wrapper:  
       `"Bot is offline — start the bot to make changes."`
       Style: muted background, small text, centered.
   - Do NOT wrap `BotControlsPanel` itself — Start must remain clickable.

4. **What gets disabled**
   - `BotInviteLinkCard`
   - `BotServerSlotsCard`
   - `BotUsageMetricsPanel`
   - `DashboardServerSelector`
   - All `AddonConfigCard` instances
   - `SortableAddonGrid` (drag handles, inputs, save buttons)
   - `GiveawayLaunchCard`
   - Any buttons or inputs inside the above

5. **Real-time re-enable**
   - `useBotHealth` already polls every 30 seconds.
   - When `effective_status` changes from `offline` → anything else, `isOffline` becomes `false` and the lockout layer disappears automatically.

## Files changed
- `src/pages/BotDashboard.tsx` — add `useBotHealth`, restructure `BotSection` JSX, add lockout wrapper + banner.

## Technical details
- `pointer-events-none` on the wrapper disables clicks on all nested interactive elements without touching individual components.
- `opacity-40` provides the greyed-out look.
- The banner is rendered as a sibling inside the wrapper, above the content, so it remains readable.
