/**
 * Producer Bracket recorder (run every hour by .github/workflows/games.yml; read-only on the chain, holds no key).
 * The rules live in bracket-math.js, the same file the page runs. The week's shape (D-141) and its timing
 * (standards/WEEK_CYCLE.md, D-125) are there too; this file records them and follows standards/RECORDER_STANDARD.md.
 *
 * Each run, for last week (until final), this week and next week:
 *  1. Seeding. From Sunday 00:00 UTC before a week, once that block is irreversible: every producer's exact VHP
 *     averaged over the 28,800 blocks before it (vhp-standard averageCard), on both nodes; they must agree.
 *     bracket-math.seeding turns it into the bracket (8, 16 or 32 producers; under 8: no bracket that week), each seed
 *     on the lower of its average now and at last week's seeding (#E-3 M-6). Recorded once and never changed, with a
 *     sha256 of what it says. Not seeded within 24 hours of its time: the week is void (#E-3 L-4: by time alone).
 *  2. Picks. Once the block at the lock (Monday 23:55 UTC) is irreversible: every pick for the week's round from the
 *     Picks contract (game 9), on both nodes; they must agree. The chain refused picks after the lock.
 *  3. Hours. Every UTC hour of each round's day (the final on Saturday), once irreversible and once a block after it is
 *     too: its first and last height, how many blocks it had, how many each seed signed (by), its credited blocks (cr),
 *     its baseline (w: effective VHP at the day's start), Σ 1 ÷ active VHP over its blocks (q), each seed's rate sum
 *     (r, for the pooled rate index, #E-3 H-4) and its average effective VHP over the hour's blocks (av, for forfeits,
 *     #E-3 H-5). The VHP is rebuilt from the chain itself (vhp-chain.ts). Done on both nodes; identical or nothing.
 *     A later run re-reads every recorded hour on both nodes and marks it re: 1 only if it reads the same again (the
 *     two-run rule): a week goes final only with every hour re-read. At most 6 new and 6 re-read hours a run.
 *  4. Results and points: each round's day index, the winners, every pick's points.
 *  5. Stakes. During the week, for the boards: who is staked in game 9 (the Vault's own rule, Block X's reader:
 *     week_stake ≥ the week's minimum; RECORDER_STANDARD §2.4). Once the week has ended (#E-3 M-1, L-8): read again on
 *     both nodes, with `held` (peak stake ≥ the minimum: the players the Vault refuses a free prize).
 *  6. Final: no earlier than Monday 00:00 UTC after the week (Sunday is the review day), with every result in, every
 *     hour re-read and the end-of-week stakes. Not final by Thursday 00:00 UTC (the Vault's backstop): closed without a
 *     vault file (`vault: "missed"`, or void if its results could never be completed, #E-3 L-5).
 *  7. The Vault file (vault/W<week>.json): once final and until Thursday 00:00 UTC: { game: 9, week, final: true,
 *     rows: staked players with ≥ 1 point, valued so the Vault's top-30% cutoff pays exactly the earners (#E-3 C-1),
 *     first / second: the Free play winners }.
 *  8. Leaderboards (board.json) and index.json. Medals and prize lists come from exactly the rows the Vault is sent,
 *     only for a final week that wasn't missed (#E-3 M-2).
 *
 * Every time decision uses the lower of the two nodes' irreversible blocks, and its time (#E-3 M-8, audit F-4). The run
 * refuses to write when the last run's files are incomplete (audit F-3): a failed read must never wipe the history.
 * Two nodes are required to seed, record hours and read stakes (audit A-3): with RPC_CHECK off, those steps wait.
 *
 *   RPC, RPC_CHECK, BRACKET_PREV (last run's files), BRACKET_OUT, BRACKET_PRIZES_FROM_WEEK.
 *   npm run bracket         (or: npx tsx bot/games/bracket.ts)
 */
import { Provider, Contract } from "koilib";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { withRetry } from "../../common.ts";
import { chainNode, heightAt, bookFor } from "../vhp-chain.ts";
import { vaultReader } from "./blockx.ts";
await import("../../race-math.js");
await import("../../bracket-math.js");
const M: any = (globalThis as any).KRaceMath;
const B: any = (globalThis as any).KBracketMath;

const E = process.env;
const RPC = E.RPC || "https://koinos.armana.io";
const RPC_CHECK = E.RPC_CHECK && E.RPC_CHECK !== "off" && E.RPC_CHECK !== RPC ? E.RPC_CHECK : "";
const HOUR = 3600000, DAY = 24 * HOUR;
const SEED_GRACE = 24 * HOUR;              // not seeded this long after its time → the week is void
const MAX_HOURS_PER_RUN = 6;               // a long outage catches up over a few runs (audit A-2)
const MAX_REREADS_PER_RUN = 6;             // hours re-read for the two-run rule, per run
const VAULT_DAYS = 3 * DAY;                // the Vault takes a week's file until Thursday 00:00 UTC (WEEK_CYCLE backstop)
const MAX_BOARD_ROWS = 1000;               // per leaderboard view (the page shows 50; your own score is in W<week>.json)
const MAX_FILE_BYTES = 2048 * 1024;        // the publish job's own limit (find -size +2048k): never write a file over it
                                           // (#E-3 M-3; fix-check F6: one number on both sides)
const PICKS_GRACE = 3 * HOUR;              // picks are recorded within 3 h of the lock, or (without BRACKET_RELEASE) never (F3)
const LAST_SEEDING_WEEKS = 4;              // how far back the last seeding's raw averages are looked for (RC-1)
/** BRACKET_RELEASE (a repository variable the owner sets for one run): the weeks whose recorded seeding, hours or
 *  end-of-week stakes may be replaced when a two-node re-read disagrees with them (fix-check F4), and whose picks may
 *  be recorded late (F3). "3" or "3,4". Anything else: no release. The publish job reads the same variable. */
