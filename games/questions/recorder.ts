/**
 * Daily Questions (game 1) results recorder: from Vault v6.1's rule week (D-116, Mon 16 Nov 2026) the vault pays Daily
 * Questions from a results file, like every vault game. Run every hour by .github/workflows/games.yml; read-only on the
 * chain, holds no key, writes files that the publish job checks and puts on the games-data branch (folder questions/).
 *
 * Each run, for the week that just ended (vault week w = this week − 1), only when it is a shared-rules week
 * (config.q60_rule_week_plus_one > 0 and w + 1 >= it, on both nodes) and inside the vault's window (week end → results
 * due, end + 3 days):
 *  1. Reads, on BOTH nodes (RPC, RPC_CHECK), get_state, the week's questions (get_question, walking down from
 *     next_question_id while the week is ≥ w) and every player's entry for the week (list_players, 50 a page). The two
 *     nodes must give exactly the same snapshot; any failed read stops the run (it's never "zero" or "not staked").
 *  2. Scores it with math.js (scoreWeek). Until every question that counts is resolved, the week is pending.
 *  3. Writes questions/W<NNN>.json (the inputs: questions, players, minimum, and the snapshot's hash), board.json
 *     (lastWeek: both boards, for the vault bot's board check) and, once final, questions/vault/W<w>.json.
 *  4. Final: the snapshot is complete and the same hash was written by an earlier run at least an hour before
 *     (`seen.at`, the chain time of that run), and this run re-read it on both nodes. A final W file and its vault file
 *     are written once: later runs copy them forward unchanged, and a run whose snapshot differs from a published final
 *     stops (the vault bot also holds a file that changes).
 *  5. The owner can hold a week (QUESTIONS_HOLD="<week>[,<week>…]", a reason in QUESTIONS_HOLD_REASON) and later release
 *     it (QUESTIONS_RELEASE="<week>…"): HOLD-W<w>.json / RELEASE-W<w>.json next to the vault file. They are only ever
 *     added (RECORDER_STANDARD §5.5).
 *
 *   npm run questions                     (RPC, RPC_CHECK, QUESTIONS_PREV, QUESTIONS_OUT)
 *   npm run questions -- --week 2 --dry   any week, shared or not, printed and not written (checks the scoring against
 *                                         the contract's own settled points for old-rules weeks)
 *
 * Built to RECORDER_STANDARD.md; laid out like templates/game/ (math.js holds every rule) so it moves into the shared
 * game kit (D-146) with its I/O parts replaced by the kit's.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { scoreWeek } from "./math.js";
import { withRetry } from "../../common.ts";

export const GAME = 1;
export const STABLE_MS = 3_600_000;              // final once two runs at least an hour apart read the same snapshot
export const MAX_FILE = 1_900_000;               // bytes: under the publish job's 2 MB cap (RECORDER_STANDARD §6.7)
export const WARN_FILE = Math.floor(MAX_FILE * 0.6); // bytes: from here every run warns, weeks before the cap bites (capacity plan, 12 Nov)
export const MAX_PLAYERS = 20_000;               // a runaway listing stops the run
const isAddr = (a: unknown) => typeof a === "string" && /^1[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(a);
const num = (x: any) => Number(x ?? 0);
const big = (x: any) => BigInt(x ?? 0);
const pad = (w: number) => String(w).padStart(3, "0");
const canon = (o: any) => JSON.stringify(o) + "\n";   // the recorders' own JSON form (the publish job checks it)

export type Node = { read(method: string, args?: any): Promise<any> };
export type Snapshot = {
  week: number; start: number; end: number; min: string; shared: boolean; time: number;
  questions: Array<[number, number, number]>;                          // [id, outcome, lock time]
  players: Array<[string, string, string, number, Array<[number, number]>]>;   // [address, stake, peak, voided 0/1, answers]
};
export type WeekFile = {
  v: 1; game: 1; week: number; start: number; end: number; min: string; final: boolean;
  seen: { hash: string; at: number };
  questions: Snapshot["questions"]; players: Snapshot["players"];
};

/** The snapshot's fingerprint: what decides the week's results (questions, players, minimum, week). */
export function snapshotHash(s: { week: number; min: string; questions: any; players: any }): string {
  return crypto.createHash("sha256").update(JSON.stringify([s.week, s.min, s.questions, s.players])).digest("hex");
}

