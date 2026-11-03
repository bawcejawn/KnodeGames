// C-W-2 failing test - NOT RUN HERE (static review). Uses the owner's own browser harness (tests/browser/harness.cjs)
// and the real site/combo.html + combo.js in Chromium:  cp to tests/browser/ ; node --test tests/browser/cw2-stake-check.test.cjs
// A wallet with no stake in the Combo Card this week must be refused before anything is signed. At 32fae49 the page
// reads game/abi/kpred.koilib.json, which has no get_game_player (and on refs/x/picks the v6 ABI is kpred-v6.koilib.json),
// so readStake() returns null and Send is enabled for an unstaked wallet.
const test = require("node:test"), assert = require("node:assert");
const H = require("./harness.cjs");
// (Owner, 2026-11-03, D-081: every game has Free play. The reviewer's C-W-2 asked that an unstaked wallet be refused;
// that rule is gone. The test now checks the stake is still read with the v6 ABI and decides the board: an unstaked
// wallet can send, and is told its cards count on the Free play board, which pays no VHP for now.)
test("C-W-2 (D-081): an unstaked wallet can send a Combo card, on the Free play board", { timeout: 60000 }, async () => {
  await H.awayFromMidnight();
  const now = Date.now();
  const t = await H.open({ vault: "unstaked", legs: H.openLegs(now),
    files: { "picks-data/deployment.json": JSON.stringify({ contract: H.PICKS, cards: true }) } });  // the live switch
  try {
    const { page } = t;
    await page.waitForFunction(() => /Send card/.test(document.getElementById("send").textContent) && !document.getElementById("send").disabled, null, { timeout: 20000 });
    await page.waitForFunction(() => /Free play: your cards count on the Free play board/.test(document.getElementById("which-board").textContent), null, { timeout: 20000 });
  } finally { await t.browser.close(); }
});

test("D-081: a staked wallet is told its cards count on the Staked board", { timeout: 60000 }, async () => {
  await H.awayFromMidnight();
  const t = await H.open({ vault: "staked", legs: H.openLegs(Date.now()),
    files: { "picks-data/deployment.json": JSON.stringify({ contract: H.PICKS, cards: true }) } });
  try {
    const { page } = t;
    await page.waitForFunction(() => /count on the Staked board/.test(document.getElementById("which-board").textContent), null, { timeout: 20000 });
  } finally { await t.browser.close(); }
});
