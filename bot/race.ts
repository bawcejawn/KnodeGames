/**
 * Producer Race recorder (run every hour by .github/workflows/race.yml; read-only on the chain, holds no key).
 *
 * Each run:
 *  1. Handicap cards. A race has 6 legs of 1 hour, and each leg gets a card from every producer's VHP: the starting
 *     card and an update every hour (races recorded before 2026-10-27 have 3 legs of 2 hours and keep them). A leg's
 *     card is taken by the last run before the leg starts (within the hour before), or else by the first run during it.
 *     A leg no run reached keeps the card before it.
 *  2. Results. A race is final once its last block is irreversible and every one of its blocks matches on two
 *     independent nodes (RPC and RPC_CHECK, like the game's results). Until then it stays "checking".
 *     Once the race picks contract is live (race-data/deployment.json on main), each final race also records every
 *     pick (read on both nodes; picks are locked by the chain when a race starts), who picked the winner, and whether
 *     each wallet could be ranked (holds 1 VHP or has a Knode stake) when the race was finalized.
 *  3. Leaderboards (board.json): Today (UTC day), This week, Last week and All time, ranked by points: a pick on the
 *     winner is a win (3 points), a pick on the 2nd or 3rd horse a show (1 point). Ties: more wins, then more picks
 *     placed; wallets still tied share the place (owner, 2026-10-28: the question game no longer breaks Race ties).
 *     Each row says whether the wallet is staked in the Race in the KnodeGames Vault that week (the Staked board) or
 *     plays free (the Free play board).
 *  4. Writes race-data/index.json, race-data/W<week>.json and race-data/board.json, which the publish job puts on the
 *     race-data branch for the website.
 *  5. The KnodeGames Vault's results file for last week, race-data/vault/W<week>.json (see vaultResults below): the
 *     free prize's 1st and 2nd places. Held first (I-034): while the week is being settled the recorder publishes
 *     vault/PENDING-W<week>.json, the file it WOULD make final; the results file goes final only once the week ended at
 *     least VAULT_HOLD_MS (12 h) ago and that pending file has stayed exactly the same for VAULT_STABLE_MS (1 h) across
 *     runs. The owner can hold a week by hand (repo variable RACE_HOLD_WEEKS). A final file is never rewritten.
 * The scoring is race-math.js, the same file the website runs.
 *
 *   RPC, RPC_CHECK ("off" to skip the second node), RACE_PREV (the race-data files from the last run), RACE_OUT,
 *   RACE_HOLD_WEEKS (vault weeks the owner holds, e.g. "3" or "3,4": never final while listed).
 *   npm run race            (or: npx tsx bot/race.ts)
 */
import { Provider } from "koilib";
import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { randomInt } from "node:crypto";
import { Contract } from "koilib";
import { readVhp, MAINNET_VHP, withRetry, sleep } from "../common.ts";
await import("../race-math.js");
const M: any = (globalThis as any).KRaceMath;

