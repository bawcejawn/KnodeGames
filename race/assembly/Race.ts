import { System, Storage, Protobuf, Crypto, Arrays, authority } from "@koinos/sdk-as";
import { race } from "./proto/race";

/**
 * Knode Producer Race picks. See assembly/proto/race.proto for the rules.
 * Free to play: it holds no funds, takes no fee and never pays Mana. It only keeps one pick per wallet per race and
 * lets the chain enforce the lock (no pick once a race has started), the window picks open in, and the daily limit.
 * v2 (owner 5 Nov 2026, D-161): race types, carried in the race number's top byte, so the pick's arguments stay v1's
 * three fields (the Mana sponsor reads them field for field) and type 0 is v1 exactly:
 *   race = type * 2^56 + index; type 0 = the 6-hour race (index = start / 6 h), 1 = 1-hour (start / 1 h),
 *   2 = 2-hour (start / 2 h), 3 = daily (start / 24 h), 4 = weekly (the Monday-based UTC week).
 * Each type's picks sit under their own first key byte. A daily limit of 0 means no per-game limit (the Mana sponsor's
 * daily limit across the platform is the cap).
 * Uploaded with no authority overrides: upgrades need this contract's own key; settings need the owner's key.
 */

const CONFIG_SPACE = 0;
const PICKS_SPACE = 1;     // key: race (8 bytes, big-endian) + player (25 bytes) → pick_object
const DAYS_SPACE = 2;      // key: player → day_count

const ADDRESS_LENGTH = 25;
export const RACE_MS: u64 = 21600000;      // 6 hours
export const DAY_MS: u64 = 86400000;
/** Picks are open for the next 4 races: the coming 24 hours. */
export const LOOKAHEAD: u64 = 4;
export const MAX_PICKS_LIMIT: u32 = 20;
/** v2 race types (D-161): 0 = 6-hour (v1), 1 = 1-hour, 2 = 2-hour, 3 = daily, 4 = weekly (Monday to Sunday 00:00 UTC),
 *  in the race number's top byte. */
export const TYPES: u64 = 5;
export const TYPE_SHIFT: u64 = 56;
export const INDEX_MASK: u64 = 0x00ffffffffffffff;
export const HOUR_MS: u64 = 3600000;
export const WEEK_MS: u64 = 604800000;
/** 1970-01-05 00:00 UTC, the first Monday: weekly race w starts at WEEK_OFFSET + w * WEEK_MS. */
export const WEEK_OFFSET: u64 = 345600000;
export const BAD_TYPE = "RACE: unknown race type";
export const MAX_LIST: u32 = 100;

export const CLOSED = "RACE: picks are closed";
export const LOCKED = "RACE: this race has started; picks are locked";
export const TOO_EARLY = "RACE: picks open 24 hours before a race";
export const USED_UP = "RACE: today's picks are used up";
export const SAME = "RACE: that is already your pick";
export const NOT_SIGNED = "RACE: the player must sign";

export class Race {
  contractId: Uint8Array = System.getContractId();

  config: Storage.Obj<race.config> = new Storage.Obj(this.contractId, CONFIG_SPACE, race.config.decode, race.config.encode, () => new race.config());
  picks: Storage.Map<Uint8Array, race.pick_object> = new Storage.Map(this.contractId, PICKS_SPACE, race.pick_object.decode, race.pick_object.encode, () => new race.pick_object());
  days: Storage.Map<Uint8Array, race.day_count> = new Storage.Map(this.contractId, DAYS_SPACE, race.day_count.decode, race.day_count.encode, () => new race.day_count());

  pick(args: race.pick_arguments): race.empty_object {
    const cfg = this.config.get()!;
    System.require(cfg.enabled, CLOSED);
    System.require(isAddress(args.player), "RACE: invalid player");
    System.require(isAddress(args.horse), "RACE: invalid horse");
    const player = args.player!;
    System.require(System.checkAuthority(authority.authorization_type.contract_call, player), NOT_SIGNED);
    // Audit R-3: only the player's own transaction (or the player's own contract), never another contract the player
    // happened to sign a transaction for.
    const caller = System.getCaller().caller;
    System.require(caller == null || caller!.length == 0 || Arrays.equal(caller!, player), NOT_SIGNED);

    const type = args.race >> TYPE_SHIFT, index = args.race & INDEX_MASK;
    System.require(type < TYPES, BAD_TYPE);
    const now = System.getHeadInfo().head_block_time;
    const current = slotOf(type, now);              // the race of this type running now; it started at or before now
    // A race index above `current` starts after now. Equal or below: started (or over): locked.
    System.require(index > current, LOCKED);
    System.require(index <= current + lookahead(type), TOO_EARLY);

    // The key is the whole race number (type byte first), so type 0 keeps v1's keys and each type has its own range.
    const key = pickKey(args.race, player);
    const old = this.picks.get(key);
    const had = old != null && old.horse != null && old.horse!.length > 0;
    System.require(!had || !Arrays.equal(old!.horse, args.horse), SAME);

    // 0 = no per-game limit (v2, D-161): nothing is counted or stored.
    if (cfg.max_picks_per_day > 0) {
      const day = now / DAY_MS;
      const dc = this.days.get(player)!;
      const count: u32 = dc.day == day ? dc.count : 0;
      System.require(count < cfg.max_picks_per_day, USED_UP);
      this.days.put(player, new race.day_count(day, count + 1));
    }

    this.picks.put(key, new race.pick_object(args.horse, now, had ? old!.changes + 1 : 0));
    const ev = new race.pick_event(player, args.race, args.horse, now, had);
    System.event("race.pick_event", Protobuf.encode(ev, race.pick_event.encode), [player]);
    return new race.empty_object();
  }