export const releaseFromEnv = (v: string | undefined) => new Set(v && /^\s*\d{1,4}(\s*,\s*\d{1,4})*\s*$/.test(v) ? v.split(",").map((x) => Number(x.trim())) : []);
const RELEASE = releaseFromEnv(E.BRACKET_RELEASE);
const MAX_PICK_PAGES = 1000;               // 100,000 picks a week; a full last page stops the run (#E-3 L-11)
const isAddr = (a: unknown): a is string => typeof a === "string" && /^1[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(a);

export type RawPick = { player: string; number: number; time: number };
type Hour = { from: number; to: number; n: number; by: Record<string, number>; cr: Record<string, number>; w: Record<string, number>; q: number;
  r: Record<string, number>; av: Record<string, number>; checked: number; re?: 1 };
/** raw: every producer's average VHP on the seeding card (address → VHP), for next week's lower-of-two (#E-3 M-6). */
type Seeding = { at: number; cardAt: number; size: number; seeds: string[]; vhp: number[]; totalVhp: number; out: string[]; outVhp: number[]; raw: Record<string, number>; pooled: string[]; hash: string; re?: 1 };
/** A recorded pick: [player, number, pick time (ms), valid bracket 1/0]. */
type Pick = [string, number, number, number];
/** Points: [player, points, correct champion 1/0, correct winners]. */
type Points = [string, number, number, number];
export type WeekFile = {
  bad?: string;                                          // (not written) why a stored final week needs a look
  v: 5; week: number; start: number; end: number;
  status: "waiting" | "none" | "void" | "open" | "locked" | "final";
  seeding: Seeding | null; picks: { checked: number; rows: Pick[] } | null;
  days: (Hour | null)[][];                 // [round][hour 0–23]
  results: { rounds: number[][]; done: boolean } | null;
  points: Points[]; void?: string;
  staked: { checked: number; list: string[]; held?: string[] } | null;   // players staked in game 9 that week by the
                                                         // Vault's rule (sorted); with `held`, the read made after the week
                                                         // ended (the one the vault file uses): held = players the Vault
                                                         // won't pay a free prize (≥ 1 VHP in game 9 at any time that week)
  vault?: "missed";                                      // closed at the backstop without a vault file
};
import type { Chain, Node } from "../vhp-chain.ts";
export type { Chain, Node };
type Head = { height: number; time: number; lib: number; libTime: number };
type Opts = {
  p: any; check: any | null; prev?: string; out?: string; raceDir?: string;
  picksContract?: string | null;
  picksOf?: (node: any, round: number) => Promise<RawPick[]>;   // for the tests
  gameOf?: (node: any) => Promise<any>;                          // the Picks game's settings (for the tests)
  vault?: string | null;
  prizesFromWeek?: number | null;                        // the first week the Vault pays game 9 (medals and prize lists
                                                         // only from then; default BRACKET_PRIZES_FROM_WEEK, else none)
                                                         // vault: the Vault's address (pooled); default deployment.json
  stakedOf?: (node: any, players: string[], week: number) => Promise<string[] | Stakes>;   // the Vault's stakes (tests;
                                                         // a plain list = staked, and held = the same)
  nodeOf?: (node: any) => Node;                                  // for the tests and the replay
  release?: Set<number>;                                         // BRACKET_RELEASE's weeks (tests; default from the env)
  head?: Head;
};

// ── files ──
function readJson(dir: string | undefined, name: string): any {
  if (!dir) return null;
  const f = path.join(dir, name);
  try { if (fs.lstatSync(f).isSymbolicLink()) return null; return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; }
}
const wName = (w: number) => `W${String(w).padStart(3, "0")}.json`;
/** The week file's version, shared with the publish job and the page (bracket-math FILE_V; #E-3 H-1). Older files
 *  (v4: Saturday seeding, Monday rounds) are not read: no week was ever played on them. */
export const FILE_V: number = B.FILE_V;
const emptyDays = (size: number) => Array.from({ length: size ? B.roundsOf(size) : 0 }, () => new Array<Hour | null>(24).fill(null));
function freshWeek(w: number): WeekFile {
  return { v: FILE_V as 5, week: w, start: B.weekStart(w), end: B.weekStart(w + 1), status: "waiting", seeding: null, picks: null, days: [], results: null, points: [], staked: null };
}
const recOk = (o: any, keys?: Set<string>) => !!o && typeof o === "object" && !Array.isArray(o) && Object.entries(o).every(([a, v]) => (!keys || keys.has(a)) && Number.isFinite(v as number) && (v as number) >= 0);
/** A recorded hour, with exactly the recorder's fields (#E-3 M-9: the publish job applies the same rule). */
export const hourOk = (h: any, seeds?: string[]) => {
  if (!h || typeof h !== "object") return false;
  const keys = Object.keys(h).sort().join(",");
  if (keys !== "av,by,checked,cr,from,n,q,r,to,w" && keys !== "av,by,checked,cr,from,n,q,r,re,to,w") return false;
  if ("re" in h && h.re !== 1) return false;
  const ks = seeds ? new Set(seeds) : undefined;
  return Number.isInteger(h.from) && Number.isInteger(h.to) && h.to === h.from + h.n - 1 && Number.isInteger(h.n) && h.n >= 0
    && recOk(h.by, ks) && recOk(h.cr, ks) && recOk(h.w, ks) && recOk(h.r, ks) && recOk(h.av, ks)
    && Object.values(h.by).every((x: any) => Number.isInteger(x) && x <= h.n)
    && Number.isFinite(h.q) && h.q >= 0 && h.checked === 2;
};
/** The two hours say the same (everything but the re-read mark). */
const sameHour = (a: any, b: any) => { const s = (h: any) => JSON.stringify({ ...h, checked: 2, re: undefined }); return s(a) === s(b); };
function loadWeek(dir: string | undefined, w: number): WeekFile {
  const f = freshWeek(w), old = readJson(dir, wName(w));
  if (!old || old.v !== FILE_V || old.week !== w) return f;
  const s = old.seeding;
  if (seedingOk(w, s)) f.seeding = s;
  if (old.status === "void") { f.status = "void"; f.void = typeof old.void === "string" ? old.void.slice(0, 200) : "void"; }
  else if (old.status === "none" && f.seeding && f.seeding.size === 0) { f.status = "none"; f.void = typeof old.void === "string" ? old.void.slice(0, 200) : "no bracket this week"; }
  if (f.seeding && old.picks && Array.isArray(old.picks.rows)) f.picks = { checked: old.picks.checked === 2 ? 2 : 1, rows: old.picks.rows.filter((x: any) => Array.isArray(x) && isAddr(x[0]) && Number.isSafeInteger(x[1]) && x[1] >= 0).map((x: any) => [x[0], x[1], Number(x[2]) || 0, x[3] ? 1 : 0] as Pick) };
  if (f.picks && old.staked && Array.isArray(old.staked.list) && old.staked.list.every(isAddr) && old.staked.checked === 2 && sortedUnique(old.staked.list)
      && (old.staked.held === undefined || (Array.isArray(old.staked.held) && sortedUnique(old.staked.held)))) {
    f.staked = { checked: 2, list: [...old.staked.list].sort() };
    if (Array.isArray(old.staked.held) && old.staked.held.every(isAddr)) f.staked.held = [...old.staked.held].sort();
  }
  if (old.vault === "missed") f.vault = "missed";
  f.days = emptyDays(f.seeding ? f.seeding.size : 0);
  if (Array.isArray(old.days)) old.days.forEach((d: any, r: number) => { if (r < f.days.length && Array.isArray(d)) d.forEach((h: any, i: number) => { if (i < 24 && hourOk(h, f.seeding!.seeds)) f.days[r][i] = h; }); });
  // A final week stays final and FROZEN (leaderboard standard: a published final board never changes): its stored
  // results and points are kept as they are, so a later rule change can't rewrite it (fix-check F-10). Repo Lens #E-3
  // L-12: a stored final week that doesn't hold together is kept too, exactly as published, never re-scored (the
  // publish job then holds the Bracket with an alert, since it doesn't pass its checks).
  if (old.status === "final" && f.status === "waiting" && f.seeding && f.picks) {
    f.status = "final"; f.results = old.results; f.points = Array.isArray(old.points) ? old.points : [];
    if (!finalOk(old, f)) { f.bad = "its stored final results don't hold together; kept as published, please check"; }
    return f;
  }
  return f;
}
const sortedUnique = (l: string[]) => l.every((x, i) => i === 0 || l[i - 1] < x);
/** A seeding as the recorder writes it (#E-3 M-9 / L-10: size, seeds, VHP, pooled and the hash agree). */
export function seedingOk(w: number, s: any): s is Seeding {
  if (!s || typeof s !== "object" || !Number.isInteger(s.size) || ![0, 8, 16, 32].includes(s.size)) return false;
  if (s.at !== B.seedTime(w) || !Number.isSafeInteger(s.cardAt) || (s.re !== undefined && s.re !== 1)) return false;
  if (!Array.isArray(s.seeds) || !s.seeds.every(isAddr) || s.seeds.length !== s.size || new Set(s.seeds).size !== s.seeds.length) return false;
  if (!Array.isArray(s.vhp) || s.vhp.length !== s.seeds.length || !s.vhp.every((v: any) => Number.isFinite(v) && v > 0)) return false;
  if (!s.vhp.every((v: number, i: number) => i === 0 || s.vhp[i - 1] >= v)) return false;
  if (!Array.isArray(s.out) || !s.out.every(isAddr) || !Array.isArray(s.outVhp) || s.outVhp.length !== s.out.length || s.out.some((a: string) => s.seeds.includes(a))) return false;
  if (!s.raw || typeof s.raw !== "object" || Array.isArray(s.raw) || !Object.entries(s.raw).every(([a, v]) => isAddr(a) && Number.isFinite(v as number) && (v as number) > 0)) return false;
  if (!Array.isArray(s.pooled) || !s.pooled.every((a: any) => isAddr(a) && s.seeds.includes(a)) || !Number.isFinite(s.totalVhp)) return false;
  return typeof s.hash === "string" && s.hash === seedHash(w, s);
}
/** A stored final week's results and points: the bracket's shape, one row per recorded pick, in pick order. */
function finalOk(old: any, f: WeekFile) {
  const r = old.results, R = f.seeding ? B.roundsOf(f.seeding.size) : 0;
  if (!r || r.done !== true || !Array.isArray(r.rounds) || r.rounds.length !== R) return false;
  if (!r.rounds.every((x: any, i: number) => Array.isArray(x) && x.length === f.seeding!.size / 2 ** (i + 1) && x.every((v: any) => Number.isInteger(v) && v >= 1 && v <= f.seeding!.seeds.length))) return false;
  const pk = f.picks!.rows, pt = old.points;
  return Array.isArray(pt) && pt.length === pk.length && pt.every((x: any, i: number) => Array.isArray(x) && x.length === 4 && x[0] === pk[i][0]
    && Number.isInteger(x[1]) && x[1] >= 0 && x[1] <= B.maxPoints(f.seeding!.size) && (x[2] === 0 || x[2] === 1) && Number.isInteger(x[3]) && x[3] >= 0 && x[3] < f.seeding!.size);
}
export function seedHash(w: number, s: Omit<Seeding, "hash">) {
  return crypto.createHash("sha256").update(JSON.stringify({ week: w, at: s.at, cardAt: s.cardAt, size: s.size, seeds: s.seeds, vhp: s.vhp, totalVhp: s.totalVhp, out: s.out, outVhp: s.outVhp, raw: s.raw, pooled: s.pooled })).digest("hex");
}
function defaultPicksContract(): string | null {
  try { const d = JSON.parse(fs.readFileSync(new URL("../../picks-data/deployment.json", import.meta.url), "utf8")); return isAddr(d.contract) ? d.contract : null; } catch { return null; }
}

/** Hour records for the given hour starts (all irreversible), on one node, from exact VHP. */
export async function readHours(n: Node, head: Head, starts: number[], seeds: string[], base: Record<number, Record<string, number>> = {}) {
  const first = Math.min(...starts), last = Math.max(...starts);
  // up to and including the first block after the last hour (#E-3 L-3: an hour is closed only by a block after it)
  const fromH = Math.max(1, (await heightAt(n, head, first)) - B.ACTIVE_BLOCKS), toH = await heightAt(n, head, last + HOUR);
  if (toH > head.lib) throw new Error("no irreversible block after the hour yet");
  const { c, book, effCheck } = await bookFor(n, fromH, toH, seeds); console.log(`effective VHP cross-check (hours): ${JSON.stringify(effCheck)}`);
  return B.exactHours(c, starts, seeds, book, base) as Omit<Hour, "checked">[];
}
/** The seeding card at time `at` (irreversible), on one node: exact VHP averaged over the SEED_BLOCKS blocks before. */
export async function readSeedCard(n: Node, head: Head, at: number) {
  const seedH = await heightAt(n, head, at), fromH = Math.max(1, seedH - B.SEED_BLOCKS);
  const { c, book, effCheck } = await bookFor(n, fromH, seedH - 1, []); console.log(`effective VHP cross-check (seeding): ${JSON.stringify(effCheck)}`);
  return { ...B.averageCard(c, 0, c.hs.length, book), at, height: seedH };
}
const PICKS_ABI = () => JSON.parse(fs.readFileSync(new URL("../../picks/abi/picks.koilib.json", import.meta.url), "utf8"));
async function readPicks(node: any, contract: string, round: number): Promise<RawPick[]> {
  const c = new Contract({ id: contract, abi: PICKS_ABI(), provider: node });
  const out: RawPick[] = [];
  let after: string | undefined;
  for (let page = 0; ; page++) {
    if (page >= MAX_PICK_PAGES) throw new Error(`more than ${MAX_PICK_PAGES * 100} picks for round ${round}; not recorded (#E-3 L-11)`);
    const r: any = await withRetry(`picks for round ${round}`, () => (c.functions as any).list_picks({ game: B.GAME_ID, round: String(round), ...(after ? { start_after: after } : {}), limit: 100 }));
    const rows = r?.result?.rows ?? [];
    for (const x of rows) {
      const num = Number(x.pick?.number ?? "0");
      if (isAddr(x.player) && Number.isSafeInteger(num) && num >= 0) out.push({ player: x.player, number: num, time: Number(x.pick?.time || 0) });
    }
    if (rows.length < 100) break;
    after = rows[rows.length - 1].player;
  }
  return out;
}

async function readGame(node: any, contract: string): Promise<any> {
  const c = new Contract({ id: contract, abi: PICKS_ABI(), provider: node });
  const r: any = await withRetry("the bracket's Picks game", () => (c.functions as any).get_game({ game: B.GAME_ID }));
  return r?.result?.game ?? null;
}
/** The Picks game must have exactly the shape bracket-math expects (audit F-5), or no picks are recorded. */
export function gameProblem(g: any): string | null {
  if (!g) return "the Picks contract has no bracket game";
  const want: [string, number][] = [["kind", 3], ["lock_mode", 2], ["round_size", B.WEEK], ["round_offset", B.ROUND_OFFSET], ["number_min", 0], ["number_max", B.NUMBER_MAX]];
  for (const [k, v] of want) if (Number(g[k] ?? 0) !== v) return `the Picks bracket game has ${k} ${g[k] ?? 0}, expected ${v}`;
  // tighten_game may lock earlier (a longer lead) or open later (a shorter ahead) at once; looser is never accepted (R-4)
  if (!(Number(g.lead ?? 0) >= B.LOCK_BEFORE)) return `the Picks bracket game has lead ${g.lead ?? 0}, expected at least ${B.LOCK_BEFORE}`;
  // picks may open no earlier than the seeding: the target (Tuesday 00:00 UTC) − ahead ≥ Sunday 00:00 UTC (2 days)
  const maxAhead = B.LOCK_DAY * B.DAY + B.SEED_BEFORE;
  if (!(Number(g.ahead ?? 0) > Number(g.lead ?? 0) && Number(g.ahead) <= maxAhead)) return `the Picks bracket game has ahead ${g.ahead ?? 0}, expected at most ${maxAhead}`;
  return null;
}

// ── the Vault's stakes (game 9) ──
function defaultVault(): string | null {
  try { const d = JSON.parse(fs.readFileSync(new URL("../../game-data/deployment.json", import.meta.url), "utf8")); return isAddr(d.contract) ? d.contract : null; } catch { return null; }
}
type Stakes = { staked: string[]; held: string[] };
/** The Vault's own rule, read with Block X's vault reader (RECORDER_STANDARD §2.4; #E-3 M-1, L-11): staked = the
 *  stake the Vault counts for the week (`week_stake`, the lowest that week; 0 if all was withdrawn) is at least the
 *  week's minimum, with the `v6_rule_week_plus_one` gate (before v6, nobody is staked); held = the most it had that
 *  week (peak) reached the minimum: the Vault refuses those players a free prize. 8 reads at a time; a failed read is
 *  an error, never "not staked". */
export function stakesReader(vault: string | null = defaultVault()) {
  const read = vaultReader(vault, B.GAME_ID);
  return async (node: any, players: string[], w: number): Promise<Stakes> => {
    const v = await read(node, players, w);
    const staked: string[] = [], held: string[] = [];
    for (const a of players) {
      const x = v.players.get(a);
      if (!v.live || !x) continue;
      if (x.week >= v.min) staked.push(a);
      if (x.week >= v.min || x.peak >= v.min) held.push(a);
    }
    return { staked, held };
  };
}
const asStakes = (x: string[] | Stakes): Stakes => (Array.isArray(x) ? { staked: [...x], held: [...x] } : { staked: [...x.staked], held: [...x.held] });

/** Order key for a week's standings: points, a right champion, right winners, then the earlier pick (owner 2026-10-29:
 *  ties go to who submitted first; same block → still tied, D-087). timeOf: player → pick time (ms); left out: no time. */
const keyOf = (r: Points, timeOf?: Map<string, number>) => [r[1], r[2], r[3], timeOf && timeOf.has(r[0]) ? -timeOf.get(r[0])! : 0];
const cmpKey = (a: number[], b: number[]) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return b[i] - a[i]; return 0; };
/** Groups of tied players, best first. */
function tiedGroups(rows: Points[], timeOf?: Map<string, number>): string[][] {
  const s = rows.map((r) => ({ p: r[0], k: keyOf(r, timeOf) })).sort((x, y) => cmpKey(x.k, y.k) || (x.p < y.p ? -1 : 1));
  const out: string[][] = [];
  s.forEach((x, i) => { if (i > 0 && cmpKey(s[i - 1].k, x.k) === 0) out[out.length - 1].push(x.p); else out.push([x.p]); });
  return out;
}
/** The Vault's cutoff on a list of groups (best first): the fewest whole groups holding at least ceil(30%) of the
 *  players (Kpred.ts finalizeGameStep: need = ceil(30% of the rows posted), walked down from the top, groups whole). */
