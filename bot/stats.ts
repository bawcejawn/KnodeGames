/**
 * Knode Games live stats (owner, 5 Nov: "build the live stats panel"). Once an hour the stats workflow builds
 * stats.json, a small public summary that the home page strip and the games page panel show (stats.js). One file
 * for everyone, so a visitor's page makes no chain reads for it (a marketing burst must not hit the public node,
 * which turns bursts away: I-006).
 *
 * What it counts (all public):
 *   - players this week / last week / all time: wallets that answered Daily Questions (the vault's list_players),
 *     picked in Producer Race (race-data board.json) or Who Signs Block X (games-data blockx/board.json)
 *   - plays this week: question answers + race picks + Block X picks
 *   - VHP staked: the vault's total stake, and each game's (list_games)
 *   - free prizes: 2 VHP and 1 VHP a week (the vault rule, D-062)
 *   - blocks the prize vault made in the last 24 hours (blocks-data recent-blocks.json)
 *   - today's open questions: how many, when answers close, answers so far
 *   - last week's top 3 in each game
 *
 * Workflow (.github/workflows/stats.yml, job "check", read-only token, no secrets):
 *   npm run stats -- run
 *   Env: DATA_DIR (board.json, blockx-board.json, recent-blocks.json from the public data branches), RPC, RPC_CHECK,
 *   STATS_OUT (gets stats.json). Read-only: it never signs or sends anything.
 * Owner, on the PC: `npm run stats -- show` prints what it would publish (reads the same public sources).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { Contract, Provider } from "koilib";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const VAULT = "1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr";   // the game contract = the prize vault (v6); it also produces blocks
const ADDR = /^1[1-9A-HJ-NP-Za-km-z]{25,34}$/;
const UNIT = 100000000n;
const HOUR = 3600000, DAY = 24 * HOUR, WEEK = 7 * DAY;
export const FREE_PRIZES = [2, 1];                             // VHP, 1st and 2nd free player each week (D-062)
const CALL_MS = 8000;
/** stats.json must stay small; the publish job refuses anything over 64 KB. */
export const MAX_BYTES = 60_000;

// ═══════════════ pure: the inputs → stats.json ═══════════════
export type Answer = { question_id: number; option: number };
export type QRow = { address: string; answers: Answer[] };
export type Inputs = {
  now: number;
  week: { start: number; end: number };                    // the current week (Monday 00:00 UTC to the next)
  totalStake: bigint;                                      // vault totals.total_stake (8 decimals)
  games: { id: number; name: string; staked: boolean; stake: bigint }[];
  qWeek: QRow[];                                           // Daily Questions players this week, with their answers
  qLastWeek: QRow[];
  qAll: string[];                                          // every Daily Questions player ever (week 0)
  outcomes: Map<number, number>;                           // question id → outcome (0 open, 1000 void, else option + 1)
  open: { id: number; lockTime: number }[];                // questions whose answers are still open
  raceBoard: any;                                          // race-data board.json
  blockxBoard: any;                                        // games-data blockx/board.json
  recentBlocks: any;                                       // blocks-data recent-blocks.json
};
/** Characters a game name may not contain: < >, control characters, and invisible or direction-changing ones (Repo
 *  Lens C9-5). The same rule is in stats.js and the publish job. */
