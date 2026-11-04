// Race picks owner change (I-077, R-RACE-3, D-096): `npm run racepicks -- owner <new> --confirm <new> --send`.
// The on-chain change is one step and immediate, so the tool must: refuse a bad or forbidden address, need the address
// typed twice and the new key in .env as proof, keep every other setting, read the result back on both nodes, and
// sign only for the pinned mainnet contract. Also: on/off and the daily limit never move the owner. Offline.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Signer } from "koilib";
import { planOwnerChange, changeOwner, forbiddenOwners, raceAddressFor, flagValue, RACE_PINNED_MAINNET, type OwnerDeps } from "../../bot/race-picks.ts";

const addr = () => Signer.fromSeed(Math.random().toString(36) + Date.now()).getAddress();
const OLD = addr(), NEW = addr(), OTHER = addr();
const g = { contract: "1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr", owner: OLD, operator: "1HsM33pF8DbXPr8Vsd4vD7hQgvZ1SHY3Vv", seedOwner: "1K8VV1utXfomeXHeifrwgLpBjUG6Ldkw2Z" };
const cur = { owner: OLD, enabled: true, max_picks_per_day: 5 };
const forbidden = forbiddenOwners(g, RACE_PINNED_MAINNET, null);
const base = { cur, next: NEW, forbidden, send: false };

test("plan: a valid new address keeps picks on/off and the daily limit exactly", () => {
  const { config } = planOwnerChange(base);
  assert.deepEqual(config, { owner: NEW, enabled: true, max_picks_per_day: 5 });
  const off = planOwnerChange({ ...base, cur: { owner: OLD, enabled: false, max_picks_per_day: 3 } }).config;
  assert.deepEqual(off, { owner: NEW, enabled: false, max_picks_per_day: 3 });
});

