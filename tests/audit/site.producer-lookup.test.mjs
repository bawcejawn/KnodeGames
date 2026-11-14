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
const KOIN = "19GYjDBVXU7keLbYvMLazsGQn3GTWHjHkK";
function chain(n, meLastAgoBlocks, { key = "AiBcDeFgHiJkLmNoPq", koin = 500 } = {}) {
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
        async call(m, a) { if (m === "contract_meta_store.get_contract_meta") return a.contract_id === OTHERS[0] ? { meta: { hash: "0xabc", abi: '{"methods":{"get_beneficiaries":{}}}' } } : {}; const s = Number(a.ancestor_start_height), k = Math.min(a.num_blocks, top - s + 1); return { block_items: Array.from({ length: Math.max(0, k) }, (_, i) => block(s + i)) }; } },
      Serializer: class { async deserialize(d) { return JSON.parse(d); } },
      Contract: class { constructor({ id }) { this.functions = {
        balance_of: async ({ owner }) => ({ result: { value: String((id === KOIN ? (owner === ME ? koin : 0) : VHPS[owner] || 0) * 1e8) } }),
        get_public_key: async () => ({ result: key ? { value: key } : {} }) }; } },
    },
  };
}

const opened = [];
after(() => { for (const w of opened) w.close(); });
// This week's published files (vault week 4 = Mon 16 Nov): two Ruler-placed races, and Fantasy's price list.
const FILES = {
  "race-data/W004.json": { v: 1, week: 4, races: [{ id: "2026-11-16T00" }, { id: "2026-11-16T06" }, { id: "2026-11-16T12" }] },
  "race-data/R004.json": { v: 1, week: 4, mode: "on", races: [{ id: "2026-11-16T00", placings: [ME, OTHERS[0], OTHERS[1]] }, { id: "2026-11-16T06", placings: [OTHERS[0], OTHERS[1], OTHERS[2], ME] }, { id: "2026-11-16T12" }] },
  "games-data/fantasy/inputs/W4.json": { week: 4, data: { budget: 100, pool: [{ a: ME, price: 26, form: 10341 }, { a: OTHERS[0], price: 40, form: 9900 }] } },
};
async function open(meLastAgoBlocks, opts, { win = "28800", a = ME } = {}) {
  const c = chain(28800, meLastAgoBlocks, opts);
  const dom = new JSDOM(HTML.replace(/<script[\s\S]*?<\/script>/g, ""), { url: `https://knodegames.com/node.html?a=${a}&w=${win}`, runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window; opened.push(w);
  w.koilib = c.lib;
  w.fetch = async (url) => { const k = Object.keys(FILES).find((f) => String(url).endsWith(f)); return k ? { ok: true, json: async () => FILES[k] } : { ok: false, json: async () => null }; };
  w.Date.now = () => c.now;
  w.eval(JS);
  for (let i = 0; i < 400 && w.document.getElementById("out").hidden; i++) await new Promise((r) => setTimeout(r, 10));
  assert.equal(w.document.getElementById("out").hidden, false, `page rendered: ${w.document.getElementById("status").textContent}`);
  return w.document;
}
const wait = async (f) => { for (let i = 0; i < 300 && !f(); i++) await new Promise((r) => setTimeout(r, 10)); };
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

test("node checklist: key registered, KOIN for Mana, what a burn adds, the longest quiet spell", async () => {
  const d = await open(5), t = d.getElementById("check").textContent;
  assert.match(t, /Producer key registered: AiBcDeFgHi…/);
  assert.match(t, /500 KOIN in the address\. Its Mana pays for signing blocks, so keep some KOIN here\./);
  assert.match(t, /Burning 500 KOIN into VHP would add about [0-9.,]+ blocks a day \(now about [0-9.,]+\)\./);
  assert.match(t, /Longest quiet spell in the last 24 hours: .+\. For its size, about .+ is usual\./);
  assert.equal(d.querySelectorAll("#check li.bad").length, 0, "a healthy node: nothing red");
  assert.ok(d.querySelector('#check a[href="burn.html"]'));
});

test("node checklist: no key, no KOIN and a long quiet spell are red, with a link to register", async () => {
  const d = await open(4000, { key: "", koin: 0 }), t = d.getElementById("check").textContent;
  assert.match(t, /No producer key is registered for this address, so no node can sign blocks for it\./);
  assert.ok(d.querySelector('#check a[href="producer.html"]'));
  assert.match(t, /No KOIN in this address\. A producer needs some KOIN, for its Mana, to sign blocks\./);
  assert.doesNotMatch(t, /Burning/, "nothing to burn");
  assert.equal(d.querySelectorAll("#check li.bad").length, 3);
});

test("this week in Knode Games: Race places from the Ruler file, Fantasy price and form", async () => {
  const d = await open(5), t = d.getElementById("kg").textContent;
  assert.match(t, /Producer Race: in 2 of 2 finished races this week; 1st in 1, top 3 in 1 \(the Ruler's places\)\./);
  assert.match(t, /Fantasy Producers: price 26 \(a team's budget is 100\), form 103\.4 \(100 = as expected for its size\)\./);
});

test("profit in the window and the yearly rate are shown once each, and no banned words", async () => {
  const d = await open(5), tiles = d.getElementById("tiles").textContent, all = d.getElementById("out").textContent;
  assert.match(tiles, /KOIN after VHP used, 24 hours≈ [0-9.,]+/);
  assert.equal(count(all, /% a year/g), 1);
  assert.doesNotMatch(all, /\b(bet|odds|gambl\w*|earn\w*|returns|guaranteed|beta)\b/i);
});

test("next rank: the VHP that would move it up one place and the VHP for 1 more block a day", async () => {
  const d = await open(5), t = d.getElementById("check").textContent;
  assert.match(t, /About [0-9,]+ more VHP would move it up to #2 by VHP, past 1MidPr…BBBB\. About [0-9,]+ more VHP would add 1 block a day\./);
});

test("pool check: the Knode Games vault is named; a contract address is called a pool, Fogata-looking ones say so", async () => {
  const d = await open(5);
  assert.match(d.getElementById("check").textContent, /This is the Knode Games vault's contract: the VHP players stake produces blocks here/);
  const d2 = await open(5, {}, { a: OTHERS[0] });
  assert.match(d2.getElementById("check").textContent, /This address is a smart contract, not a personal wallet, so it is most likely a mining pool, and it looks like a Fogata pool\./);
  assert.ok(d2.querySelector('#check a[href="https://www.koinscan.io/fogata"]'));
});

test("daily pattern: asks for 3 or 7 days in a 24-hour window; with 3 days, 24 bars and the quiet hours named", async () => {
  const d = await open(5);
  assert.equal(d.getElementById("hours-card").hidden, false);
  assert.match(d.getElementById("hours-sub").textContent, /Pick the last 3 or 7 days/);
  assert.equal(d.querySelectorAll("#hours rect").length, 0);
  const d3 = await open(5, {}, { win: "86400" });
  assert.equal(d3.querySelectorAll("#hours rect").length, 24);
  assert.match(d3.getElementById("hours-sub").textContent, /Each bar is one hour of the day on your clock/);
});

test("compare: a second address side by side in the same window, and it stays in the link", async () => {
  const d = await open(5), w = d.defaultView;
  d.getElementById("cmp-addr").value = OTHERS[0];
  d.getElementById("cmp-form").dispatchEvent(new w.Event("submit", { cancelable: true }));
  await wait(() => d.querySelectorAll("#cmp tbody tr").length === 8);
  const t = d.getElementById("cmp").textContent;
  assert.equal(d.querySelectorAll("#cmp tbody tr").length, 8);
  assert.match(t, /Rank by VHP#3#1/);
  assert.match(t, /Kind of addresscontract \(pool or vault\)contract \(pool or vault\)/);
  assert.match(w.location.search, new RegExp(`b=${OTHERS[0]}`));
  d.getElementById("cmp-addr").value = ME;
  d.getElementById("cmp-form").dispatchEvent(new w.Event("submit", { cancelable: true }));
  assert.match(d.getElementById("cmp-note").textContent, /That is the producer shown above/);
});
