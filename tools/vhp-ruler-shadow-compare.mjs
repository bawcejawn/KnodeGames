// Knode Games — the VHP Ruler chat's shadow comparison (owner, 11 Nov 2026: every game on the ruler after a shadow
// week). For one vault week, it sets each game's ruler result (published beside the real one in the shadow week, or
// the real one in an "on" week) against what the game's old rule decided, and says where they differ and why.
// Read-only: it reads a games-data and a race-data checkout, writes nothing (or only --json), sends nothing. Data only:
// nothing pays from it.
//
//   node --import tsx tools/vhp-ruler-shadow-compare.mjs --week 4 --games-data <folder> --race-data <folder> [--json <file>]
//
// Producer Race   R<week>.json placings (the ruler's 1st, 2nd, 3rd)   vs  W<week>.json standings (the handicap steps)
//                 R<week>-<type>.json: ruler-only race types, no old rule to compare (counted, not compared)
// Block X         blockx/X<week>-<d>.json targets (the ruler's multiplier, void)  vs  blockx/W<week>.json targets
//                 (the old multiplier, min(cap, top ÷ the signer's VHP), and the old voids)
// Bracket         bracket/ruler/W<week>.json rounds (the ruler's winners)  vs  its "real" (the day index's winners)
// (The kit games keep no old rule: Fantasy, Last Node and Combo launch on the ruler.)
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = new URL("..", import.meta.url).pathname, box = { window: {} };
vm.runInNewContext(fs.readFileSync(root + "blockx-math.js", "utf8"), box);
const BXM = box.window.KBlockX;
const pad = (w) => String(w).padStart(3, "0");
const readJson = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null);
const short = (a) => (typeof a === "string" ? a.slice(0, 6) + "…" : String(a));

// ── Producer Race ──
/** wf: race-data W<week>.json; rFiles: [{ name, file }] of R<week>*.json. */
export function compareRace(wf, rFiles) {
  const out = { compared: 0, sameWinner: 0, sameTop3: 0, sameOrder: 0, notYet: 0, noOld: 0, emptyField: 0, typedOnly: 0, diffs: [] };
  const old = new Map((wf?.races || []).map((r) => [r.id, r.result]));
  for (const { name, file } of rFiles) {
    if (/-\d+\.json$/.test(name)) { out.typedOnly += (file.races || []).length; continue; }
    for (const e of file.races || []) {
      if (!e.card) { out.notYet++; continue; }
      const res = old.get(e.id);
      if (!res || !res.final || res.missed || !Array.isArray(res.standings)) { out.noOld++; continue; }
      if (!e.placings.length) { out.emptyField++; continue; }
      out.compared++;
      const o3 = res.standings.slice(0, 3).map((s) => s.a), r3 = e.placings.slice(0, 3);
      const sameW = o3[0] === r3[0], sameSet = o3.length === r3.length && o3.every((a) => r3.includes(a)), sameOrd = JSON.stringify(o3) === JSON.stringify(r3);
      if (sameW) out.sameWinner++;
      if (sameSet) out.sameTop3++;
      if (sameOrd) out.sameOrder++;
      if (sameW && sameSet) continue;
      if (sameW) { out.diffs.push({ id: e.id, old: o3, ruler: r3, why: `same winner ${short(o3[0])}; 2nd and 3rd: old ${o3.slice(1).map(short).join(", ")}, ruler ${r3.slice(1).map(short).join(", ")}` }); continue; }
      const card = JSON.parse(e.card), rows = new Map(card.producers.map((p) => [p.a, p]));
      const field = card.producers.filter((p) => p.entry && !p.void && p.fpct != null).sort((x, y) => (BigInt(y.fpct) > BigInt(x.fpct) ? 1 : BigInt(y.fpct) < BigInt(x.fpct) ? -1 : x.a < y.a ? -1 : 1));
      const p = rows.get(o3[0]), rank = field.findIndex((x) => x.a === o3[0]) + 1;
      const whyOld = !p ? "not on the card" : !p.entry ? "no entry on the card (too few expected blocks, or its form or history)" : p.void ? "void on the ruler (its VHP left the band during the race)" : `fpct #${rank} of ${field.length}`;
      const oldRank = res.standings.findIndex((s) => s.a === r3[0]) + 1;
      out.diffs.push({ id: e.id, old: o3, ruler: r3, why: `old winner ${short(o3[0])}: ${whyOld}; ruler winner ${short(r3[0])}: handicap rank #${oldRank || "—"}, signed ${rows.get(r3[0])?.signed ?? "?"} vs expected ${fmtM(rows.get(r3[0])?.expected)}` });
    }
  }
  return out;
}
const fmtM = (x) => (x == null ? "?" : (Number(BigInt(x) / 10000n) / 100).toFixed(2));