export const BAD_NAME = /[<>\u0000-\u001f\u007f-\u009f\u061c\u200b-\u200f\u2028-\u202e\u2060-\u2069\ufeff\u3164]/;
/** A source counts only if it was made within this long (C9-2): a stalled recorder must not pass for "this week". */
export const MAX_SOURCE_AGE = 3 * HOUR;
/** null when a source is missing, unreadable or older than MAX_SOURCE_AGE (by its `updated` or `made` time). */
export function fresh(src: any, now: number): any {
  if (!src) return null;
  const t = Date.parse(String(src.updated ?? src.made ?? ""));
  return Number.isFinite(t) && now - t <= MAX_SOURCE_AGE && t - now <= 10 * 60000 ? src : null;
}
const vhp = (units: bigint) => Number(units / UNIT) + Number(units % UNIT) / 1e8;
const round2 = (x: number) => Math.round(x * 100) / 100;
const okInt = (n: any) => Number.isInteger(n) && n >= 0 && n < 1e9;
/** A board's rows with a real address; a row with a malformed number is dropped, not the whole file (C9-7). */
const rowsOf = (board: any, key: string): any[] => (board && board[key] && Array.isArray(board[key].rows) ? board[key].rows : [])
  .filter((r: any) => r && typeof r.a === "string" && ADDR.test(r.a) && (r.pts === undefined || okInt(r.pts)) && (r.picks === undefined || okInt(r.picks)));
const sectionAt = (board: any, key: string, want: number) => { const sec = board && board[key]; return !!sec && typeof sec.start === "number" && Math.abs(sec.start - want) < HOUR; };
/** This week's and last week's rows from a board, by each section's own start. Just after Monday 00:00 a board that
 *  hasn't rolled over yet still calls last week "week": it is then used as last week (Repo Lens C9-2). */
export function boardWeeks(board: any, start: number): { week: any[]; last: any[] } {
  const week = sectionAt(board, "week", start) ? rowsOf(board, "week") : [];
  const last = sectionAt(board, "lastWeek", start - WEEK) ? rowsOf(board, "lastWeek") : sectionAt(board, "week", start - WEEK) ? rowsOf(board, "week") : [];
  return { week, last };
}
const picksOf = (rows: any[]) => rows.reduce((s, r) => s + (okInt(r.picks) ? r.picks : 0), 0);
/** Top 3 by points (ties share a place); only players with at least 1 point. */
export function top3(rows: { a: string; pts: number }[]): { a: string; pts: number; place: number }[] {
  const s = rows.filter((r) => ADDR.test(r.a) && r.pts > 0).sort((x, y) => y.pts - x.pts || (x.a < y.a ? -1 : 1));
  const out: { a: string; pts: number; place: number }[] = [];
  for (let i = 0; i < s.length; i++) {
    const place = i > 0 && s[i].pts === s[i - 1].pts ? out[i - 1].place : i + 1;
    if (place > 3) break;
    out.push({ a: s[i].a, pts: s[i].pts, place });
  }
  return out.slice(0, 5);   // ties at 3rd can make a few more; never a long list
}
/** Daily Questions points: one per answer that matches its question's outcome (void and open questions score 0). */
export function questionPoints(rows: QRow[], outcomes: Map<number, number>) {
  return rows.map((r) => ({ a: r.address, pts: r.answers.filter((x) => { const o = outcomes.get(Number(x.question_id)); return !!o && o !== 1000 && o === Number(x.option) + 1; }).length }));
}
/** Blocks `who` signed in the last `hours` of the recent-blocks snapshot (null when the snapshot doesn't reach that far). */
export function blocksBy(rb: any, who: string, hours: number): number | null {
  if (!rb || rb.v !== 1 || !Array.isArray(rb.signers) || !Array.isArray(rb.sig) || !Array.isArray(rb.dts) || rb.sig.length !== rb.dts.length) return null;
  const idx = rb.signers.indexOf(who);
  let ms = 0, n = 0;
  for (let i = rb.sig.length - 1; i >= 0; i--) {
    if (rb.sig[i] === idx) n++;
    ms += Number(rb.dts[i]) || 0;
    if (ms >= hours * HOUR) return n;
  }
  return null;
}

