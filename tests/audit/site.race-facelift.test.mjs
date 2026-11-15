// Race page facelift (owner, 14 Nov 2026): the horse is back, "Pack view" spaces the horses out (last place left,
// leader right; a thin strip keeps the real progress), "Since last race" compares each live place with where the
// producer finished the race before, and the top of the page is short with the long text in a rules book.
// Needs race-dom-harness.mjs next to it. Run: TZ=UTC node --import tsx --test --test-concurrency=1 <this file>
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import * as H from "./race-dom-harness.mjs";

const APP = fileURLToPath(new URL("../../", import.meta.url));
const html = fs.readFileSync(`${APP}race.html`, "utf8"), js = fs.readFileSync(`${APP}race.js`, "utf8");
const { A, Bp, C } = H;
// Week 2 (no Ruler): the 12:00 race is final with C 1st, A 2nd, B 3rd; the 18:00 race is live at 21:00 UTC.
const FIN = "2026-11-07T12", LIVE = "2026-11-07T18", NOW = Date.parse("2026-11-07T21:00:00Z");
const field = [[A, 300, 1], [Bp, 200, 1.5], [C, 100, 3]];
const prevSt = [{ a: C, steps: 40, blocks: 13, last: 1 }, { a: A, steps: 30, blocks: 30, last: 2 }, { a: Bp, steps: 20, blocks: 13, last: 3 }];
// blocks since before the live race: A signs most, then B, then C rarely, so the live order is A, B, C
const blocks = (T) => { const ts = [], sig = []; for (let t = T - 7 * 3600000, i = 0; t <= T; t += 20000, i++) { ts.push(t); sig.push(i % 10 < 6 ? 0 : i % 10 < 9 ? 1 : 2); } return { ts, sig, signers: [A, Bp, C], from: 1, top: ts.length }; };
async function live() {
  const p = await H.boot({ app: APP, now: NOW, files: { "W002.json": H.weekFile(2, FIN, LIVE, prevSt, field) }, vhp: { [A]: 300, [Bp]: 200, [C]: 100 }, blocks });
  await p.tick(6000);
  return p;
}
const lane = (p, a) => p.doc.querySelector(`#track .pr-lane[data-addr="${a}"]`);
// the horse's centre as a fraction of the lane (jsdom keeps the calc() as text, in either term order)
const leftOf = (p, a) => { const t = lane(p, a).querySelector(".pr-horse").style.left; const m = /(?:\* ([\d.]+)\)|([\d.]+) \* \(100%)/.exec(t); assert.ok(m, t); return Number(m[1] || m[2]); };

test("the horse is the runner again (not the bird)", async () => {
  assert.doesNotMatch(js, /animals\/bird\.png/);
  const p = await live();
  const imgs = [...p.doc.querySelectorAll("#track .pr-horse")];
  assert.equal(imgs.length, 3);
  for (const i of imgs) assert.equal(i.getAttribute("src"), "media/animals/horse.png");
});

test("Pack view (default): the leader at the right, last place at the left, a thin strip with the real progress", async () => {
  const p = await live();
  const order = p.lanes().sort((x, y) => Number(x.rank.replace(/\D/g, "")) - Number(y.rank.replace(/\D/g, ""))).map((l) => l.a);
  assert.deepEqual(order, [A, Bp, C], "live order");
  assert.equal(leftOf(p, A).toFixed(2), "0.96");
  assert.equal(leftOf(p, C).toFixed(2), "0.04");
  assert.ok(leftOf(p, Bp) > 0.04 && leftOf(p, Bp) < 0.96);
  for (const a of [A, Bp, C]) {
    const run = lane(p, a).querySelector(".pr-run");
    assert.ok(run.classList.contains("pack"));
    assert.match(run.querySelector(".pr-true").style.width, /^[\d.]+%$/);
  }
  const vb = p.doc.getElementById("r6-view");
  assert.match(vb.textContent, /View:PackWhole race/);
  assert.equal(vb.querySelector('button[aria-pressed="true"]').textContent, "Pack");
});

test("Whole race view: the old 0-to-finish scale, and the choice is remembered", async () => {
  const p = await live();
  const packC = leftOf(p, C);
  [...p.doc.querySelectorAll("#r6-view button")].find((b) => b.textContent === "Whole race").click(); await p.settle();
  assert.equal(p.win.localStorage.getItem("pr-view"), "whole");
  assert.ok(!lane(p, A).querySelector(".pr-run").classList.contains("pack"));
  assert.notEqual(leftOf(p, C), packC, "last place is no longer pinned to the left");
  assert.ok(lane(p, A).querySelector(".pr-nowline"), "the Now line and time shade are back");
});

test("Since last race: each place against where it finished the race before", async () => {
  const p = await live();
  const b = [...p.doc.querySelectorAll("#r6-win button")].find((x) => x.textContent === "Since last race");
  assert.ok(b, "the button replaces 'Since start'");
  assert.doesNotMatch(p.doc.getElementById("r6-win").textContent, /Since start/);
  b.click(); await p.settle();
  const pill = (a) => { const x = lane(p, a).querySelector(".rt-pill"); return x.hidden ? "" : x.textContent; };
  assert.equal(pill(A), "▲ 1", "2nd last race, 1st now");
  assert.equal(pill(Bp), "▲ 1", "3rd last race, 2nd now");
  assert.equal(pill(C), "▼ 2", "won last race, 3rd now");
});

test("top of the page: the game in a line and three steps; the long text is in the rules book", () => {
  const main = html.slice(html.indexOf("<main"), html.indexOf("</main>"));
  const hero = main.slice(main.indexOf('class="rc-hero"'), main.indexOf("</section>", main.indexOf('class="rc-hero"')));
  assert.match(hero, /Pick the horse you think wins\./);
  assert.equal((hero.match(/<li>/g) || []).length, 3);
  const rules = main.slice(main.indexOf('id="how"'));
  for (const t of ["The races", "Points, boards and prizes", "Results", "Reading the board", "Handicap: same speed", "Handicap: same chance", "Handicap: six cards per race", "The finish line"]) assert.match(rules, new RegExp(`<summary>${t}</summary>`));
  assert.ok(rules.includes('id="pts-note"'), "the points line the page updates lives in the rules book");
  for (const t of ["Who gets paid:", "Four 6-hour races a day", "Results are final once every block", "steps per block = (biggest VHP"]) assert.ok(rules.includes(t), t);
});
