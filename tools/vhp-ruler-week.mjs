// D-172: the weekly summary of the VHP ruler's voids and band set-asides, for the weekly review and the owner's alert
// email. Data only: nothing pays from it.
//   node tools/vhp-ruler-week.mjs <scored cards: a .jsonl file, or a folder of .json / .jsonl files> [--json]
// Prints a short plain-text summary (or the JSON with --json). Python gives the same JSON: vhp_ruler.week_summary.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
const root = new URL("..", import.meta.url).pathname, box = { window: {} };
vm.runInNewContext(fs.readFileSync(root + "vhp-ruler.js", "utf8"), box);
const R = box.window.KRuler, src = process.argv[2], asJson = process.argv.includes("--json");
if (!src) { console.error("usage: node tools/vhp-ruler-week.mjs <cards.jsonl | folder> [--json]"); process.exit(2); }
const files = fs.statSync(src).isDirectory() ? fs.readdirSync(src).filter((f) => /\.jsonl?$/.test(f)).sort().map((f) => path.join(src, f)) : [src];
const cards = files.flatMap((f) => fs.readFileSync(f, "utf8").split("\n").filter((l) => l.trim()));
const w = R.weekSummary(cards);
if (asJson) { console.log(JSON.stringify(w)); process.exit(0); }
const pctOf = (m) => `${(m / 10000).toFixed(2)}%`;
const lines = [
  `VHP ruler week: ${w.races} scored races, ${w.fieldRaces} producer-races in fields, ${w.coreRaces} in cores.`,
  `Voids: ${w.voids} (${w.ownMoves} by the producer's own move).${w.voidsByProducer.length ? " By producer: " + w.voidsByProducer.map((x) => `${x.a} ×${x.races}`).join(", ") + "." : ""}`,
  `Senders seen in more than one void race: ${w.repeatSenders.length ? w.repeatSenders.map((x) => `${x.a} (${x.races} races: ${x.producers.join(", ")})`).join("; ") : "none"}.`,
  `Band set-asides: ${w.setAsides}, ${pctOf(w.setAsideRate)} of core member-races (about ${pctOf(w.setAsideExpected)} expected by chance).${w.setAsidesByProducer.length ? " By producer: " + w.setAsidesByProducer.map((x) => `${x.a} ×${x.races}`).join(", ") + "." : ""}`,
];
console.log(lines.join("\n"));
