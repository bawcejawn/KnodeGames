// Knode Games — the ruler switch, checked BEFORE you set a game's <GAME>_RULER_FROM_WEEK variable (owner, 11 Nov 2026).
// Read-only: reads the clock and vhp-ruler.js, writes nothing, sends nothing.
//   node tools/vhp-ruler-switch.mjs <N> [--prev <what the game's last week file recorded>] [--week <vault week now>]
// Prints this week's vault week, the calendar Monday of each week around N, each week's mode (off / shadow / on), and
// whether moving the switch from --prev (default: unset) to N now passes the game's publish check.
import fs from "node:fs";
import vm from "node:vm";

const GENESIS = 1792368000, WEEK = 7 * 86400;   // vault week 0 = Mon 19 Oct 2026 00:00 UTC, in seconds
const box = { window: {} };
vm.runInNewContext(fs.readFileSync(new URL("../vhp-ruler.js", import.meta.url), "utf8"), box);
const R = box.window.KRuler;

const args = process.argv.slice(2), opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const nextText = args[0] && !args[0].startsWith("--") ? args[0] : "";
if (args.includes("--help") || args.length === 0) {
  console.log("usage: node tools/vhp-ruler-switch.mjs <N | \"\"> [--prev <N>] [--week <vault week now>]");
  process.exit(0);
}
const now = opt("--week") !== undefined ? Number(opt("--week")) : Math.floor((Date.now() / 1000 - GENESIS) / WEEK);
const prev = R.switchFrom(opt("--prev") ?? ""), next = R.switchFrom(nextText);
const monday = (w) => new Date((GENESIS + w * WEEK) * 1000).toUTCString().slice(0, 16);
console.log(`Now: vault week ${now} (from ${monday(now)} 00:00 UTC; ${now >= 4 ? `players' Week ${now - 3}` : "before players' Week 1"}).`);
console.log(`Switch: ${prev === null ? "unset" : prev} -> ${next === null ? "unset" : next}`);
const lo = Math.max(0, Math.min(now, (next ?? now) - 2)), hi = Math.max(now + 2, (next ?? now) + 1);
for (let w = lo; w <= hi; w++) {
  console.log(`  week ${String(w).padStart(3)}  ${monday(w)}  now: ${R.rulerMode(w, prev).padEnd(6)}  after: ${R.rulerMode(w, next).padEnd(6)}${w >= 4 ? `  (Week ${w - 3})` : ""}${w === now ? "  <- this week" : ""}`);
}
const why = R.switchChange(prev, next, now);
console.log(why === null ? "OK: this change touches no week that has started." : `REFUSED: ${why}`);
process.exit(why === null ? 0 : 1);
