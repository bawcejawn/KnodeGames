/**
 * Who Signs Block X recorder (run every hour by GitHub Actions; read-only on the chain, holds no key).
 *   mainnet  .github/workflows/games.yml          game 2, cards from the Producer Race recorder, data → games-data/blockx
 *   testnet  .github/workflows/games-testnet.yml  every game in testnet/blockx.json, its own cards, data → testnet-data
 *
 * Each run, for one game:
 *  1. Targets. Every height r × round (+ offset) is a target; mainnet: every 2,400 blocks. A target is recorded once its
 *     block is irreversible and the block (signer and time) and the lock block match on two independent nodes (RPC and
 *     RPC_CHECK; the testnet has one public node (the Koinos Foundation's), so it is checked once and says so).
 *     Until then it waits.
 *  2. The card. A correct pick scores min(3, top VHP ÷ picked VHP) with the VHP from the handicap card in force at the
 *     lock (the time of block X − lead, the first block that refuses a pick):
 *       CARDS=race (mainnet): the Producer Race recorder's hourly card (race-data).
 *       CARDS=self (testnet): this recorder takes the same kind of card itself each run, from the VHP of the producers
 *       that signed the last ~6 hours of blocks (cards.json), because the testnet has no Producer Race.
 *     Only a card taken at or before the lock counts (audit BX-3). A target whose card can't be found yet waits; after
 *     3 days it is recorded as void (no points).
 *  3. The picks: every pick for the round from the Picks contract, on both nodes; they must agree. The chain locked them
 *     `lead` blocks before the target. Each pick is stored with its time, points and whether the wallet is Staked
 *     (holds 1 VHP or has a Knode stake when the target is recorded) or Free play (everyone else).
 *  4. Leaderboards (board.json): Today, This week, Last week and All time, by blockx-math.js, the same file the
 *     page runs, for the two boards of board.js (Staked / Free play). A week is final from Monday 00:00 UTC (D-135) when
 *     every counted target in it is recorded, two runs an hour apart agree and the week-end re-read passes. Prizes (2 / 1 VHP to the week's top 2: every Block X player is a free player,
 *     picks on 3+ days, ≥ 1 point) are listed only for weeks from PRIZES_FROM_WEEK: none until the Knode Games vault is
 *     live (owner, 2026-10-28). The vault pays them; this file only records.
 *  5. Writes index.json, W<week>.json, board.json (and cards.json with CARDS=self); the publish job puts them on the
 *     data branch for the website.
 *
 *   npm run blockx                          mainnet (RPC, RPC_CHECK, BLOCKX_PREV, BLOCKX_OUT, RACE_DATA)
 *   npm run blockx -- --testnet --game 2    one game of testnet/blockx.json (TESTNET_RPC overrides its rpc)
 */
import { Provider, Contract, utils as kutils } from "koilib";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { readVhp, MAINNET_VHP, withRetry } from "../../common.ts";
await import("../../race-math.js");
await import("../../blockx-math.js");
const M: any = (globalThis as any).KRaceMath;
const X: any = (globalThis as any).KBlockX;

const E = process.env;
const LOOKBACK_BLOCKS = 3 * 28800;          // targets older than ~3 days: void if they still can't be recorded
const MAX_TARGETS_PER_RUN = 48;             // so a long outage catches up over a few runs
const STABLE_MS = 3600000;                  // D-135: final once two runs at least an hour apart read the week the same
const VAULT_WINDOW_MS = 3 * 86400000;       // the vault takes a week's results file within 3 days of its end (games.yml)
const CARD_BLOCKS = 7200;                   // a self-made card looks at the last ~6 hours of blocks
const CARD_KEEP_MS = 8 * 86400000;          // and cards.json keeps 8 days of them
const ONE_VHP = 100000000n;
const isAddr = (a: unknown) => typeof a === "string" && /^1[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(a);

/** A recorded pick: [player, producer, pick time (ms), points (hundredths), Staked (1) or Free play (0)]. */
type Pick = [string, string, number, number, number];
type Target = {
  round: number; height: number; final: true; checked: number;
  signer: string | null; time: number; lockTime: number;
  card: { at: number; top: number; signerVhp: number | null; afterAt?: number } | null;   // afterAt: the first card after X (BX-35)
  void?: string; picks: Pick[];
};
type WeekFile = { v: 1; week: number; start: number; end: number; game?: number; targets: Target[] };
type Card = { at: number; field: { a: string; vhp: number }[]; paddock: { a: string; vhp: number }[]; [k: string]: any };
export type RawPick = { player: string; producer: string; time: number };
export type Opts = {
  p: any; check: any | null; prev?: string; out?: string; raceDir?: string;
  picksContract?: string | null;                                           // default: picks-data/deployment.json
  game?: Partial<{ id: number; round: number; offset: number; lead: number; ahead: number; picksPerDay: number; maxChanges: number }>;
  /** R-BX-25: the games by week ({ game, fromWeek, toWeek }); default: `game` (or game 2) for every week (tests,
   *  testnet). The mainnet run passes X.MAINNET_SCHEDULE (game 2, then hourly game 12 from week 4). */
  schedule?: { game: any; fromWeek: number; toWeek: number }[];
  /** The vault game (stakes, the vault file, the prize file); default: the first scheduled game's id. */
  vaultGame?: number;
  cards?: "race" | "self";                                                 // default: race
  vhpContract?: string;                                                    // default: mainnet VHP
  knodeGame?: string | null;                                               // the Knode vault (v6): who is staked in THIS game
  prizesFromWeek?: number | null;                                          // default: none (no prizes listed)
  /** Repo Lens E4-3 / L-1: how long into the run the week-end re-read may still start a target (default REVERIFY_BUDGET_MS). */
  reverifyBudgetMs?: number;
  /** Fix-check L-2: BLOCKX_RELEASE, "<week>:<release code>" (default: the environment's). */
  release?: string | null;
  /** Tests: the first vault week on the D-125 rhythm (Sunday targets don't count); default X.RHYTHM_FROM_WEEK. */
  restFromWeek?: number;
  picksOf?: (node: any, round: number, game?: number) => Promise<RawPick[]>;   // for the tests
  blockOf?: (node: any, height: number) => Promise<{ signer: string; time: number }>;
  /** Tests: who was staked in this game in `week` (stake at least the vault's minimum at some point that week). */
  rankedOf?: (who: string[], node: any, week?: number) => Promise<Set<string>>;
  /** Tests: each player's stake in this game for `week` as the vault counts it (lowest that week), and the minimum.
   *  null: the vault (v6) isn't live, so nobody is staked. */
  stakeOf?: (who: string[], node: any, week: number) => Promise<{ min: bigint; week: Map<string, bigint> } | null>;
  signersOf?: (node: any, from: number, to: number) => Promise<{ signers: string[]; first: number; last: number; n: number }>;
  vhpOf?: (who: string[]) => Promise<Record<string, string>>;
  /** Tests: VHP moved into `who` in blocks from..to (audit BX-53). */
  vhpMovesOf?: (node: any, who: string, from: number, to: number) => Promise<bigint>;
  head?: { height: number; time: number; lib: number };
};

// ── files ──
function readJson(dir: string | undefined, name: string): any {
  if (!dir) return null;
  const f = path.join(dir, name);
  try { if (fs.lstatSync(f).isSymbolicLink()) return null; return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; }
}
const wName = (w: number) => `W${String(w).padStart(3, "0")}.json`;
const pName = (w: number) => `P${String(w).padStart(3, "0")}.json`;   // a final week's prizes, written once
function loadWeek(dir: string | undefined, w: number, G: any): WeekFile {
  const fresh: WeekFile = { v: 1, week: w, start: M.weekStart(w), end: M.weekStart(w + 1), game: G.GAME_ID, targets: [] };
  const old = readJson(dir, wName(w));
  if (!old || old.v !== 1 || old.week !== w || !Array.isArray(old.targets) || (old.game !== undefined && old.game !== G.GAME_ID)) return fresh;
  fresh.targets = old.targets.filter((t: any) => t && Number.isInteger(t.round) && t.height === G.target(t.round) && t.final === true);
  return fresh;
}
function defaultPicksContract(): string | null {
  try { const d = JSON.parse(fs.readFileSync(new URL("../../picks-data/deployment.json", import.meta.url), "utf8")); return isAddr(d.contract) ? d.contract : null; } catch { return null; }
}

// ── chain reads ──
async function headOf(node: any) {
  const h: any = await withRetry("head", () => node.getHeadInfo());
  return { id: h.head_topology.id as string, height: Number(h.head_topology.height), time: Number(h.head_block_time), lib: Number(h.last_irreversible_block) };
}
function blockReader(node: any, headId: string, tries = 6) {
  return async (h: number) => {
    const res: any = await withRetry(`block ${h}`, () => node.call("block_store.get_blocks_by_height", { head_block_id: headId, ancestor_start_height: String(h), num_blocks: 1, return_block: true, return_receipt: false }), tries);
    const it = res?.block_items?.[0];
    if (!it || Number(it.block_height) !== h) throw new Error(`block ${h} not returned`);
    return { signer: String(it.block.header.signer), time: Number(it.block.header.timestamp) };
  };
}
/** The producers that signed blocks from..to, with the first and last block times (200 blocks per call). */
async function readSigners(node: any, headId: string, from: number, to: number) {
  const signers = new Set<string>();
  let first = 0, last = 0, n = 0;
  for (let s = from; s <= to; s += 200) {
    const res: any = await withRetry(`blocks at ${s}`, () => node.call("block_store.get_blocks_by_height", { head_block_id: headId, ancestor_start_height: String(s), num_blocks: Math.min(200, to - s + 1), return_block: true, return_receipt: false }));
    for (const it of res?.block_items ?? []) {
      const t = Number(it.block.header.timestamp);
      if (!first) first = t;
      last = t; n++;
      if (isAddr(it.block.header.signer)) signers.add(it.block.header.signer);
    }
  }
  return { signers: [...signers], first, last, n };
}
const PICKS_ABI = () => JSON.parse(fs.readFileSync(new URL("../../picks/abi/picks.koilib.json", import.meta.url), "utf8"));
async function readPicks(node: any, contract: string, game: number, round: number, tries = 6, beforeRead: () => void = () => {}): Promise<RawPick[]> {
  const c = new Contract({ id: contract, abi: PICKS_ABI(), provider: node });
  const out: RawPick[] = [];
  let after: string | undefined;
  for (let page = 0; page < 1000; page++) {
    beforeRead();   // Repo Lens B4-2: before every page, not only the first
    const r: any = await withRetry(`picks for round ${round}`, () => (c.functions as any).list_picks({ game, round: String(round), ...(after ? { start_after: after } : {}), limit: 100 }), tries);
    const rows = r?.result?.rows ?? [];
    for (const x of rows) {
      const ps = x.pick?.producers;
      if (isAddr(x.player) && Array.isArray(ps) && ps.length === 1 && isAddr(ps[0])) out.push({ player: x.player, producer: ps[0], time: Number(x.pick.time || 0) });
    }
    // Audit BX-18: keep going until an empty page (not "a page shorter than 100", which assumes the contract's page size).
    if (!rows.length) break;
    after = rows[rows.length - 1].player;
  }
  return out;
}
const MAINNET_KNODE_GAME = (() => { try { return JSON.parse(fs.readFileSync(new URL("../../game-data/deployment.json", import.meta.url), "utf8")).contract as string; } catch { return ""; } })();
const GAME_ABI = () => JSON.parse(fs.readFileSync(new URL("../../game/abi/kpred.koilib.json", import.meta.url), "utf8"));
/** The Knode vault (v6) as this game sees it (owner, 2026-10-28: every game takes stakes; handoff
 *  claude/handoff-stake-in-every-game.md). A wallet is a STAKED player in Block X for a week only with at least the
 *  vault's minimum (1 VHP today) staked in Block X (game 2) that week; holding VHP or staking in another game doesn't
 *  count. Everyone else is a free player here. Read with get_game_player(player, game, week): `week_stake` is the
 *  stake the vault counts (the lowest that week; 0 if all was withdrawn), and the entry's `peak_stake` (else the
 *  active stake) is the most it had (a free player never reached the minimum). Before v6 is live
 *  (get_state → config.v6_rule_week_plus_one = 0) nobody is staked. Audit BX-15: a failed read is an error. */
// Audit BX-61: game/abi/kpred-v6.koilib.json is the vault v6 ABI, copied from the vault repo (branch vault-v6-next,
// f1ecf59, game/abi/kpred.koilib.json, made there by game/scripts/make-abi.cjs from game/assembly/proto/kpred.proto).
export const VAULT_ABI_FILE = new URL("../../game/abi/kpred-v6.koilib.json", import.meta.url);
export const VAULT_ABI = () => JSON.parse(fs.readFileSync(VAULT_ABI_FILE, "utf8"));
/** Audit BX-61: just enough of the vault's get_state (the same entry point in v5 and v6) to see whether v6 is live and
 *  what the minimum stake is. Fields the vault has but this doesn't name are skipped by the decoder. So the "is v6
 *  live?" check never needs the v6 ABI file: before v6, nothing else is read and nobody is staked. */
const U64 = (id: number) => ({ type: "uint64", id, options: { jstype: "JS_STRING" } });
export const STATE_ABI = {
  methods: { get_state: { entry_point: 1023583049, argument: "kpred.get_state_arguments", return: "kpred.get_state_result", read_only: true } },
  koilib_types: { nested: { kpred: { nested: {
    get_state_arguments: { fields: {} },
    get_state_result: { fields: { config: { type: "config_object", id: 1 } } },
    config_object: { fields: { owner: { type: "bytes", id: 1, options: { "(koinos.btype)": "ADDRESS" } }, min_stake: U64(9), min_stake_next: U64(13), min_stake_next_week: U64(14), v6_rule_week_plus_one: U64(21) } },
  } } } },
};
export type VaultView = { live: boolean; min: bigint; players: Map<string, { week: bigint; peak: bigint }> };
export function minStakeFor(cfg: any, week: number): bigint {
  const next = BigInt(cfg?.min_stake_next || "0"), from = Number(cfg?.min_stake_next_week || 0);
  return next > 0n && week >= from ? next : BigInt(cfg?.min_stake || "0");
}
/** Runs fn over items, at most `limit` at a time (audit BX-63). */
export async function pool<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i]); } };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return out;
}
export const VAULT_READS_AT_ONCE = 8;
/** The vault as Block X sees it, read once per run (audit BX-63): the state once per node, and each wallet's
 *  get_game_player once per node and week (cached for the run; up to 8 reads at a time). Audit BX-61: the v6 check
 *  comes first, with STATE_ABI; the v6 ABI file is loaded only once v6 is live. `abi` is for the tests. */
