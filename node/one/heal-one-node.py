#!/usr/bin/env python3
"""Knode Games "Run a node" - self-heal for ONE Koinos node on a Mac or Linux (https://knodegames.com/run-node.html).

Every 20 minutes (cron) it compares your node's block height with the Koinos network. The rules are the same ones
Knode Games uses for its own nodes (bot/heal.mjs) and the Windows version (heal-one-node.ps1):
  - FROZEN: more than 200 blocks (~10 minutes) behind and not moving since the last check, or no answer at two checks
    in a row, or the node isn't running at all -> full restart (docker compose down, then up -d);
  - behind but moving -> catching up, left alone;
  - after a restart it waits at least 50 minutes before restarting again; after 3 restarts in 6 hours it stops trying;
  - CRASH LOOP: the block store or chain restarted 3+ times since the last check -> no restart (that doesn't cure
    damaged data); it tells you to "Repair from a fresh snapshot" (step 8 of the guide).
It never deletes anything, never touches the node's key, and only asks two read-only questions: "what's your height?"
to your own node and to a public Koinos node. Log: ~/koinos-node/heal.log.

  python3 ~/koinos-node/heal-one-node.py --dry-run     shows what it would do
  python3 ~/koinos-node/heal-one-node.py --install     runs it every 20 minutes (cron)
  python3 ~/koinos-node/heal-one-node.py --uninstall   stops that
  Add --rpc=http://127.0.0.1:8090 to both if you moved your node to another port.
Standard library only (Python 3.8+).
"""
import json, os, shutil, subprocess, sys, time, urllib.request
from datetime import datetime

ARGS = sys.argv[1:]
DRY = "--dry-run" in ARGS
FOLDER = os.path.expanduser(os.environ.get("KG_HEAL_FOLDER", "~/koinos-node"))
RPC = next((a.split("=", 1)[1] for a in ARGS if a.startswith("--rpc=")), os.environ.get("KG_HEAL_RPC", "http://127.0.0.1:8080"))
NETWORK = os.environ.get("KG_HEAL_NETWORK", "https://koinos.armana.io,https://api.koinosblocks.com").split(",")
DOCKER = os.environ.get("KG_HEAL_DOCKER", "docker")
KOINOS = os.path.join(FOLDER, "koinos")
LOG = os.path.join(FOLDER, "heal.log")
STATE = os.path.join(FOLDER, "heal-state.json")
BEHIND, COOLDOWN_MS, MAX_HEALS, WINDOW_MS, NAG_MS, LOOP_RESTARTS = 200, 50 * 60000, 3, 6 * 3600000, 3 * 3600000, 3
CRON_TAG = "# knode-games-heal-one-node"
# cron starts with a tiny PATH; Docker Desktop (Mac) and Homebrew live here.
os.environ["PATH"] = "/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:" + os.environ.get("PATH", "")


def now_ms():
    return int(os.environ["KG_HEAL_NOW"]) if os.environ.get("KG_HEAL_NOW") else int(time.time() * 1000)


def log(msg):
    line = f"{datetime.now():%Y-%m-%d %H:%M}  {msg}"
    print(line)
    if DRY:
        return
    with open(LOG, "a") as f:
        f.write(line + "\n")
    try:
        with open(LOG) as f:
            lines = f.readlines()
        if len(lines) > 3000:
            with open(LOG, "w") as f:
                f.writelines(lines[-2000:])
    except OSError:
        pass


def notify(title, text):
    log(f"NOTICE: {title} - {text}")
    if DRY:
        return
    try:
        if sys.platform == "darwin":
            subprocess.run(["osascript", "-e", f"display notification {json.dumps(text)} with title {json.dumps(title)}"], timeout=10, check=False)
        elif shutil.which("notify-send"):
            subprocess.run(["notify-send", title, text], timeout=10, check=False)
    except Exception:
        pass   # the log still has it


def install():
    if not os.path.exists(os.path.join(KOINOS, "docker-compose.yml")):
        sys.exit(f"No node found in {KOINOS}. Do steps 3-5 of the guide first.")
    me = os.path.abspath(__file__)
    line = f"*/20 * * * * {shutil.which('python3') or '/usr/bin/python3'} {me} --rpc={RPC} >/dev/null 2>&1 {CRON_TAG}"
    old = subprocess.run(["crontab", "-l"], capture_output=True, text=True).stdout if shutil.which("crontab") else None
    if old is None:
        sys.exit("cron isn't installed. On Linux: sudo apt-get install -y cron, then run --install again.")
    keep = [l for l in old.splitlines() if CRON_TAG not in l]
    subprocess.run(["crontab", "-"], input="\n".join(keep + [line]) + "\n", text=True, check=True)
    print("OK  Self-heal is set up: it checks your node every 20 minutes.")
    print(f"    Its log:   {LOG}")
    print(f"    Remove it: python3 {me} --uninstall")


def uninstall():
    old = subprocess.run(["crontab", "-l"], capture_output=True, text=True).stdout
    keep = [l for l in old.splitlines() if CRON_TAG not in l]
    subprocess.run(["crontab", "-"], input=("\n".join(keep) + "\n") if keep else "", text=True, check=True)
    print("OK  Self-heal removed. Your node keeps running; nothing else was changed.")


