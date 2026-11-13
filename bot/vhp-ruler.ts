/**
 * Knode Games — the VHP ruler's recorder (design .ai/standards/VHP_RULER.md §7, D-111, D-112). READ-ONLY: holds no
 * key, sends nothing, costs no Mana (read calls only).
 *
 * Each run (hourly, .github/workflows/vhp-ruler.yml):
 *  1. Takes the newest published hour file (VHP_PREV/h/<n>.json).
 *  2. Reads every block of the next block-hours that are irreversible on BOTH nodes (RPC and RPC_CHECK): signer, id,
 *     the burn from its signer, every other VHP event (reverted transactions skipped). The two nodes must agree
 *     exactly, or nothing is written (tried again next run).
 *  3. Reads, on both nodes, balance_of and effective_balance_of of every anchored address (each pinned to one head
 *     block, D-112), then waits until those blocks are irreversible and reads the blocks up to them (the tail) on
 *     both nodes; the block ids seen at read time must be the irreversible ones (no fork in between).
 *  4. Writes the new hour files (vhp-data.js makeHour) to VHP_OUT/h/, each checked with checkHour before it's kept,
 *     and rolls up old days (VHP_OUT/d/, VHP_OUT/remove.txt) — the publish job re-checks everything.
 *
 *   RPC, RPC_CHECK, VHP_PREV, VHP_OUT, VHP_MAX_HOURS (default 6), VHP_KEEP_DAYS (default 30; at least 26: a 6-day race's card, Repo Lens #G-9)
 *   npx tsx bot/vhp-ruler.ts
 */
import { Contract, Provider, Serializer, utils } from "koilib";
import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { withRetry, sleep } from "../common.ts";
import { tokenAbi } from "./token-abi.ts";
await import("../vhp-ruler.js");
await import("../vhp-data.js");
const R: any = (globalThis as any).KRuler;
const D: any = (globalThis as any).KVhpData;

export type Ev = { h: number; k: "m" | "t" | "b"; f: string; t: string; v: string };
export type Blk = { h: number; id: string; s: string; burn: string; events: Ev[] };
export type Read = { h: number; id: string; bal: string; eff: string };
export interface RulerNode {
  name: string;
  head(): Promise<{ height: number; id: string; lib: number }>;
  /** blocks from … to (irreversible), in order */
  blocks(from: number, to: number): Promise<Blk[]>;
  /** balance_of and effective_balance_of of a, both at one head block; eff "" if the node can't answer */
  read(a: string): Promise<Read>;
  /** the id of block h */
  blockId(h: number): Promise<string>;
}

