/**
 * Block Golf recorder (run every hour by .github/workflows/golf.yml; read-only, holds no key, writes nothing on chain).
 *
 * Block Golf has no picks of its own: each live game is a hole, and a player's place on that game's weekly leaderboard
 * sets their strokes (golf-math.js, the same file the page runs). Each run:
 *  1. The course. Every game marked live in games.json that has a reader below joins the course from the first
 *     full week after it went live (index.json "course" remembers the week each joined, and never forgets it). On the
 *     very first run the games already live join at once. A week's holes are fixed the first time the week is
 *     recorded (its W file), so a game that leaves games.json mid-week stays a hole of that week.
 *  2. Each hole's standings for this week and last week, from that game's own published results (never recomputed):
 *       questions  the question game contract, read on two nodes that must agree: each answer to a resolved question
 *                  scores 1 if right (as the site does); final when the week is closed and every question resolved.
 *                  Daily Questions' entry rule: at least 2 counted answers and at least 1 point (Repo Lens G-7).
 *       race       race-data/board.json (this week / last week); final when every race of the week is final AND the
 *                  Race's own vault file for the week (race-data/vault/W<w>.json) is final (Repo Lens G-3); a week the
 *                  Race never finalizes is skipped at the 60-hour deadline.
 *       blockx     games-data/blockx/board.json; final when its last week says final
 *     Survivor, Bracket and the other games add their reader here when they launch (with a test).
 *     The field of a hole: practice weeks, every wallet that scored on it; staked weeks, the wallets staked in Block
 *     Golf that week (vault v6, game 6, read on two nodes) that scored on it (owner, 2026-10-28). See golf-math.js.
 *  3. Each hole's standings are kept in the week file as they were last read, so a game's board rolling on to a new
 *     week never loses them. A hole that was final once the week ended stays final: a later bad read never undoes it.
 *  4. A week is pending (Sunday's review day included) until it ends at Monday 00:00 UTC; it goes final once every hole
 *     is final, the run read everything without a problem, and two runs at least an hour apart read exactly the same
 *     week (the "check" fingerprint; standards/WEEK_CYCLE.md, D-125, D-129);
 *     a hole still not final 60 hours after the week ends is skipped for everyone (never guessed), and from 66 hours a
 *     read problem no longer holds the week back, so the week's points reach the vault within its 3-day window.
 *     A final week is never recomputed. Whether a week is practice or staked is fixed when it is first recorded.
 *  5. Writes index.json, W<week>.json and board.json (Today and This week: this week so far; Last week; All time:
 *     final weeks only), and for each final staked week the Vault's file vault/W<week>.json (game 6, the staked
 *     players' points). The publish job checks their shape and pushes them to the data branch.
 * Safety: a previous run's files that exist but can't be read stop the run (never treated as a fresh start).
 *
 *   npm run golf     (RPC, RPC_CHECK, GOLF_PREV, GOLF_OUT, RACE_DATA, GAMES_DATA, GOLF_STAKED_FROM_WEEK)
 */
import { Provider, Contract } from "koilib";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { withRetry } from "../../common.ts";
await import("../../race-math.js");
await import("../../golf-math.js");
const M: any = (globalThis as any).KRaceMath;
const G: any = (globalThis as any).KGolf;

const E = process.env;
const HOUR = 3600000;
// The weekly rhythm (D-125, D-129, standards/WEEK_CYCLE.md): a week can go final no earlier than Monday 00:00 UTC (the
// end of the vault week), and only once two runs at least an hour apart have read exactly the same week (the "check").
// Until then it is published as pending (final: false). Sunday is the review day for every game Golf reads.
const FINAL_WAIT_MS = 0;
const TWO_RUN_GAP_MS = 1 * HOUR;
const DEADLINE_MS = 60 * HOUR;                // a hole not final 60 hours after its week ends is skipped
const FORCE_MS = 66 * HOUR;                   // after this, a read problem no longer holds the week back (fix-check N1)
const ONE_VHP = 100000000n;
const MAX_ROWS = 100000;
const MAX_PAGES = 2000;                       // question game: up to 100,000 players a week, else the read fails
const GOLF_GAME_ID = 6;                       // Block Golf in the vault registry (game id registry, 2026-10-28)
const isAddr = (a: unknown): a is string => typeof a === "string" && G.isAddr(a);

export type Row = { a: string; score: number; scored: boolean; ranked: boolean | number };   // number: whole VHP staked (staked weeks)
/** stale: the game's files have moved past this week, so only standings kept from an earlier run can be used.
 *  atDeadline: what to do if the hole is still not final at the deadline ("skip", or "use" these standings). */
/** failed: this run couldn't read it (a read problem: holds the week, or keeps a final hole as it was), with the
 *  reason in problem (Repo Lens F-3: never silent). */
export type Read = { state: "final" | "live" | "none"; rows: Row[]; why?: string; stale?: boolean; atDeadline?: "skip" | "use"; failed?: boolean; problem?: string };
export type Source = { id: string; name: string; reader: string; live: boolean };
type HoleRec = { id: string; name: string; status: "final" | "live" | "skipped"; why: string; field: number; rows: [string, number, 0 | 1, number][] };   // [player, score, scored, weight: 0/1, or whole VHP staked in staked weeks]
type CardRec = { a: string; ranked: boolean; free: boolean; place: number; pts: number; strokes: number; par: number; toPar: number; lost: number; under: number; best: number; mulligan: string; holes: [string, number, number | null, number | null][] };
/** check: while a week waits to go final, the fingerprint of its holes and cards and the run that first read it; a
 *  later run (an hour or more after) that reads the same fingerprint makes it final. null otherwise. */
type Check = { sig: string; at: number };
/** notFree: wallets staked in Block Golf at some point that week (peak at least the minimum, Repo Lens G-1): never on
 *  the Free play prize list, even with no counted stake left. Empty in practice weeks. */
type WeekFile = { v: 1; week: number; start: number; end: number; final: boolean; practice: boolean; holes: HoleRec[]; cards: CardRec[]; notFree: string[]; check: Check | null };
/** The week's fingerprint: its holes and scorecards, as they would be published. */
export const weekSig = (holes: HoleRec[], cards: CardRec[], notFree: string[]) => crypto.createHash("sha256").update(JSON.stringify({ holes, cards, notFree })).digest("hex");
/** counted: answers on questions that resolved and weren't voided (Daily Questions' own entry rule, Repo Lens G-7). */
export type QWeek = { closed: boolean; questions: number; resolved: number; rows: { a: string; pts: number; answered: number; counted?: number }[] };
/** Block Golf stakes for a week: whole VHP counted (week_stake at least the minimum) and who reached the minimum at
 *  any point that week (peak). A test may return a plain Map of counted stakes; then peak = the counted stakers. */