/** The vault's rules, from get_state's config (as bot/vault.ts clock). */
export function clockOf(state: any) {
  const c = state?.config ?? {};
  const genesis = num(c.genesis_time), weekLen = num(c.week_length);
  if (!(genesis > 0 && weekLen > 0)) throw new Error("get_state has no genesis_time / week_length");
  const time = num(state.time);
  const minStakeFor = (w: number) => (big(c.min_stake_next) > 0n && w >= num(c.min_stake_next_week) ? big(c.min_stake_next) : big(c.min_stake));
  const q60 = num(c.q60_rule_week_plus_one);
  return {
    genesis, weekLen, time, week: Math.floor((time - genesis) / weekLen),
    weekStart: (w: number) => genesis + w * weekLen,
    weekEnd: (w: number) => genesis + (w + 1) * weekLen,
    resultsDue: (w: number) => genesis + (w + 1) * weekLen + Math.floor(weekLen / 7) * 3,   // the contract's resultsDue
    minStakeFor,
    shared: (w: number) => q60 > 0 && w + 1 >= q60,
  };
}

/** Every player row for the week, 50 at a time; a listing that repeats an address or runs away stops (as bot/chain.ts). */
async function listPlayers(node: Node, week: number): Promise<any[]> {
  const rows: any[] = [], seen = new Set<string>();
  let start = "";
  for (;;) {
    const page = (await node.read("list_players", { limit: 50, week: String(week), ...(start ? { start } : {}) })).rows ?? [];
    for (const r of page) {
      if (!isAddr(r?.address)) throw new Error(`list_players gave a row without an address`);
      if (seen.has(r.address)) throw new Error(`list_players repeated ${r.address}: stopping`);
      seen.add(r.address); rows.push(r);
    }
    if (rows.filter((r) => r.entry?.answers?.length).length > MAX_PLAYERS) throw new Error(`more than ${MAX_PLAYERS} players answered that week: stopping`);
    if (rows.length > 10 * MAX_PLAYERS) throw new Error(`list_players returned more than ${10 * MAX_PLAYERS} rows: stopping`);
    if (page.length < 50) return rows;
    start = page[page.length - 1].address;
  }
}

/** One node's snapshot of week `week` (null = that node has no v6.1 rule set / the week isn't shared, unless `any`). */
export async function readSnapshot(node: Node, week: number, any = false): Promise<Snapshot> {
  const st = await node.read("get_state", {});
  const k = clockOf(st);
  const next = num(st?.totals?.next_question_id);
  if (!(next > 0)) throw new Error("get_state has no next_question_id");
  const questions: Snapshot["questions"] = [];
  // Walk down from the newest question; stop at the first one from an earlier week (ids rise with the weeks).
  for (let id = next - 1, steps = 0; id >= 1; id--, steps++) {
    if (steps > 400) throw new Error("more than 400 questions read back to that week: stopping");
    const q = (await node.read("get_question", { id })).question;
    if (!q) throw new Error(`get_question ${id} is empty`);
    const qw = num(q.week);
    if (qw < week) break;
    if (qw === week) questions.push([id, num(q.outcome), num(q.lock_time)]);
  }
  questions.sort((a, b) => a[0] - b[0]);
  const players: Snapshot["players"] = [];
  for (const r of await listPlayers(node, week)) {
    const e = r.entry;
    if (!e || !Array.isArray(e.answers) || !e.answers.length) continue;
    const answers: Array<[number, number]> = e.answers.map((x: any) => [num(x.question_id), num(x.option)]);
    players.push([r.address, String(big(e.stake)), String(big(e.peak_stake)), e.voided ? 1 : 0, answers]);
  }
  players.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return { week, start: k.weekStart(week), end: k.weekEnd(week), min: String(k.minStakeFor(week)), shared: any || k.shared(week), time: k.time, questions, players };
}

/** Both nodes' snapshots must agree on everything that decides the results. */
export function agree(a: Snapshot, b: Snapshot): string {
  if (a.shared !== b.shared) return "the two nodes disagree on the v6.1 rule week";
  if (a.min !== b.min || a.start !== b.start || a.end !== b.end) return "the two nodes disagree on the week's minimum or dates";
  if (JSON.stringify(a.questions) !== JSON.stringify(b.questions)) return "the two nodes disagree on the week's questions or their results";
  if (JSON.stringify(a.players) !== JSON.stringify(b.players)) return "the two nodes disagree on the players' answers or stakes";
  return "";
}

