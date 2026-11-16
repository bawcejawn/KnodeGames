// Daily Questions (game 1): its weekly file as KG parts v1 (docs/capacity/PARTS-SPEC.md), from vault week PARTS_FROM_WEEK.
//
// ONE self-contained file (node:fs, node:path, node:crypto only). The recorder imports it (and hands it the repository's
// kit/parts with useKitParts); the publish job in .github/workflows/games.yml embeds it byte for byte, with kit/parts
// before it (tools/questions-parts-embed.mjs writes both; `-- --check` and a test keep them the same), and runs main().
//
// A week from PARTS_FROM_WEEK on is the folder questions/W<NNN>/ instead of questions/W<NNN>.json:
//   manifest.json            written last; meta.seen = { hash: the part-set hash, at } (final after two matching runs an
//                            hour apart, as before)
//   wk.<h12>.json            the week's questions [id, outcome, lock] in id order; extra: { start, end, min }
//   p/<x>.<h12>.json         16 player shards (x = shardOf(address, 16)), every one always written (some may be empty):
//                            [player, stake, peak, voided, ans], ans = one character per question of the week in id
//                            order: "." no answer, "0"-"f" the option (the contract allows 2 to 16 options)
// The players list decodes back to exactly the old week file's `players` ([address, stake, peak, voided, [[id, option]…]],
// by address, answers in question order), so math.js and the publish job's Python copy of it score it unchanged.
// Weeks before PARTS_FROM_WEEK keep the old single file (a week already paid is never converted).
import fs from "node:fs";
import path from "node:path";

export const PARTS_FROM_WEEK = 6;            // vault week 6 = the week of Mon 30 Nov 2026 (Sun 29 Nov 7 PM ET)
export const GAME_SLUG = "questions";
export const SHARDS = 16;
export const SHARD_KEYS = "0123456789abcdef".split("");
export const FULL = ["wk", ...SHARD_KEYS.map((x) => `p/${x}`)];   // every part of a week, pending or final
const OPT = "0123456789abcdef";
const NONE = ".";
const QCOLS = [["id", "i"], ["outcome", "i"], ["lock", "i"]];
const PCOLS = [["player", "a"], ["stake", "n"], ["peak", "n"], ["voided", "b"], ["ans", "s"]];
const ADDR = /^1[1-9A-HJ-NP-Za-km-z]{25,34}$/;
const DIGITS = /^(0|[1-9][0-9]{0,39})$/;
const nat = (x) => Number.isSafeInteger(x) && x >= 0;
const pad = (w) => String(w).padStart(3, "0");
export const fileOf = (w) => `W${pad(w)}`;
const fail = (m) => { throw new Error(`questions parts: ${m}`); };

let kitParts = null;
/** The recorder and the tests hand in the repository's kit/parts; the publish job embeds it as globalThis.__KITPARTS. */
export function useKitParts(lib) { kitParts = lib; }
const KP = () => { const l = kitParts ?? globalThis.__KITPARTS; if (!l) fail("kit/parts isn't loaded"); return l; };

/**
 * A snapshot ({ week, start, end, min, questions, players }) as encoded parts (kit/parts encodePart results), wk first,
 * then p/0 … p/f. Refuses anything the parts can't carry exactly: an answer to a question not in the week, two answers
 * to one question, an option over 15, answers out of question order.
 */
export function encodeWeek(s) {
  const kp = KP(), file = fileOf(s.week);
  if (!nat(s.week) || !nat(s.start) || !nat(s.end) || typeof s.min !== "string" || !DIGITS.test(s.min)) fail("bad week header");
  const pos = new Map();
  let last = -1;
  for (const [i, q] of s.questions.entries()) {
    if (!Array.isArray(q) || q.length !== 3 || !q.every(nat)) fail(`question ${i}: not [id, outcome, lock]`);
    if (q[0] <= last) fail("questions not in id order or repeated");
    last = q[0]; pos.set(q[0], i);
  }
  if (s.questions.length > 64) fail("more than 64 questions in a week");
  const shards = new Map(SHARD_KEYS.map((x) => [x, []]));
  let prev = "";
  for (const [a, stake, peak, voided, answers] of s.players) {
    if (!ADDR.test(String(a)) || !(a > prev)) fail(`players not by address or repeated (${a})`);
    prev = a;
    if (!Array.isArray(answers) || !answers.length) fail(`${a}: no answers`);
    const ans = Array(s.questions.length).fill(NONE);
    let at = -1;
    for (const [qid, option] of answers) {
      const i = pos.get(qid);
      if (i === undefined) fail(`${a}: an answer to question ${qid}, which isn't in week ${s.week}`);
      if (i <= at) fail(`${a}: answers not in question order, or two answers to one question`);
      if (!Number.isSafeInteger(option) || option < 0 || option >= OPT.length) fail(`${a}: option ${option} out of range`);
      at = i; ans[i] = OPT[option];
    }
    shards.get(kp.shardOf(a, SHARDS)).push([a, String(stake), String(peak), voided ? 1 : 0, ans.join("")]);
  }
  const wk = kp.encodePart({ game: GAME_SLUG, file, part: "wk", cols: QCOLS, rows: s.questions.map((q) => [...q]), extra: { start: s.start, end: s.end, min: s.min } });
  return [wk, ...SHARD_KEYS.map((x) => kp.encodePart({ game: GAME_SLUG, file, part: `p/${x}`, cols: PCOLS, rows: shards.get(x) }))];
}

