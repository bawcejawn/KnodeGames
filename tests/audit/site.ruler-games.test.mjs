// The Ruler page's "How each game uses the Ruler": entries come from the Ruler chat's checked file
// (claude/ruler/RULER-PAGE-GAMES-2026-11-14.md), five lines each, copied as they are. Bracket joins when #285 merges.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const p = fs.readFileSync("ruler.html", "utf8"), text = p.replace(/<[^>]+>/g, " ");
const sec = p.match(/id="each-game"[\s\S]*?<\/section>/)[0];
const LABELS = ["What the game asks you", "What it reads from the Ruler", "How that becomes your score", "Why it's fair", "If the Ruler can't measure a"];

test("one block per game on the Ruler, each with the five lines, no block for a game that is not on the Ruler yet", () => {
  for (const id of ["race", "blockx", "fantasy"]) {
    const b = sec.match(new RegExp(`id="${id}"[\\s\\S]*?</article>`));
    assert.ok(b, `${id} block`);
    for (const l of LABELS) assert.ok(b[0].includes(l), `${id}: ${l}`);
  }
  const ids = [...sec.matchAll(/<article class="panel" id="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids, ["race", "blockx", "fantasy"], "Bracket is added when #285 merges");
});
test("the opening line and the Fantasy 'Test weeks' mark are there", () => {
  assert.match(text, /Every Knode game that judges block producers uses this same Ruler\. No game has its own\./);
  assert.match(sec.match(/id="fantasy"[\s\S]*?<\/h3>/)[0], /Test weeks/);
});
test("wording rules: no bet, odds, gambling, earn, returns, guaranteed, and no Ruler modes in the section", () => {
  const t = sec.replace(/<[^>]+>/g, " ");
  assert.doesNotMatch(t, /\b(bet|bets|odds|gambling|earn|earns|returns|guaranteed)\b/i);
  assert.doesNotMatch(t, /\bmode [A-D]\b/i);
});