// ── Block X ──
/** The old rule's multiplier for the signer from the W file's compact card { top, signerVhp }: min(cap, top ÷ VHP). */
export function oldMultiplier(card, time) {
  if (!card || !(card.top > 0)) return null;
  if (!(card.signerVhp > 0)) return 1;          // blockx-math multiplier: a signer missing from the card scores ×1 (audit BX-3)
  return Math.round(Math.min(BXM.capAt(time), card.top / card.signerVhp) * 100) / 100;
}
/** wf: blockx W<week>.json; xFiles: [{ name, file }] of X<week>-<d>.json; BX: bot/blockx-ruler.ts (multiplierOf). */
export function compareBlockX(wf, xFiles, BX) {
  const out = { targets: 0, bothScored: 0, bothVoid: 0, rulerOnlyVoid: 0, oldOnlyVoid: 0, notYet: 0, higher: 0, lower: 0, same: 0, atCap: 0, medianRatio: null, rows: [], diffs: [] };
  const old = new Map((wf?.targets || []).filter((t) => t.final).map((t) => [t.round, t]));
  const ratios = [];
  for (const { file } of xFiles) for (const e of file.targets || []) {
    out.targets++;
    const o = old.get(e.round), oVoid = !o || !!o.void || !o.card, oMult = oVoid ? null : oldMultiplier(o.card, o.time);
    if (!e.card && !e.void) { out.notYet++; out.rows.push({ round: e.round, ruler: null, old: oMult, state: "not yet" }); continue; }
    let rMult = null;
    if (!e.void && e.card) { const m = BX.multiplierOf(JSON.parse(e.card), e.signer); rMult = m === null ? null : Math.round(Number(m) / 10000) / 100; }
    const rVoid = e.void || rMult === null;
    const row = { round: e.round, height: e.height, signer: e.signer, ruler: rVoid ? null : rMult, old: oMult, state: "" };
    if (rVoid && oVoid) { out.bothVoid++; row.state = "both void"; }
    else if (rVoid) { out.rulerOnlyVoid++; row.state = "ruler void"; out.diffs.push({ round: e.round, why: `ruler void, old ×${oMult}: ${e.why || e.note || "no entry"}` }); }
    else if (oVoid) { out.oldOnlyVoid++; row.state = "old void"; out.diffs.push({ round: e.round, why: `old void (${o ? o.void || "no card" : "not in the old file"}), ruler ×${rMult}` }); }
    else {
      out.bothScored++; row.state = "both scored";
      const q = rMult / oMult; ratios.push(q);
      if (q > 1.05) out.higher++; else if (q < 1 / 1.05) out.lower++; else out.same++;
      if (rMult >= 120) out.atCap++;
      if (q > 2 || q < 0.5) out.diffs.push({ round: e.round, why: `signer ${short(e.signer)}: ruler ×${rMult}, old ×${oMult} (the ruler measures its share for its size; the old rule top ÷ its VHP, capped at ×${BXM.capAt(o.time)})` });
    }
    out.rows.push(row);
  }
  if (ratios.length) { ratios.sort((a, b) => a - b); out.medianRatio = Math.round(ratios[ratios.length >> 1] * 100) / 100; }
  return out;
}

// ── Bracket ──
/** summary: bracket/ruler/W<week>.json; wf: bracket/W<week>.json (seeds); cards: { name: card text }. */
export function compareBracket(summary, wf, cards) {
  const out = { matchups: 0, same: 0, waiting: 0, diffs: [] };
  const seeds = wf?.seeding?.seeds || [];
  (summary.rounds || []).forEach((winners, r) => {
    const real = (summary.real || [])[r] || [];
    winners.forEach((w, i) => {
      out.matchups++;
      if (real[i] === undefined || real[i] === null) { out.waiting++; return; }
      if (real[i] === w) { out.same++; return; }
      const name = (summary.cards || [])[r], card = name && cards[name] ? JSON.parse(cards[name]) : null;
      const row = (s) => { const p = card?.producers?.find((x) => x.a === seeds[s - 1]); return !p ? "not on the card" : p.void ? "void" : !p.entry ? "no entry" : `fpct ${p.fpct}`; };
      out.diffs.push({ round: r + 1, matchup: i + 1, ruler: w, old: real[i], why: `ruler: seed ${w} (${row(w)}); day index: seed ${real[i]} (${row(real[i])})` });
    });
  });
  return out;
}

