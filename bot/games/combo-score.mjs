/**
 * COMBO CARD SCORING, shared by the recorder (bot/games/combo.ts) and the verify job (tools/combo-verify.mjs; Repo Lens
 * fix-check 3 FC3-3). Plain JavaScript with no dependencies but Node's own fs and path, so the verify job can run it
 * without installing anything: the same code prices and scores a card in both, and a run whose files differ from what
 * this code gives can't be published.
 *
 * makeScorer(ctx) returns score() (price and score one card, as the recorder does) and recheck() (does a published
 * final card match its sources?). ctx: { race, targets, head, agreed, movedInto, problems, errors, moveMargin }:
 *   race      the race-data folder;  targets  Block X targets by block height (blockTargets);
 *   head      { height, time, lib, libTime } (both nodes: the slower);  agreed  the time came from both nodes;
 *   movedInto (who, from, to) => Promise<{ moved } | { nonCanonical } | { hold }>  (both nodes, Block X BX-100);
 *   problems, errors  arrays the live run reports into;  moveMargin  Block X's MOVE_MARGIN;
 *   rulerFrom COMBO_RULER_FROM_WEEK as read by rulerFrom() (null = unset). One week rule (D-new A; Repo Lens #G-16 Q6):
 *     every race leg of a card in an ON week (the card's own day's vault week) is decided by the Race's ruler card
 *     (R<week>.json in race-data), never by the handicap standings; off and shadow weeks keep the standings. Block X legs
 *     are unchanged (who signed a block is a fact). The worths stay the handicap card's in every week.
 */
