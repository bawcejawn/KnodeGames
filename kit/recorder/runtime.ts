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
import { dayOf, isSunday, pad3, tally, weekHash, resolveRound, roundsChange, KIT_FILE_VERSION, MAX_ROUNDS, MAX_FILE_BYTES, MAX_BEHIND_MS } from "../publish/check.inline.mjs";
import { clockFromState, type VaultClock } from "./clock.ts";
import { agree, budgeted, Budget, DEFAULT_BUDGETS, Disagree, OutOfBudget, ReadFailed, sameJson, toJson, type Budgets, type KitNode } from "./nodes.ts";
import { Prev, Out, MAX_WRITE_BYTES } from "./store.ts";
import { decide, holdWeeks, releaseCode, releaseMatches } from "./lifecycle.ts";
import { boardFor } from "./boards.ts";
import { vaultFileFor } from "./vaultfile.ts";
import { newAlerts, DUE_WARN_HOURS, type Alerts } from "./alerts.ts";
import { readVaultAnswers } from "./sources/vault-answers.ts";
import { PENDING, VOID, type GameModule, type NodeReader, type Round, type SourceRead } from "./types.ts";

export type KitGameCfg = {
  slug: string; game: number; genesis: number; weekMs: number;
  sundayFunRound: boolean; payoutRule: "legacy-tied-whole" | "d152"; vaultValues: "dense255" | "points";
  entry: { minRounds: number; minPoints: number }; minPts: number; rowCap: number;
  liveWeek: boolean; roundsCorrectable: boolean; maxRoundPoints?: number; budgets?: Partial<Budgets>;
};

export type RunOpts = {
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
};

export type RunResult = { week: number | null; state: string; alerts: Alerts; written: string[] };

const HOUR = 3600000, MIN = 60000;
export const MAX_HEAD_GAP_MS = 5 * MIN;        // the two nodes' chain times (KC-7)
export { MAX_BEHIND_MS };                        // the chain time vs the runner's clock (KC-7; the check's FRESH_MS uses it, NK-11)
export const WARN_BYTES = Math.floor(MAX_FILE_BYTES * 0.6);     // a warning from 60% of the 2 MB cap…
export const ALERT_BYTES = Math.floor(MAX_FILE_BYTES * 0.85);   // …and an owner alert from 85%, well before the 1.9 MB stop (NK-3)
/** The variable names the owner sets for a game (hyphens → _, KC-19). */
export const varName = (slug: string, what: "RELEASE" | "HOLD_WEEKS") => `${slug.toUpperCase().replace(/-/g, "_")}_${what}`;

function sourceFor(m: GameModule<any, any, any>, o: RunOpts) {
  if (o.source) return o.source;
  if (m.picks.source === "vault-answers") return (_node: KitNode, w: number, read: NodeReader) => readVaultAnswers(read, w);
  throw new Error(`picks.source "${m.picks.source}" isn't wired into the kit runtime yet (only vault-answers in kit-core)`);
}