// ── files ──
export function loadGames(gamesDir, raceDir, week) {
  const ls = (d, re) => (fs.existsSync(d) ? fs.readdirSync(d).filter((f) => re.test(f)).sort().map((name) => ({ name, file: JSON.parse(fs.readFileSync(path.join(d, name), "utf8")) })) : []);
  const bdir = path.join(gamesDir, "bracket", "ruler"), summary = readJson(path.join(bdir, `W${pad(week)}.json`));
  const cards = {};
  if (summary) for (const n of summary.cards || []) if (n && fs.existsSync(path.join(bdir, n))) cards[n] = fs.readFileSync(path.join(bdir, n), "utf8");
  return {
    race: { w: readJson(path.join(raceDir, `W${pad(week)}.json`)), r: ls(raceDir, new RegExp(`^R${pad(week)}(-\\d+)?\\.json$`)) },
    blockx: { w: readJson(path.join(gamesDir, "blockx", `W${pad(week)}.json`)), x: ls(path.join(gamesDir, "blockx"), new RegExp(`^X${pad(week)}-[0-6]\\.json$`)) },
    bracket: { w: readJson(path.join(gamesDir, "bracket", `W${pad(week)}.json`)), summary, cards },
  };
}

const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : "—");
export function render(week, { race, blockx, bracket }) {
  const L = [`# Ruler shadow vs old rule, vault week ${week}`, ""];
  if (race) {
    L.push(`## Producer Race (6-hour race)`, `- Compared: ${race.compared} races. Same winner: ${race.sameWinner} (${pct(race.sameWinner, race.compared)}). Same top three: ${race.sameTop3} (${pct(race.sameTop3, race.compared)}); same order: ${race.sameOrder}.`,
      `- Not yet (no ruler card): ${race.notYet}. No old result: ${race.noOld}. Empty ruler field: ${race.emptyField}. Ruler-only race types: ${race.typedOnly} races.`);
    for (const d of race.diffs.slice(0, 20)) L.push(`  - ${d.id}: ${d.why}`);
    if (race.diffs.length > 20) L.push(`  - … and ${race.diffs.length - 20} more (--json has them all)`);
    L.push("");
  } else L.push("Producer Race: no R file for this week.", "");
  if (blockx && blockx.targets) {
    L.push(`## Who Signs Block X`, `- Targets: ${blockx.targets}. Both scored: ${blockx.bothScored}; both void: ${blockx.bothVoid}; ruler void only: ${blockx.rulerOnlyVoid}; old void only: ${blockx.oldOnlyVoid}; not yet: ${blockx.notYet}.`,
      `- Where both scored, the ruler's multiplier is higher on ${blockx.higher}, lower on ${blockx.lower}, about the same (±5%) on ${blockx.same}; median ruler ÷ old ${blockx.medianRatio ?? "—"}; at the ×120 cap: ${blockx.atCap}.`);
    for (const d of blockx.diffs.slice(0, 20)) L.push(`  - target ${d.round}: ${d.why}`);
    if (blockx.diffs.length > 20) L.push(`  - … and ${blockx.diffs.length - 20} more`);
    L.push("");
  } else L.push(`Block X: no ruler day files for week ${week} (its shadow starts in vault week 4, Sun 15 Nov 7 PM ET).`, "");
  if (bracket) {
    L.push(`## Producer Bracket`, `- Matchups: ${bracket.matchups}. Same winner as the day index: ${bracket.same} (${pct(bracket.same, bracket.matchups - bracket.waiting)}). Waiting: ${bracket.waiting}.`);
    for (const d of bracket.diffs) L.push(`  - round ${d.round}, matchup ${d.matchup}: ${d.why}`);
    L.push("");
  } else L.push(`Bracket: no ruler summary for week ${week} (its shadow starts with week 4's first matchup day, Tue 17 Nov).`, "");
  return L.join("\n");
}

async function main() {
  const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  const week = Number(opt("--week")), g = opt("--games-data"), rd = opt("--race-data");
  if (!Number.isSafeInteger(week) || !g || !rd) { console.error("usage: node --import tsx tools/vhp-ruler-shadow-compare.mjs --week 4 --games-data <folder> --race-data <folder> [--json <file>]"); process.exit(2); }
  const BX = await import("../bot/blockx-ruler.ts");
  const x = loadGames(g, rd, week);
  const res = {
    race: x.race.r.length ? compareRace(x.race.w, x.race.r) : null,
    blockx: x.blockx.x.length ? compareBlockX(x.blockx.w, x.blockx.x, BX) : null,
    bracket: x.bracket.summary ? compareBracket(x.bracket.summary, x.bracket.w, x.bracket.cards) : null,
  };
  console.log(render(week, res));
  if (opt("--json")) fs.writeFileSync(opt("--json"), JSON.stringify({ week, ...res }, null, 1) + "\n");
}
if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) main();
