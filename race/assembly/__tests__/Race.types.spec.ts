// =====================================================================
// Race picks v2: race types (owner 5 Nov 2026, D-161). Type 0 (6-hour) is v1 unchanged; types 1-4 (1-hour, 2-hour,
// daily, weekly) lock at their start, open 24 h ahead (1- and 2-hour) or from the race before (daily, weekly), live in
// their own storage space, and the daily limit 0 means no per-game limit.
// =====================================================================

import { Arrays, Base58, MockVM, Protobuf, authority, chain } from "@koinos/sdk-as";
import { Race, RACE_MS, DAY_MS, HOUR_MS, WEEK_MS, WEEK_OFFSET, LOCKED, TOO_EARLY, USED_UP, SAME, BAD_TYPE, slotOf, lookahead, keyOf } from "../Race";
import { race } from "../proto/race";

const SELF = Base58.decode("1EDaCKVmBjUxLxgWCmDbRA8gWKkSQ6ByzY");
const OWNER = Base58.decode("1635QUrBNDp7WqmFkRvrkGwjJXTtFvH717");
const P1 = Base58.decode("1HsM33pF8DbXPr8Vsd4vD7hQgvZ1SHY3Vv");
const P2 = Base58.decode("16ixK5DgvcojcZLvxyYWhHFcRXfhfrHbpL");
const H1 = Base58.decode("15NZhQoewzsbVUcSVsZ8BEBEKgaBNPLLgZ");
const H2 = Base58.decode("1MbsVfNw6yzQqA8499d8KQj8qdLyRs8CzW");

// Tue 2029-10-23 10:00 UTC. The mock VM handles storage keys as text, so key bytes of 0x80 and above can collide
// there (never on chain, where keys are bytes). At this time every race number these tests use, for every type, has
// only bytes below 0x80. (The v1 tests' time has the same property.)
const NOW: u64 = 1887444000000;

function setTime(ms: u64): void { MockVM.setHeadInfo(new chain.head_info(null, ms, 0)); }
function direct(): void { MockVM.setCaller(new chain.caller_data(new Uint8Array(0), chain.privilege.user_mode)); }
function signedBy(a: Uint8Array): void { MockVM.setAuthorities([new MockVM.MockAuthority(authority.authorization_type.contract_call, a, true)]); }
function errorIs(message: string): void { expect(MockVM.getErrorMessage()).toBe(message); MockVM.rollbackTransaction(); }

let ARGS: race.pick_arguments = new race.pick_arguments();
function doPick(): void { new Race().pick(ARGS); }
function pick(player: Uint8Array, t: u32, r: u64, horse: Uint8Array): void {
  signedBy(player); ARGS = new race.pick_arguments(player, r, horse, t); doPick(); MockVM.commitTransaction();
}
function refused(player: Uint8Array, t: u32, r: u64, horse: Uint8Array, message: string): void {
  signedBy(player); ARGS = new race.pick_arguments(player, r, horse, t);
  expect(() => { doPick(); }).toThrow(); errorIs(message);
}
function pickOf(player: Uint8Array, t: u32, r: u64): race.pick_object | null {
  return new Race().get_pick(new race.get_pick_arguments(player, r, t)).pick;
}
function start(limit: u32): void {
  MockVM.reset(); MockVM.setContractId(SELF); direct(); setTime(NOW); MockVM.commitTransaction();
  signedBy(SELF); new Race().set_config(new race.set_config_arguments(new race.config(OWNER, true, limit))); MockVM.commitTransaction();
}

describe("race types: numbering", () => {
  it("each type's race number and window", () => {
    expect(slotOf(0, NOW)).toBe(NOW / RACE_MS);
    expect(slotOf(1, NOW)).toBe(NOW / HOUR_MS);
    expect(slotOf(2, NOW)).toBe(NOW / (2 * HOUR_MS));
    expect(slotOf(3, NOW)).toBe(NOW / DAY_MS);
    // Weekly: Mon 2026-11-09 00:00 UTC starts week w; the race before Sunday 00:00 is still week w.
    const mon: u64 = 1794182400000;
    const w = slotOf(4, mon);
    expect(WEEK_OFFSET + w * WEEK_MS).toBe(mon);
    expect(slotOf(4, mon - 1)).toBe(w - 1);
    expect(slotOf(4, mon + 6 * DAY_MS - 1)).toBe(w);
    expect(lookahead(0)).toBe(4); expect(lookahead(1)).toBe(24); expect(lookahead(2)).toBe(12);
    expect(lookahead(3)).toBe(1); expect(lookahead(4)).toBe(1);
  });
  it("type 0 keeps v1's key; other types have their own, longer keys", () => {
    expect(keyOf(0, 7, P1).length).toBe(33);
    expect(keyOf(1, 7, P1).length).toBe(34);
    expect(keyOf(1, 7, P1)[0]).toBe(1);
    expect(Arrays.equal(keyOf(1, 7, P1), keyOf(2, 7, P1))).toBe(false);
  });
});

