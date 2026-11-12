# Moving Knode Games to a new computer (planned move, old PC still working)

> **Current version (5 Nov 2026)** for the repo `bawcejawn/KnodeGames` and the owner's **three** nodes. The previous version (old repo name, two nodes) is kept privately in the owner's notes. If the old PC is **dead or stolen**, use `.ai/platform/RECOVERY.md` instead.

Players are never affected: their stakes sit in the vault on chain. The website runs on GitHub Pages and the bot on GitHub Actions. The PC holds the **keys** (`.env`), the **three nodes** (game / pool, Desk, personal) and two scheduled tasks (self-heal, question-release backup). Moving means rebuilding those on the new PC, then switching over one node at a time.

---

## A. What to carry over
| From the OLD PC | Why |
|---|---|
| `C:\kprediction\.env` | the keys the owner tools need. Carry it **offline only** — never by email, cloud drive, chat or GitHub — and delete the copy when done |
| (optional) each node's producer key | lets a node keep its registered key and skip the Desk's 48 h re-register wait (`node/backup-producer-keys.ps1`, R-VAULT-10). Without it, each node gets a new key below |

Everything else comes from GitHub or a download: the code, the game data, the chain snapshot. Kondor wallets come back from your own recovery words.

## B. Set up the new PC (the old PC keeps running meanwhile)
1. Install [Git for Windows](https://git-scm.com/download/win), [Node.js LTS](https://nodejs.org) and [Docker Desktop](https://www.docker.com/products/docker-desktop/) (turn on "Start Docker Desktop when you sign in"); restart.
2. **Power:** Settings → System → Power → "When plugged in, put my device to sleep after" → **Never**.
3. **Disk:** about 300 GB free on an SSD during setup (two big nodes plus a snapshot).
4. The project, in PowerShell:
   ```powershell
   git clone https://github.com/bawcejawn/KnodeGames.git C:\kprediction
   cd C:\kprediction
   git branch --show-current
   npm ci --ignore-scripts
   cd game; npm ci --ignore-scripts; npm test; cd ..
   ```
   `npm test` must end with every test passing.
5. Put `.env` into `C:\kprediction\`, then `npm run bot -- status`: the addresses must match `.ai/platform/KEYS_AND_ROLES.md`.

## C. The game / pool node
```powershell
cd C:\kprediction
powershell -ExecutionPolicy Bypass -File node\setup-node.ps1 -Producer 1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr -KeepArchive
npm run bot -- node-status        # repeat until caught up
npm run bot -- register-key node  # dry run: it must show the NEW node's public key
npm run bot -- register-key node --send
```
`setup-node.ps1` downloads Armana's weekly snapshot (check its SHA-256 against a second source), keeps the data in a Docker volume and pins the current Koinos code. About a minute after the register, the pool produces from the new PC; then stop the old game node (`docker compose down` in its `koinos` folder).

## D. The personal node
1. Run `setup-node.ps1` for your personal producer with its own folder, Docker project and ports, e.g. `-Producer <your producer address> -Root C:\koinos-personal -Project koinos-personal -PortOffset 10` (reuse the snapshot from C).
2. `npm run bot -- node-status personal` until caught up; `npm run bot -- node-key personal` prints its **public** key.
3. Register it at **https://knodegames.com/producer.html** with Kondor (or move to a new address and send its VHP over, a small test amount first). Then stop the old personal node.

## E. The Desk node
1. Set it up the same way for the Desk `1FKTpXBhhHEbu5vVchM8UsVbAvPArJsRmR` in its own folder and Docker project (`-Root C:\kpred-desk-node`, its own `-Project` and `-PortOffset`).
2. When caught up: `npm run desk -- register-key node --send` (dry run first), **wait 48 h**, then `npm run desk -- settings apply --send`. Until the apply, the old Desk node keeps producing: stop it only after.

## F. The PC tasks, then finish
1. Create a new fine-grained GitHub token for alerts (this repo only, **Actions: read and write**, never Contents), add it to `.env`, then:
   ```powershell
   powershell -ExecutionPolicy Bypass -File node\install-heal.ps1
   powershell -ExecutionPolicy Bypass -File node\install-release-kick.ps1
   node bot\heal.mjs --test-alert
   ```
2. Revoke the old PC's token in GitHub. Check `npm run bot -- status`, `chain-check`, `npm run desk -- status`, `npm run sponsor -- status`, and tell the Vault chat.
3. After a few days of blocks from the new PC, wipe `.env` and the node folders from the old PC. Nothing changes on GitHub: the bot's `OPERATOR_WIF` secret stays as it is.
