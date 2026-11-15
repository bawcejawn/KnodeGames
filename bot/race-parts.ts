/**
 * Race files in KG parts v1 (kit/parts, docs/capacity/PARTS-SPEC.md): each logical file the Race publishes (W, T, R,
 * R-t and board.json) <-> a parts folder. Pure: no chain, no clock. The recorder writes the folder (the source of
 * truth) and, while it is small, the old single file as a compat copy; readers call readRaceFile(), which prefers the
 * folder and falls back to the old file. The publish job runs the same reassembly (inline) and its full recompute on it.
 *
 *   W<www>/   wk = {v, week, start, end}; r001…r028 = one 6-hour race each (extra: the race without its picks;
 *             rows: its picks, with i = the original order, which the tie rule D-152 reads)
 *   T<www>/   wk = {v, week, start, end}; d1…d7 = the ledger hours of that UTC day and the typed races starting that day
 *   R<www>/, R<www>-<t>/   wk = {v, week, rulerFrom, mode, shadow}; d1…d7 = that day's entries (cards unchanged)
 *   board/    wk = {v, updated, section headers}; top = the first 100 rows of each section; p/<x> = 16 per-player shards
 *
 * Rows hold integers and addresses only (the kit's rule); every float (VHP, steps, a race's line) stays in `extra`.
 */
import * as K from "../kit/parts/parts.inline.mjs";
import fs from "node:fs";
import path from "node:path";

export const GAME = "race";
const DAY = 86400000;
const SIX = 6 * 3600000;
export const BOARD_SECTIONS = ["today", "week", "lastWeek", "allTime"] as const;
export const BOARD_TOP = 100;
export const SHARDS = 16;

type Enc = ReturnType<typeof K.encodePart>;
export type Encoded = { meta: { game: string; file: string; week: number; state: "pending" | "final"; unit: string; expect: string[]; shards: number }; parts: Enc[] };