// ── a real node (koilib) ──
const ser = new Serializer((utils.tokenAbi as any).koilib_types);
const KIND: Record<string, "m" | "t" | "b"> = { transfer_event: "t", mint_event: "m", burn_event: "b" };
async function decode(x: any, h: number): Promise<Ev | null> {
  if (x.source !== R.VHP_CONTRACT) return null;
  const m = /(transfer_event|mint_event|burn_event)$/.exec(String(x.name || ""));
  if (!m) return null;   // approve and other events don't move balances
  const d: any = await ser.deserialize(x.data, `token.${m[1]}`);   // a VHP event that can't be read stops the run
  const v = String(d.value ?? "0");
  if (!/^[0-9]+$/.test(v)) throw new Error(`block ${h}: bad VHP value`);
  // #D-10 L-6: a missing field must stop the run with a clear message, never become the address "undefined"
  if ((m[1] !== "mint_event" && typeof d.from !== "string") || (m[1] !== "burn_event" && typeof d.to !== "string")) throw new Error(`block ${h}: a VHP ${m[1]} without its address`);
  return { h, k: KIND[m[1]], f: m[1] === "mint_event" ? "" : String(d.from), t: m[1] === "burn_event" ? "" : String(d.to), v };
}
/** One block's ruler record from a block item with its receipt: exactly one block-level burn from its signer. */
export async function blockRecord(it: any): Promise<Blk> {
  const h = Number(it.block_height), s = String(it.block.header.signer), id = String(it.block_id);
  if (!/^0x[0-9a-f]+$/.test(id)) throw new Error(`block ${h}: the id isn't lowercase 0x-hex (${id.slice(0, 12)}…)`);
  const rc = it.receipt || {}, burns: string[] = [], events: Ev[] = [];
  for (const x of rc.events || []) {
    const e = await decode(x, h); if (!e) continue;
    if (e.k === "b" && e.f === s) burns.push(e.v); else events.push(e);
  }
  for (const t of rc.transaction_receipts || []) {
    if (t.reverted) continue;   // a reverted transaction's events changed nothing (audit A-4)
    for (const x of t.events || []) { const e = await decode(x, h); if (e) events.push(e); }
  }
  if (burns.length !== 1 || burns[0] === "0") throw new Error(`block ${h}: expected exactly one VHP burn from its signer, found ${burns.length}`);
  return { h, id, s, burn: burns[0], events };
}
export function chainNode(url: string, name: string): RulerNode {
  const p = new Provider([url]);
  const abi: any = JSON.parse(JSON.stringify(tokenAbi));
  abi.methods.effective_balance_of = { ...abi.methods.balance_of, entry_point: 0x629f31e6 };   // vhp contract entry point
  const vhp = new Contract({ id: R.VHP_CONTRACT, abi, provider: p });
  const headNow = async () => { const h: any = await withRetry(`${name} head`, () => p.getHeadInfo()); return { id: String(h.head_topology.id), height: Number(h.head_topology.height), lib: Number(h.last_irreversible_block) }; };
  return {
    name,
    head: headNow,
    async blockId(h) {
      const hd = await headNow();
      const res: any = await withRetry(`${name} block ${h}`, () => p.call("block_store.get_blocks_by_height", { head_block_id: hd.id, ancestor_start_height: String(h), num_blocks: 1, return_block: false, return_receipt: false }));
      const it = res?.block_items?.[0]; if (!it || Number(it.block_height) !== h) throw new Error(`${name}: block ${h} not returned`);
      return String(it.block_id);
    },
    async blocks(from, to) {
      const hd = await headNow();
      if (to > hd.lib) throw new Error(`${name}: block ${to} isn't irreversible yet`);
      const items: any[] = new Array(to - from + 1), queue: [number, number][] = [];
      for (let s = from; s <= to; s += 50) queue.push([s, Math.min(to, s + 49)]);
      const worker = async () => {   // 4 reads at a time (audit A-2)
        while (queue.length) {
          const [s, e] = queue.shift()!; let k = s;
          while (k <= e) {
            const res: any = await withRetry(`${name} blocks at ${k}`, () => p.call("block_store.get_blocks_by_height", { head_block_id: hd.id, ancestor_start_height: String(k), num_blocks: e - k + 1, return_block: true, return_receipt: true }));
            const got = res?.block_items ?? [];
            if (!got.length) throw new Error(`${name}: no blocks returned at ${k}`);
            for (const it of got) { if (Number(it.block_height) !== k || k > e) throw new Error(`${name}: blocks out of order at ${k}`); items[k - from] = it; k++; }
          }
        }
      };
      await Promise.all(Array.from({ length: 4 }, worker));
      const out: Blk[] = [];
      for (const it of items) out.push(await blockRecord(it));
      return out;
    },
    async read(a) {
      for (let t = 0; t < 8; t++) {
        const h1 = await headNow();
        const r: any = await withRetry(`${name} VHP of ${a}`, () => (vhp.functions as any).balance_of({ owner: a }));
        if (!r || typeof r !== "object" || !("result" in r)) throw new Error(`${name}: no answer reading the VHP of ${a}`);
        // #D-10 M-4: retried with a timeout; if the node still can't answer, the run stops and writes nothing (tried
        // again next run; after ~20 h the recorder chains hours, which need no reads), never a stored "" for good
        const e: any = await withRetry(`${name} effective VHP of ${a}`, () => (vhp.functions as any).effective_balance_of({ owner: a }), 4);
        if (!e || typeof e !== "object" || !("result" in e)) throw new Error(`${name}: no effective balance for ${a}`);
        const eff = String(e.result?.value ?? "0");
        const h2 = await headNow();
        if (h1.id === h2.id) return { h: h1.height, id: h1.id, bal: String(r.result?.value ?? "0"), eff };
      }
      throw new Error(`${name}: the head kept moving while reading the VHP of ${a}`);
    },
  };
}

