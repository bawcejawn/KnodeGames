// Repo Lens #G-37 (Combo delta @ f41f5bec): G37-2 (Low), FC4-4 partly fixed. Place in tests/audit/ (next to
// combo-verify.test.mjs). The Vault-read budget is checked only BEFORE each read starts (vaultView inTime()); a read
// that is already running is never cut off, and rpcNode's fetch has no timeout of its own (undici's defaults are 5
// minutes, and rpcNode tries 3 times). One stalled node read can still run the verify job past its 20-minute limit, and
// a killed job sets no "approved" output, so the day files confirmed first (onDays) are not published either.
// Expected: verify() returns soon after its budget even if a Vault read never answers.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import path from "node:path";
import { fileURLToPath } from "node:url";
process.env.APP ||= fileURLToPath(new URL("../../", import.meta.url));
const ROOT = process.env.APP;
const F = await import(path.join(ROOT, "tests/audit/repolens-fc-combo/D-R.fixtures.mjs"));
const { run, M, C, H1, H2, H3, ALICE, BOB, W3, heightAt, raceDir, blockxDir, node, quiet, tmp, VAULT, PICKS } = F;
const V = await import(path.join(ROOT, "tools/combo-verify.mjs"));
const D3 = C.utcDay(W3), S0 = C.slotRound(D3, 0);
const GET_GAME_PLAYER = 267077419;
function vnode(n, hang = false) {
  return { async call(method, params) {
    if (method === "chain.get_head_info") return n.getHeadInfo();
    if (method === "chain.read_contract") {
      if (hang && params.entry_point === GET_GAME_PLAYER) return new Promise(() => {});   // a node that never answers
      return n.readContract(params);
    }
    return n.call(method, params);
  } };
}
const twoCards = (round) => {
  const sent = D3 * M.DAY + 2 * 3600000, r6 = D3 * 4 + 1;
  const c = (p, l2) => ({ player: p, legs: [{ code: C.WIN, round: r6, producer: H1 }, l2], time: sent, height: heightAt(sent), changes: 0 });
  return round === S0 ? [c(ALICE, { code: C.SHOW, round: r6, producer: H2 }), c(BOB, { code: C.SHOW, round: r6, producer: H3 })] : [];
};

test("G37-2 (Low): a Vault read that never answers can't hold the verify job past its time budget", async () => {
  const t = M.weekStart(4) + 13 * 3600000, out = tmp(), race = raceDir(), bx = blockxDir();
  const stake = (p) => (p === ALICE ? 200000000n : 0n);
  await quiet(() => run({ p: node({ t, cards: twoCards, stake }), check: node({ t, cards: twoCards, stake }), out, raceDir: race, blockxDir: bx, picksContract: PICKS, knodeGame: VAULT, now: t, vhpMovesOf: async () => 0n }));
  assert.ok(fs.existsSync(path.join(out, "vault")) && fs.readdirSync(path.join(out, "vault")).length, "precondition: the run wrote a Vault file to confirm");
  const pub = tmp(); for (const f of fs.readdirSync(out).filter((x) => x === "board.json" || /^L\d+(-\d+)?\.json$/.test(x))) fs.copyFileSync(path.join(out, f), path.join(pub, f));   // the board and its L parts (capacity standard)
  const done = V.verify({ incoming: out, published: pub, race, blockx: bx, picks: PICKS, vault: VAULT, now: t, vaultBudgetMs: 200,
    p: vnode(node({ t, cards: twoCards, stake }), true), check: vnode(node({ t, cards: twoCards, stake })), vhpMovesOf: async () => 0n }).then(() => "returned");
  const late = new Promise((res) => { setTimeout(() => res("still running 3 s after a 0.2 s budget"), 3000); });
  assert.equal(await Promise.race([done, late]), "returned");
});
