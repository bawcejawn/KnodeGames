/**
 * The KnodeGames Vault (game v6) side of the operator bot: other games' weekly results, finalizing their weeks, alerts
 * for game announcements and owner corrections, and the status lines. Everything here also runs against the v5
 * contract: `vaultView` returns null there and every pass skips.
 *
 * Results files. Each game's recorder publishes one file per vault week, when its week is final:
 *
 *   { "game": 2, "week": 57, "final": true,
 *     "rows":   [ { "player": "1Abc…", "points": 12 }, … ],     staked games: every staked player with 1-255 points
 *     "first":  [ "1Abc…" ],  "second": [ "1Def…" ] }            free-prize games: the winners of 1st and 2nd (ties: several)
 *
 * `week` is the vault's week number (week 0 began at the contract's genesis, Mon 19 Oct 2026 00:00 UTC). Points keep
 * the game's own order and ties: only the order matters to the vault. Where the files live is set per game in
 * game-data/deployment.json, e.g.
 *
 *   "vaultGames": { "2": { "name": "Who Signs Block X", "results": "games-data:blockx/vault" } }
 *
 * "<branch>:<folder>" reads <folder>/W<week>.json from that branch (fetched first); a plain folder path reads files on
 * disk. The bot checks every row against the chain before sending it (the vault checks again), posts what is new,
 * then seals the week. The owner then has 24 hours to correct anything (npm run bot -- game-correct …).
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import type { Signer } from "koilib";
import { showKoin, type Chain, type Call } from "./chain.ts";
import { readSwitches, prizeOn, type Switches } from "./free-prizes.ts";

export const Q_GAME = 1;
export const MAX_ROWS = 50;                   // results per post_results call (the contract's limit)
export const MAX_PRIZE_WINNERS = 10;          // wallets per prize place (the contract's limit)
/** Wallets per post_results / post_prize_winners transaction (owner, 4 Nov: every transaction must fit its Mana limit).
 *  At mainnet prices (4 Nov 2026, docs/testnet-v61-units.json) a results call costs about 0.35 Mana plus about 0.19 per
 *  wallet (its compute and the bytes it stores). Six wallets ≈ 1.5 Mana: under the bot's 2-Mana limit per transaction
 *  (bot/chain.ts) with room for prices to rise by a third. 50 at once (the contract's limit) would need ~10 Mana. */
export const ROWS_PER_TX = 6;
export const MAX_POINTS = 255;
const HOUR_MS = 3_600_000;

const num = (x: any) => Number(x ?? 0);
const big = (x: any) => BigInt(x ?? 0);
const utc = (ms: number) => new Date(ms).toISOString().replace("T", " ").slice(0, 16) + " UTC";

export type VaultCtx = {
  chain: Chain;
  operator: Signer;
  dryRun: boolean;
  problems: string[];
  quiet?: boolean;
  /** game-data/deployment.json (for `vaultGames`). */
  deployment?: any;
  /** Reads a results file; tests pass their own. Default: `<branch>:<folder>` from git, or a folder on disk. */
  readResults?: (source: string, week: number) => any | null;
  /** The owner's free-prize switches (bot/free-prizes.ts); null = none published. Throws when they can't be read.
   *  Tests pass their own. Default: the prize-settings branch from git. */
  readPrizeSwitches?: () => Switches | null;
  /** Reads any published file by spec ("<branch>:<path>" or a path on disk): HOLD files and boards (and results files
   *  when `readResults` isn't given). Missing and unreadable are different answers. Tests pass their own. */
  readFile?: (spec: string) => FileRead;
  /** What the bot remembers between hourly runs (kept in game-data/bot-state.json, sealed by the operator key):
   *  when each results file was first read, refusals and alerts already sent. Without it (game-post by hand, tests
   *  that don't pass one), a file is posted on the first read and every alert is raised each time. */
  memo?: VaultMemo;
};
/** A send's outcome: true, false, or { ok: false, error } with the chain's reason (the bot passes it on). */
export type SendResult = boolean | { ok: boolean; error?: string };
export type Send = (what: string, calls: Call[]) => Promise<SendResult>;
export type FileRead = { state: "missing" } | { state: "ok"; data: any } | { state: "error"; error: string };
export type VaultMemo = {
  /** "<game>:<week>" → the results file's hash when first read, and when (chain time, ms). `changed`: it changed after. */
  seen?: Record<string, { hash: string; at: number; changed?: boolean }>;
  /** "<game>:<week>" → a send the vault refused for that file (hash): not retried until the file changes. */
  refused?: Record<string, { hash: string; what: string; error: string; at: number }>;
  /** Alert keys already raised (each emails once; a deadline reminder is its own key). */
  alerted?: string[];
};
const sent = (x: SendResult) => (typeof x === "boolean" ? { ok: x, error: x ? "" : "see the transaction error above" } : { ok: !!x.ok, error: x.error ?? "" });
const log = (ctx: VaultCtx, ...a: any[]) => { if (!ctx.quiet) console.log(...a); };

export type VaultView = { games: any[]; proposals: any[] };

/** The game list, or null when the contract is not v6 yet. */
export async function vaultView(chain: Chain): Promise<VaultView | null> {
  try {
    const r = await chain.read("list_games", {});
    return { games: r.games ?? [], proposals: r.proposals ?? [] };
  } catch {
    return null;
  }
}