// ── the recording logic (any two nodes; the tests drive it with simulated ones) ──
const key = (b: Blk) => JSON.stringify([b.h, b.id, b.s, b.burn, b.events]);
/** the same blocks on both nodes, or an error */
export async function blocksOnBoth(A: RulerNode, B: RulerNode, from: number, to: number): Promise<Blk[]> {
  if (to < from) return [];
  const [a, b] = await Promise.all([A.blocks(from, to), B.blocks(from, to)]);
  if (a.length !== to - from + 1 || b.length !== a.length) throw new Error(`blocks ${from} … ${to}: a node returned the wrong number of blocks`);
  for (let i = 0; i < a.length; i++) if (a[i].h !== from + i || key(a[i]) !== key(b[i])) throw new Error(`block ${from + i} differs between ${A.name} and ${B.name}; nothing written (tried again next run)`);
  return a;
}
/** changes to a's balance in blocks (h0, h1] */
function changesAfter(blocks: Blk[], a: string, h0: number, h1: number) {
  let s = 0n;
  for (const b of blocks) {
    if (b.h <= h0 || b.h > h1) continue;
    if (b.s === a) s -= BigInt(b.burn);
    for (const e of b.events) { if (e.f === a) s -= BigInt(e.v); if (e.t === a) s += BigInt(e.v); }
  }
  return s;
}
/** Live reads of every address on both nodes; then the tail up to the newest read, irreversible on both; the block
 *  ids seen at read time must be the irreversible ones. Returns the reads, the tail blocks and the anchor block. */
export async function liveAnchor(A: RulerNode, B: RulerNode, addrs: string[], lastTo: number, opts: { waitMs?: number; pollMs?: number; rounds?: number; log?: (s: string) => void } = {}) {
  const reads: Record<"A" | "B", Record<string, Read>> = { A: {}, B: {} }, node = { A, B };
  for (const a of addrs) { reads.A[a] = await A.read(a); reads.B[a] = await B.read(a); }
  const wait = opts.waitMs ?? 6 * 60000;
  const settle = async (at: number) => {   // wait until `at` is irreversible on both nodes (Koinos: ~60 blocks, ~3 minutes)
    const t0 = Date.now();
    for (;;) {
      const [ha, hb] = await Promise.all([A.head(), B.head()]);
      if (ha.lib >= at && hb.lib >= at) return;
      if (Date.now() - t0 > wait) throw new Error(`block ${at} didn't become irreversible within ${wait / 60000} minutes`);
      await sleep(opts.pollMs ?? 15000);
    }
  };
  // A read pinned to a head block that a micro-fork later replaced (Koinos makes a block every 3 s; the newest is
  // sometimes swapped) is thrown away and that address is read again, on that node, up to `rounds` times.
  for (let round = 0; ; round++) {
    const all = [...Object.values(reads.A), ...Object.values(reads.B)];
    if (all.some((r) => r.h < lastTo)) throw new Error("a node answered at a block before the hour's end (it is behind)");
    await settle(Math.max(...all.map((r) => r.h)));
    const stale: ["A" | "B", string][] = [];
    for (const n of ["A", "B"] as const) for (const [a, r] of Object.entries(reads[n])) if ((await node[n].blockId(r.h)) !== r.id) stale.push([n, a]);
    if (!stale.length) break;
    if (round + 1 >= (opts.rounds ?? 5)) throw new Error(`block ${reads[stale[0][0]][stale[0][1]].h} changed after it was read (a fork), ${round + 1} times; tried again next run`);
    (opts.log || console.log)(`${stale.length} read(s) were on a block a micro-fork replaced; reading them again`);
    for (const [n, a] of stale) reads[n][a] = await node[n].read(a);
  }
  const all = [...Object.values(reads.A), ...Object.values(reads.B)], at = Math.max(...all.map((r) => r.h));
  const tail = await blocksOnBoth(A, B, lastTo + 1, at);
  const idOf = new Map<number, string>(tail.map((b) => [b.h, b.id]));
  for (const r of all) {   // the irreversible blocks are the ones the reads were pinned to (both nodes agree on them)
    const id = r.h === lastTo ? await A.blockId(lastTo) : idOf.get(r.h);
    if (id !== r.id) throw new Error(`block ${r.h} changed after it was read (a fork); tried again next run`);
  }
  return { reads, tail, at, id: tail.length ? tail[tail.length - 1].id : await A.blockId(at) };
}
/** Balances at block `at` from each node's reads (they must agree): read + changes since. */
export function balancesAt(reads: Record<"A" | "B", Record<string, Read>>, blocks: Blk[], at: number) {
  const bal: Record<string, bigint> = {};
  for (const a of Object.keys(reads.A)) {
    const va = BigInt(reads.A[a].bal) + changesAfter(blocks, a, reads.A[a].h, at), vb = BigInt(reads.B[a].bal) + changesAfter(blocks, a, reads.B[a].h, at);
    if (va !== vb) throw new Error(`${a}: the two nodes' balances disagree; nothing written`);
    bal[a] = va;
  }
  return bal;
}
const toHourBlocks = (bs: Blk[]) => bs.map((b) => ({ s: b.s, id: b.id, burn: b.burn }));
const toHourEvents = (bs: Blk[]) => bs.flatMap((b) => b.events);