def height(url, timeout):
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": "chain.get_head_info", "params": {}}).encode()
    req = urllib.request.Request(url, data=body, headers={"content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        h = int(json.load(r)["result"]["head_topology"]["height"])
    if h <= 0:
        raise ValueError("no height in the answer")
    return h


def network_height():
    errors = []
    for u in [NETWORK[0]] + NETWORK:
        try:
            return height(u, 15)
        except Exception as e:
            errors.append(f"{u}: {e}")
    raise RuntimeError("; ".join(errors))


def docker(*a):
    r = subprocess.run([DOCKER, *a], capture_output=True, text=True, timeout=300)
    if r.returncode != 0:
        raise RuntimeError(f"docker {' '.join(a)} failed")
    return [l.strip() for l in r.stdout.splitlines() if l.strip()]


def compose(*a):
    r = subprocess.run([DOCKER, "compose", *a], capture_output=True, text=True, timeout=300, cwd=KOINOS)
    if r.returncode != 0:
        raise RuntimeError(f"docker compose {' '.join(a)} failed")
    return [l.strip() for l in r.stdout.splitlines() if l.strip()]


def read_state():
    s = {"lastHeight": 0, "misses": 0, "heals": [], "lastRestart": 0, "nagAt": 0, "dockerAlert": 0, "restarts": {}}
    try:
        with open(STATE) as f:
            j = json.load(f)
        for k in s:
            if k in j:
                s[k] = j[k]
    except FileNotFoundError:
        pass
    except Exception:
        log("The state file was unreadable; starting fresh.")
    return s


def write_state(s):
    if not DRY:
        with open(STATE, "w") as f:
            json.dump(s, f, indent=1)


def check():
    if not os.path.exists(os.path.join(KOINOS, "docker-compose.yml")):
        log(f"No node found in {KOINOS} - nothing to check.")
        return
    now = now_ms()
    st = read_state()
    st["heals"] = [t for t in st["heals"] if now - t < WINDOW_MS]
    if DRY:
        log("(dry run: nothing is restarted, written or notified)")
    try:
        net = network_height()
    except Exception as e:
        log(f"Can't reach the Koinos network ({e}). Is the internet down? Skipping this check.")
        return
    try:
        docker("info", "--format", "{{.ServerVersion}}")
    except Exception:
        log("Docker isn't running, so the node is stopped.")
        if now - st["dockerAlert"] > NAG_MS:
            notify("Koinos node: Docker isn't running", "Open Docker. Your node starts again with it.")
            st["dockerAlert"] = now
        write_state(st)
        return
    st["dockerAlert"] = 0

    loop = []
    for svc in ("block_store", "chain"):
        try:
            ids = compose("ps", "-q", svc)
            if not ids:
                continue
            n = int(docker("inspect", "-f", "{{.RestartCount}}", ids[0])[0])
            key = f"{svc}|{ids[0]}"
            if key in st["restarts"] and n - st["restarts"][key] >= LOOP_RESTARTS:
                loop.append(f"{svc} restarted {n - st['restarts'][key]} times since the last check")
            st["restarts"] = {k: v for k, v in st["restarts"].items() if not (k.startswith(svc + "|") and k != key)}
            st["restarts"][key] = n
        except Exception:
            pass
    if loop:
        log("CRASH LOOP: " + "; ".join(loop) + ". Not restarting: that doesn't fix damaged data.")
        if now - st["nagAt"] > NAG_MS:
            notify("Koinos node needs a repair", "It keeps crashing. Follow 'Repair from a fresh snapshot' in step 8 of knodegames.com/run-node.html.")
            st["nagAt"] = now
        write_state(st)
        return

    try:
        running = compose("ps", "-q")
    except Exception:
        running = []
    local, why = None, ""
    if not running:
        why = "the node isn't running"
    else:
        try:
            local = height(RPC, 10)
            st["misses"] = 0
        except Exception as e:
            st["misses"] += 1
            if st["misses"] >= 2:
                why = "it hasn't answered at two checks in a row"
            else:
                log(f"The node didn't answer this time ({e}); checking again next time.")
    if local is not None:
        behind = net - local
        if behind > BEHIND and local <= st["lastHeight"]:
            why = f"it is {behind} blocks behind and hasn't moved since the last check"
        elif behind > BEHIND:
            log(f"Catching up: {behind} blocks behind (height {local}, network {net}).")
        else:
            log(f"OK: height {local}, network {net} ({behind} behind).")
        st["lastHeight"] = local

    if why:
        if len(st["heals"]) >= MAX_HEALS:
            log(f"FROZEN ({why}), but it was already restarted {len(st['heals'])} times in 6 hours. Not trying again.")
            if now - st["nagAt"] > NAG_MS:
                notify("Koinos node needs you", "Restarts haven't fixed it. See 'If it keeps crashing' in step 8 of knodegames.com/run-node.html.")
                st["nagAt"] = now
        elif st["lastRestart"] and now - st["lastRestart"] < COOLDOWN_MS:
            log(f"FROZEN ({why}), but it was restarted less than 50 minutes ago. Giving it time.")
        elif DRY:
            log(f"FROZEN ({why}): would restart it now (docker compose down, then up -d).")
        else:
            log(f"FROZEN ({why}): restarting it.")
            try:
                compose("down")
                compose("up", "-d")
                st["heals"].append(now)
                st["lastRestart"] = now
                st["misses"] = 0
                notify("Koinos node restarted", f"It had frozen ({why}). Check it again in 30 minutes.")
            except Exception as e:
                notify("Koinos node: restart failed", f"{e}. Open Docker and see step 8 of knodegames.com/run-node.html.")
    write_state(st)


if __name__ == "__main__":
    if "--install" in ARGS:
        install()
    elif "--uninstall" in ARGS:
        uninstall()
    else:
        check()