/** The chain's clock and the settings every pass needs. */
async function clock(chain: Chain) {
  const s = await chain.read("get_state", {});
  const c = s.config ?? {}, t = s.totals ?? {};
  const time = num(s.time), genesis = num(c.genesis_time), weekLen = num(c.week_length);
  const week = time < genesis ? 0 : Math.floor((time - genesis) / weekLen);
  const minStakeFor = (w: number) => (big(c.min_stake_next) > 0n && w >= num(c.min_stake_next_week) ? big(c.min_stake_next) : big(c.min_stake));
  return {
    raw: s, c, t, time, genesis, weekLen, week, closeDelay: num(c.close_delay), weeksClosed: num(t.weeks_closed), minStakeFor,
    weekEnd: (w: number) => genesis + (w + 1) * weekLen,
    resultsDue: (w: number) => genesis + (w + 1) * weekLen + Math.floor(weekLen / 7) * 3,
  };
}

/** Whether week w is the last week of one of the game's prize seasons (the contract's seasonEnds). */
export function seasonEnds(g: any, w: number): boolean {
  const n = Math.max(1, num(g.season_weeks));
  const from = num(g.from_week);
  return w >= from && (w - from) % n === n - 1;
}

/** Whether a game earns (has a week to report) for week w. */
/** Whether a game has results for week w, as the contract decides (requireResults): it earns that week now, or the
 *  vault closed that week with it earning (a game restarted after a gap keeps those weeks). */
/** v6.1 (D-116): whether week `w` of the question game is paid like every game (from its results file), read from the
 *  vault's settings (`config.q60_rule_week_plus_one`; 0 = not set: none yet). Earlier weeks are paid the old way. */
export function sharedRulesWeek(config: any, w: number): boolean {
  const r = num(config?.q60_rule_week_plus_one);
  return r > 0 && w + 1 >= r;
}

/** Whether the vault bot handles this game's week `w`: every game, and the question game only from the shared-rules week. */
export function vaultHandles(id: number, config: any, w: number): boolean {
  return id !== Q_GAME || sharedRulesWeek(config, w);
}

export function earnedWeek(g: any, w: number, gw: any): boolean {
  return !!gw?.closed || gameEarns(g, w);
}

export function gameEarns(g: any, w: number): boolean {
  const last = num(g.last_week_plus_one);
  return num(g.from_week) <= w && (last === 0 || w + 1 <= last);
}

/** Fetches a data branch once per run into refs/remotes/origin/<branch> (an explicit refspec: the bot's checkout only
 *  tracks main). Throws when it can't. */
const fetched = new Set<string>();
function fetchBranch(branch: string) {
  if (fetched.has(branch)) return;
  execFileSync("git", ["fetch", "--quiet", "--depth=1", "origin", `+refs/heads/${branch}:refs/remotes/origin/${branch}`], { stdio: "ignore" });
  fetched.add(branch);
}

/** "<source>/<name>" for a results source ("<branch>:<folder>" or a folder on disk). */
export function joinSpec(source: string, name: string): string {
  return `${source.replace(/\/+$/, "")}/${name}`;
}

/** Where a game's board is: vaultGames.<id>.board if set, else board.json in the folder above its vault folder
 *  ("games-data:blockx/vault" → "games-data:blockx/board.json"; "race-data:vault" → "race-data:board.json"). */
export function boardSpec(source: string, configured?: string): string {
  if (configured) return configured;
  const m = source.match(/^([A-Za-z0-9._\/-]+):(.+)$/);
  const folder = (m ? m[2] : source).replace(/\/+$/, "");
  const up = folder.includes("/") ? folder.slice(0, folder.lastIndexOf("/")) : "";
  const file = up ? `${up}/board.json` : "board.json";
  return m ? `${m[1]}:${file}` : (up ? path.join(up, "board.json") : path.join(path.dirname(folder), "board.json"));
}

/** Default file reader. "<branch>:<path>" from git, or a path on disk. Missing and unreadable are kept apart: a branch
 *  that can't be fetched, a git error or bad JSON is "error", never "missing". */