  get_pick(args: race.get_pick_arguments): race.get_pick_result {
    const out = new race.get_pick_result();
    if (!isAddress(args.player)) return out;
    const p = this.picks.get(pickKey(args.race, args.player!));
    if (p != null && p.horse != null && p.horse!.length > 0) out.pick = p;
    return out;
  }

  list_picks(args: race.list_picks_arguments): race.list_picks_result {
    const out = new race.list_picks_result();
    const limit: u32 = args.limit == 0 || args.limit > MAX_LIST ? MAX_LIST : args.limit;
    const prefix = raceBytes(args.race);
    // Start just before the first wallet (an all-zero address, which can't be a real one), or after start_after.
    // Every key has the same length (33 bytes), so they sort by race, then by player, byte by byte on the chain.
    // Audit R-1: a cursor that isn't empty and isn't 25 bytes is an error, never a silent restart.
    const given = args.start_after != null && args.start_after!.length > 0;
    System.require(!given || args.start_after!.length == ADDRESS_LENGTH, "RACE: bad start_after");
    const after = given ? args.start_after! : new Uint8Array(ADDRESS_LENGTH);
    let key = concat(prefix, after);
    while (<u32>out.rows.length < limit) {
      const obj = this.picks.getNext(key);
      if (obj == null || obj.key == null) break;
      const k = obj.key!;
      if (k.length != 8 + ADDRESS_LENGTH || !Arrays.equal(k.subarray(0, 8), prefix)) break;   // past this race
      out.rows.push(new race.pick_row(k.slice(8), obj.value));
      key = k;
    }
    return out;
  }

  get_usage(args: race.get_usage_arguments): race.get_usage_result {
    const cfg = this.config.get()!;
    const day = System.getHeadInfo().head_block_time / DAY_MS;
    let n: u32 = 0;
    if (isAddress(args.player)) { const dc = this.days.get(args.player!)!; if (dc.day == day) n = dc.count; }
    return new race.get_usage_result(day, n, cfg.max_picks_per_day);
  }

  get_config(args: race.get_config_arguments): race.config {
    return this.config.get()!;
  }

  set_config(args: race.set_config_arguments): race.empty_object {
    const cur = this.config.get()!;
    // The first setup: this contract's own key. After that: the owner's key only.
    const who = isAddress(cur.owner) ? cur.owner! : this.contractId;
    System.require(System.checkAuthority(authority.authorization_type.contract_call, who), "RACE: needs the owner's key");
    System.require(args.config != null, "RACE: config missing");
    const cfg = args.config!;
    System.require(isAddress(cfg.owner), "RACE: invalid owner");
    System.require(!Arrays.equal(cfg.owner, this.contractId), "RACE: the owner must be a wallet, not this contract");
    System.require(cfg.max_picks_per_day <= MAX_PICKS_LIMIT, "RACE: picks per day must be 0 (no limit) to 20");
    this.config.put(cfg);
    System.event("race.config_event", Protobuf.encode(new race.config_event(cfg), race.config_event.encode), [this.contractId]);
    return new race.empty_object();
  }
}

/** The race number as 8 big-endian bytes, so keys sort by race, then by player. */
function raceBytes(r: u64): Uint8Array {
  const b = new Uint8Array(8);
  for (let i = 7; i >= 0; i--) { b[i] = <u8>(r & 0xff); r >>= 8; }
  return b;
}
function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0); out.set(b, a.length);
  return out;
}
export function pickKey(r: u64, player: Uint8Array): Uint8Array {
  return concat(raceBytes(r), player);
}
/** The race number for type t and index i (type 0: i itself, so v1's numbers are unchanged). */
export function raceNumber(t: u64, i: u64): u64 { return (t << TYPE_SHIFT) | (i & INDEX_MASK); }
/** The index of the race of type t running at time `now` (it started at or before now). */
export function slotOf(t: u64, now: u64): u64 {
  if (t == 0) return now / RACE_MS;
  if (t == 1) return now / HOUR_MS;
  if (t == 2) return now / (2 * HOUR_MS);
  if (t == 3) return now / DAY_MS;
  return now < WEEK_OFFSET ? 0 : (now - WEEK_OFFSET) / WEEK_MS;
}
/** How many races ahead picks are open: 24 hours for the 6-, 2- and 1-hour races; the next one for daily and weekly. */
export function lookahead(t: u64): u64 {
  if (t == 0) return LOOKAHEAD;
  if (t == 1) return 24;
  if (t == 2) return 12;
  return 1;
}

/** A Koinos address: version 0, 20-byte hash, 4-byte double-sha256 checksum. */
function isAddress(a: Uint8Array | null): bool {
  if (a == null) return false;
  const b = a!;
  if (b.length != ADDRESS_LENGTH || b[0] != 0) return false;
  const once = System.hash(Crypto.multicodec.sha2_256, b.subarray(0, 21));
  if (!once) return false;
  const twice = System.hash(Crypto.multicodec.sha2_256, once.subarray(2));
  if (!twice) return false;
  for (let i = 0; i < 4; i++) {
    if (twice[2 + i] != b[21 + i]) return false;
  }
  return true;
}