describe("race types: picking", () => {
  beforeEach(() => { start(5); });

  it("an hourly pick: the next hour is open, the running one is locked, 24 h ahead is the limit", () => {
    const cur = slotOf(1, NOW);
    pick(P1, 1, cur + 1, H1);
    expect(Arrays.equal(pickOf(P1, 1, cur + 1)!.horse, H1)).toBe(true);
    expect(pickOf(P1, 0, cur + 1)).toBeNull();               // the 6-hour race with the same number is a different race
    refused(P1, 1, cur, H1, LOCKED);
    pick(P1, 1, cur + 24, H1);
    refused(P1, 1, cur + 25, H1, TOO_EARLY);
    const events = MockVM.getEvents();
    const ev = Protobuf.decode<race.pick_event>(events[events.length - 1].data!, race.pick_event.decode);
    expect(ev.type).toBe(1);
  });

  it("2-hour, daily and weekly windows", () => {
    pick(P1, 2, slotOf(2, NOW) + 12, H1); refused(P1, 2, slotOf(2, NOW) + 13, H1, TOO_EARLY);
    refused(P2, 3, slotOf(3, NOW), H1, LOCKED);              // today's daily race has started
    pick(P2, 3, slotOf(3, NOW) + 1, H1);                     // tomorrow's is open all day today
    refused(P2, 3, slotOf(3, NOW) + 2, H1, TOO_EARLY);
    refused(P2, 4, slotOf(4, NOW), H2, LOCKED);              // this week's started Monday
    pick(P2, 4, slotOf(4, NOW) + 1, H2);                     // next week's is open all this week
    refused(P2, 4, slotOf(4, NOW) + 2, H2, TOO_EARLY);
  });

  it("type 0 is the v1 race, and an unknown type is refused", () => {
    pick(P1, 0, slotOf(0, NOW) + 1, H1);
    expect(Arrays.equal(new Race().get_pick(new race.get_pick_arguments(P1, slotOf(0, NOW) + 1)).pick!.horse, H1)).toBe(true);
    refused(P1, 5, slotOf(1, NOW) + 1, H1, BAD_TYPE);
    expect(new Race().get_pick(new race.get_pick_arguments(P1, 1, 9)).pick).toBeNull();
  });

  it("one pick per wallet per race and type; a change counts", () => {
    const r = slotOf(2, NOW) + 1;
    pick(P1, 2, r, H1); refused(P1, 2, r, H1, SAME); pick(P1, 2, r, H2);
    expect(pickOf(P1, 2, r)!.changes).toBe(1);
  });

  it("the daily limit counts every type together", () => {
    const h = slotOf(1, NOW);
    for (let i: u64 = 1; i <= 3; i++) pick(P1, 1, h + i, H1);
    pick(P1, 0, slotOf(0, NOW) + 1, H1); pick(P1, 3, slotOf(3, NOW) + 1, H1);
    refused(P1, 4, slotOf(4, NOW) + 1, H1, USED_UP);
  });

  it("list_picks pages one type's race only", () => {
    const r = slotOf(1, NOW) + 2;
    const r2 = slotOf(2, NOW) + 2;
    pick(P1, 1, r, H1); pick(P2, 1, r, H2); pick(P1, 2, r2, H1); pick(P1, 1, r + 1, H1); pick(P1, 0, slotOf(0, NOW) + 1, H1);
    const rows = new Race().list_picks(new race.list_picks_arguments(r, null, 0, 1)).rows;
    expect(rows.length).toBe(2);
    expect(Arrays.equal(rows[0].player, P1) || Arrays.equal(rows[0].player, P2)).toBe(true);
    expect(new Race().list_picks(new race.list_picks_arguments(r2, null, 0, 2)).rows.length).toBe(1);
    expect(new Race().list_picks(new race.list_picks_arguments(r, null, 0, 2)).rows.length).toBe(0);   // a 2-hour race with that number has none
    expect(new Race().list_picks(new race.list_picks_arguments(slotOf(0, NOW) + 1, null, 0)).rows.length).toBe(1);   // v1 call: type 0
  });
});

describe("race types: no per-game limit (0)", () => {
  it("with 0, a wallet can pick as many races as there are", () => {
    start(0);
    const h = slotOf(1, NOW);
    for (let i: u64 = 1; i <= 24; i++) pick(P1, 1, h + i, H1);
    for (let i: u64 = 1; i <= 12; i++) pick(P1, 2, slotOf(2, NOW) + i, H1);
    for (let i: u64 = 1; i <= 4; i++) pick(P1, 0, slotOf(0, NOW) + i, H1);
    pick(P1, 3, slotOf(3, NOW) + 1, H1); pick(P1, 4, slotOf(4, NOW) + 1, H1);
    expect(pickOf(P1, 1, h + 24)).not.toBeNull();
    expect(new Race().get_usage(new race.get_usage_arguments(P1)).picks_today).toBe(0);   // nothing counted or stored
  });
});