export function buildStats(x: Inputs) {
  const { now, week } = x;
  // A stale board or block snapshot isn't used for this week / last week / the last 24 hours (C9-2); the players it
  // lists still count all time.
  const rb = fresh(x.raceBoard, now), bb = fresh(x.blockxBoard, now);
  const { week: raceWeek, last: raceLast } = boardWeeks(rb, week.start), { week: bxWeek, last: bxLast } = boardWeeks(bb, week.start);
  const qWeek = x.qWeek.filter((r) => ADDR.test(r.address) && r.answers.length > 0);
  const qLast = x.qLastWeek.filter((r) => ADDR.test(r.address) && r.answers.length > 0);
  const set = (...lists: string[][]) => new Set(lists.flat());
  const thisWeek = set(qWeek.map((r) => r.address), raceWeek.map((r) => r.a), bxWeek.map((r) => r.a));
  const lastWeek = set(qLast.map((r) => r.address), raceLast.map((r) => r.a), bxLast.map((r) => r.a));
  const all = set(x.qAll.filter((a) => ADDR.test(a)), ...["allTime", "week", "lastWeek"].flatMap((k) => [rowsOf(x.raceBoard, k).map((r) => r.a), rowsOf(x.blockxBoard, k).map((r) => r.a)]), [...thisWeek], [...lastWeek]);
  const answers = qWeek.reduce((s, r) => s + r.answers.length, 0);
  const racePicks = picksOf(raceWeek), blockxPicks = picksOf(bxWeek);
  const openIds = new Set(x.open.filter((q) => q.lockTime > now).map((q) => q.id));
  const todayAnswers = qWeek.reduce((s, r) => s + r.answers.filter((a) => openIds.has(Number(a.question_id))).length, 0);
  const closes = x.open.filter((q) => q.lockTime > now).map((q) => q.lockTime).sort((a, b) => a - b)[0] ?? null;
  const pts = (rows: any[]) => rows.map((r) => ({ a: r.a, pts: okInt(r.pts) ? r.pts : 0 }));
  return {
    v: 1,
    updated: new Date(now).toISOString(),
    week: { start: week.start, end: week.end },
    players: { week: thisWeek.size, lastWeek: lastWeek.size, allTime: all.size },
    plays: { answers, racePicks, blockxPicks, total: answers + racePicks + blockxPicks },
    staked: { total: round2(vhp(x.totalStake)), games: x.games.filter((g) => g.staked).map((g) => ({ id: g.id, name: BAD_NAME.test(String(g.name)) ? `Game ${g.id}` : String(g.name).slice(0, 40), vhp: round2(vhp(g.stake)) })) },
    prizes: { free: FREE_PRIZES },
    blocks: { vault24h: blocksBy(fresh(x.recentBlocks, now), VAULT, 24) },
    today: { open: openIds.size, closes, answers: todayAnswers },
    top: { questions: top3(questionPoints(qLast, x.outcomes)), race: top3(pts(raceLast)), blockx: top3(pts(bxLast)) },
  };
}

/** The same checks the publish job and stats.js make, so a bad file is never written. */
export function checkStats(s: any): string | null {
  const int = (n: any) => Number.isInteger(n) && n >= 0 && n < 1e9;
  const num = (n: any) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n < 1e12;
  if (!s || s.v !== 1 || typeof s.updated !== "string" || s.updated.length > 40) return "top level";
  if (!int(s.players?.week) || !int(s.players?.lastWeek) || !int(s.players?.allTime)) return "players";
  if (!["answers", "racePicks", "blockxPicks", "total"].every((k) => int(s.plays?.[k]))) return "plays";
  if (!num(s.staked?.total) || !Array.isArray(s.staked.games) || s.staked.games.length > 20) return "staked";
  for (const g of s.staked.games) if (!int(g.id) || typeof g.name !== "string" || !g.name || g.name.length > 40 || BAD_NAME.test(g.name) || !num(g.vhp)) return "staked game";
  if (!(s.week && Number.isInteger(s.week.start) && Number.isInteger(s.week.end) && s.week.end > s.week.start)) return "week";
  if (!(s.blocks && (s.blocks.vault24h === null || int(s.blocks.vault24h)))) return "blocks";
  if (!(s.today && int(s.today.open) && int(s.today.answers) && (s.today.closes === null || (Number.isInteger(s.today.closes) && s.today.closes > 1.6e12 && s.today.closes < 4e12)))) return "today";
  for (const k of ["questions", "race", "blockx"]) {
    const l = s.top?.[k];
    if (!Array.isArray(l) || l.length > 5) return "top " + k;
    for (const r of l) if (!ADDR.test(r.a) || !int(r.pts) || !int(r.place) || r.place < 1 || r.place > 3) return "top " + k;
  }
  if (JSON.stringify(s).length > MAX_BYTES) return "size";
  return null;
}

