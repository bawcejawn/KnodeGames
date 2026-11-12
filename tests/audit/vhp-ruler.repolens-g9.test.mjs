// Repo Lens #G-9 (vhp-ruler-v21 @ 5188318, tree fd282276): G9-1. Place in tests/audit/. Fails today (Low).
// G9-1: the shortest retention the ruler accepts (MIN_KEEP_DAYS in vhp_ruler.py and the publish job, and the floor in
// bot/vhp-ruler.ts) is 22 days. A 6-day race's card reads back 410,419 blocks (FORM + ACTIVE + 19) before its moment T,
// the race runs 172,800 blocks after it, and the game rebuilds the card (recompute_main) when the week goes final:
// up to a day of card window before S0, Sunday's review and the vault's 3-day window after S1. That is about 25.3 days
// of data, so at a 22-day setting the oldest hours are already pruned when the card is rebuilt, and the week holds.
// Fix: raise the floor to 26 days in all three places (or derive it from the longest scoring window).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
createRequire(import.meta.url)(path.join(ROOT, "vhp-ruler.js"));
const R = globalThis.KRuler;

test("G9-1 (Low): the retention floor covers a 6-day race's card until the week goes final", () => {
  const DAY = 28800;   // blocks
  const lookBack = R.FORM + R.ACTIVE + (R.DELAY - 1), race = 6 * DAY, beforeRace = DAY, untilFinal = 4 * DAY;   // Sunday + the vault's 3 days
  const need = Math.ceil((lookBack + beforeRace + race + untilFinal) / DAY);
  assert.equal(need, 26);
  const py = Number(read("vhp_ruler.py").match(/MIN_KEEP_DAYS = [^\n]*?, (\d+)\s*$/m)?.[1]);
  const yml = Number(read(".github/workflows/vhp-ruler.yml").match(/MIN_KEEP_DAYS = [^\n]*?, (\d+)\s*$/m)?.[1]);
  const bot = Number(read("bot/vhp-ruler.ts").match(/keep = Math\.max\((\d+), Number\(E\.VHP_KEEP_DAYS/)?.[1]);
  for (const [where, v] of [["vhp_ruler.py", py], ["vhp-ruler.yml", yml], ["bot/vhp-ruler.ts", bot]])
    assert.ok(v >= need, `${where}: the floor is ${v} days; a 6-day race's card needs ${need}`);
});
