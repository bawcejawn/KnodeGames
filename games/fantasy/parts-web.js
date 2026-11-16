// Fantasy Producers, the page side of the kit's day parts ("parts": "d"): a week published as W<NNN>/ (manifest.json +
// content-addressed parts) rebuilt into the same object as the one-file W<NNN>.json, so the page reads either. It
// mirrors kit/publish/check.inline.mjs partsToWeek (the shape the publish check itself rebuilds and checks); the page
// only DISPLAYS it, so the publish check's shard and placement checks are left to the publish job, but anything that
// doesn't fit the shape is refused (null), never half-shown. Browser and Node: no imports, fetch is passed in.

const ROW_COLS = JSON.stringify([["player", "a"], ["round", "i"], ["pts", "i"], ["at", "i"]]);
const PLAYER_COLS = JSON.stringify([["player", "a"], ["stake", "n"], ["peak", "n"], ["voided", "b"]]);
const OPT_KEYS = ["inputs", "extras", "cards", "fallbacks", "season", "vhpTo"];
const byAddr = (a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);

/** One part's text → { part, cols, extra, rows: [{ col: value }] }, addresses resolved, "j" values parsed. */
export function decodePartText(text) {
  const o = JSON.parse(text);
  if (!o || o.kgparts !== 1 || !Array.isArray(o.cols) || !Array.isArray(o.a) || !Array.isArray(o.rows)) throw new Error("not a kgparts v1 part");
  const rows = o.rows.map((r) => {
    if (!Array.isArray(r) || r.length !== o.cols.length) throw new Error(`${o.part}: bad row`);
    const out = {};
    o.cols.forEach(([n, t], i) => {
      if (t === "a") { if (!Number.isInteger(r[i]) || r[i] < -1 || r[i] >= o.a.length) throw new Error(`${o.part}: bad address index`); out[n] = r[i] === -1 ? null : o.a[r[i]]; }
      else out[n] = t === "j" ? JSON.parse(r[i]) : r[i];
    });
    return out;
  });
  return { part: o.part, cols: o.cols, extra: o.extra || {}, rows };
}

/** The decoded parts of one week → the week object (v, game, week, start, end, min, state, seen, rounds, players, …). */
export function weekFromParts(parts) {
  const wk = parts.find((p) => p.part === "wk");
  if (!wk) throw new Error("no wk part");
  const x = wk.extra;
  if (!x || !Array.isArray(x.head) || x.head.length !== 9 || typeof x.opt !== "string") throw new Error("wk part: bad head");
  const opt = JSON.parse(x.opt);
  const [v, game, week, start, end, min, state, sh, sa] = x.head;
  const dcols = Array.isArray(x.display) ? x.display : [];
  const players = [], carry = [], next = [];
  for (const p of parts.filter((q) => q.part.startsWith("p/"))) {
    if (JSON.stringify(p.cols) !== PLAYER_COLS) throw new Error(`${p.part}: bad columns`);
    for (const r of p.rows) players.push([r.player, r.stake, r.peak, r.voided]);
    const st = (xs) => (xs || []).map((c) => [c[0], JSON.parse(c[1])]);
    if (x.carry) { carry.push(...st(p.extra.carry)); next.push(...st(p.extra.next)); }
  }
  players.sort(byAddr);
  if (players.length !== x.players) throw new Error(`${players.length} players, wk says ${x.players}`);
  const idx = new Map(players.map((p, i) => [p[0], i]));
  const rounds = new Array(x.rounds);
  for (const p of parts.filter((q) => /^(d[1-7]|r\d{3,5})$/.test(q.part))) {
    if (JSON.stringify(p.cols) !== JSON.stringify([JSON.parse(ROW_COLS), dcols].flat())) throw new Error(`${p.part}: bad columns`);
    const meta = p.extra.rounds;
    if (!Array.isArray(meta)) throw new Error(`${p.part}: no rounds`);
    for (const [ri, id, day, fun, status] of meta) {
      if (!Number.isInteger(ri) || ri < 0 || ri >= x.rounds || rounds[ri]) throw new Error(`${p.part}: round index ${ri}`);
      rounds[ri] = [id, day, fun, status, []];
    }
    for (const r of p.rows) {
      const rr = rounds[r.round];
      if (!rr || !idx.has(r.player)) throw new Error(`${p.part}: bad row`);
      rr[4].push(r.pts > 0 ? [r.player, r.pts, r.at] : [r.player, r.pts]);
    }
  }
  for (let i = 0; i < x.rounds; i++) if (!rounds[i]) throw new Error(`round ${i} missing`);
  for (const rr of rounds) rr[4] = rr[4].sort(byAddr).map((y) => (y.length === 3 ? [idx.get(y[0]), y[1], y[2]] : [idx.get(y[0]), y[1]]));
  const j = { v, game, week, start, end, min, state, seen: { hash: sh, at: sa }, rounds, players };
  for (const k of ["inputs", "carry", "next", "extras", "cards", "fallbacks", "season"]) {
    if (k === "carry" || k === "next") { if (x.carry) j[k] = (k === "carry" ? carry : next).sort(byAddr); continue; }
    if (opt[k] !== undefined) j[k] = opt[k];
  }
  for (const k of OPT_KEYS) if (opt[k] !== undefined && j[k] === undefined) j[k] = opt[k];
  return j;
}

/** Loads a week from `base` (…/fantasy/W004): the parts folder if it has a manifest, else null. getText(url) → text
 *  or throws. A week whose parts don't load or fit is null (the page shows it as not published yet). */
export async function loadWeekParts(getText, base) {
  let m;
  try { m = JSON.parse(await getText(`${base}/manifest.json`)); } catch { return null; }
  if (!m || m.kgparts !== 1 || !Array.isArray(m.parts)) return null;
  try {
    const parts = await Promise.all(m.parts.map(async (e) => decodePartText(await getText(`${base}/${e.name}`))));
    return weekFromParts(parts);
  } catch { return null; }
}