/** The files for a week from its snapshot (and the last run's file for it, if any). */
export function buildWeek(s: Snapshot, prev: WeekFile | null, now: number) {
  const r = scoreWeek({ week: { start: s.start }, questions: s.questions, players: s.players, min: s.min });
  if (r.missing.length) throw new Error(`answers to questions not read for week ${s.week}: ${r.missing.slice(0, 10).join(", ")}`);
  const hash = snapshotHash(s);
  const sameAsPrev = !!prev && prev.seen?.hash === hash;
  const seenAt = sameAsPrev ? prev!.seen.at : now;
  const final = r.complete && now >= s.end && sameAsPrev && now - seenAt >= STABLE_MS;
  const file: WeekFile = { v: 1, game: 1, week: s.week, start: s.start, end: s.end, min: s.min, final, seen: { hash, at: seenAt }, questions: s.questions, players: s.players };
  const board = {
    v: 1, updated: new Date(now).toISOString(),
    lastWeek: {
      week: s.week, start: s.start, final, complete: r.complete,
      rows: r.rows.map((x) => ({ a: x.a, board: x.board, place: x.place, pts: x.pts, points: x.pts, counted: x.counted, answers: x.answers, ranked: x.ranked })),
      prizes: r.prizes,
    },
  };
  const vault = final ? { game: GAME, week: s.week, final: true, rows: r.vault.rows, first: r.vault.first, second: r.vault.second } : null;
  return { file, board, vault, complete: r.complete, result: r };
}

const readJson = (p: string) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null);

/** Weeks from an env list ("4,5"), whole numbers only. */
export function weekList(s: string | undefined): number[] {
  return String(s ?? "").split(",").map((x) => x.trim()).filter(Boolean).map((x) => {
    if (!/^[0-9]{1,5}$/.test(x)) throw new Error(`"${x}" is not a week number`);
    return Number(x);
  });
}

export type RunOpts = {
  nodes: [Node, Node]; prev: string; out: string;
  /** QUESTIONS_FROM_WEEK: from this vault week the owner expects results files; reading such a week as "not shared"
   *  is then an error (an alert), never a quiet rollover (Repo Lens C11-1). */
  fromWeek?: number;
  /** The nodes are read at their heads: if they disagree (a resolve landing between the two reads), read once more
   *  after this long before failing (Repo Lens C11-7). Default one minute. */
  retryMs?: number;
  /** Each node read gives up after this long (3 tries in all), so a node that accepts the connection but never answers
   *  fails the run instead of holding it past the step's time limit (Repo Lens QF-1). Default 30 s. */
  callTimeoutMs?: number;
  hold?: number[]; holdReason?: string; release?: number[];
  log?: (s: string) => void;
};

