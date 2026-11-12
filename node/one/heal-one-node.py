#!/usr/bin/env python3
"""Knode Games "Run a node" - self-heal for ONE Koinos node on a Mac or Linux (https://knodegames.com/run-node.html).

Every 20 minutes (cron) it compares your node's block height with the Koinos network. The rules are the same ones
Knode Games uses for its own nodes (bot/heal.mjs) and the Windows version (heal-one-node.ps1):
  - FROZEN: more than 200 blocks (~10 minutes) behind and not moving since the last check, or no answer at two checks
    in a row, or its containers exist but none is running at two checks in a row -> full restart (down, then up -d);
  - behind but moving -> catching up, left alone;
  - STOPPED ON PURPOSE: no containers at all (someone ran "docker compose down" to repair, update or stop) -> it never
    starts the node; it reminds you every 3 hours. A file named heal-paused in the folder pauses it completely (the
    guide's repair, stop and update boxes create it; starting the node removes it);
  - after a restart (even one that failed) it waits at least 50 minutes; after 3 tries in 6 hours it stops trying;
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
import json, os, shlex, shutil, subprocess, sys, time, urllib.request
from datetime import datetime

ARGS = sys.argv[1:]
DRY = "--dry-run" in ARGS
FOLDER = os.path.expanduser(os.environ.get("KG_HEAL_FOLDER", "~/koinos-node"))
RPC = next((a.split("=", 1)[1] for a in ARGS if a.startswith("--rpc=")), os.environ.get("KG_HEAL_RPC", "http://127.0.0.1:8080"))
NETWORK = os.environ.get("KG_HEAL_NETWORK", "https://koinos.armana.io,https://api.koinosblocks.com").split(",")
DOCKER = os.environ.get("KG_HEAL_DOCKER", "docker")
KOINOS = os.path.join(FOLDER, "koinos")
LOG = os.path.join(FOLDER, "heal.log")
PAUSE = os.path.join(FOLDER, "heal-paused")
LOCK = os.path.join(FOLDER, "heal.lock")
STATE = os.path.join(FOLDER, "heal-state.json")
BEHIND, COOLDOWN_MS, MAX_HEALS, WINDOW_MS, NAG_MS, LOOP_RESTARTS = 200, 50 * 60000, 3, 6 * 3600000, 3 * 3600000, 3
CRON_TAG = "# knode-games-heal-one-node"
# cron starts with a tiny PATH; Docker Desktop (Mac) and Homebrew live here.
# cron's PATH is tiny: keep it first, then add where Docker Desktop's CLI may live (~/.docker/bin for a "User" install,
# or inside the app) and Homebrew.
os.environ["PATH"] = ":".join([x for x in [os.environ.get("PATH", ""), os.path.expanduser("~/.docker/bin"),
                               "/Applications/Docker.app/Contents/Resources/bin", "/usr/local/bin", "/opt/homebrew/bin",
                               "/usr/bin", "/bin", "/usr/sbin", "/sbin"] if x])


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
    py = shutil.which("python3") or "/usr/bin/python3"
    for v in (me, py, RPC, FOLDER):
        if "%" in v or "\n" in v or "\r" in v:
            sys.exit("A path or --rpc can't contain % or a line break (cron can't run it). Move the folder or change --rpc.")
    line = (f"*/20 * * * * KG_HEAL_FOLDER={shlex.quote(FOLDER)} {shlex.quote(py)} {shlex.quote(me)} "
            f"{shlex.quote('--rpc=' + RPC)} >/dev/null 2>&1 {CRON_TAG}")
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


NUMS = ("lastHeight", "misses", "lastRestart", "nagAt", "dockerAlert", "failAt", "stopAt", "healDownAt", "psFail", "psNagAt")


def read_state(now):
    s = {"lastHeight": 0, "misses": 0, "heals": [], "lastRestart": 0, "nagAt": 0, "dockerAlert": 0, "failAt": 0, "stopAt": 0, "healDownAt": 0, "psFail": 0, "psNagAt": 0, "restarts": {}}
    try:
        with open(STATE) as f:
            j = json.load(f)
        num = lambda v: isinstance(v, int) and not isinstance(v, bool)
        if not isinstance(j, dict):
            raise ValueError("not an object")
        for k in NUMS:
            if k in j:
                if not num(j[k]):
                    raise ValueError(k)
                s[k] = j[k]
        if "heals" in j:
            if not (isinstance(j["heals"], list) and all(num(t) for t in j["heals"])):
                raise ValueError("heals")
            s["heals"] = j["heals"]
        if "restarts" in j:
            if not (isinstance(j["restarts"], dict) and all(num(v) for v in j["restarts"].values())):
                raise ValueError("restarts")
            s["restarts"] = j["restarts"]
    except FileNotFoundError:
        pass
    except Exception:
        log("The state file was unreadable; starting fresh.")
        s = {"lastHeight": 0, "misses": 0, "heals": [], "lastRestart": 0, "nagAt": 0, "dockerAlert": 0, "failAt": 0, "stopAt": 0, "healDownAt": 0, "psFail": 0, "psNagAt": 0, "restarts": {}}
    # A time later than now (the clock was fast and was corrected) would block restarts until it caught up: drop it.
    s["heals"] = [t for t in s["heals"] if t <= now]
    for k in ("lastRestart", "nagAt", "dockerAlert", "failAt", "stopAt", "healDownAt", "psNagAt"):
        if s[k] > now:
            s[k] = 0
    return s


def write_state(s):
    if not DRY:
        with open(STATE, "w") as f:
            json.dump(s, f, indent=1)


def check():
    if not os.path.exists(os.path.join(KOINOS, "docker-compose.yml")):
        log(f"No node found in {KOINOS} - nothing to check.")
        return
    # The pause file (made by the guide's repair, stop and update boxes) only counts while none of the node's containers
    # is running: once the node runs again, a forgotten pause file can't switch the self-heal off.
    if os.path.exists(PAUSE):
        try:
            up = compose("ps", "-q")
        except Exception:
            up = []
        if not up:
            log(f"Paused (heal-paused is in {FOLDER} and the node isn't running): not checking.")
            return
        log(f"heal-paused is in {FOLDER}, but the node is running again, so checking as usual.")
    now = now_ms()
    st = read_state(now)
    st["heals"] = [t for t in st["heals"] if now - t < WINDOW_MS]
    if DRY:
        log("(dry run: nothing is restarted, written or notified)")
    try:
        net = network_height()
    except Exception as e:
        log(f"Can't reach the Koinos network ({e}). Is the internet down? Skipping this check.")
        return
    if not shutil.which(DOCKER):
        log("docker isn't on this computer's PATH for the scheduled check (cron). Docker may be fine: see step 8's tips.")
        write_state(st)
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
        everything = compose("ps", "-a", "-q")
        running = compose("ps", "-q")
    except Exception:
        # Docker answers but can't list this node (a broken settings file, say). Say so after 3 checks in a row, every 3 h.
        st["psFail"] += 1
        log(f"Couldn't list the node's containers this time ({st['psFail']} in a row); checking again next time.")
        if st["psFail"] >= 3 and now - st["psNagAt"] > NAG_MS:
            notify("Koinos node: can't check it", "Docker is running but can't list your node. See heal.log and 'What can go wrong' on knodegames.com/run-node.html.")
            st["psNagAt"] = now
        write_state(st)
        return
    st["psFail"] = 0
    local, why = None, ""
    if not everything and st["healDownAt"]:
        # No containers because the self-heal's OWN restart ran "docker compose down" and its "up" didn't finish: try
        # again (within the same 50-minute wait and 3-in-6-hours limit below). This is not a stop on purpose.
        why = "the self-heal's own restart didn't finish (no containers since it stopped the node)"
    elif not everything:
        # No containers at all: someone ran "docker compose down" (a repair, an update, or a stop). Never start it.
        log("The node is stopped (no containers: stopped on purpose). Not starting it.")
        if now - st["stopAt"] > NAG_MS:
            notify("Koinos node is stopped", "Start it with step 5a of knodegames.com/run-node.html when you're ready.")
            st["stopAt"] = now
        st["misses"] = 0
        write_state(st)
        return
    else:
        st["stopAt"] = 0
        st["healDownAt"] = 0
    if why:
        pass
    elif not running:
        st["misses"] += 1
        if st["misses"] >= 2:
            why = "its containers exist but none has been running at two checks in a row"
        else:
            log("None of the node's containers is running; checking again next time.")
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
                notify("Koinos node needs you", "Restarts haven't fixed it. See 'What can go wrong' on knodegames.com/run-node.html, and heal.log.")
                st["nagAt"] = now
        elif st["lastRestart"] and now - st["lastRestart"] < COOLDOWN_MS:
            log(f"FROZEN ({why}), but it was restarted less than 50 minutes ago. Giving it time.")
        elif DRY:
            log(f"FROZEN ({why}): would restart it now (docker compose down, then up -d).")
        else:
            log(f"FROZEN ({why}): restarting it.")
            # Counted before trying, so a restart that fails still waits 50 minutes and counts toward the limit.
            st["heals"].append(now)
            st["lastRestart"] = now
            st["healDownAt"] = now
            st["misses"] = 0
            write_state(st)
            try:
                compose("down")
                compose("up", "-d")
                st["healDownAt"] = 0
                notify("Koinos node restarted", f"It had frozen ({why}). Check it again in 30 minutes.")
            except Exception as e:
                log(f"The restart failed: {e}")
                if now - st["failAt"] > NAG_MS:
                    notify("Koinos node: restart failed", "Open Docker, then see 'What can go wrong' on knodegames.com/run-node.html.")
                    st["failAt"] = now
    write_state(st)


if __name__ == "__main__":
    if "--install" in ARGS:
        install()
    elif "--uninstall" in ARGS:
        uninstall()
    elif not os.path.isdir(FOLDER):
        check()   # says there's no node here
    else:
        import fcntl
        with open(LOCK, "a") as lk:
            try:
                fcntl.flock(lk, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except OSError:
                print("Another check is still running; skipping this one.")
                sys.exit(0)
            check()
