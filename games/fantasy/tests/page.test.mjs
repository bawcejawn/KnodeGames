// Fantasy Producers: the page (fantasy.html / fantasy.js) against the kit's files and the 11 Nov rules.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const html = fs.readFileSync(path.join(ROOT, "fantasy.html"), "utf8");
const js = fs.readFileSync(path.join(ROOT, "fantasy.js"), "utf8");

test("page: loads the same rules file as the recorder, as a module; no old scripts", () => {
  assert.match(html, /<script type="module" src="fantasy\.js"><\/script>/);
  assert.match(js, /^import \* as F from "\.\/games\/fantasy\/math\.js";$/m);
  assert.doesNotMatch(html, /fantasy-math\.js|race-math\.js/);
  assert.ok(html.indexOf('src="weeks.js"') < html.indexOf('src="board.js"'), "weeks.js before board.js");
});

test("page: every element the script uses is on the page", () => {
  const ids = new Set([...js.matchAll(/\$\("([a-z0-9-]+)"\)/g)].map((m) => m[1]));
  assert.ok(ids.size > 20);
  for (const id of ids) assert.match(html, new RegExp(`id="${id}"`), `#${id}`);
});

test("page: builds nothing from HTML strings; reads only the kit's files and the Picks contract", () => {
  assert.doesNotMatch(js, /innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
  assert.match(js, /games-data\/fantasy\//);
  for (const f of ["board.json", "alltime.json", "inputs/W${w}.json", "W${pad(w)}.json"]) assert.ok(js.includes(f), f);
  assert.doesNotMatch(js, /index\.json|days\.json|rivals\.json/, "no files of the old recorder");
  const csp = html.match(/Content-Security-Policy" content="([^"]+)"/)[1];
  assert.match(csp, /connect-src [^;]*https:\/\/raw\.githubusercontent\.com\/bawcejawn\/KnodeGames\/games-data\//);
  assert.match(html, /<meta name="robots" content="noindex">/, "hidden until launch");
});

test("page: sends Picks game 4 for a day (round = the day number) and game 5 for a week (round = its Monday)", () => {
  assert.match(js, /game: GAME, round: String\(d\), producers: list/);
  assert.match(js, /game: RIVAL, round: String\(round\), producers: \[target\]/);
  assert.match(js, /round = dayNo\(weekStart\(rw\)\)/);
  assert.match(js, /const DAY = F\.DAY, LEAD = 300000/);
});

test("page text: the 11 Nov rules (cap 150, the ruler, void vs offline, the gate, captaincy, public picks)", () => {
  assert.doesNotMatch(html, /\b130\b/, "the old cap is gone");
  assert.match(html, /at most 150/);
  assert.match(html, /VHP Ruler/);
  assert.match(html, /scores 0 that day only, and the day is left out of its form/);
  assert.match(html, /offline, scores less, and that counts in its form/);
  assert.match(html, /form gate/);
  assert.match(html, /A producer you swap in can become captain in the same change/);
  assert.match(html, /anyone can see them before the lock/);
  assert.doesNotMatch(html, /Producer Race's hourly VHP card|data-fx=/);
});