/**
 * Decoded parts (kit/parts decodePart results, or checkParts' `parts`) back to the week: { start, end, min, questions,
 * players }. Refuses a missing or extra part, a player in the wrong shard or in two, an answer string of the wrong length
 * or with a character that isn't an option, a player with no answer.
 */
export function decodeWeek(parts, week) {
  const kp = KP(), file = fileOf(week);
  const by = new Map();
  for (const p of parts) {
    const part = p.header?.part ?? p.part;
    if (by.has(part)) fail(`part ${part} twice`);
    if (p.header.game !== GAME_SLUG || p.header.file !== file) fail(`part ${part} is ${p.header.game} ${p.header.file}`);
    by.set(part, p);
  }
  if (by.size !== FULL.length || !FULL.every((x) => by.has(x))) fail(`needs exactly the parts ${FULL.join(", ")}`);
  const same = (cols, want) => JSON.stringify(cols) === JSON.stringify(want);
  const wk = by.get("wk");
  if (!same(wk.header.cols, QCOLS)) fail("wk: unexpected columns");
  const x = wk.header.extra;
  if (!x || Object.keys(x).sort().join(",") !== "end,min,start" || !nat(x.start) || !nat(x.end) || typeof x.min !== "string" || !DIGITS.test(x.min)) fail("wk: bad extra");
  const questions = wk.rows.map((r) => [r.id, r.outcome, r.lock]);
  for (let i = 0; i < questions.length; i++) { if (!questions[i].every(nat)) fail("wk: bad question"); if (i && questions[i][0] <= questions[i - 1][0]) fail("wk: questions not in id order"); }
  const players = [], seen = new Set();
  for (const k of SHARD_KEYS) {
    const p = by.get(`p/${k}`);
    if (!same(p.header.cols, PCOLS)) fail(`p/${k}: unexpected columns`);
    if (Object.keys(p.header.extra).length) fail(`p/${k}: unexpected extra`);
    for (const r of p.rows) {
      if (!ADDR.test(String(r.player))) fail(`p/${k}: a row without a player`);
      if (seen.has(r.player)) fail(`${r.player} in two rows`);
      seen.add(r.player);
      if (kp.shardOf(r.player, SHARDS) !== k) fail(`${r.player} is in shard ${k}, not its own`);
      if (typeof r.ans !== "string" || r.ans.length !== questions.length) fail(`${r.player}: answer string of the wrong length`);
      const answers = [];
      for (let i = 0; i < r.ans.length; i++) {
        const c = r.ans[i];
        if (c === NONE) continue;
        const o = OPT.indexOf(c);
        if (o < 0) fail(`${r.player}: "${c}" is not an option`);
        answers.push([questions[i][0], o]);
      }
      if (!answers.length) fail(`${r.player}: no answers`);
      players.push([r.player, r.stake, r.peak, r.voided, answers]);
    }
  }
  players.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return { start: x.start, end: x.end, min: x.min, questions, players };
}

/** The manifest's settings for a week (kit/parts buildManifest / writeParts meta). */
export function partsMeta(week, state, writtenAt, seen) {
  return { game: GAME_SLUG, file: fileOf(week), week, state, unit: "p", expect: [...FULL], shards: SHARDS, writtenAt, meta: { seen } };
}

// ───────────────────────── the publish job (embedded; runs no repository code) ─────────────────────────
/**
 * argv: <incoming questions dir> <published questions dir> <out dir for decoded week files> <held list file>
 * For every incoming W<NNN>/ folder (PARTS_FROM_WEEK on): builds the tree this run would leave published for questions/
 * (the published copy, with each incoming folder replacing its own), runs kit/parts checkParts on each incoming folder
 * and sweepFinals over questions/ once, and writes the decoded week as <out>/in/W<NNN>.json (and the published one as
 * <out>/pub/W<NNN>.json) in the old week file's shape, with seen = the manifest's meta.seen. The Python check below then
 * judges them exactly as it judges an old week file. A folder that fails is added to the held list (with an alert) and
 * its decoded file is not written, so nothing of it is published.
 */
