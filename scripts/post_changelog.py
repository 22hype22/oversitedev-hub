#!/usr/bin/env python3
"""Post a weekly changelog to #package-updates as the Oversite bot.

Reads a plain-text changelog on stdin. Line prefixes decide the color:
  "+ " -> green   (bug fixes / things added)
  "~ " -> yellow  (updates / changes to existing behavior)
  "- " -> red     (things removed)
Anything else is left uncolored (headers, blank lines).
Posts as one or more Discord `ansi` code blocks (splits under the 2000-char cap).
Token is pulled from the bot's Railway service variables at runtime; never logged.
"""
import json, os, sys, urllib.request

CHANNEL = "1544839523098431618"
RAILWAY = os.environ["RAILWAY_TOKEN"]
PROJ, ENV, SVC = ("64aea150-f8c9-4c5a-8dea-de4763b31b1d",
                  "c5e3fda2-4957-4e4c-986a-7314927ecd0a",
                  "5944f779-7179-4237-b89c-5fcfc7b2b277")

def bot_token():
    q = {"query": f'query {{ variables(projectId: "{PROJ}", environmentId: "{ENV}", serviceId: "{SVC}") }}'}
    req = urllib.request.Request("https://backboard.railway.app/graphql/v2", data=json.dumps(q).encode(),
                                 headers={"Content-Type": "application/json", "Project-Access-Token": RAILWAY, "User-Agent": "oversite-changelog/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)["data"]["variables"]["DISCORD_TOKEN"]

GREEN, YELLOW, RED, RESET = "\x1b[32m", "\x1b[33m", "\x1b[31m", "\x1b[0m"
def color(line):
    if line.startswith("+ "): return GREEN + line + RESET
    if line.startswith("~ "): return YELLOW + line + RESET
    if line.startswith("- "): return RED + line + RESET
    return line

def chunks(lines, limit=1900):
    buf = []
    for ln in lines:
        cand = "\n".join(buf + [ln])
        if len(cand) > limit and buf:
            yield buf; buf = [ln]
        else:
            buf.append(ln)
    if buf: yield buf

def post(token, content):
    body = json.dumps({"content": content, "allowed_mentions": {"parse": []}}).encode()
    req = urllib.request.Request(f"https://discord.com/api/v10/channels/{CHANNEL}/messages", data=body,
                                 headers={"Authorization": f"Bot {token}", "Content-Type": "application/json", "User-Agent": "DiscordBot (https://oversite.shop, 1.0)"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)["id"]

def main():
    raw = sys.stdin.read().rstrip("\n").split("\n")
    lines = [color(l) for l in raw]
    tok = bot_token()
    ids = [post(tok, "```ansi\n" + "\n".join(c) + "\n```") for c in chunks(lines)]
    print("posted message id(s):", ", ".join(ids))

if __name__ == "__main__":
    main()