export type Stakes = { weights: Map<string, number>; peaked: Set<string> };

export type Opts = {
  now?: number;
  p?: any; check?: any | null;
  prev?: string; out?: string;
  raceDir?: string; gamesDir?: string;                 // race-data and games-data files
  sources?: Source[];                                  // the games that can be holes (default: games.json)
  minField?: number;                                   // overrides the rules' minimum (tests)
  stakedFromWeek?: number | null;                      // the first staked week (null: every week is practice)
  knodeGame?: string | null; vhpContract?: string;
  questionsOf?: (node: any, week: number) => Promise<QWeek>;           // for the tests
  golfStakersOf?: (node: any, who: string[], week: number) => Promise<Map<string, number> | Stakes>;   // for the tests
  holdWeeks?: string;                                  // GOLF_HOLD_WEEKS (tests); default: the environment
};

// ── files ──
const MAX_FILE = 20 * 1024 * 1024;
function readJson(dir: string | undefined, name: string): any {
  if (!dir) return null;
  const f = path.join(dir, name);
  try { if (fs.lstatSync(f).isSymbolicLink() || fs.statSync(f).size > MAX_FILE) return null; return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; }
}
/** Why a file that IS there can't be used (Repo Lens B13-A2), or "" if it is absent or readable. */
function broken(dir: string | undefined, name: string): string {
  if (!dir) return "";
  try { fs.lstatSync(path.join(dir, name)); } catch { return ""; }
  return unreadable(dir, name);
}
/** Why a game's file couldn't be used (Repo Lens F-3), or "" if it can be read. B13-A3: a file holding JSON null
 *  (or anything that isn't an object) is reported too. */
function unreadable(dir: string | undefined, name: string): string {
  if (!dir) return "its folder wasn't given to this run";
  const f = path.join(dir, name);
  let st: fs.Stats;
  try { st = fs.lstatSync(f); } catch { return `${name} isn't there`; }
  if (st.isSymbolicLink()) return `${name} is a link (not read)`;
  if (st.size > MAX_FILE) return `${name} is over ${MAX_FILE / 1024 / 1024} MB (not read)`;
  try { const j = JSON.parse(fs.readFileSync(f, "utf8")); return j && typeof j === "object" ? "" : `${name} isn't a results file`; } catch { return `${name} can't be read as JSON`; }
}
const exists = (dir: string | undefined, name: string) => { if (!dir) return false; try { fs.lstatSync(path.join(dir, name)); return true; } catch { return false; } };
const wName = (w: number) => `W${String(w).padStart(3, "0")}.json`;
const MAINNET_KNODE_GAME = (() => { try { return JSON.parse(fs.readFileSync(new URL("../../game-data/deployment.json", import.meta.url), "utf8")).contract as string; } catch { return ""; } })();
const GAME_ABI = () => JSON.parse(fs.readFileSync(new URL("../../game/abi/kpred.koilib.json", import.meta.url), "utf8"));

/** Every game in games.json that has a reader, and whether it is live. */
export function sourcesFromGames(file: URL | string = new URL("../../games.json", import.meta.url)): Source[] {
  let list: any[] = [];
  try { list = JSON.parse(fs.readFileSync(file, "utf8")).games; } catch { return []; }
  return (Array.isArray(list) ? list : []).filter((g) => g && typeof g.id === "string" && g.id !== "golf" && READERS[g.id])
    .map((g) => ({ id: g.id, name: cleanName(g.name, g.id), reader: g.id, live: g.status === "live" }));
}

// ── readers: one per game, each turning that game's own published results into hole rows ──
/** A shared-shape board.json's view of week w: its "week" or "lastWeek". */
function boardView(b: any, w: number): { view: any; last: boolean } | null {
  if (!b || b.v !== 1) return null;
  if (b.week && b.week.week === w && Array.isArray(b.week.rows)) return { view: b.week, last: false };
  if (b.lastWeek && b.lastWeek.week === w && Array.isArray(b.lastWeek.rows)) return { view: b.lastWeek, last: true };
  return null;
}
/** The board has moved past week w (its oldest week shown is later), so it will never show week w again. */
function movedOn(b: any, w: number): boolean {
  if (!b || b.v !== 1) return false;
  const shown = [b.week, b.lastWeek].filter((x: any) => x && Number.isInteger(x.week)).map((x: any) => x.week);
  return shown.length > 0 && Math.min(...shown) > w;
}
/** A score as Golf stores it: finite, 0 to 1e12, rounded to 4 decimals. Repo Lens F-2: JS and Python then write it with
 *  the same bytes (Python writes 1e-05 for 0.00001, JS 0.00001), so the week's fingerprint matches on both sides. */
export const cleanScore = (x: unknown): number | null => (typeof x === "number" && isFinite(x) && x >= 0 && x <= 1e12 ? Math.round(x * 10000) / 10000 : null);
/** A display name: at most 40 characters (code points, never half an emoji), no lone surrogates (F-2). */
export const cleanName = (x: unknown, fallback: string): string => {
  const s = typeof x === "string" ? Array.from(x).slice(0, 40).join("") : "";
  return s && !/[\uD800-\uDFFF]/.test(s.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "")) ? s : fallback;
};
const ptsRows = (rows: any[], key = "pts"): Row[] => rows.slice(0, MAX_ROWS).filter((r) => r && isAddr(r.a) && cleanScore(r[key]) !== null)
  .map((r) => { const score = cleanScore(r[key])!; return { a: r.a, score, scored: score > 0, ranked: r.ranked === true }; });
const KEPT: Read = { state: "final", rows: [], why: "standings kept from an earlier run", stale: true };

