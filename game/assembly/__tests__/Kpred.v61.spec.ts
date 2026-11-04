/**
 * v6.1 (D-092, R-VAULT-6): doubled Questions. A week may hold 60 questions from the week AFTER the upgrade; the week the
 * upgrade lands in keeps 30. get_state shows this week's and next week's cap. MockVM. Run: npm test
 */
import { Base58, MockVM, authority, chain, System, protocol } from "@koinos/sdk-as";
import { Kpred, testSetInitV6Rule, testSetInitQ60Rule, testSetSafeMode, testSetFinalizePage } from "../Kpred";
import { Tokens } from "../Tokens";
import { kpred } from "../proto/kpred";

const CONTRACT = Base58.decode("1DQzuCcTKacbs9GGScRTU1Hc8BsyARTPqe");
const OWNER = Base58.decode("1DQzuCcTKacbs9GGScRTU1Hc8BsyARTPqG");
const OPERATOR = Base58.decode("1DQzuCcTKacbs9GGScRTU1Hc8BsyARTPqK");
const SEED = Base58.decode("1DQzuCcTKacbs9GGScRTU1Hc8BsyARTPqP");
const PA = Base58.decode("1PWeFG4pPtjZZoYvcmGb6mYhMYJjnkHrmz");
const PB = Base58.decode("1HGh4rQvYYcm4fGiU1C7vQoSxnUiGa9Ah7");
const PC = Base58.decode("12Y5vW6gk8GceH53YfRkRre2Rrcsgw7Naq");
const PD = Base58.decode("19GYjDBVXU7keLbYvMLazsGQn3GTWHjHkK");
const PE = Base58.decode("159myq5YUhhoVWu3wsHKHiJYKPKGUrGiyv");
const KOIN_TAG: u8 = 1, VHP_TAG: u8 = 2, MANA_TAG: u8 = 3;

const VHP: u64 = 100_000_000;
const GENESIS: u64 = 1000, WEEK: u64 = 1000;
const MS: u64 = 2800;
const CLOSE: u64 = 10, SETTLE: u64 = 100, LOCK: u64 = 50;

let gK: Kpred | null = null;
let gW: u64 = 0;
let gWho: Uint8Array = new Uint8Array(0);
let gWeek: u64 = 0;

function at(h: u64): void {
  MockVM.commitTransaction();
  MockVM.setBlock(new protocol.block(new Uint8Array(0), new protocol.block_header(new Uint8Array(0), h, h * MS)));
  System.resetCache();
}
function as(acct: Uint8Array): void {
  MockVM.commitTransaction();
  MockVM.setAuthorities([new MockVM.MockAuthority(authority.authorization_type.contract_call, acct, true)]);
}

/** A contract as the upgrade leaves it (`q60Rule` 0: the rule week is not set yet) or a fresh one (1: from week 0). */
function setup(q60Rule: u64): Kpred {
  MockVM.reset();
  MockVM.setContractId(CONTRACT);
  MockVM.setContractArguments(CONTRACT);
  MockVM.setEntryPoint(0);
  MockVM.setCaller(new chain.caller_data(new Uint8Array(0), chain.privilege.user_mode));
  MockVM.setContractMetadata(new chain.contract_metadata_object(new Uint8Array(0), false, false, false, false));
  MockVM.setHeadInfo(new chain.head_info(null, 0, 1));
  at(100);
  testSetInitV6Rule(1);
  testSetInitQ60Rule(q60Rule);
  testSetSafeMode(false);
  const k = new Kpred();
  k.init(new kpred.init_arguments(OWNER, OPERATOR, SEED, GENESIS * MS, WEEK * MS, CLOSE * MS, SETTLE * MS, LOCK * MS, VHP, VHP));
  return k;
}