// Every hour's tail stays short, so a day file stays far under its 16 MiB limit (Repo Lens #B-6 D-1: each hour file holds
// its blocks up to its anchor, so long tails repeat the same blocks across a day's hours):
//  - more than ~5 h behind → chained hours (no reads, no tail) down to ~2 h behind; the next hourly run then goes live
//    (Repo Lens #E-14 N-2: the gap between CHAIN_TO and CHAIN_AFTER is larger than an hour, so it can't chain for ever);
//  - a live run reads once, for its NEWEST hour only; the hours before it in the same run are chained, anchored at their
//    own end with balances walked back from those reads, and that live hour checks them in the same publish.
// more than 3 h behind → a red alert every run, and the same words in plain language at the top of the run page (owner,
// 12 Nov: the Race's 3-hour alert quotes the step; a normal run is 1 to 2 hours behind, so 3 means about two missed runs).
export const CHAIN_AFTER = 6000, CHAIN_TO = 2400, BEHIND_ALERT = 3600, MAX_DAY_BYTES = 16 << 20;
/** What the owner does when the recorder is behind or fails, in one line (the Race's alert quotes it word for word). */
export const OWNER_STEP = "GitHub → Actions → VHP ruler data: if the latest run is red, click Re-run all jobs; missed hours are read back from the chain by themselves, and if it is red again the next hour, send its error text to the VHP Ruler chat.";
/** Adds plain-language lines at the top of the run page (GitHub's job summary), when the run has one. Never throws. */
export function runSummary(lines: string[]) {
  const f = process.env.GITHUB_STEP_SUMMARY;
  if (!f) return;
  try { fs.appendFileSync(f, lines.join("\n") + "\n"); } catch { /* the summary is a convenience: the log line still stands */ }
}
/** Catch-up after an outage (#D-10 M-2): hours with no reads, balances carried forward from the previous hour plus the
 *  blocks both nodes agreed on; an address seen for the first time is read live and walked back. A chained hour's
 *  anchor is its own last block, or the previous anchor when that one is later (a live read can land past the next
 *  hour's end): Repo Lens #E-14 / #B-5 N-1, the same rule in both checkers. */
