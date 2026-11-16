// The Ruler page's "How each game uses the Ruler": entries come from the Ruler chat's checked file
// (claude/ruler/RULER-PAGE-GAMES-2026-11-14.md), five lines each, copied as they are (file updated 4:30 PM ET 14 Nov: Bracket live, Block X 48-hour rule).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const p = fs.readFileSync("ruler.html", "utf8"), text = p.replace(/<[^>]+>/g, " ");
const sec = p.match(/id="each-game"[\s\S]*?<\/section>/)[0];
const LABELS = ["What the game asks you", "What it reads from the Ruler", "How that becomes your score", "Why it's fair", "If the Ruler can't measure a"];

test("one block per game on the Ruler, each with the five lines, no block for a game that is not on the Ruler yet", () => {
  for (const id of ["race", "blockx", "bracket", "fantasy"]) {
    const b = sec.match(new RegExp(`id="${id}"[\\s\\S]*?</article>`));
    assert.ok(b, `${id} block`);
    for (const l of LABELS) assert.ok(b[0].includes(l), `${id}: ${l}`);
  }
  const ids = [...sec.matchAll(/<article class="panel" id="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids, ["race", "blockx", "bracket", "fantasy"], "in the Ruler chat's order");
  assert.doesNotMatch(sec, /Producer Bracket joins this list/);
});
test("Block X: the owner's 48-hour rule (decision 23), word for word; no 3-day void", () => {
  const b = sec.match(/id="blockx"[\s\S]*?<\/article>/)[0];
  assert.match(b, /the target waits up to 48 hours\. After that, right picks on it score Block X's usual points from before the Ruler, and that result is final\./);
  assert.doesNotMatch(b, /3 days|is void/);
});
test("Producer Bracket: the Ruler chat's entry, including the no-block line", () => {
  const b = sec.match(/id="bracket"[\s\S]*?<\/article>/)[0];
  assert.match(b, /A producer that signed no block that day, whose size moved too far from its card, or that isn't in the day's field, can't win on the Ruler\./);
  assert.match(b, /the better seed goes through in each matchup still open\. Nobody's result is guessed\./);
});
test("the opening line is there, and Fantasy has no 'Test weeks' mark (real from week 5, D-174)", () => {
  assert.match(text, /Every Knode game that judges block producers uses this same Ruler\. No game has its own\./);
  assert.doesNotMatch(sec.match(/id="fantasy"[\s\S]*?<\/h3>/)[0], /Test weeks/);
});
test("wording rules: no bet, odds, gambling, earn, returns, guaranteed, and no Ruler modes in the section", () => {
  const t = sec.replace(/<[^>]+>/g, " ");
  assert.doesNotMatch(t, /\b(bet|bets|odds|gambling|earn|earns|returns|guaranteed)\b/i);
  assert.doesNotMatch(t, /\bmode [A-D]\b/i);
});
