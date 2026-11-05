/**
 * Fantasy Producers recorder (read-only on the chain, holds no key). The rules and the scoring are fantasy-math.js,
 * the same file the website runs.
 *   mainnet  .github/workflows/games.yml (when Fantasy is registered): real clock, Picks games 4 (team) and 5 (rival)
 *   testnet  bot/fantasy-test.ts: picks on the testnet Picks contract, a fast clock (1 test day = 1 hour), and the
 *            teams scored on MAINNET blocks (read only), because the testnet has a single block producer.
 *
 * Each run:
 *  1. Days. Every day whose last block is irreversible gets each producer's index (blocks signed ÷ expected, from the
 *     race cards' VHP shares). Its blocks must match on two nodes (RPC and RPC_CHECK) to be final. Today so far is
 *     published too, marked provisional (irreversible blocks only, one node), so the page can show a live score.
 *  2. Price sheet. From its time (real clock: Saturday 00:00 UTC), the sheet for the coming week: the race field on the
 *     card in force then, each producer's form over the 7 days before, its price. Its sha256 is published with it and
 *     it is never made again.
 *  3. Teams and rivals (once the Picks contract is set). A day's team picks are read once the day's start is
 *     irreversible (they locked 5 minutes before), on both Picks nodes, which must agree. The week's rival challenges
 *     are read the same way when the week starts.
 *  4. Scores. Each player's day-by-day team (one change a day, budget, pool), day scores and week points. A week is
 *     pending through Sunday, the review day (WEEK_CYCLE.md, D-125). From the week's end (Monday 00:00 UTC), once all
 *     its days, picks, rivals and stakes are read, a run records the result's fingerprint (`pending`); the week goes
 *     final only when a later run, at least an hour on, computes the identical result (the two-run rule). Then it is
 *     final, with the vault points (1..255) the operator bot posts to the vault. Rival matches of a final week are added to
 *     the records once.
 *  5. Writes index.json, days.json, W<week>.json, rivals.json and board.json to FANTASY_OUT, for the publish job.
 *
 *   RPC, RPC_CHECK ("off" to skip the second node), FANTASY_PREV (the last run's files), FANTASY_OUT,
 *   RACE_DATA (the race-data files, for the cards).
 *   npm run fantasy
 */
import { Provider, Contract } from "koilib";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { withRetry, sleep } from "../../common.ts";
import { readBlocks, blockTime, heightAt } from "../race.ts";
// The vault reader Block X uses (audits BX-15, BX-61, BX-63, BX-82): v6 live from get_state, the week's minimum, and
// staked = the most the wallet had in THIS game that week (peak) at or above the minimum.
import { vaultReader, stakedSet } from "./blockx.ts";
await import("../../race-math.js");
await import("../../fantasy-math.js");
const M: any = (globalThis as any).KRaceMath;
const FREAL: any = (globalThis as any).KFantasyMath;

const E = process.env;
const KEEP_DAYS = 21;                       // days kept in days.json at least (a sheet's form needs 7; last week and this one 14)
const BLOCK_BUDGET = 120000;
/** RECORDER_STANDARD §4.2 (as the Race's verifyWeek, Repo Lens #E-11 H-1, #C-7 C7-1): how long the week's re-check from
 *  the chain may take in one run. Running out is "not checked yet" (the week waits), never a mismatch. */