type Ctx = { now: number; raceDir?: string; gamesDir?: string; o: Opts; questions: (w: number) => Promise<Read> };
const READERS: Record<string, (src: Source, w: number, c: Ctx) => Promise<Read>> = {
  async questions(_s, w, c) { return c.questions(w); },

  async race(_s, w, c) {
    const b = readJson(c.raceDir, "board.json");
    if (!b) return { state: "live", rows: [], why: "couldn't read the race results this run", failed: true, problem: `race-data ${unreadable(c.raceDir, "board.json")}` };
    // Repo Lens G-3: the Race's own week is final only once its vault file is (its two-run check, its chain re-check
    // and the owner's RACE_HOLD_WEEKS). Golf waits for that file, even when the board has moved on.
    const rv = readJson(path.join(c.raceDir || "", "vault"), `W${w}.json`);
    // B13-A2: the Race's week files are said aloud too when they are there but can't be used.
    const fail = (why: string) => ({ state: "live" as const, rows: [], why: "couldn't read the race results this run", failed: true, problem: `race-data ${why}` });
    const vBad = broken(path.join(c.raceDir || "", "vault"), `W${w}.json`);
    if (vBad) return fail(`vault/${vBad}`);
    const raceWeekFinal = !!rv && rv.final === true && rv.week === w;
    const v = boardView(b, w);
    if (!v) return movedOn(b, w) ? (raceWeekFinal ? { ...KEPT } : { ...KEPT, state: "live", why: "waiting for the Race's own week to be final" }) : { state: "live", rows: [], why: "waiting for the race results" };
    const end = M.weekStart(w + 1);
    let final = false;
    if (c.now >= end) {
      const wBad = broken(c.raceDir, wName(w));
      if (wBad) return fail(wBad);
      const wf = readJson(c.raceDir, wName(w));
      const races = wf && Array.isArray(wf.races) ? wf.races.filter((r: any) => r && r.start >= M.weekStart(w) && r.start < end) : [];
      final = races.length > 0 && races.every((r: any) => r.result && r.result.final === true);
    }
    // A week the Race never finalizes is skipped at the deadline, never guessed from the board.
    return { state: final && raceWeekFinal ? "final" : "live", rows: ptsRows(v.view.rows), why: final && !raceWeekFinal ? "waiting for the Race's own week to be final" : undefined };
  },

  async blockx(_s, w, c) {
    const b = readJson(path.join(c.gamesDir || "", "blockx"), "board.json");
    if (!b) return { state: "live", rows: [], why: "couldn't read the Block X results this run", failed: true, problem: `games-data ${unreadable(path.join(c.gamesDir || "", "blockx"), "board.json")}` };
    const v = boardView(b, w);
    if (!v) return movedOn(b, w) ? { ...KEPT } : { state: "live", rows: [], why: "waiting for the Block X results" };
    return { state: v.last && v.view.final === true ? "final" : "live", rows: ptsRows(v.view.rows) };
  },
};
export const READABLE = Object.keys(READERS);

// ── the question game: answers, outcomes and the week ──
async function readQuestions(node: any, knodeGame: string, w: number): Promise<QWeek> {
  const c = new Contract({ id: knodeGame, abi: GAME_ABI(), provider: node });
  const f: any = c.functions;
  const wk: any = (await withRetry(`week ${w}`, () => f.get_week({ week: String(w) })))?.result?.week ?? {};
  const players: any[] = [];
  let start = "", done = false;
  for (let i = 0; i < MAX_PAGES; i++) {
    const page: any[] = (await withRetry(`players of week ${w}`, () => f.list_players({ start, limit: 50, week: String(w) })))?.result?.rows ?? [];
    players.push(...page);
    if (page.length < 50) { done = true; break; }
    start = page[page.length - 1].address;
  }
  if (!done) throw new Error(`more than ${MAX_PAGES * 50} players in week ${w}: not read`);
  const ids = new Set<number>();
  for (const p of players) for (const a of p?.entry?.answers ?? []) ids.add(Number(a.question_id));
  const outcome = new Map<number, number>();
  for (const id of ids) outcome.set(id, Number((await withRetry(`question ${id}`, () => f.get_question({ id })))?.result?.question?.outcome ?? 0));
  const rows: QWeek["rows"] = [];
  for (const p of players) {
    if (!isAddr(p?.address) || !p.entry || p.entry.voided) continue;
    let pts = 0, answered = 0, counted = 0;
    for (const a of p.entry.answers ?? []) {
      answered++;
      const o = outcome.get(Number(a.question_id)) ?? 0;
      if (o !== 0 && o !== 1000) counted++;
      if (o !== 0 && o !== 1000 && o === Number(a.option) + 1) pts++;
    }
    if (answered) rows.push({ a: p.address, pts, answered, counted });
  }
  rows.sort((x, y) => (x.a < y.a ? -1 : 1));
  return { closed: !!wk.closed, questions: Number(wk.questions ?? 0), resolved: Number(wk.resolved ?? 0), rows };
}
/** Staked weeks: the whole VHP each player has staked in Block Golf for week w (vault v6 get_game_player: the stake
 *  that counts for that week; under 1 VHP = not staked). A failed read throws; it never quietly drops a player. */
async function readGolfStakers(node: any, vault: string | null, who: string[], w: number): Promise<Stakes> {
  if (!who.length) return { weights: new Map(), peaked: new Set() };
  if (!vault) throw new Error("no vault contract");
  const c = new Contract({ id: vault, abi: GAME_ABI(), provider: node });
  const f: any = c.functions;
  if (typeof f.get_game_player !== "function") throw new Error("the vault (v6) isn't live: its ABI has no get_game_player");
  const st: any = await withRetry("vault state", () => f.get_state({}));
  const config = st?.result?.config;
  if (!config || typeof config !== "object") throw new Error("no answer reading the vault's config");
  const reads: { a: string; weekStake: string; peak: string }[] = [];
  for (const a of who) {
    const r: any = await withRetry(`Block Golf stake of ${a}`, () => f.get_game_player({ player: a, game: GOLF_GAME_ID, week: String(w) }));
    if (!r || typeof r !== "object") throw new Error(`no answer reading the Block Golf stake of ${a}`);
    reads.push({ a, weekStake: String(r.result?.week_stake ?? "0"), peak: peakOf(r.result) });
  }
  return { weights: stakersFrom(reads, config, w), peaked: peakedFrom(reads, config, w) };
}
/** The most a wallet had staked in Block Golf that week: the entry's peak_stake or stake, else the active stake (the
 *  same reading as Block X's vaultView, Repo Lens G-1). */
export function peakOf(r: any): string {
  const n = (x: any) => (/^\d{1,30}$/.test(String(x ?? "")) ? BigInt(String(x)) : 0n);
  const e = r?.entry;
  const peak = e ? [n(e.peak_stake), n(e.stake)].reduce((x, y) => (y > x ? y : x)) : n(r?.active_stake);
  return peak.toString();
}
/** Who reached that week's minimum in Block Golf at any point (peak): they can't take the Free play prize that week. */
export function peakedFrom(reads: { a: string; weekStake: string; peak?: string }[], config: any, w: number): Set<string> {
  const min = minStakeFor(config, w), out = new Set<string>();
  for (const { a, weekStake, peak } of reads) {
    if (!isAddr(a)) continue;
    const top = [weekStake, peak ?? "0"].filter((x) => /^\d{1,30}$/.test(x)).map(BigInt).reduce((x, y) => (y > x ? y : x), 0n);
    if (top >= min) out.add(a);
  }
  return out;
}

/** GOLF_HOLD_WEEKS: "5" or "5, 6" (vault week numbers, separated by commas), the same fail-closed rule as the Race's
 *  RACE_HOLD_WEEKS (Repo Lens #D-5 R85-1): if it is set but any part isn't a plain week number, `bad` is true and every
 *  week waiting to go final is held until it's fixed. Empty or unset: no hold. */