// ═══════════════ the chain (read-only) ═══════════════
function within<T>(p: Promise<T>, ms = CALL_MS): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  return Promise.race([p, new Promise<T>((_, no) => { t = setTimeout(() => no(new Error(`no answer in ${ms / 1000} s`)), ms); })]).finally(() => clearTimeout(t));
}
/** The vault's read calls, on the first node that answers (RPC, then RPC_CHECK). Numbers only: no node can plant text
 *  on the page (stats.js draws every value as a number, and addresses through names.js). */
export function vaultReader(rpcs: string[]) {
  const abi = JSON.parse(fs.readFileSync(path.join(ROOT, "game/abi/kpred.koilib.json"), "utf8"));
  const fns = rpcs.map((rpc) => new Contract({ id: VAULT, provider: new Provider([rpc]), abi }).functions);
  // Once a node fails a call, the other one is asked first for the rest of the run (Repo Lens C9-1): a node that holds
  // requests without answering would otherwise cost 8 s on every call.
  let first = 0;
  const read = async (fn: string, args: any): Promise<any> => {
    let last: unknown;
    const from = first;   // this call's order is fixed before it starts
    for (let k = 0; k < fns.length; k++) {
      const i = (from + k) % fns.length;
      try { return (await within(fns[i][fn](args))).result || {}; } catch (e) { last = e; if (i === from) first = (from + 1) % fns.length; }
    }
    throw last;
  };
  return {
    state: () => read("get_state", {}),
    games: () => read("list_games", {}),
    question: (id: number) => read("get_question", { id }),
    players: (week: string) => pagePlayers((args) => read("list_players", args), week),
  };
}
export const MAX_PAGES = 200;
/** Every player row, 50 at a time (at most MAX_PAGES × 50 = 10,000), with that week's answers. Past the cap it says so
 *  (Repo Lens C9-4): the counts are then a lower bound. */
export async function pagePlayers(list: (args: any) => Promise<any>, week: string, warn: (m: string) => void = console.warn): Promise<QRow[]> {
      const out: QRow[] = [];
      let start: string | undefined;
      for (let page = 0; page < MAX_PAGES; page++) {
        const rows: any[] = (await list({ ...(start ? { start } : {}), limit: 50, week })).rows || [];
        for (const r of rows) if (typeof r.address === "string") out.push({ address: r.address, answers: ((r.entry && r.entry.answers) || []).map((a: any) => ({ question_id: Number(a.question_id), option: Number(a.option || 0) })) });
        if (rows.length < 50) break;
        if (page === MAX_PAGES - 1) warn(`more than ${MAX_PAGES * 50} players: the counts are a lower bound`);
        start = rows[rows.length - 1].address;
      }
      return out;
}

const readJson = (file: string) => { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; } };
/** The questions still open, from the site's own question files (game-data/questions, newest first). */
function openQuestions(now: number): { id: number; lockTime: number }[] {
  const dir = path.join(ROOT, "game-data/questions");
  if (!fs.existsSync(dir)) return [];
  const out: { id: number; lockTime: number }[] = [];
  for (const f of fs.readdirSync(dir).filter((x) => /^W\d{3}-D\d(-00)?\.json$/.test(x)).sort().slice(-4)) {
    const d = readJson(path.join(dir, f));
    for (const q of (d && Array.isArray(d.questions) ? d.questions : [])) {
      const id = Number(q.chainId), lock = Number(q.lockTime);
      if (Number.isInteger(id) && id > 0 && Number.isFinite(lock) && lock > now) out.push({ id, lockTime: lock });
    }
  }
  return out;
}