const pad3 = (n: number) => String(n).padStart(3, "0");
const dayPart = (start: number, t: number) => `d${Math.floor((t - start) / DAY) + 1}`;
const PICK_COLS = [["i", "i"], ["who", "a"], ["horse", "a"], ["at", "i"], ["w", "i"], ["x", "i"], ["s", "i"]];
const TPICK_COLS = [["race", "s"], ...PICK_COLS];
const NONE = [["n", "i"]];   // header-only parts: the kit needs one column; they hold no rows
const isAddr = (v: unknown) => typeof v === "string" && /^1[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(v);

/** Picks -> rows. Old 5-field picks (before Show) keep 5 fields: s = -1 marks "no 6th field". */
function pickRows(picks: any[], race?: string) {
  return picks.map((p, i) => {
    if (!Array.isArray(p) || (p.length !== 5 && p.length !== 6) || !isAddr(p[0]) || !isAddr(p[1])) throw new Error(`race-parts: ${race ?? ""} pick ${i} is not [who, horse, at, win, x(, show)]`);
    const r = [i, p[0], p[1], p[2], p[3], p[4], p.length === 6 ? p[5] : -1];
    return race === undefined ? r : [race, ...r];
  });
}
function rowsToPicks(rows: any[]): any[] {
  return [...rows].sort((x, y) => x.i - y.i).map((r) => (r.s === -1 ? [r.who, r.horse, r.at, r.w, r.x] : [r.who, r.horse, r.at, r.w, r.x, r.s]));
}
/**
 * An object kept byte for byte: its JSON text with the picks taken out (they go in rows), and where the picks key sat,
 * so the reassembled file is the very same text as the old single file (pk = -1: no picks key).
 */
function keep(o: any, picksAt?: (o: any) => any) {
  const res = picksAt ? picksAt(o) : null;
  if (!res || typeof res !== "object" || Array.isArray(res) || !("picks" in res)) return { text: JSON.stringify(o), pk: -1 };
  const keys = Object.keys(res), pk = keys.indexOf("picks");
  const { picks, ...rest } = res;
  return { text: JSON.stringify(o, (k, v) => (v === res ? rest : v)), pk };
}
function restore(x: { text: string; pk: number }, picks: () => any[], picksAt: (o: any) => any, setAt: (o: any, v: any) => void) {
  const o = JSON.parse(x.text);
  if (x.pk < 0) return o;
  const res = picksAt(o), ent = Object.entries(res);
  ent.splice(x.pk, 0, ["picks", picks()]);
  setAt(o, Object.fromEntries(ent));
  return o;
}
const resOf = (o: any) => o.result;
const setRes = (o: any, v: any) => { o.result = v; };
type Part = { part: string; header: any; rows: any[] };

// ── W ──
export function encodeW(w: any, state: "pending" | "final" = "pending"): Encoded {
  const file = `W${pad3(w.week)}`, parts: Enc[] = [];
  const { races, ...head } = w;
  parts.push(K.encodePart({ game: GAME, file, part: "wk", t0: w.start, cols: NONE, rows: [], extra: { head: JSON.stringify(head), n: races.length } }));
  races.forEach((r: any, i: number) => {
    const n = Math.floor((r.start - w.start) / SIX) + 1, k = keep(r, resOf);
    parts.push(K.encodePart({ game: GAME, file, part: `r${pad3(n)}`, t0: r.start, cols: PICK_COLS, rows: k.pk >= 0 ? pickRows(r.result.picks, r.id).map((x: any[]) => x.slice(1)) : [], extra: { ...k, i } }));
  });
  const expect = parts.filter((p) => p.part !== "wk").map((p) => p.part);
  return { meta: { game: GAME, file, week: w.week, state, unit: "r", expect, shards: 0 }, parts };
}
export function decodeW(parts: Part[]): any {
  const wk = parts.find((p) => p.part === "wk")!.header.extra;
  const races = parts.filter((p) => /^r\d+$/.test(p.part)).sort((a, b) => a.header.extra.i - b.header.extra.i)
    .map((p) => restore(p.header.extra, () => rowsToPicks(p.rows), resOf, setRes));
  if (races.length !== wk.n) throw new Error(`race-parts: W has ${races.length} races, its header says ${wk.n}`);
  return { ...JSON.parse(wk.head), races };
}

// ── T ──
export function encodeT(t: any, state: "pending" | "final" = "pending"): Encoded {
  const file = `T${pad3(t.week)}`, parts: Enc[] = [];
  const { hours: H, races: Rs, ...head } = t;
  parts.push(K.encodePart({ game: GAME, file, part: "wk", t0: t.start, cols: NONE, rows: [], extra: { head: JSON.stringify(head), keys: Object.keys(t), nh: H.length, nr: Rs.length } }));
  const days = new Map<string, { hours: any[]; races: any[]; rows: any[] }>();
  const day = (k: string) => days.get(k) ?? (days.set(k, { hours: [], races: [], rows: [] }), days.get(k)!);
  H.forEach((h: any, i: number) => day(dayPart(t.start, h.t)).hours.push({ text: JSON.stringify(h), i }));
  Rs.forEach((r: any, i: number) => {
    const d = day(dayPart(t.start, r.start)), k = keep(r, resOf);
    d.races.push({ ...k, id: r.id, i });
    if (k.pk >= 0) d.rows.push(...pickRows(r.result.picks, r.id));
  });
  for (const [k, d] of [...days].sort((a, b) => (a[0] < b[0] ? -1 : 1)))
    parts.push(K.encodePart({ game: GAME, file, part: k, t0: t.start, cols: TPICK_COLS, rows: d.rows, extra: { hours: d.hours, races: d.races } }));
  return { meta: { game: GAME, file, week: t.week, state, unit: "d", expect: [...days.keys()].sort(), shards: 0 }, parts };
}
export function decodeT(parts: Part[]): any {
  const wk = parts.find((p) => p.part === "wk")!.header.extra, hours: any[] = [], races: any[] = [];
  for (const p of parts.filter((x) => /^d[1-7]$/.test(x.part))) {
    const byRace = new Map<string, any[]>();
    for (const r of p.rows) (byRace.get(r.race) ?? (byRace.set(r.race, []), byRace.get(r.race)!)).push(r);
    for (const h of p.header.extra.hours) hours.push({ i: h.i, v: JSON.parse(h.text) });
    for (const r of p.header.extra.races) races.push({ i: r.i, v: restore(r, () => rowsToPicks(byRace.get(r.id) ?? []), resOf, setRes) });
  }
  if (hours.length !== wk.nh || races.length !== wk.nr) throw new Error("race-parts: T parts don't hold the header's hours and races");
  const out: any = JSON.parse(wk.head);
  out.hours = hours.sort((a, b) => a.i - b.i).map((x) => x.v);
  out.races = races.sort((a, b) => a.i - b.i).map((x) => x.v);
  return Object.fromEntries(wk.keys.map((k: string) => [k, out[k]]));
}

// ── R and R-t ── (an entry's day: its window start if it has one, else its race start from its id)
function entryStart(e: any, weekStart: number): number {
  if (Array.isArray(e.window) && Number.isFinite(e.window[0])) return e.window[0];
  const m = /(\d{4}-\d{2}-\d{2})(T(\d{2}))?$/.exec(String(e.id));
  return m ? Date.parse(`${m[1]}T${m[3] ?? "00"}:00:00Z`) : weekStart;
}
export function encodeR(r: any, weekStart: number, type = 0, state: "pending" | "final" = "pending"): Encoded {
  const file = type ? `R${pad3(r.week)}-${type}` : `R${pad3(r.week)}`, parts: Enc[] = [];
  const { races, ...head } = r;
  parts.push(K.encodePart({ game: GAME, file, part: "wk", t0: weekStart, cols: NONE, rows: [], extra: { head: JSON.stringify(head), keys: Object.keys(r), n: races.length } }));
  const days = new Map<string, any[]>();
  races.forEach((e: any, i: number) => {
    const k = dayPart(weekStart, Math.max(weekStart, Math.min(weekStart + 7 * DAY - 1, entryStart(e, weekStart))));
    (days.get(k) ?? (days.set(k, []), days.get(k)!)).push({ text: JSON.stringify(e), i });
  });
  for (const [k, es] of [...days].sort((a, b) => (a[0] < b[0] ? -1 : 1)))
    parts.push(K.encodePart({ game: GAME, file, part: k, t0: weekStart, cols: NONE, rows: [], extra: { entries: es } }));
  return { meta: { game: GAME, file, week: r.week, state, unit: "d", expect: [...days.keys()].sort(), shards: 0 }, parts };
}
export function decodeR(parts: Part[]): any {
  const wk = parts.find((p) => p.part === "wk")!.header.extra;
  const es = parts.filter((x) => /^d[1-7]$/.test(x.part)).flatMap((p) => p.header.extra.entries).sort((a: any, b: any) => a.i - b.i);
  if (es.length !== wk.n) throw new Error("race-parts: R parts don't hold the header's entries");
  const out: any = JSON.parse(wk.head);
  out.races = es.map((x: any) => JSON.parse(x.text));
  return Object.fromEntries(wk.keys.map((k: string) => [k, out[k]]));
}

// ── board.json ── (rows [sec, i, a, j]: j = [the row's keys in order, its values], the address kept in the a column)
const BCOLS = [["sec", "i"], ["i", "i"], ["a", "a"], ["j", "j"]];
function rowText(r: any) { const keys = Object.keys(r); return [keys, keys.map((k) => (k === "a" ? null : r[k]))]; }
function rowBack(a: string, j: any) { const [keys, vals] = j; return Object.fromEntries(keys.map((k: string, i: number) => [k, k === "a" ? a : vals[i]])); }
export function encodeBoard(b: any, week: number): Encoded {
  const file = "board", parts: Enc[] = [], all: any[][] = [];
  const skel: any = {};
  for (const k of Object.keys(b)) {
    const si = (BOARD_SECTIONS as readonly string[]).indexOf(k);
    if (si < 0 || !b[k] || !Array.isArray(b[k].rows)) { skel[k] = b[k]; continue; }
    const keys = Object.keys(b[k]), { rows, ...h } = b[k];
    skel[k] = { _sec: { h, keys, n: rows.length } };
    rows.forEach((r: any, i: number) => all.push([si, i, r.a, rowText(r)]));
  }
  parts.push(K.encodePart({ game: GAME, file, part: "wk", t0: 0, cols: NONE, rows: [], extra: { text: JSON.stringify(skel) } }));
  parts.push(K.encodePart({ game: GAME, file, part: "top", t0: 0, cols: BCOLS, rows: all.filter((r) => r[1] < BOARD_TOP), extra: {} }));
  const shards = new Map<string, any[][]>();
  for (const r of all) { const k = K.shardOf(r[2], SHARDS); (shards.get(k) ?? (shards.set(k, []), shards.get(k)!)).push(r); }
  for (const [k, rows] of [...shards].sort((a, b) => (a[0] < b[0] ? -1 : 1))) parts.push(K.encodePart({ game: GAME, file, part: `p/${k}`, t0: 0, cols: BCOLS, rows, extra: {} }));
  return { meta: { game: GAME, file, week, state: "pending", unit: "p", expect: [], shards: SHARDS }, parts };
}
/** The whole board from its shards (`top` alone serves pages that need only the first 100 rows of each section). */
export function decodeBoard(parts: Part[], only: "all" | "top" = "all"): any {
  const skel = JSON.parse(parts.find((p) => p.part === "wk")!.header.extra.text);
  const rows = only === "top" ? parts.find((p) => p.part === "top")!.rows : parts.filter((p) => p.part.startsWith("p/")).flatMap((p) => p.rows);
  const out: any = {};
  for (const k of Object.keys(skel)) {
    const s = skel[k];
    if (!s || typeof s !== "object" || !s._sec) { out[k] = s; continue; }
    const si = (BOARD_SECTIONS as readonly string[]).indexOf(k);
    const mine = rows.filter((r: any) => r.sec === si).sort((x: any, y: any) => x.i - y.i).map((r: any) => rowBack(r.a, r.j));
    if (only === "all" && mine.length !== s._sec.n) throw new Error(`race-parts: board ${k} has ${mine.length} rows, its header says ${s._sec.n}`);
    const sec: any = { ...s._sec.h, rows: mine };
    out[k] = Object.fromEntries(s._sec.keys.map((kk: string) => [kk, sec[kk]]));
  }
  return out;
}

// ── folders ──
type Kind = "W" | "T" | "R" | "board";
export function kindOf(base: string): Kind | null {
  if (/^W\d{3}$/.test(base)) return "W";
  if (/^T\d{3}$/.test(base)) return "T";
  if (/^R\d{3}(-[1-4])?$/.test(base)) return "R";
  if (base === "board") return "board";
  return null;
}
/** Decodes a parts folder (already proven complete by K.checkParts, or read back from this run's own write). */
export function decodeFolder(dir: string): any {
  const base = path.basename(dir), kind = kindOf(base);
  if (!kind) throw new Error(`race-parts: ${base} is not a Race file`);
  const m = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
  if (m.game !== GAME || m.file !== base) throw new Error(`race-parts: ${dir}/manifest.json is not ${GAME} ${base}`);
  const parts = m.parts.map((p: any) => {
    const text = fs.readFileSync(path.join(dir, p.name), "utf8");
    const d = K.decodePart(text);
    if (d.header.part !== p.part || d.header.file !== base) throw new Error(`race-parts: ${dir}/${p.name} is not part ${p.part} of ${base}`);
    return { part: p.part, header: d.header, rows: d.rows };
  });
  return kind === "W" ? decodeW(parts) : kind === "T" ? decodeT(parts) : kind === "R" ? decodeR(parts) : decodeBoard(parts);
}
/**
 * Reads a Race file from a data folder: its parts folder <dir>/<base>/ if there is one (manifest.json), else the old
 * <dir>/<base>.json. null if neither exists. This is the one call other games use (Block X, Golf, Names, Stats).
 */
export function readRaceFile(dir: string, base: string): any | null {
  const folder = path.join(dir, base);
  if (fs.existsSync(path.join(folder, "manifest.json"))) return decodeFolder(folder);
  const f = path.join(dir, `${base}.json`);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null;
}
/** The part-set hash of a written folder (replaces the single-file hash for a parts-format file). */
export function folderHash(dir: string): string | null {
  const f = path.join(dir, "manifest.json");
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")).hash : null;
}
export const COMPAT_MAX_BYTES = K.WARN_BYTES;   // a compat copy is written only while it fits under 60% of the cap