test("plan: refuses a typo (bad checksum), the same owner, and every contract or hot wallet", () => {
  const typo = NEW.slice(0, -1) + (NEW.endsWith("a") ? "b" : "a");
  assert.throws(() => planOwnerChange({ ...base, next: typo }), /not a valid Koinos address/);
  assert.throws(() => planOwnerChange({ ...base, next: "" }), /Give the new owner/);
  assert.throws(() => planOwnerChange({ ...base, next: OLD }), /already the race contract's owner/);
  for (const bad of [RACE_PINNED_MAINNET, g.contract, g.operator, g.seedOwner, "1ByDDSBUzy5zkRceELc54Jh8i41yNRoKt8", "19GYjDBVXU7keLbYvMLazsGQn3GTWHjHkK", "12Y5vW6gk8GceH53YfRkRre2Rrcsgw7Naq", "1FKTpXBhhHEbu5vVchM8UsVbAvPArJsRmR"])
    assert.throws(() => planOwnerChange({ ...base, next: bad }), /The owner must be a person's wallet/, bad);
  assert.throws(() => planOwnerChange({ ...base, cur: {} }), /no owner yet/);
});

test("plan: --send needs the address twice, the new key as proof, and the current owner's key", () => {
  const ok = { ...base, send: true, confirm: NEW, proof: NEW, signer: OLD };
  assert.equal(planOwnerChange(ok).config.owner, NEW);
  assert.throws(() => planOwnerChange({ ...ok, confirm: undefined }), /type the new address a second time/);
  assert.throws(() => planOwnerChange({ ...ok, confirm: OTHER }), /The two addresses differ/);
  assert.throws(() => planOwnerChange({ ...ok, confirm: "" }), /The two addresses differ/);
  assert.throws(() => planOwnerChange({ ...ok, proof: undefined }), /NEW_OWNER_WIF/);
  assert.throws(() => planOwnerChange({ ...ok, proof: OTHER }), /NEW_OWNER_WIF belongs to/);
  assert.throws(() => planOwnerChange({ ...ok, signer: NEW }), /OWNER_WIF belongs to/);
  // A dry run with a wrong --confirm or wrong proof already says so.
  assert.throws(() => planOwnerChange({ ...base, confirm: OTHER }), /differ/);
  assert.throws(() => planOwnerChange({ ...base, proof: OTHER }), /NEW_OWNER_WIF belongs to/);
});

test("plan: says whether the new owner matches the vault owner in game-data/deployment.json", () => {
  assert.match(planOwnerChange({ ...base, vaultOwner: OTHER }).notes.join(), /not the vault owner/);
  assert.match(planOwnerChange({ ...base, vaultOwner: NEW }).notes.join(), /also the vault owner/);
});

function deps(over: Partial<OwnerDeps> = {}, chain: Record<string, any> = { a: { ...cur }, b: { ...cur } }) {
  const sent: any[] = [], lines: string[] = [];
  const d: OwnerDeps = {
    rpc: "a", rpcCheck: "b", mainnet: true, race: RACE_PINNED_MAINNET, g, picks: null, env: { CONFIRM_MAINNET: "yes" },
    readConfig: async (n) => ({ ...chain[n] }), hasCode: async () => false,
    send: async (config) => { sent.push(config); chain.a = { ...config }; chain.b = { ...config }; return { ok: true, txId: "0x1220ab", rcUsed: "1000" }; },
    signerAddress: () => OLD, proofAddress: () => NEW, log: (...a) => lines.push(a.join(" ")),
    ...over,
  };
  return { d, sent, lines, chain };
}

test("flow: a dry run sends nothing", async () => {
  const { d, sent, lines } = deps();
  assert.equal(await changeOwner(NEW, undefined, false, d), false);
  assert.equal(sent.length, 0);
  assert.match(lines.join("\n"), /Dry run only/);
  assert.match(lines.join("\n"), /ONE step/);
});

test("flow: --send sends one set_config and reads it back on both nodes", async () => {
  const { d, sent, lines } = deps();
  assert.equal(await changeOwner(NEW, NEW, true, d), true);
  assert.deepEqual(sent, [{ owner: NEW, enabled: true, max_picks_per_day: 5 }]);
  assert.match(lines.join("\n"), /owner is now .* on both nodes/);
});

test("flow: refuses mainnet without CONFIRM_MAINNET, and when the two nodes disagree on the owner", async () => {
  await assert.rejects(changeOwner(NEW, NEW, true, deps({ env: {} }).d), /CONFIRM_MAINNET/);
  const split = deps({}, { a: { ...cur }, b: { ...cur, owner: OTHER } });
  await assert.rejects(changeOwner(NEW, NEW, true, split.d), /two nodes disagree/);
  assert.equal(split.sent.length, 0);
});

test("flow: a failed send or a read-back that doesn't match is reported, never 'done'", async () => {
  const failed = deps({ send: async () => ({ ok: false, error: "reverted: RACE: needs the owner's key" }) });
  assert.equal(await changeOwner(NEW, NEW, true, failed.d), false);
  assert.match(failed.lines.join("\n"), /not done.*Don't send it again/s);
  const stale = deps();
  stale.d.send = async (config) => { stale.chain.a = { ...config }; return { ok: true, txId: "0x1" }; }; // node b still old
  assert.equal(await changeOwner(NEW, NEW, true, stale.d), false);
  assert.match(stale.lines.join("\n"), /b: owner reads/);
});

test("on mainnet the tool signs only for the pinned race contract", () => {
  const main = "https://koinos.armana.io";
  assert.equal(raceAddressFor(main, { contract: RACE_PINNED_MAINNET }, {}), RACE_PINNED_MAINNET);
  assert.throws(() => raceAddressFor(main, { contract: OTHER }, {}), /RACE_CONTRACT_ADDRESS/);
  assert.equal(raceAddressFor(main, { contract: OTHER }, { RACE_CONTRACT_ADDRESS: OTHER }), OTHER);
  assert.equal(JSON.parse(fs.readFileSync("race-data/deployment.json", "utf8")).contract, RACE_PINNED_MAINNET);
});

test("flags: --confirm with and without a value", () => {
  assert.equal(flagValue(["x", "--confirm", NEW, "--send"], "--confirm"), NEW);
  assert.equal(flagValue(["x", "--confirm", "--send"], "--confirm"), "");
  assert.equal(flagValue(["x", "--send"], "--confirm"), undefined);
});

test("enable / disable / limit keep the owner the chain reports, and the key is checked against the chain", () => {
  const src = fs.readFileSync("bot/race-picks.ts", "utf8");
  assert.match(src, /buildRaceConfig\(firstSetup \? g\.owner : cur\.owner, enabled, perDay\)/);
  assert.match(src, /ownerKey\(provider, cur\.owner\)/);
  assert.doesNotMatch(src, /s\.getAddress\(\) !== g\.owner/);
});

// ── Repo Lens #D-5 (3 Nov): the three Lows ──
test("R84-1: a new owner that is a contract (has code on either node) is refused, and an unreadable check refuses too", async () => {
  const onB = deps({ hasCode: async (n) => n === "b" });
  await assert.rejects(changeOwner(NEW, NEW, true, onB.d), /is a contract \(it has code on chain\)/);
  assert.equal(onB.sent.length, 0);
  await assert.rejects(changeOwner(NEW, undefined, false, deps({ hasCode: async () => true }).d), /is a contract/, "the dry run says so too");
  const down = deps({ hasCode: async () => { throw new Error("timeout"); } });
  await assert.rejects(changeOwner(NEW, NEW, true, down.d), /Couldn't check whether/);
  assert.equal(down.sent.length, 0);
});

test("R84-2: on mainnet the send needs a second node; a dry run on one node warns", async () => {
  const one = deps({ rpcCheck: undefined });
  await assert.rejects(changeOwner(NEW, NEW, true, one.d), /needs a second node/);
  assert.equal(one.sent.length, 0);
  const dry = deps({ rpcCheck: undefined });
  await changeOwner(NEW, undefined, false, dry.d);
  assert.match(dry.lines.join("\n"), /Only one node/);
  assert.equal(await changeOwner(NEW, NEW, true, deps({ rpcCheck: undefined, mainnet: false }).d), true, "testnet: one node is allowed");
});

test("R84-3: the nodes must agree on every setting, not only the owner", async () => {
  for (const b of [{ ...cur, enabled: false }, { ...cur, max_picks_per_day: 4 }, { ...cur, max_picks_per_day: "5" }]) {
    const x = deps({}, { a: { ...cur }, b });
    if (b.max_picks_per_day === "5") { assert.equal(await changeOwner(NEW, NEW, true, x.d), true, "\"5\" and 5 are the same"); continue; }
    await assert.rejects(changeOwner(NEW, NEW, true, x.d), /two nodes disagree about the race contract's (picks on\/off|picks per day)/, JSON.stringify(b));
    assert.equal(x.sent.length, 0);
  }
});

test("R-RACE-9 (Repo Lens #C-4 C4-3): a node with no race settings stops with a plain reason, not 'NaN; NaN'", async () => {
  for (const chain of [{ a: {}, b: {} }, { a: { ...cur }, b: {} }, { a: {}, b: { ...cur } }, { a: null, b: null }]) {
    const x = deps({}, chain);
    await assert.rejects(changeOwner(NEW, NEW, true, x.d), (e: any) => {
      assert.match(e.message, /No race settings on chain at (a|b)/); assert.doesNotMatch(e.message, /NaN|disagree/); return true;
    }, JSON.stringify(chain));
    assert.equal(x.sent.length, 0);
  }
  // One node only: the same plain reason, also on a dry run.
  await assert.rejects(changeOwner(NEW, undefined, false, deps({ rpcCheck: undefined }, { a: {} }).d), /No race settings on chain at a/);
});
