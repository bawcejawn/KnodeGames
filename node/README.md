# Knode Games nodes: self-heal and auto-repair

Three Koinos nodes run on the owner's PC in Docker: the **desk** node (`C:\kpred-desk-node`, Knode Swap), the
**game** node (`C:\kpred-node`, the game pool) and the **personal** node (`C:\koinos-personal`). Every 20 minutes the
Windows task "Knode self-heal" runs `node bot\heal.mjs` (log: `node\heal.log`), and emails through GitHub when it acts.

- **Frozen node** (far behind and not moving): restarted (`docker compose down`, then `up -d`), at most 3 times in 6
  hours, 50 minutes apart.
- **Block store crash loop** (it starts 3+ times in 20 minutes; a restart doesn't cure it): the nodes help each other.
  The broken node's block data is copied from a healthy one with `node\repair-node-data.ps1` (both pause about 5-20
  minutes; the old data is kept as `...-broken-<date>` for 7 days, then deleted). Safety rules:
  - the source is OK (at most 5 blocks behind) at this check and the one before, wasn't restarted in the last
    50 minutes, and wasn't repaired or used as a source in the last 6 hours; order: desk, game, personal;
  - one repair at a time (`node\repair.lock`, stale after 90 minutes); no check restarts the two nodes meanwhile;
  - at most one automatic repair per node per 24 hours; then, or with no healthy source or too little free disk, it
    only emails;
  - an email before it starts and when it ends; the script's output is kept in `node\repair-<node>-<time>.log`.
- **Turn auto-repair off**: add `HEAL_AUTO_REPAIR=off` to `C:\kprediction\.env` (it then only emails, as before).
- **Set up / update the task** (needed once for auto-repair: the task may now run up to 2 hours):
  `powershell -ExecutionPolicy Bypass -File node\install-heal.ps1`
- **See what it would do**: `node bot\heal.mjs --dry-run`
- **Repair by hand**, e.g. the game node from the desk node:
  `powershell -ExecutionPolicy Bypass -File node\repair-node-data.ps1 -Broken game -From desk`
  (`-Broken` / `-From`: `game`, `desk` or `personal`).

## Moving a node's data into a Docker volume

Each node's databases started in a Windows folder (`basedir`) that the Linux containers reach through Docker
Desktop's Windows-to-Linux file bridge: slow for databases and a likely cause of the damaged block stores. A Docker
volume keeps them on Linux's own disk inside WSL2. Move one node at a time (desk first, then game, then personal):

```
powershell -ExecutionPolicy Bypass -File node\move-node-to-volume.ps1 -Node desk -WhatIf   (the plan, changes nothing)
powershell -ExecutionPolicy Bypass -File node\move-node-to-volume.ps1 -Node desk
```

It holds the self-heal's lock, stops the node, copies the whole `basedir` (keys included) into the volume
`<project>-basedir` with a small `alpine:3.20` container, checks the copy (file count, total size, block-producer key),
writes `docker-compose.override.yml` next to `docker-compose.yml` (which stays unchanged: Compose reads the override
automatically and mounts the volume at `/koinos`), starts the node and waits for it to answer. If anything fails
before the start, the override is set aside and the node starts on its old folder. Nothing is deleted: the old
`basedir` folder is the backup (delete it yourself after a week of good running).

- **Roll back**: in the node's `koinos` folder: `docker compose down`, rename `docker-compose.override.yml`,
  `docker compose up -d` (the node runs on its old folder again).
- **A copy that failed halfway**: run again with `-Resume` (it empties the half-filled volume and copies again).
- The self-heal and `repair-node-data.ps1` know volume nodes: they read the block-store log and old backups inside the
  volume, and repairs copy into or out of it with the same small container.

## Backing up the block-producer keys (and restoring one)
Each node signs blocks with its own key, `basedir\block_producer\private.key` (or inside its Docker volume). With an
offline copy, a replacement PC produces at once with the same key: the pool needs no re-registering and the Desk
avoids its 48-hour key wait (`.ai/platform/RECOVERY.md` §2 #4, §4).

```powershell
cd C:\kprediction
powershell -ExecutionPolicy Bypass -File node\backup-producer-keys.ps1 -To E:\
```
It writes `E:\knode-producer-keys-<date>\<game|desk|personal>\private.key`, checks each copy is identical, and prints
**only the public keys**, each checked against the key registered on chain (`tools/producer-keys.ts`, read-only). It
refuses to write into the repository or a node's folder. To restore on a new PC: `node\setup-node.ps1 … -RestoreKey
<that private.key>` (it asks you to confirm the old node is off for good, and never replaces a different key).

**Never run two nodes with the same key at the same time.** Keep the stick offline; never put a key in a chat, an
email or the repository.

## Other scripts
- `setup-node.ps1`: set up a mainnet node and block producer (downloads a checked chain snapshot). See also `.ai/platform/RECOVERY.md`.
- `install-release-kick.ps1`: the PC's backup starter for the Daily Questions release (`bot/release-kick.mjs`).