export function main(argv = process.argv.slice(2)) {
  const kp = KP();
  const [inDir, pubDir, outDir, heldFile] = argv;
  const held = [];
  const hold = (name, why) => { held.push(`questions/${name}`, "!alert"); console.log(`::error::held, not published: questions/${name}: ${why}`); };
  const isWeekDir = (n) => /^W[0-9]{3}$/.test(n);
  const dirs = (d) => (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory() && isWeekDir(e.name)).map((e) => e.name).sort() : []);
  const inc = dirs(inDir);
  fs.mkdirSync(path.join(outDir, "in"), { recursive: true });
  fs.mkdirSync(path.join(outDir, "pub"), { recursive: true });
  // publishedRoot / localRoot (PARTS-SPEC §4 adoption checklist): two separate trees, each holding questions/.
  const tmp = fs.mkdtempSync(path.join(outDir, "trees-"));
  const pubRoot = path.join(tmp, "published"), localRoot = path.join(tmp, "local");
  fs.mkdirSync(path.join(pubRoot, "questions"), { recursive: true });
  fs.mkdirSync(path.join(localRoot, "questions"), { recursive: true });
  for (const n of dirs(pubDir)) {
    fs.cpSync(path.join(pubDir, n), path.join(pubRoot, "questions", n), { recursive: true });
    fs.cpSync(path.join(pubDir, n), path.join(localRoot, "questions", n), { recursive: true });
  }
  for (const n of inc) { fs.rmSync(path.join(localRoot, "questions", n), { recursive: true, force: true }); fs.cpSync(path.join(inDir, n), path.join(localRoot, "questions", n), { recursive: true }); }
  const decodeAt = (root, n, wantFinalFull) => {
    const week = Number(n.slice(1));
    if (week < PARTS_FROM_WEEK) throw new Error(`week ${week} is before the parts format (week ${PARTS_FROM_WEEK})`);
    const mPath = path.join(root, "questions", n, "manifest.json");
    const m = JSON.parse(fs.readFileSync(mPath, "utf8"));
    const r = kp.checkParts(path.join(root, "questions", n), { game: GAME_SLUG, file: n, week, full: m.state === "final" || wantFinalFull ? [...FULL] : undefined, publishedRoot: root === localRoot ? pubRoot : path.join(tmp, "none"), rel: `questions/${n}`, localRoot: root });
    if (!r.ok) throw new Error(r.errors.slice(0, 5).join("; "));
    const s = m.meta?.seen;
    if (!s || typeof s !== "object" || Object.keys(s).sort().join(",") !== "at,hash" || s.hash !== m.hash || !nat(s.at)) throw new Error("its manifest's meta.seen isn't { hash: the part-set hash, at }");
    if (m.unit !== "p" || m.shards !== SHARDS || JSON.stringify(m.expect) !== JSON.stringify(FULL)) throw new Error("its manifest isn't Daily Questions' layout (unit p, 16 shards, every part expected)");
    const w = decodeWeek(r.parts, week);
    return { v: 1, game: 1, week, start: w.start, end: w.end, min: w.min, final: m.state === "final", seen: { hash: s.hash, at: s.at }, questions: w.questions, players: w.players };
  };
  fs.mkdirSync(path.join(tmp, "none"), { recursive: true });
  for (const n of dirs(pubDir)) {
    try { fs.writeFileSync(path.join(outDir, "pub", `${n}.json`), JSON.stringify(decodeAt(pubRoot, n, false)) + "\n"); }
    catch (e) { console.log(`::warning::the published questions/${n} couldn't be read back (${String(e.message).slice(0, 200)}): judged as not published`); }
  }
  for (const n of inc) {
    try { fs.writeFileSync(path.join(outDir, "in", `${n}.json`), JSON.stringify(decodeAt(localRoot, n, false)) + "\n"); }
    catch (e) { hold(n, String(e.message).replace(/^(kit\/parts|questions parts): /, "").slice(0, 300)); }
  }
  const sw = kp.sweepFinals(pubRoot, localRoot);
  if (!sw.ok) for (const n of inc) if (!held.includes(`questions/${n}`)) hold(n, `the branch sweep failed: ${sw.errors.slice(0, 3).join("; ")}`);
  if (!sw.ok && !inc.length) { held.push("!alert"); console.log(`::error::Daily Questions: a published final parts folder would change: ${sw.errors.slice(0, 3).join("; ")}`); }
  fs.rmSync(tmp, { recursive: true, force: true });
  if (heldFile) fs.appendFileSync(heldFile, held.map((x) => x + "\n").join(""));
  console.log(`questions parts checked: ${inc.length} incoming folder(s), ${dirs(pubDir).length} published, held ${held.filter((x) => x !== "!alert").length}, finals swept ${sw.finals}`);
}