async function chainedHours(A: RulerNode, B: RulerNode, prevText: string, first: number, last: number, opts: any) {
  const log = opts.log || console.log, texts: string[] = [];
  let p = prevText;
  for (let n = first; n <= last; n++) {
    const prev = JSON.parse(p), from = n * D.HOUR, to = from + D.HOUR - 1, at = Math.max(to, prev.anchor.at);
    const blocks = await blocksOnBoth(A, B, from, at);   // the hour, plus the rest of the previous tail if it reaches further
    const bal: Record<string, bigint> = {};
    for (const [a, v] of Object.entries(prev.anchor.bal)) bal[a] = BigInt(v as string) + changesAfter(blocks, a, prev.anchor.at, at);
    const fresh = [...new Set(blocks.map((b) => b.s))].filter((a) => !(a in bal)).sort();
    if (fresh.length) {   // first seen during the outage: a live read on both nodes, walked back to this hour's anchor
      const anc = await liveAnchor(A, B, fresh, at, opts), all = [...blocks, ...anc.tail];
      const back = balancesAt(anc.reads, all, anc.at);
      for (const a of fresh) bal[a] = back[a] - changesAfter(all, a, at, anc.at);
    }
    const t = D.makeHour({ n, prevText: p, kind: "chained", blocks: toHourBlocks(blocks), events: toHourEvents(blocks), anchor: { at, id: blocks[blocks.length - 1].id, bal, reads: { A: {}, B: {} } } });
    const c = D.checkHour(p, t);
    if (!c.ok) throw new Error(`block-hour ${n} (chained) fails its own check (${c.why}); nothing written`);
    log(`block-hour ${n}: chained (catching up; checked by the next live hour)`);
    texts.push(t); p = t;
  }
  return texts;
}
/** One recorder run: the next irreversible block-hours after the newest published one (prevText), as hour texts. */
export async function recordHours(A: RulerNode, B: RulerNode, prevText: string, opts: { maxHours?: number; maxChained?: number; waitMs?: number; pollMs?: number; rounds?: number; log?: (s: string) => void } = {}) {
  const log = opts.log || console.log, prev = JSON.parse(prevText);
  const [ha, hb] = await Promise.all([A.head(), B.head()]), lib = Math.min(ha.lib, hb.lib);
  const first = prev.n + 1;
  if (lib - prev.to > BEHIND_ALERT) {
    const h = ((lib - prev.to) / 1200).toFixed(1);
    log(`::error::the VHP ruler is ${h} hours behind (newest hour ${prev.n}); it catches up by itself, see docs/VHP-RULER.md`);
    runSummary([`## VHP ruler data is ${h} hours behind`, "", "Paying cards wait (\"not yet\") until it catches up; nothing is scored wrong. This run catches up by itself.", "", `If it is still behind next hour: ${OWNER_STEP}`]);
  }
  if (lib - prev.to > CHAIN_AFTER) {   // too far behind for live reads (an anchor must be within a day of its hour)
    let last = first - 1;
    while (last + 1 - first < (opts.maxChained ?? 48) && (last + 2) * D.HOUR - 1 <= lib - CHAIN_TO) last++;
    if (last >= first) return chainedHours(A, B, prevText, first, last, opts);
  }
  let last = first - 1;
  while (last + 1 - first < (opts.maxHours ?? 6) && (last + 2) * D.HOUR - 1 <= lib) last++;
  if (last < first) { log(`nothing to record: block-hour ${first} ends at ${(first + 1) * D.HOUR - 1}, irreversible is ${lib}`); return []; }
  const from = first * D.HOUR, to = (last + 1) * D.HOUR - 1;
  log(`recording block-hours ${first} … ${last} (blocks ${from} … ${to}) on ${A.name} and ${B.name}`);
  const blocks = await blocksOnBoth(A, B, from, to);
  const anchored = new Set<string>([...Object.keys(prev.anchor.bal), ...blocks.map((b) => b.s)]);
  let anc = await liveAnchor(A, B, [...anchored].sort(), to, opts);
  for (let k = 0; ; k++) {   // #D-10 L-4: a producer that first signs in the tail is read too
    const extra = [...new Set(anc.tail.map((b) => b.s))].filter((a) => !anchored.has(a));
    if (!extra.length) break;
    if (k >= 3) throw new Error(`new producers keep appearing during the reads (${extra.join(", ")}); tried again next run`);
    for (const a of extra) anchored.add(a);
    anc = await liveAnchor(A, B, [...anchored].sort(), to, opts);
  }
  const allBlocks = [...blocks, ...anc.tail];
  const bal = balancesAt(anc.reads, allBlocks, anc.at);
  const readOut = (n: "A" | "B") => Object.fromEntries(Object.entries(anc.reads[n]).map(([a, r]) => [a, [r.h, r.bal, r.eff]]));
  const texts: string[] = [];
  let p = prevText;
  for (let n = first; n <= last; n++) {
    const hf = n * D.HOUR, ht = hf + D.HOUR - 1, prevAt = JSON.parse(p).anchor.at;
    let t: string;
    if (n < last) {   // an older hour of this run: chained, anchored at its own end (or the previous anchor, if later)
      const at = Math.max(ht, prevAt), mine = allBlocks.filter((b) => b.h >= hf && b.h <= at);
      const set = new Set<string>([...Object.keys(JSON.parse(p).anchor.bal), ...mine.map((b) => b.s)]);
      const hb: Record<string, bigint> = {};
      for (const a of [...set].sort()) hb[a] = bal[a] - changesAfter(allBlocks, a, at, anc.at);
      t = D.makeHour({ n, prevText: p, kind: "chained", blocks: toHourBlocks(mine), events: toHourEvents(mine), anchor: { at, id: mine[mine.length - 1].id, bal: hb, reads: { A: {}, B: {} } } });
    } else {
      const mine = allBlocks.filter((b) => b.h >= hf);
      t = D.makeHour({ n, prevText: p, kind: "live", blocks: toHourBlocks(mine), events: toHourEvents(mine),
        anchor: { at: anc.at, id: anc.id, bal, reads: { A: readOut("A"), B: readOut("B") } } });
    }
    const c = D.checkHour(p, t);
    if (!c.ok) throw new Error(`block-hour ${n} fails its own check (${c.why}); nothing written`);
    if (n < last) log(`block-hour ${n}: chained (checked by block-hour ${last}'s live reads, written with it)`);
    else if (c.quality === "flagged") log(`::warning::block-hour ${n} is flagged: ${c.why}`); else log(`block-hour ${n}: ok (effective balances match at the ${c.effAt === "next" ? "block after each read" : "read block"})`);
    texts.push(t); p = t;
  }
  return texts;
}