export function vaultReader(vault: string | null, game: number, abi: () => any = VAULT_ABI, tries = 6, beforeRead: () => void = () => {}) {
  const state = new Map<any, Promise<any>>();
  const stakeCache = new Map<any, Map<string, Promise<any>>>();   // node → "week|wallet" → its get_game_player answer
  const cfgOf = (node: any) => {
    let s = state.get(node);
    if (!s) {
      s = (async () => {
        const c = new Contract({ id: vault!, abi: STATE_ABI as any, provider: node });
        beforeRead();
        const st: any = await withRetry("vault state", () => (c.functions as any).get_state({}), tries);
        // Audit BX-82: koilib always returns `result`; an answer without the game's owner is no answer.
        if (!st?.result?.config?.owner) throw new Error("no answer reading the vault's state (no owner in it)");
        return st.result?.config ?? {};
      })();
      s.catch(() => state.delete(node));
      state.set(node, s);
    }
    return s;
  };
  return async (node: any, who: string[], week: number): Promise<VaultView> => {
    if (!vault) return { live: false, min: 0n, players: new Map() };
    const cfg = await cfgOf(node);
    if (!(Number(cfg.v6_rule_week_plus_one || 0) > 0)) return { live: false, min: 0n, players: new Map() };
    const c = new Contract({ id: vault, abi: abi(), provider: node });
    let mine = stakeCache.get(node);
    if (!mine) { mine = new Map(); stakeCache.set(node, mine); }
    const results = new Map<string, any>();
    const got = await pool([...new Set(who)], VAULT_READS_AT_ONCE, async (a) => {
      const k = `${week}|${a}`;
      let p = mine!.get(k);
      if (!p) {
        p = (async () => {
          beforeRead();   // Repo Lens B4-2: the re-read's deadline before every one of these reads too
          const r: any = await withRetry(`vault: ${a} in game ${game}`, () => (c.functions as any).get_game_player({ player: a, game, week: String(week) }), tries);
          if (!r || !("result" in r)) throw new Error(`no answer reading ${a}'s stake in game ${game}`);
          return r.result ?? {};
        })();
        p.catch(() => mine!.delete(k));     // a failed read is tried again (never cached as "not staked")
        mine!.set(k, p);
      }
      return [a, await p] as [string, any];
    });
    for (const [a, r] of got) results.set(a, r);
    return vaultView(cfg, results, week);
  };
}
/** One read of the vault (no cache between calls). Exported for the tests. */
export function readVault(node: any, vault: string | null, game: number, who: string[], week: number, abi: () => any = VAULT_ABI): Promise<VaultView> {
  return vaultReader(vault, game, abi)(node, who, week);
}
/** From the vault's answers (get_state's config, and get_game_player for THIS game per player): the minimum for the
 *  week, each player's counted stake (`week_stake`, the lowest that week) and the most it had. Exported for the tests. */
export function vaultView(cfg: any, results: Map<string, any>, week: number): VaultView {
  const out: VaultView = { live: Number(cfg?.v6_rule_week_plus_one || 0) > 0, min: minStakeFor(cfg, week), players: new Map() };
  if (!out.live) return out;
  if (out.min <= 0n) out.min = 100000000n;
  for (const [a, r] of results) {
    const e = r?.entry, act = BigInt(r?.active_stake || "0");
    const peak = e ? [BigInt(e.peak_stake || "0"), BigInt(e.stake || "0")].reduce((x, y) => (y > x ? y : x)) : act;
    out.players.set(a, { week: BigInt(r?.week_stake || "0"), peak });
  }
  return out;
}
export { stakedSet };
const stakedSet = (v: VaultView) => new Set([...v.players.entries()].filter(([, x]) => v.live && x.peak >= v.min).map(([a]) => a));

/** The Vault's points for staked players (1-255, keeping the board's order and ties; only order matters to the
 *  vault). Rows come in board order with their place; distinct places get 255, 254, … and a place below 1 is 1. */
export function vaultPoints(ranked: { player: string; place: number }[]): { player: string; points: number }[] {
  const places = [...new Set(ranked.map((x) => x.place))].sort((a, b) => a - b);
  const pts = new Map(places.map((pl, i) => [pl, Math.max(1, 255 - i)]));
  return ranked.map((x) => ({ player: x.player, points: pts.get(x.place)! }));
}

// ── VHP moved in around block X (audit BX-53) ──
/** Blocks before the lock card that still count: added VHP counts for production 20 blocks after it arrives. */
export const MOVE_MARGIN = 25;
/** A card with `vhp` (1e-8 units) added to `who` (field or paddock); the same card when nothing moved. */
export function withMoved(card: Card | null, who: string, vhp: bigint): Card | null {
  if (!card || vhp <= 0n) return card;
  const add = Number(vhp) / 1e8;
  const bump = (rows: any[]) => (rows || []).map((r: any) => (r && r.a === who ? { ...r, vhp: r.vhp + add } : r));
  return { ...card, field: bump(card.field), paddock: bump(card.paddock) };
}
/** VHP moved INTO `who` by the VHP contract in blocks from..to: the sum of its transfer and mint events naming `who` as
 *  the receiver (events are read from the block receipts, 200 blocks per call). Moves out are ignored: the card already
 *  counts the highest VHP. Exported for the tests. */
export async function scoringVhpMoves(node: any, headId: string, vhp: string, who: string, from: number, to: number): Promise<bigint> {
  // Audit BX-77 / BX-84: every block of the range, contiguous, checked; 200 blocks a call, 4 calls at a time.
  const starts: number[] = [];
  for (let s = Math.max(1, from); s <= to; s += 200) starts.push(s);
  const parts = await pool(starts, 4, async (s) => {
    const n = Math.min(200, to - s + 1);
    // Audit BX-90 (round 5): a node may return fewer blocks than asked; read on from where it stopped (as readBlocks
    // does), and still require every block of the range, in order.
    const items: any[] = [];
    while (items.length < n) {
      const at = s + items.length;
      const res: any = await withRetry(`receipts at ${at}`, () => node.call("block_store.get_blocks_by_height", { head_block_id: headId, ancestor_start_height: String(at), num_blocks: n - items.length, return_block: false, return_receipt: true }));
      const page = res?.block_items ?? [];
      if (!page.length) break;
      items.push(...page.slice(0, n - items.length));
    }
    if (items.length !== n || items.some((it: any, k: number) => Number(it?.block_height) !== s + k)) throw new Error(`receipts ${s}-${s + n - 1}: the node returned ${items.length} of ${n} blocks, or out of order`);
    let sum = 0n;
    for (const it of items) sum += vhpInflows(it?.receipt, vhp, who);
    return sum;
  });
  return parts.reduce((x, y) => x + y, 0n);
}
/** From one block receipt: VHP received by `who`. The receiver is the event's impacted[0] (the contract's own decoded
 *  `to`). Audit BX-72 (round 5): the amount of a TRANSFER is taken only from the one canonical encoding of
 *  {from, to: impacted[0], value[, memo]} (fields 1-4 in order, each at most once, the right wire types, shortest
 *  varints: what koilib, Kondor and as-proto contracts write). Any other bytes for a transfer to `who` throw
 *  NonCanonicalTransfer, and the recorder voids that target at once (review, round 5: the bytes never change, so a
 *  retry can't help): a copy of the contract's decoder would have to follow every quirk of its library version, and
 *  "refuse to guess" can never count a different number. Mints are
 *  written by the PoB contract itself (canonical): their value is field 2. */
