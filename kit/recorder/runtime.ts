// Shared Game Kit: the one orchestrator (design §D). Every hourly run, for one game:
//  1. Load last run's files (a missing fetch or an unreadable file stops the run).
//  2. Both nodes: get_state → the vault clock; now = the LOWER of the two chain times. The two heads must be within
//     5 minutes of each other and (in a workflow) within 15 minutes of the runner's clock, or the run stops (KC-7).
//  3. The week to record: the one that just ended.
//  4. The game's source on both nodes (must agree; its reads count against the budget); its rounds (day = dayOf(locksAt));
//     each round's result on both nodes (must agree, else the round keeps its published result, or stays pending);
//     points from the module's scoreRound.
//  5. The week's state (lifecycle.decide): final only after Mon 00:00 UTC, every counted round decided, a full re-read
//     on both nodes this run, two runs ≥ 1 h apart reading the same, no hold, and a vault file that can be made.
//     Thursday 00:00 backstop.
//  6. Write the week file, board.json and (final weeks, inside the 3-day window) the vault file. Finals are copied
//     forward byte for byte; a final week the chain now reads differently (after a FULL, healthy re-read) gets a HOLD
//     file, and an unreleased HOLD alerts every run.
// The module never sees the clock, files or the network except through what this passes it.
import fs from "node:fs";
import path from "node:path";
import { dayOf, isSunday, pad3, tally, weekHash, resolveRound, roundsChange, canon, sha256, isAddr, allTimeOf, KIT_FILE_VERSION, MAX_ROUNDS, MAX_FILE_BYTES, MAX_BEHIND_MS, MAX_STATE_BYTES, MAX_EXTRAS_BYTES } from "../publish/check.inline.mjs";
import { clockFromState, type VaultClock } from "./clock.ts";
import { agree, budgeted, Budget, DEFAULT_BUDGETS, Disagree, OutOfBudget, ReadFailed, sameJson, toJson, type Budgets, type KitNode } from "./nodes.ts";
import { Prev, Out, MAX_WRITE_BYTES } from "./store.ts";
import { decide, holdWeeks, releaseCode, releaseMatches } from "./lifecycle.ts";
import { boardFor } from "./boards.ts";
import { vaultFileFor } from "./vaultfile.ts";
import { newAlerts, DUE_WARN_HOURS, type Alerts } from "./alerts.ts";
import { readVaultAnswers } from "./sources/vault-answers.ts";
import { readVaultStakes } from "./sources/vault-stakes.ts";
import { readPicksContract } from "./sources/picks-contract.ts";
import { readPublishedFinals } from "./sources/published.ts";
import { blockAtFor } from "./sources/block-at.ts";
import { FALLBACK_GRACE_MS, NotYet, PENDING, VOID, type GameModule, type NodeReader, type Pick, type PicksSource, type Published, type Round, type SourceRead, type States } from "./types.ts";

export type KitGameCfg = {
  slug: string; game: number; genesis: number; weekMs: number;
  sundayFunRound: boolean; payoutRule: "legacy-tied-whole" | "d152"; vaultValues: "dense255" | "points";
  entry: { minRounds: number; minPoints: number }; minPts: number; rowCap: number;
  liveWeek: boolean; roundsCorrectable: boolean; maxRoundPoints?: number; budgets?: Partial<Budgets>;
  /** K1: weeks in a season (scoreRound's seasonStaked). */ seasonWeeks?: number;
  /** KG parts v1: write the week file as parts, one per UTC day or per round. */ parts?: "d" | "r";
  /** Phase 1b: the game scores from the VHP ruler's published data (manifest vhpData): ctx.vhp. */
  vhpData?: boolean;
  /** #G-24 Info: every decided round of a ruler game uses at least one ruler card (default on with vhpData). */
  cardPerRound?: boolean;
  /** FC-9: the game publishes a write-once inputs file before each week opens (manifest inputsFile). */
  inputsFile?: boolean;
  /** How long before the week opens the inputs file is made (default 2 days: Saturday 00:00 UTC). */
  inputsLeadMs?: number;
};

export type RunOpts = {
  /** K4 (internal): this pass writes the open copy of the current week (liveWeek), not last week. */
  live?: boolean;
  nodes: [KitNode, KitNode];
  prev: string; out: string;
  /** <SLUG>_HOLD_WEEKS and <SLUG>_RELEASE. */
  holdWeeks?: string; release?: string;
  /** A source override (tests); default by module.picks.source. */
  source?: (node: KitNode, week: number, read: NodeReader) => Promise<SourceRead<any, any>>;
  log?: (s: string) => void;
  /** The run's wall clock for budgets only (never for game time). */
  wall?: () => number;
  /** The runner's clock, to catch two stalled nodes (KC-7). The CLI passes Date.now; tests leave it out. */
  wallNow?: () => number;
  /** Phase 1b: the vhp-data folder the workflow fetched (read-only), for a vhpData game. */
  vhpDir?: string;
  /** Tests only: a ruler ledger instead of a folder. */
  vhpLedger?: any;
  /** G13-1: the owner's explicit fresh start for carried state (<SLUG>_RESET_FROM_WEEK): this week starts empty. */
  resetFromWeek?: number;
  /** Other kit games' last-run folders (manifest `published`), by slug, for ctx.published (read-only). */
  published?: Record<string, { dir: string; cfg: { game: number; genesis: number; weekMs?: number; sundayFunRound: boolean; inputsFile?: boolean } }>;
};

export type RunResult = { week: number | null; state: string; alerts: Alerts; written: string[] };

const HOUR = 3600000, MIN = 60000;

/** FC-26: the vault contract's rule for whether a game has results for week w (Kpred gameEarns, bot/vault.ts
 *  earnedWeek): registered, from_week ≤ w, and (no last week, or w + 1 ≤ last_week_plus_one); or the vault already
 *  closed week w with it earning. A missing game is no game. */
export function gameEarnsWeek(r: any, w: number): boolean {
  const g = r?.game;
  if (!g) return false;
  if (r?.week?.closed) return true;
  const from = Number(g.from_week ?? NaN), last = Number(g.last_week_plus_one ?? 0);
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(last)) return false;
  return from <= w && (last === 0 || w + 1 <= last);
}
export const MAX_HEAD_GAP_MS = 5 * MIN;        // the two nodes' chain times (KC-7)
export { MAX_BEHIND_MS };                        // the chain time vs the runner's clock (KC-7; the check's FRESH_MS uses it, NK-11)
export const WARN_BYTES = Math.floor(MAX_FILE_BYTES * 0.6);     // a warning from 60% of the 2 MB cap…
export const ALERT_BYTES = Math.floor(MAX_FILE_BYTES * 0.85);   // …and an owner alert from 85%, well before the 1.9 MB stop (NK-3)
/** The variable names the owner sets for a game (hyphens → _, KC-19). */
export const varName = (slug: string, what: "RELEASE" | "HOLD_WEEKS") => `${slug.toUpperCase().replace(/-/g, "_")}_${what}`;