const vaultNeed = (n: number) => Math.floor((n * 30 + 99) / 100);   // the Vault's own integer formula (WIN_PCT 30)
function paidGroupCount(groups: string[][]): number {
  const n = groups.reduce((t, g) => t + g.length, 0), need = vaultNeed(n);
  let got = 0, k = 0;
  while (k < groups.length && got < need) got += groups[k++].length;
  return k;
}
/** The Vault file's rows (Repo Lens #E-3 C-1): every staked player with ≥ 1 point. The groups the Vault must pay (its
 *  top 30%, groups whole, worked out first) get 255, 254, … in the week's order; every other row gets 1, so the
 *  Vault's own cutoff takes exactly the paid groups however many places there are. More than 254 paid groups: the
 *  lowest ones share 2 (still paid, the value-1 rows never). */
export function vaultRows(points: Points[], staked: Set<string>, timeOf?: Map<string, number>) {
  const groups = tiedGroups(points.filter(([p, pts]) => staked.has(p) && pts >= 1), timeOf);
  const paid = paidGroupCount(groups);
  const out: { player: string; points: number }[] = [];
  groups.forEach((g, i) => { const v = i < paid ? Math.max(2, 255 - i) : 1; for (const p of g) out.push({ player: p, points: v }); });
  return out.sort((x, y) => y.points - x.points || (x.player < y.player ? -1 : 1));
}
/** The players the Vault pays from a set of rows (its own cutoff: whole value groups from the top until ≥ 30%). */
export function vaultPays(rows: { player: string; points: number }[]): string[] {
  const need = vaultNeed(rows.length), by = new Map<number, string[]>();
  for (const r of rows) by.set(r.points, [...(by.get(r.points) ?? []), r.player]);
  const out: string[] = [];
  for (const v of [...by.keys()].sort((a, b) => b - a)) { if (out.length >= need) break; out.push(...by.get(v)!); }
  return out;
}

