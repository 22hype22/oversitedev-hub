# Weekly changelog → Discord #package-updates

Every **Monday morning** a recap of the previous week goes to
`#package-updates` (channel `1544839523098431618`) **as the Oversite bot**.
Only the weekly recap is posted there, nothing else.

## The running draft (how changes are remembered)

`docs/changelog-draft.txt` is the source of truth for the next post. A line is
added there **the moment a change ships**, in the customer-facing wording below,
so Monday's post is not reconstructed from memory.

**No duplicates.** One line per feature for the whole week. If a feature is
changed and then adjusted again, **edit its existing line** to describe the end
result. Never add a second line for the same thing. (Example: "Added a Delay
button on ads" adjusted later to also retrofit old cards is still one line:
"Added a Delay button on ad approvals so you can pick the day an ad goes out".)

On Monday the job: cross-checks the draft against the week's git log for
anything missed, posts it, archives it to `docs/changelogs/<date>.txt`, and
resets the draft with next week's empty boxes.

## Layout

**One box per bot.** A line starting with `## ` starts a new box (its own code
block, posted as its own message) and becomes the box's first line:

```
## Oversite Network  ·  Weekly Update  ·  Aug 27 – Sep 2
```

Boxes to use, in this order, skipping any with no changes that week:
Oversite Network, Oversite Protection, Oversite Support, Oversite Utilities,
Oversite Dispatch, Oversite Customs, then **Website & Dashboard**.

## Colors

Every line starts with `+ ` or `- `. The color comes from the wording:

| line looks like        | color  | use for                               |
|------------------------|--------|---------------------------------------|
| `+ Added ...` / `+ ...` | green  | things added or changed               |
| `+ Fixed bug where ...` | orange | bug fixes                             |
| `- Removed ...`         | red    | things taken out                      |

Inside a box, list added/changed lines first, then fixes, then removals.

## Voice — write it like a person

Model the wording on this real post:

```
+ Fixed bug where gamepasses did not give their respective items to players who bought them
+ Fixed bug where people who bought gamepasses before they were updated lost access to those items
```

- Start fixes with `Fixed bug where …`, additions with `Added …`, changes with a plain sentence.
- Say what it means for the customer, not the commit title. No internal terms
  (no "uvloop", "IDOR", "RLS", "skeletons", "backoff").
- No emojis, no em dashes, no parentheses full of detail. Commas and plain words.
- Short, one line per item.

## Posting

```
RAILWAY_TOKEN=... python3 scripts/post_changelog.py < changelog.txt
# to replace a previous post: DELETE_IDS=<id>,<id> ... same command
```

The script reads the bot's `DISCORD_TOKEN` from the Railway service variables
at runtime (never stored) and posts one message per box.

## Gathering the week

```
git -C /path/to/oversite-customs log --since="7 days ago" --format="%ad  %s" --date=short main
git -C /path/to/oversitedev-hub  log --since="7 days ago" --format="%ad  %s" --date=short origin/redesign
```

The bot repo is the Oversite Network bot. Dashboard commits that are about one
bot (e.g. Dispatch config blocks) go in that bot's box; site-wide ones go in
Website & Dashboard.

## Routine prompt (for the durable weekly schedule)

Create a Routine (fresh session, env: Oversite Ad, which carries RAILWAY_TOKEN)
on a weekly cron for Monday morning (e.g. 9:04 AM) with this prompt:

> Post the weekly changelog to Discord. Read `docs/weekly-changelog.md` in the
> oversitedev-hub repo and follow it exactly: start from `docs/changelog-draft.txt`,
> cross-check it against the last 7 days of commits from oversite-customs `main`
> and oversitedev-hub `redesign` for anything missed, keep one line per feature
> (merge repeat adjustments into a single line, never duplicate), one box per
> bot plus a Website & Dashboard box, green for added/changed lines, orange for
> `+ Fixed bug where` lines, red for `- Removed` lines, in plain human wording like "Fixed bug where …",
> no emojis or em dashes, then post with `python3 scripts/post_changelog.py`,
> archive the draft to `docs/changelogs/<date>.txt`, reset the draft with next
> week's empty boxes, and commit that to both `claude/happy-ritchie-stxxpu` and
> `redesign`. Post only the recap and only in channel 1544839523098431618. Skip
> boxes with no changes; if nothing changed at all, post nothing.