/** One hourly run. Returns what it did (for the workflow log and the tests). */
export async function run(o: RunOpts): Promise<{ week: number | null; state: string }> {
  const log = o.log ?? ((s: string) => console.log(s));
  if (!fs.existsSync(path.join(o.prev, ".fetched"))) throw new Error(`${o.prev}/.fetched is missing: the last run's files weren't fetched, refusing to write (it could rewrite a published week)`);
  // Every node read has a time limit and retries (Repo Lens QF-1): a node that never answers fails the run, never holds it.
  const limit = o.callTimeoutMs ?? 30_000;
  const timed = (node: Node): Node => ({ read: (m: string, a?: any) => withRetry(m, () => node.read(m, a), 3, limit) });
  const [A, B] = [timed(o.nodes[0]), timed(o.nodes[1])];
  const [sa, sb] = await Promise.all([A.read("get_state", {}), B.read("get_state", {})]);
  const ka = clockOf(sa), kb = clockOf(sb);
  // The chain's clock, never the runner's: the earlier of the two nodes' head times.
  const now = Math.min(ka.time, kb.time);
  const w = Math.floor((now - ka.genesis) / ka.weekLen) - 1;
  fs.mkdirSync(path.join(o.out, "vault"), { recursive: true });
  // The owner's holds and releases: written once, never removed (the publish job only adds them).
  for (const h of o.hold ?? []) {
    const f = path.join(o.out, "vault", `HOLD-W${h}.json`);
    if (!fs.existsSync(path.join(o.prev, "vault", `HOLD-W${h}.json`))) fs.writeFileSync(f, canon({ game: GAME, week: h, reason: String(o.holdReason || "held by the owner").slice(0, 200) }));
  }
  for (const h of o.release ?? []) {
    if (!fs.existsSync(path.join(o.prev, "vault", `HOLD-W${h}.json`)) && !(o.hold ?? []).includes(h)) { log(`  QUESTIONS_RELEASE names week ${h}, which has no HOLD file: nothing to release`); continue; }
    if (!fs.existsSync(path.join(o.prev, "vault", `RELEASE-W${h}.json`))) fs.writeFileSync(path.join(o.out, "vault", `RELEASE-W${h}.json`), canon({ game: GAME, week: h }));
  }
  if (w < 0 || !ka.shared(w) || !kb.shared(w)) {
    if (ka.shared(w) !== kb.shared(w)) throw new Error("the two nodes disagree on the v6.1 rule week");
    if (o.fromWeek != null && w >= o.fromWeek) throw new Error(`week ${w} should be paid from a results file (QUESTIONS_FROM_WEEK = ${o.fromWeek}), but the vault reads no v6.1 rule week for it: is #114's ABI on main? Nothing recorded.`);
    log(`Daily Questions: week ${w} is not paid from a results file (old rules or no v6.1 yet): nothing to record.`);
    return { week: null, state: "not-shared" };
  }
  const prevFile: WeekFile | null = readJson(path.join(o.prev, `W${pad(w)}.json`));
  if (now >= ka.resultsDue(w)) {
    // Past due with no final: the stakers' share rolls over. Say so loudly on the runs of the first 3 h past the deadline
    // (3 h, not 1 h, so a delayed scheduled run can't skip it: Repo Lens QF-5).
    if (!prevFile?.final && now < ka.resultsDue(w) + 3 * STABLE_MS) throw new Error(`week ${w}'s results were due ${new Date(ka.resultsDue(w)).toISOString()} and no final file was written: its stakers' share rolls over.`);
    log(`Daily Questions: week ${w}'s results were due ${new Date(ka.resultsDue(w)).toISOString()}: nothing more to record.`);
    return { week: w, state: "past-due" };
  }
  const prevVault = readJson(path.join(o.prev, "vault", `W${w}.json`));
  let [a, b] = await Promise.all([readSnapshot(A, w), readSnapshot(B, w)]);
  let why = agree(a, b);
  if (why) {
    log(`  week ${w}: ${why}; reading both nodes again in ${Math.round((o.retryMs ?? 60_000) / 1000)} s`);
    await new Promise((r) => setTimeout(r, o.retryMs ?? 60_000));
    [a, b] = await Promise.all([readSnapshot(A, w), readSnapshot(B, w)]);
    why = agree(a, b);
  }
  if (why) throw new Error(`week ${w}: ${why}. Nothing recorded this run; the next run reads again.`);
  if (prevFile?.final) {
    // Written once: a published final never changes. Its snapshot must still be the chain's.
    if (snapshotHash(a) !== prevFile.seen.hash) throw new Error(`week ${w} is final, but the chain now reads differently (hash ${snapshotHash(a).slice(0, 12)} vs ${prevFile.seen.hash.slice(0, 12)}): stopping. Check it; the published files stay as they are.`);
    if (!prevVault) {
      // A final W file whose vault file wasn't published yet (held at publish): write it again from the same snapshot.
      const again = buildWeek(a, prevFile, now);
      if (!again.vault) throw new Error(`week ${w}: the final file can't be rebuilt`);
      write(o.out, prevFile, again.board, again.vault, w, log);
      log(`Daily Questions week ${w}: final (copied forward); its vault file written again.`);
      return { week: w, state: "final" };
    }
    log(`Daily Questions week ${w}: final and published; nothing to change.`);
    return { week: w, state: "final" };
  }
  const built = buildWeek(a, prevFile, now);
  write(o.out, built.file, built.board, built.vault, w, log);
  const n = built.result.rows.length;
  if (!built.file.final && now >= ka.resultsDue(w) - 24 * STABLE_MS) {
    // Under 24 h left and not final: the alert (Repo Lens C11-4). The files are written and must still go out, or a week
    // whose snapshot changes now (the owner resolving a question) could never go final: so no throw, state "late",
    // and the command line exits 3, which the workflow publishes and still emails on (Repo Lens QF-2).
    const sunday = a.start + 6 * 86400000;
    const open = a.questions.filter(([, outcome, lock]) => outcome === 0 && lock <= sunday).map(([id]) => id);
    log(`::error::week ${w} is still pending ${((ka.resultsDue(w) - now) / STABLE_MS).toFixed(1)} h before its results are due (${new Date(ka.resultsDue(w)).toISOString()}): ${open.length ? `unresolved questions ${open.join(", ")} (resolve or void them)` : "waiting for a second matching run"}. Its files were written and go out with this run.`);
    return { week: w, state: "late" };
  }
  log(`Daily Questions week ${w}: ${built.file.final ? "FINAL" : built.complete ? "pending (waiting for a second matching run an hour later)" : "pending (questions still to resolve)"}; ${a.questions.length} questions, ${n} players, ${built.result.vault.rows.length} staked rows, first ${built.result.vault.first.length}, second ${built.result.vault.second.length}.`);
  return { week: w, state: built.file.final ? "final" : "pending" };
}