export function parseHoldWeeks(v: string | undefined): { weeks: number[]; bad: boolean; raw: string } {
  const raw = String(v ?? "").trim();
  if (!raw) return { weeks: [], bad: false, raw };
  const parts = raw.split(",").map((x) => x.trim());
  const bad = parts.some((x) => !/^[0-9]{1,4}$/.test(x));
  return { weeks: bad ? [] : parts.map(Number), bad, raw };
}

/** The Vault's minimum stake for week w (its own minStakeFor: a new minimum applies from its first week). */
export function minStakeFor(config: any, w: number): bigint {
  const next = BigInt(config?.min_stake_next || "0"), nextWeek = BigInt(config?.min_stake_next_week || "0");
  const min = next > 0n && BigInt(w) >= nextWeek ? next : BigInt(config?.min_stake || "0");
  return min > ONE_VHP ? min : ONE_VHP;            // never under 1 VHP (the owner's player rule)
}
/** Who is staked in Block Golf for week w, and with how many whole VHP: week_stake (the stake that counts for that
 *  week, at its lowest; 0 if the whole stake was withdrawn) at least that week's minimum (handoff, 2026-10-29). */
export function stakersFrom(reads: { a: string; weekStake: string }[], config: any, w: number): Map<string, number> {
  const min = minStakeFor(config, w), out = new Map<string, number>();
  for (const { a, weekStake } of reads) {
    if (!isAddr(a) || !/^\d{1,30}$/.test(weekStake)) continue;
    const s = BigInt(weekStake);
    if (s < min) continue;
    const whole = s / ONE_VHP;
    out.set(a, Number(whole > 1000000000n ? 1000000000n : whole));
  }
  return out;
}

/** The Vault's results file for one final staked week. */
export const MAX_PER_PLACE = 10;                 // the Vault's limit of wallets per prize place
/** The Vault's results file for one final staked week.
 *  rows: the Block Golf stakers with 1+ points. first/second: the Free play board's 1st and 2nd (players NOT staked in
 *  Block Golf that week, with 1+ points; owner D-081). Ties share a place; 2nd is listed only if 1st is untied; a place
 *  with more than 10 tied is left empty. They are always written; the vault bot holds them back while the owner's free
 *  prize switch for game 6 is off (D-082). */
export function vaultFile(wf: { week: number; cards: CardRec[] }, problems: string[] = []) {
  const ok = (c: CardRec) => isAddr(c.a) && Number.isInteger(c.pts) && c.pts >= 1;
  const rows = wf.cards.filter((c) => c.ranked && ok(c))
    .map((c) => ({ player: c.a, points: Math.min(255, c.pts) }))
    .sort((x, y) => y.points - x.points || (x.player < y.player ? -1 : 1));
  // Free play board order = the week's place order (points, fewer lost balls, more under par, best hole).
  const key = (c: CardRec) => [c.pts, -c.lost, c.under, -c.best].join(",");
  const free = wf.cards.filter((c) => c.free === true && !c.ranked && ok(c));
  const groups: CardRec[][] = [];
  for (const c of free) { const g = groups[groups.length - 1]; if (g && key(g[0]) === key(c)) g.push(c); else groups.push([c]); }
  const names = (g: CardRec[] | undefined) => (g ? g.map((c) => c.a).sort() : []);
  let first = names(groups[0]), second = first.length === 1 ? names(groups[1]) : [];
  if (first.length > MAX_PER_PLACE) { problems.push(`week ${wf.week}: ${first.length} free players tied for 1st (the Vault takes at most ${MAX_PER_PLACE}); 1st left empty`); first = []; }
  if (second.length > MAX_PER_PLACE) { problems.push(`week ${wf.week}: ${second.length} free players tied for 2nd (the Vault takes at most ${MAX_PER_PLACE}); 2nd left empty`); second = []; }
  return { game: GOLF_GAME_ID, week: wf.week, final: true, rows, first, second };
}