export const sourcesOf = (m: GameModule<any, any, any>): PicksSource[] => (Array.isArray(m.picks) ? m.picks : [m.picks]);
const DAY_MS = 86400000;
export const DEFAULT_INPUTS_LEAD_MS = 2 * DAY_MS;
export const MAX_INPUTS_LEAD_MS = 4 * DAY_MS;

function sourceFor(m: GameModule<any, any, any>, o: RunOpts) {
  if (o.source) return o.source;
  const p = sourcesOf(m)[0];
  if (p.source === "vault-answers") return (_node: KitNode, w: number, read: NodeReader) => readVaultAnswers(read, w);
  if (p.source === "picks-contract") return null;     // read after the rounds are known (readPicksWeek)
  throw new Error(`picks.source "${p.source}" isn't wired into the kit runtime yet (vault-answers and picks-contract are)`);
}

/** A carried-state map from a module, checked: wallet addresses, JSON states of at most MAX_STATE_BYTES. */
function checkedStates(what: string, x: unknown): States<any> {
  if (!(x instanceof Map)) throw new Error(`${what} must return a Map of wallet → state`);
  for (const [a, v] of x) {
    if (!isAddr(a)) throw new Error(`${what}: ${String(a).slice(0, 40)} is not a wallet address`);
    const j = toJson(v);
    if (j === null || j === undefined || Buffer.byteLength(JSON.stringify(j)) > MAX_STATE_BYTES) throw new Error(`${what}: ${a}'s state must be JSON of at most ${MAX_STATE_BYTES} bytes`);
  }
  return x;
}
const stateList = (m: States<any>) => [...m.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1)).map(([a, v]) => [a, toJson(v)]);

/** One node's picks for the week from the Picks contract (every round's pickRound, and each extra source's rounds) and
 *  the vault stakes of every wallet that picked or carries a state. */
async function readPicksWeek(m: GameModule<any, any, any>, node: KitNode, vault: NodeReader, budget: Budget, game: number, w: number, now: number, span: any, rounds: Round[], carried: string[]): Promise<SourceRead<any, any>> {
  const [main, ...extras] = sourcesOf(m);
  if (!Number.isSafeInteger(main.gameId)) throw new Error("picks-contract needs a gameId");
  const pr = budgeted(node.contract("picks"), budget);
  const picks = new Map<string, Pick<any>[]>();
  for (const r of rounds) {
    if (!Number.isSafeInteger(r.pickRound) || (r.pickRound as number) < 0) throw new Error(`round ${r.id}: a picks-contract game's round needs its pickRound (the Picks contract round)`);
    picks.set(r.id, (await readPicksContract(pr, main.gameId as number, r.pickRound as number)).map((p) => ({ ...p, round: r.id })));
  }
  const extra = new Map<number, Map<number, Pick<any>[]>>();
  for (const s of extras) {
    if (s.source !== "picks-contract" || !Number.isSafeInteger(s.gameId)) throw new Error("an extra picks source must be picks-contract with a gameId");
    const rm = new Map<number, Pick<any>[]>();
    for (const x of [...new Set(m.extraPickRounds?.(span, s) ?? [])].sort((a, b) => a - b)) {
      if (!Number.isSafeInteger(x) || x < 0) throw new Error(`extraPickRounds gave a bad round for game ${s.gameId}`);
      rm.set(x, await readPicksContract(pr, s.gameId as number, x));
    }
    extra.set(s.gameId as number, rm);
  }
  const wallets = new Set<string>(carried);
  for (const xs of picks.values()) for (const p of xs) wallets.add(p.wallet);
  const st = await readVaultStakes(vault, game, [...wallets], w, now);
  return { active: st.live, picks, extra, stakes: st.stakes, min: st.min };
}

/** One hourly run of one game. Throws (writing nothing) on a stop: missing last files, a node failure or disagreement. */
/** CAPACITY_STANDARD rule 2 (Capacity chat, 12 Nov): every run warns when a file it wrote passes 60% of the publish
 *  job's 2 MB cap, naming the file and its size, so a game hears about growth weeks before a file can't be published. */
export const CAPACITY_WARN_BYTES = Math.floor(0.6 * MAX_FILE_BYTES);
export async function runGame(m: GameModule<any, any, any>, cfg: KitGameCfg, o: RunOpts): Promise<RunResult> {
  const r = await runOnce(m, cfg, { ...o, live: false });
  // K4 (Survivor): a liveWeek game also writes an open copy of the current week every run, with the rounds decided so
  // far, so players see each day's result the next morning. It has no vault file and adds nothing to the all-time
  // board; it never stops last week's run (a failure is a warning).
  if (cfg.liveWeek) {
    try {
      const lv = await runOnce(m, cfg, { ...o, live: true });
      r.written.push(...lv.written.filter((x) => !r.written.includes(x)));
      for (const k of ["errors", "warnings", "notes"] as const) for (const x of lv.alerts[k]) r.alerts[k].push(`live week ${lv.week ?? "?"}: ${x}`);
    } catch (e) { r.alerts.warnings.push(`the current week's open copy couldn't be written this run (${(e as Error).message})`); }
  }
  for (const rel of r.written) {
    let n = 0;
    try { n = fs.statSync(path.join(o.out, rel)).size; } catch { continue; }
    if (n > CAPACITY_WARN_BYTES) r.alerts.warnings.push(`${rel} is ${(n / 1048576).toFixed(2)} MB, over 60% of the 2 MB publish cap (CAPACITY_STANDARD rule 2): plan a split before it reaches the cap`);
  }
  return r;
}

