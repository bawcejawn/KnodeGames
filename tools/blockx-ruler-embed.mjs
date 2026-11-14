// Knode Games — embeds vhp_ruler.py in the Block X publish job (.github/workflows/games.yml), between the lines
// "# BEGIN vhp_ruler.py" and "# END vhp_ruler.py", so that job runs no repository code (as tools/race-ruler-embed.mjs
// does for race.yml). Run after any change to vhp_ruler.py: node tools/blockx-ruler-embed.mjs. A test fails while the
// copy differs (tests/audit/blockx-ruler-publish.test.mjs).
import fs from "node:fs";
const root = new URL("..", import.meta.url).pathname, wf = root + ".github/workflows/games.yml";
const py = fs.readFileSync(root + "vhp_ruler.py", "utf8"), yml = fs.readFileSync(wf, "utf8");
if (py.split("\n").some((l) => l.trim() === "RULERPY")) throw new Error("vhp_ruler.py has a line RULERPY (the here-doc's end)");
const ind = "          ", B = ind + "# BEGIN vhp_ruler.py\n", E = ind + "# END vhp_ruler.py\n";
const i = yml.indexOf(B), j = yml.indexOf(E);
if (i < 0 || j < i) throw new Error("games.yml has no embed markers");
const body = py.replace(/\n$/, "").split("\n").map((l) => (l ? ind + l : "")).join("\n") + "\n";
fs.writeFileSync(wf, yml.slice(0, i + B.length) + body + yml.slice(j));
console.log("vhp_ruler.py embedded in games.yml");