// ── the run ──
export async function run(o: Opts) {
  const now = o.now ?? Date.now();
  const PREV = o.prev, OUT = o.out || "games-data/golf";
  const STAKED_FROM = Number.isInteger(o.stakedFromWeek) && (o.stakedFromWeek as number) >= 0 ? (o.stakedFromWeek as number) : null;
  const ruleOf = (w: number) => { const r = G.rule(w, STAKED_FROM); return { ...r, minField: o.minField ?? r.minField }; };
  const weekPractice = (w: number) => { const j = readJson(PREV, wName(w)); return j && typeof j.practice === "boolean" ? j.practice : G.rule(w, STAKED_FROM).practice; };
  const ruleFixed = (practice: boolean) => { const r = G.rule(0, practice ? null : 0); return { ...r, minField: o.minField ?? r.minField }; };
  const sources = (o.sources ?? sourcesFromGames()).filter((s) => READERS[s.reader]);
  const KNODE = o.knodeGame === undefined ? MAINNET_KNODE_GAME || null : o.knodeGame;
  const nowW = M.weekOf(now);
  const problems: string[] = [];
  const troubled = new Set<number>();            // weeks with a read problem this run: never made final in this run
  // Staked weeks need the vault (v6) to read Block Golf stakes: refuse to start without it (fix-check S2).
  if (STAKED_FROM !== null && !o.golfStakersOf && !(GAME_ABI().methods || {}).get_game_player) throw new Error("GOLF_STAKED_FROM_WEEK is set but the vault (v6) isn't live here (its ABI has no get_game_player): merge v6 first");

  // 0. the last run's files: if any exist, its index must be readable (a broken read is never a fresh start)
  const prevIdx = readJson(PREV, "index.json");
  const hadIndex = !!(prevIdx && prevIdx.v === 1 && prevIdx.course && typeof prevIdx.course === "object" && Array.isArray(prevIdx.weeks));
  if (!hadIndex && (exists(PREV, "index.json") || exists(PREV, "board.json"))) throw new Error("the last run's files are there but its index.json can't be read: stopping rather than starting over");

  // 1. the course: the week each game joined (remembered for good), new games from next week
  const course: Record<string, number> = {};
  if (hadIndex) for (const [id, w] of Object.entries(prevIdx.course)) if (/^[a-z0-9-]{1,24}$/.test(id) && Number.isInteger(w) && (w as number) >= 0) course[id] = w as number;
  for (const s of sources) if (s.live && course[s.id] === undefined) course[s.id] = hadIndex ? nowW + 1 : nowW;
  const known = new Set<number>(hadIndex ? prevIdx.weeks.filter((w: any) => Number.isInteger(w) && w >= 0 && w < 10000) : []);
  const byId = new Map(sources.map((s) => [s.id, s]));
  const liveIds = sources.filter((s) => s.live).map((s) => s.id);

  // The owner's hold (§5.5, Repo Lens): GOLF_HOLD_WEEKS = "5" or "5,6". A held week is never made final, so no vault
  // file is written and the vault bot waits (it rolls over at the vault's deadline if still held). Fail closed: a
  // value that isn't a plain list holds every week that is waiting to go final.
  const holdSetting = parseHoldWeeks(o.holdWeeks === undefined ? E.GOLF_HOLD_WEEKS : o.holdWeeks);
  const heldWeek = (w: number) => holdSetting.bad || holdSetting.weeks.includes(w);

  // The question game, once per week per run, on two nodes that must agree. Daily Questions' own entry rule (Repo
  // Lens G-7; the v6.1 recorder's rule): a wallet counts on the hole only with at least 2 counted answers (resolved,
  // not voided) and at least 1 point. Who counts for Golf is decided by Golf (practice: everyone; staked weeks: the
  // Block Golf stakes), so nothing else is read here (Repo Lens G-4).
  const qCache = new Map<number, Read>();
  const questions = async (w: number): Promise<Read> => {
    if (qCache.has(w)) return qCache.get(w)!;
    let r: Read;
    try {
      const read = o.questionsOf ?? ((n: any, wk: number) => readQuestions(n, KNODE!, wk));
      if (!o.questionsOf && (!KNODE || !o.p)) throw new Error("no question game contract or node");
      const a = await read(o.p, w);
      const b = o.check ? await read(o.check, w) : a;
      if (JSON.stringify(a) !== JSON.stringify(b)) { problems.push(`question game, week ${w}: the two nodes don't agree yet`); r = { state: "live", rows: [], why: "the two nodes don't agree yet", failed: true }; }
      else {
        const final = now >= M.weekStart(w + 1) && a.closed && a.questions > 0 && a.resolved >= a.questions;
        const counts = (x: QWeek["rows"][number]) => (x.counted ?? x.answered) >= 2 && x.pts >= 1;
        r = { state: final ? "final" : "live", rows: a.rows.filter((x) => counts(x) && isAddr(x.a) && cleanScore(x.pts) !== null).map((x) => ({ a: x.a, score: cleanScore(x.pts)!, scored: x.pts > 0, ranked: true })) };
      }
    } catch (e) { problems.push(`question game, week ${w}: ${(e as Error).message}`); r = { state: "live", rows: [], why: "couldn't read the question game this run", failed: true }; }
    qCache.set(w, r);
    return r;
  };
  const ctx: Ctx = { now, raceDir: o.raceDir, gamesDir: o.gamesDir, o, questions };

  // 2–4. last week (until final) and this week
  const weeks = new Map<number, WeekFile>();
  for (const w of [nowW - 1, nowW]) {
    if (w < 0) continue;
    const old: WeekFile | null = (() => { const j = readJson(PREV, wName(w)); return j && j.v === 1 && j.week === w && Array.isArray(j.holes) && Array.isArray(j.cards) ? j : null; })();
    if (!old && known.has(w)) throw new Error(`week ${w} was recorded before but its file can't be read: stopping`);
    if (old && old.final === true) { weeks.set(w, old); continue; }
    const start = M.weekStart(w), end = M.weekStart(w + 1);
    // Practice or staked is fixed when the week is first recorded (fix-check N2).
    const R = old && typeof old.practice === "boolean" ? ruleFixed(old.practice) : ruleOf(w);
    // The week's holes are fixed once it has been recorded; until then, the live games that joined by this week.
    const ids: string[] = old && old.holes.length ? old.holes.map((h) => h.id) : G.courseFor(w, course, liveIds);
    // A. Each hole's standings and status (before the field is known).
    //    Repo Lens G-2: every hole is read again on every run until the WEEK is final, so the two runs that make it
    //    final each read every hole. A hole that was final after the week ended is only kept as it was (keptFinal)
    //    when this run can't read it (a read error, or its game's board has moved past the week): a later bad read
    //    never undoes it (audit H2). A fresh reading that differs replaces it, which changes the week's fingerprint,
    //    so the two-run check starts again; a game that no longer shows the week as final makes the hole wait.
    type Draft = { id: string; name: string; status: HoleRec["status"]; why: string; rows: Row[]; keptFinal: HoleRec | null };
    const drafts: Draft[] = [];
    for (const id of ids) {
      const s = byId.get(id);
      const was = old?.holes.find((h) => h && h.id === id) ?? null;
      const kept = was && Array.isArray(was.rows) && was.rows.length ? was.rows.map(([a, score, scored, ranked]) => ({ a, score, scored: !!scored, ranked: G.weightOf(ranked) })) : null;
      const wasFinal = !!was && now >= end && was.status === "final" && Array.isArray(was.rows);
      const keep = () => drafts.push({ id, name: was!.name, status: "final", why: "", rows: [], keptFinal: { ...was!, why: "" } });
      let rd: Read;
      if (!s) { if (wasFinal) { keep(); continue; } rd = { state: "live", rows: [], why: "its game has no reader on this recorder" }; }
      else {
        try { rd = await READERS[s.reader](s, w, ctx); }
        catch (e) {
          if (wasFinal) { problems.push(`${id}, week ${w}: couldn't read it again (${(e as Error).message}); its final standings are kept`); keep(); continue; }
          problems.push(`${id}, week ${w}: ${(e as Error).message}`); troubled.add(w); rd = { state: "live", rows: [], why: "couldn't read its results this run" };
        }
      }
      // A read that failed this run: said aloud (F-3); a hole already final keeps its standings; any other hole holds
      // the week (no final this run; from 66 hours it no longer holds it).
      if (rd.failed) {
        if (rd.problem) problems.push(`${id}, week ${w}: ${rd.problem}`);
        if (wasFinal) { problems.push(`${id}, week ${w}: couldn't read it again; its final standings are kept`); keep(); continue; }
        troubled.add(w);
      }
      if (wasFinal && rd.stale) { keep(); continue; }
      if (wasFinal && rd.state !== "final") problems.push(`${id}, week ${w}: was final, but its game no longer shows the week as final: waiting`);
      if (wasFinal && rd.state === "final") {
        const norm = (xs: [string, number, number][]) => JSON.stringify(xs.slice().sort((x, y) => (x[0] < y[0] ? -1 : 1)));
        const before = norm(was!.rows.map((r) => [r[0], r[1], r[2]] as [string, number, number]));
        const after = norm(rd.rows.slice(0, MAX_ROWS).map((r) => [r.a, r.score, r.scored ? 1 : 0] as [string, number, number]));
        if (before !== after) problems.push(`${id}, week ${w}: its final standings read differently this run; the week's two-run check starts again`);
      }
      let rows = rd.rows, why = rd.why || "";
      // Keep the standings last read when the game's files have moved on (or can't be read this run).
      if (!rows.length && kept && (rd.state !== "final" || rd.stale)) rows = kept;
      let status: HoleRec["status"] = rd.state === "final" && now >= end ? "final" : rd.state === "none" ? "skipped" : "live";
      if (rd.stale && !kept) { status = "skipped"; why = "its standings for this week were never read"; }
      if (status === "live" && now >= end + DEADLINE_MS) {
        if (rd.atDeadline === "use" && rows.length) { status = "final"; why = ""; }
        else { status = "skipped"; why = "its results weren't final in time"; }
      }
      // Practice weeks: every scorer counts, with weight 1 (Repo Lens G-4); staked weeks set weights below.
      if (R.practice) rows = rows.map((r) => ({ ...r, ranked: true }));
      drafts.push({ id, name: s ? s.name : (was ? was.name : id), status, why, rows: rows.slice(0, MAX_ROWS), keptFinal: null });
    }
    // B. Staked weeks: a hole's field is the players staked in Block Golf that week (owner, 2026-10-28), read from the
    //    vault on two nodes, for every wallet on the week's holes (kept ones too). If it can't be read, the flags from
    //    the last run stand and the week waits. notFree (Repo Lens G-1): everyone whose stake reached the minimum at
    //    any point that week; it only grows, and it is kept from the last run when this run can't read the stakes.
    let stakesFresh = R.practice;
    const notFree = new Set<string>(R.practice ? [] : (old && Array.isArray(old.notFree) ? old.notFree.filter(isAddr) : []));
    let stakers: Map<string, number> | null = null;
    const lastWeight = new Map<string, number>();
    for (const h of old?.holes ?? []) for (const r of Array.isArray(h?.rows) ? h.rows : []) {
      const wt = G.weightOf(r[3]);
      if (isAddr(r[0]) && wt > (lastWeight.get(r[0]) ?? 0)) lastWeight.set(r[0], wt);
    }
    if (!R.practice) {
      const who = [...new Set(drafts.flatMap((d) => (d.keptFinal ? d.keptFinal.rows.map((r) => r[0]) : d.rows.map((r) => r.a))))].sort();
      try {
        const read = o.golfStakersOf ?? ((n: any, list: string[], wk: number) => readGolfStakers(n, KNODE, list, wk));
        const asStakes = (x: Map<string, number> | Stakes): Stakes => (x instanceof Map ? { weights: x, peaked: new Set(x.keys()) } : x);
        const sa = asStakes(await read(o.p, who, w)), sb = o.check ? asStakes(await read(o.check, who, w)) : sa;
        const key = (x: Stakes) => JSON.stringify([[...x.weights].sort((p, q) => (p[0] < q[0] ? -1 : 1)), [...x.peaked].sort()]);
        if (key(sa) !== key(sb)) { problems.push(`week ${w}: the two nodes don't agree on who is staked in Block Golf yet`); troubled.add(w); }
        else { stakers = sa.weights; for (const a of sa.peaked) notFree.add(a); for (const a of sa.weights.keys()) notFree.add(a); stakesFresh = now >= end; }
      } catch (e) { problems.push(`week ${w}: Block Golf stakes: ${(e as Error).message}`); troubled.add(w); }
      for (const d of drafts) {
        if (d.keptFinal) {
          // A kept hole's weights are compared with this run's stakes (G-2): a change starts the check again.
          if (stakers && d.keptFinal.rows.some((r) => G.weightOf(r[3]) !== (stakers!.get(r[0]) ?? 0))) {
            problems.push(`${d.id}, week ${w}: the Block Golf stakes read differently this run; the hole is scored again`);
            d.rows = d.keptFinal.rows.map(([a, score, sc]) => ({ a, score, scored: !!sc, ranked: stakers!.get(a) ?? 0 }) as any);
            d.keptFinal = null;
          }
          continue;
        }
        // Stakes unreadable this run: each wallet keeps ONE weight on every hole, its largest from the last run
        // (Repo Lens F-1), so a wallet is never staked on one hole and not on another.
        d.rows = d.rows.map((r) => ({ ...r, ranked: stakers ? stakers.get(r.a) ?? 0 : lastWeight.get(r.a) ?? 0 }) as any);
      }
    }
    // C. Score each hole. Staked weeks: a hole's field needs MIN_FIELD_VHP of Block Golf stake among its scorers (a
    //    fixed number, so nobody can move it and a final hole always scores the same: fix-check V2, V3).
    const minW = R.practice ? 0 : G.MIN_FIELD_VHP;
    const holes: HoleRec[] = [];
    for (const d of drafts) {
      if (d.keptFinal) { holes.push(d.keptFinal); continue; }
      let { status, why } = d;
      // Staked weeks: a hole is final only with the Block Golf stakes read after the week ended; stakes still
      // unreadable 66 hours after it skip the hole rather than use flags read during the week (fix-check S1).
      if (!stakesFresh && status !== "skipped") {
        if (now >= end + FORCE_MS) { status = "skipped"; why = "the Block Golf stakes couldn't be read in time"; }
        else if (status === "final") { status = "live"; why = "waiting to read the Block Golf stakes"; }
      }
      const scored = status === "skipped" ? null : G.scoreHole(d.rows, R.minField, R.everyone, minW);
      if (scored && scored.skipped && status === "final") { status = "skipped"; why = scored.why; }
      holes.push({
        id: d.id, name: d.name, status, why: status === "final" ? "" : why || (scored && scored.skipped ? scored.why : ""),
        field: scored ? scored.field : 0,
        rows: d.rows.map((r) => [r.a, r.score, r.scored ? 1 : 0, G.weightOf(r.ranked)]),
      });
    }
    const scoredHoles = holes.map((h) => {
      if (h.status === "skipped") return { id: h.id, skipped: true, results: {} };
      const s = G.scoreHole(h.rows.map(([a, score, sc, rk]) => ({ a, score, scored: !!sc, ranked: G.weightOf(rk) })), R.minField, R.everyone, minW);
      return { id: h.id, skipped: s.skipped, results: s.results };
    });
    // Staked board = staked in Block Golf that week (staked weeks); Free play = everyone else (D-081). Practice weeks:
    // nobody can be staked in Block Golf yet, so every card is on the Free play board. free: may take the Free play
    // prize (not staked, and never staked in Block Golf that week: G-1).
    const rankedAny = new Set<string>();
    if (!R.practice) for (const h of holes) if (h.status !== "skipped") for (const r of h.rows) if (r[3]) rankedAny.add(r[0]);
    const cards: CardRec[] = G.cards(scoredHoles).map((c: any) => ({
      a: c.a, ranked: rankedAny.has(c.a), free: !rankedAny.has(c.a) && !notFree.has(c.a), place: c.place, pts: c.pts, strokes: c.strokes, par: c.par, toPar: c.toPar,
      lost: c.lost, under: c.under, best: c.best, mulligan: c.mulligan,
      holes: c.holes.map((x: any) => [x.id, x.strokes, x.place, x.of]),
    }));
    const notFreeList = [...notFree].sort();
    if (troubled.has(w) && now >= end + FORCE_MS) problems.push(`week ${w}: made final despite read problems (66 hours after it ended); check the run`);
    // Ready: the week has ended, every hole is final or skipped, and no read problem (or 66 hours have passed).
    const ready = now >= end + FINAL_WAIT_MS && (!troubled.has(w) || now >= end + FORCE_MS) && holes.every((h) => h.status !== "live");
    // Two runs an hour apart must agree (WEEK_CYCLE.md §2): the first ready run stamps the fingerprint; a later run
    // with the same fingerprint makes the week final. Any change starts the check again. A held week never goes final.
    const sig = ready ? weekSig(holes, cards, notFreeList) : "";
    const prevCheck = old && old.check && typeof old.check.sig === "string" && Number.isInteger(old.check.at) ? old.check : null;
    const same = !!prevCheck && prevCheck.sig === sig;
    const held = ready && heldWeek(w);
    if (held) problems.push(holdSetting.bad
      ? `week ${w}: HELD (GOLF_HOLD_WEEKS isn't a list like 5 or 5,6): fix it or empty it`
      : `week ${w}: HELD by the owner (GOLF_HOLD_WEEKS); remove ${w} from it to let the week go final (the vault takes results until Thursday 00:00 UTC)`);
    const final = ready && !held && same && now - prevCheck!.at >= TWO_RUN_GAP_MS;
    // Repo Lens I-1: a reading that keeps changing never goes final and would quietly roll over at the vault's
    // Thursday deadline; from 48 hours after the week, every re-stamp is reported so the owner can step in.
    if (ready && !held && prevCheck && !same && now >= end + 48 * HOUR) problems.push(`week ${w}: its results still read differently from one run to the next, ${Math.floor((now - end) / HOUR)} hours after the week (the vault takes results until Thursday 00:00 UTC): check the holes' games`);
    const check: Check | null = final || !ready ? null : same ? prevCheck : { sig, at: now };
    weeks.set(w, { v: 1, week: w, start, end, final, practice: R.practice, holes, cards, notFree: notFreeList, check });
  }

  // 5. write
  fs.mkdirSync(OUT, { recursive: true });
  for (const [w, wf] of weeks) {
    if (!wf.holes.length && !known.has(w)) continue;
    known.add(w);
    fs.writeFileSync(path.join(OUT, wName(w)), JSON.stringify(wf) + "\n");
  }
  // The Vault's file for a final staked week (hand-off from the Vault v6 chat, 2026-10-28): every player staked in
  // Block Golf that week with 1+ points, points 1–255 (7 × counted holes − strokes keeps the order and the ties).
  // first / second: the Free play board's 1st and 2nd (D-081, D-082); the vault bot pays them only while game 6's
  // free-prize switch is ON. Practice weeks have no vault file.
  for (const [w, wf] of weeks) {
    if (!wf.final || wf.practice || !wf.holes.length) continue;
    const vf = vaultFile(wf, problems);
    // Nobody to pay (no staked scorer): the file says so with empty rows, as the Vault asks (handoff, 2026-10-29), and
    // the bucket rolls over in Block Golf. The owner is told, in case every hole was skipped.
    if (!vf.rows.length) problems.push(`week ${w}: no staked Block Golf scorecards; the vault file has no rows`);
    fs.mkdirSync(path.join(OUT, "vault"), { recursive: true });
    fs.writeFileSync(path.join(OUT, "vault", `W${w}.json`), JSON.stringify(vf) + "\n");
  }
  const weekList = [...known].sort((a, b) => a - b);
  fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify({ v: 1, updated: new Date(now).toISOString(), weeks: weekList, course, stakedFromWeek: STAKED_FROM }) + "\n");

  // boardPlace (Repo Lens B13-B1): the place on the row's own board (Staked or Free play) by Golf's tie key (points,
  // fewer lost balls, more under par, best hole), ties sharing it; the pages give medals by it, matching the vault file.
  const view = (wf: WeekFile | undefined) => {
    const last: Record<string, { k: string; place: number; n: number }> = {};
    return (wf ? wf.cards : []).map((c) => {
      const staked = c.ranked || c.free === false, b = staked ? "staked" : "free", k = [c.pts, -c.lost, c.under, -c.best].join(",");
      const prev = last[b], n = (prev ? prev.n : 0) + 1, boardPlace = prev && prev.k === k ? prev.place : n;
      last[b] = { k, place: boardPlace, n };
      return { a: c.a, place: c.place, boardPlace, pts: c.pts, topar: c.toPar, strokes: c.strokes, holes: c.holes.filter((x) => x[2] !== null).length, lost: c.lost, ranked: staked };
    });
  };
  // All time: final weeks only, points summed; places by points, then more holes played.
  const tot = new Map<string, { pts: number; toPar: number; strokes: number; holes: number; lost: number; ranked: boolean }>();
  for (const w of weekList) {
    const wf = weeks.get(w) ?? readJson(PREV, wName(w));
    if (!wf) throw new Error(`week ${w} is in the index but its file can't be read: stopping`);
    if (wf.v !== 1 || wf.final !== true || !Array.isArray(wf.cards)) continue;
    for (const c of wf.cards) {
      if (!isAddr(c.a)) continue;
      const t = tot.get(c.a) ?? { pts: 0, toPar: 0, strokes: 0, holes: 0, lost: 0, ranked: false };
      t.pts += c.pts; t.toPar += c.toPar; t.strokes += c.strokes; t.lost += c.lost; t.holes += c.holes.filter((x: any) => x[2] !== null).length; t.ranked = t.ranked || !!c.ranked || c.free === false;
      tot.set(c.a, t);
    }
  }
  const allRows = [...tot].map(([a, t]) => ({ a, ...t })).sort((x, y) => y.pts - x.pts || y.holes - x.holes || (x.a < y.a ? -1 : 1));
  allRows.forEach((r: any, i) => { r.place = i > 0 && allRows[i - 1].pts === r.pts && allRows[i - 1].holes === r.holes ? (allRows[i - 1] as any).place : i + 1; });
  const cur = weeks.get(nowW), last = weeks.get(nowW - 1);
  const board = {
    v: 1, updated: new Date(now).toISOString(),
    today: { day: M.dayOf(now), rows: view(cur) },
    week: { week: nowW, start: M.weekStart(nowW), rows: view(cur) },
    lastWeek: last ? { week: last.week, start: last.start, final: last.final, rows: view(last) } : null,
    allTime: { rows: allRows.map((r: any) => ({ a: r.a, place: r.place, pts: r.pts, topar: r.toPar, strokes: r.strokes, holes: r.holes, lost: r.lost, ranked: r.ranked })) },
  };
  fs.writeFileSync(path.join(OUT, "board.json"), JSON.stringify(board) + "\n");

  for (const [w, wf] of weeks) console.log(`week ${w}: ${wf.final ? "final" : wf.check ? "pending (waiting for a second matching run)" : now >= wf.end ? "pending (review)" : "in play"}${wf.practice ? " (practice)" : ""}; holes ${wf.holes.map((h) => `${h.id}=${h.status}${h.why ? ` (${h.why})` : ""}`).join(", ") || "none"}; ${wf.cards.length} scorecards`);
  if (problems.length) { console.log("Problems:"); for (const p of problems) console.log("  " + p); }
  return { weeks, board, course, problems };
}