export function vhpInflows(receipt: any, vhp: string, who: string): bigint {
  const events = [...(receipt?.events ?? []), ...((receipt?.transaction_receipts ?? []) as any[]).flatMap((t) => t?.events ?? [])];
  let sum = 0n;
  for (const e of events) {
    if (!e || e.source !== vhp || typeof e.name !== "string") continue;
    const mint = /mint/i.test(e.name), transfer = /transfer/i.test(e.name);
    if (!mint && !transfer) continue;
    if (!Array.isArray(e.impacted) || e.impacted[0] !== who) continue;
    if (transfer) { sum += canonicalTransferValue(e.data, who); continue; }
    const value = lastVarint(e.data, 2);
    if (value !== null) sum += value;
  }
  return sum;
}
const b64 = (data: unknown): Uint8Array => {
  if (typeof data !== "string" || !/^[A-Za-z0-9+/_-]*={0,2}$/.test(data)) throw new Error("a VHP transfer's event data isn't base64");
  return new Uint8Array(Buffer.from(data, "base64"));
};
/** The shortest varint of v. */
function varintBytes(v: bigint): number[] {
  const o: number[] = [];
  do { let x = Number(v & 0x7fn); v >>= 7n; if (v) x |= 0x80; o.push(x); } while (v);
  return o;
}
/** A VHP transfer to the signer whose bytes aren't the standard encoding (audit BX-72). The bytes on chain never change,
 *  so the target is voided at once with this reason (review, round 5), never retried for 3 days. */
export class NonCanonicalTransfer extends Error {}
/** Audit BX-72: the value of a VHP transfer event to `to`, ONLY when its bytes are exactly the standard encoding of
 *  {from, to, value[, memo]}: fields 1-4 in order, each at most once, shortest varints and lengths. A field may be
 *  written with its default (koilib writes value 0 as `18 00`, an empty memo as `22 00`): every decoder reads those the
 *  same way. Anything else throws NonCanonicalTransfer. Exported for the tests. */
export function canonicalTransferValue(data: unknown, to: string): bigint {
  let b: Uint8Array;
  try { b = b64(data); } catch (e) { throw new NonCanonicalTransfer(`a VHP transfer to ${to}: ${(e as Error).message}`); }
  const bad = (why: string) => new NonCanonicalTransfer(`a VHP transfer to ${to} isn't in the standard encoding (${why})`);
  let i = 0;
  const vint = (): bigint => {
    let r = 0n, sh = 0n;
    for (let k = 0; k < 10; k++) { if (i >= b.length) throw bad("cut short"); const x = b[i++]; r |= BigInt(x & 0x7f) << sh; if (!(x & 0x80)) return r; sh += 7n; }
    throw bad("a varint over 10 bytes");
  };
  const lenField = (tag: number): Uint8Array | null => {
    if (b[i] !== tag) return null;
    i++;
    const n = vint();
    if (n > BigInt(b.length - i)) throw bad("a length past the end");
    const out = b.subarray(i, i + Number(n)); i += Number(n);
    return out;
  };
  const from = lenField(0x0a);
  const toB = lenField(0x12) ?? new Uint8Array(0);
  let value = 0n, hasValue = false;
  if (b[i] === 0x18) { i++; value = vint(); hasValue = true; }
  const memo = lenField(0x22);
  if (i !== b.length) throw bad("unexpected fields");
  let want: Uint8Array;
  try { want = kutils.decodeBase58(to); } catch { throw bad("not an address"); }
  if (toB.length !== want.length || toB.some((x, k) => x !== want[k])) throw bad("its `to` isn't the event's receiver");
  if (value > 0xffffffffffffffffn) throw bad("a value over 64 bits");
  // Re-encode the fields that were there and require the same bytes (shortest varints and lengths).
  const enc: number[] = [];
  const put = (tag: number, x: Uint8Array | null) => { if (x) enc.push(tag, ...varintBytes(BigInt(x.length)), ...x); };
  put(0x0a, from); put(0x12, toB);
  if (hasValue) enc.push(0x18, ...varintBytes(value));
  put(0x22, memo);
  if (enc.length !== b.length || enc.some((x, k) => x !== b[k])) throw bad("not the shortest encoding");
  return value;
}
/** The last varint of field `want` in protobuf bytes (base64), skipping every other field as as-proto does (wire types
 *  0, 1, 2 and 5); null when the bytes don't parse. Used for the PoB contract's own mint events. Exported for the tests. */
export function lastVarint(data: unknown, want: number): bigint | null {
  let b: Uint8Array;
  try { b = typeof data === "string" ? new Uint8Array(Buffer.from(data, "base64")) : new Uint8Array(0); } catch { return null; }
  let i = 0, last: bigint | null = null;
  const vint = (): bigint | null => { let r = 0n, sh = 0n; for (let k = 0; k < 10; k++) { if (i >= b.length) return null; const x = b[i++]; r |= BigInt(x & 0x7f) << sh; if (!(x & 0x80)) return r & 0xffffffffffffffffn; sh += 7n; } return null; };
  while (i < b.length) {
    const tag = vint(); if (tag === null) return null;
    const f = Number(tag >> 3n), w = Number(tag & 7n);
    if (w === 0) { const v = vint(); if (v === null) return null; if (f === want) last = v; }
    else if (w === 1) { i += 8; }
    else if (w === 2) { const n = vint(); if (n === null || i + Number(n) > b.length) return null; i += Number(n); }
    else if (w === 5) { i += 4; }
    else return null;
    if (i > b.length) return null;
  }
  return last;
}

// ── cards ──
/** The handicap card for a lock at time t (audit BX-3): the latest card TAKEN at or before t (its `at`), no older than
 *  3 hours, so a card made after the lock (with VHP that moved after it) is never used. Race cards come from the race
 *  at t and the one before; self-made cards (testnet) from cards.json. None: the target waits (then void). */
const CARD_MAX_AGE_MS = 3 * 3600000;
/** Repo Lens E4-3: the week-end re-read reads this many targets at a time. Fix-check L-1: it stops (holding the week,
 *  tried again next run) once the RUN has taken this long, so with in-flight reads it still ends well inside the job's
 *  30 minutes; and inside the re-read each read gets REVERIFY_TRIES tries (a few seconds), not withRetry's minute. */
export const REVERIFY_AT_ONCE = 4;
export const REVERIFY_BUDGET_MS = 22 * 60000;
export const REVERIFY_TRIES = 2;
/** Repo Lens B3-2: thrown before a read once the re-read's deadline has passed (a passing hold). */
class OutOfTime extends Error { constructor() { super("the re-read ran out of time this run"); } }
/** Fix-check L-2: the one-off release of a held week. BLOCKX_RELEASE = "<week>:<release code>", the code printed with the
 *  hold (sha256 of the hold's exact reason, first 16 hex). It releases only that week and only while it is held for that
 *  same reason; a read failure or a timeout (they pass on their own) can't be released. Exported for the tests. */
export const releaseCode = (reason: string) => crypto.createHash("sha256").update(reason).digest("hex").slice(0, 16);
export function releaseMatches(release: string | null | undefined, week: number, reason: string): boolean {
  const m = typeof release === "string" ? /^\s*([0-9]{1,4}):([0-9a-f]{16})\s*$/.exec(release) : null;
  return !!m && Number(m[1]) === week && m[2] === releaseCode(reason);
}
/** Audit BX-38: a race card made from fewer than 12 VHP samples is flagged; Block X never scores with it. */
export const MIN_CARD_SAMPLES = 12;
const usable = (c: Card | null | undefined, race: boolean): c is Card =>
  !!c && Number.isFinite(c.at) && Array.isArray(c.field) && c.field.length > 0 && (!race || (Number.isInteger(c.samples) && c.samples >= MIN_CARD_SAMPLES));
function latestCardAt(cards: (Card | null | undefined)[], t: number, race = false): Card | null {
  let best: Card | null = null;
  for (const c of cards) {
    if (!usable(c, race)) continue;
    if (c.at <= t && t - c.at <= CARD_MAX_AGE_MS && (!best || c.at > best.at)) best = c;
  }
  return best;
}
/** Audit BX-35: the first card taken AFTER block X (within 3 hours). A target is scored with the lower multiplier
 *  of this card and the lock's card, so VHP moved in right after the lock card doesn't pay. */
function firstCardAfter(cards: (Card | null | undefined)[], t: number, race = false, signer = ""): Card | null {
  let best: Card | null = null;
  for (const c of cards) {
    if (!usable(c, race)) continue;
    if (signer && flags(c, signer)) continue;   // audit BX-55: a card on which the nodes disagreed about the signer waits for the next

    if (c.at > t && c.at - t <= CARD_MAX_AGE_MS && (!best || c.at < best.at)) best = c;
  }
  return best;
}
function raceCards(raceDir: string | undefined, times: number[]): (Card | null)[] {
  const all: (Card | null)[] = [];
  const seen = new Set<string>();
  for (const at of times) {
    const ra = M.raceAt(at);
    if (seen.has(ra.id)) continue;
    seen.add(ra.id);
    const wf = readJson(raceDir, wName(M.weekOf(ra.start)));
    const race = wf && Array.isArray(wf.races) ? wf.races.find((r: any) => r && r.id === ra.id) : null;
    if (race && Array.isArray(race.cards)) all.push(...race.cards);
  }
  return all;
}
function raceCardAfter(raceDir: string | undefined, t: number, signer = ""): Card | null {
  return firstCardAfter(raceCards(raceDir, [t, t + M.RACE]), t, true, signer);
}
/** Audit BX-55: the race recorder lists on a card the producers whose VHP the two nodes read differently. */
export const flags = (c: Card | null | undefined, who: string) => !!c && ((Array.isArray(c.flagged) && c.flagged.includes(who)) || c.topInDoubt === true);   // round 4, BX-73: the top in doubt holds every target
function raceCardAt(raceDir: string | undefined, t: number): Card | null {
  const all: (Card | null)[] = [];
  for (const at of [t, t - M.RACE]) {
    const ra = M.raceAt(at);
    const wf = readJson(raceDir, wName(M.weekOf(ra.start)));
    const race = wf && Array.isArray(wf.races) ? wf.races.find((r: any) => r && r.id === ra.id) : null;
    if (race && Array.isArray(race.cards)) all.push(...race.cards);
  }
  return latestCardAt(all, t, true);
}
/** Repo Lens E4-1 (round 14): whether the race folder holds the race recorder's week file for every race that could
 *  hold a card in [from, to] (only races that have started by `now`; a later week can't exist yet). A run whose
 *  race-data fetch failed has no files at all: its targets must wait, never be written void for "no card". */
