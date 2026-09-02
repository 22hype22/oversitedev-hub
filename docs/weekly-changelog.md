# Weekly changelog → Discord #package-updates

Every week a recap of what changed on the bot and the dashboard is posted to
`#package-updates` (channel `1544839523098431618`) **as the Oversite bot**. Only
the weekly recap goes in that channel.

## Format

One Discord `ansi` code block (the poster splits it if it passes 2000 chars).
Line prefixes decide the color:

| prefix | color  | use for                                   |
|--------|--------|-------------------------------------------|
| `+ `   | green  | bug fixes and things added                |
| `~ `   | yellow | updates / changes to existing behavior    |
| `- `   | red    | things removed                            |

Header lines (`Weekly Update · <dates>`, `Bot`, `Website / Dashboard`) stay
uncolored. Plain English, one line per item, written for customers — say what it
means for them, not the commit title. No emojis.

## Posting

```
RAILWAY_TOKEN=... python3 scripts/post_changelog.py < changelog.txt
```

The script pulls the bot's `DISCORD_TOKEN` from the Railway service variables at
runtime (never stored in the repo) and posts the block(s).

## Gathering the week

```
git -C /path/to/oversite-customs log --since="7 days ago" --format="%ad  %s" --date=short main
git -C /path/to/oversitedev-hub  log --since="7 days ago" --format="%ad  %s" --date=short origin/redesign
```

## Routine prompt (for the durable weekly schedule)

Create a Routine (fresh session, env: Oversite Ad — it carries RAILWAY_TOKEN)
on a weekly cron, e.g. Sunday 8:04 PM, with this prompt:

> Post the weekly changelog to Discord. Read `docs/weekly-changelog.md` in the
> oversitedev-hub repo and follow it exactly: gather the last 7 days of commits
> from the oversite-customs `main` branch and the oversitedev-hub `redesign`
> branch, write a customer-facing recap in the `+ / ~ / -` format (green fixes
> and additions, yellow changes, red removals; sections "Bot" and
> "Website / Dashboard"; no emojis), then post it to channel 1544839523098431618
> with `python3 scripts/post_changelog.py`. Post only the recap and only in that
> channel. If there were no changes in a section, omit the section.