export type Reader = Pick<ReturnType<typeof vaultReader>, "state" | "games" | "question" | "players">;
export async function gather(now: number, v: Reader, dataDir: string, openQs = openQuestions(now)): Promise<Inputs> {
  const st = await v.state();
  // The week the same way the Daily Questions page works it out (app.js loadLive): from the contract's genesis_time
  // and week_length, at chain time.
  const c = st.config || {}, g = Number(c.genesis_time || 0), wl = Number(c.week_length || 0) || WEEK, t = Number(st.time || 0) || now;
  if (!(g > 0)) throw new Error("the vault's genesis_time couldn't be read");
  const w = t <= g ? 0 : Math.floor((t - g) / wl);
  const week = { start: g + w * wl, end: g + (w + 1) * wl };
  const games = ((await v.games()).games || []).map((g: any) => ({ id: Number(g.id), name: String(g.name || ""), staked: !!g.staked, stake: BigInt(g.stake || 0) }));
  // list_players pages through every player the vault knows (stakers and answerers, any week); `week` only picks
  // which week's entry (answers) comes with each row (game/assembly/Kpred.ts). So the all-time list is the same pages.
  const qWeek = await v.players(String(w));
  const qLastWeek = w > 0 ? await v.players(String(w - 1)) : [];
  const qAll = qWeek.map((r) => r.address);
  const ids = new Set(qLastWeek.flatMap((r) => r.answers.map((a) => a.question_id)));
  const outcomes = new Map<number, number>();
  for (const id of ids) outcomes.set(id, Number(((await v.question(id)).question || {}).outcome || 0));
  return {
    now, week, totalStake: BigInt(st.totals?.total_stake || 0), games, qWeek, qLastWeek, qAll, outcomes, open: openQs,
    raceBoard: readJson(path.join(dataDir, "board.json")), blockxBoard: readJson(path.join(dataDir, "blockx-board.json")), recentBlocks: readJson(path.join(dataDir, "recent-blocks.json")),
  };
}

async function main(argv: string[]) {
  const cmd = argv[0] || "show";
  const rpcs = [process.env.RPC || "https://koinos.armana.io", process.env.RPC_CHECK || "https://api.koinosblocks.com"];
  const dataDir = process.env.DATA_DIR || path.join(ROOT, ".stats-data");
  const now = Date.now(), x = await gather(now, vaultReader(rpcs), dataDir);
  for (const [name, src] of [["race board", x.raceBoard], ["Block X board", x.blockxBoard], ["recent blocks", x.recentBlocks]] as const)
    if (!fresh(src, now)) console.log(`${name}: missing or more than ${MAX_SOURCE_AGE / HOUR} hours old, not used this hour.`);
  const stats = buildStats(x);
  const bad = checkStats(stats);
  if (bad) throw new Error(`stats.json failed its own check (${bad}); nothing written`);
  const text = JSON.stringify(stats) + "\n";
  if (cmd === "run") {
    const out = process.env.STATS_OUT;
    if (!out) throw new Error("STATS_OUT is not set");
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, "stats.json"), text);
    console.log(`stats.json: ${stats.players.week} players this week, ${stats.plays.total} plays, ${stats.staked.total} VHP staked.`);
  } else console.log(JSON.stringify(stats, null, 2));
}
// Exit as soon as the work is done (Repo Lens C9-1): a request a node never answered may still hold the process open,
// and the job would then run to its time limit and publish nothing.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(() => process.exit(0), (e) => { console.error(String(e && e.message || e).replace(/::/g, ": :")); process.exit(1); });
}
