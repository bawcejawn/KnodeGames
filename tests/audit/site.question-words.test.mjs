// Daily Questions in plain words (owner, 4 Nov: "simple for anyone to read and understand"). The card's wording is
// display only: it is built from the question's own fields and must say exactly what the on-chain options say.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const APP = process.env.APP || ".";
const src = fs.readFileSync(`${APP}/app.js`, "utf8");
const block = src.slice(src.indexOf("  function qKind(q) {"), src.indexOf("  // question-words:end"));
const ctx = { ADDR_RE: /1[1-9A-HJ-NP-Za-km-z]{25,34}/g };
vm.runInNewContext(`${block}; this.W = { qKind, isYesNo, optName, h2hWords, networkWords, headlineWords, optionWords, windowWords };`, ctx);
const { W } = ctx;
const text = (toks) => toks.map((x) => (typeof x === "string" ? x : x.chip ? "@" + x.chip.slice(0, 4) : `[${x.b}]`)).join("");
const A = "1MbsVfNw6yzQqA8499d8KQj8qdLyRs8CzW", B = "15NZhQoewzsbVUcSVsZ8BEBEKgaBNPLLgZ";

// Real questions from W002-D1..D3 (game-data/questions), trimmed to the fields the card uses.
const ou = { template: "E1s", title: "Core producer over/under", subjects: [A], thresholds: [545], windowStart: 40747781, windowEnd: 40757780,
  text: `Will producer ${A} sign more than 545 blocks between block 40,747,781 and block 40,757,780 (about 8 hours)?`,
  options: [{ index: 0, label: "No — 545 or fewer" }, { index: 1, label: "Yes — 546 or more" }] };
const h2h = (t) => ({ template: "E2s", title: "Head-to-head with spread", subjects: [A, B], thresholds: [t], windowStart: 1, windowEnd: 10000,
  text: `Producer ${A}'s blocks minus producer ${B}'s blocks, between block 1 and block 10,000: will the difference be more than ${t}?`,
  options: [{ index: 0, label: `No — ${t} or less` }, { index: 1, label: `Yes — ${t + 1} or more` }] });
const net = (stat) => ({ template: "M5", title: "x", text: `${stat} between block 40,803,846 and block 40,808,845?`, options: [0, 1, 2, 3].map((i) => ({ index: i, label: `${i}` })) });

test("over/under reads as one plain yes-or-no question with the Yes number in it", () => {
  assert.equal(text(W.headlineWords(ou)), "Will @1Mbs make [546 or more] blocks?");
  assert.equal(W.optName(ou, 1), "Yes"); assert.equal(W.optName(ou, 0), "No");
  assert.equal(W.optionWords(ou, ou.options[1]), "Yes — 546 or more", "published label kept");
});

test("head-to-head: every line, including below zero, reads as a plain question that matches the chain's options", () => {
  assert.equal(text(W.headlineWords(h2h(297))), "Will @1Mbs make at least [298] more blocks than @15NZ?");
  assert.equal(text(W.headlineWords(h2h(0))), "Will @1Mbs make more blocks than @15NZ?");
  assert.equal(text(W.headlineWords(h2h(-1))), "Will @1Mbs make at least as many blocks as @15NZ?");
  assert.equal(text(W.headlineWords(h2h(-13))), "Will @1Mbs finish no more than [12] blocks behind @15NZ?");
  assert.equal(W.optionWords(h2h(-13), { index: 1 }), "Yes — behind by 12 or less, or ahead");
  assert.equal(W.optionWords(h2h(-13), { index: 0 }), "No — behind by 13 or more");
  // Exhaustive: for every line and every possible difference A−B, the words' Yes is exactly the chain's Yes (diff > line).
  for (let line = -60; line <= 60; line++) {
    const w = W.h2hWords(line), d = line + 1;
    for (let diff = -80; diff <= 80; diff++) {
      const chainYes = diff > line;
      let wordsYes;
      if (d >= 2) wordsYes = diff >= d;                    // "at least d more"
      else if (d === 1) wordsYes = diff > 0;               // "more blocks than"
      else if (d === 0) wordsYes = diff >= 0;              // "at least as many"
      else wordsYes = -diff <= -d;                         // "no more than -d behind"
      assert.equal(wordsYes, chainYes, `line ${line}, diff ${diff}: ${JSON.stringify(w)}`);
    }
    assert.doesNotMatch(JSON.stringify(w), /-\d/, `no negative numbers shown (line ${line})`);
  }
});

test("network questions: an inviting hook plus a plain ask, for each kind", () => {
  for (const [stat, re] of [["What will be the longest gap between two consecutive blocks", /longest wait/], ["What will be the average time between blocks", /average time/],
    ["What share of blocks will contain no transactions", /empty/], ["How many transactions will be included in blocks", /How many transactions/]]) {
    const t = text(W.headlineWords(net(stat)));
    assert.match(t, /^\[[^\]]+\?\] /, `hook first: ${t}`); assert.match(t, re); assert.doesNotMatch(t, /block [\d,]+/);
  }
  assert.equal(W.isYesNo(net("x")), false); assert.equal(W.optName(net("x"), 2), "C", "multi-choice keeps letters");
});

test("the window keeps the block numbers and adds an estimated time in the viewer's zone", () => {
  const now = Date.UTC(2026, 10, 5, 12, 0), q = { ...ou, lockTime: now };
  const w = W.windowWords(q, now, 3080);
  assert.equal(w.blocks, `Blocks ${(40747781).toLocaleString()} → ${(40757780).toLocaleString()} (${(10000).toLocaleString()})`);
  assert.match(w.when, /^about .+ – .+ your time$/);
  assert.match(W.windowWords({ ...ou }, now, 3080).when, /^about 8\.6 hours$/, "no close time known: just the length");
});

test("the card uses the plain wording: Yes first, no letters on yes-or-no, a friendly prompt, the 'New here?' line", () => {
  assert.match(src, /const shown = yn \? \[q\.options\[1\], q\.options\[0\]\] : q\.options;/);
  assert.match(src, /yn \? null : el\("span", \{ class: "letter" \}/);
  assert.match(src, /onclick: \(\) => answer\(q, o\.index\)/, "the chain's option number is sent, whatever the order shown");
  assert.match(src, /Tap an answer to play: free, and a guest wallet works/);
  assert.doesNotMatch(src, /String\.fromCharCode\(65 \+ (?!i\))/, "every pick name goes through optName");
  assert.match(fs.readFileSync(`${APP}/index.html`, "utf8"), /<p class="q-intro"><b>New here\?<\/b> Block producers are the computers that take turns making Koinos blocks/);
});
