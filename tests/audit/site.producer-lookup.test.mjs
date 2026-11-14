// Producer lookup (node.html / node-page.js), owner 14 Nov 2026: no luck meter, and each fact shown once.
// Runs the page in jsdom against a fake chain (the sandbox and CI cannot reach the Koinos RPC).
// Run: TZ=UTC node --test tests/audit/site.producer-lookup.test.mjs
import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";
import { fileURLToPath } from "node:url";

const APP = fileURLToPath(new URL("../../", import.meta.url));
const HTML = fs.readFileSync(`${APP}/node.html`, "utf8"), JS = fs.readFileSync(`${APP}/node-page.js`, "utf8");
const ME = "1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr";
const OTHERS = ["1BigProducerAAAAAAAAAAAAAAAAAAAAA", "1MidProducerBBBBBBBBBBBBBBBBBBBBB", "1SmallProducerCCCCCCCCCCCCCCCCCCC"];
const VHPS = { [ME]: 2e6, [OTHERS[0]]: 20e6, [OTHERS[1]]: 6e6, [OTHERS[2]]: 2e6 };

/** A fake chain of `n` blocks, 3 s apart, ending now; `meLastAgoBlocks` = how many blocks since ME last signed. */
function chain(n, meLastAgoBlocks) {
  const now = Date.parse("2026-11-18T12:00:00Z"), top = 40000000;
  const signerAt = (h) => {
    const k = top - h;
    if (k < meLastAgoBlocks) return OTHERS[h % 3];
    return h % 15 === 0 ? ME : OTHERS[h % 3];
  };
  const block = (h) => ({ block_height: String(h), block: { header: { signer: signerAt(h), timestamp: String(now - (top - h) * 3000) }, transactions: h % 4 ? [{}] : [] }, receipt: { events: [
    { source: "19GYjDBVXU7keLbYvMLazsGQn3GTWHjHkK", name: "koinos.contracts.token.mint_event", data: JSON.stringify({ to: signerAt(h), value: "200000000" }) },
    { source: "12Y5vW6gk8GceH53YfRkRre2Rrcsgw7Naq", name: "koinos.contracts.token.burn_event", data: JSON.stringify({ from: signerAt(h), value: "100000000" }) }] } });
  return {
    now,
    lib: {
      Provider: class { async getHeadInfo() { return { head_topology: { height: String(top), id: "0xhead" }, head_block_time: String(now) }; }
        async call(_m, a) { const s = Number(a.ancestor_start_height), k = Math.min(a.num_blocks, top - s + 1); return { block_items: Array.from({ length: Math.max(0, k) }, (_, i) => block(s + i)) }; } },
      Serializer: class { async deserialize(d) { return JSON.parse(d); } },
      Contract: class { constructor() { this.functions = { balance_of: async ({ owner }) => ({ result: { value: String((VHPS[owner] || 0) * 1e8) } }) }; } },
    },
  };
}

const opened = [];
after(() => { for (const w of opened) w.close(); });
async function open(meLastAgoBlocks) {
  const c = chain(28800, meLastAgoBlocks);
  const dom = new JSDOM(HTML.replace(/<script[\s\S]*?<\/script>/g, ""), { url: `https://knodegames.com/node.html?a=${ME}&w=28800`, runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window; opened.push(w);
  w.koilib = c.lib;
  w.fetch = async () => { throw new Error("offline"); };
  w.Date.now = () => c.now;
  w.eval(JS);
  for (let i = 0; i < 400 && w.document.getElementById("out").hidden; i++) await new Promise((r) => setTimeout(r, 10));
  assert.equal(w.document.getElementById("out").hidden, false, `page rendered: ${w.document.getElementById("status").textContent}`);
  return w.document;
}
const text = (d) => d.getElementById("out").textContent;
const count = (s, re) => (s.match(re) || []).length;

test("no luck meter, luck line or Luck column anywhere on the page", async () => {
  const d = await open(5);
  assert.equal(d.querySelector(".pd-luck, .pd-luck-l"), null);
  assert.doesNotMatch(text(d), /luck|Unlucky|running hot|running cold/i);
  assert.doesNotMatch(HTML + JS, /pd-luck|Unlucky|poissonCdf/);
  assert.equal(d.querySelectorAll("#top tr:first-child td").length, 5, "All active producers: 5 columns, no Luck");
});

test("a producing node: the story card is hidden and each fact appears once", async () => {
  const d = await open(5);
  assert.equal(d.getElementById("story").hidden, true, "nothing to say: no story card");
  const t = text(d);
  assert.equal(count(t, /% of the network/g), 1, "VHP share once (tile)");
  assert.equal(count(t, /% a year/g), 1, "yearly earnings once (tile)");
  assert.doesNotMatch(d.getElementById("fc-sub").textContent, /a year|KOIN a block/, "not repeated under What to expect");
  assert.match(d.getElementById("recent").textContent, /2\.000.*1\.000.*1\.000/, "latest blocks show KOIN, VHP used and profit");
  assert.equal(count(t, /usually every/g), 1, "block rhythm once (tile)");
  assert.equal(count(t, /check the node|check that it is running/g), 0, "no warning when producing");
  assert.match(d.getElementById("hero").textContent, /● Producing/);
});

test("a quiet node: one warning in the story card, the badge says Quiet, the tile is red", async () => {
  const d = await open(4000);
  assert.equal(d.getElementById("story").hidden, false);
  assert.match(d.getElementById("story").textContent, /^No block for .+, while its VHP says about one every .+\. If this is your node, check that it is running, in sync and using its registered producer key\.$/);
  assert.match(d.getElementById("hero").textContent, /Quiet: check the node/);
  assert.equal(count(d.getElementById("tiles").textContent, /check|overdue/g), 0, "the tile doesn't repeat the warning");
  assert.ok(d.querySelector("#tiles .v.bad"), "Last block tile marked red");
});