/** The early warning: null while a file is under 60% of the cap, else a GitHub warning line for the run's log. */
export function sizeWarning(w: number, bytes: number): string | null {
  if (bytes <= WARN_FILE) return null;
  return `::warning::Daily Questions week ${w}: a file is ${bytes} bytes, ${Math.round((100 * bytes) / MAX_FILE)}% of the ${MAX_FILE} byte limit. Past the limit no week is written and nobody is paid, so change the answer format first (games/questions/README.md, TODO: size).`;
}

function write(out: string, file: WeekFile, board: any, vault: any, w: number, log: (s: string) => void) {
  const f = canon(file), b = canon(board);
  if (f.length > MAX_FILE || b.length > MAX_FILE) throw new Error(`week ${w}'s files would be over ${MAX_FILE} bytes: stopping (RECORDER_STANDARD §6.7)`);
  const warn = sizeWarning(w, Math.max(f.length, b.length));
  if (warn) log(warn);
  fs.writeFileSync(path.join(out, `W${pad(w)}.json`), f);
  fs.writeFileSync(path.join(out, "board.json"), b);
  if (vault) fs.writeFileSync(path.join(out, "vault", `W${w}.json`), canon(vault));
}

// ───────────────────────── command line ─────────────────────────
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { KoinosChain } = await import("../../bot/chain.ts");
  const E = process.env;
  const dep = JSON.parse(fs.readFileSync("game-data/deployment.json", "utf8"));
  const rpc = E.RPC || "https://koinos.armana.io", check = E.RPC_CHECK || "https://api.koinosblocks.com";
  if (rpc === check) throw new Error("RPC and RPC_CHECK must be two different nodes");
  const nodes: [Node, Node] = [new KoinosChain(rpc, dep.contract), new KoinosChain(check, dep.contract)];
  const args = process.argv.slice(2);
  const wi = args.indexOf("--week");
  if (wi >= 0) {
    // A read-only look at any week: both nodes, scored, compared with the contract's own settled points (old rules).
    const w = Number(args[wi + 1]);
    const [a, b] = await Promise.all([readSnapshot(nodes[0], w, true), readSnapshot(nodes[1], w, true)]);
    const why = agree(a, b);
    if (why) { console.error(`✖ ${why}`); process.exit(1); }
    const r = scoreWeek({ week: { start: a.start }, questions: a.questions, players: a.players, min: a.min });
    console.log(`week ${w}: ${a.questions.length} questions (complete: ${r.complete}), ${r.rows.length} players; staked rows ${r.vault.rows.length}; first ${r.vault.first.join(", ") || "-"}; second ${r.vault.second.join(", ") || "-"}`);
    const settled = new Map<string, any>();
    for (const row of await listPlayers(nodes[0], w)) if (row.entry?.settled) settled.set(row.address, row.entry);
    let same = 0, diff = 0;
    for (const x of r.rows) {
      const e = settled.get(x.a);
      if (!e) continue;
      if (num(e.points) === x.pts && num(e.counted) === x.counted) same++;
      else { diff++; console.log(`  ✖ ${x.a}: recorder ${x.pts} pts / ${x.counted} counted, contract ${num(e.points)} / ${num(e.counted)}`); }
    }
    console.log(`settled entries compared: ${same} same, ${diff} different`);
    process.exit(diff ? 1 : 0);
  }
  // Exit codes: 0 done, 3 "late" (files written, alert: the workflow publishes them and emails), 1 any error (nothing
  // goes out but the owner's HOLD / RELEASE files). Always process.exit, as bot/games/blockx.ts does, so a request left
  // open after withRetry gave up on it can't keep the process alive (Repo Lens QF-1, QF-2).
  run({
    nodes, prev: E.QUESTIONS_PREV || "questions-prev", out: E.QUESTIONS_OUT || "questions-out",
    hold: weekList(E.QUESTIONS_HOLD), holdReason: E.QUESTIONS_HOLD_REASON, release: weekList(E.QUESTIONS_RELEASE),
    fromWeek: weekList(E.QUESTIONS_FROM_WEEK)[0],
  }).then(
    (res) => { console.log(`done: ${res.state}`); process.exit(res.state === "late" ? 3 : 0); },
    (e) => { console.error(`error: ${String((e && (e as Error).message) || e).replace(/[\r\n]+/g, " ").replace(/::/g, ": ").slice(0, 500)}`); process.exit(1); },
  );
}
