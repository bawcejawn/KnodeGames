# Results seal: the publish jobs sign the vault results files (owner steps)

**Why (audit AB-058).** The hourly bot pays each game's weekly bucket from a results file, and checks it against the game's board. Both files sit on a data branch (`race-data`, `games-data`). Anything able to push to that branch could replace both, and the bot would post them with the operator key. So each publish job now **seals** what it publishes, and the bot posts only sealed files.

**How it works.**
- **The five publish jobs seal what they publish.** They are `race.yml` publish, `games.yml` publish, `golf.yml` publish, `combo.yml` publish and `kit-games.yml` publish-kit.
  - They run the same lines, `kit/publish/results-seal.sh`.
  - Each `vault/W<n>.json`, `vault/RELEASE-W<n>.json` and `board.json` that the run itself publishes gets a `<file>.seal` next to it.
  - The seal is an Ed25519 signature over `knodegames-results-v1`, the file's place (`<branch>:<path>`) and its exact bytes.
  - The key is the repository secret `RESULTS_SEAL_KEY`. Only those five jobs may read it (`tests/audit/site.ci-deps.test.mjs`).
- **The bot checks the seal.** Once `game-data/deployment.json` has `"resultsSealKey"` (the public key), the hourly bot:
  - **holds** a week whose results file or board isn't sealed with that key;
  - keeps a hold whose RELEASE file isn't sealed;
  - **won't finalize** a sealed week whose file isn't sealed.

  Each case emails you once.
- **What a seal can't do.** It doesn't make a file correct. It proves the file came from a publish job. The two-node chain checks (AB-060, AB-065) still apply to every sealed file.

## Steps (about 10 minutes; never paste the private key into a chat)
1. **Make the key** on your PC, after this change is on `main`:
   ```powershell
   cd C:\kprediction
   git branch --show-current
   git pull
   node tools/results-seal-key.mjs
   ```
   It prints where it wrote the **private** key (a file in your home folder, `knodegames-results-seal-key.txt`, never in the repo). It also prints the **public** key, one line, which is safe to share.
2. **Store the private key in GitHub:**
   1. Go to GitHub → KnodeGames → **Settings** → **Secrets and variables** → **Actions**, and click **New repository secret**.
   2. Name it `RESULTS_SEAL_KEY`. In Secret, open the file in Notepad, copy **all** of it (from `-----BEGIN PRIVATE KEY-----` to `-----END PRIVATE KEY-----`), paste it, and click **Add secret**.
   3. **Delete the file.**
3. **Check the publish jobs seal.** Within the hour, each game's publish run (Actions tab: Producer Race, KnodeGames recorders, Block Golf, Combo Card, kit games) shows no `RESULTS_SEAL_KEY is not set` warning. The data branches then show `board.json.seal` files.
4. **Give the public key to the chat.** It goes into `game-data/deployment.json` as `"resultsSealKey"` in a small PR. Merge it only after step 3 shows seals on both branches: from then on the bot **holds** any unsealed week.

## If something is wrong
- **The bot emails "… isn't sealed by the publish job …".**
  - If no one changed the data branch, check that the secret exists (step 2) and that the last publish run of that game succeeded.
  - If someone did change it, treat it as an attack: the Vault chat, now.
  - The week holds; nothing is paid from it.
- **A publish run fails with "could not seal … (check the RESULTS_SEAL_KEY secret)":** the secret isn't a valid key. Redo steps 1 and 2. Nothing went out half sealed.
- **The key leaked, or you want a new one:**
  1. Redo step 1 (delete the old file first).
  2. Replace the secret.
  3. Send the new public key to the chat.

  Until `deployment.json` has the new public key, weeks published with the new key hold. Do it early in the week.
- **To post a week by hand**, run `npm run bot -- game-post <id> <week> <folder>` with a folder you name: no seal is needed, because you decide. Without a folder it reads the branch and checks the seal.
