// Shared Game Kit: the one orchestrator (design §D). Every hourly run, for one game:
//  1. Load last run's files (a missing fetch or an unreadable file stops the run).
//  2. Both nodes: get_state → the vault clock; now = the LOWER of the two chain times (never the runner's clock).
//  3. The week to record: the one that just ended (and, for games with a live board, this week).
//  4. The game's source on both nodes (must agree); its rounds; each round's result on both nodes (must agree, else
//     the round stays pending); points from the module's scoreRound.
//  5. The week's state (lifecycle.decide): final only after Mon 00:00 UTC, every counted round decided, a full re-read
//     on both nodes this run, two runs ≥ 1 h apart reading the same, and no hold. Thursday 00:00 backstop.
//  6. Write the week file, board.json and (final weeks, inside the 3-day window) the vault file. Finals are copied
//     forward byte for byte; a final week the chain now reads differently gets a HOLD file and an alert.
// The module never sees the clock, files or the network except through what this passes it.
import { dayOf, isSunday, pad3, tally, weekHash, KIT_FILE_VERSION } from "../publish/check.inline.mjs";
import { clockFromState, type VaultClock } from "./clock.ts";
import { agree, budgeted, Budget, DEFAULT_BUDGETS, Disagree, OutOfBudget, sameJson, toJson, type Budgets, type KitNode } from "./nodes.ts";
import { Prev, Out } from "./store.ts";
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
  source?: (node: KitNode, week: number) => Promise<SourceRead<any, any>>;
  log?: (s: string) => void;
  /** The run's wall clock for budgets only (never for game time). */
  wall?: () => number;
};

export type RunResult = { week: number | null; state: string; alerts: Alerts; written: string[] };

const HOUR = 3600000;