/** The free prize's winners (owner 2026-10-28; Vault payout rules): free players (not `held`) with at least 1 point,
 *  in the week's order (with the earlier pick breaking ties, owner 2026-10-29). first = everyone tied at the top. If
 *  exactly one is first, second = everyone tied next; if several share first, they share all 3 VHP and second is
 *  empty. A place with more than 10 tied (the Vault's limit) is left empty, and so is everything below it. */
export function freeWinners(points: Points[], held: Set<string>, timeOf?: Map<string, number>) {
  const g = tiedGroups(points.filter(([p, pts]) => !held.has(p) && pts >= 1), timeOf);
  const first = [...(g[0] ?? [])].sort();
  if (first.length > 10) return { first: [] as string[], second: [] as string[] };
  if (first.length !== 1) return { first, second: [] as string[] };
  const second = [...(g[1] ?? [])].sort();
  return { first, second: second.length > 10 ? [] : second };
}

/** BRACKET_PRIZES_FROM_WEEK (a repository variable): the first week the Vault pays game 9 — a plain week number 0-9999,
 *  else none (fails closed: no medals or prize lists are shown, as Block X's PRIZES_FROM_WEEK). */
export const prizesFromEnv = (v: string | undefined) => (v && /^[0-9]{1,4}$/.test(v.trim()) ? Number(v.trim()) : null);
/** The Staked board's earners: exactly the players the Vault would pay from the vault rows (#E-3 M-2). */
export function stakedEarners(points: Points[], timeOf?: Map<string, number>) {
  return vaultPays(vaultRows(points, new Set(points.map((r) => r[0])), timeOf));
}
/** Each player's pick time (the last change, ms) from a week's recorded picks. */
const timesOf = (wf: WeekFile | undefined) => new Map<string, number>((wf?.picks?.rows ?? []).map((r) => [r[0], r[2]]));
/** Score a week from what is recorded (live during the week, final after). */
export function scoreWeek(wf: WeekFile) {
  if (!wf.seeding || !wf.seeding.size || !wf.picks) return { results: null, points: [] as Points[] };
  const { size, seeds } = wf.seeding;
  const days = wf.days.map((d) => (d.every(Boolean) ? B.indexFromHours(d) : null));
  const res = B.results(seeds, size, days, wf.seeding.vhp, wf.seeding.pooled);   // with the forfeit rule (H-5) and pooled (H-4)
  // During a round's day: the winners so far are not known, so only finished rounds score.
  const points: Points[] = wf.picks.rows.map(([player, number]) => {
    const s = B.score(B.decode(number, size, seeds.length), res, size, seeds.length);
    return [player, s.points, s.champion ? 1 : 0, s.correct];
  });
  return { results: { rounds: res.rounds, done: res.done }, points };
}
/** The hours of a week, as [round, hour, start] (start of the UTC hour). */
const hoursOf = (w: number, wf: WeekFile) => { const out: [number, number, number][] = []; for (let r = 0; r < wf.days.length; r++) for (let h = 0; h < 24; h++) out.push([r, h, B.roundDay(w, r, wf.seeding!.size) + h * HOUR]); return out; };
/** Every hour of every round recorded and re-read in a later run (the two-run rule). */
const allReRead = (wf: WeekFile) => wf.days.length > 0 && wf.days.every((d) => d.every((h) => !!h && h.re === 1));
/** A week's file as written (never the `bad` note). */
const fileOf = (wf: WeekFile) => { const { bad: _bad, ...rest } = wf; return rest; };

