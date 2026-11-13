// Knode Games — the ruler's scoring-mode schedule, checked BEFORE the admin sets a game's <GAME>_RULER_MODE variable
// (owner, 11 Nov 2026). Read-only: reads the clock and vhp-ruler.js, writes nothing, sends nothing.
//   node tools/vhp-ruler-mode.mjs "<schedule>" [--prev "<what the game's last week file recorded>"] [--week <vault week now>]
//   node tools/vhp-ruler-mode.mjs --version "<schedule>" [--prev ...] [--week ...]   the RULE_VERSION schedule instead
//     (<GAME>_RULER_VERSION, week:version pairs like "6:5"; version 4 before the first pair and when unset)
// A schedule is week:mode pairs with rising weeks, like "5:B,8:C": mode B from vault week 5, C from week 8; A before the
// first pair, and A when the variable is unset. Modes: A VHP only, B clear edge (raise only), C best day (raise only),
// D even odds. Prints each week's mode now and after the change, with its calendar Monday, and OK or REFUSED: a week
// that has started never changes mode.
import fs from "node:fs";
import vm from "node:vm";

const GENESIS = 1792368000, WEEK = 7 * 86400;   // vault week 0 = Mon 19 Oct 2026 00:00 UTC, in seconds
const box = { window: {} };
vm.runInNewContext(fs.readFileSync(new URL("../vhp-ruler.js", import.meta.url), "utf8"), box);
const R = box.window.KRuler;
const NAMES = { A: "A, VHP only", B: "B, clear edge", C: "C, best day", D: "D, even odds" };

const args = process.argv.slice(2), opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const V = args.includes("--version"), pos = args.filter((a, i) => !a.startsWith("--") && !["--prev", "--week"].includes(args[i - 1]));
const nextText = pos[0] ?? "";
const parse = V ? R.versionSchedule : R.modeSchedule, at = V ? R.versionAt : R.modeAt, change = V ? R.versionChange : R.modeChange;
const label = V ? (n) => `version ${n}` : (m) => NAMES[m];
if (args.includes("--help") || args.length === 0) {
  console.log('usage: node tools/vhp-ruler-mode.mjs [--version] "<week:mode,...>" [--prev "<schedule>"] [--week <vault week now>]');
  process.exit(0);
}
const now = opt("--week") !== undefined ? Number(opt("--week")) : Math.floor((Date.now() / 1000 - GENESIS) / WEEK);
const prev = opt("--prev") ?? "", next = nextText;
parse(prev); parse(next);   // strict: a bad schedule stops here
const monday = (w) => new Date((GENESIS + w * WEEK) * 1000).toUTCString().slice(0, 16);
const weeks = [...new Set([now, now + 1, now + 2, ...(parse(prev) || []).map((x) => x[0]), ...(parse(next) || []).map((x) => x[0])])].filter((w) => w >= 0).sort((a, b) => a - b);
console.log(`Now: vault week ${now} (from ${monday(now)} 00:00 UTC; ${now >= 4 ? `players' Week ${now - 3}` : "before players' Week 1"}).`);
console.log(`${V ? "Version schedule" : "Schedule"}: ${JSON.stringify(prev)} -> ${JSON.stringify(next)}`);
for (const w of weeks) {
  const a = at(w, prev), b = at(w, next);
  console.log(`  week ${String(w).padStart(3)}  ${monday(w)}  now: ${label(a).padEnd(14)}  after: ${label(b).padEnd(14)}${w >= 4 ? `  (Week ${w - 3})` : ""}${w === now ? "  <- this week" : ""}`);
}
const why = change(prev, next, now);
console.log(why === null ? `OK: no week that has started changes ${V ? "version" : "mode"}.` : `REFUSED: ${why}`);
process.exit(why === null ? 0 : 1);