const E = process.env;
const RPC = E.RPC || "https://koinos.armana.io";
const RPC_CHECK = E.RPC_CHECK && E.RPC_CHECK !== "off" && E.RPC_CHECK !== RPC ? E.RPC_CHECK : "";
let PREV = E.RACE_PREV || "";
let OUT = E.RACE_OUT || "race-data";
const CARD_AHEAD = 60 * 60000;
// Audit BX-54: how far an irreversible block may trail its head, how far the two nodes' irreversible blocks may differ,
// and how far their head times may differ, before no card is made (Koinos makes a block about every 3 s; irreversible
// trails the head by about 60 blocks).
// Round 4 (audit BX-75): an honest check node may lag (up to LAG_MS behind and LIB_GAP_MAX blocks), but may be at most
// HEAD_GAP_MS AHEAD of the primary, so it can't date a card later than that.
export const LIB_LAG_MAX = 200, LIB_GAP_MAX = 200, HEAD_GAP_MS = 15000, LAG_MS = 10 * 60000;            // a card for the next leg is taken by the last hourly run before it starts
const LOOKBACK = 3 * M.DAY;               // races older than this that never got final are left as they are
const isAddr = (a: unknown) => typeof a === "string" && /^1[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(a);

// ── Handicap VHP that is hard to game (audit BX-3 b; owner 2026-10-28; project doc claude/handicap-anti-gaming.md) ──
// Only looking SMALL on a card pays (a bigger multiplier), so the card errs the other way:
//  1. effective VHP (what block production uses: added VHP counts only after 20 blocks), read on both nodes;
//  2. samples at random moments about every 5 minutes (bot/race.ts --sample, .github/workflows/race-samples.yml);
//     a producer's card VHP is the HIGHEST of its samples over the last 6 hours and the read at card time;
//  3. a producer that signed clearly more blocks in the last ~6 hours than its card share allows (beyond 3 standard
//     deviations of luck) is raised to the share its real production supports.
// These only decide which VHP feeds the card. Each game keeps its own multiplier rule.
export const SAMPLE_WINDOW = 6 * 3600000;          // samples count for 6 hours
export const SAMPLE_KEEP = 8 * 3600000;            // and are kept 8 hours
export const SAMPLE_MAX = 120;            // 8 hours at one sample every ~5 minutes
/** One VHP sample. Audit BX-86 (round 5): `flagged` names the producers the two nodes still disagreed on after the
 *  re-reads (their `vhp` is the LOWER read; `high` keeps the higher one), so a card that uses the sample flags them. */
export type Sample = { at: number; height: number; vhp: Record<string, string>; flagged?: string[]; high?: Record<string, string> };
export type SampleFile = { v: 1; updated: string; samples: Sample[] };
const SAMPLES = "vhp-samples.json";
/** The previous run's samples: only well-formed ones, never from the future (audit BX-38: a sample dated after `now`
 *  plus a minute is dropped, so one bad head time can't block the samples that come after it), newest last. */
export const FUTURE_MS = 60000;
export function loadSamples(now = Date.now()): Sample[] {
  const f = readPrev(SAMPLES);
  if (!f || f.v !== 1 || !Array.isArray(f.samples)) return [];
  return f.samples.filter((x: any) => x && Number.isFinite(x.at) && x.at <= now + FUTURE_MS && Number.isInteger(x.height) && x.vhp && typeof x.vhp === "object"
    && Object.entries(x.vhp).every(([a, v]) => isAddr(a) && typeof v === "string" && /^\d{1,20}$/.test(v as string)) && disputesOk(x)).sort((a: Sample, b: Sample) => a.at - b.at);
}
/** Audit BX-86: a sample's disputes are well formed: both or neither of `flagged` / `high`; every flagged producer is
 *  in the sample, once, with a higher read at least its stored (lower) one. */
export function disputesOk(x: any): boolean {
  if (x.flagged === undefined && x.high === undefined) return true;
  if (!Array.isArray(x.flagged) || !x.flagged.length || !x.high || typeof x.high !== "object" || Array.isArray(x.high)) return false;
  const f: string[] = x.flagged;
  if (new Set(f).size !== f.length || Object.keys(x.high).length !== f.length) return false;
  return f.every((a) => typeof a === "string" && x.vhp[a] !== undefined && typeof x.high[a] === "string" && /^\d{1,20}$/.test(x.high[a]) && BigInt(x.high[a]) >= BigInt(x.vhp[a]));
}
/** Audit BX-37 / BX-55 / BX-73 / BX-74: two nodes' reads of every producer's VHP, combined producer by producer.
 *  Reads within 0.5% of each other count at the higher one. A producer whose reads differ by more is FLAGGED on the
 *  card (Block X holds a target it signs) and counts at the LOWER read when both nodes read at the same block (so one
 *  node can't lift it), or at the HIGHER read when they didn't (a lagging node: VHP that moved between the two blocks
 *  can't make it look small). Round 4 (BX-73): when a flagged producer is, or at its higher read would be, the card's
 *  top, every multiplier on the card is in doubt: `topInDoubt` (not enumerable) is then true, and Block X holds every
 *  target on that card. (BX-74: with same-block reads a producer can't flag itself by moving VHP out and back.)
 *  Returns the combined values and the producers that differed. */
export function combineReads(a: Record<string, string>, b: Record<string, string> | null, who: string[], sameBlock = true): { values: Record<string, string>; differ: string[]; high: Record<string, string> } {
  const values: Record<string, string> = {}, high: Record<string, string> = {};
  if (!b) { for (const x of who) values[x] = String(a[x] || "0"); return { values, differ: [], high }; }
  const differ: string[] = [], hiOf: Record<string, bigint> = {};
  for (const x of who) {
    const u = BigInt(a[x] || "0"), v = BigInt(b[x] || "0"), hi = u > v ? u : v, lo = u < v ? u : v;
    hiOf[x] = hi;
    if (hi - lo > hi / 200n) { differ.push(x); values[x] = String(sameBlock ? lo : hi); high[x] = String(hi); }
    else values[x] = String(hi);
  }
  const top = Object.values(values).reduce((m, v) => (BigInt(v) > m ? BigInt(v) : m), 0n);
  const inDoubt = differ.some((x) => hiOf[x] >= top);
  Object.defineProperty(values, "__topInDoubt", { value: inDoubt, enumerable: false });
  return { values, differ, high };
}
/** Both nodes' VHP reads taken at the same head block (audit BX-74): read the heads, read both in parallel, read the
 *  heads again; tried 3 times. sameBlock is false when the two never matched (a lagging node). */
async function readBoth(p: any, check: any, read: (w: string[]) => Promise<Record<string, string>>, readCheck: (w: string[]) => Promise<Record<string, string>>, who: string[], wait: (ms: number) => Promise<unknown> = sleep) {
  let mine: Record<string, string> = {}, theirs: Record<string, string> = {}, same = false;
  const hOf = async (n: any) => Number((await withRetry("head", () => n.getHeadInfo())).head_topology.height);
  for (let k = 0; k < 3 && !same; k++) {
    if (k) await wait(1500);
    const [a0, b0] = await Promise.all([hOf(p), hOf(check)]);
    [mine, theirs] = await Promise.all([read(who), readCheck(who)]);
    const [a1, b1] = await Promise.all([hOf(p), hOf(check)]);
    same = a0 === b0 && a1 === b1 && a0 === a1;
  }
  return { mine, theirs, same };
}
/** Rule 2: each producer's VHP (1e-8 units) = the highest of `now` (read at card time) and its samples taken in
 *  (t - SAMPLE_WINDOW, t]. Samples after t never count (a card only uses what was known when it was taken). */
export function windowHigh(now: Record<string, string>, samples: Sample[], t: number, supply: bigint | null = null): Record<string, bigint> {
  const out: Record<string, bigint> = {};
  for (const [a, v] of Object.entries(now)) out[a] = BigInt(v || "0");
  // Audit BX-57: a "total supply" below what one producer holds right now is impossible (one node lying): no cap then.
  for (const v of Object.values(out)) if (supply !== null && v > supply) { supply = null; break; }
  for (const smp of samples) {
    if (!(smp.at <= t && smp.at > t - SAMPLE_WINDOW)) continue;
    for (const a of Object.keys(out)) {
      let v = smp.vhp[a] !== undefined ? BigInt(smp.vhp[a]) : -1n;
      if (supply !== null && supply > 0n && v > supply) v = supply;    // audit BX-44: no sample above all the VHP there is
      if (v > out[a]) out[a] = v;
    }
  }
  return out;
}
/** Samples in the window before t (a card made from fewer than MIN_SAMPLES is flagged; audit BX-38). */
export const MIN_SAMPLES = 12;
export const samplesIn = (samples: Sample[], t: number) => samples.filter((x) => x.at <= t && x.at > t - SAMPLE_WINDOW).length;
/** Rule 3: raise a producer whose real block count is far above its card share. counts: blocks each signed out of
 *  `total`. Only raises (never lowers) VHP. Returns the new values and who was raised. */
export function productionFloor(vhp: Record<string, bigint>, counts: Map<string, number>, total: number): { vhp: Record<string, bigint>; raised: string[] } {
  const out = { ...vhp };
  const T0 = Object.values(vhp).reduce((x, y) => x + y, 0n);
  if (T0 <= 0n || total <= 0) return { vhp: out, raised: [] };
  // The least share each producer's production supports (3 standard deviations below what it signed).
  const low = new Map<string, number>();
  for (const a of Object.keys(vhp)) { const n = counts.get(a) || 0; if (n >= 10) { const l = (n - 3 * Math.sqrt(n)) / total; if (l > 0 && l < 1) low.set(a, l); } }
  // Audit BX-43: solve the raises together. With S the raised set, each a in S gets share low[a] of the new total
  // T = (sum of the others) / (1 - sum of low over S). Grow S until nobody outside it is below its floor.
  const S = new Set<string>();
  for (let it = 0; it < 64; it++) {
    const lowSum = [...S].reduce((x, a) => x + low.get(a)!, 0);
    if (lowSum >= 1) break;
    const rest = Object.entries(vhp).filter(([a]) => !S.has(a)).reduce((x, [, v]) => x + Number(v), 0);
    const T = rest / (1 - lowSum);
    const add = [...low.entries()].filter(([a, l]) => !S.has(a) && Number(vhp[a]) < l * T - 1e-9).map(([a]) => a);
    if (!add.length) {
      for (const a of S) { const need = BigInt(Math.ceil(low.get(a)! * T)); if (need > out[a]) out[a] = need; }
      break;
    }
    for (const a of add) S.add(a);
  }
  const raised = [...S].filter((a) => out[a] > vhp[a]);
  return { vhp: out, raised };
}

type Card = { at: number; blocksPerRace: number; c: number; fairness: number[] | null; field: { a: string; vhp: number; k: number; h: number }[]; paddock: { a: string; vhp: number; k: number }[]; samples?: number; flagged?: string[]; topInDoubt?: boolean; height?: number };
type Race = { id: string; start: number; end: number; cards: (Card | null)[]; result: any | null };
type WeekFile = { v: 1; week: number; start: number; end: number; races: Race[] };

// ── the files from the previous run ──
function readPrev(name: string): any {
  if (!PREV) return null;
  const f = path.join(PREV, name);
  try { if (fs.lstatSync(f).isSymbolicLink()) return null; return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; }
}
function emptyWeek(w: number): WeekFile {
  const start = M.weekStart(w), races: Race[] = [];
  for (let t = start; t < start + M.WEEK; t += M.RACE) { const i = M.raceIndex(t); races.push({ id: M.raceId(i), start: M.raceStart(i), end: M.raceStart(i) + M.RACE, cards: new Array(M.LEGS).fill(null), result: null }); }
  return { v: 1, week: w, start, end: start + M.WEEK, races };
}
function loadWeek(w: number): WeekFile {
  const fresh = emptyWeek(w), old = readPrev(`W${String(w).padStart(3, "0")}.json`);
  if (!old || old.v !== 1 || old.week !== w || !Array.isArray(old.races)) return fresh;
  for (const r of fresh.races) {
    const o = old.races.find((x: any) => x && x.id === r.id);
    if (!o) continue;
    // A race keeps the format it started with: 3 two-hour cards (before 2026-10-27) once any was taken, else hourly.
    if (Array.isArray(o.cards) && (o.cards.length === 3 || o.cards.length === 6) && o.cards.some((c: any) => c && Array.isArray(c.field)))
      r.cards = o.cards.map((c: any) => (c && Array.isArray(c.field) ? c : null));
    if (o.result && typeof o.result === "object") r.result = withShows(o.result);
  }
  return fresh;
}
/** Picks recorded before Show existed have 5 fields; add the 6th (show 1/0) from the race's own stored standings. */
function withShows(result: any): any {
  if (!Array.isArray(result?.picks) || !Array.isArray(result.standings)) return result;
  const sh = new Set<string>(M.shows(result.standings));
  return { ...result, picks: result.picks.map((x: any) => (Array.isArray(x) && x.length === 5 ? [...x, x[3] ? 0 : sh.has(x[1]) ? 1 : 0] : x)) };
}

// ── chain reads ──
type Blocks = { hs: number[]; ts: number[]; sig: number[]; signers: string[] };
async function readBlocks(p: any, headId: string, from: number, to: number): Promise<Blocks> {
  const n = to - from + 1, signer: string[] = new Array(n), ts: number[] = new Array(n);
  const queue: [number, number][] = [];
  for (let s = from; s <= to; s += 200) queue.push([s, Math.min(to, s + 199)]);
  const worker = async () => {
    while (queue.length) {
      const [s, e] = queue.shift()!;
      let k = s;
      while (k <= e) {
        const res: any = await withRetry(`blocks at ${k}`, () => p.call("block_store.get_blocks_by_height", { head_block_id: headId, ancestor_start_height: String(k), num_blocks: e - k + 1, return_block: true, return_receipt: false }));
        const items = res?.block_items ?? [];
        if (!items.length) throw new Error(`no blocks returned at ${k}`);
        for (const it of items) {
          const h = Number(it.block_height);
          if (h !== k || h > e) throw new Error(`blocks out of order at ${k}`);
          signer[h - from] = it.block.header.signer; ts[h - from] = Number(it.block.header.timestamp); k++;
        }
      }
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  const idx = new Map<string, number>(), signers: string[] = [], sig: number[] = [];
  for (const a of signer) { let i = idx.get(a); if (i === undefined) { i = signers.length; signers.push(a); idx.set(a, i); } sig.push(i); }
  return { hs: Array.from({ length: n }, (_, i) => from + i), ts, sig, signers };
}
async function blockTime(p: any, headId: string, h: number): Promise<number> {
  const res: any = await withRetry(`block ${h}`, () => p.call("block_store.get_blocks_by_height", { head_block_id: headId, ancestor_start_height: String(h), num_blocks: 1, return_block: true, return_receipt: false }));
  const it = res?.block_items?.[0];
  if (!it || Number(it.block_height) !== h) throw new Error(`block ${h} not returned`);
  return Number(it.block.header.timestamp);
}
/** The first height whose block time is at or after t (binary search between lo and hi). */
async function heightAt(p: any, headId: string, t: number, lo: number, hi: number): Promise<number> {
  while (lo < hi) { const m = Math.floor((lo + hi) / 2); if ((await blockTime(p, headId, m)) < t) lo = m + 1; else hi = m; }
  return lo;
}

/** One pick as recorded: [player, horse, time of the pick (ms)]. */
type Pick = [string, string, number];
type Opts = {
  p: any; check: any | null; prev?: string; out?: string; vhpOf?: (who: string[]) => Promise<Record<string, string>>;
  /** The second node's VHP read (tests). Default: the check node; with vhpOf given and this not, the same as vhpOf. */
  vhpCheckOf?: (who: string[]) => Promise<Record<string, string>>;
  raceContract?: string | null;                                       // the picks contract (default: race-data/deployment.json)
  picksOf?: (node: any, race: number) => Promise<Pick[]>;             // for the tests
  /** Audit BX-89 (round 5): this computer's clock; a card is never dated more than FUTURE_MS after it. The command line
   *  passes Date.now; the offline tests (fake chains in the future) leave it out. */
  clock?: () => number;
  stakedOf?: (node: any, who: string, week: number) => Promise<boolean>;   // staked in the Race in the vault (tests)
  prizesFrom?: number;                                                // the tests' PRIZES_FROM_WEEK
  /** I-034: the hold before a vault file goes final. Production always uses the defaults (VAULT_HOLD_MS after the week,
   *  then VAULT_STABLE_MS unchanged). `false` is for the older offline tests of the file's CONTENT only. */
  vaultHold?: false | { afterEnd: number; stable: number };
  /** Vault weeks the owner holds by hand (default: the RACE_HOLD_WEEKS variable). */
  holdWeeks?: number[];
  /** D-125: the first vault week on the weekly rhythm (no Sunday races; Sunday review; final from Monday 00:00 UTC).
   *  Default M.RHYTHM_FROM_WEEK (3); the tests pass their own. */
  rhythmFrom?: number; typesFrom?: number | null;
};

// ── the picks contract and the game (read only) ──
const RACE_ABI = () => JSON.parse(fs.readFileSync(new URL("../race/abi/race.koilib.json", import.meta.url), "utf8"));
// Repo Lens B1-1 (round 11): the deployed game's ABI, v6 since the upload on 2026-11-02 (the same as
// kpred-v6.koilib.json, which Block X reads; a test checks they match).
const GAME_ABI = () => JSON.parse(fs.readFileSync(new URL("../game/abi/kpred.koilib.json", import.meta.url), "utf8"));
const GAME = (() => { try { return JSON.parse(fs.readFileSync(new URL("../game-data/deployment.json", import.meta.url), "utf8")).contract as string; } catch { return ""; } })();
function defaultRaceContract(): string | null {
  try { const d = JSON.parse(fs.readFileSync(new URL("../race-data/deployment.json", import.meta.url), "utf8")); return isAddr(d.contract) ? d.contract : null; } catch { return null; }
}
/** Every pick for a race, page by page (100 at a time). */
async function readPicks(node: any, contract: string, raceNo: number, type = 0): Promise<Pick[]> {
  const c = new Contract({ id: contract, abi: RACE_ABI(), provider: node });
  const out: Pick[] = [];
  let after: string | undefined;
  for (let page = 0; page < 1000; page++) {
    // D-161: a race type other than 0 (the 6-hour race) is asked for by its type; type 0 is asked exactly as before v2.
    const r: any = await withRetry(`picks for race ${raceNo}${type ? ` (type ${type})` : ""}`, () => (c.functions as any).list_picks({ race: String(raceNo), ...(after ? { start_after: after } : {}), limit: 100, ...(type ? { type } : {}) }));
    const rows = r?.result?.rows ?? [];
    for (const x of rows) if (isAddr(x.player) && isAddr(x.pick?.horse)) out.push([x.player, x.pick.horse, Number(x.pick.at || 0)]);
    if (!rows.length) break;                                    // audit BX-18: page until an empty page
    after = rows[rows.length - 1].player;
  }
  return out;
}
/** Staked in the Race (game 7) in the KnodeGames Vault for week w (owner, 2026-10-28), by the vault's own test, the one
 *  its bot applies to free-prize winners: the week's peak stake in the game (entry.peak_stake, or active_stake when the
 *  player has no entry that week) at least that week's minimum stake. A wallet staked at the start of a week stays
 *  staked that week even if it withdraws. Before the vault (v6) is live nobody is staked; a failed read throws. */
const vaultState = new WeakMap<object, Promise<any>>();
/** Repo Lens B1-5 (round 11): once a node fails a stake read, every other stake read on it fails at once for the rest of
 *  the run (one warning; the vault file isn't final this run; the next hour tries again). So a node that answers the
 *  head but not the vault can't push the hourly run past its time limit and cost that hour's race cards. */
const nodeDown = new WeakMap<object, string>();
const STAKE_TRIES = 2;                                       // about 2 s of retry, not withRetry's default minute
/** Repo Lens RV-2 (round 12) and the Vault chat (3 Nov): get_game_player never reverts for a valid address, so a read
 *  the node ANSWERS with an error means a wrong contract, interface file or arguments. That affects every wallet on
 *  every node, so it stops all stake reads for the run with its own warning (not "a node is down"). Only a failure to
 *  reach the node (timeouts, connection and HTTP errors, an HTML error page) marks just that node down. */
export const isTransportError = (m: string) =>
  /no answer within|fetch failed|ECONN|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|getaddrinfo|socket|network|invalid json|Unexpected token|status code|HTTP|\b50[0-9]\b|terminated|aborted/i.test(m);
let vaultRefused: string | null = null;     // reset at the start of each run
export const NO_V6_ABI = "game/abi/kpred.koilib.json has no get_game_player: Race stakes can't be read";
async function readStaked(node: any, who: string, week: number): Promise<Stand> {
  const abi = GAME_ABI();
  if (!GAME) throw Object.assign(new Error("game-data/deployment.json gives no contract: Race stakes can't be read"), { once: true });
  if (!abi.methods?.get_game_player) throw Object.assign(new Error(NO_V6_ABI), { once: true });
  if (vaultRefused) throw Object.assign(new Error(vaultRefused), { once: true });
  const down = nodeDown.get(node);
  if (down) throw Object.assign(new Error(down), { once: true });
  const c = new Contract({ id: GAME, abi, provider: node });
  try {
    if (!vaultState.has(node)) vaultState.set(node, withRetry("vault state", () => (c.functions as any).get_state({}), STAKE_TRIES));
    const cfg = (await vaultState.get(node))?.result?.config;
    if (!cfg) throw new Error("get_state came back empty");
    // Review V4 (round 10): no early "not v6 yet" answer. On a chain without get_game_player (v5) this read fails, so the
    // vault file can't go final with everyone counted free. Right after the v6 upload, v6_rule_week_plus_one stays 0
    // until v6's first transaction; get_game_player already answers then (no stake, which is true), and
    // stakedFrom / earningFrom keep their own guard.
    const r: any = await withRetry(`Race stake of ${who}`, () => (c.functions as any).get_game_player({ player: who, game: VAULT_GAME, week: String(week) }), STAKE_TRIES);
    return { staked: stakedFrom(cfg, r?.result ?? {}, week), earning: earningFrom(cfg, r?.result ?? {}, week) };
  } catch (e) {
    const why = String((e as Error).message || e).slice(0, 160);
    if (!isTransportError(why)) {
      vaultRefused = `the vault refused a stake read (${why}): check the game contract in game-data/deployment.json and game/abi/kpred.koilib.json. No Race stakes are read this run`;
      throw Object.assign(new Error(vaultRefused), { once: true });
    }
    const m = `the vault's stake reads failed on a node (${why}): Race stakes can't be read this run`;
    nodeDown.set(node, m);
    throw Object.assign(new Error(m), { once: true });
  }
}
/** staked: on the Staked board (peak stake that week at least the minimum: can't win the free prize). earning: this
 *  week's counted stake (week_stake, the lowest) at least the minimum, so the vault takes its points; a wallet staked
 *  but withdrawn below the minimum mid-week is staked and not earning. */
type Stand = { staked: boolean; earning: boolean };
const minFor = (cfg: any, week: number) => {
  const next = BigInt(cfg.min_stake_next || "0");
  return next > 0n && week >= Number(cfg.min_stake_next_week || 0) ? next : BigInt(cfg.min_stake || "0");
};
/** Earning from the Race's bucket that week: the vault's post_results test (week_stake at least the minimum). Exported. */
export function earningFrom(cfg: any, r: any, week: number): boolean {
  if (!(Number(cfg?.v6_rule_week_plus_one || 0) > 0)) return false;
  const min = minFor(cfg, week);
  return min > 0n && BigInt(r?.week_stake || "0") >= min;
}
/** The vault's test, from its config (get_state) and a get_game_player result for the Race and that week. Exported. */
export function stakedFrom(cfg: any, r: any, week: number): boolean {
  if (!(Number(cfg?.v6_rule_week_plus_one || 0) > 0)) return false;
  const min = minFor(cfg, week);
  const peak = r?.entry ? BigInt(r.entry.peak_stake || "0") : BigInt(r?.active_stake || "0");
  return min > 0n && peak >= min;
}
/** One run. Exported for the tests, which pass fake nodes. */
export async function run({ p, check, prev, out, vhpOf, vhpCheckOf, raceContract, picksOf, stakedOf, clock, prizesFrom, vaultHold, holdWeeks, rhythmFrom, typesFrom }: Opts) {
  rhythmFromWeek = rhythmFrom ?? M.RHYTHM_FROM_WEEK;
  typesFromWeek = typesFrom === undefined ? M.TYPES_FROM_WEEK : typesFrom;
  typesAll = new Map(); typesWeekFiles = new Map();
  verifyDeadline = Date.now() + VERIFY_BUDGET_MS;
  vaultRefused = null;
  heldAlerts = [];
  prizesFromWeek = prizesFrom ?? PRIZES_FROM_WEEK;
  hold = vaultHold === undefined ? { afterEnd: VAULT_HOLD_MS, stable: VAULT_STABLE_MS } : vaultHold;
  holdSetting = holdWeeks ? { weeks: holdWeeks, bad: false, raw: holdWeeks.join(",") } : parseHoldWeeks(E.RACE_HOLD_WEEKS);
  pendingOut = null; pendingNew = false; chainCtx = null;
  if (prev !== undefined) PREV = prev;
  if (out !== undefined) OUT = out;
  // Cards: effective VHP (audit BX-3 b). Who is ranked is the vault stake (stakedOf), not a VHP balance.
  const vhpRead = vhpOf || (async (who: string[]) => (await readVhp(p, MAINNET_VHP, who, { effective: true })).values);
  const vhpCheck = !check ? null : vhpCheckOf || vhpOf || (async (who: string[]) => (await readVhp(check, MAINNET_VHP, who, { effective: true })).values);
  const picksContract = raceContract === undefined ? defaultRaceContract() : raceContract;
  const picksRead = picksOf || (picksContract ? (node: any, r: number, type = 0) => readPicks(node, picksContract, r, type) : null);
  const head: any = await withRetry("head", () => p.getHeadInfo());
  const headH = Number(head.head_topology.height), headId = head.head_topology.id, now = Number(head.head_block_time);
  const libH = Number(head.last_irreversible_block), libT = await blockTime(p, headId, libH);
  console.log(`head ${headH} (${new Date(now).toISOString()}), irreversible ${libH} (${new Date(libT).toISOString()})`);

  const wNow = M.weekOf(now), weeks = new Map<number, WeekFile>();
  for (const w of new Set([M.weekOf(now - LOOKBACK), wNow, M.weekOf(now + CARD_AHEAD)])) weeks.set(w, loadWeek(w));
  typesWeekFiles = weeks;
  const raceById = (id: string) => { for (const wf of weeks.values()) { const r = wf.races.find((x) => x.id === id); if (r) return r; } return null; };
  const problems: string[] = [];
  const samples = loadSamples(now);

  // ── 1. cards ──
  const legStart = (t: number) => Math.floor(t / M.LEG) * M.LEG;
  const want: { race: Race; leg: number }[] = [];
  const curLeg = legStart(now), nextLeg = curLeg + M.LEG;
  for (const s of [curLeg, nextLeg]) {
    if (s === nextLeg && s - now > CARD_AHEAD) continue;
    const ra = M.raceAt(s), race = raceById(ra.id);
    // D-125 + Repo Lens #C-7 C7-2: cards are still taken on Sunday. They score nothing in the Race, but Block X scores
    // each target with a Race card up to 3 h after its block (and the card in force at its lock).
    if (!race) continue;
    const leg = M.legOf(ra.start, s, race.cards.length);
    if (!race.cards[leg] && !want.some((x) => x.race === race && x.leg === leg)) want.push({ race, leg });
  }
  let winEnd = libH, cardTime = now, chId: string | null = null, nodesOk = true;
  if (want.length) {
    // Audit BX-36: the block window behind the card (who produces, how often, blocks per race) and the card's time are
    // read on BOTH nodes, ending at the lower irreversible block, and must match exactly; otherwise no card this run.
    nodesOk = headH - libH <= LIB_LAG_MAX;
    if (!nodesOk) problems.push(`the node's irreversible block is ${headH - libH} blocks behind its head (more than ${LIB_LAG_MAX}); no handicap card this run`);
    if (check) {
      const ch: any = await withRetry("check head", () => check.getHeadInfo());
      const chLib = Number(ch.last_irreversible_block), chHead = Number(ch.head_topology.height), chTime = Number(ch.head_block_time);
      // Audit BX-54: neither node may steer the window or the card's time on its own. Both irreversible blocks must be
      // recent (at most LIB_LAG_MAX behind their heads) and within LIB_GAP_MAX of each other, and the two head times
      // within HEAD_GAP_MS; the card is then dated by the later head (never back-dated, and at most HEAD_GAP_MS ahead).
      if (chHead - chLib > LIB_LAG_MAX || Math.abs(libH - chLib) > LIB_GAP_MAX) { nodesOk = false; problems.push(`the two nodes' irreversible blocks (${libH}, ${chLib}) are too far apart or behind (check node head ${chHead}); no handicap card this run`); }
      if (chTime - now > HEAD_GAP_MS || now - chTime > LAG_MS) { nodesOk = false; problems.push(`the check node's head time is ${Math.round((chTime - now) / 1000)} s from the primary's (at most ${HEAD_GAP_MS / 1000} s ahead or ${LAG_MS / 60000} min behind); no handicap card this run`); }
      winEnd = Math.min(libH, chLib);
      cardTime = Math.max(now, chTime);    // never back-dated by one node
      chId = ch.head_topology.id;
    }
    // Audit BX-89 (round 5): nor dated late by a node whose head is ahead of this computer's clock.
    if (clock && cardTime - clock() > FUTURE_MS) { nodesOk = false; problems.push(`a node's head time is ${Math.round((cardTime - clock()) / 1000)} s ahead of this computer's clock (at most ${FUTURE_MS / 1000} s); no handicap card this run`); }
    if (!nodesOk) want.length = 0;
  }
  if (want.length) {
    const recent = await readBlocks(p, headId, Math.max(1, winEnd - 7199), winEnd);       // about the last 6 hours
    let sameWindow = true;
    if (check && chId) {
      const other = await readBlocks(check, chId, Math.max(1, winEnd - 7199), winEnd);
      sameWindow = other.ts.length === recent.ts.length && other.ts.every((t, i) => t === recent.ts[i] && other.signers[other.sig[i]] === recent.signers[recent.sig[i]]);
    }
    if (!sameWindow) problems.push("the two nodes disagree about the last 6 hours of blocks; the handicap card waits for the next run");
    else {
      const span = recent.ts[recent.ts.length - 1] - recent.ts[0];
      const blocksPerRace = span > 0 ? (recent.ts.length - 1) * M.RACE / span : 7200;
      const producers = recent.signers.filter(isAddr);
      // Audit BX-74: both nodes read at the same block when they can (else the higher read of a disagreement counts).
      const both = vhpCheck ? await readBoth(p, check, vhpRead, vhpCheck, [...producers, "network"]) : { mine: await vhpRead([...producers, "network"]), theirs: null, same: true };
      const mine = both.mine, theirs = both.theirs;
      if (vhpCheck && !both.same) problems.push("the two nodes were at different blocks while reading VHP (a lagging node): a producer they disagree on counts at the lower read, flagged");
      // Audit BX-37: producer by producer, never the whole card for one address. Audit BX-99 (round 6): the card, like
      // the samples, always takes the LOWER read of a disagreement ("different blocks" is only each node's own word);
      // the higher read only decides whether the card is in doubt (below).
      const { values, differ: readDiffer, high: readHigh } = combineReads(mine, theirs, producers, true);
      for (const a of readDiffer) problems.push(`the two nodes disagree on ${a}'s VHP now; it is flagged on the card (Block X holds a target it signs)`);
      // Audit BX-86 (round 5): every producer disputed in a sample this card uses is flagged too, with its higher read.
      const sup = (x: Record<string, string> | null) => { const v = x && x.network; return v && /^\d+$/.test(v) ? BigInt(v) : null; };
      // Audit BX-57: the HIGHER of the two nodes' totals (one node reporting "1" can't switch the samples off).
      const supply = [sup(mine), sup(theirs)].filter((x): x is bigint => x !== null).reduce<bigint | null>((m, x) => (m === null || x > m ? x : m), null);
      const capped = (v: bigint) => (supply !== null && supply > 0n && v > supply ? supply : v);   // audit BX-102: never above all the VHP there is
      const hiOf = new Map<string, bigint>();
      for (const a of readDiffer) hiOf.set(a, capped(BigInt(readHigh[a])));
      for (const smp of samples) {
        if (!(smp.at <= cardTime && smp.at > cardTime - SAMPLE_WINDOW) || !smp.flagged) continue;
        for (const a of smp.flagged) if (producers.includes(a)) { const h = capped(BigInt(smp.high![a])); if (!hiOf.has(a) || h > hiOf.get(a)!) hiOf.set(a, h); }
      }
      const differ = [...hiOf.keys()];
      for (const a of differ) if (!readDiffer.includes(a)) problems.push(`the two nodes disagreed on ${a}'s VHP in a sample of the last 6 hours; it is flagged on the card (Block X holds a target it signs)`);
      // Blocks each producer signed in the window (recent.sig: each block's index into recent.signers).
      const counts = new Map<string, number>(); for (const i of recent.sig) { const a = recent.signers[i]; if (isAddr(a)) counts.set(a, (counts.get(a) || 0) + 1); }
      const high = windowHigh(values, samples, cardTime, supply);
      const { vhp: fair, raised } = productionFloor(high, counts, recent.sig.length);
      for (const a of raised) console.log(`card: ${a} signed more blocks than its VHP allows; raised to ${Number(fair[a]) / 1e8} VHP for the card`);
      const used = samplesIn(samples, cardTime);
      const vhp: [string, number][] = producers.map((a) => [a, Number(fair[a] || 0n) / 1e8]);
      // Audit BX-73 / BX-86: the top is in doubt when a disputed producer, at its higher read, would reach the top of
      // the card's FINAL values (after the 6-hour highs and the production floor): every multiplier then depends on it.
      // Audit BX-99 (round 6): and on the production floor, which moves OTHER producers when a disputed one changes.
      // The card is built again with every disputed producer at its higher read (now and in the samples); if the top
      // or any undisputed producer's value differs, every multiplier on the card depends on the dispute: topInDoubt.
      const top = producers.reduce((m, a) => ((fair[a] || 0n) > m ? fair[a] || 0n : m), 0n);
      const valuesHi: Record<string, string> = { ...values };
      for (const a of differ) if (hiOf.get(a)! > BigInt(valuesHi[a] || "0")) valuesHi[a] = String(hiOf.get(a)!);
      const samplesHi = samples.map((smp) => (smp.flagged ? { ...smp, vhp: { ...smp.vhp, ...smp.high } } : smp));
      const fairHi = productionFloor(windowHigh(valuesHi, samplesHi, cardTime, supply), counts, recent.sig.length).vhp;
      const topHi = producers.reduce((m, a) => ((fairHi[a] || 0n) > m ? fairHi[a] || 0n : m), 0n);
      // (Round-6 blind review: compared within 0.5%, the tolerance combineReads uses, so a tiny honest dispute that shifts
      // a floored producer by a few satoshi doesn't hold a whole card.)
      const apart = (u: bigint, v: bigint) => { const hi = u > v ? u : v, lo = u < v ? u : v; return hi - lo > hi / 200n; };
      const moves = producers.filter((a) => !differ.includes(a) && apart(fair[a] || 0n, fairHi[a] || 0n));
      const topInDoubt = differ.length > 0 && (apart(topHi, top) || moves.length > 0 || differ.some((a) => (fair[a] || 0n) >= top));
      if (topInDoubt) problems.push(`a producer the two nodes disagree on decides other producers' multipliers on this card (the top${moves.length ? ", or " + moves.length + " other producer(s) through the production floor" : ""}): the whole card is flagged; Block X holds its targets`);
      // Audit BX-77: the card also records the block its window ends at (Block X reads VHP moves from there).
      const card: Card = { ...M.makeCard(vhp, blocksPerRace, cardTime), samples: used, height: winEnd, ...(differ.length ? { flagged: [...differ].sort() } : {}), ...(topInDoubt ? { topInDoubt: true } : {}) };
      // Audit BX-38: a card made from too few samples is published but flagged; Block X doesn't score with it.
      // Audit BX-58: the Producer Race still runs on such a card (its picks were made against it), and says so on the
      // card (`samples`, shown on the race page); Block X never scores with it.
      if (used < MIN_SAMPLES) problems.push(`handicap card from only ${used} VHP sample(s) in the last 6 hours (want ${MIN_SAMPLES}); the race uses it as is (its card shows the sample count); Block X waits for a card with enough samples`);
      console.log(`card VHP: effective, highest of ${used} sample(s) in the last 6 hours and the read now`);
      for (const { race, leg } of want) {
        // Audit BX-76: a card never carries a time at or after the end of its leg (a late run, a node a little ahead).
        const legEnd = race.start + (leg + 1) * Math.round((race.end - race.start) / race.cards.length);
        race.cards[leg] = card.at >= legEnd ? { ...card, at: legEnd - 1 } : card;
        console.log(`card for ${race.id} leg ${leg + 1}: ${card.field.length} horses, c = ${card.c}${check ? ", blocks and VHP checked on 2 nodes" : ""}`);
      }
    }
  }

  // ── 2. results ──
  chainCtx = { p, check, headId, libH, libT, picksRead };
  // Races before the recorder's first card were never run; only a race after it with no card at all is "missed".
  let firstCard = Infinity;
  for (const wf of weeks.values()) for (const r of wf.races) if (r.cards.some(Boolean)) firstCard = Math.min(firstCard, r.start);
  for (const wf of weeks.values()) for (const race of wf.races) {
    if (race.result?.final || race.end > libT || race.end < now - LOOKBACK) continue;
    if (!race.cards.some(Boolean)) { if (race.start > firstCard) race.result = { final: true, missed: true, note: "no handicap card was recorded for this race" }; continue; }
    try {
      const r = await scoreRace(race, chainCtx);
      if (!r.ok) { problems.push(`${race.id}: ${r.why}; not final this run`); continue; }
      race.result = r.result;
      console.log(`${race.id}: final, winner ${race.result.winner} (${race.result.standings[0]?.steps} steps), blocks ${race.result.heights[0]}-${race.result.heights[1]}, checked on ${race.result.checked} node(s)`);
    } catch (e) { problems.push(`${race.id}: ${(e as Error).message} (tried again next run)`); }
    await sleep(200);
  }

  // ── 2b. race types (D-161): the hour ledger, then the 1-hour, 2-hour, daily and weekly races scored from it ──
  for (const wf of weeks.values()) {
    if (!typesOn(wf.week)) continue;
    const tf = loadTypes(wf.week);
    typesAll.set(wf.week, tf);
    await recordTypes(tf, raceById, problems, now);
  }

  // ── 3. leaderboards ──
  const stakedRead = stakedOf || readStaked;
  const { board, vault } = await leaderboards(weeks, now, problems,
    (who, week) => stakedRead(p, who, week), check ? (who, week) => stakedRead(check, who, week) : null);

  // ── 4. write ──
  fs.mkdirSync(OUT, { recursive: true });
  const idx = readPrev("index.json"), known = new Set<number>(Array.isArray(idx?.weeks) ? idx.weeks.filter((w: any) => Number.isInteger(w) && w >= 0 && w < 10000) : []);
  for (const [w, wf] of weeks) {
    if (!wf.races.some((r) => r.cards.some(Boolean) || r.result)) continue;
    known.add(w);
    fs.writeFileSync(path.join(OUT, `W${String(w).padStart(3, "0")}.json`), JSON.stringify(wf) + "\n");
  }
  for (const [w, tf] of typesAll) if (weeks.has(w) && (tf.hours.length || tf.races.some((r) => r.result))) fs.writeFileSync(path.join(OUT, `T${String(w).padStart(3, "0")}.json`), JSON.stringify(tf) + "\n");
  fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify({ v: 1, updated: new Date(now).toISOString(), weeks: [...known].sort((x, y) => x - y) }) + "\n");
  if (board) fs.writeFileSync(path.join(OUT, "board.json"), JSON.stringify(board) + "\n");
  // #85 merge check L-1: a NEW pending file is dated at the end of the run (the head block's time now), not its start,
  // so a slow run (stake reads with retries) still fits the publish job's 35-minute window. Later is only ever safer:
  // the hour's wait counts from this time. If the head can't be read, the start-of-run time stays.
  if (pendingOut && pendingNew) {
    try { const h: any = await p.getHeadInfo(); const t = Number(h?.head_block_time); if (Number.isSafeInteger(t) && t > pendingOut.at) pendingOut.at = t; } catch { /* keep the start time */ }
  }
  if (vault || pendingOut) fs.mkdirSync(path.join(OUT, "vault"), { recursive: true });
  if (vault) fs.writeFileSync(path.join(OUT, "vault", `W${vault.week}.json`), JSON.stringify(vault) + "\n");
  if (pendingOut) fs.writeFileSync(path.join(OUT, "vault", `PENDING-W${pendingOut.week}.json`), JSON.stringify(pendingOut) + "\n");
  const hn = holdNote(holdSetting);
  if (hn) problems.unshift(hn);
  for (const pr of problems) console.log(`::warning::${cmdText(pr)}`);
  // D-107 (R-RACE-13, I-087): a held paid week fails the run AFTER publishing (the alert job), so GitHub emails the
  // owner. The recorder only says so; the workflow's last job does the failing.
  for (const a of heldAlerts) console.log(`::error::${cmdText(a)}`);
  if (heldAlerts.length && E.GITHUB_OUTPUT) fs.appendFileSync(E.GITHUB_OUTPUT, "held=true\n");
  // Repo Lens #E-11 L-2: tell the publish job files were written, so a lost hand-over between the jobs fails the run.
  if (E.GITHUB_OUTPUT) fs.appendFileSync(E.GITHUB_OUTPUT, "files=true\n");
  return { problems, held: heldAlerts.slice() };
}

// ── race types (D-161, owner 5 Nov 2026; Race contract v2): T<week>.json ──
// The 1-hour, 2-hour, daily and weekly races beside the 6-hour race. Their own file, so W<week>.json (which Block X and
// the 6-hour pages read) never changes. It holds:
// - hours: the hour ledger. For each UTC hour of the week, once it is irreversible: the blocks' heights [a, b], each
//   producer's block count (n) and last block time (l), read on both nodes; and c, each type's luck trim for that hour
//   (tuned once from that hour's 6-hour card, the same VHP reading; M.typeCard rebuilds the card from it).
// - races: every race of types 1-4 that starts in the week (168 + 84 + 7 + 1), each scored from the ledger once its
//   last hour is in it, with its picks (list_picks with its type) read on both nodes.
type Hour = { t: number; a: number; b: number; n: Record<string, number>; l: Record<string, number>; c: number[] };
type Typed = { type: number; id: string; start: number; end: number; result: any | null };
type TypesFile = { v: 1; week: number; start: number; end: number; hours: Hour[]; races: Typed[] };
let typesFromWeek: number | null = M.TYPES_FROM_WEEK;
let typesAll = new Map<number, TypesFile>();
const typesOn = (w: number) => typesFromWeek !== null && w >= typesFromWeek;
/** Ledger hours read per run at most (a catch-up after an outage spreads over a few runs). Exported for the tests. */
export const HOURS_PER_RUN = 24;
export function emptyTypes(w: number): TypesFile {
  const start = M.weekStart(w), end = start + M.WEEK, races: Typed[] = [];
  for (const type of [1, 2, 3, 4]) for (const r of M.typedRacesIn(type, start, end)) races.push({ type, id: r.id, start: r.start, end: r.end, result: null });
  return { v: 1, week: w, start, end, hours: [], races };
}
const isCount = (x: any) => Number.isSafeInteger(x) && x >= 0;
function hourOk(h: any, start: number, end: number): h is Hour {
  return h && Number.isSafeInteger(h.t) && h.t >= start && h.t < end && h.t % M.HOUR === 0 && Number.isSafeInteger(h.a) && Number.isSafeInteger(h.b) && h.b >= h.a - 1
    && h.n && typeof h.n === "object" && Object.entries(h.n).every(([a, v]) => isAddr(a) && isCount(v))
    && h.l && typeof h.l === "object" && Object.keys(h.l).every((a) => a in h.n && Number.isSafeInteger(h.l[a]))
    && Array.isArray(h.c) && h.c.length === 4 && h.c.every((x: any) => Number.isFinite(x) && x >= 0);
}
function loadTypes(w: number): TypesFile {
  const fresh = emptyTypes(w), old = readPrev(`T${String(w).padStart(3, "0")}.json`);
  if (!old || old.v !== 1 || old.week !== w) return fresh;
  if (Array.isArray(old.hours)) {
    const seen = new Set<number>();
    for (const h of old.hours) if (hourOk(h, fresh.start, fresh.end) && !seen.has(h.t)) { seen.add(h.t); fresh.hours.push(h); }
    fresh.hours.sort((x, y) => x.t - y.t);
  }
  if (Array.isArray(old.races)) for (const r of fresh.races) {
    const o = old.races.find((x: any) => x && x.id === r.id && x.type === r.type);
    if (o && o.result && typeof o.result === "object") r.result = o.result;
  }
  return fresh;
}
/** The 6-hour card in force in the hour starting at t (that hour's leg card, as the 6-hour race uses it). */
function baseCard(raceById: (id: string) => Race | null, t: number): Card | null {
  const race = raceById(M.raceAt(t).id);
  if (!race) return null;
  return M.cardForLeg(race.cards, M.legOf(race.start, t, M.legsOf(race.cards)));
}
/** The heights of the blocks in [start, end): the same search as a 6-hour race's (scoreRace). */
async function heightsOf(c: ChainCtx, start: number, end: number): Promise<[number, number]> {
  const { p, headId, libH, libT } = c;
  const est = Math.ceil((libT - start) / 3000) + 600;
  let lo = Math.max(1, libH - est);
  while (lo > 1 && (await blockTime(p, headId, lo)) >= start) lo = Math.max(1, lo - est);
  const a = await heightAt(p, headId, start, lo, libH), b = (await heightAt(p, headId, end, a, libH)) - 1;
  return [a, b];
}
/** One ledger hour from the chain: read on the main node, compared block by block on the second. */
async function readHour(c: ChainCtx, t: number, hint?: [number, number]): Promise<{ ok: true; hour: Omit<Hour, "c"> } | { ok: false; why: string }> {
  let a = -1, b = -1;
  if (hint && hint[0] > 1 && hint[1] >= hint[0] - 1 && hint[1] + 1 <= c.libH) {
    const [ha, hb] = hint;
    if ((await blockTime(c.p, c.headId, ha - 1)) < t && (await blockTime(c.p, c.headId, ha)) >= t
      && (hb < ha || (await blockTime(c.p, c.headId, hb)) < t + M.HOUR) && (await blockTime(c.p, c.headId, hb + 1)) >= t + M.HOUR) { a = ha; b = hb; }
  }
  if (a < 0) [a, b] = await heightsOf(c, t, t + M.HOUR);
  const B = b >= a ? await readBlocks(c.p, c.headId, a, b) : { hs: [], ts: [], sig: [], signers: [] };
  if (c.check && b >= a) {
    const ch: any = await withRetry("check head", () => c.check.getHeadInfo());
    const C = await readBlocks(c.check, ch.head_topology.id, a, b);
    const same = C.ts.length === B.ts.length && C.ts.every((x, i) => x === B.ts[i] && C.signers[C.sig[i]] === B.signers[B.sig[i]]);
    if (!same) return { ok: false, why: "the two nodes disagree about the hour's blocks" };
  }
  const n: Record<string, number> = {}, l: Record<string, number> = {};
  for (let i = 0; i < B.ts.length; i++) { const who = B.signers[B.sig[i]]; n[who] = (n[who] || 0) + 1; l[who] = Math.max(l[who] || 0, B.ts[i]); }
  return { ok: true, hour: { t, a, b, n, l } };
}
/** A typed race's card for the hour starting at h (null without that hour's ledger entry or 6-hour card). */
function typedCardAt(raceById: (id: string) => Race | null, led: Map<number, Hour>, type: number) {
  return (h: number) => { const x = led.get(h), base = baseCard(raceById, h); return x && base ? M.typeCard(base, type, x.c[type - 1]) : null; };
}
/** A typed race scored from the ledger, with its picks read on both nodes. null: not every hour is in yet. */
async function scoreTyped(r: Typed, led: Map<number, Hour>, cardAt: (h: number) => any, c: ChainCtx): Promise<{ ok: true; result: any } | { ok: false; why: string } | null> {
  const st = M.ledgerStandings(led, r, cardAt);
  if (!st) return null;
  const winner = M.winners(st)[0] || null, showSet = new Set<string>(M.shows(st));
  let picks: any[] | undefined;
  if (c.picksRead) {
    const raceNo = M.typedIndex(r.type, r.start), mine = await c.picksRead(c.p, raceNo, r.type);
    if (c.check) {
      const theirs = await c.picksRead(c.check, raceNo, r.type);
      const key = (x: Pick[]) => JSON.stringify([...x].sort((u, v) => (u[0] < v[0] ? -1 : 1)));
      if (key(mine) !== key(theirs)) return { ok: false, why: "the two nodes disagree about the race's picks" };
    }
    picks = mine.map(([who, horse, at]) => [who, horse, at, horse === winner ? 1 : 0, 0, horse !== winner && showSet.has(horse) ? 1 : 0]);
  }
  return { ok: true, result: { final: true, checked: c.check ? 2 : 1, line: M.ledgerLine(r, cardAt), winner, standings: st.map((x: any) => ({ a: x.a, steps: x.steps, blocks: x.blocks })), ...(picks ? { picks } : {}) } };
}
async function recordTypes(tf: TypesFile, raceById: (id: string) => Race | null, problems: string[], now: number) {
  const c = chainCtx!;
  const led = new Map(tf.hours.map((h) => [h.t, h]));
  let budget = HOURS_PER_RUN;
  for (let t = tf.start; t + M.HOUR <= Math.min(tf.end, c.libT) && budget > 0; t += M.HOUR) {
    if (led.has(t)) continue;
    const base = baseCard(raceById, t);
    if (!base) continue;                                    // no 6-hour card: that hour's typed races are missed (below)
    try {
      const r = await readHour(c, t);
      if (!r.ok) { problems.push(`hour ${new Date(t).toISOString().slice(0, 13)}: ${r.why}; not in the ledger this run`); continue; }
      led.set(t, { ...r.hour, c: [1, 2, 3, 4].map((type) => M.typeCard(base, type).c) });
      budget--;
    } catch (e) { problems.push(`hour ${new Date(t).toISOString().slice(0, 13)}: ${(e as Error).message} (tried again next run)`); break; }
  }
  tf.hours = [...led.values()].sort((x, y) => x.t - y.t);
  for (const r of tf.races) {
    if (r.result?.final || r.end > c.libT) continue;
    // An hour with no 6-hour card at all can never be scored (cards are taken live): the race is missed.
    let noCard = false;
    for (let h = r.start; h < r.end; h += M.HOUR) if (!baseCard(raceById, h)) { noCard = true; break; }
    if (noCard) { r.result = { final: true, missed: true, note: "an hour of this race has no handicap card" }; continue; }
    try {
      const res = await scoreTyped(r, led, typedCardAt(raceById, led, r.type), c);
      if (!res) continue;                                   // an hour isn't in the ledger yet
      if (!res.ok) { problems.push(`${r.id}: ${res.why}; not final this run`); continue; }
      r.result = res.result;
    } catch (e) { problems.push(`${r.id}: ${(e as Error).message} (tried again next run)`); }
  }
}
/** Repo Lens #E-11 H-1 (b) for the race types: every ledger hour is read again on both nodes and must match, and every
 *  final typed race of the week (not Sunday's) is scored again from it, with its picks read again. */
export async function verifyTypes(tf: TypesFile, c: ChainCtx, stop: number, clock: () => number = Date.now, raceById?: (id: string) => Race | null): Promise<string> {
  const fresh = new Map<number, Hour>();
  const hours = tf.hours.filter((h) => tf.races.some((r) => r.result?.final && !r.result.missed && forWeek(r) && h.t >= r.start && h.t < r.end));
  for (let i = 0; i < hours.length; i += VERIFY_PARALLEL) {
    if (clock() > stop) throw new Error(`not checked yet: the re-check ran past its time budget (tried again next run)`);
    const got = await Promise.all(hours.slice(i, i + VERIFY_PARALLEL).map((h) => readHour(c, h.t, [h.a, h.b])));
    for (let k = 0; k < got.length; k++) {
      const g = got[k], h = hours[i + k];
      if (!g.ok) return `hour ${new Date(h.t).toISOString().slice(0, 13)}: ${g.why} when checking the week again`;
      if (JSON.stringify([g.hour.a, g.hour.b, g.hour.n, g.hour.l]) !== JSON.stringify([h.a, h.b, h.n, h.l])) return `hour ${new Date(h.t).toISOString().slice(0, 13)}: its stored blocks aren't what the chain says now`;
      fresh.set(h.t, { ...g.hour, c: h.c });
    }
  }
  const races = tf.races.filter((r) => r.result?.final && !r.result.missed && forWeek(r));
  const byId = new Map<string, Race>();
  for (const wf of [...typesWeekFiles.values()]) for (const r of wf.races) byId.set(r.id, r);
  const find = raceById || ((id: string) => byId.get(id) || null);
  for (const r of races) {
    if (clock() > stop) throw new Error(`not checked yet: the re-check ran past its time budget (tried again next run)`);
    const res = await scoreTyped(r, fresh, typedCardAt(find, fresh, r.type), c);
    if (!res) return `${r.id}: an hour of it is missing when checking the week again`;
    if (!res.ok) return `${r.id}: ${res.why} when checking the week again`;
    if (resultKey(res.result) !== resultKey(r.result)) return `${r.id}: its stored result isn't what the chain says now (picks or standings differ)`;
  }
  return "";
}
/** The 6-hour week files the typed races' cards come from (set by run(); the re-check reads cards from them). */
let typesWeekFiles = new Map<number, WeekFile>();

// ── one race's result from the chain (used to record it, and again before a paid week goes final: Repo Lens #E-11 H-1) ──
type ChainCtx = { p: any; check: any | null; headId: string; libH: number; libT: number; picksRead: ((node: any, r: number, type?: number) => Promise<Pick[]>) | null };
let chainCtx: ChainCtx | null = null;
/** Reads a finished race's blocks (and picks) on both nodes and scores it. `ok: false` with the reason when the two
 *  nodes disagree; throws on a read failure. */
async function scoreRace(race: Race, c: ChainCtx, hint?: [number, number]): Promise<{ ok: true; result: any } | { ok: false; why: string }> {
  const { p, check, headId, libH, libT, picksRead } = c;
  // Repo Lens #C-7 C7-1: a stored result's heights [a, b] are confirmed with 4 block reads (the block before a is
  // before the start, a is at or after it; b is before the end, b + 1 at or after it). Only if that fails: the search.
  let a = -1, b = -1;
  if (hint && Number.isSafeInteger(hint[0]) && Number.isSafeInteger(hint[1]) && hint[0] > 1 && hint[1] >= hint[0] && hint[1] + 1 <= libH) {
    const [ha, hb] = hint;
    if ((await blockTime(p, headId, ha - 1)) < race.start && (await blockTime(p, headId, ha)) >= race.start
      && (await blockTime(p, headId, hb)) < race.end && (await blockTime(p, headId, hb + 1)) >= race.end) { a = ha; b = hb; }
  }
  if (a < 0) {
    // A height safely before the race start (blocks average 3 s apart; step further back until it is before).
    const est = Math.ceil((libT - race.start) / 3000) + 600;
    let lo = Math.max(1, libH - est);
    while (lo > 1 && (await blockTime(p, headId, lo)) >= race.start) lo = Math.max(1, lo - est);
    a = await heightAt(p, headId, race.start, lo, libH); b = (await heightAt(p, headId, race.end, a, libH)) - 1;
  }
  const B = await readBlocks(p, headId, a, b);
  let checked = 1;
  if (check) {
    const ch: any = await withRetry("check head", () => check.getHeadInfo());
    const C = await readBlocks(check, ch.head_topology.id, a, b);
    const same = C.ts.length === B.ts.length && C.ts.every((t, i) => t === B.ts[i] && C.signers[C.sig[i]] === B.signers[B.sig[i]]);
    if (!same) return { ok: false, why: "the two nodes disagree about the race's blocks" };
    checked = 2;
  }
  const st = M.standings(B, race, race.cards);
  const winner = M.winners(st)[0] || null, showSet = new Set<string>(M.shows(st));
  // The picks (locked by the chain since the race started), read on both nodes like the blocks.
  let picks: any[] | undefined;
  if (picksRead) {
    const raceNo = M.raceIndex(race.start);
    const mine = await picksRead(p, raceNo);
    if (check) {
      const theirs = await picksRead(check, raceNo);
      const key = (x: Pick[]) => JSON.stringify([...x].sort((u, v) => (u[0] < v[0] ? -1 : 1)));
      if (key(mine) !== key(theirs)) return { ok: false, why: "the two nodes disagree about the race's picks" };
    }
    // [player, horse, time, won (1/0), 0, show: 2nd or 3rd (1/0)]. The 5th field was "may be ranked" (1 VHP or a
    // question-game stake) until 2026-10-28; the Staked / Free play split now comes from the vault, so it is no longer
    // read (a race's result depends only on its blocks and picks) and is always 0.
    picks = mine.map(([who, horse, at]) => [who, horse, at, horse === winner ? 1 : 0, 0, horse !== winner && showSet.has(horse) ? 1 : 0]);
  }
  return { ok: true, result: {
    final: true, checked, heights: [a, b], blocks: B.ts.length, line: M.finishLine(race.cards),
    winner, standings: st.map((x: any) => ({ a: x.a, steps: x.steps, blocks: x.blocks })),
    ...(picks ? { picks } : {}),
  } };
}
/** A stored result as the chain decides it: everything but how many nodes checked it. */
const resultKey = (r: any) => { const { checked, ...rest } = r || {}; return JSON.stringify(rest); };
/** Repo Lens #E-11 H-1 (b): before a paid week's vault file goes final, every final race of the week is scored again
 *  from the chain on both nodes and must equal the stored result. Returns "" when all agree, otherwise why not. A
 *  read failure throws (the caller waits: not final this run). */
/** Repo Lens #C-7 C7-1: how long one re-check of a week may take inside the 30-minute record job. Running out is "not
 *  checked yet" (the week waits, and alerts once it's late), never a mismatch. */
export const VERIFY_BUDGET_MS = 10 * 60000;
/** Repo Lens #C-7 fix-check F-1: one deadline per recorder run, shared by every re-check in it (a late week and a new
 *  pending one), so the run as a whole stays inside the 30-minute job. Set at the start of run(). */
let verifyDeadline = Infinity;
/** Races re-checked at once (F-1): each race's reads are sequential, so a few in parallel keep a slow node inside the
 *  budget without trusting any earlier run's "already checked" note. */
export const VERIFY_PARALLEL = 4;
export async function verifyWeek(wf: WeekFile, c: ChainCtx | null, budgetMs?: number, clock: () => number = Date.now): Promise<string> {
  if (!c) return "the chain isn't available to check the week's races";
  const stop = budgetMs === undefined ? verifyDeadline : clock() + budgetMs;
  const tf = typesAll.get(wf.week);
  if (tf) { const t = await verifyTypes(tf, c, stop, clock); if (t) return t; }
  // D-129: Sunday races count for no week, so they aren't checked for its payout.
  const todo = wf.races.filter((race) => race.result?.final && !race.result.missed && forWeek(race));
  const why: string[] = new Array(todo.length).fill("");
  for (let i = 0; i < todo.length; i += VERIFY_PARALLEL) {
    if (clock() > stop) throw new Error(`not checked yet: the re-check ran past its time budget (tried again next run)`);
    await Promise.all(todo.slice(i, i + VERIFY_PARALLEL).map(async (race, k) => {
      const h = race.result.heights;
      const r = await scoreRace(race, c, Array.isArray(h) && h.length === 2 ? [Number(h[0]), Number(h[1])] : undefined);
      why[i + k] = !r.ok ? `${race.id}: ${r.why} when checking the week again`
        : resultKey(r.result) !== resultKey(race.result) ? `${race.id}: its stored result isn't what the chain says now (picks or standings differ)` : "";
    }));
    const first = why.slice(i, i + VERIFY_PARALLEL).find(Boolean);
    if (first) return first;
    await sleep(100);
  }
  return "";
}

// ── leaderboards ──
/** correct = wins (picks on the winner), shows = picks on the 2nd or 3rd horse, pts = 3 per win + 1 per show. */
/** ranked: on the Staked board, i.e. staked in the Race in the vault that week (owner, 2026-10-28; before then it meant
 *  "holds 1 VHP or a question-game stake"). boardPlace: the place on its own board (Staked or Free play), tied wallets
 *  sharing it (1, 1, 3, …), which the site shows (board.js). */
/** reached: when the wallet reached its score (its last scoring pick's time). tb: 1 for wallets of a tied group that
 *  come after its last paid wallet (cutLine), so they take the next place. Neither is published. */
type Row = { a: string; pts: number; correct: number; shows: number; picks: number; ranked: boolean; boardPlace?: number; earns?: number; earning?: boolean; reached?: number; tb?: number };
/** Sort: points, then more wins, then more picks placed; within a tie, the wallet that reached its score first (owner,
 *  5 Nov, D-152), then the address. Exported. */
export function rank(rows: Row[]): Row[] {
  const at = (r: Row) => r.reached ?? Infinity;
  return [...rows].sort((x, y) => y.pts - x.pts || y.correct - x.correct || y.picks - x.picks || (at(x) < at(y) ? -1 : at(x) > at(y) ? 1 : 0) || (x.a < y.a ? -1 : 1));
}
/** The picks of final races in [from, to): per wallet, wins, shows and picks placed. */
/** D-129 (owner, 4 Nov): Sunday races on the rhythm are played and scored for fun: they count on the Today and All
 *  time boards (a wallet's career), never on a week's board, its medals, prizes or vault file. */
const forWeek = (r: Race) => !M.restRace(r.start, rhythmFromWeek);
function tally(weeks: Map<number, WeekFile>, from: number, to: number, weekly = false) {
  const t = new Map<string, { pts: number; correct: number; shows: number; picks: number; reached?: number }>();
  // D-161: the 6-hour races, then the race types (their own points), all on the one board.
  const races: { start: number; result: any; type: number }[] = [];
  for (const wf of weeks.values()) for (const r of wf.races) races.push({ start: r.start, result: r.result, type: 0 });
  for (const tf of typesAll.values()) for (const r of tf.races) races.push({ start: r.start, result: r.result, type: r.type });
  for (const r of races) {
    if (r.start < from || r.start >= to || !r.result?.final || !Array.isArray(r.result.picks)) continue;
    if (weekly && !forWeek(r)) continue;
    const P = M.pointsOf(r.type);
    for (const [who, , at, right, , show] of r.result.picks) {
      const x = t.get(who) || { pts: 0, correct: 0, shows: 0, picks: 0 };
      x.picks++; x.correct += right ? 1 : 0; x.shows += !right && show ? 1 : 0; x.pts += right ? P.win : show ? P.show : 0;
      // D-152: when the wallet reached its score = its latest scoring pick (a win or a show).
      if ((right || show) && (x.reached === undefined || Number(at) > x.reached)) x.reached = Number(at);
      t.set(who, x);
    }
  }
  return t;
}
type StakedOf = (who: string, week: number) => Promise<boolean | Stand>;
const standOf = (v: boolean | Stand): Stand => (typeof v === "boolean" ? { staked: v, earning: v } : { staked: !!v?.staked, earning: !!v?.earning });
async function leaderboards(weeks: Map<number, WeekFile>, now: number, problems: string[],
  stakedOf: StakedOf = async () => false, stakedCheck: StakedOf | null = null) {
  // All time needs every week: load the ones this run didn't (read only).
  const all = new Map(weeks);
  const idx = readPrev("index.json");
  for (const w of Array.isArray(idx?.weeks) ? idx.weeks : []) if (Number.isInteger(w) && !all.has(w)) all.set(w, loadWeek(w));
  for (const w of all.keys()) if (typesOn(w) && !typesAll.has(w)) typesAll.set(w, loadTypes(w));
  const wNow = M.weekOf(now), day0 = Math.floor(now / M.DAY) * M.DAY;
  const failed = new Set<string>();              // "stake:who|week": stake reads that failed (not staked on the boards)
  const anyPicks = [...all.values()].some((wf) => wf.races.some((r) => Array.isArray(r.result?.picks))) || [...typesAll.values()].some((tf) => tf.races.some((r) => Array.isArray(r.result?.picks)));
  // Staked in the Race that week (the vault's test): read once per wallet and week; a failed read counts as not staked
  // on the boards and keeps the vault file from being final.
  const stakes = new Map<string, Stand>();
  const staked = async (who: string, week: number) => {
    const k = `${who}|${week}`;
    if (!stakes.has(k)) {
      try { stakes.set(k, standOf(await stakedOf(who, week))); }
      catch (e) {
        // A problem with the whole read (not one wallet) is reported once a run.
        const m = (e as Error).message, line = (e as any).once ? m : `Race stake of ${who}: ${m}`;
        if (!problems.includes(line)) problems.push(line);
        failed.add(`stake:${k}`); stakes.set(k, { staked: false, earning: false });
      }
    }
    return stakes.get(k)!;
  };
  if (!anyPicks) return { board: null, vault: await vaultResults(all, wNow - 1, now, [], failed, problems, stakedCheck) };
  // stakeWeek: the week whose stake decides the board (Today and This week: this week; Last week: that week; All time:
  // this week, the wallet's standing now).
  // weekly: Last week and This week also say who earns (owner, 2026-10-29: only they get a medal); This week as if it
  // ended now.
  const build = async (from: number, to: number, stakeWeek: number, weekly = false) => {
    const rows: Row[] = [];
    for (const [a, x] of tally(all, from, to, weekly)) {
      const st = await staked(a, stakeWeek);
      rows.push({ a, pts: x.pts, correct: x.correct, shows: x.shows, picks: x.picks, ranked: st.staked, earning: st.earning, reached: x.reached });
    }
    // Prizes and bucket shares only for weeks the Race earns in the vault (PRIZES_FROM_WEEK). D-152: on those boards the
    // staked tie at the 30% line is cut (cutLine), so the wallets that get in hold their own place.
    const paying = weekly && stakeWeek >= prizesFromWeek;
    return withEarns(withPlaces(paying ? cutLine(rank(rows)) : rank(rows)), paying);
  };
  const pub = (rows: Row[]) => rows.map(({ earning, reached, tb, ...r }) => r);   // board.json rows: the published fields only
  const lastRows = wNow > 0 ? await build(M.weekStart(wNow - 1), M.weekStart(wNow), wNow - 1, true) : [];
  const weekRows = await build(M.weekStart(wNow), M.weekStart(wNow + 1), wNow, true);
  const board = {
    v: 1, updated: new Date(now).toISOString(),
    today: { day: M.dayOf(now), rows: pub(await build(day0, day0 + M.DAY, wNow)) },
    week: { week: wNow, start: M.weekStart(wNow), rows: pub(weekRows) },
    lastWeek: wNow > 0 ? { week: wNow - 1, start: M.weekStart(wNow - 1), rows: pub(lastRows) } : null,
    allTime: { rows: pub(await build(0, Infinity, wNow)) },
  };
  // D-125: on the review day (Sunday UTC) the vault file is this week's, published as pending; from Monday, last week's.
  const review = reviewing(wNow, now);
  return { board, vault: await vaultResults(all, review ? wNow : wNow - 1, now, review ? weekRows : lastRows, failed, problems, stakedCheck) };
}

// ── the KnodeGames Vault's results file (Vault v6 hand-offs, 2026-10-28) ──
/** The Producer Race's game number in the KnodeGames Vault, the vault's limit of wallets per prize place, and its
 *  points range for staked players' rows. */
export const VAULT_GAME = 7;
/** The first vault week the Race earns in (owner, 2026-11-02: game 7 is applied in the vault and earns from week 3, Mon
 *  9 Nov 2026). Earlier weeks: no free-prize places, no staked rows and no medals (the vault skips them anyway). */
export const PRIZES_FROM_WEEK = 3;   // also PRIZES_FROM in race.yml's publish check (Repo Lens #E-11 I-2): change both together
let prizesFromWeek = PRIZES_FROM_WEEK;
export const MAX_PRIZE_WINNERS = 10;
export const MAX_ROW_POINTS = 255;
type VaultRow = { player: string; points: number };
type VaultFile = { game: number; week: number; final: boolean; rows: VaultRow[]; first: string[]; second: string[]; skipped: string[] };

/** Two rows tie when every ranking measure is equal (rank() sorts by exactly these, so ties sit next to each other),
 *  and no 30% line runs between them (tb, D-152). */
const tied = (x: Row, y: Row) => x.pts === y.pts && x.correct === y.correct && x.picks === y.picks && (x.tb ?? 0) === (y.tb ?? 0);
/** The staked players who share the bucket (owner, 5 Nov, D-152): exactly the top 30% by headcount of the earning
 *  staked players with at least 1 point, rounded up, in rank() order. Tied wallets above the line all get in and share
 *  their level; a tie that crosses the line lets in the wallets that reached that score first. Exported. */
export function stakedWinners(rows: Row[]): Set<string> {
  const elig = rank(rows.filter((r) => r.ranked && r.earning !== false && r.pts >= 1));
  return new Set(elig.slice(0, Math.ceil((elig.length * 30) / 100)).map((r) => r.a));
}
/** D-152: in each staked tied group that holds a paid wallet, the wallets after its last paid one take the next place
 *  (tb = 1), so the vault (which pays whole values) pays exactly stakedWinners and the board's places match the file.
 *  Rows stay in rank() order. Exported. */
export function cutLine(rows: Row[]): Row[] {
  const paid = stakedWinners(rows), out = rows.map((r) => ({ ...r, tb: 0 }));
  const same = (x: Row, y: Row) => x.pts === y.pts && x.correct === y.correct && x.picks === y.picks;
  const staked = out.filter((r) => r.ranked && r.pts >= 1);
  for (let i = 0; i < staked.length; ) {
    let j = i; while (j < staked.length && same(staked[i], staked[j])) j++;
    const g = staked.slice(i, j);
    let last = -1; g.forEach((r, k) => { if (paid.has(r.a)) last = k; });
    if (last >= 0) for (const r of g.slice(last + 1)) r.tb = 1;
    i = j;
  }
  return out;
}
/** earns, on the weekly boards (owner, 2026-10-29: only wallets that earn get a medal): 1 or 2 = the free prize's 1st
 *  or 2nd (prizePlaces: ties, and the 10 earliest when more are tied), 3 = a share of the staked bucket, 0 = nothing.
 *  Other boards: 0. Exported. */
export function withEarns(rows: Row[], paying: boolean): Row[] {
  if (!paying) return rows.map((r) => ({ ...r, earns: 0 }));
  const free = prizePlaces(rows), share = stakedWinners(rows);
  const place = new Map<string, number>([...free.first.map((a): [string, number] => [a, 1]), ...free.second.map((a): [string, number] => [a, 2])]);
  return rows.map((r) => ({ ...r, earns: r.ranked ? (share.has(r.a) ? 3 : 0) : place.get(r.a) || 0 }));
}
/** Each row's place on its own board (Staked or Free play), ties sharing it: 1, 1, 3, … Rows stay in rank() order. Exported. */
export function withPlaces(rows: Row[]): Row[] {
  const last: Record<string, { r: Row; place: number; n: number }> = {};
  return rows.map((r) => {
    const k = r.ranked ? "staked" : "free", prev = last[k], n = (prev ? prev.n : 0) + 1;
    const place = prev && tied(prev.r, r) ? prev.place : n;
    last[k] = { r, place, n };
    return { ...r, boardPlace: place };
  });
}
function groupsOf(rows: Row[]): Row[][] {
  const groups: Row[][] = [];
  for (const r of rows) { const g = groups[groups.length - 1]; if (g && tied(g[0], r)) g.push(r); else groups.push([r]); }
  return groups;
}

/** The free prize's places from a week's rows in rank() order. Every free player (not staked in the Race that week)
 *  with at least 1 point qualifies (owner, 2026-10-28). Wallets tied on every measure (points, wins, picks) share a
 *  place: a tie for 1st takes both prizes, so 2nd stays empty (D-034). D-159 (owner, 5 Nov): each place is paid to at
 *  most 10 wallets; when more are tied for it, the 10 that reached their score first get in (rank() order: D-152's
 *  score time, then the address), the rest get nothing and never move down a place. Exported. */
export function prizePlaces(rows: Row[]): { first: string[]; second: string[]; notes: string[] } {
  const groups = groupsOf(rows.filter((r) => !r.ranked && r.pts >= 1).map((r) => ({ ...r, tb: 0 })));
  const notes: string[] = [];
  const early = (g: Row[], n: number) => rank(g).map((r) => r.a).slice(0, n);
  const [g1, g2] = groups;
  if (!g1) return { first: [], second: [], notes };
  if (g1.length > MAX_PRIZE_WINNERS) notes.push(`${g1.length} wallets are tied for 1st: the ${MAX_PRIZE_WINNERS} that reached their score first share it, ${g1.length - MAX_PRIZE_WINNERS} get nothing`);
  if (g1.length > 1 || !g2) return { first: early(g1, MAX_PRIZE_WINNERS), second: [], notes };
  if (g2.length > MAX_PRIZE_WINNERS) notes.push(`${g2.length} wallets are tied for 2nd: the ${MAX_PRIZE_WINNERS} that reached their score first share it, ${g2.length - MAX_PRIZE_WINNERS} get nothing`);
  return { first: [g1[0].a], second: early(g2, MAX_PRIZE_WINNERS), notes };
}

/** The staked players' rows for the vault: every wallet staked in the Race that week with at least 1 point, in the
 *  board's order, as points 255, 254, ... per tied group (only the order and the ties matter to the vault). Exported.
 *  Beyond 255 groups the values run out (I-086, RECORDER_STANDARD §4.3): the paid set (stakedWinners, the vault's top
 *  30%) is worked out first, so an unpaid wallet never shares a value with a paid one. Normally the lowest groups just
 *  share 1 point. When the paid groups themselves reach the 255th group, the best 253 groups keep 255 … 3, the rest of
 *  the paid groups share 2 (their rank weights are averaged), and every unpaid wallet gets 1. The run notes either case. */
export function rowValues(groups: Row[][], paid: Set<string>): number[] {
  const last = groups.reduce((m, g, i) => (g.some((r) => paid.has(r.a)) ? i : m), -1);
  const exact = groups.length <= MAX_ROW_POINTS || last <= MAX_ROW_POINTS - 2;
  return groups.map((_, i) => (exact ? Math.max(1, MAX_ROW_POINTS - i) : i <= MAX_ROW_POINTS - 3 ? MAX_ROW_POINTS - i : i <= last ? 2 : 1));
}
export function stakedRows(rows: Row[]): { rows: VaultRow[]; notes: string[] } {
  const groups = groupsOf(rows.filter((r) => r.ranked && r.pts >= 1)), out: VaultRow[] = [], notes: string[] = [];
  const paid = stakedWinners(rows), v = rowValues(groups, paid);
  groups.forEach((g, i) => { for (const r of g) out.push({ player: r.a, points: v[i] }); });
  if (groups.length > MAX_ROW_POINTS) {
    const twos = v.filter((x) => x === 2).length;
    notes.push(v[MAX_ROW_POINTS - 2] === 2 && twos > 1
      ? `${groups.length} different scores among staked players: the paid groups from place-group 254 on (${twos} of them) share 2 points, unpaid wallets get 1 (I-086)`
      : `${groups.length} different scores among staked players: the lowest ${groups.length - MAX_ROW_POINTS + 1} (all unpaid) share 1 point`);
  }
  return { rows: out, notes };
}

/** A race that still isn't final this long after its week ends is skipped (owner, 2026-10-28): its picks don't count
 *  (the leaderboard only ever counts final races) and the week's results become final without it. Normally every
 *  race is final within an hour or two of its end. */
export const VAULT_SKIP_AFTER = 12 * M.HOUR;

/** The vault's file for week w. Final once:
 *  - every race of the week is final (or was never run because the recorder hadn't started, or is skipped after
 *    VAULT_SKIP_AFTER), and the week file shows the recorder did run that week;
 *  - every Race stake was read, and the stakes read the same on the second node.
 *  `skipped` lists the races left out. A file already published as final is kept exactly as it is, so the vault never
 *  sees its results change (the publish job also refuses to change one). */
async function vaultResults(all: Map<number, WeekFile>, w: number, now: number, rows: Row[], failed: Set<string>, problems: string[], stakedCheck: StakedOf | null = null): Promise<VaultFile | null> {
  if (w < 0) return null;
  const old = readPrev(`vault/W${w}.json`);
  if (old && old.final === true && old.game === VAULT_GAME && old.week === w) return old;
  const wf = all.get(w);
  // No week file, or one with nothing recorded (e.g. the last run's files couldn't be read): write nothing. Repo Lens
  // #E-11 L-1: for a paid week that's late, say so (it would otherwise roll over without a word).
  if (!wf || !wf.races.some((r) => r.cards.some(Boolean) || r.result)) {
    const end = M.weekStart(w + 1);
    lateAlert(w, end, now, "nothing was recorded for that week (no race file, or no card and no result in it)");
    return null;
  }
  let firstCard = Infinity;
  for (const x of all.values()) for (const r of x.races) if (r.cards.some(Boolean)) firstCard = Math.min(firstCard, r.start);
  // D-125: a Sunday race on the rhythm scores nothing, so it never keeps the week open (the review day can start at
  // Sunday 00:00 UTC, before those races' times have passed).
  const open = wf.races.filter((r) => !r.result?.final && !M.restRace(r.start, rhythmFromWeek) && !(r.start < firstCard && !r.cards.some(Boolean)));
  // D-161: a typed race of the week still being scored keeps it open too (never past the same deadline).
  const openTyped = (typesAll.get(w)?.races || []).filter((r) => !r.result?.final && forWeek(r));
  const late = now >= wf.end + (onRhythm(w) ? 0 : VAULT_SKIP_AFTER);   // D-125: the review day comes first
  const unread = rows.filter((r) => failed.has(`stake:${r.a}|${w}`));
  const file: VaultFile = { game: VAULT_GAME, week: w, final: false, rows: [], first: [], second: [], skipped: [] };
  const wait = (why: string) => { problems.push(`vault week ${w}: not final yet, ${why}`); lateAlert(w, wf.end, now, why); return file; };
  if (open.length && !late) return wait(`${open.length} race(s) still being checked (${open.map((r) => r.id).join(", ")}); skipped if still open at ${new Date(wf.end + (onRhythm(w) ? 0 : VAULT_SKIP_AFTER)).toISOString()}`);
  if (openTyped.length && !late) return wait(`${openTyped.length} race(s) of the other types still being scored (${openTyped.slice(0, 5).map((r) => r.id).join(", ")}${openTyped.length > 5 ? ", …" : ""}); skipped if still open at ${new Date(wf.end + (onRhythm(w) ? 0 : VAULT_SKIP_AFTER)).toISOString()}`);
  if (unread.length) return wait(`${unread.length} Race stake(s) could not be read (tried again next run)`);
  if (stakedCheck) {
    for (const r of rows) {
      let theirs: boolean;
      try { theirs = standOf(await stakedCheck(r.a, w)).staked; } catch (e) { return wait(`the second node couldn't read ${r.a}'s Race stake (${(e as Error).message})`); }
      if (theirs !== r.ranked) return wait(`the two nodes disagree about whether ${r.a} was staked in the Race`);
    }
  }
  if (open.length) problems.push(`vault week ${w}: ${open.length} race(s) never became final and are skipped: ${open.map((r) => r.id).join(", ")}`);
  if (openTyped.length) problems.push(`vault week ${w}: ${openTyped.length} race(s) of the other types never became final and are skipped: ${openTyped.slice(0, 10).map((r) => r.id).join(", ")}`);
  // Before the Race earns in the vault: a final file with nothing to pay (the vault skips those weeks anyway).
  if (w < prizesFromWeek) return await settle({ ...file, final: true, skipped: open.map((r) => r.id) }, wf.end, now, problems, all);
  const places = prizePlaces(rows), staked = stakedRows(cutLine(rank(rows)));
  for (const n of [...places.notes, ...staked.notes]) problems.push(`vault week ${w}: ${n}`);
  return await settle({ ...file, final: true, rows: staked.rows, first: places.first, second: places.second, skipped: open.map((r) => r.id) }, wf.end, now, problems, all);
}

// ── the hold before a vault file goes final (I-034, R-RACE-1; owner 2026-11-03: 12 hours, then two matching runs) ──
/** How long after its week ends a vault file is held before it can go final. */
export const VAULT_HOLD_MS = 12 * M.HOUR;   // weeks before the rhythm (D-125) only
// ── D-125: the weekly rhythm (owner, 4 Nov): races Mon–Sat; Sunday UTC is the review day; final from Monday 00:00 UTC ──
let rhythmFromWeek = M.RHYTHM_FROM_WEEK;
/** Is week w on the weekly rhythm? */
const onRhythm = (w: number) => w >= rhythmFromWeek;
/** The review day for week w: Sunday 00:00 → Monday 00:00 UTC, the 24 h after its last race. */
const reviewing = (w: number, now: number) => onRhythm(w) && now >= M.playEnd(w) && now < M.weekStart(w + 1);
/** D-129: Sunday races on the rhythm run as usual (for fun); this note is what the page says about them. */
export const REST_NOTE = "Sunday fun race: counts on the all-time board, not the week (D-129)";
/** How long after the week ends (Monday 00:00 UTC) a rhythm week alerts if still not final: it normally goes final at
 *  the 00:37 or 01:37 run, after a whole Sunday of review. */
export const RHYTHM_ALERT_AFTER = 3 * M.HOUR;
/** How long the pending file must stay exactly the same (across hourly runs) before it can go final. */
export const VAULT_STABLE_MS = M.HOUR;
type Pending = { game: number; week: number; at: number; file: VaultFile };
let hold: false | { afterEnd: number; stable: number } = { afterEnd: VAULT_HOLD_MS, stable: VAULT_STABLE_MS };
let holdSetting: { weeks: number[]; bad: boolean; raw: string } = { weeks: [], bad: false, raw: "" };
let pendingOut: Pending | null = null;
/** True when this run's pending file has new content, so its date is set again at the end of the run (#85 L-1). */
let pendingNew = false;

/** RACE_HOLD_WEEKS: "3" or "3, 4" (vault week numbers, separated by commas). Repo Lens #D-5 R85-1: fail closed. If
 *  the value is set but any part isn't a plain week number ("3 4", "W3", "3;4", "W3,4"), `bad` is true and EVERY
 *  pending week is held until it's fixed. Empty or unset: no hold. */
export function parseHoldWeeks(v: string | undefined): { weeks: number[]; bad: boolean; raw: string } {
  const raw = String(v ?? "").trim();
  if (!raw) return { weeks: [], bad: false, raw };
  const parts = raw.split(",").map((x) => x.trim());
  const bad = parts.some((x) => !/^[0-9]{1,4}$/.test(x));
  return { weeks: bad ? [] : parts.map(Number), bad, raw };
}
/** The run's note about the owner's hold (R85-1: printed on every run while the variable is set). */
export function holdNote(h: { weeks: number[]; bad: boolean; raw: string }): string | null {
  if (!h.raw) return null;
  const shown = h.raw.replace(/[^0-9A-Za-z ,;]/g, "?").slice(0, 40);
  return h.bad ? `RACE_HOLD_WEEKS ('${shown}') isn't a list like 3 or 3,4: every pending vault week is held until it is fixed`
    : `Owner hold: week${h.weeks.length === 1 ? "" : "s"} ${h.weeks.join(", ")}`;
}

/** The published pending file for week w, if it is one this recorder could have written. */
function prevPending(w: number, now: number): Pending | null {
  const p = readPrev(`vault/PENDING-W${w}.json`);
  if (!p || typeof p !== "object" || p.game !== VAULT_GAME || p.week !== w || !Number.isSafeInteger(p.at) || p.at > now) return null;
  if (!p.file || p.file.game !== VAULT_GAME || p.file.week !== w || p.file.final !== true) return null;
  return p;
}

/** Wallets whose first race ever (in the weeks this run can see) is in week w: worth a look when one wins a free
 *  prize (I-035, owner 2026-11-03 option A: flag, don't block). */
function newThisWeek(all: Map<number, WeekFile>, w: number, who: string[]): string[] {
  const start = M.weekStart(w), first = new Map<string, number>();
  for (const wf of all.values()) for (const r of wf.races) if (r.result?.final && Array.isArray(r.result.picks) && forWeek(r))
    for (const x of r.result.picks) if (!first.has(x[0]) || r.start < first.get(x[0])!) first.set(x[0], r.start);   // the race, not the pick's own time
  return who.filter((a) => (first.get(a) ?? Infinity) >= start);
}

/** candidate: the file this run would make final. Publishes it as pending, and returns it as the final file only when
 *  the hold is over and the pending file the last run published is identical and at least `stable` old. Otherwise
 *  the results file stays "not final" (empty) and the vault bot waits.
 *  #85 merge check I-1: "two runs at least an hour apart" holds on the hourly schedule. A run started by hand (Actions →
 *  Run workflow) can come sooner: the publish job accepts a new pending file dated up to 35 minutes back, so the two
 *  runs can be as little as ~25 minutes apart. It is still never one run alone. */
async function settle(candidate: VaultFile, weekEnd: number, now: number, problems: string[], all: Map<number, WeekFile>): Promise<VaultFile> {
  if (hold === false) return candidate;
  const w = candidate.week, waiting: VaultFile = { game: VAULT_GAME, week: w, final: false, rows: [], first: [], second: [], skipped: [] };
  const prev = prevPending(w, now);
  const same = !!prev && JSON.stringify(prev.file) === JSON.stringify(candidate);
  const at = same ? prev!.at : now;           // when this exact file was first seen
  pendingOut = { game: VAULT_GAME, week: w, at, file: candidate };
  pendingNew = !same;
  const fresh = candidate.first.concat(candidate.second);
  const flag = newThisWeek(all, w, fresh);
  const who = (xs: string[]) => (xs.length ? xs.join(", ") : "nobody");
  const summary = `1st ${who(candidate.first)}; 2nd ${who(candidate.second)}; ${candidate.rows.length} staked row(s)` +
    (flag.length ? `; first picks ever this week (check them): ${flag.join(", ")}` : "");
  if (holdSetting.bad) {
    problems.push(`vault week ${w}: HELD (RACE_HOLD_WEEKS isn't a list like 3 or 3,4). Pending: ${summary}.`);
    heldAlert(w, weekEnd, now, `the repo variable RACE_HOLD_WEEKS ('${holdSetting.raw.replace(/[^0-9A-Za-z ,;]/g, "?").slice(0, 40)}') isn't a list like 3 or 3,4, so every pending week is held`, "fix RACE_HOLD_WEEKS (a week number like 3, or 3,4) or empty it");
    return waiting;
  }
  // L-4 (owner, 4 Nov): the owner's own hold emails once a day (the OWNER_HOLD_ALERT_HOUR run), not hourly. The chain
  // checks below still run while it's on, and anything they find alerts every hour as before.
  const ownerHeld = holdSetting.weeks.includes(w);
  if (ownerHeld) {
    problems.push(`vault week ${w}: HELD by the owner (RACE_HOLD_WEEKS). Pending: ${summary}. Remove the week from RACE_HOLD_WEEKS to let it go final (results are due 3 days after the week).`);
    if (ownerAlertRun(now)) heldAlert(w, weekEnd, now, "you are holding it (RACE_HOLD_WEEKS; this reminder comes once a day)", `remove ${w} from RACE_HOLD_WEEKS when you're happy with it (pending: ${summary})`);
  }
  // D-125: on the rhythm the review day is before the week ends, so the week may go final from Monday 00:00 UTC.
  const afterEnd = onRhythm(w) ? 0 : hold.afterEnd;
  const readyAt = Math.max(weekEnd + afterEnd, at + hold.stable);
  // D-125: during the review day, each new pending file is checked against the chain at once (an early alert).
  if (reviewing(w, now) && pendingNew && w >= prizesFromWeek) {
    let why = "";
    try { why = all.get(w) ? await verifyWeek(all.get(w)!, chainCtx) : ""; }
    catch (e) { problems.push(`vault week ${w}: review day: couldn't check the races on the chain this run (${(e as Error).message})`); }
    if (why) {
      problems.push(`vault week ${w}: review day: HELD, ${why}`);
      heldAlert(w, weekEnd, now, `a race's stored result doesn't match the chain (${why})`, "tell the Race chat with this alert: a recorder run wrote a wrong race result. Don't release it by hand");
      return waiting;
    }
  }
  if (now >= weekEnd + afterEnd && same && now - at >= hold.stable) {
    // While the owner holds it, the full re-check runs once a day (with the reminder), not every hour.
    if (ownerHeld && !ownerAlertRun(now)) return waiting;
    // Repo Lens #E-11 H-1 (b): a paid week goes final only once its races, scored again from the chain, match.
    if (w >= prizesFromWeek) {
      const wf = all.get(w);
      let why = "";
      try { why = wf ? await verifyWeek(wf, chainCtx) : "its week file isn't loaded"; }
      catch (e) {
        problems.push(`vault week ${w}: couldn't check the week's races again (${(e as Error).message}); not final this run`);
        lateAlert(w, weekEnd, now, "the week's races couldn't be checked again on the chain");
        return waiting;
      }
      if (why) {
        problems.push(`vault week ${w}: HELD, ${why}`);
        heldAlert(w, weekEnd, now, `a race's stored result doesn't match the chain (${why})`, "tell the Race chat with this alert: a recorder run wrote a wrong race result. Don't release it by hand");
        return waiting;
      }
    }
    if (ownerHeld) return waiting;   // checked and matches the chain; still the owner's hold
    problems.push(`vault week ${w}: final after the hold (pending since ${new Date(at).toISOString()}). ${summary}`);
    return candidate;
  }
  problems.push(`vault week ${w}: pending (I-034 hold), final at the earliest ${new Date(readyAt).toISOString()} if nothing changes${prev && !same ? " (it changed since the last run, so the wait starts again)" : ""}. ${summary}`);
  lateAlert(w, weekEnd, now, `its results keep changing between runs, so the 1-hour check hasn't passed (pending since ${new Date(at).toISOString()})`);
  return waiting;
}

/** Repo Lens #E-11 L-3: text inside a workflow command (::warning:: / ::error::) is escaped as GitHub does, so a node's
 *  error text with a newline can't start a command of its own (e.g. ::stop-commands::). */
export const cmdText = (t: string) => String(t).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");

// ── D-107 (R-RACE-13, I-087): a held paid week alerts, and says what to do ──
/** The vault takes a week's results for 3 days after the week ends; after that the week rolls over. */
export const RESULTS_DUE_AFTER = 3 * M.DAY;
/** A paid week that still isn't final this long after its week ends is "held" and alerts. Normally it goes final at
 *  about 12:37 UTC on the Monday (the 12-hour hold, then the next run), so 15 h leaves two hourly runs of slack. */
export const VAULT_ALERT_AFTER = 15 * M.HOUR;
let heldAlerts: string[] = [];
/** L-4: the owner's own hold reminds once a day, on the run in this UTC hour (16:37 UTC = 8:37 AM PST / 9:37 AM PDT).
 *  On a week's last day that is still ~7 h before the results deadline (Thursday 00:00 UTC on the rhythm). */
export const OWNER_HOLD_ALERT_HOUR = 16;
export const ownerAlertRun = (now: number) => new Date(now).getUTCHours() === OWNER_HOLD_ALERT_HOUR;
/** "Week 1" for the site's numbering (weeks.js, D-063: vault week 3 = Week 1). */
const siteWeek = (w: number) => (w >= 3 ? `Week ${w - 2}` : `the week of ${new Date(M.weekStart(w)).toISOString().slice(0, 10)}`);
/** One alert line: the game and week, why, the deadline, and what the owner can do, with the exact commands. */
export function heldMessage(w: number, weekEnd: number, now: number, why: string, first?: string): string {
  const due = weekEnd + RESULTS_DUE_AFTER, left = Math.max(0, (due - now) / M.HOUR);
  const opts = [
    first ?? "wait: it clears by itself once the nodes agree and the week reads the same on two runs an hour apart",
    `hold it longer while you check: GitHub → Settings → Secrets and variables → Actions → Variables → RACE_HOLD_WEEKS = ${w}`,
    `give up on the week (its bucket stays in the Race for next week, its free prize goes back to the pool): npm run bot -- game-void 7 ${w} (dry run), then the same with --send`,
  ];
  return `Producer Race vault week ${w} (${siteWeek(w)}) is HELD: ${why}. Results are due ${new Date(due).toISOString().replace("T", " ").slice(0, 16)} UTC ` +
    `(${left.toFixed(0)} h left); after that the week rolls over. What you can do: ${opts.map((o, i) => `(${i + 1}) ${o}`).join("; ")}. More: .ai/platform/RUNBOOK.md §3.`;
}
/** Only paid weeks, only before the deadline (after it the week has rolled over and there is nothing left to do). */
export const alertsFor = (w: number, weekEnd: number, now: number, paidFrom: number) => w >= paidFrom && now < weekEnd + RESULTS_DUE_AFTER;
function heldAlert(w: number, weekEnd: number, now: number, why: string, first?: string) {
  if (!alertsFor(w, weekEnd, now, prizesFromWeek)) return;
  const m = heldMessage(w, weekEnd, now, why, first);
  if (!heldAlerts.includes(m)) heldAlerts.push(m);
}
function lateAlert(w: number, weekEnd: number, now: number, why: string) {
  if (now >= weekEnd + (onRhythm(w) ? RHYTHM_ALERT_AFTER : VAULT_ALERT_AFTER)) heldAlert(w, weekEnd, now, `still not final ${((now - weekEnd) / M.HOUR).toFixed(0)} h after the week ended: ${why}`);
}

/** The producers (field and paddock) on the newest card in the published week files of the last day (audit BX-53). */
function latestCardProducers(now: number): string[] {
  let best: Card | null = null;
  for (const w of new Set([M.weekOf(now - M.DAY), M.weekOf(now), M.weekOf(now + M.LEG)])) {   // audit BX-78: next week's first card too
    const wf = readPrev(`W${String(w).padStart(3, "0")}.json`);
    for (const r of (wf && Array.isArray(wf.races) ? wf.races : [])) for (const c of (Array.isArray(r?.cards) ? r.cards : [])) {
      if (c && Number.isFinite(c.at) && c.at <= now + FUTURE_MS && (!best || c.at > best.at)) best = c;
    }
  }
  if (!best) return [];
  return [...(best.field || []), ...(best.paddock || [])].map((r: any) => r && r.a).filter(isAddr).slice(0, 500);
}

/** --sample: one VHP sample at a random moment (rule 2). Waits a random 0 to `spreadMs` first (a secret chosen here,
 *  never published ahead), reads the producers of about the last hour of blocks (audit BX-45: only those, so the list
 *  never grows forever), their effective VHP on both nodes (audit BX-37: producer by producer, as combineReads), and
 *  writes vhp-samples.json with the last 8 hours of samples. Audit BX-38: the sample's time is the primary node's head
 *  time, refused when it is more than a minute ahead of the check node's head or of this computer's clock.
 *  Exported for the tests. */
export async function sample({ p, check, prev, out, vhpOf, vhpCheckOf, spreadMs = 4 * 60000, wait = sleep, clock = Date.now }: { p: any; check: any | null; prev?: string; out?: string;
  vhpOf?: (who: string[]) => Promise<Record<string, string>>; vhpCheckOf?: (who: string[]) => Promise<Record<string, string>>; spreadMs?: number; wait?: (ms: number) => Promise<unknown>; clock?: () => number }) {
  if (prev !== undefined) PREV = prev;
  if (out !== undefined) OUT = out;
  const delay = spreadMs > 0 ? randomInt(0, spreadMs) : 0;
  await wait(delay);
  const head: any = await withRetry("head", () => p.getHeadInfo());
  // Audit BX-114 (round 7): the check node's head is read right after the primary's, before the long block read, so a
  // slow read can't make an in-sync check node look "ahead".
  const chHead: any = check ? await withRetry("check head", () => check.getHeadInfo()) : null;
  const headH = Number(head.head_topology.height), now = Number(head.head_block_time);
  const problems: string[] = [];
  // Audit BX-56: a head time in the future is judged against this computer's clock only, so a check node a few minutes
  // behind no longer stops every sample (its VHP reads are still compared producer by producer).
  const ahead = now - clock();
  if (ahead > FUTURE_MS) problems.push(`the node's head time is ${Math.round(ahead / 1000)} s in the future; no sample this time`);
  const old = loadSamples(Math.min(now, clock()));
  const recent = await readBlocks(p, head.head_topology.id, Math.max(1, headH - 1199), headH);
  // Audit BX-53: every producer on the latest published card is sampled too (not only those that signed in the last
  // hour), so a quiet small producer can't take VHP in and out unseen; the list still can't grow without limit.
  const who = [...new Set([...recent.signers.filter(isAddr), ...latestCardProducers(Math.min(now, clock()))])];
  const read = vhpOf || (async (w: string[]) => (await readVhp(p, MAINNET_VHP, w, { effective: true })).values);
  const readCheck = !check ? null : vhpCheckOf || vhpOf || (async (w: string[]) => (await readVhp(check, MAINNET_VHP, w, { effective: true })).values);
  let keep = old.filter((x) => x.at > Math.min(now, clock()) - SAMPLE_KEEP);
  // Audit BX-101 (round 6): the same lag bounds as a card: a check node more than LAG_MS behind (or HEAD_GAP_MS ahead,
  // or LIB_GAP_MAX blocks away) gives no sample this time, rather than disputes that flag producers for 6 hours.
  if (!problems.length && check && readCheck) {
    const ch: any = chHead;
    const chTime = Number(ch.head_block_time), chH = Number(ch.head_topology.height);
    if (chTime - now > HEAD_GAP_MS || now - chTime > LAG_MS || Math.abs(chH - headH) > LIB_GAP_MAX)
      problems.push(`the check node is ${Math.round((now - chTime) / 1000)} s / ${headH - chH} blocks from the primary (at most ${LAG_MS / 60000} min behind, ${HEAD_GAP_MS / 1000} s ahead, ${LIB_GAP_MAX} blocks); no sample this time`);
  }
  if (!problems.length) {
    // Audit BX-74: both nodes at the same block when they can.
    const both = readCheck ? await readBoth(p, check, read, readCheck, who, wait) : { mine: await read(who), theirs: null, same: true };
    const mine = both.mine;
    const theirs = both.theirs;
    // Audit BX-86 (round 5): a sample NEVER keeps one node's higher read ("different blocks" is only each node's own
    // word). The disputed producers alone are read again on both nodes (twice, a second apart); one still disputed is
    // sampled at the LOWER read and recorded in the sample (flagged, with its higher read), so every card that uses the
    // sample flags it, and the top is in doubt when its higher read would reach the top.
    const { values, differ: d0, high } = combineReads(mine, theirs, who, true);
    let differ = d0;
    for (let k = 0; k < 2 && differ.length && readCheck; k++) {
      await wait(1000);
      const again = await readBoth(p, check, read, readCheck, differ, wait);
      const c = combineReads(again.mine, again.theirs, differ, true);
      for (const a of differ) {
        if (!c.differ.includes(a)) { values[a] = c.values[a]; delete high[a]; continue; }
        if (BigInt(c.values[a]) < BigInt(values[a])) values[a] = c.values[a];
        if (BigInt(c.high[a]) > BigInt(high[a])) high[a] = c.high[a];
      }
      differ = differ.filter((a) => c.differ.includes(a));
    }
    for (const a of differ) problems.push(`the two nodes disagree on ${a}'s effective VHP; it is sampled at the lower read and flagged in the sample (cards that use it flag ${a})`);
    const disputes = differ.length ? { flagged: [...differ].sort(), high: Object.fromEntries([...differ].sort().map((a) => [a, high[a]])) } : {};
    if (!keep.length || now > keep[keep.length - 1].at) keep = keep.concat([{ at: now, height: headH, vhp: values, ...disputes }]).slice(-SAMPLE_MAX);
  }
  fs.mkdirSync(OUT, { recursive: true });
  const file: SampleFile = { v: 1, updated: new Date(Math.min(now, clock())).toISOString(), samples: keep };
  fs.writeFileSync(path.join(OUT, SAMPLES), JSON.stringify(file) + "\n");
  console.log(`sample at block ${headH} (${new Date(now).toISOString()}), ${who.length} producers; ${keep.length} kept`);
  for (const pr of problems) console.log(`::warning::${cmdText(pr)}`);
  return { problems, delay };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Audit BX-59: never quietly down to one node. One node only with ALLOW_ONE_NODE=yes (said so on every run).
  if (!RPC_CHECK && E.ALLOW_ONE_NODE !== "yes") { console.error(`error: no second node (RPC_CHECK is off, missing or the same as RPC): the race needs two. Set RPC_CHECK, or ALLOW_ONE_NODE=yes to run on one node.`); process.exit(1); }
  if (!RPC_CHECK) console.log("::warning::running on ONE node (ALLOW_ONE_NODE=yes): cards and results are not cross-checked");
  const nodes = { p: new Provider([RPC]), check: RPC_CHECK ? new Provider([RPC_CHECK]) : null };
  // Repo Lens RV-1 (round 12): exit once the work is done. withRetry stops waiting for a node that never answers, but its
  // request stays open and would keep this process alive until the job's 30-minute limit, so that hour's files would
  // never be uploaded.
  (process.argv.includes("--sample") ? sample(nodes) : run({ ...nodes, clock: Date.now })).then(() => process.exit(process.exitCode ?? 0), (e) => { console.error(`error: ${String((e && e.message) || e).replace(/[\r\n]+/g, " ").replace(/::/g, ": ").slice(0, 500)}`); process.exit(1); });
}