/** One run. Exported for the tests, which pass fake nodes. */
export async function run(o: Opts) {
  const OUT = o.out ?? E.BRACKET_OUT ?? "games-data/bracket";
  const PRIZES_FROM = o.prizesFromWeek !== undefined ? o.prizesFromWeek : prizesFromEnv(E.BRACKET_PRIZES_FROM_WEEK);
  const PREV = o.prev ?? E.BRACKET_PREV ?? "";
  const problems: string[] = [];
  const contract = o.picksContract === undefined ? defaultPicksContract() : o.picksContract;
  const nodeP: Node = o.nodeOf ? o.nodeOf(o.p) : chainNode(o.p);
  const nodeC: Node | null = o.check ? (o.nodeOf ? o.nodeOf(o.check) : chainNode(o.check)) : null;
  let head: Head = o.head ?? (await nodeP.head());
  // Repo Lens #E-3 M-8: the lower of the two nodes' irreversible blocks, and its time and id read on both (audit F-4).
  if (nodeC) {
    if (!o.head) { const hc = await nodeC.head(); if (hc.lib < head.lib) head = { ...head, lib: hc.lib, libTime: await nodeP.blockTime(hc.lib) }; }
    const t2 = await nodeC.blockTime(head.lib);
    const sameId = (await nodeP.blockId(head.lib)) === (await nodeC.blockId(head.lib));
    if (t2 !== head.libTime || !sameId) { const pr = `the two nodes disagree about block ${head.lib}'s time; nothing written this run`; console.log(`::warning::${pr}`); return { problems: [pr], weeks: new Map(), board: null }; }
  }
  const now = head.libTime;
  const picksRead = o.picksOf ?? (contract ? (node: any, r: number) => readPicks(node, contract, r) : null);
  const stakedRead = o.stakedOf ?? stakesReader(o.vault === undefined ? defaultVault() : o.vault);
  const RELEASE_W = o.release ?? RELEASE;
  console.log(`head ${head.height} (${new Date(head.time).toISOString()}), irreversible ${head.lib} (${new Date(head.libTime).toISOString()})`);

  const idx = readJson(PREV, "index.json");
  const known = new Set<number>(Array.isArray(idx?.weeks) ? idx.weeks.filter((w: any) => Number.isInteger(w) && w >= 0 && w < 10000) : []);
  const nowW = B.weekOf(now);
  // A week the last run published must still be there: a missing file means the read failed (audit F-3). (A planted
  // index week can't stall this: the publish job only lets index weeks in together with their file, #E-3 H-3.)
  for (const w of known) if (w >= nowW - 1 && w <= nowW + 1 && !readJson(PREV, wName(w))) throw new Error(`last run's ${wName(w)} is missing; refusing to write (it would wipe that week)`);
  if (PREV && fs.existsSync(path.join(PREV, "board.json")) && !idx) throw new Error("last run's index.json is missing or unreadable; refusing to write");
  const weeks = new Map<number, WeekFile>();
  // Last week only if it was already being recorded (a first run doesn't void weeks from before it existed).
  for (const w of [nowW - 1, nowW, nowW + 1]) if (w >= 1 && (w >= nowW || known.has(w))) weeks.set(w, loadWeek(PREV, w));
  for (const wf of weeks.values()) if (wf.bad) problems.push(`week ${wf.week}: ${wf.bad}`);
  let hoursLeft = MAX_HOURS_PER_RUN, rereadsLeft = MAX_REREADS_PER_RUN;

  const readBoth = async (w: number, players: string[]): Promise<Stakes> => {
    if (!nodeC) throw new Error("a second node is needed to read the stakes (RPC_CHECK)");
    const s1 = asStakes(await stakedRead(o.p, players, w)), s2 = asStakes(await stakedRead(o.check, players, w));
    for (const s of [s1, s2]) { s.staked.sort(); s.held.sort(); }
    if (JSON.stringify(s1) !== JSON.stringify(s2)) throw new Error("the two nodes disagree about the stakes");
    return s1;
  };

  for (const [w, wf] of weeks) {
    if (wf.status === "final" || wf.status === "none" || wf.status === "void") continue;
    const backstop = B.weekStart(w + 1) + VAULT_DAYS;
    const released = RELEASE_W.has(w);   // the owner's one-off correction window for this week (BRACKET_RELEASE, fix-check F4)
    // ── 1. seeding ──
    const readCard = async (at: number) => {
      if (!nodeC) throw new Error("a second node is needed to seed (RPC_CHECK)");
      const c1 = await readSeedCard(nodeP, head, at), c2 = await readSeedCard(nodeC, head, at);
      if (JSON.stringify(c1) !== JSON.stringify(c2)) throw new Error("the two nodes disagree about the seeding");
      return c1;
    };
    const seedingFrom = (card: any): Omit<Seeding, "hash"> => {
      const at = B.seedTime(w);
      // #E-3 M-6 / fix-check RC-1: the raw averages of the last seeding before this one (up to 4 weeks back, so a void
      // week in between doesn't reopen the fresh-address gap); none at all → everyone on today's average
      let lastRaw: Record<string, number> = {};
      for (let k = 1; k <= LAST_SEEDING_WEEKS; k++) { const pw = weeks.get(w - k) ?? loadWeek(PREV, w - k); if (pw.seeding && pw.seeding.raw && Object.keys(pw.seeding.raw).length) { lastRaw = pw.seeding.raw; break; } }
      const s = B.seeding(card, lastRaw);
      const rows = [...card.field, ...card.paddock].filter((r: any) => isAddr(r.a) && Number.isFinite(r.vhp) && r.vhp > 0).sort((x: any, y: any) => (x.a < y.a ? -1 : 1));
      const raw: Record<string, number> = {}; for (const r of rows) raw[r.a] = Number(r.vhp);
      const totalVhp = Math.round(rows.reduce((t: number, r: any) => t + r.vhp, 0) * 100) / 100;
      // pooled producers (the Knode Games Pool, i.e. the vault: its VHP is players' withdrawable stakes; D-086, #E-3 H-4)
      const pooledAll = [o.vault === undefined ? defaultVault() : o.vault].filter((a): a is string => !!a && isAddr(a));
      return { at, cardAt: card.height, size: s.size, seeds: [...s.seeds], vhp: [...s.vhp], totalVhp, out: [...s.out], outVhp: [...s.outVhp], raw, pooled: pooledAll.filter((a) => s.seeds.includes(a)) };
    };
    if (!wf.seeding) {
      const at = B.seedTime(w);
      if (now < at) continue;
      // #E-3 L-4: void by time alone, once its 24 hours are over (a late read never seeds; the publish job refuses one too, F2)
      if (now >= at + SEED_GRACE) { wf.status = "void"; wf.void = "the seeding could not be read on two nodes within 24 hours; no bracket this week"; continue; }
      let card: any = null;
      try { card = await readCard(at); } catch (e) { problems.push(`week ${w}: seeding: ${(e as Error).message} (tried again next run)`); continue; }
      const base = seedingFrom(card);
      wf.seeding = { ...base, hash: seedHash(w, base) };
      wf.days = emptyDays(base.size);
      console.log(`week ${w}: seeded (${base.size || "no"} bracket); read again next run before it counts`);
      wf.status = base.size ? "open" : "waiting";
      continue;
    }
    // fix-check F2: the seeding counts only once a LATER run has read it again on both nodes and found the same
    if (wf.seeding.re !== 1) {
      try {
        const again = seedingFrom(await readCard(B.seedTime(w)));
        const { hash: _h, re: _r, ...was } = wf.seeding;
        if (JSON.stringify(again) === JSON.stringify(was)) { wf.seeding = { ...wf.seeding, re: 1 }; }
        else if (released && !wf.picks) { wf.seeding = { ...again, hash: seedHash(w, again) }; wf.days = emptyDays(again.size); problems.push(`week ${w}: the seeding read differently again; replaced under BRACKET_RELEASE (read again next run)`); continue; }
        else { problems.push(`week ${w}: the seeding reads differently now than when it was recorded; held until it's checked (BRACKET_RELEASE = ${w} lets the next run replace it)`); }
      } catch (e) { problems.push(`week ${w}: seeding re-read: ${(e as Error).message} (tried again next run)`); }
      if (wf.seeding.re !== 1) { if (now >= backstop) { wf.status = "void"; wf.void = "its seeding could not be confirmed by a second read before the backstop; no vault file"; } continue; }
    }
    if (!wf.seeding.size) { wf.status = "none"; wf.void = `only ${wf.seeding.out.length} producers in the field (8 needed); no bracket this week`; continue; }
    const { size, seeds } = wf.seeding;
    if (wf.status === "waiting") wf.status = "open";
    // ── 2. picks (two nodes only; recorded no later than PICKS_GRACE after the lock, fix-check F3) ──
    if (!wf.picks) {
      if (now < B.lockTime(w)) continue;
      // fix-check RC-4: a week whose picks never get recorded closes at the backstop
      if (now >= backstop) { wf.status = "void"; wf.void = "its picks could not be recorded; no vault file"; continue; }
      if (now >= B.lockTime(w) + PICKS_GRACE && !released) { problems.push(`week ${w}: picks weren't recorded within ${PICKS_GRACE / HOUR} h of the lock; the publish job won't take them later (BRACKET_RELEASE = ${w} allows one late record). The week closes at the backstop`); continue; }
      if (!nodeC) { problems.push(`week ${w}: picks wait for a second node (RPC_CHECK)`); continue; }
      if (!picksRead) wf.picks = { checked: 2, rows: [] };
      else {
        try {
          if (!o.picksOf || o.gameOf) {
            const g1 = o.gameOf ? await o.gameOf(o.p) : await readGame(o.p, contract!);
            const gp = gameProblem(g1);
            if (gp) { problems.push(`week ${w}: ${gp}; picks not recorded`); continue; }
            const g2 = o.gameOf ? await o.gameOf(o.check) : await readGame(o.check, contract!);
            if (JSON.stringify(g1) !== JSON.stringify(g2)) { problems.push(`week ${w}: the two nodes disagree about the Picks game; picks not recorded this run`); continue; }
          }
          const round = B.picksRound(w), raw = await picksRead(o.p, round);
          const other = await picksRead(o.check, round);
          const key = (x: RawPick[]) => JSON.stringify([...x].sort((u, v) => (u.player < v.player ? -1 : 1)));
          if (key(raw) !== key(other)) { problems.push(`week ${w}: the two nodes disagree about the picks; not recorded this run`); continue; }
          const seen = new Set<string>();
          const rows: Pick[] = [];
          let late = 0;
          for (const x of raw) {
            if (seen.has(x.player)) continue;
            if (!(x.time < B.lockTime(w))) { late++; continue; }   // the chain should refuse these; never count one (audit F-5)
            seen.add(x.player); rows.push([x.player, x.number, x.time, B.decode(x.number, size, seeds.length) ? 1 : 0]);
          }
          if (late) problems.push(`week ${w}: ${late} pick(s) timed at or after the lock were left out`);
          rows.sort((a, b) => (a[0] < b[0] ? -1 : 1));
          wf.picks = { checked: 2, rows };
          console.log(`week ${w}: ${rows.length} brackets locked (${rows.filter((r) => r[3]).length} valid)`);
        } catch (e) { problems.push(`week ${w}: picks: ${(e as Error).message} (tried again next run)`); continue; }
      }
    }
    wf.status = "locked";
    // ── 3. hours: every irreversible hour of the round days not recorded yet, in one batch per run ──
    const todo = hoursOf(w, wf).filter(([r, h, start]) => !wf.days[r][h] && start + HOUR <= now).slice(0, hoursLeft);
    if (todo.length && !nodeC) problems.push(`week ${w}: hours wait for a second node (RPC_CHECK)`);
    else if (todo.length) {
      hoursLeft -= todo.length;
      try {
        const starts = todo.map((x) => x[2]);
        // baselines for days whose first hour is already recorded (hours are recorded in order)
        const base: Record<number, Record<string, number>> = {};
        for (const [r] of todo) if (wf.days[r][0]) base[B.roundDay(w, r, size)] = wf.days[r][0]!.w;
        const a = await readHours(nodeP, head, starts, seeds, base);
        const b = await readHours(nodeC!, head, starts, seeds, base);
        const bad = a.findIndex((x, i) => JSON.stringify(x) !== JSON.stringify(b[i]));
        if (bad >= 0) throw new Error(`the two nodes disagree about round ${todo[bad][0] + 1} hour ${todo[bad][1]}; not recorded this run`);
        todo.forEach(([r, h], i) => { wf.days[r][h] = { ...a[i], checked: 2 }; });
        console.log(`week ${w}: ${todo.length} hour(s) recorded`);
      } catch (e) { problems.push(`week ${w}: hours: ${(e as Error).message} (tried again next run)`); }
    }
    // ── 3b. the two-run rule: hours recorded by an EARLIER run are read again on both nodes and must match ──
    const loaded = new Set(todo.map(([r, h]) => `${r}:${h}`));
    const again = hoursOf(w, wf).filter(([r, h]) => wf.days[r][h] && wf.days[r][h]!.re !== 1 && !loaded.has(`${r}:${h}`)).slice(0, rereadsLeft);
    if (again.length && nodeC) {
      rereadsLeft -= again.length;
      try {
        const starts = again.map((x) => x[2]);
        // each re-read works its baselines out again from the chain (hour 0 included), except days whose hour 0 isn't
        // in this batch: those use the recorded hour 0's (which is itself re-read on its own)
        const base: Record<number, Record<string, number>> = {};
        for (const [r] of again) if (!again.some(([r2, h2]) => r2 === r && h2 === 0)) base[B.roundDay(w, r, size)] = wf.days[r][0]!.w;
        const a = await readHours(nodeP, head, starts, seeds, base);
        const b = await readHours(nodeC, head, starts, seeds, base);
        again.forEach(([r, h], i) => {
          const was = wf.days[r][h];
          if (!was) return;   // cleared below by a replaced hour 0
          if (JSON.stringify(a[i]) === JSON.stringify(b[i]) && sameHour({ ...a[i], checked: 2 }, was)) wf.days[r][h] = { ...was, re: 1 };
          else if (released && JSON.stringify(a[i]) === JSON.stringify(b[i])) {
            // fix-check F4: under the owner's release, the two nodes' new reading replaces the recorded hour (read again
            // next run). A new hour 0 is a new baseline for the day, so the day's other hours are recorded again too.
            wf.days[r][h] = { ...a[i], checked: 2 };
            if (h === 0) for (let k = 1; k < 24; k++) wf.days[r][k] = null;
            problems.push(`week ${w}: round ${r + 1} hour ${h} replaced under BRACKET_RELEASE (read again next run)`);
          }
          else problems.push(`week ${w}: round ${r + 1} hour ${h} reads differently now than when it was recorded; the week can't go final until it's checked (BRACKET_RELEASE = ${w} lets the next run replace it)`);
        });
      } catch (e) { problems.push(`week ${w}: re-reading hours: ${(e as Error).message} (tried again next run)`); }
    }
    // ── 4. results and points ──
    const sc = scoreWeek(wf);
    wf.results = sc.results; wf.points = sc.points;
    const done = !!(sc.results && sc.results.done);
    // ── 5. stakes: for the boards during the week; the vault file's own read once the week has ended ──
    const players = wf.picks!.rows.map((r) => r[0]);
    // fix-check F1: the end-of-week stakes count only once a LATER run has read them again on both nodes and found the
    // same (the two-run rule, as for hours): one forged run can't decide who is paid
    let stakesConfirmed = false;
    if (now >= B.weekStart(w + 1)) {
      try {
        const st = await readBoth(w, players), read = { checked: 2, list: st.staked, held: st.held };
        if (!wf.staked || !wf.staked.held) wf.staked = read;
        else if (JSON.stringify(read) === JSON.stringify({ checked: 2, list: wf.staked.list, held: wf.staked.held })) stakesConfirmed = true;
        else if (released) { wf.staked = read; problems.push(`week ${w}: the end-of-week stakes read differently; replaced under BRACKET_RELEASE (read again next run)`); }
        else problems.push(`week ${w}: the end-of-week stakes read differently now than when they were recorded; held until they're checked (BRACKET_RELEASE = ${w} lets the next run replace them)`);
      } catch (e) { problems.push(`week ${w}: stakes after the week: ${(e as Error).message} (tried again next run)`); }
    } else if (!wf.staked && now >= B.weekStart(w)) {
      try { wf.staked = { checked: 2, list: (await readBoth(w, players)).staked }; }
      catch (e) { problems.push(`week ${w}: stakes: ${(e as Error).message} (tried again next run)`); }
    }
    // ── 6. final (no earlier than Monday 00:00 UTC after the week; WEEK_CYCLE.md) ──
    if (now >= B.finalFrom(w)) {
      const reRead = allReRead(wf);
      if (done && reRead && stakesConfirmed) { wf.status = "final"; console.log(`week ${w}: final`); }
      else if (now >= backstop) {
        if (done && reRead) { wf.status = "final"; wf.vault = "missed"; problems.push(`week ${w}: closed at the backstop without the Vault's stakes; no vault file (the Vault rolls the week over)`); }
        else { wf.status = "void"; wf.void = "its results could not be completed and checked within 3 days of the week's end; no vault file"; problems.push(`week ${w}: void at the backstop: results never completed or re-read`); }
      } else problems.push(`week ${w}: in review: ${!done ? "results not all in" : !reRead ? "hours still being re-read" : "waiting for the Vault's stakes to read the same twice"}`);
    }
  }

  // ── 7. leaderboards ──
  const allW = new Map(weeks);
  for (const w of known) if (!allW.has(w)) allW.set(w, loadWeek(PREV, w));
  // A week's medals and prizes (#E-3 M-2): only for a final week that wasn't missed, with the stakes read after it,
  // from exactly the rows the vault file holds; and only from the week the Vault pays game 9.
  const paysFor = (wf: WeekFile | undefined) => !!(wf && wf.status === "final" && wf.vault !== "missed" && wf.staked && wf.staked.held && PRIZES_FROM !== null && wf.week >= PRIZES_FROM);
  type BRow = { player: string; points: number; champion: boolean; correct: number; ranked: boolean; time?: number };
  const earnsOf = (wf: WeekFile) => {
    const earn = new Map<string, number>(), tm = timesOf(wf), heldSet = new Set([...(wf.staked!.held ?? []), ...wf.staked!.list]);
    const fw = freeWinners(wf.points, heldSet, tm);
    fw.first.forEach((a) => earn.set(a, 1)); fw.second.forEach((a) => earn.set(a, 2));
    for (const a of vaultPays(vaultRows(wf.points, new Set(wf.staked!.list), tm))) earn.set(a, 3);
    return earn;
  };
  const view = (rows: BRow[], earn: Map<string, number> | null) => {
    const part = (r: boolean) => B.rank(rows.filter((x) => x.ranked === r)).slice(0, MAX_BOARD_ROWS)
      .map((x: any) => ({ a: x.player, place: x.place, boardPlace: x.place, pts: x.points, champion: x.champion, correct: x.correct, ranked: r, earns: earn?.get(x.player) ?? 0 }));
    return [...part(true), ...part(false)];
  };
  // Staked board: staked that week, or held a stake in the Bracket during it (a withdrawal doesn't move a player to Free
  // play, where it could never win the prize: fix-check F-5); a held-only player earns nothing there (#E-3 M-2)
  const stakedSet = (wf: WeekFile | undefined) => new Set([...(wf?.staked?.list ?? []), ...(wf?.staked?.held ?? [])]);
  // with each pick's time, so the board's places break ties exactly as the vault file's values do (the vault bot holds a
  // week whose file and board disagree on the order, bot/vault.ts orderBreak)
  const weekRows = (wf: WeekFile | undefined): BRow[] => { const st = stakedSet(wf), tm = timesOf(wf); return wf ? wf.points.map(([player, points, champ, correct]) => ({ player, points, champion: !!champ, correct, ranked: st.has(player), time: tm.get(player) })) : []; };
  const wv = (w: number) => { const wf = allW.get(w); return { week: w, start: B.weekStart(w), status: wf ? wf.status : "waiting", final: wf?.status === "final", rows: view(weekRows(wf), paysFor(wf) ? earnsOf(wf!) : null) }; };
  /** Last week, with its free prizes once final (the Leaders page's medals): [{player, place, vhp}] by the Vault's
   *  payout rule — tied for 1st share all 3 VHP; a single 1st gets 2 and those tied for 2nd share 1. */
  const lastWeekView = (w: number) => {
    const v: any = wv(w), wf = allW.get(w);
    const prizes: { player: string; place: number; vhp: number }[] = [];
    if (paysFor(wf)) {
      const fw = freeWinners(wf!.points, new Set([...(wf!.staked!.held ?? []), ...wf!.staked!.list]), timesOf(wf));
      if (fw.first.length >= 2) for (const a of fw.first) prizes.push({ player: a, place: 1, vhp: 3 / fw.first.length });
      else { for (const a of fw.first) prizes.push({ player: a, place: 1, vhp: 2 }); for (const a of fw.second) prizes.push({ player: a, place: 2, vhp: 1 / fw.second.length }); }
    }
    return { ...v, prizes };
  };
  const tot = new Map<string, { player: string; points: number; champion: boolean; correct: number; champs: number; ranked: boolean }>();
  for (const wf of allW.values()) if (wf.status === "final") { const st = stakedSet(wf); for (const [player, points, champ, correct] of wf.points) {
    const t = tot.get(player) || { player, points: 0, champion: false, correct: 0, champs: 0, ranked: false };
    t.points += points; t.correct += correct; t.champs += champ; t.champion = t.champs > 0; t.ranked = t.ranked || st.has(player); tot.set(player, t);
  } }
  const allRows = view([...tot.values()], null);
  const board = { v: 1, updated: new Date(now).toISOString(), next: wv(nowW + 1), week: wv(nowW), lastWeek: nowW >= 2 ? lastWeekView(nowW - 1) : null, allTime: { rows: allRows } };

  // ── 8. write (everything first, so a file that would be too big stops the run before anything is written) ──
  const files: [string, string][] = [];
  for (const [w, wf] of weeks) {
    if (wf.status === "waiting" && !wf.seeding) continue;
    known.add(w);
    files.push([wName(w), JSON.stringify(fileOf(wf)) + "\n"]);
  }
  // the Vault files: final weeks with their end-of-week stakes, until Thursday 00:00 UTC after the week
  for (const [w, wf] of weeks) {
    if (wf.status !== "final" || !wf.staked || !wf.staked.held || wf.vault === "missed" || wf.bad || now > B.weekStart(w + 1) + VAULT_DAYS) continue;
    const tm = timesOf(wf), prize = freeWinners(wf.points, new Set([...(wf.staked.held ?? []), ...wf.staked.list]), tm);
    const file = { game: B.GAME_ID, week: w, final: true, rows: vaultRows(wf.points, new Set(wf.staked.list), tm), first: prize.first, second: prize.second };
    files.push([path.join("vault", `W${w}.json`), JSON.stringify(file) + "\n"]);
  }
  files.push(["index.json", JSON.stringify({ v: 1, updated: new Date(now).toISOString(), weeks: [...known].sort((a, b) => a - b), contract: contract || null, game: B.GAME_ID, prizesFromWeek: PRIZES_FROM }) + "\n"]);
  files.push(["board.json", JSON.stringify(board) + "\n"]);
  const big = files.filter(([, t]) => Buffer.byteLength(t) > MAX_FILE_BYTES).map(([f]) => f);
  if (big.length) throw new Error(`refusing to write files over ${MAX_FILE_BYTES} bytes (the publish job's limit): ${big.join(", ")}`);
  fs.mkdirSync(path.join(OUT, "vault"), { recursive: true });
  for (const [f, t] of files) fs.writeFileSync(path.join(OUT, f), t);
  if (!fs.readdirSync(path.join(OUT, "vault")).length) fs.rmdirSync(path.join(OUT, "vault"));
  for (const pr of problems) console.log(`::warning::${pr}`);
  return { problems, weeks, board };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run({ p: new Provider([RPC]), check: RPC_CHECK ? new Provider([RPC_CHECK]) : null }).catch((e) => { console.error(e); process.exit(1); });
}