/** Rollups and retention: hour files of days at least 3 days old go into day files; days older than keepDays go. */
export function rollup(hourTexts: Map<number, string>, dayNs: Set<number>, newestN: number, keepDays: number, log: (s: string) => void = console.log) {
  const days: Record<number, string> = {}, remove: string[] = [];
  const today = Math.floor(newestN / 24);
  const byDay = new Map<number, number[]>();
  for (const n of hourTexts.keys()) { const d = Math.floor(n / 24); if (!byDay.has(d)) byDay.set(d, []); byDay.get(d)!.push(n); }
  for (const [d, ns] of [...byDay].sort((x, y) => x[0] - y[0])) {
    if (d > today - 3 || ns.length !== 24 || dayNs.has(d)) continue;
    ns.sort((x, y) => x - y);
    const t = D.makeDay(d, ns.map((n) => hourTexts.get(n)!));
    // #B-6 D-1: never hand the publish job a day file it must refuse (that would stop every later publish); the hours
    // stay as hour files and a red error asks for a look
    if (Buffer.byteLength(t, "utf8") > MAX_DAY_BYTES) { log(`::error::day ${d} would be ${Buffer.byteLength(t, "utf8")} bytes, over the ${MAX_DAY_BYTES}-byte limit: not rolled up (its hours stay); send this to the VHP Ruler chat`); continue; }
    days[d] = t;
    for (const n of ns) remove.push(`h/${n}.json`);
  }
  for (const d of [...dayNs, ...Object.keys(days).map(Number)]) if (d < today - keepDays) remove.push(`d/${d}.json`);
  return { days, remove };
}

async function main() {
  const E = process.env;
  const ra = E.RPC || "https://koinos.armana.io", rb = E.RPC_CHECK || "https://api.koinosblocks.com";
  if (ra.replace(/\/+$/, "") === rb.replace(/\/+$/, "")) throw new Error("RPC and RPC_CHECK are the same node: two different nodes are needed");   // #D-10 L-5
  const A = chainNode(ra, "A"), B = chainNode(rb, "B");
  const prevDir = E.VHP_PREV || "", out = E.VHP_OUT || "vhp-out", keep = Math.max(26, Number(E.VHP_KEEP_DAYS || 30));
  const hourTexts = new Map<number, string>(), dayNs = new Set<number>();
  for (const f of fs.existsSync(path.join(prevDir, "h")) ? fs.readdirSync(path.join(prevDir, "h")) : []) { const m = /^(\d+)\.json$/.exec(f); if (m) hourTexts.set(Number(m[1]), fs.readFileSync(path.join(prevDir, "h", f), "utf8")); }
  for (const f of fs.existsSync(path.join(prevDir, "d")) ? fs.readdirSync(path.join(prevDir, "d")) : []) { const m = /^(\d+)\.json$/.exec(f); if (m) dayNs.add(Number(m[1])); }
  if (!hourTexts.size) throw new Error("no published hour yet: run the first fill (bot/vhp-fill.ts) first");
  const newest = Math.max(...hourTexts.keys());
  const texts = await recordHours(A, B, hourTexts.get(newest)!, { maxHours: Number(E.VHP_MAX_HOURS || 6) });
  fs.mkdirSync(path.join(out, "h"), { recursive: true });
  for (const t of texts) { const n = JSON.parse(t).n; fs.writeFileSync(path.join(out, "h", `${n}.json`), t); hourTexts.set(n, t); }
  const { days, remove } = rollup(hourTexts, dayNs, Math.max(...hourTexts.keys()), keep);
  if (Object.keys(days).length) { fs.mkdirSync(path.join(out, "d"), { recursive: true }); for (const [d, t] of Object.entries(days)) fs.writeFileSync(path.join(out, "d", `${d}.json`), t); }
  if (remove.length) fs.writeFileSync(path.join(out, "remove.txt"), remove.join("\n") + "\n");
  console.log(`wrote ${texts.length} hour(s), ${Object.keys(days).length} day file(s), ${remove.length} removal(s)`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((e) => { console.error(`::error::${(e as Error).message}`); runSummary(["## VHP ruler data: this run failed", "", `Error: ${(e as Error).message}`, "", OWNER_STEP]); process.exit(1); });