// ── npm run golf -- status: a read-only look at what Block Golf has published (for the owner and the admin page) ──
const PUBLISHED = "https://raw.githubusercontent.com/bawcejawn/KnodeGames/games-data/golf/";
/** One line per week and per hole, in plain words, from the published index and week files. Reads only. */
/** Text from the published files, made safe for a terminal (B13-B3): no control or bidi characters, at most 200. */
export const plain = (x: unknown): string => String(x ?? "").replace(/[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "").slice(0, 200);
export function statusLines(idx: any, files: Map<number, any>, now: number): string[] {
  const out: string[] = [];
  if (!idx || idx.v !== 1) return ["Block Golf has published nothing yet. Turn it on: GitHub → Settings → Secrets and variables → Actions → Variables → GOLF_ENABLED = true, then Actions → \"Block Golf recorder\" → Run workflow."];
  const label = (w: number) => (w >= 3 ? `Week ${w - 2}` : `the week of ${new Date(M.weekStart(w)).toUTCString().slice(5, 11)}`);
  const course = idx.course && typeof idx.course === "object" ? Object.entries(idx.course).filter(([, w]) => Number.isInteger(w)) : [];
  out.push(`Last published: ${plain(idx.updated)}. Course: ${course.map(([g, w]) => `${plain(g)} (from ${label(w as number)})`).join(", ") || "none yet"}.`);
  out.push(idx.stakedFromWeek === null || idx.stakedFromWeek === undefined
    ? "Every week is a PRACTICE week (no prizes): GOLF_STAKED_FROM_WEEK isn't set."
    : `Staked play from vault week ${idx.stakedFromWeek} (${label(idx.stakedFromWeek)}); earlier weeks are practice.`);
  for (const [w, f] of [...files].sort((x, y) => x[0] - y[0])) {
    if (!f || typeof f !== "object" || !Array.isArray(f.holes) || !Array.isArray(f.cards) || !Number.isInteger(f.end)) { out.push(`${label(w)} (vault week ${w}): its file couldn't be read.`); continue; }
    const at = f.check && Number.isInteger(f.check.at) ? new Date(f.check.at).toISOString().slice(0, 16) : "?";
    const state = f.final ? "FINAL" : f.check ? `waiting for its second matching run (first one ${at} UTC)` : now >= f.end ? "results being checked (review)" : "in play";
    out.push(`${label(w)} (vault week ${w}), ${f.practice ? "practice" : "staked"}: ${state}; ${f.cards.length} scorecard(s).`);
    for (const h of f.holes) out.push(`   hole ${plain(h?.id)}: ${plain(h?.status)}${h?.why ? ` (${plain(h.why)})` : ""}; ${Number(h?.field) || 0} in the field`);
  }
  out.push("", "Switches (GitHub → Settings → Secrets and variables → Actions → Variables):",
    "   GOLF_ENABLED = true                turns the hourly recorder on (false or deleted: off)",
    "   GOLF_STAKED_FROM_WEEK = <week>     the first staked vault week; set it once, after game-apply 6; never change it",
    "   GOLF_HOLD_WEEKS = <week>[,<week>]  holds those weeks from going final; delete it (or remove the week) to release");
  return out;
}
async function status(): Promise<void> {
  const get = async (f: string) => { const r = await fetch(PUBLISHED + f, { cache: "no-store", signal: AbortSignal.timeout(20000) } as any); if (r.status === 404) return null; if (!r.ok) throw new Error(`${f}: HTTP ${r.status}`); return r.json(); };
  const idx = await get("index.json");
  const files = new Map<number, any>();
  const weeks: number[] = idx && Array.isArray(idx.weeks) ? idx.weeks.filter((w: any) => Number.isInteger(w)).slice(-2) : [];
  for (const w of weeks) files.set(w, await get(wName(w)).catch(() => null));
  for (const l of statusLines(idx, files, Date.now())) console.log(l);
  const hold = parseHoldWeeks(E.GOLF_HOLD_WEEKS);
  if (hold.raw) console.log(`(This PC's GOLF_HOLD_WEEKS is "${hold.raw}"; the recorder uses the GitHub variable.)`);
}

const isMain = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
// Repo Lens B13-B2: `npm run golf -- status` is the only argument; anything else (a typo, "Status", "--status") stops
// with the usage instead of running the recorder. The workflow passes no argument.
if (isMain && process.argv[2] !== undefined && process.argv[2] !== "status") {
  console.error(`Unknown argument "${plain(process.argv[2])}". Usage: npm run golf -- status   (read-only; the recorder itself runs on GitHub)`);
  process.exit(1);
} else if (isMain && process.argv[2] === "status") {
  status().catch((e) => { console.error(`Couldn't read Block Golf's published files: ${(e as Error).message}`); process.exit(1); });
} else if (isMain) {
  const raw = (E.GOLF_STAKED_FROM_WEEK || "").trim();
  if (raw && !/^\d{1,4}$/.test(raw)) { console.error(`GOLF_STAKED_FROM_WEEK must be a week number, not "${raw}"`); process.exit(1); }
  const sf = raw ? Number(raw) : null;
  const RPC = E.RPC || "https://koinos.armana.io";
  const RPC_CHECK = E.RPC_CHECK && E.RPC_CHECK !== "off" && E.RPC_CHECK !== RPC ? E.RPC_CHECK : "";
  run({
    prev: E.GOLF_PREV, out: E.GOLF_OUT, stakedFromWeek: sf, raceDir: E.RACE_DATA, gamesDir: E.GAMES_DATA, holdWeeks: E.GOLF_HOLD_WEEKS,
    p: new Provider([RPC]), check: RPC_CHECK ? new Provider([RPC_CHECK]) : null,
  }).catch((e) => { console.error(e); process.exit(1); });
}