async function runOnce(m: GameModule<any, any, any>, cfg: KitGameCfg, o: RunOpts): Promise<RunResult> {
  const log = o.log ?? ((s: string) => console.log(s));
  const alerts = newAlerts();
  if (m.slug !== cfg.slug) throw new Error(`module slug "${m.slug}" isn't game.json's "${cfg.slug}"`);
  const prev = Prev.load(o.prev, cfg);
  const budget = new Budget({ ...DEFAULT_BUDGETS, ...(cfg.budgets ?? {}) }, o.wall);
  const [A, B] = o.nodes;
  const va = budgeted(A.vault, budget), vb = budgeted(B.vault, budget);
  const REL = varName(cfg.slug, "RELEASE"), HW = varName(cfg.slug, "HOLD_WEEKS");

  // 2. The clock, from both nodes.
  const [sa, sb] = await Promise.all([va.read("get_state", {}), vb.read("get_state", {})]);
  const ka = clockFromState(sa), kb = clockFromState(sb);
  if (ka.clock.genesis !== kb.clock.genesis || ka.clock.weekMs !== kb.clock.weekMs) throw new Disagree("the vault's week clock", ka.clock, kb.clock);
  if (ka.clock.genesis !== cfg.genesis || ka.clock.weekMs !== cfg.weekMs) throw new Error(`the vault's clock (${ka.clock.genesis}, ${ka.clock.weekMs}) isn't game-data/deployment.json's (${cfg.genesis}, ${cfg.weekMs})`);
  if (Math.abs(ka.time - kb.time) > MAX_HEAD_GAP_MS) throw new Error(`the two nodes' chain times are ${Math.round(Math.abs(ka.time - kb.time) / MIN)} min apart (more than ${MAX_HEAD_GAP_MS / MIN}): one is behind or stalled`);
  const clock: VaultClock = ka.clock;
  let now = Math.min(ka.time, kb.time);
  if (o.wallNow) {
    const wall = o.wallNow();
    if (wall - now > MAX_BEHIND_MS) throw new Error(`both nodes' chain time is ${Math.round((wall - now) / MIN)} min behind this runner's clock: the nodes are stalled`);
    // FC-13: chain time ahead of the runner never moves the game forward. `now` is capped at the runner's clock, so a
    // node (or two) reporting a future head can't open, lock, decide or finalize anything early.
    if (now > wall) {
      if (now - wall > MAX_HEAD_GAP_MS) alerts.warnings.push(`both nodes' chain time is ${Math.round((now - wall) / MIN)} min ahead of this runner's clock: using the runner's clock (FC-13)`);
      now = wall;
    }
  }
  const cw = clock.weekOf(now);
  const out = new Out(o.out);
  const owner = holdWeeks(o.holdWeeks);

  // ctx.published: this game's published finals and other kit games' (Phase 1 item 6), loaded once, read-only.
  const published: Published = { own: Object.fromEntries(prev.finals().map((j) => [j.week, j])), games: {} };
  for (const [slug, g] of Object.entries(o.published ?? {})) published.games[slug] = readPublishedFinals(g.dir, g.cfg);
  // What inputsFor sees for week u: only weeks final before u's inputs file is made (weeks ≤ u − 2; week u − 1 is still
  // being played then). The same view when the file is made and when it's recounted, so the recount can't differ
  // just because a later week went final (FC-9).
  const before = (u: number): Published => {
    const cut = (r: Record<number, any>) => Object.fromEntries(Object.entries(r).filter(([k]) => Number(k) <= u - 2));
    return { own: cut(published.own), games: Object.fromEntries(Object.entries(published.games).map(([k, v]) => [k, cut(v)])) };
  };

  // Phase 1b (G1/G2): the ruler's data, loaded once into one checked ledger. Data that can't be loaded gives the game a
  // ctx.vhp whose card() throws NotYet: rounds stay pending and the inputs file waits; nothing is guessed.
  const usedInputCards = new Map<string, any>(), usedWeekCards = new Map<string, any>();
  let vhpIn: any, vhpWk: any, cardList: any = null, vhpRound: ((m: Map<string, any>) => any) | null = null;
  // #G-69 G69-3: cards already published are re-made from their own stored settings (set once the week is known).
  let weekPins: Map<string, any> | undefined, vhpInFor: (pins?: Map<string, any>) => any = () => vhpIn, pinsOf: (c: unknown) => Map<string, any> = () => new Map();
  // #G-69 G69-2: ctx.fallback is offered only when the ruler's data loaded this run.
  let vhpLoaded = false;
  // #G-69 G69-1 (the Ruler chat): the last block this run's ruler data reaches, recorded in the week file (vhpTo).
  let vhpTo: number | undefined;
  if (cfg.vhpData) {
    const V = await import("./sources/vhp-ruler.ts");
    cardList = V.cardList;
    let L: any = null;
    try { if (o.vhpLedger) L = o.vhpLedger; else { if (!o.vhpDir) throw new Error("no vhp-data folder was given"); L = V.loadLedger(o.vhpDir); } }
    catch (e) { alerts.warnings.push(`the ruler's data couldn't be loaded this run (${(e as Error).message}): rounds that need it stay pending`); }
    if (L && Number.isSafeInteger(L.to)) vhpTo = L.to;
    const stub = (why: string) => ({ to: -1, ruleVersion: V.RULE_VERSION, card() { throw new V.NotYet(`not yet: ${why}`); } });
    vhpLoaded = !!L;
    pinsOf = V.pinsOf;
    vhpIn = L ? V.vhpFor(L, usedInputCards) : stub("the ruler's data isn't loaded this run");
    vhpInFor = (pins) => (L ? V.vhpFor(L, usedInputCards, pins) : vhpIn);
    vhpWk = L ? V.vhpFor(L, usedWeekCards) : stub("the ruler's data isn't loaded this run");
    // One round's own ctx.vhp (cardPerRound): its cards go to that round's map, then to the week's.
    vhpRound = (mine) => (L ? V.vhpFor(L, mine, weekPins) : stub("the ruler's data isn't loaded this run"));
  }
  const isNotYet = (e: unknown) => e instanceof NotYet;
  // G7: ctx.blockAt(ms), the first irreversible block at or after a UTC time, per node; both searches pinned to the
  // lower of the two nodes' last irreversible blocks (read once, only if a game asks), so the answers can be compared.
  let pinP: Promise<number> | null = null, bA: ((ms: number) => Promise<number>) | null = null, bB: typeof bA = null;
  const pin = () => (pinP ??= Promise.all([charged(A).head(), charged(B).head()]).then(([x, y]) => Math.min(x.lib, y.lib)));   // #G-50 G50-1: a failed head is a ReadFailed
  // #G-41: block reads are reads: charged to the run's budget, failures are ReadFailed (the round stays pending).
  const charged = (n: KitNode): KitNode => ({ ...n, async blockTime(h: number) {
    budget.take(`${n.label} block ${h}`);
    try { return await n.blockTime!(h); } catch (e) { if (e instanceof OutOfBudget || e instanceof ReadFailed) throw e; throw new ReadFailed(n.label, `block ${h}`, e); }
  }, async head() { try { return await n.head(); } catch (e) { throw new ReadFailed(n.label, "head", e); } } });
  // #G-41 G41-4: every ctx.blockAt asks BOTH nodes and requires the same height (a Disagree: the round stays pending
  // with an alert, or the run stops for inputs), so a game that drops the height can't hide a lying node.
  const blockAtBoth = async (ms: number) => {
    const fa = (bA ??= blockAtFor(charged(A), await pin())), fb = (bB ??= blockAtFor(charged(B), await pin()));
    const [x, y] = await Promise.all([fa(ms), fb(ms)]);
    if (x !== y) throw new Disagree(`the first block at ${new Date(ms).toISOString()}`, x, y);
    return x;
  };
  const blockAtA = blockAtBoth, blockAtB = blockAtBoth;
  const chainOf = (_rd: unknown) => blockAtBoth;

  // FC-9: next week's inputs file (price list, seeding), made once inside its window before the week opens, on both
  // nodes (they must agree). Write-once: the publish check refuses a changed copy and any copy after the week opens.
  if (cfg.inputsFile && !o.live) {
    if (!m.inputsFor) throw new Error(`${cfg.slug}: inputsFile is set but the module has no inputsFor`);
    const lead = cfg.inputsLeadMs ?? DEFAULT_INPUTS_LEAD_MS;
    // G13-2: at most 4 days, so ctx.published (weeks ≤ u − 2, final by Thursday of week u − 1) can't change between
    // the file and the recount.
    if (!(lead > 0 && lead <= MAX_INPUTS_LEAD_MS)) throw new Error(`${cfg.slug}: inputsLeadMs must be above 0 and at most 4 days (#G-13 G13-2)`);
    const u = cw + 1, us = clock.span(u);
    if (now >= us.start - lead && now < us.start && !prev.inputs(u)) {
      try {
        usedInputCards.clear();
        const data = toJson(await agree(`week ${u}'s inputs`, () => m.inputsFor!(us, { now, read: va, published: before(u), vhp: vhpIn, blockAt: blockAtA }), () => m.inputsFor!(us, { now, read: vb, published: before(u), vhp: vhpIn, blockAt: blockAtB })));
        if (data === null || typeof data !== "object") throw new Error(`week ${u}: inputsFor must return an object or a list`);
        out.write(`inputs/W${u}.json`, cfg.vhpData ? { game: cfg.game, week: u, data, cards: cardList(usedInputCards) } : { game: cfg.game, week: u, data });
        alerts.notes.push(`week ${u}: its inputs file was made (FC-9)`);
      } catch (e) {
        if (isNotYet(e)) {
          (now >= us.start - 6 * 3600000 ? alerts.errors : alerts.warnings).push(`week ${u}'s inputs file waits for the ruler's data (${(e as Error).message}); it must be published before ${new Date(us.start).toISOString()}`);
        } else {
        if (!(e instanceof Disagree || e instanceof OutOfBudget || e instanceof ReadFailed)) throw e;
        alerts.errors.push(`week ${u}'s inputs file couldn't be made this run (${(e as Error).message}); it must be published before ${new Date(us.start).toISOString()} or that week can't be scored`);
        }
      }
    }
  }

  const w = o.live ? cw : cw - 1;
  if (w < 0) { log(`${cfg.slug}: no week has ended yet.`); return { week: null, state: "none", alerts, written: out.written }; }
  const span = clock.span(w), due = clock.due(w);
  const pw = prev.week(w);
  weekPins = pw ? pinsOf(pw.cards) : undefined;

  // Holds: the owner's release of a HOLD file must name its week and code exactly (Block X's rule). The publish job
  // checks the same variable itself, so a run can't release its own hold (KC-3).
  const hf = o.live ? null : prev.holdFile(w), released = !!prev.releaseFile(w);
  let held: string | null = null;
  if (hf && !released) {
    if (releaseMatches(o.release, w, hf.reason)) {
      out.write(`vault/RELEASE-W${w}.json`, { game: cfg.game, week: w, code: releaseCode(hf.reason) });
      alerts.notes.push(`week ${w}: the owner released its hold (${hf.reason})`);
    } else {
      held = `HOLD-W${w}.json: ${hf.reason}`;
      // An unreleased hold alerts every run (KC-6).
      alerts.errors.push(`week ${w} is held: ${hf.reason}. Check it; to release it set ${REL} = "${w}:${releaseCode(hf.reason)}"`);
    }
  }
  if (owner.has(w) && !o.live) {
    if (pw?.state === "final") alerts.warnings.push(`${HW} lists week ${w}, but it is already final: the hold does nothing (KC-20)`);
    else held = `the owner's hold (${HW})`;
  }

  const pastDue = () => {
    log(`${cfg.slug} week ${w}: past the vault's 3 days; nothing more to record.`);
    return { week: w, state: "past-due", alerts, written: out.written };
  };
  if (now >= due && pw?.state === "final") return pastDue();

  // 4. The source, on both nodes; it must be identical. vault-answers comes first (it carries the game's own inputs);
  // picks-contract after the inputs, carried state and rounds (its reads follow the rounds).
  const src = sourceFor(m, o);
  let ra: SourceRead<any, any> | null = null;
  if (src) {
    const [x, y] = await Promise.all([src(A, w, va), src(B, w, vb)]);
    if (!sameJson(x, y)) throw new Disagree(`week ${w}'s picks, stakes or inputs`, toJson(x), toJson(y));
    ra = x;
    if (ra.active === false || (ra.inputs as any)?.active === false) {
      log(`${cfg.slug}: week ${w} is not paid from a results file (not active on chain): nothing to record.`);
      return { week: null, state: "not-active", alerts, written: out.written };
    }
  }
  if (now >= due) {
    // Every run until the week rolls over, so a skipped hour can't hide it (KC-21) — but only for a game that is
    // active on chain, checked first (#B-12 NK-10: no hourly false alarms before a game starts).
    alerts.errors.push(`week ${w}: not final by its results deadline (${new Date(due).toISOString()}): the vault pays nothing for it (the backstop)`);
    return pastDue();
  }
  // FC-26: a vault file only for a week the game earns, by the vault's own rule (Kpred gameEarns / earnedWeek):
  // from its from_week, before its last week, or a week the vault already closed with it. Game 1 is gated by its own
  // source (inputs.active, the v6.1 rule week). Read on both nodes; they must agree.
  let earns = true;
  if (cfg.game !== 1) {
    const ga = await agree(`game ${cfg.game}'s vault registration`, () => va.read("get_game", { game: cfg.game, week: String(w) }), () => vb.read("get_game", { game: cfg.game, week: String(w) }));
    earns = gameEarnsWeek(ga, w);
    if (!earns) alerts.notes.push(`week ${w}: game ${cfg.game} doesn't earn this week in the vault (not registered, before its from_week, or stopped): no vault file (FC-26)`);
  }

  // The week's inputs. FC-9 games score on their published inputs file (what players saw), recounted here on both
  // nodes; a recount that differs holds the week. Other games read theirs now, on both nodes (KC-30).
  let inputs = ra?.inputs;
  let inputsHash: string | undefined;
  let inputsHeld: string | null = null;
  if (cfg.inputsFile) {
    const f = prev.inputs(w);
    if (!f) {
      alerts.errors.push(`week ${w}: no inputs file was published before the week opened (inputs/W${w}.json, FC-9): it can't be scored; nothing recorded`);
      return { week: w, state: "no-inputs", alerts, written: out.written };
    }
    inputs = f.data; inputsHash = sha256(canon(f));
    try {
      const vin = vhpInFor(pinsOf(f.cards));   // #G-69 G69-3: the inputs file's own card settings
      const again = await agree(`week ${w}'s inputs (recount)`, () => m.inputsFor!(span, { now, inputs: ra?.inputs, read: va, published: before(w), vhp: vin, blockAt: blockAtA }), () => m.inputsFor!(span, { now, inputs: ra?.inputs, read: vb, published: before(w), vhp: vin, blockAt: blockAtB }));
      if (!sameJson(again, f.data)) {
        inputsHeld = `the inputs recount differs from the published inputs file (FC-9)`;
        alerts.errors.push(`week ${w}: ${inputsHeld}: the week is held pending; check inputs/W${w}.json`);
      }
    } catch (e) {
      if (!(isNotYet(e) || e instanceof Disagree || e instanceof OutOfBudget || e instanceof ReadFailed)) throw e;
      inputsHeld = `the inputs recount couldn't run (${(e as Error).message})`;
      alerts.warnings.push(`week ${w}: ${inputsHeld}; it stays pending this run`);
    }
  } else if (m.inputsFor) {
    // Inputs the game reads itself (cards, seeding, prices), on both nodes; they must agree (KC-30).
    try {
      inputs = await agree(`week ${w}'s inputs`, () => m.inputsFor!(span, { now, inputs: ra?.inputs, read: va, published: before(w), vhp: vhpIn, blockAt: blockAtA }), () => m.inputsFor!(span, { now, inputs: ra?.inputs, read: vb, published: before(w), vhp: vhpIn, blockAt: blockAtB }));
    } catch (e) {
      if (!isNotYet(e)) throw e;
      alerts.warnings.push(`week ${w}: its inputs aren't readable yet (${(e as Error).message}); nothing recorded this run`);
      return { week: w, state: "waiting", alerts, written: out.written };
    }
  }

  // Carried state (FC-5): the week before must be final; its `next` is this week's start (through carryIn).
  let carry: States<any> | null = null;
  if (m.nextState) {
    const pwk = prev.week(w - 1);
    // K4: the open copy of the current week may start from last week's pending copy (display only; no vault file).
    if (pwk && pwk.state !== "final" && o.live) alerts.notes.push(`its carried state comes from week ${w - 1}'s pending copy until that week is final`);
    else if (pwk && pwk.state !== "final") {
      alerts.errors.push(`week ${w} waits on week ${w - 1}, which isn't final (held or still pending): its carried state isn't known, so nothing is recorded for week ${w} (FC-5)`);
      return { week: w, state: "waiting", alerts, written: out.written };
    }
    // G13-1: no file for week w − 1 is a fresh start only for the game's first week, or when the owner resets it
    // (<SLUG>_RESET_FROM_WEEK = w, e.g. a game switched back on after weeks off). Any earlier week file means a week
    // went missing (an outage, a missed inputs file, a week that waited): record nothing rather than start everyone
    // from empty.
    const reset = o.resetFromWeek === w;
    if (!pwk && !reset && prev.weeks().some((x) => x < w - 1)) {
      alerts.errors.push(`week ${w} waits on week ${w - 1}, which has no week file although earlier weeks do: its carried state isn't known, so nothing is recorded for week ${w} (FC-5, #G-13 G13-1). Recover week ${w - 1}, or set ${cfg.slug.toUpperCase().replace(/-/g, "_")}_RESET_FROM_WEEK=${w} to start week ${w} from empty state`);
      return { week: w, state: "waiting", alerts, written: out.written };
    }
    if (reset) alerts.warnings.push(`week ${w}: carried state reset by the owner (RESET_FROM_WEEK): every wallet starts empty`);
    const last: States<any> = reset ? new Map() : new Map((pwk?.next ?? []) as [string, unknown][]);
    carry = checkedStates("carryIn", m.carryIn ? m.carryIn(last, span, inputs) : last);
  }

  // K1 (Survivor): a season game's season start (recorded in each week file: `season`) and seasonStaked, the wallets
  // with a counted stake (peak >= the week's min, not voided) in any week of the season so far. The first week, a
  // reset week, or the week after a season's last starts a new season; earlier season weeks must be final (nothing
  // guessed), except for the current week's open copy (display only).
  let seasonCtx: { seasonStaked: Set<string>; seasonStart: number; seasonWeek: number } | undefined;
  if (cfg.seasonWeeks) {
    const sw = cfg.seasonWeeks, pwk = prev.week(w - 1);
    const reset = o.resetFromWeek === w;
    if (!pwk && !reset && prev.weeks().some((x) => x < w - 1)) {
      alerts.errors.push(`week ${w} waits on week ${w - 1}, which has no week file although earlier weeks do: its season isn't known, so nothing is recorded for week ${w} (K1). Recover week ${w - 1}, or set ${cfg.slug.toUpperCase().replace(/-/g, "_")}_RESET_FROM_WEEK=${w}`);
      return { week: w, state: "waiting", alerts, written: out.written };
    }
    const ps = pwk && Number.isSafeInteger(pwk.season) ? (pwk.season as number) : null;
    const start = !reset && ps !== null && w - ps < sw ? ps : w;
    const staked = new Set<string>();
    const minNow = BigInt(ra.min);
    for (const [a, st] of ra.stakes) if (!st.voided && BigInt(st.peak) >= minNow) staked.add(a);
    for (let u = start; u < w; u++) {
      const f = prev.week(u);
      if (!f || (f.state !== "final" && !o.live)) {
        alerts.errors.push(`week ${w} waits on week ${u}, an earlier week of its season, which ${f ? "isn't final" : "has no week file"}: who staked this season isn't known yet (K1)`);
        return { week: w, state: "waiting", alerts, written: out.written };
      }
      const fm = BigInt(f.min);
      for (const p of f.players as [string, string, string, number][]) if (!p[3] && BigInt(p[2]) >= fm) staked.add(p[0]);
    }
    seasonCtx = { seasonStaked: staked, seasonStart: start, seasonWeek: w - start + 1 };
  }

  const rounds: Round[] = m.roundsFor(span, { now, inputs, published }).slice().sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  if (rounds.length > MAX_ROUNDS) throw new Error(`${cfg.slug}: ${rounds.length} rounds in week ${w}, more than the kit's ${MAX_ROUNDS} (KC-11)`);
  const ids = new Set(rounds.map((r) => r.id));
  if (ids.size !== rounds.length) throw new Error(`${cfg.slug}: roundsFor gave a round id twice`);
  if (!ra) {
    const carried = carry ? [...carry.keys()] : [];
    const [x, y] = await Promise.all([readPicksWeek(m, A, va, budget, cfg.game, w, now, span, rounds, carried), readPicksWeek(m, B, vb, budget, cfg.game, w, now, span, rounds, carried)]);
    if (!sameJson(x, y)) throw new Disagree(`week ${w}'s picks or stakes`, toJson(x), toJson(y));
    ra = x;
    if (ra.active === false) {
      log(`${cfg.slug}: week ${w} is not paid from a results file (the vault's v6 rule isn't live for it): nothing to record.`);
      return { week: null, state: "not-active", alerts, written: out.written };
    }
  }
  for (const id of ra.picks.keys()) if (!ids.has(id)) throw new Error(`picks for round ${id}, which roundsFor doesn't list`);

  // resultOf with ctx.vhp; a card the data doesn't cover yet is PENDING (never a guess).
  // #G-69 G69-1: rounds a run couldn't decide because something wasn't readable yet (NotYet), as opposed to a result
  // the chain itself still shows as undecided.
  const MAX_FALLBACK_WHY = 200;
  const dispRows = new Map<string, Map<string, unknown[]>>();
  const notYet = new Set<string>();
  // K8: rounds decided this run by the game's fallback rule, [round, at, why]; and the published copy's (fixed).
  const fallbackOf = new Map<string, [string, number, string]>();
  const pubFallbacks = new Map<string, [string, number, string]>((Array.isArray(pw?.fallbacks) ? pw.fallbacks : []).map((f: any) => [f[0], f]));
  const resultOf = async (r: Round, rd: NodeReader) => {
    if (!cfg.vhpData) {
      try { return await m.resultOf(r, rd, inputs, { blockAt: chainOf(rd) }); }
      catch (e) { if (isNotYet(e)) { notYet.add(r.id); return PENDING; } throw e; }
    }
    const mine = new Map<string, any>();
    let res: any, fb: [string, number, string] | null = null;
    // K8, ctx.fallback (#G-69 G69-2): only with the ruler's data loaded this run; never for a round the published copy
    // decided without one; resolves at the first irreversible block on or after resolvesAt + 48 h.
    const fallback = async (why: string) => {
      if (!vhpLoaded) throw new NotYet("not yet: no fallback without the ruler's data this run (#G-69 G69-2)");
      const pr = pubRounds.get(r.id);
      if (pr && pr[3] !== "p" && !pubFallbacks.has(r.id)) throw new NotYet(`not yet: round ${r.id} was decided with its card; never re-decided by the fallback (#G-69 G69-2)`);
      const at = r.resolvesAt + FALLBACK_GRACE_MS;
      await chainOf(rd)(at);
      const text = String(why ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_FALLBACK_WHY) || "no ruler card";
      fb = [r.id, at, text];
    };
    try { res = await m.resultOf(r, rd, inputs, { vhp: vhpRound!(mine), blockAt: chainOf(rd), fallback }); }
    catch (e) { if (isNotYet(e)) { notYet.add(r.id); return PENDING; } throw e; }
    for (const [k, v] of mine) usedWeekCards.set(k, v);
    if (fb && res !== PENDING) fallbackOf.set(r.id, fb);
    // #G-24 Info: a decided ruler round must come from at least one ruler card (cardPerRound, on by default), unless
    // the game decided it by its fallback rule (K8).
    if (cfg.cardPerRound && res !== PENDING && mine.size === 0 && !(fb && res !== PENDING)) throw new Error(`round ${r.id}: decided without a ruler card (cardPerRound; a ruler game's results come from ctx.vhp.card, or ctx.fallback after the 48 h grace)`);
    return res;
  };

  // The fold: each round's state after its picks, in lock order (picks are known; results aren't needed).
  const stateFor = new Map<string, States<any>>();
  let next: States<any> | null = carry;
  if (carry) {
    for (const r of rounds.slice().sort((x, y) => x.locksAt - y.locksAt || (x.id < y.id ? -1 : 1))) {
      const ps = (ra.picks.get(r.id) ?? []).slice().sort((x, y) => (x.wallet < y.wallet ? -1 : 1));
      next = checkedStates(`nextState (round ${r.id})`, m.nextState!(next as States<any>, ps, r, inputs));
      stateFor.set(r.id, next);
    }
  }

  // The published (pending) copy's rounds by id, by wallet address: a round that can't be re-read keeps them.
  // #G-69 G69-1: the final copy's too, so a round this run can't decide keeps its published result (below).
  const pubRounds = new Map<string, any[]>();
  if (pw) for (const r of pw.rounds) pubRounds.set(r[0], resolveRound(pw, r));
  let keptPublished = false;
  // #G-69 G69-1 (the Ruler chat): vhp-data only grows at its end, so data that ends before the published copy's is a
  // stale or short download: the whole week couldn't be re-read, and every round the published copy decided keeps it.
  const pubTo = pw && Number.isSafeInteger(pw.vhpTo) ? (pw.vhpTo as number) : undefined;
  const staleData = vhpTo !== undefined && pubTo !== undefined && vhpTo < pubTo;
  if (staleData) alerts.warnings.push(`week ${w}: this run's ruler data ends at block ${vhpTo}, before the published copy's ${pubTo} (a stale or short download): the week isn't re-read this run (#G-69 G69-1)`);

  const players = [...ra.stakes.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1)).map(([a, s]) => [a, s.stake, s.peak, s.voided ? 1 : 0]);
  const idx = new Map(players.map((p, i) => [p[0] as string, i]));
  let rereadOk = !staleData, disagreed = false;
  const roundsOut: any[] = [];
  for (const r of rounds) {
    const day = r.day;
    if (!(Number.isSafeInteger(day) && day === dayOf(r.locksAt) && day >= span.start && day < span.end)) throw new Error(`round ${r.id}: its day must be dayOf(locksAt) inside week ${w} (KC-30)`);
    const fun = cfg.sundayFunRound && isSunday(day) ? 1 : 0;
    const picks = (ra.picks.get(r.id) ?? []).slice().sort((x, y) => (x.wallet < y.wallet ? -1 : 1));
    for (const p of picks) if (!idx.has(p.wallet)) throw new Error(`round ${r.id}: ${p.wallet} picked but has no stake read`);
    // Who plays the round: every wallet that picked, and (carried state) every wallet with a state.
    const st = stateFor.get(r.id);
    const who = [...new Set([...picks.map((p) => p.wallet), ...(st ? st.keys() : [])])].sort();
    for (const a of who) if (!idx.has(a)) throw new Error(`round ${r.id}: ${a} has a state but no stake read`);
    let status: "s" | "v" | "p" = "p";
    let rows: [string, number, number][] = who.map((a) => [a, 0, 0]);
    if (now >= r.resolvesAt) {
      try {
        const same = m.same ?? sameJson;
        const res = await agree(`round ${r.id}'s result`, () => resultOf(r, va as NodeReader), () => resultOf(r, vb as NodeReader),
          (x: any, y: any) => (x === PENDING || x === VOID || y === PENDING || y === VOID ? x === y : same(x, y)));
        if (res === VOID) status = "v";
        else if (res !== PENDING) {
          status = "s";
          const sc = seasonCtx ? m.scoreRound(r, picks, res, inputs, st, seasonCtx) : m.scoreRound(r, picks, res, inputs, st);
          if (sc.size !== who.length || who.some((a) => !sc.has(a))) throw new Error(`round ${r.id}: scoreRound must score exactly the wallets that picked${st ? " or carry a state" : ""}`);
          rows = who.map((wa) => {
            const p = { wallet: wa };
            const s = sc.get(p.wallet);
            if (!s || !Number.isSafeInteger(s.points) || s.points < 0 || !Number.isSafeInteger(s.at) || s.at < 0) throw new Error(`round ${r.id}: scoreRound gave no whole points and score time for ${p.wallet}`);
            if (s.points > 0 && !(s.at >= span.start && s.at < due)) throw new Error(`round ${r.id}: scoreRound gave ${p.wallet} a score time outside week ${w}'s start to its results deadline (NK-19)`);
            if (s.points > (cfg.maxRoundPoints ?? 1000000)) throw new Error(`round ${r.id}: scoreRound gave ${p.wallet} ${s.points} points, over the game's maxRoundPoints (${cfg.maxRoundPoints ?? 1000000}); the publish check would hold every run (NK-13)`);
            return [p.wallet, s.points, s.points > 0 ? s.at : 0];
          });
        }
      } catch (e) {
        if (!(e instanceof Disagree || e instanceof OutOfBudget || e instanceof ReadFailed)) throw e;
        rereadOk = false;
        if (e instanceof Disagree) disagreed = true;
        alerts.warnings.push(`round ${r.id}: ${(e as Error).message}; it keeps its published result this run`);
        const pr = pubRounds.get(r.id);
        if (pr) { status = pr[3]; rows = pr[4]; if (pr[3] !== "p") keptPublished = true; }
      }
    }
    const pr = pubRounds.get(r.id);
    // K8 / #G-69 G69-2: a round the published copy decided by its fallback rule stays exactly as published.
    if (pr && pr[3] !== "p" && pubFallbacks.has(r.id)) { status = pr[3]; rows = pr[4]; fallbackOf.set(r.id, pubFallbacks.get(r.id)!); }
    // #G-69 G69-1: a round the published copy decided but this run can't decide (a failed or missing ruler-data
    // fetch, a card() or blockAt "not yet" while one node lags, a rebuilt vhp-data branch) is a read this run couldn't
    // finish, never a change: it keeps its published result and cards, and the week doesn't compare (no HOLD on a
    // final week; a pending week stays pending). In a game whose decided rounds can't change, that holds whatever the
    // cause; in a correctable game a round the chain itself shows undecided again is a correction, as before.
    if (pr && pr[3] !== "p" && (staleData || (status === "p" && (notYet.has(r.id) || !cfg.roundsCorrectable)))) {
      rereadOk = false; keptPublished = true;
      // An error every run when this run had all its data (the ruler's loaded and not behind the published copy's): a
      // decided round that now reads differently is a real data event the owner must see (Fantasy, 14 Nov). A run that
      // just lacked data (a failed or stale download) says so once above, and each such round is a warning.
      const fullData = !cfg.vhpData || (vhpTo !== undefined && !staleData);
      (fullData ? alerts.errors : alerts.warnings).push(`round ${r.id}: decided in the published copy but not decidable this run${fullData ? " with all its data: check it" : ""}; it keeps its published result (#G-69 G69-1)`);
      status = pr[3]; rows = pr[4];
    }
    // A decided round changing is only an owner correction on chain (roundsCorrectable); otherwise stop (KC-8).
    // A Sunday fun round never counts, so it may be corrected in any game (NK-13), as the publish check allows.
    if (pr && pw!.state !== "final" && pr[3] !== "p" && JSON.stringify([status, rows]) !== JSON.stringify([pr[3], pr[4]]) && !cfg.roundsCorrectable && !fun) {
      throw new Error(`round ${r.id} was decided and now reads differently on both nodes (an on-chain correction?). This game's decided rounds can't change: nothing recorded; check the round`);
    }
    roundsOut.push([r.id, day, fun, status, rows.map(([a, p, at]) => (p > 0 ? [idx.get(a), p, at - span.start] : [idx.get(a), p]))]);
    // partCols (display only, parts games): each wallet's columns for this round, from its pick and its state.
    if (cfg.parts && m.partCols) {
      const pm = new Map(picks.map((x) => [x.wallet, x.pick]));
      dispRows.set(r.id, new Map(rows.map(([a]) => [a, m.partCols!.row(pm.get(a) ?? null, st?.get(a) ?? null)])));
    }
  }
  const body: any = { v: KIT_FILE_VERSION, game: cfg.game, week: w, start: span.start, end: span.end, min: ra.min, state: "pending", seen: { hash: "", at: 0 }, rounds: roundsOut, players };
  if (inputsHash) body.inputs = inputsHash;
  if (carry) { body.carry = stateList(carry); body.next = stateList(next as States<any>); }
  const t = tally(body, cfg);
  if (m.weekExtras) {
    const points = new Map<string, number>(t.rows.map((x: any) => [x.a, x.pts]));
    const staked = new Set<string>(t.rows.filter((x: any) => x.board === "staked").map((x: any) => x.a));
    const ex = toJson(m.weekExtras(span, { points, picks: ra.extra ?? new Map(), staked, inputs }));
    if (ex === null || typeof ex !== "object" || Buffer.byteLength(JSON.stringify(ex)) > MAX_EXTRAS_BYTES) throw new Error(`${cfg.slug}: weekExtras must return an object or list of at most ${MAX_EXTRAS_BYTES} bytes`);
    body.extras = ex;
  }
  if (cfg.vhpData) {
    // A round kept from the published copy keeps its cards too (the publish check's cardPerRound count).
    if (keptPublished && Array.isArray(pw?.cards)) {
      const have = new Set([...usedWeekCards.values()].map((c: any) => c[1]));
      for (const c of pw.cards) if (!have.has(c[1])) { usedWeekCards.set(`published:${c[1]}`, c); have.add(c[1]); }
    }
    body.cards = cardList(usedWeekCards);
    // K8: the rounds decided by the game's fallback rule, sorted, each alerted until it's published.
    const fbs = roundsOut.filter((x: any) => x[3] !== "p" && fallbackOf.has(x[0])).map((x: any) => fallbackOf.get(x[0])!).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    if (fbs.length) body.fallbacks = fbs;
    for (const f of fbs) if (!pubFallbacks.has(f[0])) alerts.errors.push(`round ${f[0]}: no ruler card 48 h after it ended, so it was decided by the game's fallback rule (${f[2]}); recorded in the week file`);
  }
  if (seasonCtx) body.season = seasonCtx.seasonStart;
  if (cfg.vhpData) {
    // Never backwards: the larger of this run's and the published copy's (a run without data keeps the published one).
    const to = Math.max(vhpTo ?? -1, pubTo ?? -1);
    if (to >= 0) body.vhpTo = to;
  }
  const hash = weekHash(body);
  if (cfg.rowCap > 0 && t.rows.length > cfg.rowCap) alerts.warnings.push(`week ${w}: ${t.rows.length} board rows, over the game's cap of ${cfg.rowCap}: board.json keeps the ranked rows and the best others`);

  const sizeAlert = (what: string, n: number) => {
    if (n > ALERT_BYTES) alerts.errors.push(`${what} is ${Math.round(n / 1024)} KB, over 85% of the 2 MB cap: it stops at 1.9 MB, so the game needs its files split soon (NK-3, NK-4)`);
    else if (n > WARN_BYTES) alerts.warnings.push(`${what} is ${Math.round(n / 1024)} KB, over 60% of the 2 MB cap (KC-9, NK-3)`);
  };
  // board.json is trimmed to its byte budget (boardOf); if its kept rows alone are still too big, the week's other files
  // are written anyway and the board waits, with an owner alert (NK-4: the cap never leaves a week with no files).
  const writeBoard = (b: any) => {
    const n = Buffer.byteLength(JSON.stringify(b));
    if (n > MAX_WRITE_BYTES) { alerts.errors.push(`week ${w}: board.json would be ${Math.round(n / 1024)} KB even with only its ranked and prize rows: not written this run (the week file and vault file still are). This needs a board cap agreed with the vault bot (NK-4)`); return; }
    sizeAlert("board.json", n);
    out.write("board.json", b);
  };

  // alltime.json (FC-16, FC-18): rebuilt each run from every published final week (and this run's), medals only for
  // weeks with a vault file — the publish check rebuilds it the same way.
  const writeAllTime = (thisFinal: any | null, vaultWeek: number | null) => {
    const finals = new Map<number, any>(prev.finals().map((j) => [j.week, j]));
    if (thisFinal) finals.set(thisFinal.week, thisFinal);
    if (!finals.size) return;
    const medal = new Set<number>([...finals.keys()].filter((x) => !!prev.vault(x) || x === vaultWeek));
    const at = allTimeOf([...finals.values()], cfg, medal, new Date(now).toISOString());
    const n = Buffer.byteLength(canon(at));
    if (n > MAX_WRITE_BYTES) { alerts.errors.push(`alltime.json would be ${Math.round(n / 1024)} KB: not written`); return; }
    out.write("alltime.json", at);
  };

  // A published final never changes (RECORDER §3.3, §4.7).
  if (pw?.state === "final") {
    if (!cfg.parts) out.copy(`W${pad3(w)}.json`, pw);      // a parts folder that's final stays as published
    // A read that failed or ran out of budget is a warning; the two nodes disagreeing on a final week's round is an
    // error every run, so change detection can't go quiet behind a node that keeps disagreeing (#B-12 NK-12). Both are
    // said whether or not the kept published rounds make the hash match (#G-69 G69-1).
    if (!rereadOk && disagreed) alerts.errors.push(`week ${w} is final, but the two nodes disagree on its rounds, so this run can't tell whether it changed on chain (no HOLD written): check the nodes`);
    else if (!rereadOk) alerts.warnings.push(`week ${w} is final; this run couldn't re-read every round, so it doesn't compare (no HOLD)`);
    else if (pw.seen.hash !== hash) {
      if (released) alerts.errors.push(`week ${w} changed on chain again after its hold was released (${pw.seen.hash.slice(0, 12)} → ${hash.slice(0, 12)}): check it (KC-20)`);
      else if (!hf) {
        const reason = `week ${w} changed on chain after it went final (${pw.seen.hash.slice(0, 12)} → ${hash.slice(0, 12)})`;
        out.write(`vault/HOLD-W${w}.json`, { game: cfg.game, week: w, reason });
        alerts.errors.push(`${reason}: the vault file is held. Check it; if the published one is right, release it with ${REL} = "${w}:${releaseCode(reason)}"`);
      }
    }
    writeBoard(boardFor(pw, cfg, now));
    const pv = prev.vault(w);
    let vw = !!pv;
    if (pv) out.copy(`vault/W${w}.json`, pv);
    else if (earns) { const vf = vaultFileFor(pw, cfg, now, due); if (vf) { out.write(`vault/W${w}.json`, vf); vw = true; } }
    writeAllTime(null, vw ? w : null);
    log(`${cfg.slug} week ${w}: final (copied forward).`);
    return { week: w, state: "final", alerts, written: out.written };
  }

  // The publish check's own rule against the published copy, mirrored so the recorder says why it will be held (NK-13).
  const change = pw ? roundsChange(pw, body, cfg) : "";
  if (change) alerts.errors.push(`week ${w}: the publish check will hold this week file (${change}); check the round on chain`);
  if (t.vaultError) alerts.errors.push(`week ${w}: no vault file can be made (${t.vaultError}); it stays pending`);
  const d = decide({ now, end: span.end, due, complete: t.complete, hash, prev: pw ? { state: pw.state, seen: pw.seen } : null, rereadOk, held: held ?? inputsHeld ?? (t.vaultError ? `no vault file: ${t.vaultError}` : null) });
  body.state = d.state; body.seen = d.seen;
  const size = Buffer.byteLength(JSON.stringify(body));
  if (size > MAX_WRITE_BYTES) throw new Error(`week ${w}'s file would be ${Math.round(size / 1024)} KB, over the ${Math.round(MAX_WRITE_BYTES / 1024)} KB the kit writes: this game has outgrown one week file (GAME_KIT.md §6: split it before this happens)`);
  sizeAlert(`week ${w}'s file`, size);
  // KG parts v1: a parts game writes the week as its folder W<NNN>/ (display columns from partCols ride along).
  const writeWeek = (j: any) => {
    if (!cfg.parts) { out.write(`W${pad3(w)}.json`, j); return; }
    const r = out.writeWeekParts(j, cfg, prev.manifest(w), m.partCols ? { cols: m.partCols.cols, rows: dispRows } : null, now);
    alerts.warnings.push(...r.warnings.map((x) => `${x} (CAPACITY_STANDARD rule 2)`));
  };
  if (o.live) {
    if (d.state !== "open") throw new Error(`week ${w} isn't open by the chain's clock`);
    writeWeek(body);
    log(`${cfg.slug} week ${w}: OPEN (live copy); ${rounds.length} rounds.`);
    return { week: w, state: d.state, alerts, written: out.written };
  }
  writeWeek(body);
  writeBoard(boardFor(body, cfg, now));
  const vf = earns ? vaultFileFor(body, cfg, now, due) : null;
  if (vf) out.write(`vault/W${w}.json`, vf);
  writeAllTime(body.state === "final" ? body : null, vf ? w : null);
  if (d.state !== "final" && due - now < DUE_WARN_HOURS * HOUR) alerts.warnings.push(`week ${w}: not final yet (${d.why}); its results are due ${new Date(due).toISOString()}`);
  if (held) alerts.notes.push(`week ${w} held: ${held}`);
  log(`${cfg.slug} week ${w}: ${d.state.toUpperCase()} (${d.why}); ${rounds.length} rounds, ${t.rows.length} players, ${t.vault.rows.length} staked rows, first ${t.vault.first.length}, second ${t.vault.second.length}.`);
  return { week: w, state: d.state, alerts, written: out.written };
}
