# Capacity: owner steps (Phase A, "traffic shield")

Every step costs $0 inside Cloudflare's free limits, shows no key to any chat, and has an undo. Do them in order and
paste each **Check** to the Capacity chat. Each step's code is in this repository (source of truth).

| Step | When (ET) | What | Card? | Status |
|---|---|---|---|---|
| A1 | Thu 12 Nov | Was Cloudflare in front of the site? | no | Done (it wasn't) |
| A2 | Thu 12 Nov | Cloudflare in front: SSL/TLS "Full", the 4 A + 4 AAAA + `www` rows Proxied (the `_github-pages-challenge` TXT row left alone) | no | Done |
| A2b | Thu 12 Nov | Cache rule "Cache site files": all requests, eligible for cache, edge TTL from the origin's `Cache-Control` (GitHub sends 10 minutes) | no | Done (MISS then HIT) |
| A3 | Thu 12 Nov | The data mirror: Worker `kg-data` at `data.knodegames.com` | no | **Done** (200, kg-data, 404); mirror switched on |
| A4a | Wed 18 Nov | Card + billing alert, storage bucket `kg-live` at `live.knodegames.com`, Worker binding + secret, `.env` lines | yes (verification) | below |
| A4b | Thu 19 Nov | The uploader task on your PC | no | below |
| ON | after each check | Switch the mirror (after A3) and the live file (after A4b) on in `data-source.js` | no | Capacity's switch-on PR |

## A3: the data mirror (Tue 17 Nov, about 20 minutes)
A tiny free program on Cloudflare: when a page asks for a game file, it gives Cloudflare's copy (kept 5 minutes, the
same as GitHub's) and only asks GitHub when the copy is older. It never changes a file.

1. dash.cloudflare.com -> left menu **Compute (Workers)** (older screens: **Workers & Pages**) -> **Create** ->
   **Create Worker** ("Start with Hello World"). Name: `kg-data`. Click **Deploy**.
2. **Edit code**: select everything in the editor and delete it. Open `C:\kprediction\tools\cloudflare\kg-data-worker.js`
   in Notepad, copy all of it, paste it into the editor. Click **Deploy**.
3. The Worker -> **Settings** -> **Domains & Routes** -> **Add** -> **Custom domain** -> `data.knodegames.com` -> **Add**.
4. Wait 5 minutes. **Check** (read-only):
```powershell
cd C:\kprediction
git branch --show-current
(Invoke-WebRequest -Uri https://data.knodegames.com/race-data/board.json -UseBasicParsing).StatusCode
(Invoke-WebRequest -Uri https://data.knodegames.com/race-data/board.json -UseBasicParsing).Headers['X-KG-Mirror']
try { (Invoke-WebRequest -Uri https://data.knodegames.com/main/README.md -UseBasicParsing).StatusCode } catch { $_.Exception.Response.StatusCode.value__ }
```
Expect `200`, `kg-data`, `404` (it refuses anything that isn't a published game file).

**Undo:** the Worker -> Settings -> Domains & Routes -> remove `data.knodegames.com`. Pages don't use the mirror until
it is switched on, so nothing can break before then.

## A4a: the live file's storage (Wed 18 Nov, about 25 minutes)
1. **Card and alert.** Cloudflare -> your account -> **Billing** -> **Payment info** -> add the card (verification; no
   charge inside the free limits). Then **Notifications** -> **Add** -> **Usage Based Billing** (pick R2 and Workers if
   asked) -> your email -> **Save**. You'll get an email before any charge.
2. **Bucket.** Left menu **R2 Object Storage** -> **Create bucket** -> name `kg-live`, location Automatic -> **Create**.
3. **Its public address.** The bucket -> **Settings** -> **Custom Domains** -> **Connect Domain** -> `live.knodegames.com`
   -> **Connect**. (Leave "Public Development URL" off.)
4. **Connect the bucket to the Worker.** Compute (Workers) -> `kg-data` -> **Settings** -> **Bindings** -> **Add** ->
   **R2 bucket** -> Variable name `LIVE`, bucket `kg-live` -> **Deploy**.
5. **The secret.** It's made on your PC, copied once into Cloudflare, and saved in `.env`. It never goes into a chat.
```powershell
cd C:\kprediction
git branch --show-current
$b = New-Object byte[] 32; ([System.Security.Cryptography.RNGCryptoServiceProvider]::new()).GetBytes($b)
$tok = ($b | ForEach-Object { $_.ToString("x2") }) -join ""
Add-Content -Path .env -Value "`r`nLIVE_TOKEN=$tok"
Set-Clipboard -Value $tok
Remove-Variable tok, b
Select-String -Path .env -Pattern '^LIVE_TOKEN=' -Quiet
```
   Expect `True` (the line is in `.env`; the secret itself is not shown). The secret is now on your clipboard: in
   Cloudflare, `kg-data` -> **Settings** -> **Variables and Secrets** -> **Add** -> Type **Secret**, name `LIVE_TOKEN`,
   paste (Ctrl+V) -> **Deploy**. Then clear the clipboard: `Set-Clipboard -Value " "`.
6. **Your node's address.** Find the address your node answers on, on this PC:
```powershell
cd C:\kprediction
git branch --show-current
Invoke-RestMethod -Uri http://127.0.0.1:8080 -Method Post -ContentType application/json -Body '{"jsonrpc":"2.0","id":1,"method":"chain.get_head_info","params":{}}' | Select-Object -ExpandProperty result | Select-Object -ExpandProperty head_topology
```
   If it prints a `height` and an `id`, add the line: `Add-Content -Path .env -Value "`r`nLIVE_RPC=http://127.0.0.1:8080"`.
   If it fails, ask the Node chat which local port your game node's JSON-RPC uses, and use that instead of 8080.
7. **Check** (read-only; sends nothing):
```powershell
cd C:\kprediction
git branch --show-current
node tools\capacity-live\uploader.mjs --dry
```
   Expect a short JSON with `"head"` and 24 `"blocks"`. Then send it once and read it back:
```powershell
cd C:\kprediction
git branch --show-current
node tools\capacity-live\uploader.mjs --once
(Invoke-WebRequest -Uri https://live.knodegames.com/live.json -UseBasicParsing).StatusCode
```
   Expect no error and `200`.

**Undo:** R2 -> `kg-live` -> Settings -> remove the custom domain; `kg-data` -> Settings -> remove the `LIVE` binding.

## A4b: the uploader task (Thu 19 Nov, about 10 minutes)
```powershell
cd C:\kprediction
git branch --show-current
git pull
powershell -ExecutionPolicy Bypass -File node\install-live-uploader.ps1
```
It does a dry run first, then sets up "Knode live uploader" (every minute, all day, and at log-on). **Check** after 3 minutes:
```powershell
cd C:\kprediction
git branch --show-current
Get-Content node\live-uploader.log -Tail 3
((Invoke-WebRequest -Uri https://live.knodegames.com/live.json -UseBasicParsing).Content | ConvertFrom-Json).head.height
```
Expect `ok: sent ...` lines and a block height that grows each time you run the last line.

**Pause:** `Disable-ScheduledTask -TaskName "Knode live uploader"`. **Remove:** `Unregister-ScheduledTask -TaskName "Knode live uploader" -Confirm:$false`.
If the PC is off or the uploader stops, the live file goes stale and every page goes back to the public node by itself.

## Switching on
After A3's check the Capacity chat opens one small PR that sets `mirror: true` in `data-source.js`; after A4b's check,
the same for `live: true` (one PR for both if the checks are on the same day). Switching off is the same line back to
`false`, or, faster, removing the custom domain in Cloudflare (pages fall back by themselves).

## What it costs (Cloudflare's free limits; check them in the dashboard's usage pages)
| Item | Free | Our use | When it costs |
|---|---|---|---|
| Site through Cloudflare + cache (A2, A2b) | unlimited static requests | all page views | never |
| Worker requests (A3 mirror, A4 uploads) | 100,000 a day | ~17,000 uploads a day + ~30 file reads per daily visitor | past ~2,500-3,000 daily visitors: pages fall back to GitHub until the Workers plan ($5 a month, 10 million requests) is on |
| R2 storage (A4) | 10 GB | a few KB | never |
| R2 writes (A4) | 1 million a month | ~520,000 a month (one per new block) | never at this rate |
| R2 reads (A4, only Cloudflare refreshing its copy) | 10 million a month | up to ~650,000 a day at 30 busy locations | at high traffic, about $0.36 per extra million |
