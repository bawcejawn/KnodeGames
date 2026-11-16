# Recorder backstop: the "kg-dispatch" Cloudflare Worker (owner steps)

**Why:** GitHub doesn't guarantee scheduled runs. On Fri 13 and Sat 14 Nov 2026 it dropped most of `race.yml`'s hourly runs. The current race then had no card, so the Block X page showed no producers.

This Worker checks whether the ruler's data job, the two recorders and the race's VHP sampler ran. If one didn't, it starts it once, exactly like pressing **Run workflow** by hand:

| When (each hour) | Workflow | GitHub's own timer |
|---|---|---|
| :22 | `vhp-ruler.yml` (the ruler's data; every ruler game's cards wait on it) | :12 |
| :41 | `race.yml` | :37 |
| :51 | `games.yml` | :47 |
| :07 and :37 | `race-samples.yml` (the race's VHP samples, which the race cards use) | every 15 minutes |
| :07 and :37 | `kit-games.yml` (the Shared Game Kit's games, Fantasy; its jobs were in `games.yml` until Mon 16 Nov) | :57 |

- **"Ran":** a run of that workflow on `main` created in the last 30 minutes (45 for `kit-games.yml`, so a normal :57 run is never doubled). That counts a scheduled run, a manual run, or one this Worker started.
- **A trigger it doesn't know** (for example one typed as `37,7 * * * *`) is an error: the run shows as failed in Cloudflare and Logs says `no job for cron …`.
- **What stays as it is:** GitHub's timers stay on. The workflows' concurrency groups make sure two runs never overlap.
- **What it never touches:** files, settings and the workflows themselves.
- **No web address:** the Worker has no working web page, so nobody can start a run through it.
- **Code:** `tools/cloudflare/kg-dispatch-worker.js`. **Tests:** `tests/audit/dispatch-worker.test.mjs`.

## Steps (about 15 minutes; never paste the token into a chat)

**1. Make the GitHub token**
1. Go to github.com → your picture → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. **Name:** `kg-dispatch`. **Expiration:** 90 days. Put a calendar reminder 1 week before it expires.
3. **Repository access:** "Only select repositories" → `bawcejawn/KnodeGames`.
4. **Permissions:** **Actions: Read and write**. Leave everything else at "No access". GitHub adds Metadata: Read by itself.
5. **Generate**, then copy the token. You'll paste it once, in step 2.4, and nowhere else.

**2. Make the Worker**
1. Go to Cloudflare → **Compute (Workers)** → **Create** → **Create Worker**. Name it `kg-dispatch`, then **Deploy**.
2. Click **Edit code**, delete everything, paste the whole of `tools/cloudflare/kg-dispatch-worker.js` from `main`, then **Deploy**.
3. Go to **Settings** → **Domains & Routes**. If a `workers.dev` address is on, you can leave it: the Worker answers 404 to every web request.
4. Go to **Settings** → **Variables and Secrets** → **Add**. Type: **Secret**. Name: `GH_DISPATCH_TOKEN`. Value: the token from step 1. Then **Deploy**.
5. Go to **Settings** → **Trigger Events** (called "Cron Triggers" in some views) → **Add**. Add `22 * * * *`, then `41 * * * *`, then `51 * * * *`, then `7,37 * * * *`. Save.

**3. Check it** (the next hour)
- In Cloudflare, open **kg-dispatch** → **Logs**. At :41 and :51 you should see `kg-dispatch: race.yml: already ran in the last 30 minutes …` (or `… started one`), and the same for `games.yml`; at :22, for `vhp-ruler.yml`; at :07 and :37, two lines: `race-samples.yml` and `kit-games.yml`.
- In GitHub → **Actions**, a run this Worker started shows **workflow_dispatch** as its event.

## If something is wrong
- **The logs show "GitHub answered 401" or "403":** the token expired or lacks Actions: Read and write. Make a new one (step 1) and replace the secret (step 2.4).
- **To stop it:** Cloudflare → kg-dispatch → **Settings** → **Trigger Events** → remove the four triggers. Nothing else depends on it.
- **By hand, as before:** GitHub → **Actions** → **race** → **Run workflow** (main). When it finishes, about 3 minutes later, do the same for **games**.

## Adding the sampler trigger (Sun 15 Nov 2026, for a Worker already set up)
1. Cloudflare → **kg-dispatch** → **Edit code**, delete everything, paste the whole of `tools/cloudflare/kg-dispatch-worker.js` from `main`, then **Deploy**.
2. **Settings** → **Trigger Events** → **Add** → `7,37 * * * *` → Save. Keep the three you have.
3. **Check:** at the next :07 or :37, **Logs** shows `kg-dispatch: race-samples.yml: …`.

## Adding the kit games (Mon 16 Nov 2026, for a Worker already set up)
No new trigger: the `7,37 * * * *` trigger now checks `kit-games.yml` too (Cloudflare's Free plan allows 5 triggers per account).
1. Cloudflare → **kg-dispatch** → **Edit code**, delete everything, paste the whole of `tools/cloudflare/kg-dispatch-worker.js` from `main`, then **Deploy**.
2. **Check:** at the next :07 or :37, **Logs** shows two lines, `kg-dispatch: race-samples.yml: …` and `kg-dispatch: kit-games.yml: …`. Keep the four triggers as they are.
