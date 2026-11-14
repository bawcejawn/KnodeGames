// Free read split (Capacity, gate item 2): the public pages start their chain reads on Armana or koinosblocks at random,
// the other node is the failover, and each page's CSP lets both through. Offline: reads the files only.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (f) => fs.readFileSync(f, "utf8");
const csp = (h) => (h.match(/connect-src([^;"]*)/) || [])[1] || "";

test("race, mana, pulse and the home page give the provider both nodes, in a random order", () => {
  for (const f of ["race.js", "mana.js", "pulse.js", "app.js"]) {
    const js = read(f);
    assert.match(js, /const RPCS = \["https:\/\/koinos\.armana\.io", "https:\/\/api\.koinosblocks\.com"\];/, f);
    assert.match(js, /Math\.random\(\) < 0\.5\) RPCS\.reverse\(\)/, f);
    assert.match(js, /new lib\.Provider\((dep\.rpc && dep\.rpc !== RPC \? \[dep\.rpc\] : )?RPCS\)/, f);
    assert.ok(!/new lib\.Provider\(\[RPC\]\)/.test(js), `${f}: still reads from one node`);
  }
});

test("bracket and Block X (mainnet) also start on either node", () => {
  assert.match(read("bracket.js"), /Math\.random\(\) < 0\.5\) RPC\.reverse\(\)/);
  assert.match(read("blockx.js"), /rpc: Math\.random\(\) < 0\.5 \? \["https:\/\/koinos\.armana\.io", "https:\/\/api\.koinosblocks\.com"\] : \["https:\/\/api\.koinosblocks\.com", "https:\/\/koinos\.armana\.io"\]/);
});

test("every page that reads the chain lets both nodes through its CSP", () => {
  for (const f of ["index.html", "race.html", "mana.html", "pulse.html", "bracket.html", "blockx.html"]) {
    const c = csp(read(f));
    assert.ok(c.includes("https://koinos.armana.io") && c.includes("https://api.koinosblocks.com"), f);
  }
});