export function raceWeeksPresent(raceDir: string | undefined, from: number, to: number, now: number): boolean {
  if (!raceDir) return false;
  const end = Math.min(to, now);
  if (end < from) return true;
  const weeks = new Set<number>();
  for (let t = from; t < end; t += M.RACE) weeks.add(M.weekOf(M.raceAt(t).start));
  weeks.add(M.weekOf(M.raceAt(end).start));
  for (const w of weeks) { const wf = readJson(raceDir, wName(w)); if (!wf || !Array.isArray(wf.races)) return false; }
  return true;
}
const selfCardAt = (cards: Card[], t: number): Card | null => latestCardAt(cards, t);
const selfCardAfter = (cards: Card[], t: number, signer = ""): Card | null => firstCardAfter(cards, t, false, signer);

/** One run for one game. Exported for the tests, which pass fake nodes. */
export async function run(o: Opts) {
  // R-BX-25: the game for each week. A target belongs to the game whose weeks its block's real time falls in.
  const SCHED = (o.schedule ?? [{ game: o.game ?? X.MAINNET_GAME, fromWeek: 0, toWeek: Infinity }])
    .map((e: any) => ({ G: X.forGame(e.game), fromWeek: e.fromWeek, toWeek: e.toWeek, from: M.weekStart(e.fromWeek), to: e.toWeek === Infinity ? Infinity : M.weekStart(e.toWeek) }));
  const GW = (w: number): any => (SCHED.find((e) => w >= e.fromWeek && w < e.toWeek) ?? SCHED[0]).G;
  const inGame = (Gx: any, t: number) => SCHED.some((e) => e.G === Gx && t >= e.from && t < e.to);
  const VG = o.vaultGame ?? SCHED[0].G.GAME_ID;
  const OUT = o.out ?? E.BLOCKX_OUT ?? "games-data/blockx";
  const PREV = o.prev ?? E.BLOCKX_PREV ?? "";
  const RACE = o.raceDir ?? E.RACE_DATA ?? "";
  const CARDS = o.cards ?? "race";
  const VHP = o.vhpContract ?? MAINNET_VHP;
  const KNODE = o.knodeGame === undefined ? MAINNET_KNODE_GAME || null : o.knodeGame;
  const PRIZES_FROM = o.prizesFromWeek ?? null;
  const problems: string[] = [];
  const holds: string[] = [];   // Repo Lens E4-7: a held week is an error (the workflow fails the run after publishing)
  const runStart = Date.now();   // fix-check L-1: the re-read's budget counts from here
  const contract = o.picksContract === undefined ? defaultPicksContract() : o.picksContract;

  const live = o.head ? null : await headOf(o.p);
  const head = o.head ?? live!;
  const headId = live ? live.id : "";
  const blockP = o.blockOf ? (h: number) => o.blockOf!(o.p, h) : blockReader(o.p, headId);
  let blockC: ((h: number) => Promise<{ signer: string; time: number }>) | null = null;
  let checkHeadId = "";
  if (o.check) {
    if (o.blockOf) blockC = (h: number) => o.blockOf!(o.check, h);
    else {
      const ch = await headOf(o.check); blockC = blockReader(o.check, ch.id); checkHeadId = ch.id;
      // Audit BX-17: a block is irreversible only when both nodes say so.
      if (ch.lib < head.lib) head.lib = ch.lib;
    }
  }
  // Audit BX-33 / BX-46: the game's lock settings on chain (both nodes) must be the ones this recorder scores with.
  // A failed read, or no such game, records nothing this run (it never falls back to the recorder's own settings).
  if (!o.picksOf && contract) {
    for (const node of [o.p, o.check].filter(Boolean)) {
      // R-BX-25: every game whose weeks this run can touch (the last 3 days and now): a game not started yet isn't read.
      for (const e of SCHED.filter((x) => x.from <= head.time && x.to > head.time - LOOKBACK_BLOCKS * X.BLOCK_MS - 7 * X.DAY)) {
        const G = e.G;
        const r: any = await withRetry(`game ${G.GAME_ID} settings`, () => (new Contract({ id: contract, abi: PICKS_ABI(), provider: node }).functions as any).get_game({ game: G.GAME_ID }));
        const gc = r?.result?.game;
        if (!gc) throw new Error(`game ${G.GAME_ID} is not on the Picks contract (or the node didn't answer). Nothing recorded this run.`);
        if (Number(gc.round_size) !== G.ROUND || Number(gc.round_offset ?? 0) !== G.OFFSET || Number(gc.lead) !== G.LEAD) {
          throw new Error(`game ${G.GAME_ID} on chain has round ${gc.round_size}, offset ${gc.round_offset ?? 0}, lead ${gc.lead}; this recorder scores ${G.ROUND}/${G.OFFSET}/${G.LEAD}. Nothing recorded: update the game settings in the recorder first.`);
        }
      }
    }
  }
  const picksRead: ((node: any, r: number, g: number) => Promise<RawPick[]>) | null = o.picksOf ?? (contract ? (node: any, r: number, g: number) => readPicks(node, contract, g, r) : null);
  // Audit BX-63: one vault reader for the whole run (each wallet read once per node and week, in parallel).
  const vaultOnce = vaultReader(KNODE, VG);
  const vaultRead = o.stakeOf ? null : (who: string[], node: any, week: number) => vaultOnce(node, who, week);
  const rankedRead = o.rankedOf ?? (async (who: string[], node: any, week = 0) => stakedSet(await vaultRead!(who, node, week)));
  const weekStakes = async (who: string[], node: any, week: number): Promise<{ min: bigint; week: Map<string, bigint> } | null> => {
    if (o.stakeOf) return o.stakeOf(who, node, week);
    if (o.rankedOf) { const s = await o.rankedOf(who, node, week); return { min: 1n, week: new Map(who.map((a) => [a, s.has(a) ? 1n : 0n])) }; }
    const v = await vaultRead!(who, node, week);
    return v.live ? { min: v.min, week: new Map([...v.players.entries()].map(([a, x]) => [a, x.week])) } : null;
  };
  for (const e of SCHED) console.log(`game ${e.G.GAME_ID} (weeks ${e.fromWeek}–${e.toWeek === Infinity ? "on" : e.toWeek - 1}): every ${e.G.ROUND} blocks, lock ${e.G.LEAD} before`);
  console.log(`vault game ${VG}; head ${head.height} (${new Date(head.time).toISOString()}), irreversible ${head.lib}`);

  // ── self-made cards (CARDS=self): one per hour, from the VHP of the producers of the last ~6 hours ──
  let cards: Card[] = [];
  let startHeight = 0;                       // CARDS=self: the head when this recorder first ran (targets start there)
  if (CARDS === "self") {
    const prev = readJson(PREV, "cards.json");
    startHeight = prev && prev.v === 1 && Number.isInteger(prev.startHeight) && prev.startHeight > 0 ? prev.startHeight : head.height;
    cards = (prev && prev.v === 1 && Array.isArray(prev.cards) ? prev.cards : []).filter((c: any) => c && Number.isFinite(c.at) && Array.isArray(c.field) && head.time - c.at <= CARD_KEEP_MS);
    const hour = Math.floor(head.time / 3600000);
    if (!cards.some((c) => Math.floor(c.at / 3600000) === hour)) {
      try {
        const from = Math.max(1, head.height - CARD_BLOCKS + 1);
        const sg = o.signersOf ? await o.signersOf(o.p, from, head.height) : await readSigners(o.p, headId, from, head.height);
        const values = o.vhpOf ? await o.vhpOf(sg.signers) : (await readVhp(o.p, VHP, sg.signers, { effective: true })).values;   // effective VHP (BX-3 b; testnet: one producer)
        const span = sg.last - sg.first, perRace = span > 0 ? (sg.n - 1) * M.RACE / span : 7200;
        const card = M.makeCard(sg.signers.map((a) => [a, Number(values[a] || "0") / 1e8]), perRace, head.time);
        if (card.field.length + card.paddock.length) { cards.push(card); console.log(`card taken: ${card.field.length + card.paddock.length} producers`); }
      } catch (e) { problems.push(`card: ${(e as Error).message} (tried again next run)`); }
    }
    cards.sort((a, b) => a.at - b.at);
  }
  const cardAt = (t: number) => (CARDS === "self" ? selfCardAt(cards, t) : raceCardAt(RACE, t));
  const cardAfter = (t: number, signer = "") => (CARDS === "self" ? selfCardAfter(cards, t, signer) : raceCardAfter(RACE, t, signer));
  /** Repo Lens E4-1: the race recorder's files for [from, to] aren't in this run's race folder (race cards only). */
  const raceMissing = (from: number, to: number) => CARDS === "race" && !raceWeeksPresent(RACE, from, to, head.time);

  // The weeks touched: the last 3 days and now.
  const weeks = new Map<number, WeekFile>();
  const weekFor = (w: number) => { let f = weeks.get(w); if (!f) { f = loadWeek(PREV, w, GW(w)); weeks.set(w, f); } return f; };
  const idx = readJson(PREV, "index.json");
  const known = new Set<number>(Array.isArray(idx?.weeks) ? idx.weeks.filter((w: any) => Number.isInteger(w) && w >= 0 && w < 10000) : []);
  const done = new Set<string>();   // "<game>:<round>"
  const nowW = M.weekOf(head.time);
  for (const w of [nowW - 1, nowW]) if (w >= 0) for (const t of weekFor(w).targets) done.add(`${GW(w).GAME_ID}:${t.round}`);

  /** A void row (no points) for a target that couldn't be recorded before it left the 3-day window (audit BX-16). */
  const voidAt = (r: number, h: number, time: number, lockTime: number, why: string, G: any) => {
    const t = time || (head.time - (head.height - h) * X.BLOCK_MS);
    if (!inGame(G, t)) return;   // R-BX-25: not this game's weeks
    const wf = weekFor(M.weekOf(t));
    if (wf.targets.some((x) => x.round === r)) return;
    wf.targets = wf.targets.concat([{ round: r, height: h, final: true, checked: 0, signer: null, time: Math.round(t), lockTime: Math.round(lockTime || t - G.LEAD * X.BLOCK_MS), card: null, void: why.replace(/[\r\n]+/g, " "), picks: [] }]).sort((x, y) => x.round - y.round);
    done.add(`${G.GAME_ID}:${r}`);
  };

  /** D-125 / D-129: a target whose block falls on Sunday UTC is a fun round: Today and All time only, never the week. */
  const REST_FROM = Number.isInteger(o.restFromWeek) ? o.restFromWeek! : X.RHYTHM_FROM_WEEK;
  const rest = (t: number) => X.restDay(t, REST_FROM);

  /** I-042: the week read again from the chain, target by target, before its prize list is frozen. Returns why it must
   *  be held, or null when every target reads the same on both nodes:
   *  - every round is a target block of the game, already irreversible (a future round can't be in it: G-K-1);
   *  - a recorded target: the signer and times of block X and of its lock block, on both nodes;
   *  - its picks (player, producer, time) on both nodes, and each player's Staked / Free play flag on both nodes;
   *  - a scored target: the same lock card and first card after X, and every pick's points recomputed from them.
   *  A void row scores nothing, so only its round and height are checked (a target voided for a non-standard VHP
   *  transfer is listed for the correction window: nonCanonicalNotes). The VHP moved into the signer (BX-53) isn't
   *  re-scanned (it was read on both nodes when recorded); the points are recomputed with the amount recorded. */
  /** A hold from the re-read: why, which round, and whether it passes on its own (then it is never released). */
  type Hold = { why: string; round: number | null; passes: boolean };
  // Repo Lens B3-2 / B4-2: the re-read's deadline, checked before every read it makes, including each read inside the
  // vault reader and each page of picks; and its own vault reader with REVERIFY_TRIES tries per read (not the default 6).
  const reDeadline = runStart + (o.reverifyBudgetMs ?? REVERIFY_BUDGET_MS);
  const beforeRead = () => { if (Date.now() > reDeadline) throw new OutOfTime(); };
  const reVault = vaultReader(KNODE, VG, VAULT_ABI, REVERIFY_TRIES, beforeRead);
  const rerank = o.rankedOf ?? (o.stakeOf ? rankedRead : (async (who: string[], node: any, week = 0) => stakedSet(await reVault(node, who, week))));
  /** Repo Lens B3-1 / B4-1: `ignore` is the one hold a matching BLOCKX_RELEASE lets through: that round and that exact
   *  reason. Every target is still read, that round included, and every other check on it still runs. */
  const reverify = async (wf: WeekFile, ignore: { round: number; why: string } | null = null): Promise<Hold | null> => {
    // Fix-check L-1: REVERIFY_TRIES tries per read here (a failed read holds the week; the next run tries again).
    const nodes = (o.blockOf ? [blockP, blockC] : [blockReader(o.p, headId, REVERIFY_TRIES), o.check ? blockReader(o.check, checkHeadId, REVERIFY_TRIES) : null]).filter(Boolean) as ((h: number) => Promise<{ signer: string; time: number }>)[];
    const reread: ((node: any, r: number, g: number) => Promise<RawPick[]>) | null = o.picksOf ?? (contract ? (node: any, r: number, g: number) => readPicks(node, contract, g, r, REVERIFY_TRIES, beforeRead) : null);
    const G = GW(wf.week);   // R-BX-25: the week's own game
    const pnodes = [o.p, o.check].filter(Boolean);
    const sameRaw = (a: [string, string, number][], b: [string, string, number][]) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
    const deadline = reDeadline;
    /** Repo Lens B3-2: the deadline is checked before EVERY read, so the re-read ends within about one read of it. */
    const OUT_OF_TIME = "the re-read ran out of time this run";
    const timed = <T,>(f: () => Promise<T>): Promise<T> => (Date.now() > deadline ? Promise.reject(new OutOfTime()) : f());
    /** Repo Lens E4-1 (b): a void row's own reason must still hold with this run's race files. (Voids for a
     *  non-standard transfer are listed for the correction window instead; 3-day-edge voids have checked 0.) */
    const voidReason = (t: Target): string | null => {
      const v = String(t.void), who = t.signer ?? "";
      if (/^no handicap card was recorded for this target's lock/.test(v)) {
        if (raceMissing(t.lockTime - CARD_MAX_AGE_MS, t.lockTime)) return "this run has no race cards for its lock";
        return cardAt(t.lockTime) ? "it was voided for having no handicap card at its lock, but there is one" : null;
      }
      if (/^no handicap card was taken within 3 hours after the block/.test(v)) {
        if (raceMissing(t.time, t.time + CARD_MAX_AGE_MS)) return "this run has no race cards for the hours after the block";
        const c = cardAfter(t.time, who);
        return c && c.at <= t.time + CARD_MAX_AGE_MS ? "it was voided for having no handicap card after the block, but there is one" : null;
      }
      if (/^the two nodes disagreed about the (signer's VHP|VHP of the top producer) on the lock's handicap card/.test(v)) {
        return flags(cardAt(t.lockTime), who) ? null : "it was voided for a disputed lock card, but that card isn't disputed now";
      }
      return null;
    };
    const one = async (t: Target): Promise<Hold | null> => {
      const at = `block ${t.height}`;
      // Repo Lens B4-1: the released hold (this round, this exact reason) is let through, and the next check runs.
      const hold = (why: string, passes = false): Hold | null => (ignore && t.round === ignore.round && `${at}${why}` === ignore.why ? null : { why: `${at}${why}`, round: t.round, passes });
      if (t.height !== G.target(t.round)) { const x = hold(` isn't round ${t.round}'s target block`); if (x) return x; }
      // Repo Lens B3-3: not yet irreversible passes on its own: never released.
      if (t.height > head.lib) return hold(" isn't irreversible yet", true);   // passing: never ignored by a release
      // D-129: a Sunday (UTC) target is a fun round and pays nothing, so only its block is read again (so a run can't
      // move a play-day target out of the week by giving it a Sunday time); its picks and points aren't re-checked.
      // Repo Lens #E-18 K-1: a row is never skipped because it says it wasn't read. Only a void row with no picks may be
      // unread (a 3-day-edge void; the publish job lets a new one in only once its block is ~3 days old); any other row
      // with checked 0 holds.
      if (!t.checked && !(t.void && !t.picks.length)) { const x = hold(": a row that says it was never read on chain"); if (x) return x; }
      if (rest(t.time)) {
        if (t.void && !t.checked) return null;
        for (const read of nodes) {
          const b = await timed(() => read(t.height));
          if ((isAddr(b.signer) ? b.signer : null) !== t.signer || b.time !== t.time) { const x = hold(": its signer or times read differently now"); if (x) return x; }
        }
        return null;
      }
      if (t.void && !t.checked) { if (t.picks.length) { const x = hold(": a void row with picks"); if (x) return x; } return null; }
      for (const read of nodes) {
        const b = await timed(() => read(t.height)), l = await timed(() => read(t.height - G.LEAD));
        if ((isAddr(b.signer) ? b.signer : null) !== t.signer || b.time !== t.time || l.time !== t.lockTime) { const x = hold(": its signer or times read differently now"); if (x) return x; }
      }
      if (reread) {
        const mine = t.picks.map((x) => [x[0], x[1], x[2]] as [string, string, number]);
        for (const node of pnodes) {
          const raw = (await timed(() => reread(node, t.round, G.GAME_ID))).map((x) => [x.player, x.producer, x.time] as [string, string, number]);
          if (!sameRaw(raw, mine)) { const x = hold(": its picks read differently now"); if (x) return x; }
        }
      }
      const players = [...new Set(t.picks.map((x) => x[0]))];
      if (players.length) for (const node of pnodes) {
        const rk = await timed(() => rerank(players, node, M.weekOf(t.time)));
        if (t.picks.some((x) => (rk.has(x[0]) ? 1 : 0) !== x[4])) { const x = hold(": a player's Staked / Free play flag reads differently now"); if (x) return x; }
      }
      if (t.void) {
        if (t.picks.some((x) => x[3] !== 0)) { const x = hold(": a void target with points"); if (x) return x; }
        const why = voidReason(t);
        // Repo Lens B3-3: missing race files (a fetch gap) pass on their own: never released.
        return why ? hold(`: a void target has a card now (${why})`, /^this run has no race cards/.test(why)) : null;
      }
      const card = cardAt(t.lockTime), after = t.signer ? cardAfter(t.time, t.signer) : null;
      if (!card || !after || !t.card || card.at !== t.card.at || after.at !== t.card.afterAt || flags(card, t.signer!)) {
        const x = hold(": its handicap cards read differently now"); if (x) return x;
        // Released, but the points can't be recomputed without both cards: a hold of its own (never let through unread).
        if (!card || !after || !t.card) return hold(": its points can't be recomputed without its handicap cards");
      }
      // The VHP moved into the signer (BX-53), as recorded: the stored signer VHP less the lock card's own.
      if (!card || !after || !t.card) return null;   // unreachable: handled above (keeps the types narrow)
      const own = X.vhpOf(card).m.get(t.signer) ?? 0;
      const moved = t.card.signerVhp != null && t.card.signerVhp > own ? BigInt(Math.round((t.card.signerVhp - own) * 1e8)) : 0n;
      const lockC = withMoved(card, t.signer!, moved), afterC = withMoved(after, t.signer!, moved);
      const { m, top } = X.vhpOf(lockC);
      if (top !== t.card.top || (m.get(t.signer) ?? null) !== t.card.signerVhp) { const x = hold(": its card values read differently now"); if (x) return x; }
      for (const p of t.picks) if (Math.min(X.pointsOf(lockC, p[1], t.signer), X.pointsOf(afterC, p[1], t.signer)) !== p[3]) { const x = hold(`: ${p[0]}'s points recompute differently`); if (x) return x; }
      return null;
    };
    // Repo Lens E4-3: REVERIFY_AT_ONCE targets at a time, within a time budget. Past the budget the week is held and
    // the next run tries again, so a slow node can't push the job past its 30-minute limit. The first hold stops the
    // rest (nothing more needs reading); the hold reported is the first in round order among those read.
    let stop = false;
    const res = await pool(wf.targets, REVERIFY_AT_ONCE, async (t): Promise<Hold | null> => {
      if (stop) return null;
      if (Date.now() > deadline) { stop = true; return { why: OUT_OF_TIME, round: null, passes: true }; }
      let h: Hold | null;
      try { h = await one(t); }
      catch (e) { if (e instanceof OutOfTime) h = { why: OUT_OF_TIME, round: null, passes: true }; else throw e; }
      if (h) stop = true;
      return h;
    });
    return res.find((x) => x != null) ?? null;
  };
  /** BX-72: targets voided for a non-standard VHP transfer can be caused on purpose (about 84 transfers void a week):
   *  each is listed when its week becomes final, for the owner to check in the vault's correction window. */
  const nonCanonicalNotes = (wf: WeekFile) => wf.targets.filter((t) => typeof t.void === "string" && /VHP moved can't be read/.test(t.void))
    .map((t) => `week ${wf.week}: block ${t.height} was voided for a non-standard VHP transfer to ${t.signer ?? "its signer"}; check it in the correction window (who gains if it stands?)`);

  // ── 1–3. targets ──
  // R-BX-25: every game's rounds in the window (the last 3 days), newest first across the games.
  const slots: { G: any; r: number; h: number }[] = [];
  for (const e of SCHED) {
    const G = e.G;
    if (e.from > head.time) continue;   // a game whose weeks haven't started
    let firstRound = Math.max(1, Math.ceil((head.lib - LOOKBACK_BLOCKS - G.OFFSET) / G.ROUND));
    // CARDS=self: only targets whose lock comes at most ~an hour (1,200 blocks) before the first run; earlier ones could
    // never have a card, so they are not part of this recorder's game at all (no "void" rows for days before it ran).
    if (CARDS === "self") firstRound = Math.max(firstRound, Math.ceil((startHeight - 1200 + G.LEAD - G.OFFSET) / G.ROUND));
    const lastRound = Math.floor((head.lib - G.OFFSET) / G.ROUND);
    for (let r = lastRound; r >= firstRound; r--) slots.push({ G, r, h: G.target(r) });
  }
  slots.sort((a, b) => b.h - a.h || b.G.ROUND - a.G.ROUND);
  let n = 0;
  // Newest first, so targets that keep waiting (no card) never crowd out the new ones within a run's budget.
  for (const { G, r, h } of slots) {
    if (n >= MAX_TARGETS_PER_RUN) break;
    if (done.has(`${G.GAME_ID}:${r}`)) continue;
    if (h <= G.LEAD) continue;
    // R-BX-25: a block clearly outside this game's weeks (by its expected time, a day either side) isn't read at all.
    const est = head.time - (head.height - h) * X.BLOCK_MS;
    if (!SCHED.some((e) => e.G === G && est >= e.from - X.DAY && est < e.to + X.DAY)) continue;
    n++;
    const old = h < head.lib - LOOKBACK_BLOCKS + G.ROUND;
    try {
      const b = await blockP(h), lock = await blockP(h - G.LEAD);
      let checked = 1;
      if (blockC) {
        const b2 = await blockC(h), l2 = await blockC(h - G.LEAD);
        if (b2.signer !== b.signer || b2.time !== b.time || l2.time !== lock.time) { problems.push(`block ${h}: the two nodes disagree; not recorded this run`); if (old) voidAt(r, h, b.time, lock.time, "the two nodes disagreed about this block until it left the 3-day window", G); continue; }
        checked = 2;
      }
      // R-BX-25: the block's real time decides the game (game 2 before the switch, hourly game 12 from it).
      if (!inGame(G, b.time)) continue;
      let raw: RawPick[] = [];
      if (picksRead) {
        raw = await picksRead(o.p, r, G.GAME_ID);
        if (o.check) {
          const other = await picksRead(o.check, r, G.GAME_ID);
          const key = (x: RawPick[]) => JSON.stringify([...x].sort((u, v) => (u.player < v.player ? -1 : 1)));
          if (key(raw) !== key(other)) { problems.push(`block ${h}: the two nodes disagree about the picks; not recorded this run`); if (old) voidAt(r, h, b.time, lock.time, "the two nodes disagreed about its picks until it left the 3-day window", G); continue; }
        }
      }
      const card = cardAt(lock.time);
      // Repo Lens E4-1 (a): no race files for the lock's races (e.g. this run's race-data fetch failed) is not "no card":
      // the target waits, and only at the 3-day edge is it voided, with that reason.
      if (!card && raceMissing(lock.time - CARD_MAX_AGE_MS, lock.time)) {
        problems.push(`block ${h}: this run has no race cards for its lock (the race-data files are missing); not recorded this run`);
        if (old) voidAt(r, h, b.time, lock.time, "the race cards for its lock could not be read until it left the 3-day window", G);
        continue;
      }
      // CARDS=self: cards are only ever taken going forward, so a lock more than an hour before the first card will
      // never get one (the recorder wasn't running yet): void now rather than waiting 3 days.
      // Audit BX-48: cards are only made going forward, so 3 hours after the lock none can still appear for it.
      const never = (CARDS === "self" && cards.length > 0 && lock.time < cards[0].at) || head.time > lock.time + CARD_MAX_AGE_MS;
      if (!card && !old && !never) { problems.push(`block ${h}: no handicap card yet for ${new Date(lock.time).toISOString()}; tried again next run`); continue; }
      // Audit BX-35: and the first card after block X; until it exists the target waits (3 hours at most).
      const after = card ? cardAfter(b.time, b.signer) : null;
      const afterNever = head.time > b.time + CARD_MAX_AGE_MS;
      // Repo Lens E4-1 (a): the same for the first card after the block.
      if (card && !after && raceMissing(b.time, b.time + CARD_MAX_AGE_MS)) {
        problems.push(`block ${h}: this run has no race cards for the hours after the block (the race-data files are missing); not recorded this run`);
        if (old) voidAt(r, h, b.time, lock.time, "the race cards after the block could not be read until it left the 3-day window", G);
        continue;
      }
      if (card && !after && !old && !afterNever) { problems.push(`block ${h}: waiting for the first handicap card after the block (scored with the lower of the two); tried again next run`); continue; }
      // Audit BX-4: Staked or Free play is read on both nodes too; a disagreement holds the target like a block's.
      const players = [...new Set(raw.map((x) => x.player))];
      const wk = M.weekOf(b.time);
      const ranked = await rankedRead(players, o.p, wk);
      if (o.check) {
        const other = await rankedRead(players, o.check, wk);
        if (ranked.size !== other.size || [...ranked].some((a) => !other.has(a))) { problems.push(`block ${h}: the two nodes disagree about which players are Staked; not recorded this run`); if (old) voidAt(r, h, b.time, lock.time, "the two nodes disagreed about Staked status until it left the 3-day window", G); continue; }
      }
      // Audit BX-55: a lock card on which the two nodes disagreed about the signer's VHP is never scored: the target
      // waits (the lock card can't change, so it is voided at the usual 3-hour limit).
      const lockFlagged = !!card && flags(card, b.signer);
      if (lockFlagged && !old && !afterNever) { problems.push(`block ${h}: the two nodes disagreed about ${card.topInDoubt === true ? "the top producer's" : b.signer + "'s"} VHP on its lock card; held (voided after 3 hours)`); continue; }
      // Audit BX-53: VHP moved INTO the signer between its lock card and block X (a "flash" stake that neither card
      // sees) counts for the signer on both cards, read on both nodes (the higher of the two), so it can't look small.
      let moved = 0n, nonCanonical = "";
      // (Tests that serve fake blocks with blockOf and no vhpMovesOf have no receipts to read: nothing moved.)
      if (card && after && !lockFlagged && isAddr(b.signer) && (o.vhpMovesOf || !o.blockOf)) {
        // Audit BX-77: from the block the lock card's window ended at, when the card records it.
        const cardH = Number.isInteger(card.height) && card.height > 0 && card.height <= h ? card.height : h - Math.ceil(Math.max(0, b.time - Number(card.at)) / 3000);
        const from = Math.max(1, cardH - MOVE_MARGIN), to = h;
        const read = o.vhpMovesOf ?? ((node: any, who: string, f: number, t: number) => scoringVhpMoves(node, node === o.p ? headId : checkHeadId, VHP, who, f, t));
        // Audit BX-100 (round 6): each node on its own. Only when BOTH report the non-canonical transfer (or the one node,
        // on a one-node run) is the target voided at once; when only one does, the nodes disagree: held, and voided at the
        // 3-day edge like any other disagreement.
        const one = async (node: any): Promise<bigint | NonCanonicalTransfer> => { try { return await read(node, b.signer, from, to); } catch (e) { if (e instanceof NonCanonicalTransfer) return e; throw e; } };
        const mp = await one(o.p), mc = o.check ? await one(o.check) : mp;
        const ncP = mp instanceof NonCanonicalTransfer, ncC = mc instanceof NonCanonicalTransfer;
        if (ncP !== ncC) {
          problems.push(`block ${h}: only one node reports a non-standard VHP transfer to ${b.signer}; not recorded this run`);
          if (old) voidAt(r, h, b.time, lock.time, "the two nodes disagreed about the VHP moved to its signer until it left the 3-day window", G);
          continue;
        }
        if (ncP) {
          nonCanonical = (mp as NonCanonicalTransfer).message.slice(0, 120);
          problems.push(`block ${h}: ${nonCanonical} (on ${o.check ? "both nodes" : "the node"}); the target is void (no points)`);
        } else moved = (mp as bigint) > (mc as bigint) ? (mp as bigint) : (mc as bigint);
        if (moved > 0n) console.log(`block ${h}: ${Number(moved) / 1e8} VHP moved into ${b.signer} between its card and the block; counted on both cards`);
      }
      const lockC = withMoved(card, b.signer, moved), afterC = withMoved(after, b.signer, moved);
      const { m, top } = lockC ? X.vhpOf(lockC) : { m: new Map(), top: 0 };
      const scoring = card && after && !lockFlagged && !nonCanonical ? lockC : null;
      const pointsOf = (producer: string) => (scoring ? Math.min(X.pointsOf(lockC, producer, b.signer), X.pointsOf(afterC, producer, b.signer)) : 0);
      const picks: Pick[] = raw.map((x) => [x.player, x.producer, x.time, pointsOf(x.producer), ranked.has(x.player) ? 1 : 0]);
      const t: Target = {
        round: r, height: h, final: true, checked, signer: isAddr(b.signer) ? b.signer : null, time: b.time, lockTime: lock.time,
        card: scoring ? { at: Number(card.at) || 0, top, signerVhp: m.get(b.signer) ?? null, afterAt: Number(after!.at) || 0 } : null, picks,
      };
      if (!card) t.void = "no handicap card was recorded for this target's lock; no points";
      // (Audit BX-93: the reason says which flag held it.)
      else if (lockFlagged) t.void = card.topInDoubt === true && !(Array.isArray(card.flagged) && card.flagged.includes(b.signer))
        ? "the two nodes disagreed about the VHP of the top producer on the lock's handicap card, so every multiplier on it was in doubt; no points"
        : "the two nodes disagreed about the signer's VHP on the lock's handicap card; no points";
      else if (!after) t.void = "no handicap card was taken within 3 hours after the block; no points";
      else if (nonCanonical) t.void = `${nonCanonical} between its lock card and the block, so the VHP moved can't be read; no points`;
      const wf = weekFor(M.weekOf(b.time));
      wf.targets = wf.targets.filter((x) => x.round !== r).concat([t]).sort((x, y) => x.round - y.round);
      done.add(`${G.GAME_ID}:${r}`);
      console.log(`block ${h}: signed by ${b.signer}, ${picks.length} picks, ${picks.filter((x) => x[3] > 0).length} right, checked on ${checked} node(s)`);
    } catch (e) {
      problems.push(`block ${h}: ${(e as Error).message} (tried again next run)`);
      // Audit BX-16: a target that keeps failing is voided, with its reason, when it reaches the edge of the window, so
      // the week can still become final.
      if (old) voidAt(r, h, 0, 0, `could not be recorded within 3 days: ${String((e as Error).message).slice(0, 120)}`, G);
    }
  }

  // ── 4. leaderboards ──
  const all = new Map(weeks);
  for (const w of known) if (!all.has(w)) all.set(w, loadWeek(PREV, w, GW(w)));
  const rowsOf = (from: number, to: number) => {
    const rows: any[] = [];
    for (const wf of all.values()) for (const t of wf.targets) {
      if (t.time < from || t.time >= to || t.void) continue;
      // Audit BX-33: only pick days inside the period count toward the 3-day prize rule.
      for (const [player, producer, pickTime, pts, ranked] of t.picks) rows.push({ player, height: t.height, time: t.time, pickTime: pickTime >= from && pickTime < to ? pickTime : NaN, correct: pts > 0 && producer === t.signer, pts, ranked: !!ranked });
    }
    return rows;
  };
  // Audit BX-15: a wallet's board for a period is the one its FIRST recorded pick of that period had, so nobody can push
  // a Free play leader onto the Staked board later by sending them 1 VHP.
  const rankedSet = (rows: any[]) => {
    const first = new Map<string, any>();
    for (const x of rows) { const f = first.get(x.player); if (!f || x.height < f.height) first.set(x.player, x); }
    return new Set([...first.values()].filter((x) => x.ranked).map((x) => x.player));
  };
  // Audit BX-14: each row also carries its place on its own board (Staked or Free play), ties included, so the page
  // never ranks a player against the other board.
  const view = (rows: any[]) => {
    const rk = rankedSet(rows), own = new Map<string, number>();
    for (const side of [true, false]) for (const x of X.places(X.board(rows.filter((r: any) => rk.has(r.player) === side)))) own.set(x.player, x.place);
    return X.places(X.board(rows)).map((x: any) => ({ a: x.player, place: x.place, boardPlace: own.get(x.player) || x.place, pts: x.pts, correct: x.correct, picks: x.picks, days: x.days, lastCorrect: x.lastCorrect, ranked: rk.has(x.player) }));
  };
  /** A week's counted play (WEEK_CYCLE.md §2): Monday 00:00 → Saturday 24:00 UTC from Week 1; Sunday's fun rounds are left out. */
  const weekEnd = (w: number) => X.playEnd(w, REST_FROM);
  const weekRowsOf = (w: number) => rowsOf(M.weekStart(w), weekEnd(w));
  const lastRowsOf = weekRowsOf;
  const day0 = Math.floor(head.time / M.DAY) * M.DAY;
  const lw = nowW - 1;
  let lastWeek: any = null;
  let freeze: any = null;
  if (lw >= 0) {
    const rows = weekRowsOf(lw);
    // Final (D-135, WEEK_CYCLE.md §2): no earlier than Monday 00:00 UTC, with every counted target of the week recorded,
    // once two runs at least an hour apart agree (the run before published the same rows for this week, an hour or more
    // ago) and the week-end re-read below passes.
    const wf = all.get(lw);
    // (R-BX-25: rounds are a game's own, so only that game's weeks are searched for the neighbours.)
    const sameGame = new Map([...all].filter(([w]) => GW(w) === GW(lw)));
    const complete = !!wf && wf.targets.length > 0 && targetsCover(wf, M.weekStart(lw), weekEnd(lw), sameGame);
    // (The run before is the last one on Sunday, whose "this week" board is this week's Mon–Sat, or one on Monday.)
    const prevBoard = readJson(PREV, "board.json");
    const pw = prevBoard && [prevBoard.lastWeek, prevBoard.week].find((x: any) => x && x.week === lw && Array.isArray(x.rows));
    const prevAt = prevBoard && typeof prevBoard.updated === "string" ? Date.parse(prevBoard.updated) : NaN;
    const agreed = !!pw && JSON.stringify(pw.rows) === JSON.stringify(view(rows)) && Number.isFinite(prevAt) && head.time - prevAt >= STABLE_MS;
    const ready = head.time >= M.weekStart(nowW) && complete;
    const final = ready && agreed;
    // Prizes: the Free play board's top 2 (picks on 3 days, ties share), only from PRIZES_FROM_WEEK (none until the
    // vault). Player rule (owner, 2026-10-28, every game): staked = at least the vault's minimum staked IN Block X
    // that week (the Staked board, which shares the game's weekly bucket); everyone else is a free player and plays
    // for the 2 + 1 VHP prize. A wallet that was staked here at any point that week can't win the free prize.
    const rk = rankedSet(rows);
    const prizeWeek = PRIZES_FROM !== null && lw >= PRIZES_FROM;
    lastWeek = { week: lw, start: M.weekStart(lw), final, rows: view(rows), prizes: final && prizeWeek ? X.prizes(rows.filter((x) => !rk.has(x.player))) : [] };
    // Audit BX-5: a final week's prizes are written once (P<week>.json) and never recomputed: later runs, and the page,
    // use that file, so a target recorded late can't change a prize list that was already final.
    const frozen = readJson(PREV, pName(lw));
    if (ready && !agreed && !frozen) console.log(`week ${lw}: pending; it goes final once a run at least an hour after this one reads the same week`);
    if (frozen && frozen.v === 1 && frozen.week === lw && frozen.game === VG && Array.isArray(frozen.prizes)) {
      lastWeek.final = true; lastWeek.prizes = frozen.prizes; lastWeek.frozenAt = frozen.at;
    } else if (ready) {
      // (D-135: read again from the first run that can go final, so a difference holds at once; it freezes only once
      // two runs an hour apart agree.)
      // I-042 (BX-88, BX-97, BX-98, G-K-1): before a week's prize list is frozen (and its vault file written), every
      // target of the week is read again from both nodes and compared whole. Any difference holds the week (no prize
      // list, no vault file, an alert); the next run tries again.
      // Repo Lens E4-2: a read that fails during the re-read holds the week; everything else is still published.
      // A hold: why, which round, and whether it passes on its own (a failed read, a timeout, B3-3's two).
      const reread = async (ignore: { round: number; why: string } | null): Promise<Hold | null> => {
        try { return await reverify(wf!, ignore); }
        catch (e) { return { why: `a read failed during the re-read: ${String((e as Error)?.message ?? e).replace(/[\r\n]+/g, " ").slice(0, 200)}`, round: null, passes: true }; }
      };
      let h = await reread(null);
      for (const n of nonCanonicalNotes(wf!)) problems.push(n);
      // Fix-check L-2: the owner may release a hold they have checked, once, by its exact reason (never a passing one).
      // Repo Lens B3-1 / B4-1: the release lets through ONLY that hold (that round, that exact reason): the whole week is
      // read again, that round's other checks included, and it freezes only if nothing else holds (else it stays held,
      // with the new hold's own code).
      const release = o.release === undefined ? E.BLOCKX_RELEASE ?? null : o.release;
      if (h && !h.passes && h.round != null && releaseMatches(release, lw, h.why)) {
        const released = h.why;
        h = await reread({ round: h.round, why: released });
        // Repo Lens #E-18 K-2: "frozen now" only when this run freezes it (two runs an hour apart agreed).
        if (!h) problems.push(agreed
          ? `week ${lw}: RELEASED by BLOCKX_RELEASE although the re-read held it (${released}); the rest of the week read the same, so its prize list is frozen now. Remove BLOCKX_RELEASE`
          : `week ${lw}: released by BLOCKX_RELEASE (${released}); the rest of the week read the same. It freezes on the next run that agrees (an hour or more after the last one): keep BLOCKX_RELEASE until the board shows the week final`);
        // Repo Lens B4-3: say which: something else differs, or this run couldn't finish reading the week.
        else if (h.passes) problems.push(`week ${lw}: BLOCKX_RELEASE matches (${released}), but this run couldn't finish reading the rest of the week; still held (tried again next run)`);
        else problems.push(`week ${lw}: BLOCKX_RELEASE matches (${released}), but the rest of the week doesn't read the same either; still held`);
      }
      const held = h ? h.why : null, passes = !!h?.passes;
      if (held) {
        const code = passes ? "" : ` To release it once after checking it: repository variable BLOCKX_RELEASE = ${lw}:${releaseCode(held)}`;
        const note = `week ${lw}: held before its prize list: ${held}. Nothing is paid until a run reads the whole week the same (tried again next run).${code}`;
        problems.push(note); holds.push(note);
        lastWeek.final = false; lastWeek.prizes = [];
      } else if (agreed) freeze = { v: 1, week: lw, game: VG, at: new Date(head.time).toISOString(), prizes: lastWeek.prizes };
    }
  }
  const board = {
    v: 1, updated: new Date(head.time).toISOString(),
    today: { day: M.dayOf(head.time), rows: view(rowsOf(day0, day0 + M.DAY)) },
    week: { week: nowW, start: M.weekStart(nowW), rows: view(weekRowsOf(nowW)) },
    lastWeek,
    allTime: { rows: view(rowsOf(0, Infinity)) },
  };

  // ── 5. write ──
  fs.mkdirSync(OUT, { recursive: true });
  for (const [w, wf] of weeks) {
    if (!wf.targets.length) continue;
    known.add(w);
    fs.writeFileSync(path.join(OUT, wName(w)), JSON.stringify(wf) + "\n");
  }
  fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify({ v: 1, updated: new Date(head.time).toISOString(), weeks: [...known].sort((a, b) => a - b), contract: contract || null, game: VG, prizesFromWeek: PRIZES_FROM }) + "\n");
  fs.writeFileSync(path.join(OUT, "board.json"), JSON.stringify(board) + "\n");
  if (freeze) fs.writeFileSync(path.join(OUT, pName(freeze.week)), JSON.stringify(freeze) + "\n");
  // The Vault (v6) results file for the week just ended, once final (from the frozen prize list, so it never changes):
  // <OUT>/vault/W<week>.json, read by the hourly bot from games-data:blockx/vault (deployment.json vaultGames["2"]).
  // rows: the Staked board's players the vault counts as staked for the whole week (its lowest stake that week at
  // least the minimum; read on both nodes), with at least 1 point, as 1-255 in board order. A disagreement or a failed
  // read writes no file this run (tried again next run).
  // Audit BX-92 (round 5): the vault takes a week's results only within 3 days of the week's end (the publish job holds a
  // later file with an alert), so past that window no file is written: one warning in the run right after the window
  // closes, then nothing (no red runs every hour until the week rolls).
  const vaultEnd = lastWeek ? M.weekStart(lastWeek.week + 1) + VAULT_WINDOW_MS : 0;
  const vaultMissing = !!lastWeek && lastWeek.final && !(PREV && fs.existsSync(path.join(PREV, "vault", `W${lastWeek.week}.json`)));
  if (vaultMissing && head.time > vaultEnd && head.time <= vaultEnd + 2 * 3600000) problems.push(`vault week ${lastWeek.week}: no results file was published within the vault's 3 days; none is written now (the vault no longer takes it)`);
  if (vaultMissing && head.time <= vaultEnd) {
    try {
      const board = lastWeek.rows.filter((x: any) => x.ranked && x.pts > 0);
      const who = board.map((x: any) => x.a);
      let counted = new Set<string>();
      if (who.length) {
        const a = await weekStakes(who, o.p, lastWeek.week), b = o.check ? await weekStakes(who, o.check, lastWeek.week) : a;
        const pick = (v: { min: bigint; week: Map<string, bigint> } | null) => new Set(v ? who.filter((x: string) => (v.week.get(x) ?? 0n) >= v.min && (v.week.get(x) ?? 0n) > 0n) : []);
        const ca = pick(a), cb = pick(b);
        if (ca.size !== cb.size || [...ca].some((x) => !cb.has(x))) throw new Error("the two nodes disagree about who was staked in Block X that week");
        counted = ca;
      }
      const ranked = X.places(X.board(lastRowsOf(lastWeek.week).filter((x: any) => counted.has(x.player)))).map((x: any) => ({ player: x.player, place: x.place }));
      const vf = vaultFile(VG, lastWeek.week, lastWeek.prizes, vaultPoints(ranked));
      for (const pr of vf.problems) problems.push(pr);
      fs.mkdirSync(path.join(OUT, "vault"), { recursive: true });
      fs.writeFileSync(path.join(OUT, "vault", `W${lastWeek.week}.json`), JSON.stringify(vf.file) + "\n");
    } catch (e) { problems.push(`vault week ${lastWeek.week}: ${(e as Error).message} (tried again next run)`); }
  }
  if (CARDS === "self") fs.writeFileSync(path.join(OUT, "cards.json"), JSON.stringify({ v: 1, updated: new Date(head.time).toISOString(), startHeight, cards }) + "\n");
  for (const pr of problems) console.log(`::${holds.includes(pr) ? "error" : "warning"}::${pr.replace(/[\r\n]+/g, " ").replace(/::/g, ": ")}`);
  return { problems, weeks, board, cards, held: holds };
}

/** Every target whose block time falls in [from, to) is recorded (audit BX-5): the week's rounds run without a gap,
 *  the round right after the last one is recorded and falls at or after the week's end (so no target at the end of
 *  the week is missing), and the round right before the first one is recorded before the week's start (or, for the
 *  game's first week, the first target is within 3 hours of the start). */
export function targetsCover(wf: WeekFile, from: number, to: number, all: Map<number, WeekFile>): boolean {
  const rs = wf.targets.map((t) => t.round).sort((a, b) => a - b);
  for (let i = 1; i < rs.length; i++) if (rs[i] !== rs[i - 1] + 1) return false;
  const find = (r: number) => { for (const w of all.values()) { const t = w.targets.find((x) => x.round === r); if (t) return t; } return null; };
  // D-129: `to` may end before the week does (Saturday 24:00): Sunday's fun rounds after the last counted target don't
  // hold the week up; the round right after that target must be recorded and fall at or after `to`.
  const inside = wf.targets.filter((t) => t.time < to).map((t) => t.round);
  if (!inside.length) return false;
  const after = find(Math.max(...inside) + 1);
  if (!after || after.time < to) return false;
  const before = find(rs[0] - 1);
  if (before) return before.time < from;
  const first = wf.targets.find((t) => t.round === rs[0])!;
  const earlier = [...all.keys()].some((w) => w < wf.week && (all.get(w)?.targets.length ?? 0) > 0);
  return !earlier && first.time - from < 3 * 3600000;
}

// ── the testnet config (testnet/blockx.json), read and checked ──
/** The Vault's file (bot/vault.ts on vault-v6): `rows`, the staked players' points (1-255, board order), and the free
 *  board's 1st and 2nd. From the prize list (X.prizes: ties share, 2+ tied for 1st
 *  cover 2nd too, so 2nd is then empty). The Vault takes at most 10 wallets per place and refuses a whole place with
 *  more; such a place is left empty here (its prize goes back to the pool) and reported. Exported for the tests. */
export const VAULT_MAX_PER_PLACE = 10;
export function vaultFile(game: number, week: number, prizes: { player: string; place: number }[], rows: { player: string; points: number }[] = []) {
  const problems: string[] = [];
  const at = (n: number) => [...new Set(prizes.filter((x) => x.place === n).map((x) => x.player))].sort();
  let first = at(1), second = first.length >= 2 ? [] : prizes.filter((x) => x.place !== 1).map((x) => x.player).filter((a, i, l) => l.indexOf(a) === i).sort();
  if (first.length > VAULT_MAX_PER_PLACE) { problems.push(`vault week ${week}: ${first.length} wallets tied for 1st (the Vault takes at most ${VAULT_MAX_PER_PLACE}); 1st left empty`); first = []; }
  if (second.length > VAULT_MAX_PER_PLACE) { problems.push(`vault week ${week}: ${second.length} wallets tied for 2nd (the Vault takes at most ${VAULT_MAX_PER_PLACE}); 2nd left empty`); second = []; }
  // A wallet is either staked (rows) or free (first/second), never both.
  const staked = new Set(rows.map((x) => x.player));
  first = first.filter((a) => !staked.has(a)); second = second.filter((a) => !staked.has(a));
  return { file: { game, week, final: true, rows, first, second }, problems };
}

/** PRIZES_FROM_WEEK (a repository variable): a plain week number 0-9999, else no prizes at all (fails closed). */
export const prizesFromEnv = (v: string | undefined) => (v && /^[0-9]{1,4}$/.test(v.trim()) ? Number(v.trim()) : null);
export type NetConfig = { v: 1; network: "koinos-foundation-testnet"; chainId: string | null; rpc: string; koin: string; picks: string | null; vhp: string | null; prizesFromWeek: number | null;
  data: string; games: { id: number; name: string; round: number; offset: number; lead: number; ahead: number; picksPerDay: number; maxChanges: number }[] };
export const MAINNET_CHAIN_ID = "EiBZK_GGVP0H_fXVAM3j6EAuz3-B-l3ejxRSewi7qIBfSA==";
export function readNetConfig(file: URL | string = new URL("../../testnet/blockx.json", import.meta.url)): NetConfig {
  const c = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!c || c.v !== 1 || c.network !== "koinos-foundation-testnet" || !Array.isArray(c.games) || !c.games.length) throw new Error("testnet/blockx.json is not a testnet Block X config");
  if (c.chainId === MAINNET_CHAIN_ID) throw new Error("testnet/blockx.json names the MAINNET chain id: refusing");
  for (const g of c.games) X.forGame(g);   // throws on settings the contract would refuse
  return c;
}