function sourceFor(m: GameModule<any, any, any>, cfg: KitGameCfg, o: RunOpts) {
  if (o.source) return o.source;
  if (m.picks.source === "vault-answers") return (node: KitNode, w: number) => readVaultAnswers(node.vault, w);
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

  // 2. The clock, from both nodes.
  const [sa, sb] = await Promise.all([va.read("get_state", {}), vb.read("get_state", {})]);
  const ka = clockFromState(sa), kb = clockFromState(sb);
  if (ka.clock.genesis !== kb.clock.genesis || ka.clock.weekMs !== kb.clock.weekMs) throw new Disagree("the vault's week clock", ka.clock, kb.clock);
  if (ka.clock.genesis !== cfg.genesis || ka.clock.weekMs !== cfg.weekMs) throw new Error(`the vault's clock (${ka.clock.genesis}, ${ka.clock.weekMs}) isn't game-data/deployment.json's (${cfg.genesis}, ${cfg.weekMs})`);
  const clock: VaultClock = ka.clock;
  const now = Math.min(ka.time, kb.time);
  const cw = clock.weekOf(now);
  const out = new Out(o.out);
  const owner = holdWeeks(o.holdWeeks);

  const w = cw - 1;
  if (w < 0) { log(`${cfg.slug}: no week has ended yet.`); return { week: null, state: "none", alerts, written: out.written }; }
  const span = clock.span(w), due = clock.due(w);

  // Release of a hold: exactly the week and the reason's code (Block X's rule).
  const hf = prev.holdFile(w);
  let held: string | null = null;
  if (hf && !prev.releaseFile(w)) {
    if (releaseMatches(o.release, w, hf.reason)) {
      out.write(`vault/RELEASE-W${w}.json`, { game: cfg.game, week: w, code: releaseCode(hf.reason) });
      alerts.notes.push(`week ${w}: the owner released its hold (${hf.reason})`);
    } else held = `HOLD-W${w}.json: ${hf.reason} (release with ${cfg.slug.toUpperCase()}_RELEASE = "${w}:${releaseCode(hf.reason)}")`;
  }
  if (owner.has(w)) held = `the owner's hold (${cfg.slug.toUpperCase()}_HOLD_WEEKS)`;

  if (now >= due) {
    const pw = prev.week(w);
    if (pw?.state !== "final" && now - due < 2 * HOUR) alerts.errors.push(`week ${w}: not final by its results deadline (${new Date(due).toISOString()}): the vault pays nothing for it (the backstop)`);
    log(`${cfg.slug} week ${w}: past the vault's 3 days; nothing more to record.`);
    return { week: w, state: "past-due", alerts, written: out.written };
  }

  // 4. The source, on both nodes; it must be identical.
  const src = sourceFor(m, cfg, o);
  const [ra, rb] = await Promise.all([src(A, w), src(B, w)]);
  if (!sameJson(ra, rb)) throw new Disagree(`week ${w}'s picks, stakes or inputs`, toJson(ra), toJson(rb));
  if ((ra.inputs as any)?.active === false) {
    log(`${cfg.slug}: week ${w} is not paid from a results file (not active on chain): nothing to record.`);
    return { week: null, state: "not-active", alerts, written: out.written };
  }
  const inputs = ra.inputs;
  const rounds: Round[] = m.roundsFor(span, { now, inputs }).slice().sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  const ids = new Set(rounds.map((r) => r.id));
  if (ids.size !== rounds.length) throw new Error(`${cfg.slug}: roundsFor gave a round id twice`);
  for (const id of ra.picks.keys()) if (!ids.has(id)) throw new Error(`picks for round ${id}, which roundsFor doesn't list`);

  let rereadOk = true;
  const roundsOut: any[] = [];
  for (const r of rounds) {
    const day = r.day;
    if (!(Number.isSafeInteger(day) && day % 86400000 === 0 && day >= span.start && day < span.end)) throw new Error(`round ${r.id}: its day must be a UTC day start inside week ${w} (use dayOf(locksAt))`);
    const fun = cfg.sundayFunRound && isSunday(day) ? 1 : 0;
    const picks = (ra.picks.get(r.id) ?? []).slice().sort((x, y) => (x.wallet < y.wallet ? -1 : 1));
    for (const p of picks) if (!ra.stakes.has(p.wallet)) throw new Error(`round ${r.id}: ${p.wallet} picked but has no stake read`);
    let status: "s" | "v" | "p" = "p";
    let rows: [string, number, number][] = picks.map((p) => [p.wallet, 0, p.at]);
    if (now >= r.resolvesAt) {
      try {
        const same = m.same ?? sameJson;
        const res = await agree(`round ${r.id}'s result`, () => m.resultOf(r, va as NodeReader, inputs), () => m.resultOf(r, vb as NodeReader, inputs),
          (x: any, y: any) => (x === PENDING || x === VOID || y === PENDING || y === VOID ? x === y : same(x, y)));
        if (res === VOID) status = "v";
        else if (res !== PENDING) {
          status = "s";
          const sc = m.scoreRound(r, picks, res, inputs);
          rows = picks.map((p) => {
            const s = sc.get(p.wallet);
            if (!s || !Number.isSafeInteger(s.points) || s.points < 0 || !Number.isSafeInteger(s.at) || s.at < 0) throw new Error(`round ${r.id}: scoreRound gave no whole points for ${p.wallet}`);
            return [p.wallet, s.points, s.at];
          });
          if (sc.size !== picks.length) throw new Error(`round ${r.id}: scoreRound scored wallets that didn't pick`);
        }
      } catch (e) {
        if (e instanceof Disagree) { alerts.warnings.push(`round ${r.id}: the two nodes disagree on its result; it stays pending`); rereadOk = false; }
        else if (e instanceof OutOfBudget) { alerts.notes.push(String((e as Error).message)); rereadOk = false; }
        else throw e;
      }
    }
    roundsOut.push([r.id, day, fun, status, rows]);
  }
  const players = [...ra.stakes.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1)).map(([a, s]) => [a, s.stake, s.peak, s.voided ? 1 : 0]);
  const body: any = { v: KIT_FILE_VERSION, game: cfg.game, week: w, start: span.start, end: span.end, min: ra.min, state: "pending", seen: { hash: "", at: 0 }, rounds: roundsOut, players };
  const hash = weekHash(body);
  const t = tally(body, cfg);
  if (cfg.rowCap > 0 && t.rows.length > cfg.rowCap) throw new Error(`week ${w}: ${t.rows.length} board rows, over the game's cap of ${cfg.rowCap}: no files (LEADERBOARD §5)`);

  // A published final never changes (RECORDER §3.3, §4.7).
  const pw = prev.week(w);
  if (pw?.state === "final") {
    out.copy(`W${pad3(w)}.json`, pw);
    if (pw.seen.hash !== hash) {
      const reason = `week ${w} changed on chain after it went final (${pw.seen.hash.slice(0, 12)} → ${hash.slice(0, 12)})`;
      if (!hf) out.write(`vault/HOLD-W${w}.json`, { game: cfg.game, week: w, reason });
      if (!prev.releaseFile(w)) alerts.errors.push(`${reason}: the vault file is held. Check it; if the published one is right, release it with ${cfg.slug.toUpperCase()}_RELEASE = "${w}:${releaseCode(hf?.reason ?? reason)}"`);
    }
    out.write("board.json", boardFor(pw, cfg, now));
    const pv = prev.vault(w);
    if (pv) out.copy(`vault/W${w}.json`, pv);
    else { const vf = vaultFileFor(pw, cfg, now, due); if (vf) out.write(`vault/W${w}.json`, vf); }
    log(`${cfg.slug} week ${w}: final (copied forward).`);
    return { week: w, state: "final", alerts, written: out.written };
  }

  const d = decide({ now, end: span.end, due, complete: t.complete, hash, prev: pw ? { state: pw.state, seen: pw.seen } : null, rereadOk, held });
  body.state = d.state; body.seen = d.seen;
  out.write(`W${pad3(w)}.json`, body);
  out.write("board.json", boardFor(body, cfg, now));
  const vf = vaultFileFor(body, cfg, now, due);
  if (vf) out.write(`vault/W${w}.json`, vf);
  if (d.state !== "final" && due - now < DUE_WARN_HOURS * HOUR) alerts.warnings.push(`week ${w}: not final yet (${d.why}); its results are due ${new Date(due).toISOString()}`);
  if (held) alerts.notes.push(`week ${w} held: ${held}`);
  log(`${cfg.slug} week ${w}: ${d.state.toUpperCase()} (${d.why}); ${rounds.length} rounds, ${t.rows.length} players, ${t.vault.rows.length} staked rows, first ${t.vault.first.length}, second ${t.vault.second.length}.`);
  return { week: w, state: d.state, alerts, written: out.written };
}