/** Posts one question in week w (answers close 300 blocks into the week). */
function postIn(k: Kpred, w: u64): void {
  as(OPERATOR);
  const s = GENESIS + w * WEEK;
  k.post_question(new kpred.post_question_arguments(2, (s + 300) * MS, s + 301, s + 400, new Uint8Array(32).fill(7)));
}
function postMany(k: Kpred, w: u64, n: u32): void {
  for (let i: u32 = 0; i < n; i++) postIn(k, w);
  MockVM.commitTransaction();
}
function fund(who: Uint8Array[]): void {
  for (let p = 0; p < who.length; p++) {
    Tokens.testSet(VHP_TAG, who[p], 1000 * VHP);
    Tokens.testSet(MANA_TAG, who[p], 1000 * VHP);
  }
  Tokens.testSet(MANA_TAG, CONTRACT, 1000 * VHP);
}
/** `n` answers from question `from` on: the first `right` of them correct (option 1; every question resolves 1). */
function answerN(k: Kpred, who: Uint8Array, from: u32, n: u32, right: u32): void {
  as(who);
  for (let i: u32 = 0; i < n; i++) k.answer(new kpred.answer_arguments(who, from + i, i < right ? 1 : 0));
}
function resolveAll(k: Kpred, from: u32, n: u32): void {
  as(OPERATOR);
  for (let i: u32 = 0; i < n; i++) k.resolve_question(new kpred.resolve_question_arguments(from + i, 1, new Uint8Array(32).fill(9)));
}
/** Close vault week w once it can close (its end, or its last result, plus the close delay). */
function closeAt(k: Kpred, w: u64): void {
  at(GENESIS + (w + 1) * WEEK + CLOSE + 1);
  MockVM.setAuthorities([]);
  k.close_week(new kpred.close_week_arguments(w));
  MockVM.commitTransaction();
}
function oneTooMany(k: Kpred, w: u64): void {
  gK = k;
  gW = w;
  as(OPERATOR);
  expect(() => { postIn(gK!, gW); }).toThrow();
  expect(MockVM.getErrorMessage()).toBe("too many questions this week");
}

