// Knode Games — embeds vhp_ruler.py in the games publish job (.github/workflows/games.yml, the Producer Bracket's ruler
// check, R-BR-7 phase 2), between the lines "# BEGIN vhp_ruler.py" and "# END vhp_ruler.py", so that job runs no
// repository code (like the ruler's own workflow and the Race's, tools/race-ruler-embed.mjs).
// Run after any change to vhp_ruler.py: node tools/games-ruler-embed.mjs. A test fails while the copy differs
// (tests/audit/games-ruler-embed.test.mjs).
import fs from "node:fs";
const root = new URL("..", import.meta.url).pathname, wf = root + ".github/workflows/games.yml";
const py = fs.readFileSync(root + "vhp_ruler.py", "utf8"), yml = fs.readFileSync(wf, "utf8");
if (py.split("\n").some((l) => l.trim() === "RULERPY")) throw new Error("vhp_ruler.py has a line RULERPY (the here-doc's end)");
const ind = "          ", B = ind + "# BEGIN vhp_ruler.py\n", E = ind + "# END vhp_ruler.py\n";
// Only the hand-written jobs: the kit-rendered jobs below their marker carry their own copy, written by
// npm run kit:render (Fantasy #266); this tool never touches them.
const KIT = "  # ── BEGIN kit-rendered jobs", end = yml.indexOf(KIT) < 0 ? yml.length : yml.indexOf(KIT);
const i = yml.indexOf(B), j = yml.indexOf(E);
if (i < 0 || j < i || j > end || yml.slice(i + 1, end).indexOf(B) >= 0) throw new Error("games.yml needs exactly one pair of embed markers in its hand-written jobs");
const body = py.replace(/\n$/, "").split("\n").map((l) => (l ? ind + l : "")).join("\n") + "\n";
fs.writeFileSync(wf, yml.slice(0, i + B.length) + body + yml.slice(j));
console.log("vhp_ruler.py embedded in games.yml");