import * as fs from "node:fs";
import * as path from "node:path";
await import("../../race-math.js");
await import("../../blockx-math.js");
await import("../../combo-math.js");
await import("../../vhp-ruler.js");
const M = globalThis.KRaceMath, X = globalThis.KBlockX, C = globalThis.KCombo, R = globalThis.KRuler;
const isAddr = (a) => typeof a === "string" && /^1[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(a);
export const DEADLINE_MS = 2 * M.DAY;               // after the card's week ends: unknown results are void then
export const VAULT_WINDOW_MS = 3 * M.DAY;           // the Vault takes a week's file within 3 days of its end
export const wName = (w) => `W${String(w).padStart(3, "0")}.json`;
export const rName = (w) => `R${String(w).padStart(3, "0")}.json`;
/** Last week's full board: every row of week w from its L<w> parts in `dir` (part 0 names the count), in board order;
 *  null if a part is missing or not the recorder's shape. `{ final, parts, rows }`. (Capacity standard, 13 Nov.) */
export function lastRows(dir, w) {
  const p0 = readJson(dir, `L${w}.json`);
  if (!p0 || p0.v !== 1 || p0.week !== w || !Number.isInteger(p0.parts) || p0.parts < 1 || p0.parts > 1000 || !Array.isArray(p0.rows)) return null;
  const rows = [...p0.rows];
  for (let k = 1; k < p0.parts; k++) {
    const p = readJson(dir, `L${w}-${k}.json`);
    if (!p || p.v !== 1 || p.week !== w || p.part !== k || !Array.isArray(p.rows)) return null;
    rows.push(...p.rows);
  }
  return { final: p0.final === true, parts: p0.parts, rows };
}

// ── the VHP ruler switch (docs/VHP-RULER.md "Switching a game onto the ruler") ──
/** COMBO_RULER_FROM_WEEK, strictly (KRuler.switchFrom): empty/unset → null; 1 … 999999 → the week; anything else throws. */
export const rulerFrom = (v) => R.switchFrom(v === undefined || v === null ? "" : v);
/** A vault week's mode: "off", "shadow" or "on" (KRuler.rulerMode). */
export const rulerModeOf = (week, from) => R.rulerMode(week, from === null ? "" : from);
/** Is a card of this UTC day scored by the ruler? One rule for the whole card: its own day's vault week. */
export const ruledDay = (day, from) => rulerModeOf(M.weekOf(day * M.DAY), from) === "on";
/** Repo Lens #G-37: Combo's race legs read the Race's ruler cards, so Combo can't be on the ruler before the Race is.
 *  Both switches as read by rulerFrom(); null = fine. */
export function rulerPairProblem(comboFrom, raceFrom) {
  if (comboFrom === null) return null;
  if (raceFrom === null) return `COMBO_RULER_FROM_WEEK is ${comboFrom} but RACE_RULER_FROM_WEEK is unset: the Race publishes no ruler cards for Combo's race legs`;
  if (comboFrom < raceFrom) return `COMBO_RULER_FROM_WEEK (${comboFrom}) is before RACE_RULER_FROM_WEEK (${raceFrom}): Combo's race legs need the Race's ruler cards from Combo's first ruled week`;
  return null;
}
/** Why a switch change can't be made this week (KRuler.switchChange), or null. */
export const rulerChange = (prev, next, week) => R.switchChange(prev === null || prev === undefined ? "" : prev, next === null ? "" : next, week);

// ── files ──
const memo = new Map();         // each input file is read once per run (audit CC-B8); cleared by clearFiles()
export function readJson(dir, name) {
  if (!dir) return null;
  const f = path.join(dir, name);
  if (memo.has(f)) return memo.get(f);
  let v = null;
  try { if (!fs.lstatSync(f).isSymbolicLink()) v = JSON.parse(fs.readFileSync(f, "utf8")); } catch { v = null; }
  memo.set(f, v);
  return v;
}

/** A new run: forget the files read (and cleaned) by the last one. */
export function clearFiles() { memo.clear(); cleaned.clear(); }

// ── results and cards from the other recorders ──
/** A race week's races, with every card's rows checked as addresses (fix-check FC-26, as the page does: RL-32). */
const cleanCard = (c) => (c && Array.isArray(c.field) ? { ...c, field: c.field.filter((r) => r && isAddr(r.a)), paddock: (Array.isArray(c.paddock) ? c.paddock : []).filter((r) => r && isAddr(r.a)) } : null);
const cleaned = new Map();
export function raceWeek(raceDir, w) {
  const wf = readJson(raceDir, wName(w));
  if (!wf || !Array.isArray(wf.races)) return [];
  let got = cleaned.get(wf);
  if (!got) { got = wf.races.map((r) => (r && Array.isArray(r.cards) ? { ...r, cards: r.cards.map(cleanCard) } : r)); cleaned.set(wf, got); }
  return got;
}
export function raceRecord(raceDir, round) {
  return raceWeek(raceDir, M.weekOf(M.raceStart(round))).find((r) => r && r.id === M.raceId(round)) ?? null;
}
/** The Race's ruler entry for a race (its R<week>.json, the week of the race's start), or null. Only a file the Race
 *  published in an ON or SHADOW week with the same shape as bot/race-ruler.ts writes. */
export function rulerRecord(raceDir, round) {
  const w = M.weekOf(M.raceStart(round)), rf = readJson(raceDir, rName(w));
  if (!rf || rf.v !== 1 || rf.week !== w || !Array.isArray(rf.races) || (rf.mode !== "on" && rf.mode !== "shadow")) return null;
  return rf.races.find((e) => e && e.id === M.raceId(round)) ?? null;
}
/** Races of the weeks around t (the week before, of and after), for the cards in force near t. */
export const racesNear = (raceDir, t) => [-1, 0, 1].flatMap((k) => raceWeek(raceDir, M.weekOf(t) + k));
/** The race-data files hold a card taken after time t (any card): the cards up to t are then complete. */
function racesPast(raceDir, t) {
  for (const k of [0, 1]) for (const r of raceWeek(raceDir, M.weekOf(t) + k)) for (const c of (r && Array.isArray(r.cards) ? r.cards : [])) if (c && Number.isFinite(c.at) && c.at > t) return true;
  return false;
}
/** race-data is complete up to time t: it holds a card taken after t, or a final result of a race that started after
 *  t (the race recorder writes cards and results together, hourly). */
export function raceDataPast(raceDir, t) {
  if (racesPast(raceDir, t)) return true;
  for (const k of [0, 1]) for (const r of raceWeek(raceDir, M.weekOf(t) + k)) if (r && Number(r.start) > t && r.result && r.result.final === true) return true;
  return false;
}
/** A race-data file exists for the week of time t (else: an outage, never a reason to void). */
export const raceWeekKnown = (raceDir, t) => !!readJson(raceDir, wName(M.weekOf(t)))?.races;
/** Race-data has a final result for a race starting after race `round` (so a missing result is not an outage: RL-9). */
export function raceSourcePast(raceDir, round) {
  for (const k of [0, 1]) for (const r of raceWeek(raceDir, M.weekOf(M.raceStart(round)) + k)) {
    const i = r && typeof r.id === "string" ? M.parseRaceId(r.id) : null;
    if (i !== null && i > round && r.result && r.result.final === true) return true;
  }
  return false;
}
/** Repo Lens G37-1: the Race's ruler has published past race `round` (a ruler card for a later race, its week or the
 *  next), so a missing ruler card is the ruler giving up, not an outage. */
export function rulerSourcePast(raceDir, round) {
  const w = M.weekOf(M.raceStart(round));
  for (const k of [0, 1]) {
    const rf = readJson(raceDir, rName(w + k));
    if (!rf || rf.v !== 1 || rf.week !== w + k || !Array.isArray(rf.races) || (rf.mode !== "on" && rf.mode !== "shadow")) continue;
    for (const e of rf.races) { const i = e && typeof e.id === "string" ? M.parseRaceId(e.id) : null; if (i !== null && i > round && typeof e.card === "string") return true; }
  }
  return false;
}
/** Block X targets by block HEIGHT (Repo Lens FC4-2). Block X's files number their rounds by their own round size: 2,400
 *  blocks before vault week 3, 1,200 (hourly, Picks game 12) since. A Combo Block X leg keeps its 2,400-block round and
 *  is looked up by its block, X.target(round); every 2,400th block is also an hourly target. */
export function blockTargets(blockxDir, weeks) {
  const m = new Map();
  for (const w of weeks) { const wf = readJson(blockxDir, wName(w)); if (wf && Array.isArray(wf.targets)) for (const t of wf.targets) if (t && Number.isSafeInteger(t.height) && t.height > 0) m.set(t.height, t); }
  return m;
}


export function recount(legs) {
  // A miss decides (fix-check FC-2: an unresolved leg can't hide it); else any unresolved leg voids the card.
  if (legs.some((l) => l[4] === "miss" || (l[4] === "hit" && !(l[3] > 0)))) return { outcome: "miss", pts: 0 };
  if (legs.some((l) => l[4] === "unresolved")) return { outcome: "void", pts: 0 };
  const kept = legs.filter((l) => l[4] !== "void");
  if (kept.length < C.MIN_LEGS) return { outcome: "void", pts: 0 };
  if (kept.some((l) => l[4] !== "hit" || !(l[3] > 0))) return { outcome: "miss", pts: 0 };
  return { outcome: "hit", pts: C.pointsFor(kept.map((l) => l[3])) };
}


// ── scoring ──
export function makeScorer({ race: RACE, targets, head, agreed, movedInto, problems: problemsAll, errors: errorsAll, moveMargin: MOVE_MARGIN, rulerFrom: RULER_FROM = null }) {
  const EDGE_MS = 3 * M.DAY;                                          // Block X's own 3-day window
  /** Prices and scores one card in place. mode "live": a normal run. "verify": a dry re-check of a kept card, nothing
   *  logged, VHP moved counted as 0 (no chain reads), so its Block X worths are an upper bound. "moved": the same, with
   *  this run's moved-VHP reads (the lower bound). A re-check judges the deadline and the hold edge by the chain's time
   *  alone: the card was already made final by a run that saw both nodes (fix-check 3 FC3-10). */
  async function score(c, fixed, day, mode = "live") {
    const verify = mode !== "live";
    const problems = verify ? [] : problemsAll, errors = verify ? [] : errorsAll;
    const deadline = M.weekStart(M.weekOf(day * M.DAY) + 1) + DEADLINE_MS;
    const late = (agreed || verify) && head.time >= deadline;
    const legs = c.legs.map((l) => ({ code: l[0], round: l[1], producer: l[2] }));
    const ruled = ruledDay(day, RULER_FROM);
    // The price: the usable race card in force when the card was sent, once race-data is complete past that moment.
    if (!raceWeekKnown(RACE, c.time) || !raceDataPast(RACE, c.time)) {
      // An outage (no race-data, or none after the send time) never voids: wait, and alert at the deadline (FC-1, RL-9).
      (late ? errors : problems).push(`slot ${c.round}: race-data doesn't reach ${new Date(c.time).toISOString()} yet; ${c.player}'s card waits`);
      c.state = "pending"; c.pts = 0;
      return;
    }
    const send = C.priceCard(racesNear(RACE, c.time), c.time);
    if (!send) {
      // No usable race card in the 3 hours before it was sent (RL-8): it can't be priced. Void.
      c.priceAt = null; c.outcome = "void"; c.pts = 0; c.legs.forEach((l) => { l[4] = "void"; });
      if (fixed) { c.state = "final"; c.settled = c.time; }
      return;
    }
    c.priceAt = send.at;
    let ready = true, decided = 0;
    // A leg whose worth can't be checked is "unresolved": the card is void unless another leg missed (fix-check FC-1,
    // FC-2: never drop one leg because its check failed, which could turn a losing card into a hit).
    const unresolved = (l, why, alert = false) => { l[4] = "unresolved"; (alert ? errors : problems).push(`slot ${c.round}: ${c.player}'s card: ${why}; the card is void unless another leg missed`); };
    for (let i = 0; i < c.legs.length; i++) {
      const l = c.legs[i], leg = legs[i], isRace = C.FAMILY[l[0]] === "race", t = isRace ? null : targets.get(X.target(l[1])) ?? null;
      let r = isRace ? C.legResult(leg, raceRecord(RACE, l[1]), null, ruled ? { entry: rulerRecord(RACE, l[1]) } : undefined) : C.legResult(leg, null, t);
      l[4] = r;
      if (r === "unresolved") { unresolved(l, isRace ? `race ${M.raceId(l[1])} was never decided (no card, or not checked on two nodes)` : `Block X never decided who signed block ${X.target(l[1])}`); continue; }
      if (r === "pending" && ruled && isRace && raceRecord(RACE, l[1])?.result?.final === true && late)
        errors.push(`slot ${c.round}: race ${M.raceId(l[1])} is final but the Race's ruler card for it isn't published (R file); ${c.player}'s card waits`);
      if (r === "pending" && late) {
        // At the deadline: unresolved if the leg's source has published past it (it gave up on it), else its recorder
        // stopped and the card waits (RL-9). Both are errors: someone should look.
        const past = isRace ? (ruled ? rulerSourcePast(RACE, l[1]) : raceSourcePast(RACE, l[1])) : [...targets.values()].some((x) => x.height > X.target(l[1]) && x.final === true);
        if (past) { unresolved(l, `its ${isRace ? "race" : "block"} (round ${l[1]}) was never decided by the deadline`, true); continue; }
        errors.push(`slot ${c.round}: the ${isRace ? "race" : "Block X"} recorder hasn't published past a leg of ${c.player}'s card (round ${l[1]}); it waits`);
      }
      // Its price when sent: the latest usable card that doesn't flag this producer (FC-8, Block X's per-signer rule).
      const sendCard = C.priceCard(racesNear(RACE, c.time), c.time, l[2]);
      const sendWorth = sendCard ? C.priceLeg(sendCard, leg) : null;
      if (!sendCard) { l[3] = 0; if (r !== "miss") unresolved(l, `no unflagged race card priced ${l[2]} when it was sent`); continue; }
      if (!sendWorth) { l[3] = 0; continue; }                        // a horse not in the field when sent: a miss
      l[3] = sendWorth.f100;
      if (r === "pending") { ready = false; continue; }
      decided = Math.max(decided, isRace ? M.raceStart(l[1]) + M.RACE : (t?.time ?? 0));
      if (r !== "hit") continue;                                     // a miss or a void: its worth doesn't count
      if (isRace) {
        // Its race has a final result, so race-data is complete past its lock (25 minutes before the start). No
        // usable card at the lock: unresolved, as for Block X (FC-1), never the worth when sent.
        const lockAt = C.legLockTime(leg, 0), lock = C.priceCard(racesNear(RACE, lockAt), lockAt, l[2]);
        if (!lock) { unresolved(l, `no usable race card at the lock of race ${M.raceId(l[1])} for ${l[2]}`); continue; }
        l[3] = C.finalWorth(sendCard, lock, leg);
        continue;
      }
      // A Block X leg that hit: its lock card and the first card after the block, with VHP moved in added (RL-2).
      const lockAt = C.legLockTime(leg, t.time), lock = C.priceCard(racesNear(RACE, lockAt), lockAt, l[2]), after = C.cardAfter(racesNear(RACE, t.time), t.time, l[2]);
      if (!after && !raceDataPast(RACE, t.time + C.CARD_MAX_AGE_MS)) { ready = false; if (late) errors.push(`slot ${c.round}: race-data doesn't reach 3 hours after block ${t.height} yet; ${c.player}'s card waits`); continue; }
      if (!lock || !after) { unresolved(l, `no usable race card ${!lock ? "at the lock of" : "within 3 hours after"} block ${t.height} for ${l[2]}`); continue; }
      const cardH = Number.isInteger(lock.height) && lock.height > 0 && lock.height <= t.height ? lock.height : t.height - Math.ceil(Math.max(0, t.time - Number(lock.at)) / X.BLOCK_MS);
      const mv = mode === "verify" ? { moved: 0n } : await movedInto(l[2], Math.max(1, cardH - MOVE_MARGIN), t.height);
      if (mv.nonCanonical) { unresolved(l, `${mv.nonCanonical} (both nodes)`); continue; }
      if (mv.hold) {
        // One node's word never decides (BX-100); a read that keeps failing ends unresolved at Block X's 3-day edge,
        // and is an error while it holds a week's Vault file (FC-7).
        // Fix-check 2 FC2-3: the hold also ends 6 hours before the card's week's Vault window closes.
        const edge = Math.min(t.time + EDGE_MS, M.weekStart(M.weekOf(day * M.DAY) + 1) + VAULT_WINDOW_MS - 6 * 3600000);
        if (head.time > edge && (agreed || verify)) { unresolved(l, `${mv.hold}, still at the edge of the hold`, true); continue; }
        ready = false; problems.push(`slot ${c.round}: ${mv.hold} (held; tried again next run)`); continue;
      }
      const add = Number(mv.moved) / 1e8;
      l[3] = C.finalWorth(sendCard, C.withMoved(lock, l[2], add), leg, C.withMoved(after, l[2], add));
    }
    const pending = c.legs.some((l) => l[4] === "pending");
    const missed = c.legs.some((l) => l[4] === "miss" || (l[4] === "hit" && !(l[3] > 0)));
    const r = recount(c.legs);
    c.outcome = pending ? (missed ? "miss" : null) : r.outcome;
    // Final once the slot is fixed (no more changes), every leg is known and every worth is settled; or, with a leg
    // that missed, as soon as the slot is fixed (a miss always decides: fix-check 2 FC2-3).
    if (fixed && ((!pending && ready) || missed)) { c.state = "final"; c.outcome = missed ? "miss" : r.outcome; c.pts = missed ? 0 : r.pts; c.settled = decided || c.time; }
    else { c.state = "pending"; c.pts = 0; }
  }
  // Fix-check 2 FC2-1 / fix-check 3 FC3-1, FC3-2, FC3-4: a kept (published final) card is re-checked every run against
  // the race-data and Block X files, accepting exactly what an honest run can leave behind:
  //   a miss: a leg it shows as a miss must miss by its sources (a miss decides as soon as the slot is fixed, so its
  //     other legs may still have been pending, and may since have been decided either way);
  //   a hit or a void: every leg's result must be its sources'; except a Block X leg left "unresolved" by the chain
  //     (both nodes reported a non-standard transfer, or a read held to its edge), which the files alone show as a hit;
  //   a hit: its settled time, and every worth: a race leg's exactly; a Block X leg's at the worth with VHP moved
  //     counted as 0 or, if lower, exactly the worth with this run's moved-VHP reads (both ways: FC3-2).
  // "Forged" (it can't be an honest run's): an error, out of the boards, no Vault file for its week. "Unchecked" (its
  // sources don't show a result yet, e.g. a race-data outage, or the moved-VHP read failed): an error and no Vault file
  // for its week this run; it stays on the boards and is checked again next run.
  const isMiss = (l) => l[4] === "miss" || (l[4] === "hit" && !(l[3] > 0));
  async function recheck(c, day, chain = false) {
    const again = async (mode) => {
      const f = JSON.parse(JSON.stringify(c));
      f.priceAt = null; f.state = "pending"; f.outcome = null; f.pts = 0; f.settled = 0;
      f.legs.forEach((l) => { l[3] = 0; l[4] = "pending"; });
      await score(f, true, day, mode);
      return f;
    };
    const f0 = await again("verify");
    if (f0.priceAt === null && f0.outcome !== "void") return { unchecked: "race-data doesn't reach the time it was sent" };
    if (c.priceAt === null || f0.priceAt === null) return c.priceAt === f0.priceAt && f0.outcome === "void" ? null : { forged: "its price card isn't the one race-data gives" };
    if (f0.priceAt !== c.priceAt) return { forged: "its price card isn't the one race-data gives" };
    if (c.outcome === "miss") {
      const ks = c.legs.map((_, k) => k).filter((k) => isMiss(c.legs[k]));
      if (ks.some((k) => isMiss(f0.legs[k]))) return null;
      if (ks.some((k) => f0.legs[k][4] === "pending")) return { unchecked: "the leg it shows as a miss isn't decided in its sources yet" };
      return { forged: "no leg it shows as a miss misses by its sources" };
    }
    let open = false, fm0 = null;
    for (let k = 0; k < c.legs.length; k++) {
      const l = c.legs[k], f = f0.legs[k];
      if (l[4] === f[4]) continue;
      if (l[4] === "unresolved" && C.FAMILY[l[0]] === "block" && f[4] === "hit") {
        // Repo Lens FC4-1: only the chain can leave such a leg unresolved (a non-standard transfer on both nodes, or a
        // read held past its edge). The verify job (chain = true) asks it; the recorder's own re-check trusts its run.
        if (!chain) continue;
        fm0 ??= await again("moved");
        if (fm0.legs[k][4] === "unresolved") continue;
        if (fm0.state !== "final") { open = true; continue; }            // a read still holding: try again next run
        return { forged: `leg ${k + 1} is unresolved, but both nodes read the VHP moved into ${l[2]} normally` };
      }
      if (f[4] === "pending") { open = true; continue; }
      return { forged: `leg ${k + 1} is ${l[4]} but its source shows ${f[4]}` };
    }
    if (open) return { unchecked: "a leg isn't decided in its sources yet" };
    if (c.outcome !== "hit") return null;
    if (c.settled !== f0.settled) return { forged: "its settled time isn't the time its last leg was decided" };
    let fm = null;
    for (let k = 0; k < c.legs.length; k++) {
      const l = c.legs[k], f = f0.legs[k];
      if (l[3] === f[3]) continue;
      if (C.FAMILY[l[0]] === "race" || l[3] > f[3]) return { forged: `leg ${k + 1}'s worth isn't its sources'` };
      fm ??= await again("moved");
      const m = fm.legs[k];
      if (m[4] === "hit" && m[3] === l[3]) continue;
      if (m[4] !== "hit") return { unchecked: `the VHP moved into ${l[2]} can't be read this run` };
      return { forged: `leg ${k + 1}'s worth isn't its sources' (with the VHP moved in)` };
    }
    return null;
  }
  return { score, recheck, isMiss };
}
