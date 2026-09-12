#!/usr/bin/env python3
"""Deploy the latest commit of a bot repo to EVERY Railway service built from it.

Two dispatch services have no GitHub trigger and Railway's project token cannot
create one, so a push only auto-deploys some services. Run this after every push
so every customer's bot gets the update.

Usage: deploy_all.py <owner/repo> [...]   |   deploy_all.py --all
       deploy_all.py --list              (show services, repos, current commits)
"""
import json, os, sys, urllib.request

TOKEN = os.environ["RAILWAY_TOKEN"]
ENV = "c5e3fda2-4957-4e4c-986a-7314927ecd0a"
PROJECT = "64aea150-f8c9-4c5a-8dea-de4763b31b1d"
BOT_REPOS = ["22hype22/oversite-customs", "22hype22/oversite-dispatch", "22hype22/oversite-protection",
             "22hype22/oversite-support", "22hype22/oversite-utilities", "22hype22/oversite-roleplay"]


def gql(query, variables=None):
    req = urllib.request.Request(
        "https://backboard.railway.app/graphql/v2",
        data=json.dumps({"query": query, "variables": variables or {}}).encode(),
        headers={"Project-Access-Token": TOKEN, "Content-Type": "application/json",
                 "User-Agent": "oversite-deployall/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def services():
    d = gql("""query($p:String!){project(id:$p){services{edges{node{id name serviceInstances{edges{node{source{repo}}}}}}}}}""",
            {"p": PROJECT})
    out = []
    for e in d["data"]["project"]["services"]["edges"]:
        n = e["node"]
        inst = (n["serviceInstances"]["edges"] or [{}])[0].get("node", {}) or {}
        repo = ((inst.get("source") or {}).get("repo") or "")
        out.append((n["id"], n["name"], repo))
    return out


def latest(sid):
    d = gql("""query($p:String!,$e:String!,$s:String!){deployments(first:1,input:{projectId:$p,environmentId:$e,serviceId:$s}){edges{node{status createdAt meta}}}}""",
            {"p": PROJECT, "e": ENV, "s": sid})
    edges = d["data"]["deployments"]["edges"]
    if not edges:
        return None
    n = edges[0]["node"]
    m = n.get("meta") or {}
    return {"status": n["status"], "at": n["createdAt"][:16],
            "sha": str(m.get("commitHash") or "")[:7], "msg": str(m.get("commitMessage") or "").split("\n")[0][:50]}


def main():
    args = sys.argv[1:]
    svcs = services()
    if not args or args[0] == "--list":
        for sid, name, repo in svcs:
            info = latest(sid) or {}
            print(f"{name:<30} {repo:<32} {info.get('status',''):<9} {info.get('sha','')} {info.get('msg','')}")
        return
    wanted = BOT_REPOS if args[0] == "--all" else args
    wanted = {w.lower() for w in wanted}
    hit = 0
    for sid, name, repo in svcs:
        if repo.lower() not in wanted:
            continue
        hit += 1
        r = gql("""mutation($s:String!,$e:String!){serviceInstanceDeploy(serviceId:$s,environmentId:$e,latestCommit:true)}""",
                {"s": sid, "e": ENV})
        ok = (r.get("data") or {}).get("serviceInstanceDeploy")
        print(f"{name:<30} {repo:<32} -> {'deploying' if ok else json.dumps(r)[:120]}")
    if not hit:
        print(f"no services build from {sorted(wanted)}")


main()