export const VERIFY_BUDGET_MS = 10 * 60000;                // blocks read for whole days per run (a long outage catches up over runs)
const isAddr = (a: unknown): a is string => typeof a === "string" && /^1[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(a);
const pad = (w: number) => String(w).padStart(3, "0");

type Ix = Record<string, [number, number, number | null]>;
export type DayRec = { day: number; final: boolean; checked: number; heights: [number, number]; blocks: number; producers: Ix };
type Sheet = { week: number; at: number; budget: number; median: number | null; pool: { a: string; form: number | null; price: number }[]; late?: boolean };
/** A pick as the Picks contract holds it: [player, addresses (team: captain first; rival: the rival), time (ms)]. */
export type RawPick = [string, string[], number];
/** A player's week. days: one entry per day [team as positions on the week's price list, or null; score; note?]
 *  (F.unpackTeam turns the positions back into addresses; small files: audit FX-4). */
type PlayerRow = { a: string; points: number; vault: number; full: boolean; place: number; staked: boolean; days: [number[] | null, number, string?][] };
type WeekFile = {
  v: 1; week: number; start: number; end: number; final: boolean;
  sheet: Sheet | null; sha256: string | null;
  picks: Record<string, RawPick[]>;                   // team picks by day number (emptied once the week is final)
  rivals: [string, string][] | null;                  // [challenger, target], read when the week started
  players: PlayerRow[];
  matches: { a: string; b: string; mutual: boolean; result: string }[];
  /** WEEK_CYCLE §2 (two-run rule): the sha256 of the result (players and rival matches) a run computed once the week
   *  could be settled, and when. Final only when a run at least AGREE_GAP later computes the same; null once final. */
  pending: { hash: string; at: number } | null;
};
export type Opts = {
  p: any; check: any | null;                                         // the chain whose blocks score the teams
  picksP?: any; picksCheck?: any | null;                             // the chain of the Picks contract (default: p, check)
  prev?: string; out?: string; raceData?: string;
  math?: any;                                                        // KFantasyMath or KFantasyMath.withClock(...)
  games?: { team: number; rival: number };
  picksContract?: string | null;                                     // default: picks-data/deployment.json
  picksOf?: (node: any, game: number, round: number) => Promise<RawPick[]>;   // for the tests
  live?: boolean;                                                    // publish today so far (default true)
  /** The free-prize switch as the boards show it (D-082; env FANTASY_FREE_PRIZE=on). Off: the Free play board pays no
   *  VHP, so no free medals and no prize list on the board. The vault file lists the free winners either way. */
  freePrize?: boolean;
  verifyBudgetMs?: number;                                           // §4.2 re-check time budget (tests)
  /** The wallets staked in Fantasy that week (the Staked board; vault points are ranked among them only, audit FX-3).
   *  Everyone else plays on the Free play board. Default: the vault (v6) on both nodes, which must agree; null from it
   *  = the vault isn't live yet (nobody staked, no vault file, index.json vaultBasis "all"). */
  stakedOf?: ((who: string[], week: number) => Promise<Set<string> | null>) | null;
  /** Who holds a Knode Games stake now (rival matches count only between two of them: owner, 2026-10-28). Read on the
   *  scoring chain's node(s). Default on mainnet: the Knode game's get_player (stake, pending, or a stake in another
   *  game). null: everyone counts (the testnet practice kit, whose test wallets hold no stake). */
  rivalStaked?: ((who: string[], node: any) => Promise<Set<string>>) | null;
};
const GAME_ABI = () => JSON.parse(fs.readFileSync(new URL("../../game/abi/kpred.koilib.json", import.meta.url), "utf8"));
const KNODE_GAME = (() => { try { return JSON.parse(fs.readFileSync(new URL("../../game-data/deployment.json", import.meta.url), "utf8")).contract as string; } catch { return ""; } })();
const ONE_VHP = 100000000n;
/** The wallets staked in Fantasy (vault game 4) for a vault week, on one node, with Block X's vault reader: null when
 *  the vault (v6) isn't live. Staked = the most the wallet had in game 4 that week at or above the week's minimum (a
 *  wallet staked at the week's start stays staked that week; holding VHP or staking in another game doesn't count). */
export function gameStakes(vault: string | null = KNODE_GAME || null, game = 4) {
  const read = vaultReader(vault, game);
  return async (node: any, who: string[], week: number): Promise<Set<string> | null> => {
    const v = await read(node, who, week);
    return v.live ? stakedSet(v) : null;
  };
}
/** Wallets with a Knode Games stake (active, pending, or in another game with vault v6). */
export async function readStaked(node: any, who: string[], game = KNODE_GAME): Promise<Set<string>> {
  const out = new Set<string>();
  if (!game || !isAddr(game)) throw new Error("no Knode game contract in game-data/deployment.json");
  const c = new Contract({ id: game, abi: GAME_ABI(), provider: node });
  for (const a of who) {
    const r: any = await withRetry(`Knode stake of ${a}`, () => (c.functions as any).get_player({ player: a, week: "0" }));
    const p = r?.result?.player ?? {};
    if (BigInt(p.stake || "0") + BigInt(p.pending || "0") + BigInt(p.stake_other || "0") > 0n) out.add(a);
  }
  return out;
}
const WEEKS_BACK = 8;                       // an unfinished week is still finished up to 8 weeks later (audit FX-6)

function readJson(dir: string, name: string): any {
  if (!dir) return null;
  const f = path.join(dir, name);
  try { if (fs.lstatSync(f).isSymbolicLink()) return null; return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; }
}
function defaultPicksContract(): string | null {
  try { const d = JSON.parse(fs.readFileSync(new URL("../../picks-data/deployment.json", import.meta.url), "utf8")); return isAddr(d.contract) ? d.contract : null; } catch { return null; }
}
const PICKS_ABI = () => JSON.parse(fs.readFileSync(new URL("../../picks/abi/picks.koilib.json", import.meta.url), "utf8"));
/** Every pick for a round of a Picks game, page by page (list_picks: rows in address order, 100 at a time). */
export async function readPicks(node: any, contract: string, game: number, round: number): Promise<RawPick[]> {
  const c = new Contract({ id: contract, abi: PICKS_ABI(), provider: node });
  const out: RawPick[] = [];
  let after: string | undefined;
  for (let page = 0; page < 1000; page++) {
    const r: any = await withRetry(`picks game ${game} round ${round}`, () => (c.functions as any).list_picks({ game, round: String(round), ...(after ? { start_after: after } : {}), limit: 100 }));
    const rows = r?.result?.rows ?? [];
    for (const x of rows) { const list = x.pick?.producers; if (isAddr(x.player) && Array.isArray(list) && list.length && list.every(isAddr)) out.push([x.player, list, Number(x.pick.time || 0)]); }
    if (rows.length < 100) break;
    after = rows[rows.length - 1].player;
  }
  return out;
}
 /** The vault file for a final week (VAULT_STANDARD): `rows`, the staked players' points 1..255 (order and ties kept),
 *  and the Free play board's 1st and 2nd (F.freeWinners: a team on all 6 play days, at least 1 point, ties share, at
 *  most 10 a place). The free winners are written every week; the owner's free-prize switch (D-082) decides whether the
 *  vault pays them, so switching it on needs no change here. A wallet is never in both. Exported for the tests. */
export function vaultFile(week: number, players: { a: string; vault: number; points?: number; full?: boolean; staked?: boolean }[]) {
  const rows = players.filter((x) => isAddr(x.a) && x.staked !== false && Number.isInteger(x.vault) && x.vault >= 1 && x.vault <= 255)
    .map((x) => ({ player: x.a, points: x.vault })).sort((x, y) => y.points - x.points || (x.player < y.player ? -1 : 1));
  const inRows = new Set(rows.map((x) => x.player));
  const fw = F0.freeWinners(players.filter((x) => isAddr(x.a) && !inRows.has(x.a) && typeof x.points === "number").map((x) => ({ a: x.a, points: x.points!, full: x.full === true, staked: !!x.staked })));
  return { game: 4, week, final: true, rows, first: fw.first, second: fw.second };
}
const F0 = (globalThis as any).KFantasyMath;
const sortPicks = (x: RawPick[]) => [...x].sort((u, v) => (u[0] < v[0] ? -1 : u[0] > v[0] ? 1 : 0));
const samePicks = (a: RawPick[], b: RawPick[]) => JSON.stringify(sortPicks(a)) === JSON.stringify(sortPicks(b));

/** The race cards by race id, from the race-data week files that cover [from, to). Race weeks are real weeks. */
function loadCards(dir: string, from: number, to: number): Record<string, any[]> {
  const out: Record<string, any[]> = {};
  for (let w = M.weekOf(from); w <= M.weekOf(to); w++) {
    const wf = readJson(dir, `W${pad(w)}.json`);
    if (!wf || !Array.isArray(wf.races)) continue;
    for (const r of wf.races) if (r && typeof r.id === "string" && Array.isArray(r.cards)) out[r.id] = r.cards;
  }
  return out;
}
/** The heights of the blocks in [t0, t1) up to `top` (empty: b < a). */
async function heightsOf(p: any, headId: string, top: number, topT: number, t0: number, t1: number) {
  const est = Math.ceil((topT - t0) / 3000) + 600;
  let lo = Math.max(1, top - est);
  while (lo > 1 && (await blockTime(p, headId, lo)) >= t0) lo = Math.max(1, lo - est);
  const a = await heightAt(p, headId, t0, lo, top);
  const b = t1 > topT ? top : (await heightAt(p, headId, t1, a, top)) - 1;
  return [a, b] as [number, number];
}

export async function run(o: Opts) {
  const F = o.math || FREAL;
  const G = o.games || F.GAMES;
  const prev = o.prev ?? E.FANTASY_PREV ?? "", out = o.out ?? E.FANTASY_OUT ?? "games-data/fantasy", raceData = o.raceData ?? E.RACE_DATA ?? "race-data";
  const p = o.p, check = o.check, pp = o.picksP ?? p, pcheck = o.picksCheck === undefined ? (o.picksP ? null : check) : o.picksCheck;
  const contract = o.picksContract === undefined ? defaultPicksContract() : o.picksContract;
  const picksRead = o.picksOf || (contract ? (node: any, g: number, r: number) => readPicks(node, contract, g, r) : null);
  const problems: string[] = [];
  const head: any = await withRetry("head", () => p.getHeadInfo());
  const headId = head.head_topology.id, now = Number(head.head_block_time);
  const chk = check ? await withRetry("check head", () => check.getHeadInfo()) : null;
  // RECORDER_STANDARD §2.2: count only blocks irreversible on BOTH nodes (the lower of the two lib heights).
  const libH = Math.min(Number(head.last_irreversible_block), chk ? Number(chk.last_irreversible_block) : Infinity), libT = await blockTime(p, headId, libH);
  if (!Number.isInteger(libH) || libH < 1) throw new Error(`no irreversible block height to score from (${libH})`);
  // The Picks chain's own irreversible time (the testnet's, when the picks live there).
  let pLibT = libT;
  if (pp !== p) {
    const ph: any = await withRetry("picks head", () => pp.getHeadInfo());
    pLibT = await blockTime(pp, ph.head_topology.id, Number(ph.last_irreversible_block));
  }
  console.log(`scoring chain irreversible ${libH} (${new Date(libT).toISOString()}); picks chain irreversible ${new Date(pLibT).toISOString()}`);
  const cards = loadCards(raceData, now - (KEEP_DAYS + 2) * F.DAY_MS - M.DAY, now + M.DAY);

  // ── 1. days ──
  const prevDays: DayRec[] = (readJson(prev, "days.json")?.days || []).filter((d: any) => d && Number.isInteger(d.day) && d.final === true && d.producers && typeof d.producers === "object");
  const days = new Map<number, DayRec>(prevDays.map((d) => [d.day, d]));
  const today = F.dayNo(now);
  // The weeks this run works on: last week, this one, the next, and any earlier week (up to 8 back) not final yet.
  const wNow = F.weekOf(now), weeks = new Map<number, WeekFile>();
  const load = (w: number): WeekFile => {
    const x = readJson(prev, `W${pad(w)}.json`);
    if (x && x.v === 1 && x.week === w && x.start === F.weekStart(w)) return { ...x, pending: okPending(x.pending) ? x.pending : null };
    return { v: 1, week: w, start: F.weekStart(w), end: F.weekStart(w + 1), final: false, sheet: null, sha256: null, picks: {}, rivals: null, players: [], matches: [], pending: null };
  };
  const idx = readJson(prev, "index.json"), known = new Set<number>(Array.isArray(idx?.weeks) ? idx.weeks.filter((w: any) => Number.isInteger(w) && w >= 0 && w < 100000) : []);
  for (const w of [...known].filter((w) => w >= wNow - WEEKS_BACK && w < wNow - 1)) { const x = load(w); if (!x.final && x.sheet) weeks.set(w, x); }
  for (const w of [wNow - 1, wNow, wNow + 1]) if (w >= 0) weeks.set(w, load(w));
  const firstDay = Math.min(today - KEEP_DAYS, ...[...weeks.values()].filter((x) => !x.final && x.sheet).map((x) => F.weekDays(x.week)[0]));
  let budget = BLOCK_BUDGET;
  // Newest first, so a long backlog never holds up the days a sheet or this week needs most.
  for (let d = today - 1; d >= firstDay && budget > 0; d--) {
    if (days.get(d)?.final || F.dayStart(d + 1) > libT) continue;
    try {
      const t0 = F.dayStart(d), t1 = F.dayStart(d + 1);
      const [a, b] = await heightsOf(p, headId, libH, libT, t0, t1);
      if (b < a) continue;                                  // no blocks that day (before the chain's records)
      budget -= b - a + 1;
      const B = await readBlocks(p, headId, a, b);
      let checked = 1;
      if (check) {
        const C = await readBlocks(check, chk.head_topology.id, a, b);
        const same = C.ts.length === B.ts.length && C.ts.every((t: number, i: number) => t === B.ts[i] && C.signers[C.sig[i]] === B.signers[B.sig[i]]);
        if (!same) { problems.push(`day ${new Date(t0).toISOString()}: the two nodes disagree about its blocks; not final this run`); continue; }
        checked = 2;
      }
      const ix = F.dayIndex(B, cards, d);
      if (ix.uncovered > 0) { problems.push(`day ${new Date(t0).toISOString()}: ${ix.uncovered} hour(s) have no race card yet; not final this run`); continue; }
      days.set(d, { day: d, final: true, checked, heights: [a, b], blocks: ix.blocks, producers: ix.producers });
      console.log(`day ${new Date(t0).toISOString()}: ${ix.blocks} blocks ${a}-${b}, checked on ${checked} node(s)`);
    } catch (e) { problems.push(`day ${d}: ${(e as Error).message} (tried again next run)`); }
    await sleep(50);
  }
  if (budget <= 0) problems.push("catching up on past days: more next run");
  // Today so far: irreversible blocks only, one node, provisional (never used for points).
  let live: any = null;
  if (o.live !== false && libT > F.dayStart(today)) {
    try {
      const [a, b] = await heightsOf(p, headId, libH, libT, F.dayStart(today), libT + 1);
      if (b >= a) { const B = await readBlocks(p, headId, a, b); const ix = F.dayIndex(B, cards, today); live = { day: today, final: false, upTo: libT, heights: [a, b], blocks: ix.blocks, producers: ix.producers }; }
    } catch (e) { problems.push(`today so far: ${(e as Error).message}`); }
  }
  const dayList = [...days.values()].filter((d) => d.day >= firstDay).sort((x, y) => x.day - y.day);

  // ── 2. sheets ──
  for (const [w, wf] of weeks) {
    if (wf.sheet || now < F.sheetTime(w) || w < wNow) continue;   // never a sheet for a week already over
    const formWin = F.formDays(w).map((d: number) => days.get(d));
    if (formWin.some((d: DayRec | undefined) => !d?.final) && now < wf.start) { problems.push(`week ${w}: the price sheet waits for its form days to be final`); continue; }
    const card = F.cardAt(cards, Math.floor(F.sheetTime(w) / M.HOUR) * M.HOUR);
    if (!card) { problems.push(`week ${w}: no race card at the sheet time; no sheet yet`); continue; }
    const sheet: Sheet = F.makeSheet(w, card, formWin.filter(Boolean));
    if (!sheet.pool.length) { problems.push(`week ${w}: the card at the sheet time has no field; no sheet yet`); continue; }
    if (now >= wf.start) sheet.late = true;                 // made after the week began: the page says so
    wf.sheet = sheet;
    wf.sha256 = crypto.createHash("sha256").update(F.sheetText(sheet)).digest("hex");
    console.log(`week ${w}: price sheet ${wf.sha256.slice(0, 12)}… (${sheet.pool.length} producers${sheet.late ? ", late" : ""})`);
  }

  // ── 3. picks ──
  if (picksRead) for (const wf of weeks.values()) {
    if (wf.final) continue;
    for (const d of F.weekDays(wf.week)) {
      if (wf.picks[d] || F.dayStart(d) > pLibT) continue;
      try {
        const mine = await picksRead(pp, G.team, d);
        if (pcheck && !samePicks(await picksRead(pcheck, G.team, d), mine)) { problems.push(`week ${wf.week} day ${d}: the two nodes disagree about the picks`); continue; }
        wf.picks[d] = sortPicks(mine.filter((x) => x[1].length >= 1));
      } catch (e) { problems.push(`week ${wf.week} day ${d} picks: ${(e as Error).message}`); }
    }
    if (!wf.rivals && wf.start <= pLibT) {
      try {
        const r = F.rivalRound(wf.week), mine = await picksRead(pp, G.rival, r);
        if (pcheck && !samePicks(await picksRead(pcheck, G.rival, r), mine)) problems.push(`week ${wf.week}: the two nodes disagree about the rival challenges`);
        else wf.rivals = sortPicks(mine).filter((x) => x[1].length === 1).map((x) => [x[0], x[1][0]] as [string, string]);
      } catch (e) { problems.push(`week ${wf.week} rivals: ${(e as Error).message}`); }
    }
  }

  // ── RECORDER_STANDARD §4.2: re-check a week from the chain on both nodes before it goes final ──
  /** Every play day's blocks (re-read on both nodes at the recorded heights, the heights re-found from the day's
   *  times, the day index recomputed from the same cards) must equal the recorded day; every play day's team picks
   *  and the week's rival challenges, re-read on both Picks nodes, must equal what the week holds. "" = all agree;
   *  otherwise why not. A read failure or the time budget throws (the week waits: not final this run). */
  const verifyWeek = async (wf: WeekFile): Promise<string> => {
    const stop = Date.now() + (o.verifyBudgetMs ?? VERIFY_BUDGET_MS);
    const late = () => { if (Date.now() > stop) throw new Error("not checked yet: the re-check ran past its time budget (tried again next run)"); };
    const nodes: [any, any][] = [[p, headId]];
    if (check) nodes.push([check, chk.head_topology.id]);
    for (const d of F.weekDays(wf.week)) {
      late();
      const rec = days.get(d);
      if (!rec?.final) return `day ${d} isn't final`;
      const [a, b] = rec.heights;
      for (const [node, hid] of nodes) {
        const lib = Math.min(libH, Number((node === p ? head : chk).last_irreversible_block));
        const h = await heightsOf(node, hid, lib, libT, F.dayStart(d), F.dayStart(d + 1));
        if (h[0] !== a || h[1] !== b) return `day ${d}: its block heights read ${h[0]}-${h[1]} now, not ${a}-${b}`;
        const B = await readBlocks(node, hid, a, b), ix = F.dayIndex(B, cards, d);
        if (ix.uncovered > 0) return `day ${d}: ${ix.uncovered} hour(s) have no usable race card now`;
        if (ix.blocks !== rec.blocks || JSON.stringify(ix.producers) !== JSON.stringify(rec.producers)) return `day ${d}: its stored result isn't what the chain says now`;
      }
      if (picksRead) for (const node of [pp, ...(pcheck ? [pcheck] : [])]) {
        const now2 = sortPicks((await picksRead(node, G.team, d)).filter((x) => x[1].length >= 1));
        if (!samePicks(now2, wf.picks[d] || [])) return `day ${d}: the team picks read differently now`;
      }
    }
    if (picksRead) for (const node of [pp, ...(pcheck ? [pcheck] : [])]) {
      late();
      const r = sortPicks(await picksRead(node, G.rival, F.rivalRound(wf.week))).filter((x) => x[1].length === 1).map((x) => [x[0], x[1][0]]);
      if (JSON.stringify(r) !== JSON.stringify(wf.rivals || [])) return "the rival challenges read differently now";
    }
    return "";
  };

  // ── 4. scores ──
  const rivalsPrev = readJson(prev, "rivals.json");
  let records = rivalsPrev?.records && typeof rivalsPrev.records === "object" && !Array.isArray(rivalsPrev.records) ? rivalsPrev.records : {};
  const counted = new Set<number>(Array.isArray(rivalsPrev?.weeks) ? rivalsPrev.weeks.filter((w: any) => Number.isInteger(w)) : []);
  // WEEK_CYCLE §2 (D-125, D-135): a week can go final from its end (Monday 00:00 UTC), never during Sunday's review
  // day, and only after two runs at least AGREE_GAP apart agree (1 hour on the real clock).
  const AGREE_GAP = Math.min(3600000, F.DAY_MS / 24);
  const allPrev = readJson(prev, "alltime.json");
  let allTime = allPrev?.players && typeof allPrev.players === "object" && !Array.isArray(allPrev.players) ? allPrev.players : {};
  const allCounted = new Set<number>(Array.isArray(allPrev?.weeks) ? allPrev.weeks.filter((w: any) => Number.isInteger(w)) : []);
  // D-129: the Sunday fun rounds already added to the All time table (day numbers), so each is added once.
  const funCounted = new Set<number>(Array.isArray(allPrev?.sundays) ? allPrev.sundays.filter((d: any) => Number.isInteger(d)) : []);
  // Stakes, read on both nodes (they must agree). The vault's Fantasy stakers once the vault is live; until then the
  // vault points rank everyone (vaultBasis "all") and no vault file is written.
  const gs = gameStakes();
  const stakedOf = o.stakedOf !== undefined ? o.stakedOf : async (who: string[], wk: number) => {
    const a = await gs(p, who, wk);
    if (check) {
      const b = await gs(check, who, wk);
      if ((a === null) !== (b === null) || (a && b && (a.size !== b.size || [...a].some((x) => !b.has(x))))) throw new Error("the two nodes disagree about the Fantasy stakes");
    }
    return a;
  };
  // Is the vault live? (Its get_state on the scoring node; a failed read stops the run rather than guess.)
  const live6 = !!stakedOf && (await stakedOf([], wNow)) !== null;
  const freePrize = o.freePrize ?? E.FANTASY_FREE_PRIZE === "on";
  let todayRows: { a: string; pts: number; staked: boolean }[] = [];
  // Rival matches: both players staked in Fantasy that week (vault live), else a Knode Games stake (v5).
  const stakedRead = o.rivalStaked === undefined ? (live6 ? null : (who: string[], node: any) => readStaked(node, who)) : o.rivalStaked;
  const rivalByVault = o.rivalStaked === undefined && live6;
  for (const w of [...weeks.keys()].sort((x, y) => x - y)) {
    const wf = weeks.get(w)!;
    if (wf.final || !wf.sheet || now < wf.start) continue;
    const wd = F.weekDays(w), recs = wd.map((d: number) => days.get(d) || { day: d, producers: {} });
    // Each player's pick for each day (the contract keeps one per round: the latest); the team carried in = the
    // player's last team of last week.
    const byPlayer = new Map<string, Record<number, string[]>>();
    for (const [d, rows] of Object.entries(wf.picks)) for (const [who, list] of rows) { const m = byPlayer.get(who) || {}; m[Number(d)] = list; byPlayer.set(who, m); }
    const last = weeks.get(w - 1) || (w > 0 ? load(w - 1) : null);
    const carried = new Map<string, string[]>();
    const lastI = F.PLAY_DAYS - 1;                       // Saturday, the last play day: the team that carries into Monday
    for (const x of last?.players || []) { const t = Array.isArray(x.days?.[lastI]) ? F.unpackTeam(last!.sheet, x.days[lastI][0]) : null; if (t) carried.set(x.a, t); }
    for (const a of carried.keys()) if (!byPlayer.has(a)) byPlayer.set(a, {});
    const rows = [...byPlayer].map(([a, picks]) => { const s = F.scoreWeek(wf.sheet, recs, picks, carried.get(a) || null); return { a, points: s.points, vault: 0, full: s.full, days: s.days }; })
      .filter((r) => r.days.some((d: any) => d.team));
    // Stakes every run (the Staked and Free play boards), read on both nodes; a failed read keeps the week unfinished.
    let staked: Set<string> | null = null, stakesKnown = !live6;
    if (live6 && stakedOf) { try { staked = await stakedOf(rows.map((r) => r.a), w); stakesKnown = staked !== null; } catch (e) { problems.push(`week ${w}: stakes: ${(e as Error).message}`); } }
    const vp = F.vaultPoints(rows, staked || new Set());
    if (w === wNow && live && F.isPlayDay(today)) {
      const i = wd.indexOf(today);
      todayRows = rows.map((r: any) => ({ a: r.a, pts: F.dayScore(r.days[i]?.team || null, live), staked: !!staked?.has(r.a) })).filter((x) => isAddr(x.a));
    } else if (w === wNow && live && today === F.sundayOf(w)) {
      // D-129 Sunday fun round: the Saturday team plays on; Today shows it (never the week's board).
      todayRows = rows.map((r: any) => ({ a: r.a, pts: F.dayScore(r.days[lastI]?.team || null, live), staked: !!staked?.has(r.a) })).filter((x) => isAddr(x.a) && x.pts > 0);
    }
    wf.players = F.rank(rows.map((r) => ({ ...r, vault: vp.get(r.a) || 0 }))).map((r: any) => ({ a: r.a, points: r.points, vault: r.vault, full: r.full, place: r.place, staked: !!staked?.has(r.a),
      days: r.days.map((d: any) => (d.note ? [F.packTeam(wf.sheet, d.team), d.score, d.note] : [F.packTeam(wf.sheet, d.team), d.score])) }));
    const allFinal = recs.every((d: any) => d.final);
    // Final only with every day's blocks AND every day's picks read (audit FX-1), the rivals read, the stakes known.
    const allPicks = !picksRead || F.weekDays(w).every((d: number) => Array.isArray(wf.picks[d]));
    // Rival matches count only between two staked wallets, read on both nodes when the week is finished.
    let rivalOk: Set<string> | null = null, rivalReady = true;
    const inRivals = [...new Set((wf.rivals || []).flat())];
    if (allFinal && allPicks && now >= wf.end && stakedRead && inRivals.length) {
      try {
        rivalOk = await stakedRead(inRivals, p);
        if (check) { const other = await stakedRead(inRivals, check); if (other.size !== rivalOk.size || [...rivalOk].some((a) => !other.has(a))) { rivalReady = false; problems.push(`week ${w}: the two nodes disagree about who is staked; not final this run`); } }
      } catch (e) { rivalReady = false; problems.push(`week ${w}: stakes for the rival matches: ${(e as Error).message}`); }
    }
    if (rivalByVault) rivalOk = staked;
    if (allFinal && allPicks && rivalReady && stakesKnown && now >= wf.end && (wf.rivals || !picksRead)) {
      const pts = Object.fromEntries(wf.players.map((x) => [x.a, { points: x.points, full: x.full }]));
      const matches = F.matches(wf.rivals || [], pts, stakedRead || rivalByVault ? rivalOk || new Set() : null);
      const hash = resultHash(wf.players, matches);
      let why = "";
      const agreed = !!wf.pending && wf.pending.hash === hash && now - wf.pending.at >= AGREE_GAP;
      if (agreed) {
        // §4.2: the run that makes the week final re-checks it from the chain on both nodes first.
        try { why = await verifyWeek(wf); } catch (e) { why = `wait: ${(e as Error).message}`; }
        if (why && !why.startsWith("wait: ")) problems.push(`ALERT week ${w} is held: ${why}. Not final; the owner checks it (a final file is never changed).`);
        else if (why) problems.push(`week ${w}: ${why.slice(6)}`);
      }
      if (!agreed || why) {
        // First sight of this result (or it changed): wait for a later run to agree (two-run rule).
        if (!wf.pending || wf.pending.hash !== hash) wf.pending = { hash, at: now };
        if (!why) console.log(`week ${w}: settled, pending; final once a run from ${new Date(wf.pending.at + AGREE_GAP).toISOString()} agrees`);
      } else {
        wf.final = true;
        wf.pending = null;
        wf.picks = {};                                       // in the players' days now; the file stays small
        wf.matches = matches;
        if (!allCounted.has(w)) { allTime = F.addAllTime(allTime, wf.players); allCounted.add(w); }
        if (!counted.has(w)) { records = F.addRecords(records, wf.matches); counted.add(w); }
        console.log(`week ${w}: final, ${wf.players.length} players, ${wf.matches.length} rival matches`);
      }
    }
    if (!wf.final && now >= wf.end + 2 * F.DAY_MS)
      problems.push(`ALERT week ${w} is still not final ${Math.floor((now - wf.end) / F.DAY_MS)} days after it ended (days final: ${recs.filter((d: any) => d.final).length}/${wd.length}, picks read: ${F.weekDays(w).filter((d: number) => Array.isArray(wf.picks[d])).length}/${wd.length}, rivals ${wf.rivals ? "read" : "not read"}). The vault needs results within 3 days.`);
  }

  // D-129: each final week's Sunday fun round goes into the All time table once its day is final (points only; never
  // the week, its board, medals or vault file). The Saturday team is the one stored in the final week's day 6.
  for (const [w, wf] of weeks) {
    const d = F.sundayOf(w), rec = days.get(d);
    if (!wf.final || !wf.sheet || !rec?.final || funCounted.has(d)) continue;
    const sat = wf.players.map((x) => ({ a: x.a, staked: !!x.staked, satTeam: Array.isArray(x.days?.[F.PLAY_DAYS - 1]) && x.days[F.PLAY_DAYS - 1][0] ? F.unpackTeam(wf.sheet, x.days[F.PLAY_DAYS - 1][0]) : null }));
    allTime = F.addFun(allTime, F.funScores(sat, rec));
    funCounted.add(d);
    console.log(`week ${w}: Sunday fun round added to All time`);
  }

  // ── 5. write ──
  fs.mkdirSync(out, { recursive: true });
  for (const [w, wf] of weeks) {
    if (!wf.sheet && !wf.players.length) continue;
    known.add(w);
    fs.writeFileSync(path.join(out, `W${pad(w)}.json`), JSON.stringify(wf) + "\n");
  }
  // The vault's file for each final week (claude/handoff-vault-results.md): game 4, the vault week, the staked players'
  // points 1..255 (order and ties kept). Only when the points were ranked among the vault's Fantasy stakers. Written
  // again on every run while the week is loaded, always the same, so a failed publish can't lose it.
  if (live6) for (const [w, wf] of weeks) {
    if (!wf.final) continue;
    const fw = F.freeWinners(wf.players);
    for (const n of fw.over) problems.push(`vault week ${w}: more than ${F.FREE_PER_PLACE} wallets tied for free place ${n} (the vault takes at most ${F.FREE_PER_PLACE}); that place is left empty`);
    fs.mkdirSync(path.join(out, "vault"), { recursive: true });
    fs.writeFileSync(path.join(out, "vault", `W${w}.json`), JSON.stringify(vaultFile(w, wf.players)) + "\n");
  }
  fs.writeFileSync(path.join(out, "days.json"), JSON.stringify({ v: 1, days: dayList, live }) + "\n");
  fs.writeFileSync(path.join(out, "rivals.json"), JSON.stringify({ v: 1, weeks: [...counted].sort((x, y) => x - y), records }) + "\n");
  fs.writeFileSync(path.join(out, "alltime.json"), JSON.stringify({ v: 1, weeks: [...allCounted].sort((x, y) => x - y), sundays: [...funCounted].sort((x, y) => x - y), players: allTime }) + "\n");
  // The leaderboard in the shared shape (board.js, the Leaders page; LEADERBOARD_STANDARD): Today / This week / Last
  // week / All time, each row on its own board (ranked = Staked; everyone else = Free play), its place on that board
  // (boardPlace, ties share), and earns (3 = a share of Fantasy's bucket; 1 or 2 = a free prize, only when the switch is
  // on; weekly views only). Weekly Rival lists stay in the same file.
  const playDays = (x: PlayerRow) => (Array.isArray(x.days) ? x.days.filter((d) => Array.isArray(d) && Array.isArray(d[0])).length : 0);
  const weekBoard = (w: number) => {
    const wf = weeks.get(w);
    if (!wf || !wf.sheet || now < wf.start) return null;
    const pl = wf.players, own = F.boardPlaces(pl), earn = F.stakedEarners(pl), fw = F.freeWinners(pl);
    const prize = (a: string) => (!freePrize ? 0 : fw.first.includes(a) ? 1 : fw.second.includes(a) ? 2 : 0);
    const rows = F.rank(pl).map((x: any) => ({ a: x.a, pts: x.points, days: playDays(x), full: x.full, ranked: !!x.staked, boardPlace: own.get(x.a) || x.place,
      earns: earn.has(x.a) ? 3 : !x.staked ? prize(x.a) : 0 }));
    const prizes = freePrize && wf.final ? [...fw.first.map((a: string) => ({ player: a, place: 1 })), ...fw.second.map((a: string) => ({ player: a, place: 2 }))] : [];
    return { week: w, start: F.weekStart(w), final: wf.final, rows, prizes };
  };
  const todayOwn = F.boardPlaces(todayRows.map((x) => ({ a: x.a, points: x.pts, staked: x.staked })));
  const todayBoard = F.isPlayDay(today) || todayRows.length ? { day: new Date(F.dayStart(today)).toISOString().slice(0, 10),
    rows: F.rank(todayRows.map((x) => ({ a: x.a, points: x.pts, staked: x.staked }))).map((x: any) => ({ a: x.a, pts: x.points, ranked: x.staked, boardPlace: todayOwn.get(x.a) || x.place, earns: 0 })) } : null;
  const atRows = F.allTimeRows(allTime).slice(0, 2000), atOwn = F.boardPlaces(atRows);
  const rivalRows = Object.entries(records).map(([a, x]: [string, any]) => ({ a, ...F.recordLine(x), made: x.made, received: x.received }))
    .filter((r) => isAddr(r.a) && r.n >= 4).sort((x, y) => y.pct - x.pct || y.n - x.n || (x.a < y.a ? -1 : 1));
  const cur = weeks.get(wNow), challenged = new Map<string, number>();
  for (const [, b] of cur?.rivals || []) challenged.set(b, (challenged.get(b) || 0) + 1);
  const most = [...challenged].sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1)).slice(0, 5).map(([a, n]) => ({ a, n }));
  fs.writeFileSync(path.join(out, "board.json"), JSON.stringify({ v: 1, updated: new Date(now).toISOString(), freePrize, today: todayBoard, week: weekBoard(wNow), lastWeek: weekBoard(wNow - 1),
    allTime: { rows: atRows.map((x: any) => ({ a: x.a, pts: x.points, weeks: x.weeks, best: x.best, ranked: x.staked, boardPlace: atOwn.get(x.a) || x.place, earns: 0 })) },
    rivals: rivalRows, mostChallenged: most }) + "\n");
  fs.writeFileSync(path.join(out, "index.json"), JSON.stringify({ v: 1, updated: new Date(now).toISOString(), weeks: [...known].sort((x, y) => x - y),
    contract: contract || null, games: G, clock: { day: F.DAY_MS, genesis: F.clock.genesis, sheetBefore: F.clock.sheetBefore }, vaultBasis: live6 ? "staked" : "all" }) + "\n");
  for (const pr of problems) console.log(`::warning::${pr.replace(/[\r\n]+/g, " ").replace(/::/g, ": ")}`);
  return { problems, weeks, days: dayList, live };
}

/** WEEK_CYCLE §2: the fingerprint two runs must agree on before a week is final (the players' rows, in order, and the
 *  rival matches). Exported for the tests. */
export const resultHash = (players: unknown, matches: unknown) => crypto.createHash("sha256").update(JSON.stringify({ players, matches })).digest("hex");
const okPending = (x: any) => !!x && typeof x === "object" && typeof x.hash === "string" && /^[0-9a-f]{64}$/.test(x.hash) && Number.isInteger(x.at) && x.at > 0;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const RPC = E.RPC || "https://koinos.armana.io";
  const RPC_CHECK = E.RPC_CHECK && E.RPC_CHECK !== "off" && E.RPC_CHECK !== RPC ? E.RPC_CHECK : "";
  run({ p: new Provider([RPC]), check: RPC_CHECK ? new Provider([RPC_CHECK]) : null }).catch((e) => { console.error(e); process.exit(1); });
}
