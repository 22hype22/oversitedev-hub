#!/usr/bin/env python3
"""Post the weekly changelog to #package-updates as the Oversite bot.

Input (stdin): plain text. A line starting with "## " starts a NEW BOX (its own
code block / message) and becomes that box's first line. Inside a box:
  "+ " -> green   (bug fixes / things added)
  "~ " -> yellow  (updates / changes to existing behavior)
Anything else is left uncolored. Red/minus is intentionally not used.
Each box is posted as its own message so every bot gets its own box.
The bot token comes from the Railway service variables at runtime; never logged.
"""
import json, os, sys, urllib.request

CHANNEL = "1544839523098431618"
RAILWAY = os.environ["RAILWAY_TOKEN"]
PROJ, ENV, SVC = ("64aea150-f8c9-4c5a-8dea-de4763b31b1d",
                  "c5e3fda2-4957-4e4c-986a-7314927ecd0a",
                  "5944f779-7179-4237-b89c-5fcfc7b2b277")
UA_RW = "oversite-changelog/1.0"
UA_DC = "DiscordBot (https://oversite.shop, 1.0)"

def bot_token():
    q = {"query": f'query {{ variables(projectId: "{PROJ}", environmentId: "{ENV}", serviceId: "{SVC}") }}'}
    req = urllib.request.Request("https://backboard.railway.app/graphql/v2", data=json.dumps(q).encode(),
                                 headers={"Content-Type": "application/json", "Project-Access-Token": RAILWAY, "User-Agent": UA_RW})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)["data"]["variables"]["DISCORD_TOKEN"]

GREEN, YELLOW, RESET = "\x1b[32m", "\x1b[33m", "\x1b[0m"
def color(line):
    if line.startswith("+ "): return GREEN + line + RESET
    if line.startswith("~ "): return YELLOW + line + RESET
    return line

def boxes(text):
    cur = []
    for ln in text.rstrip("\n").split("\n"):
        if ln.startswith("## "):
            if cur: yield cur
            cur = [ln[3:]]
        else:
            cur.append(ln)
    if cur: yield cur

def post(token, content):
    body = json.dumps({"content": content, "allowed_mentions": {"parse": []}}).encode()
    req = urllib.request.Request(f"https://discord.com/api/v10/channels/{CHANNEL}/messages", data=body,
                                 headers={"Authorization": f"Bot {token}", "Content-Type": "application/json", "User-Agent": UA_DC})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)["id"]

def delete(token, mid):
    req = urllib.request.Request(f"https://discord.com/api/v10/channels/{CHANNEL}/messages/{mid}", method="DELETE",
                                 headers={"Authorization": f"Bot {token}", "User-Agent": UA_DC})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status

def main():
    tok = bot_token()
    for mid in (os.environ.get("DELETE_IDS") or "").split(","):
        if mid.strip(): print("deleted", mid.strip(), delete(tok, mid.strip()))
    text = sys.stdin.read()
    ids = []
    for box in boxes(text):
        # strip trailing blank lines inside a box
        while box and not box[-1].strip(): box.pop()
        content = "```ansi\n" + "\n".join(color(l) for l in box) + "\n```"
        if len(content) > 1990: raise SystemExit(f"box too long ({len(content)} chars): {box[0]}")
        ids.append(post(tok, content))
    print("posted message id(s):", ", ".join(ids))

if __name__ == "__main__":
    main()