/** One hourly run of one game. Throws (writing nothing) on a stop: missing last files, a node failure or disagreement. */
export async function runGame(m: GameModule<any, any, any>, cfg: KitGameCfg, o: RunOpts): Promise<RunResult> {
  const log = o.log ?? ((s: string) => console.log(s));
  const alerts = newAlerts();
  if (m.slug !== cfg.slug) throw new Error(`module slug "${m.slug}" isn't game.json's "${cfg.slug}"`);
  const prev = Prev.load(o.prev, cfg);
  const budget = new Budget({ ...DEFAULT_BUDGETS, ...(cfg.budgets ?? {}) }, o.wall ?? Date.now);
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
  const now = Math.min(ka.time, kb.time);
  if (o.wallNow && o.wallNow() - now > MAX_BEHIND_MS) throw new Error(`both nodes' chain time is ${Math.round((o.wallNow() - now) / MIN)} min behind this runner's clock: the nodes are stalled`);
  const cw = clock.weekOf(now);
  const out = new Out(o.out);
  const owner = holdWeeks(o.holdWeeks);

  const w = cw - 1;
  if (w < 0) { log(`${cfg.slug}: no week has ended yet.`); return { week: null, state: "none", alerts, written: out.written }; }
  const span = clock.span(w), due = clock.due(w);
  const pw = prev.week(w);

  // Holds: the owner's release of a HOLD file must name its week and code exactly (Block X's rule). The publish job
  // checks the same variable itself, so a run can't release its own hold (KC-3).
  const hf = prev.holdFile(w), released = !!prev.releaseFile(w);
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
  if (owner.has(w)) {
    if (pw?.state === "final") alerts.warnings.push(`${HW} lists week ${w}, but it is already final: the hold does nothing (KC-20)`);
    else held = `the owner's hold (${HW})`;
  }

  const pastDue = () => {
    log(`${cfg.slug} week ${w}: past the vault's 3 days; nothing more to record.`);
    return { week: w, state: "past-due", alerts, written: out.written };
  };
  if (now >= due && pw?.state === "final") return pastDue();

  // 4. The source, on both nodes; it must be identical.
  const src = sourceFor(m, o);
  const [ra, rb] = await Promise.all([src(A, w, va), src(B, w, vb)]);
  if (!sameJson(ra, rb)) throw new Disagree(`week ${w}'s picks, stakes or inputs`, toJson(ra), toJson(rb));
  if ((ra.inputs as any)?.active === false) {
    log(`${cfg.slug}: week ${w} is not paid from a results file (not active on chain): nothing to record.`);
    return { week: null, state: "not-active", alerts, written: out.written };
  }
  if (now >= due) {
    // Every run until the week rolls over, so a skipped hour can't hide it (KC-21) — but only for a game that is
    // active on chain, checked first (#B-12 NK-10: no hourly false alarms before a game starts).
    alerts.errors.push(`week ${w}: not final by its results deadline (${new Date(due).toISOString()}): the vault pays nothing for it (the backstop)`);
    return pastDue();
  }
  let inputs = ra.inputs;
  if (m.inputsFor) {
    // Inputs the game reads itself (cards, seeding, prices), on both nodes; they must agree (KC-30).
    inputs = await agree(`week ${w}'s inputs`, () => m.inputsFor!(span, { now, inputs: ra.inputs, read: va }), () => m.inputsFor!(span, { now, inputs: ra.inputs, read: vb }));
  }
  const rounds: Round[] = m.roundsFor(span, { now, inputs }).slice().sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  if (rounds.length > MAX_ROUNDS) throw new Error(`${cfg.slug}: ${rounds.length} rounds in week ${w}, more than the kit's ${MAX_ROUNDS} (KC-11)`);
  const ids = new Set(rounds.map((r) => r.id));
  if (ids.size !== rounds.length) throw new Error(`${cfg.slug}: roundsFor gave a round id twice`);
  for (const id of ra.picks.keys()) if (!ids.has(id)) throw new Error(`picks for round ${id}, which roundsFor doesn't list`);

  // The published (pending) copy's rounds by id, by wallet address: a round that can't be re-read keeps them.
  const pubRounds = new Map<string, any[]>();
  if (pw && pw.state !== "final") for (const r of pw.rounds) pubRounds.set(r[0], resolveRound(pw, r));

  const players = [...ra.stakes.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1)).map(([a, s]) => [a, s.stake, s.peak, s.voided ? 1 : 0]);
  const idx = new Map(players.map((p, i) => [p[0] as string, i]));
  let rereadOk = true, disagreed = false;
  const roundsOut: any[] = [];
  for (const r of rounds) {
    const day = r.day;
    if (!(Number.isSafeInteger(day) && day === dayOf(r.locksAt) && day >= span.start && day < span.end)) throw new Error(`round ${r.id}: its day must be dayOf(locksAt) inside week ${w} (KC-30)`);
    const fun = cfg.sundayFunRound && isSunday(day) ? 1 : 0;
    const picks = (ra.picks.get(r.id) ?? []).slice().sort((x, y) => (x.wallet < y.wallet ? -1 : 1));
    for (const p of picks) if (!idx.has(p.wallet)) throw new Error(`round ${r.id}: ${p.wallet} picked but has no stake read`);
    let status: "s" | "v" | "p" = "p";
    let rows: [string, number, number][] = picks.map((p) => [p.wallet, 0, 0]);
    if (now >= r.resolvesAt) {
      try {
        const same = m.same ?? sameJson;
        const res = await agree(`round ${r.id}'s result`, () => m.resultOf(r, va as NodeReader, inputs), () => m.resultOf(r, vb as NodeReader, inputs),
          (x: any, y: any) => (x === PENDING || x === VOID || y === PENDING || y === VOID ? x === y : same(x, y)));
        if (res === VOID) status = "v";
        else if (res !== PENDING) {
          status = "s";
          const sc = m.scoreRound(r, picks, res, inputs);
          if (sc.size !== picks.length) throw new Error(`round ${r.id}: scoreRound scored wallets that didn't pick`);
          rows = picks.map((p) => {
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
        if (pr) { status = pr[3]; rows = pr[4]; }
      }
    }
    // A decided round changing is only an owner correction on chain (roundsCorrectable); otherwise stop (KC-8).
    const pr = pubRounds.get(r.id);
    // A Sunday fun round never counts, so it may be corrected in any game (NK-13), as the publish check allows.
    if (pr && pr[3] !== "p" && JSON.stringify([status, rows]) !== JSON.stringify([pr[3], pr[4]]) && !cfg.roundsCorrectable && !fun) {
      throw new Error(`round ${r.id} was decided and now reads differently on both nodes (an on-chain correction?). This game's decided rounds can't change: nothing recorded; check the round`);
    }
    roundsOut.push([r.id, day, fun, status, rows.map(([a, p, at]) => (p > 0 ? [idx.get(a), p, at - span.start] : [idx.get(a), p]))]);
  }
  const body: any = { v: KIT_FILE_VERSION, game: cfg.game, week: w, start: span.start, end: span.end, min: ra.min, state: "pending", seen: { hash: "", at: 0 }, rounds: roundsOut, players };
  const hash = weekHash(body);
  const t = tally(body, cfg);
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

  // A published final never changes (RECORDER §3.3, §4.7).
  if (pw?.state === "final") {
    out.copy(`W${pad3(w)}.json`, pw);
    if (pw.seen.hash !== hash) {
      // A read that failed or ran out of budget is a warning; the two nodes disagreeing on a final week's round is an
      // error every run, so change detection can't go quiet behind a node that keeps disagreeing (#B-12 NK-12).
      if (!rereadOk && disagreed) alerts.errors.push(`week ${w} is final, but the two nodes disagree on its rounds, so this run can't tell whether it changed on chain (no HOLD written): check the nodes`);
      else if (!rereadOk) alerts.warnings.push(`week ${w} is final; this run couldn't re-read every round, so it doesn't compare (no HOLD)`);
      else if (released) alerts.errors.push(`week ${w} changed on chain again after its hold was released (${pw.seen.hash.slice(0, 12)} → ${hash.slice(0, 12)}): check it (KC-20)`);
      else if (!hf) {
        const reason = `week ${w} changed on chain after it went final (${pw.seen.hash.slice(0, 12)} → ${hash.slice(0, 12)})`;
        out.write(`vault/HOLD-W${w}.json`, { game: cfg.game, week: w, reason });
        alerts.errors.push(`${reason}: the vault file is held. Check it; if the published one is right, release it with ${REL} = "${w}:${releaseCode(reason)}"`);
      }
    }
    writeBoard(boardFor(pw, cfg, now));
    const pv = prev.vault(w);
    if (pv) out.copy(`vault/W${w}.json`, pv);
    else { const vf = vaultFileFor(pw, cfg, now, due); if (vf) out.write(`vault/W${w}.json`, vf); }
    log(`${cfg.slug} week ${w}: final (copied forward).`);
    return { week: w, state: "final", alerts, written: out.written };
  }

  // The publish check's own rule against the published copy, mirrored so the recorder says why it will be held (NK-13).
  const change = pw ? roundsChange(pw, body, cfg) : "";
  if (change) alerts.errors.push(`week ${w}: the publish check will hold this week file (${change}); check the round on chain`);
  if (t.vaultError) alerts.errors.push(`week ${w}: no vault file can be made (${t.vaultError}); it stays pending`);
  const d = decide({ now, end: span.end, due, complete: t.complete, hash, prev: pw ? { state: pw.state, seen: pw.seen } : null, rereadOk, held: held ?? (t.vaultError ? `no vault file: ${t.vaultError}` : null) });
  body.state = d.state; body.seen = d.seen;
  const size = Buffer.byteLength(JSON.stringify(body));
  if (size > MAX_WRITE_BYTES) throw new Error(`week ${w}'s file would be ${Math.round(size / 1024)} KB, over the ${Math.round(MAX_WRITE_BYTES / 1024)} KB the kit writes: this game has outgrown one week file (GAME_KIT.md §6: split it before this happens)`);
  sizeAlert(`week ${w}'s file`, size);
  out.write(`W${pad3(w)}.json`, body);
  writeBoard(boardFor(body, cfg, now));
  const vf = vaultFileFor(body, cfg, now, due);
  if (vf) out.write(`vault/W${w}.json`, vf);
  if (d.state !== "final" && due - now < DUE_WARN_HOURS * HOUR) alerts.warnings.push(`week ${w}: not final yet (${d.why}); its results are due ${new Date(due).toISOString()}`);
  if (held) alerts.notes.push(`week ${w} held: ${held}`);
  log(`${cfg.slug} week ${w}: ${d.state.toUpperCase()} (${d.why}); ${rounds.length} rounds, ${t.rows.length} players, ${t.vault.rows.length} staked rows, first ${t.vault.first.length}, second ${t.vault.second.length}.`);
  return { week: w, state: d.state, alerts, written: out.written };
}
