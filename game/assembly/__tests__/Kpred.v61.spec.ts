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

  it("a full 60-question week: points above 30 count, the week closes, settles, finalizes one place per page, and claims never exceed the pot (Repo Lens V61-A4)", () => {
    const k = setup(1);
    const who: Uint8Array[] = [PA, PB, PC, PD, PE];
    const right: u32[] = [60, 45, 31, 10, 59];
    for (let p = 0; p < who.length; p++) {
      Tokens.testSet(VHP_TAG, who[p], 1000 * VHP);
      Tokens.testSet(MANA_TAG, who[p], 1000 * VHP);
    }
    Tokens.testSet(VHP_TAG, SEED, 5000 * VHP);
    Tokens.testSet(MANA_TAG, CONTRACT, 1000 * VHP);
    at(200);
    for (let p = 0; p < who.length; p++) { as(who[p]); k.deposit_vhp(new kpred.deposit_vhp_arguments(who[p], 10 * VHP)); }
    as(SEED);
    k.seed_deposit_vhp(new kpred.seed_deposit_vhp_arguments(1000 * VHP));
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
    at(GENESIS + WEEK + CLOSE + 1);
    MockVM.commitTransaction();
    MockVM.setAuthorities([]);
    k.close_week(new kpred.close_week_arguments(0));
    expect(k.get_week(new kpred.get_week_arguments(0)).week!.closed).toBe(true);
    for (let p = 0; p < who.length; p++) {
      MockVM.commitTransaction();
      expect(k.settle(new kpred.settle_arguments(who[p], 0)).points).toBe(right[p]);
    }
    expect(k.get_week(new kpred.get_week_arguments(0)).week!.max_points).toBe(60);
    testSetFinalizePage(1);
    at(k.get_week(new kpred.get_week_arguments(0)).week!.settle_end / MS + 2);
    let pages = 0;
    while (!k.get_week(new kpred.get_week_arguments(0)).week!.finalized && pages < 20) {
      MockVM.commitTransaction();
      k.finalize_week(new kpred.finalize_week_arguments(0));
      pages++;
    }
    testSetFinalizePage(500);
    const wk = k.get_week(new kpred.get_week_arguments(0)).week!;
    expect(wk.finalized).toBe(true);
    expect(pages >= 2).toBe(true);                                   // one place per page: two winners, two pages at least
    expect(wk.cutoff).toBe(59);                                      // top 30% of 5 players = 2: A (60) and E (59)
    expect(wk.winners).toBe(2);
    let paid: u64 = 0;
    for (let p = 0; p < who.length; p++) {
      as(who[p]);
      if (right[p] >= 59) {
        const r = k.claim(new kpred.claim_arguments(who[p], 0)).reward;
        expect(r > 0).toBe(true);
        paid += r;
      }
    }
    expect(paid <= wk.pot_a + wk.pot_b).toBe(true);
    k.assertSolvent();
  });
});