export function readSpec(spec: string): FileRead {
  const m = spec.match(/^([A-Za-z0-9._\/-]+):(.+)$/);
  if (!m) {
    if (!fs.existsSync(spec)) return { state: "missing" };
    try { return { state: "ok", data: JSON.parse(fs.readFileSync(spec, "utf8")) }; } catch (e: any) { return { state: "error", error: String(e?.message ?? e) }; }
  }
  const [, branch, file] = m;
  if (!/^[A-Za-z0-9._-]+$/.test(branch) || file.includes("..") || file.startsWith("/")) return { state: "error", error: `"${spec}" is not <branch>:<path>` };
  try { fetchBranch(branch); } catch (e: any) { return { state: "error", error: `can't fetch branch ${branch}` }; }
  const ls = spawnSync("git", ["ls-tree", "--name-only", `refs/remotes/origin/${branch}`, "--", file], { encoding: "utf8" });
  if (ls.status !== 0) return { state: "error", error: `git ls-tree failed on ${branch}` };
  if (!ls.stdout.trim()) return { state: "missing" };
  const show = spawnSync("git", ["show", `refs/remotes/origin/${branch}:${file}`], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  if (show.status !== 0) return { state: "error", error: `git show failed on ${spec}` };
  try { return { state: "ok", data: JSON.parse(show.stdout) }; } catch (e: any) { return { state: "error", error: `${spec} is not valid JSON` }; }
}

/** The results file for a week, or null (missing or unreadable). Kept for callers that only need the file. */
export function readResultsFile(source: string, week: number): any | null {
  const r = readSpec(joinSpec(source, `W${week}.json`));
  return r.state === "ok" ? r.data : null;
}

/** A results file's fingerprint: rows sorted by wallet and winners sorted, so only the content counts, not its order
 *  (Repo Lens VB-11). */
export function fileHash(r: any): string {
  const byPlayer = (u: any, v: any) => (String(u?.player) < String(v?.player) ? -1 : String(u?.player) > String(v?.player) ? 1 : 0);
  const sorted = (x: any) => (Array.isArray(x) ? [...x].sort() : x);
  return hashOf({ ...r, rows: Array.isArray(r?.rows) ? [...r.rows].sort(byPlayer) : r?.rows, first: sorted(r?.first), second: sorted(r?.second) });
}

/** A stable fingerprint of a parsed file (the same content always gives the same hash). */
export function hashOf(x: any): string {
  const canon = (v: any): any => (Array.isArray(v) ? v.map(canon) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);
  return createHash("sha256").update(JSON.stringify(canon(x))).digest("hex");
}

const ADDRESS = /^1[1-9A-HJ-NP-Za-km-z]{25,34}$/;

/** Checks a results file's shape. Returns the reason it can't be used, or "". */
export function checkResults(r: any, game: number, week: number): string {
  if (!r || typeof r !== "object") return "not a JSON object";
  if (num(r.game) !== game || num(r.week) !== week) return `it is for game ${r.game} week ${r.week}, not game ${game} week ${week}`;
  if (r.final !== true) return "not final yet";
  const rows = r.rows ?? [], first = r.first ?? [], second = r.second ?? [];
  if (!Array.isArray(rows) || !Array.isArray(first) || !Array.isArray(second)) return "rows, first and second must be lists";
  const seen = new Set<string>();
  for (const x of rows) {
    if (!x || !ADDRESS.test(String(x.player))) return `a row has no valid address (${JSON.stringify(x)})`;
    if (!Number.isInteger(x.points) || x.points < 1 || x.points > MAX_POINTS) return `${x.player} has ${x.points} points (must be a whole number 1-255)`;
    if (seen.has(x.player)) return `${x.player} appears twice`;
    seen.add(x.player);
  }
  for (const a of [...first, ...second]) {
    if (!ADDRESS.test(String(a))) return `a prize winner is not a valid address (${a})`;
    if (seen.has(a)) return `${a} appears twice`;
    seen.add(a);
  }
  if (first.length > MAX_PRIZE_WINNERS || second.length > MAX_PRIZE_WINNERS) return `more than ${MAX_PRIZE_WINNERS} winners for one place`;
  return "";
}

/** How long a results file must stay the same, across two hourly runs, before it is posted (I-034, I-051). */
export const STABLE_MS = 30 * 60_000;
/** Wallets named in one alert, at most. */
const LIST_MAX = 10;

/**
 * Posts other games' finished weeks: points for staked players, prize winners, then the seal. Only the week that just
 * ended can be posted (results are due 3 days after it). Rows the chain would refuse are left out and reported.
 * `only`: one game and week (the game-post command); otherwise every game.
 *
 * Before anything is sent for a game's week, in this order (each fails closed: that game's week posts nothing, the
 * others go on, and the owner gets an alert):
 *  1. HOLD (I-064): a HOLD-W<week>.json next to the results file holds the whole week (Last Node watch-and-hold, D-055)
 *     unless RELEASE-W<week>.json is published next to it (Repo Lens VB-1). A HOLD or RELEASE file that can't be read
 *     holds too.
 *  2. The results file must be final, well formed (checkResults) and, with a memo (the hourly bot), unchanged across
 *     two runs at least STABLE_MS apart (I-034, I-051). A file that changes after it was first read is held for good:
 *     a final file never changes, so the owner checks it and posts by hand (game-post) if it is right.
 *  3. Staked list (I-064), for games with a stake bucket: the game's board (board.json, `lastWeek` for that week) is
 *     the reference. Every wallet on its Staked board (`ranked: true`; every row if the board has no `ranked`) with
 *     points (`pts`, or `points`) that the chain counts as staked in the game that week (week_stake at or above the
 *     week's minimum) must be in the file's rows; every row of the file must be on the board; and the file's points must
 *     keep the board's places (`place`, else `boardPlace`). A board that is missing, unreadable or for another week
 *     holds the week.
 *  4. A send the vault refuses (I-052) stops that game's week at once (no seal) and is not retried while the file is
 *     the same (with a memo); the owner is told the game, week, call and the chain's reason.
 * Then, as before: every row and winner is re-checked against the chain (stake, free/staked, earlier results).
 */
export async function vaultResultsPass(ctx: VaultCtx, send: Send, only?: { game: number; week: number; source?: string }) {
  const view = await vaultView(ctx.chain);
  if (!view) { if (only) throw new Error("The contract is not v6 yet: it has no other games."); return; }
  const k = await clock(ctx.chain);
  const cfg = ctx.deployment?.vaultGames ?? {};
  // Tests and the rehearsal that pass only `readResults` have no HOLD files or boards: those two checks are skipped for
  // them (and only them). The hourly bot and game-post pass neither, so they read everything from git (readSpec).
  const legacy = !!ctx.readResults && !ctx.readFile;
  const readFile = ctx.readFile ?? (legacy ? (): FileRead => ({ state: "missing" }) : readSpec);
  const memo = only ? undefined : ctx.memo;
  if (memo) pruneMemo(memo, k.week);
  // An alert once per key with a memo (the hourly bot); every time without one.
  const alert = (key: string, text: string) => {
    if (memo) { memo.alerted ??= []; if (memo.alerted.includes(key)) { log(ctx, `  (already reported) ${text}`); return; } memo.alerted.push(key); }
    ctx.problems.push(text);
  };
  // The owner's free-prize switches (D-082), read once per run. Unreadable → free winners wait (fail closed).
  let switches: { s: Switches | null } | { error: string } | undefined;
  const sw = () => (switches ??= (() => { try { return { s: (ctx.readPrizeSwitches ?? (() => readSwitches().s))() }; } catch (e: any) { return { error: String(e?.message ?? e) }; } })());
  for (const g of view.games) {
    const id = num(g.id);
    if (only && only.game !== id) continue;
    const w = only ? only.week : k.week - 1;
    if (!vaultHandles(id, k.c, w)) { if (only) throw new Error(`Week ${w} of the question game is paid by the old rules (settle and claim), not from a results file.`); continue; }
    const name = g.name ?? `game ${id}`;
    if (w < 0) { if (only) throw new Error(`${name} has no results for week ${w}.`); continue; }
    const gw = (await ctx.chain.read("get_game", { game: id, week: String(w) })).week ?? {};
    // Fix-check VN-3: the contract's rule. A game restarted after a gap keeps the weeks it earned (closed with it).
    if (!earnedWeek(g, w, gw)) { if (only) throw new Error(`${name} has no results for week ${w}.`); continue; }
    const source = only?.source ?? cfg[String(id)]?.results;
    if (!source) { log(ctx, `  ${name}: no results source in deployment.json (vaultGames.${id}.results)`); continue; }
    if (k.time < k.weekEnd(w)) { if (only) throw new Error(`Week ${w} of ${name} is not over yet.`); continue; }
    const due = k.resultsDue(w);
    if (gw.sealed || gw.finalized || gw.voided) { if (only) log(ctx, `  ${name} week ${w} is already ${gw.finalized ? "final" : gw.voided ? "voided" : "sealed"}.`); continue; }
    if (k.time >= due) { if (only) throw new Error(`Week ${w} of ${name} is past its results deadline (${utc(due)}).`); continue; }
    const key = `${id}:${w}`;
    const hoursLeft = (due - k.time) / HOUR_MS;
    const rollover = `Without results by ${utc(due)} the week rolls over: its bucket stays in the game and its free prize goes back to the pool.`;
    // Held: nothing is sent for this week this run. Reported once, and again under 12 hours before the deadline.
    const hold = (kind: string, why: string) => {
      if (only) throw new Error(`${name} week ${w} is held: ${why}`);
      log(ctx, `  ${name} week ${w}: HELD (${why})`);
      alert(`${key}:${kind}`, `${name} week ${w}: held, nothing posted: ${why}. ${rollover}`);
      if (hoursLeft < 12) alert(`${key}:${kind}:deadline`, `${name} week ${w} is still held (${why}) and its results are due ${utc(due)} (${hoursLeft.toFixed(1)} h).`);
    };

    // 1. HOLD file (I-064). Missing: go on. Present (valid or not): hold. Unreadable: hold (fail closed).
    // Repo Lens VB-1: a published HOLD stays on the data branch, so a released week is marked by RELEASE-W<week>.json
    // next to it (Last Node publishes it when LASTNODE_RELEASE_WEEKS names the week). Unreadable RELEASE → still held.
    const h = readFile(joinSpec(source, `HOLD-W${w}.json`));
    if (h.state === "ok") {
      const rel = readFile(joinSpec(source, `RELEASE-W${w}.json`));
      const reason = h.data?.reason ?? h.data?.why;
      if (rel.state === "error") { hold("release-unreadable", `the game published HOLD-W${w}.json, and RELEASE-W${w}.json can't be read (${rel.error})`); continue; }
      if (rel.state === "missing") { hold("hold-file", `the game published HOLD-W${w}.json${reason ? ` (${String(reason).slice(0, 120)})` : ""}: it pays nothing until its recorder releases the week (RELEASE-W${w}.json)`); continue; }
      log(ctx, `  ${name} week ${w}: HOLD-W${w}.json was released (RELEASE-W${w}.json): checking the results as usual`);
    }
    if (h.state === "error") { hold("hold-unreadable", `HOLD-W${w}.json can't be read (${h.error}), so the bot can't tell whether the game is holding this week`); continue; }

    // 2. The results file: final, well formed, and stable across runs.
    let r: any = null, why = "";
    if (ctx.readResults) { r = ctx.readResults(source, w); why = r ? checkResults(r, id, w) : "no file yet"; }
    else {
      const f = readFile(joinSpec(source, `W${w}.json`));
      if (f.state === "ok") { r = f.data; why = checkResults(r, id, w); } else why = f.state === "missing" ? "no file yet" : `unreadable (${f.error})`;
    }
    if (why) {
      if (only) throw new Error(`Results for ${name} week ${w} can't be used: ${why}.`);
      log(ctx, `  ${name} week ${w}: results not ready (${why}); due ${utc(due)}`);
      if (hoursLeft < 12) ctx.problems.push(`${name}: week ${w}'s results are not ready (${why}) and are due ${utc(due)} (${hoursLeft.toFixed(1)} h). Without them the week rolls over: its bucket stays in the game and its prize goes back to the pool.`);
      continue;
    }
    const hash = fileHash(r);
    if (memo) {
      memo.seen ??= {};
      const seen = memo.seen[key];
      if (!seen) {
        memo.seen[key] = { hash, at: k.time };
        log(ctx, `  ${name} week ${w}: results file read for the first time; posted once it is unchanged on a later run`);
        // Repo Lens VB-10: the next hourly run may come too late.
        if (due - k.time < 2 * HOUR_MS) alert(`${key}:late`, `${name} week ${w}: its results file appeared only ${hoursLeft.toFixed(1)} h before the deadline (${utc(due)}), so the bot's second read may come too late. If the file looks right, post it by hand: npm run bot -- game-post ${id} ${w} (dry run first).`);
        continue;
      }
      if (seen.changed || seen.hash !== hash) {
        seen.changed = true;
        hold("changed", `its results file changed after the bot first read it (${utc(seen.at)}). A final file must never change: check the game's recorder; if the new file is right, post it by hand (npm run bot -- game-post ${id} ${w}, dry run first)`);
        continue;
      }
      if (k.time - seen.at < STABLE_MS) { log(ctx, `  ${name} week ${w}: waiting for the results file to stay unchanged until ${utc(seen.at + STABLE_MS)}`); continue; }
      const ref = memo.refused?.[key];
      if (ref && ref.hash === hash) { hold("refused", `the vault refused "${ref.what}" (${ref.error}) at ${utc(ref.at)} and the file hasn't changed since; the bot won't send it again`); continue; }
    }

    const min = k.minStakeFor(w);
    const stakedGame = g.staked || big(gw.bucket) > 0n;
    // 3. Staked list (I-064): every staked wallet with points on the board must be in the file, in the board's order.
    // Repo Lens VB-4: a game that publishes no board (Survivor) is set to board "none" in deployment.json by the owner.
    if (stakedGame && !legacy && cfg[String(id)]?.board === "none") log(ctx, `  ${name} week ${w}: no board check (vaultGames.${id}.board is "none")`);
    else if (stakedGame && !legacy) {
      const bspec = boardSpec(source, cfg[String(id)]?.board);
      const b = readFile(bspec);
      if (b.state !== "ok") { hold("board", `its board ${bspec} is ${b.state === "missing" ? "missing" : `unreadable (${b.error})`}, so the staked list can't be checked`); continue; }
      const lw = b.data?.lastWeek;
      if (!lw || num(lw.week) !== w || !Array.isArray(lw.rows)) { hold("board", `its board ${bspec} has no lastWeek for week ${w} (it shows week ${lw?.week ?? "none"}), so the staked list can't be checked`); continue; }
      const filePts = new Map<string, number>((r.rows ?? []).map((x: any) => [x.player, x.points]));
      const minPts = Number(cfg[String(id)]?.minPts) > 0 ? Number(cfg[String(id)].minPts) : 0;
      const onBoard = new Set<string>(), places = new Map<string, number>(), scored: string[] = [];
      // Repo Lens VB-8: every board marks its Staked rows (`ranked`); only those are read on chain for the
      // missing-wallet check, so a big Free play board doesn't cost thousands of reads while a week is held.
      const marks = lw.rows.some((x: any) => typeof x?.ranked === "boolean");
      for (const row of lw.rows) {
        if (!row || !ADDRESS.test(String(row.a))) continue;
        onBoard.add(row.a);
        const place = Number(row.place) > 0 ? Number(row.place) : Number(row.boardPlace) > 0 ? Number(row.boardPlace) : 0;
        if (place) places.set(row.a, place);
        // Points on the board (or a board without a points column). Repo Lens VB-5: a game whose file leaves out low
        // scores sets its floor, in the board's own units (Combo: minPts 100 = 1 full point in hundredths).
        const sc = boardScore(row);
        if ((!marks || row.ranked === true) && (sc === null || (sc > 0 && sc >= minPts))) scored.push(row.a);
      }
      const missing: string[] = [];
      for (const a of scored) {
        if (filePts.has(a)) continue;
        const p = await ctx.chain.read("get_game_player", { player: a, game: id, week: String(w) });
        if (big(p.week_stake) >= stakedFloor(min)) missing.push(a);
      }
      if (missing.length) { hold("staked-list", `${missing.length} wallet(s) staked in the game that week, with points on its board, are not in the results file: ${missing.slice(0, LIST_MAX).join(", ")}${missing.length > LIST_MAX ? " …" : ""}`); continue; }
      const notOnBoard = (r.rows ?? []).filter((x: any) => !onBoard.has(x.player)).map((x: any) => x.player);
      // Repo Lens VB-6: boards are capped (Last Node 2,000 rows, Bracket 1,000 per board: vaultGames.<id>.boardCap);
      // a full board can't list every file row, so the check is skipped there (logged).
      const cap = Number(cfg[String(id)]?.boardCap) > 0 ? Number(cfg[String(id)].boardCap) : Infinity;
      const stakedRows = marks ? lw.rows.filter((x: any) => x?.ranked === true).length : lw.rows.length;
      // Repo Lens N-2: a game with separate Staked and Free boards (Bracket) caps each one, so the whole board can be
      // long while the Staked board is not full. vaultGames.<id>.capScope "staked" compares the cap with the Staked
      // rows only, so a staked file row missing from a Staked board that isn't full still holds.
      const full = cfg[String(id)]?.capScope === "staked" ? stakedRows >= cap : lw.rows.length >= cap || stakedRows >= cap;
      if (notOnBoard.length && full) log(ctx, `  ${name} week ${w}: ${notOnBoard.length} file row(s) not on the board, which is at its cap of ${cap} rows: not checked`);
      else if (notOnBoard.length) { hold("not-on-board", `${notOnBoard.length} wallet(s) in the results file are not on the game's board for week ${w}: ${notOnBoard.slice(0, LIST_MAX).join(", ")}${notOnBoard.length > LIST_MAX ? " …" : ""}`); continue; }
      const order = orderBreak(r.rows ?? [], places);
      if (order) { hold("order", `the results file's points don't follow the board's places: ${order}`); continue; }
    }

    // Points for staked players: only rows the chain would take, and only once.
    const rows: Array<{ player: string; points: number }> = [];
    let skipped = 0;
    if (stakedGame) {
      for (const x of r.rows ?? []) {
        const p = await ctx.chain.read("get_game_player", { player: x.player, game: id, week: String(w) });
        const posted = num(p.entry?.points);
        if (posted === x.points) continue;
        if (posted > 0) { ctx.problems.push(`${name} week ${w}: ${x.player} already has ${posted} points on chain; the results file says ${x.points}. If the file is right, correct it: npm run bot -- game-correct ${id} ${w} ${x.player} ${x.points} --send`); continue; }
        if (num(p.entry?.prize_place) > 0) { skipped++; continue; }
        if (big(p.week_stake) < min || big(p.week_stake) === 0n) { skipped++; continue; }
        rows.push({ player: x.player, points: x.points });
      }
    } else if ((r.rows ?? []).length) log(ctx, `  ${name} has no stake bucket: its ${r.rows.length} row(s) of points are not sent`);
    // Prize winners, on the last week of the game's season only, each a free player there.
    const places: Array<{ place: number; players: string[] }> = [];
    const prizeWeek = g.free_prize && (gw.closed ? big(gw.prize) > 0n : seasonEnds(g, w));
    let holdSeal = false;
    if (prizeWeek && ((r.first ?? []).length || (r.second ?? []).length)) {
      const x = sw();
      if ("error" in x) {
        // Fail closed for the prize only (Repo Lens FP-2): the staked players' points still go out; the winners and the
        // seal wait so the winners can be posted once the switches read. Under 6 hours before the deadline, seal
        // without winners: the prize returns to the pool and the stakers' week is kept.
        const late = due - k.time < 6 * HOUR_MS;
        ctx.problems.push(`${name} week ${w}: the free-prize switches (prize-settings) can't be read (${x.error}). Staked points posted; ${late ? "under 6 h to the deadline, so sealed WITHOUT free winners (the prize goes back to the pool)" : `free winners and the seal held until it reads (due ${utc(due)})`}.`);
        r.first = []; r.second = [];
        holdSeal = !late;
      } else if (!prizeOn(x.s, id, w, num(g.season_weeks), k.genesis, k.weekLen)) {
        log(ctx, `  ${name} week ${w}: free prize switched off by the owner: no winners posted (the vault returns the prize to the pool)`);
        r.first = []; r.second = [];
      }
    }
    if (prizeWeek) {
      for (const [place, list] of [[1, r.first ?? []], [2, r.second ?? []]] as Array<[number, string[]]>) {
        const fresh: string[] = [];
        for (const a of list) {
          const p = await ctx.chain.read("get_game_player", { player: a, game: id, week: String(w) });
          if (num(p.entry?.prize_place) === place) continue;
          if (num(p.entry?.prize_place) > 0 || num(p.entry?.points) > 0) { ctx.problems.push(`${name} week ${w}: ${a} already has another result on chain; not posted as a prize winner.`); continue; }
          const peak = p.entry ? big(p.entry.peak_stake) : big(p.active_stake);
          if (peak >= min) { ctx.problems.push(`${name} week ${w}: ${a} is in the results file as a prize winner but was staked in the game that week, so it can't win the free prize. Check the game's recorder.`); continue; }
          fresh.push(a);
        }
        const already = place === 1 ? num(gw.first_n) : num(gw.second_n);
        if (fresh.length + already > MAX_PRIZE_WINNERS) { ctx.problems.push(`${name} week ${w}: more than ${MAX_PRIZE_WINNERS} winners tied for place ${place}; none posted for that place.`); continue; }
        if (fresh.length) places.push({ place, players: fresh });
      }
    } else if ((r.first ?? []).length || (r.second ?? []).length) {
      if (g.free_prize) log(ctx, `  ${name} week ${w} is not the last week of its prize season: prize winners are posted with the season's last week`);
    }
    if (skipped) log(ctx, `  ${name} week ${w}: ${skipped} row(s) left out (not staked in the game that week, or already a prize winner)`);
    // 4. Sends. A refusal stops this game's week (no seal), is reported with the chain's reason, and is not retried
    //    while the file stays the same (I-052).
    const go = async (what: string, call: string, calls: Call[]): Promise<boolean> => {
      const res = sent(await send(what, calls));
      if (res.ok) return true;
      // Repo Lens VB-3: only the chain's own refusal (a revert) is remembered. A network error, low Mana or a send not
      // yet seen in a block is reported and tried again on the next run: rows and winners already on chain are skipped.
      if (!isRevert(res.error)) {
        ctx.problems.push(`${name} week ${w}: ${call} didn't go through (${res.error || "no reason given"}). Nothing more was sent for this week this run; it is tried again on the next run.`);
        return false;
      }
      ctx.problems.push(`${name} week ${w}: the vault REFUSED ${call} (${res.error || "no reason given"}). Nothing more was sent for this week${memo ? ", and the bot won't send it again unless the results file changes" : ""}. ${rollover}`);
      if (memo) { memo.refused ??= {}; memo.refused[key] = { hash, what, error: String(res.error || "").slice(0, 300), at: k.time }; }
      return false;
    };
    let ok = true;
    for (let i = 0; i < rows.length && ok; i += ROWS_PER_TX) {
      const batch = rows.slice(i, i + ROWS_PER_TX);
      ok = await go(`${name} week ${w}: points for ${batch.length} player(s)`, "post_results", [{ method: "post_results", args: { game: id, week: String(w), rows: batch } }]);
    }
    for (const pl of places) {
      for (let i = 0; i < pl.players.length && ok; i += ROWS_PER_TX) {
        const part = pl.players.slice(i, i + ROWS_PER_TX);
        ok = await go(`${name} week ${w}: prize place ${pl.place} → ${part.join(", ")}`, "post_prize_winners", [{ method: "post_prize_winners", args: { game: id, week: String(w), place: pl.place, players: part } }]);
      }
    }
    if (ok && holdSeal) log(ctx, `  ${name} week ${w}: seal held (free-prize switches unreadable)`);
    if (ok && !holdSeal) await go(`${name} week ${w}: seal the results (the owner can correct them for 24 h)`, "seal_results", [{ method: "seal_results", args: { game: id, week: String(w) } }]);
  }
}

/** A board row's score: `pts` (every board today, Last Node included), else `points`; null when the board has neither
 *  (then every row counts). */
export function boardScore(row: any): number | null {
  const v = typeof row?.pts === "number" ? row.pts : typeof row?.points === "number" ? row.points : null;
  return v === null ? null : v > 0 ? v : 0;
}

/** The first pair of file rows whose points break the board's places ("" if none): a better place (a lower number)
 *  never gets fewer points, and a shared place gets equal points (the recorders' dense ranking onto 255 … 1 keeps
 *  both). Rows without a place on the board are not compared. */
export function orderBreak(rows: Array<{ player: string; points: number }>, places: Map<string, number>): string {
  const xs = rows.filter((x) => places.has(x.player)).map((x) => ({ a: x.player, pl: places.get(x.player)!, p: x.points }));
  xs.sort((u, v) => u.pl - v.pl);
  for (let i = 1; i < xs.length; i++) {
    const u = xs[i - 1], v = xs[i];
    if (u.pl === v.pl && u.p !== v.p) return `${u.a} and ${v.a} share place ${u.pl} but get ${u.p} and ${v.p} points`;
    if (u.pl < v.pl && u.p < v.p) return `${u.a} (place ${u.pl}) gets ${u.p} points, fewer than ${v.a} (place ${v.pl}) with ${v.p}`;
  }
  return "";
}

/** The stake that makes a wallet "staked" for the missing-wallet check: the vault's minimum, but never under 1 VHP, the
 *  recorders' own floor (Repo Lens VB-7). */
export function stakedFloor(min: bigint): bigint {
  return min > 100_000_000n ? min : 100_000_000n;
}

/** Whether a failed send was the contract's own refusal (a revert), as opposed to a network error, low Mana or a send
 *  not yet seen in a block. bot/chain.ts reports a revert as "reverted: …" (receipt) or with "transaction reverted" in
 *  the node's error (refused when submitted). */
export function isRevert(error: string | undefined): boolean {
  const e = String(error ?? "");
  // Repo Lens #C-6 (C6-1): out of Mana is never a refusal, even though its logs carry "transaction reverted: …".
  if (/^out of Mana:/.test(e)) return false;
  return /^reverted:/.test(e) || /transaction reverted/i.test(e);
}

/** Drops what the bot remembers about weeks more than 10 weeks old. */
function pruneMemo(m: VaultMemo, week: number) {
  const old = (k: string) => Number(k.split(":")[1]) < week - 10;
  for (const box of [m.seen, m.refused]) if (box) for (const k of Object.keys(box)) if (old(k)) delete box[k];
  if (m.alerted) m.alerted = m.alerted.filter((k) => !old(k)).slice(-500);
}

/** Finalizes other games' weeks once they may be: a day (2 × close_delay) after the seal, once the last correction has
 *  stood for close_delay (the owner's correction window has closed: audit V6-1), or (no results) once the deadline has
 *  passed, or when the owner voided them. A week already started pages on at once. Pages until done. */
export async function vaultFinalizePass(ctx: VaultCtx, send: Send) {
  const view = await vaultView(ctx.chain);
  if (!view) return;
  const k = await clock(ctx.chain);
  if (k.raw?.safe_mode) { log(ctx, "  withdrawals-only build: finalizing waits for the normal build"); return; }   // V2-2
  for (const g of view.games) {
    const id = num(g.id);
    // Every closed week of the game (a closed game week is one it earned, also before a restart: fix-check VN-3).
    // Twelve weeks back, so a long bot outage is caught up (fix-check 2, V2-8); older weeks: game-finalize by hand.
    for (let w = Math.max(0, k.weeksClosed - 12); w < k.weeksClosed; w++) {
      if (!vaultHandles(id, k.c, w)) continue;
      for (let page = 0; page < 20; page++) {
        const gw = (await ctx.chain.read("get_game", { game: id, week: String(w) })).week ?? {};
        if (!gw.closed || gw.finalized) break;
        const ready = gw.voided || gw.fin_started || (gw.sealed
          ? k.time >= num(gw.seal_time) + 2 * k.closeDelay && k.time >= num(gw.last_change_time) + k.closeDelay
          : k.time >= k.resultsDue(w));
        if (!ready) break;
        const what = gw.sealed && !gw.voided ? "find the winners" : "no results: roll the week over";
        // Repo Lens VB-2: a send's result is an object on failure ({ ok: false }), so it must go through sent().
        if (!sent(await send(`${g.name ?? `game ${id}`} week ${w}: finalize (${what})`, [{ method: "finalize_game_week", args: { game: id, week: String(w) } }])).ok || ctx.dryRun) break;
      }
    }
  }
}

/** Owner-only changes to the game list and results, for the hourly alerts (each emails you once). */
export function vaultAlerts(view: VaultView, k: { weeksClosed: number }, gameWeeks: Map<string, any>, ownerAlert: (key: string, text: string) => void, known?: string): string {
  for (const p of view.proposals) {
    const g = p.game ?? {};
    ownerAlert(`game-proposal:${num(g.id)}:${p.eta}`, `A game is announced: id ${num(g.id)} "${g.name}" (${[g.staked ? "stake bucket" : "", g.free_prize ? "free prize" : "", num(g.season_weeks) > 1 ? `${num(g.season_weeks)}-week seasons` : ""].filter(Boolean).join(", ")}), possible from ${utc(num(p.eta))}. If you did not do this, your admin key may be compromised.`);
  }
  const fp = JSON.stringify(view.games.map((g) => [num(g.id), !!g.active, !!g.staked, !!g.free_prize, num(g.season_weeks), num(g.from_week), num(g.last_week_plus_one)]));
  if (known && known !== fp) ownerAlert(`games:${fp}`, `The vault's game list changed (a game was added, stopped or restarted). If you did not do this, your admin key may be compromised.`);
  for (const [key, gw] of gameWeeks) {
    if (num(gw.last_change_time) > 0) ownerAlert(`game-correction:${key}:${gw.last_change_time}`, `The owner corrected results for ${key.replace(":", " week ")} at ${utc(num(gw.last_change_time))}. If you did not do this, your admin key may be compromised.`);
    if (gw.voided) ownerAlert(`game-void:${key}`, `The owner voided ${key.replace(":", " week ")}: its bucket rolls over and its prize goes back to the pool. If you did not do this, your admin key may be compromised.`);
  }
  return fp;
}

/** The weeks the alerts look at: each game's last 3 weeks. Returns "game <name>:<week>" → week record. */
export async function recentGameWeeks(chain: Chain, view: VaultView, weeksClosed: number, config?: any): Promise<Map<string, any>> {
  const out = new Map<string, any>();
  for (const g of view.games) {
    const id = num(g.id);
    for (let w = Math.max(0, weeksClosed - 3); w <= weeksClosed; w++) {
      if (!vaultHandles(id, config, w)) continue;
      const gw = (await chain.read("get_game", { game: id, week: String(w) })).week ?? {};
      if (!earnedWeek(g, w, gw)) continue;
      out.set(`${g.name ?? `game ${id}`}:${w}`, gw);
    }
  }
  return out;
}

/** Status lines for the vault (printed by `npm run bot -- status`). */
export async function vaultStatus(chain: Chain, print: (s: string) => void) {
  const view = await vaultView(chain);
  if (!view) return;
  const k = await clock(chain);
  const t = k.t;
  print(`Vault: fee owed ${showKoin(t.fee_vhp)} VHP · buckets rolling over ${showKoin(t.games_rolled)} VHP · stake in other games ${showKoin(t.stake_other)} VHP`);
  for (const g of view.games) {
    const id = num(g.id);
    const kind = [g.staked ? "staked" : "", g.free_prize ? `free prize${num(g.season_weeks) > 1 ? ` (${num(g.season_weeks)}-week seasons)` : ""}` : ""].filter(Boolean).join(" + ");
    const state = g.active ? `from week ${num(g.from_week)}` : `stopped (last week ${num(g.last_week_plus_one) - 1})`;
    let line = `  game ${id} ${g.name}: ${kind}, ${state}; stake ${showKoin(g.stake)} VHP (counted this week ${showKoin(g.week_stake)})`;
    if (big(g.rolled) > 0n) line += `; rolling over ${showKoin(g.rolled)}`;
    if (big(g.prize_held) > 0n) line += `; season prize held ${showKoin(g.prize_held)}`;
    print(line);
    const w = k.weeksClosed - 1;
    if (!vaultHandles(id, k.c, w)) continue;
    const gw = w >= 0 ? (await chain.read("get_game", { game: id, week: String(w) })).week ?? {} : {};
    if (w >= 0 && earnedWeek(g, w, gw)) {
      const st = gw.finalized ? (gw.rolled_over ? "rolled over" : `final: ${num(gw.winners)} winner(s), cutoff ${num(gw.cutoff)}, claimed ${showKoin(gw.claimed)}`)
        : gw.voided ? "voided" : gw.sealed ? `sealed ${utc(num(gw.seal_time))}` : `results due ${utc(k.resultsDue(w))}`;
      print(`      week ${w}: bucket ${showKoin(gw.bucket)}, prize ${showKoin(gw.prize)}; ${num(gw.eligible_players)} player(s) posted; ${st}`);
    }
  }
  for (const p of view.proposals) print(`  announced: game ${num(p.game?.id)} "${p.game?.name}", can be applied from ${utc(num(p.eta))} (npm run bot -- game-apply ${num(p.game?.id)} --send)`);
}