async function main() {
  const argv = process.argv.slice(2);
  if (!argv.includes("--testnet")) {
    const RPC = E.RPC || "https://koinos.armana.io";   // audit BX-60: the same default node as the race recorder
    const RPC_CHECK = E.RPC_CHECK && E.RPC_CHECK !== "off" && E.RPC_CHECK !== RPC ? E.RPC_CHECK : "";
    // Audit BX-59: never quietly down to one node on mainnet; ALLOW_ONE_NODE=yes says so out loud.
    if (!RPC_CHECK && E.ALLOW_ONE_NODE !== "yes") throw new Error("no second node (RPC_CHECK is off, missing or the same as RPC): Block X needs two on mainnet. Set RPC_CHECK, or ALLOW_ONE_NODE=yes to run on one node.");
    if (!RPC_CHECK) console.log("::warning::running on ONE node (ALLOW_ONE_NODE=yes): blocks, picks and stakes are not cross-checked");
    // R-BX-25: mainnet runs the schedule (game 2, then hourly game 12 from Mon 16 Nov), vault game 2 throughout.
    const r = await run({ p: new Provider([RPC]), check: RPC_CHECK ? new Provider([RPC_CHECK]) : null, prizesFromWeek: prizesFromEnv(E.PRIZES_FROM_WEEK), schedule: X.MAINNET_SCHEDULE as any, vaultGame: X.VAULT_GAME });
    // Repo Lens E4-7: tell the workflow a week is held; its last job fails the run (an email) after publishing.
    if (r.held.length && E.GITHUB_OUTPUT) fs.appendFileSync(E.GITHUB_OUTPUT, "held=true\n");
    return r;
  }
  // Testnet: one game of the config. Never touches mainnet files: data goes to BLOCKX_OUT (default testnet-data/blockx-<id>).
  const cfg = readNetConfig();
  const i = argv.indexOf("--game"), id = i >= 0 ? Number(argv[i + 1]) : cfg.games[0].id;
  const game = cfg.games.find((g) => g.id === id);
  if (!game) throw new Error(`game ${id} is not in testnet/blockx.json`);
  if (!isAddr(cfg.picks)) throw new Error("testnet/blockx.json has no Picks contract yet (npm run picks -- upload --testnet --send)");
  if (!isAddr(cfg.vhp)) throw new Error("testnet/blockx.json has no testnet VHP contract (vhp); the upload finds it, or set it by hand. The mainnet VHP is never used on the testnet.");
  const rpc = E.TESTNET_RPC || cfg.rpc;
  const p = new Provider([rpc]);
  // The node must be the testnet the config names, never mainnet.
  const chain = await withRetry("chain id", () => p.getChainId());
  if (chain === MAINNET_CHAIN_ID || (cfg.chainId && chain !== cfg.chainId)) throw new Error(`the node at ${rpc} is on chain ${chain}, not the testnet in testnet/blockx.json (${cfg.chainId})`);
  return run({
    p, check: null, game, cards: "self", picksContract: cfg.picks, vhpContract: cfg.vhp!, knodeGame: null,
    prizesFromWeek: cfg.prizesFromWeek, out: E.BLOCKX_OUT || `testnet-data/blockx-${id}`, prev: E.BLOCKX_PREV || `testnet-data/blockx-${id}`,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Audit BX-34: one line, no workflow commands (a node's error text could hold "::").
  // Repo Lens RV-1 (round 12): exit once the work is done, so a node that never answers can't keep the run alive past
  // the job's time limit (its request stays open after withRetry gives up on it).
  main().then(() => process.exit(process.exitCode ?? 0), (e) => { console.error(`error: ${String((e && (e as Error).message) || e).replace(/[\r\n]+/g, " ").replace(/::/g, ": ").slice(0, 500)}`); process.exit(1); });
}
