// Repo Lens #G-16 (Combo fix-check 4 @ ba2d9b30): FC4-1 and FC4-2. Place in tests/audit/repolens-fc-combo/ (next to D-R.fixtures.mjs).
// FC4-1: the verify job accepts a forged VOID. A compromised record run marks a rival's winning Block X leg "unresolved"
// (outcome void, 0 points). combo-score.mjs recheck() lets an unresolved Block X leg pass whenever the files show a hit
// ("the chain's reasons"), and tools/combo-verify.mjs passes recheck(c, day, true), but recheck takes no third argument,
// so the chain is never asked. The publish job (card_supported) accepts it too. Fix: with chain = true, accept such a leg
// only if movedInto() reports a non-standard transfer on both nodes, or a read that still holds past the hold edge.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import path from "node:path";
import { fileURLToPath } from "node:url";
process.env.APP ||= fileURLToPath(new URL("../../../", import.meta.url));
const ROOT = process.env.APP;
const { run, M, X, C, H1, H2, H3, ALICE, BOB, W3, heightAt, raceDir, blockxDir, node, quiet, read, tmp, VAULT, PICKS } = await import("./D-R.fixtures.mjs");
const V = await import(path.join(ROOT, "tools/combo-verify.mjs"));
const D3 = C.utcDay(W3), S0 = C.slotRound(D3, 0), dn = (d) => `D${String(d).padStart(5, "0")}.json`;
function vnode(n) {
  return { async call(method, params) {
    if (method === "chain.get_head_info") return n.getHeadInfo();
    if (method === "chain.read_contract") return n.readContract(params);
    return n.call(method, params);
  } };
}

test("FC4-1 (High): a rival's hit turned into a void through an 'unresolved' Block X leg is not confirmed by the verify job", async () => {
  const sent = D3 * M.DAY + 13 * 3600000, rf = D3 * 4 + 3, blockT = D3 * M.DAY + 20 * 3600000, R = Math.ceil(heightAt(blockT) / X.ROUND), signer = R % 2 === 0 ? H1 : H2, other = signer === H1 ? H2 : H1;
  const legs = [{ code: C.SHOW, round: rf, producer: other }, { code: C.SHOW, round: rf - 1, producer: H3 }, { code: C.BLOCK, round: R, producer: signer }];
  const cards = (r) => (r === S0 ? [ALICE, BOB].map((player) => ({ player, legs, time: sent, height: heightAt(sent), changes: 0 })) : []);
  const t = M.weekStart(4) + 13 * 3600000, out = tmp(), race = raceDir(), bx = blockxDir();
  await quiet(() => run({ p: node({ t, cards }), check: node({ t, cards }), out, raceDir: race, blockxDir: bx, picksContract: PICKS, knodeGame: VAULT, now: t, vhpMovesOf: async () => 0n }));
  const bob = read(out, dn(D3)).slots.find((s) => s.round === S0).cards.find((c) => c.player === BOB);
  assert.equal(bob.outcome, "hit", "precondition: Bob's honest card hit, its Block X leg included");
  const go = () => V.verify({ incoming: out, published: tmp(), race, blockx: bx, picks: PICKS, now: t,
    p: vnode(node({ t, cards })), check: vnode(node({ t, cards })), vhpMovesOf: async () => 0n });   // both nodes: an ordinary transfer
  assert.ok((await go()).approved.some((x) => x.name === dn(D3)), "precondition: the honest day is confirmed");
  // The forged run: Bob's Block X leg "unresolved", his card void with 0 points (its shape stays the recorder's).
  const j = read(out, dn(D3));
  const c = j.slots.find((s) => s.round === S0).cards.find((x) => x.player === BOB);
  c.legs[2][4] = "unresolved"; c.outcome = "void"; c.pts = 0;
  fs.writeFileSync(path.join(out, dn(D3)), JSON.stringify(j) + "\n");
  const r = await go();
  assert.ok(!r.approved.some((x) => x.name === dn(D3)), "a forged void of a rival's hit was confirmed although both nodes read the VHP moves normally");
  assert.ok(r.problems.some((x) => x.day === D3 && x.alert));
});

// FC4-2: since vault week 3 (Mon 9 Nov) Block X publishes HOURLY targets (Picks game 12, a target every 1,200 blocks:
// blockx-math.js MAINNET_HOURLY, R-BX-25), so games-data/blockx/W003.json has round = height / 1,200. Combo's Block X legs
// use game 2's 2,400-block rounds (X.ROUND, X.target) and look targets up by round (combo-score.mjs blockTargets; the
// publish job keeps only height == round * 2400, combo.yml:412), so a leg on block 2,400·R (hourly round 2R) finds no
// target: it stays pending, and at the deadline it is unresolved (the "past" check compares rounds of two scales), so every
// card with a Block X leg is void, and the publish job agrees. Fix (off chain; the leg type's round size 2,400 can stay,
// every 2,400th block is an hourly target): look a leg's target up by its block height X.target(round), and compare
// heights in the "past" check, in the recorder, the verify job and the publish job alike (blind verifier, #G-16).
test("FC4-2 (Medium): a Block X leg is decided by its own block when Block X publishes hourly targets (round = height / 1,200)", async () => {
  const sent = D3 * M.DAY + 13 * 3600000, rf = D3 * 4 + 3, blockT = D3 * M.DAY + 20 * 3600000, R = Math.ceil(heightAt(blockT) / X.ROUND), signer = R % 2 === 0 ? H1 : H2, other = signer === H1 ? H2 : H1;
  const legs = [{ code: C.SHOW, round: rf, producer: other }, { code: C.SHOW, round: rf - 1, producer: H3 }, { code: C.BLOCK, round: R, producer: signer }];
  const cards = (r) => (r === S0 ? [{ player: ALICE, legs, time: sent, height: heightAt(sent), changes: 0 }] : []);
  const t = M.weekStart(4) + 13 * 3600000, race = raceDir();
  const old = blockxDir(), hourly = tmp();                       // the same blocks and signers, in today's hourly shape
  for (const f of fs.readdirSync(old)) {
    const j = JSON.parse(fs.readFileSync(path.join(old, f), "utf8"));
    const by = new Map(j.targets.map((x) => [x.height, x]));
    const out = [];
    for (const x of j.targets) for (const h of [x.height - 1200, x.height]) {
      const y = by.get(h) ?? { ...x, height: h, signer: H3, time: x.time - 1200 * 3000 };   // the in-between hour: someone else
      if (!out.some((z) => z.height === h)) out.push({ ...y, round: h / 1200 });
    }
    fs.writeFileSync(path.join(hourly, f), JSON.stringify({ ...j, targets: out }));
  }
  const go = async (bx) => { const o = tmp(); await quiet(() => run({ p: node({ t, cards }), check: node({ t, cards }), out: o, raceDir: race, blockxDir: bx, picksContract: PICKS, knodeGame: VAULT, now: t, vhpMovesOf: async () => 0n })); return read(o, dn(D3)).slots.find((s) => s.round === S0).cards[0]; };
  const a = await go(old);
  assert.equal(a.legs[2][4], "hit", "precondition: with 2,400-block targets the Block X leg hits");
  const b = await go(hourly);
  assert.equal(b.legs[2][4], "hit", `with hourly targets (as Block X publishes since 9 Nov) the leg on block ${X.target(R)} is ${b.legs[2][4]}`);
  assert.equal(b.outcome, a.outcome);
});