describe("v6.1: up to 60 questions a week", () => {
  it("after the upgrade, the week it lands in keeps 30; the next week holds 60, and get_state shows both caps", () => {
    const k = setup(0);
    at(GENESIS + 100);
    let st = k.get_state(new kpred.get_state_arguments());
    expect(st.week).toBe(0);
    expect(st.questions_cap).toBe(30);
    expect(st.questions_cap_next).toBe(60);
    expect(st.config!.q60_rule_week_plus_one).toBe(0);     // not set until the first action

    postMany(k, 0, 30);                                      // the first action sets the rule week: week 1
    expect(k.get_state(new kpred.get_state_arguments()).config!.q60_rule_week_plus_one).toBe(2);
    oneTooMany(k, 0);

    at(GENESIS + WEEK + 100);
    st = k.get_state(new kpred.get_state_arguments());
    expect(st.week).toBe(1);
    expect(st.questions_cap).toBe(60);
    expect(st.questions_cap_next).toBe(60);
    postMany(k, 1, 60);
    oneTooMany(k, 1);
    // The rule week was set once and never moves.
    expect(k.get_state(new kpred.get_state_arguments()).config!.q60_rule_week_plus_one).toBe(2);
  });

  it("an upgrade landing late in a week still leaves that week at 30", () => {
    const k = setup(0);
    at(GENESIS + WEEK - 350);                                // the last days of week 0
    as(OPERATOR);
    const s = GENESIS;
    for (let i = 0; i < 30; i++) k.post_question(new kpred.post_question_arguments(2, (s + WEEK - 200) * MS, s + WEEK - 199, s + WEEK - 150, new Uint8Array(32).fill(7)));
    MockVM.commitTransaction();
    gK = k;
    as(OPERATOR);
    expect(() => { gK!.post_question(new kpred.post_question_arguments(2, (GENESIS + WEEK - 200) * MS, GENESIS + WEEK - 199, GENESIS + WEEK - 150, new Uint8Array(32).fill(7))); }).toThrow();
    expect(MockVM.getErrorMessage()).toBe("too many questions this week");
  });

  it("a fresh deployment holds 60 from week 0", () => {
    const k = setup(1);
    at(GENESIS + 100);
    const st = k.get_state(new kpred.get_state_arguments());
    expect(st.questions_cap).toBe(60);
    expect(st.questions_cap_next).toBe(60);
    postMany(k, 0, 60);
    oneTooMany(k, 0);
  });

  it("without the rule (older test setups), the cap stays 30", () => {
    const k = setup(1_000_000);
    at(GENESIS + 100);
    const st = k.get_state(new kpred.get_state_arguments());
    expect(st.questions_cap).toBe(30);
    expect(st.questions_cap_next).toBe(30);
    postMany(k, 0, 30);
    oneTooMany(k, 0);
  });

  it("a full 60-question week on the shared rules: points above 30 count, the operator posts them, the week finalizes one place per page, and claims never exceed the bucket (V61-A4, D-116)", () => {
    const k = setup(1);
    const who: Uint8Array[] = [PA, PB, PC, PD, PE];
    const right: u32[] = [60, 45, 31, 10, 59];
    fund(who);
    at(200);
    for (let p = 0; p < who.length; p++) { as(who[p]); k.deposit_to(new kpred.deposit_to_arguments(who[p], 1, 10 * VHP, false)); }
    Tokens.testSet(VHP_TAG, CONTRACT, Tokens.testGet(VHP_TAG, CONTRACT) + 40 * VHP);   // the week's block rewards
    at(GENESIS + 100);
    postMany(k, 0, 60);
    at(GENESIS + 200);
    for (let p = 0; p < who.length; p++) {
      as(who[p]);
      for (let i: u32 = 0; i < 60; i++) k.answer(new kpred.answer_arguments(who[p], i, i < right[p] ? 1 : 0));
    }
    at(GENESIS + 500);
    as(OPERATOR);
    for (let i: u32 = 0; i < 60; i++) k.resolve_question(new kpred.resolve_question_arguments(i, 1, new Uint8Array(32).fill(9)));
    closeAt(k, 0);
    const gw0 = k.get_game(new kpred.get_game_arguments(1, 0)).week!;
    expect(gw0.closed).toBe(true);
    expect(gw0.bucket > 0).toBe(true);
    expect(k.get_week(new kpred.get_week_arguments(0)).week!.pot).toBe(0);   // nothing for the old baskets
    as(OPERATOR);
    const rows: kpred.result_row[] = [];
    for (let p = 0; p < who.length; p++) rows.push(new kpred.result_row(who[p], right[p]));
    k.post_results(new kpred.post_results_arguments(1, 0, rows));
    k.seal_results(new kpred.seal_results_arguments(1, 0));
    at(GENESIS + WEEK + CLOSE + 1 + 2 * CLOSE + 1);
    MockVM.setAuthorities([]);
    testSetFinalizePage(1);
    let pages = 0;
    while (!k.get_game(new kpred.get_game_arguments(1, 0)).week!.finalized && pages < 20) {
      MockVM.commitTransaction();
      k.finalize_game_week(new kpred.finalize_game_week_arguments(1, 0));
      pages++;
    }
    testSetFinalizePage(500);
    const gw = k.get_game(new kpred.get_game_arguments(1, 0)).week!;
    expect(gw.finalized).toBe(true);
    expect(pages >= 2).toBe(true);                                   // one place per page
    expect(gw.max_points).toBe(60);
    expect(gw.cutoff).toBe(59);                                      // top 30% of 5 = 2: A (60) and E (59)
    expect(gw.winners).toBe(2);
    let paid: u64 = 0;
    for (let p = 0; p < who.length; p++) {
      if (right[p] < 59) continue;
      as(who[p]);
      const r = k.claim_game(new kpred.claim_game_arguments(who[p], 1, 0)).reward;
      expect(r > 0).toBe(true);
      paid += r;
    }
    expect(paid <= gw.bucket).toBe(true);
    k.assertSolvent();
  });

  it("the switch (D-116): the week the upgrade lands in is paid the old way; from the next week game 1 is paid like every game; every stake comes out by the old and the new call", () => {
    const k = setup(0);                                              // an upgraded vault: the rule week is not set yet
    fund([PA, PB, PC, PD]);
    at(200);
    for (let p = 0; p < 3; p++) { as([PA, PB, PC][p]); k.deposit_vhp(new kpred.deposit_vhp_arguments([PA, PB, PC][p], 10 * VHP)); }
    MockVM.commitTransaction();
    expect(k.get_state(new kpred.get_state_arguments()).config!.q60_rule_week_plus_one).toBe(2);   // week 1 is the first new week
    Tokens.testSet(VHP_TAG, CONTRACT, Tokens.testGet(VHP_TAG, CONTRACT) + 40 * VHP);
    // ── week 0: the old rules (settle, finalize_week, claim) ──
    at(GENESIS + 100);
    postMany(k, 0, 3);
    at(GENESIS + 200);
    answerN(k, PA, 0, 3, 3); answerN(k, PB, 0, 3, 2); answerN(k, PC, 0, 3, 1);
    as(PC);
    k.deposit_vhp(new kpred.deposit_vhp_arguments(PC, VHP));        // the old call still takes deposits before the new week
    at(GENESIS + 500);
    resolveAll(k, 0, 3);
    closeAt(k, 0);
    expect(k.get_week(new kpred.get_week_arguments(0)).week!.pot > 0).toBe(true, "check 1");    // the old baskets
    expect(k.get_game(new kpred.get_game_arguments(1, 0)).week!.closed).toBe(false); // no game-week for the old rules
    for (let p = 0; p < 3; p++) { MockVM.commitTransaction(); k.settle(new kpred.settle_arguments([PA, PB, PC][p], 0)); }
    gK = k; gWho = PA;
    as(OPERATOR);
    expect(() => { gK!.post_results(new kpred.post_results_arguments(1, 0, [new kpred.result_row(gWho, 3)])); }).toThrow();
    expect(MockVM.getErrorMessage()).toBe("that week of the question game is paid by the old rules (settle and claim)");
    // ── week 1: the new rules ──
    at(GENESIS + WEEK + 150);
    const st1 = k.get_state(new kpred.get_state_arguments());
    expect(st1.questions_cap).toBe(60);
    as(PD);
    k.deposit_vhp(new kpred.deposit_vhp_arguments(PD, VHP));        // the old call is kept as an alias (owner, 4 Nov)
    as(PD);
    k.deposit_to(new kpred.deposit_to_arguments(PD, 1, VHP, false)); // the shared call: same record, counts from week 2
    MockVM.commitTransaction();
    expect(k.get_game_player(new kpred.get_game_player_arguments(PD, 1, 1)).player!.pending).toBe(2 * VHP);
    as(PC);
    k.withdraw(new kpred.withdraw_arguments(PC, VHP));               // the old call still withdraws (C keeps 10)
    as(PC);
    k.withdraw_from(new kpred.withdraw_from_arguments(PC, 1, 2 * VHP));   // and the new one (C keeps 8 this week)
    MockVM.commitTransaction();
    expect(k.get_game_player(new kpred.get_game_player_arguments(PC, 1, 1)).week_stake).toBe(8 * VHP);
    postMany(k, 1, 3);
    at(GENESIS + WEEK + 250);
    answerN(k, PA, 3, 3, 3); answerN(k, PB, 3, 3, 1); answerN(k, PC, 3, 3, 2);
    // A's first answer of week 1 settled A's week 0 (old rules), and nothing of week 1 is settled
    gWho = PA; gWeek = 1;
    MockVM.commitTransaction();
    expect(k.get_player(new kpred.get_player_arguments(PA, 0)).entry!.settled).toBe(true, "check 2");
    at(GENESIS + WEEK + 600);
    resolveAll(k, 3, 3);
    // week 0 is finalized the old way; its claim still pays after the switch
    MockVM.commitTransaction();
    MockVM.setAuthorities([]);
    if (!k.get_week(new kpred.get_week_arguments(0)).week!.finalized) k.finalize_week(new kpred.finalize_week_arguments(0));
    expect(k.get_week(new kpred.get_week_arguments(0)).week!.finalized).toBe(true, "check 3");   // (the vault's own step may have done it already)
    as(PA);
    expect(k.claim(new kpred.claim_arguments(PA, 0)).reward > 0).toBe(true, "check 4");
    Tokens.testSet(VHP_TAG, CONTRACT, Tokens.testGet(VHP_TAG, CONTRACT) + 20 * VHP);   // week 1's block rewards
    closeAt(k, 1);
    const g1 = k.get_game(new kpred.get_game_arguments(1, 1)).week!;
    expect(g1.closed).toBe(true, "check 5");
    expect(g1.bucket > 0).toBe(true, "check 6");
    expect(k.get_week(new kpred.get_week_arguments(1)).week!.pot).toBe(0);
    MockVM.commitTransaction();
    expect(() => { gK!.settle(new kpred.settle_arguments(gWho, gWeek)); }).toThrow();
    expect(MockVM.getErrorMessage()).toBe("that week is paid from its results file (no settle step)");
    as(OPERATOR);
    gWho = PB;
    expect(() => { gK!.post_results(new kpred.post_results_arguments(1, 1, [new kpred.result_row(gWho, 4)])); }).toThrow();   // more points than answers
    expect(MockVM.getErrorMessage()).toBe("a question-game result needs at least 2 answers that week, and no more points than answers");
    as(OPERATOR);
    k.post_results(new kpred.post_results_arguments(1, 1, [new kpred.result_row(PA, 3), new kpred.result_row(PC, 2), new kpred.result_row(PB, 1)]));
    k.seal_results(new kpred.seal_results_arguments(1, 1));
    at(GENESIS + 2 * WEEK + CLOSE + 1 + 2 * CLOSE + 1);
    MockVM.setAuthorities([]);
    expect(k.finalize_game_week(new kpred.finalize_game_week_arguments(1, 1)).done).toBe(true, "check 7");
    as(PA);
    const ra = k.claim_game(new kpred.claim_game_arguments(PA, 1, 1)).reward;
    expect(ra > 0 && ra <= g1.bucket).toBe(true, "check 8");
    // everyone takes everything out, by the old call and the new one
    const outs: Uint8Array[] = [PA, PB, PC, PD];
    for (let p = 0; p < outs.length; p++) {
      const pl = k.get_player(new kpred.get_player_arguments(outs[p], 2)).player!;
      const all = pl.stake + pl.pending;
      as(outs[p]);
      if (p % 2 == 0) k.withdraw(new kpred.withdraw_arguments(outs[p], all));
      else k.withdraw_from(new kpred.withdraw_from_arguments(outs[p], 1, all));
    }
    MockVM.commitTransaction();
    expect(k.get_state(new kpred.get_state_arguments()).totals!.total_stake).toBe(0);
    k.assertSolvent();
  });

  it("Repo Lens: a wallet not staked in game 1 that week (and with no answers) gets no result row and no free-prize place", () => {
    const k = setup(1);                                   // the shared rules from week 0
    fund([PA, PB]);
    at(200);
    as(PA); k.deposit_to(new kpred.deposit_to_arguments(PA, 1, 10 * VHP, false));    // PA: staked for week 0
    Tokens.testSet(VHP_TAG, SEED, 1000 * VHP);
    as(SEED); k.seed_deposit_vhp(new kpred.seed_deposit_vhp_arguments(500 * VHP));   // a seed, so week 0 has a free prize
    Tokens.testSet(VHP_TAG, CONTRACT, Tokens.testGet(VHP_TAG, CONTRACT) + 40 * VHP);
    at(GENESIS + 100);
    postMany(k, 0, 3);
    at(GENESIS + 200);
    answerN(k, PA, 0, 3, 3);                              // PA answers; PB never does
    as(PB); k.deposit_to(new kpred.deposit_to_arguments(PB, 1, 10 * VHP, false));    // PB: deposits DURING week 0 (counts from week 1)
    at(GENESIS + 500);
    resolveAll(k, 0, 3);
    at(GENESIS + WEEK + 5);                               // week 1, before week 0 closes
    as(PB); k.deposit_to(new kpred.deposit_to_arguments(PB, 1, VHP, false));         // any call that normalizes PB's record
    closeAt(k, 0);
    gK = k; gWho = PB;
    as(OPERATOR);
    // PB had 0 stake in game 1 during week 0 and no answers: the vault must refuse a result row for it.
    expect(() => { gK!.post_results(new kpred.post_results_arguments(1, 0, [new kpred.result_row(gWho, 3)])); }).toThrow();
    expect(MockVM.getErrorMessage()).toBe("that player has no answers that week");
    as(OPERATOR);
    expect(() => { gK!.post_prize_winners(new kpred.post_prize_winners_arguments(1, 0, 1, [gWho])); }).toThrow();
    expect(MockVM.getErrorMessage()).toBe("that player has no answers that week");
  });
});
