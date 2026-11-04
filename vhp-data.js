/* Knode Games — the vhp-data format and its checks (design .ai/standards/VHP_RULER.md §7, D-111, D-112).
 * Pure: no network. The recorder (bot/vhp-ruler.ts) writes these files; the publish job checks them with the Python
 * twin (check_hour / check_day in vhp_ruler.py, embedded in .github/workflows/vhp-ruler.yml); games turn them into a
 * ruler timeline with timelineFrom(). Both languages give the same answer on the same files (tested).
 *
 * ONE FILE PER BLOCK-HOUR: h/<n>.json holds blocks n × 1,200 … n × 1,200 + 1,199 (≈ 1 hour at 3 s a block). Heights,
 * not clock times, so every boundary is exact and checkable. Written once, never rewritten. Canonical JSON
 * (JSON.stringify of the object, plus "\n"), so its sha256 can be recomputed from the parsed object.
 *   { v: 1, n, from, to,
 *     prev:    sha256 (hex) of the previous hour file's bytes ("" only for the very first file of the chain),
 *     kind:    "live"  — anchors read on both nodes after the hour (D-112), or
 *              "rebuilt" — anchors rebuilt backwards from one real read (first fill; never used by a paying card),
 *     addrs:   every address this file names, sorted;
 *     sig:     per block, the index in addrs of its signer;
 *     ids:     per block, its id as the node returns it (lowercase 0x-hex) — the card's seed (§2.3);
 *     burns:   per block, the VHP (satoshi, decimal text) the block burned from its signer: exactly one per block;
 *     events:  every OTHER VHP change in the hour (transactions, not reverted): [h, kind, from, to, value]
 *              kind "m" mint (from ""), "t" transfer, "b" burn (to ""); value decimal text;
 *     tail:    the blocks after `to` up to the anchor read (to + 1 … at): { sig, ids, burns, events }, same shapes;
 *              the next hour must begin with exactly these blocks;
 *     anchor:  { at: the block the read is pinned to, id: its id,
 *                bal: { addr: balance after block `at` }, the same on both nodes (else the hour is not written);
 *                effA, effB: { addr: effective_balance_of read on node A / node B } (live only; missing = the node
 *                couldn't answer: the hour is flagged, D-112) } }
 *   The anchored set only grows: every address anchored in the previous hour, plus every signer of this hour.
 *
 * DAY FILES: d/<n>.json for blocks n × 28,800 … (24 hours) once the hours are rolled up:
 *   { v: 1, n, from, to, hashes: [sha256 of each of the 24 hour files], hours: [the 24 hour objects] }.
 *   The hour objects are kept exactly, so their hashes (and the chain inside the day) still check after the rollup.
 *
 * CHECKS (checkHour): the hash chain; consecutive heights; one signer, one id, one burn (> 0) per block; the tail is
 * the next hour's start; balances: previous anchor + every change since = this anchor, for every address; the
 * anchored set only grows; on a live hour, both nodes' effective_balance_of = the rebuild for every anchored address
 * (at the block after the read — or at the read block, which must then hold for all: the first live run shows which,
 * audit S-3). A file that breaks the structure or the balances is REFUSED; an effective-balance miss, a node that
 * couldn't answer or two nodes that disagree FLAG the whole hour (D-112: published, but every card that reads it is
 * "flagged": not scored). */
(function (root) {
  "use strict";
  const HOUR = 1200, DAY = 28800, DELAY = 20, VERSION = 1;
  const R = root.KRuler;
  if (!R) throw new Error("load vhp-ruler.js first");
  const ADDR = /^1[1-9A-HJ-NP-Za-km-z]{25,34}$/, ID = /^0x[0-9a-f]{8,}$/, SAT = /^(0|[1-9][0-9]{0,24})$/;

  const canon = (o) => JSON.stringify(o) + "\n";
  const shaHex = (text) => R.hex(R.sha256(text));
  const fail = (why) => ({ ok: false, why });

  function checkShape(h) {
    if (!h || typeof h !== "object" || h.v !== VERSION) return "not a version-1 hour";
    const keys = ["v", "n", "from", "to", "prev", "kind", "addrs", "sig", "ids", "burns", "events", "tail", "anchor"];
    if (Object.keys(h).join() !== keys.join()) return "fields must be exactly " + keys.join(", ");
    if (!Number.isSafeInteger(h.n) || h.n < 0 || h.from !== h.n * HOUR || h.to !== h.from + HOUR - 1) return "from/to must be block-hour n";
    if (typeof h.prev !== "string" || !/^([0-9a-f]{64})?$/.test(h.prev)) return "prev must be a sha256";
    if (h.kind !== "live" && h.kind !== "rebuilt") return "kind must be live or rebuilt";
    if (!Array.isArray(h.addrs) || !h.addrs.every((a) => typeof a === "string" && ADDR.test(a))) return "bad address";
    for (let i = 1; i < h.addrs.length; i++) if (!(h.addrs[i - 1] < h.addrs[i])) return "addrs must be sorted and unique";
    const blocks = (b, n, where) => {
      if (!b || !Array.isArray(b.sig) || !Array.isArray(b.ids) || !Array.isArray(b.burns) || !Array.isArray(b.events)) return `${where}: sig, ids, burns, events`;
      if (b.sig.length !== n || b.ids.length !== n || b.burns.length !== n) return `${where}: exactly one signer, one id and one burn per block`;
      if (!b.sig.every((i) => Number.isSafeInteger(i) && i >= 0 && i < h.addrs.length)) return `${where}: bad signer index`;
      if (!b.ids.every((x) => typeof x === "string" && ID.test(x))) return `${where}: bad block id`;
      if (!b.burns.every((x) => typeof x === "string" && SAT.test(x) && x !== "0")) return `${where}: every block burns VHP from its signer`;
      return null;
    };
    const e1 = blocks(h, HOUR, "hour"); if (e1) return e1;
    const a = h.anchor;
    if (!a || typeof a !== "object" || Object.keys(a).join() !== "at,id,bal,effA,effB") return "anchor fields must be at, id, bal, effA, effB";
    if (!Number.isSafeInteger(a.at) || a.at < h.to || a.at > h.to + HOUR) return "the anchor must be read within an hour after the hour";
    if (typeof a.id !== "string" || !ID.test(a.id)) return "bad anchor block id";
    if (!h.tail || Object.keys(h.tail).join() !== "sig,ids,burns,events") return "tail fields must be sig, ids, burns, events";
    const e2 = blocks(h.tail, a.at - h.to, "tail"); if (e2) return e2;
    if ((a.at > h.to ? h.tail.ids[a.at - h.to - 1] : h.ids[HOUR - 1]) !== a.id) return "the anchor block id isn't the id of block `at`";
    for (const [lo, hi, list] of [[h.from, h.to, h.events], [h.to + 1, a.at, h.tail.events]]) {
      let last = lo;
      for (const e of list) {
        if (!Array.isArray(e) || e.length !== 5) return "an event is [h, kind, from, to, value]";
        const [eh, k, f, t, v] = e;
        if (!Number.isSafeInteger(eh) || eh < lo || eh > hi || eh < last) return "events out of range or order";
        last = eh;
        if (!["m", "t", "b"].includes(k) || typeof v !== "string" || !SAT.test(v)) return "bad event";
        if ((k === "m") !== (f === "") || (k === "b") !== (t === "")) return "bad event ends";
        if ((f !== "" && !h.addrs.includes(f)) || (t !== "" && !h.addrs.includes(t))) return "an event names an address not in addrs";
      }
    }
    for (const m of ["bal", "effA", "effB"]) {
      if (!a[m] || typeof a[m] !== "object" || Array.isArray(a[m])) return `anchor ${m} must be an object`;
      const ks = Object.keys(a[m]);
      for (let i = 1; i < ks.length; i++) if (!(ks[i - 1] < ks[i])) return `anchor ${m} keys must be sorted`;
      if (!ks.every((k) => h.addrs.includes(k) && typeof a[m][k] === "string" && SAT.test(a[m][k]))) return `bad anchor ${m}`;
    }
    if (h.kind === "rebuilt" && (Object.keys(a.effA).length || Object.keys(a.effB).length)) return "a rebuilt hour has no effective-balance reads";
    return null;
  }

  /** every VHP change of an hour (and its tail): [{ h, a, d, inc }] (BigInt) — block burns first, then events */
  function deltasOf(h, withTail = true) {
    const out = [];
    const take = (b, start) => {
      b.burns.forEach((v, i) => out.push({ h: start + i, a: h.addrs[b.sig[i]], d: -BigInt(v), inc: 0n }));
      for (const [eh, k, f, t, v] of b.events) {
        const x = BigInt(v);
        if (k !== "m") out.push({ h: eh, a: f, d: -x, inc: 0n });
        if (k !== "b") out.push({ h: eh, a: t, d: x, inc: x });
      }
    };
    take(h, h.from); if (withTail) take(h.tail, h.to + 1);
    return out;
  }

  /** checkHour(prevText, text): prevText = the previous hour file's exact text ("" or null for the first file).
   *  → { ok, why?, quality: "ok" | "flagged", flagged: [] or ["*"] (everyone), effAt?: "next" | "head", hash } */
  function checkHour(prevText, text) {
    let h; try { h = JSON.parse(text); } catch (e) { return fail("not JSON"); }
    if (canon(h) !== text) return fail("not in canonical form");
    const bad = checkShape(h); if (bad) return fail(bad);
    let prev = null;
    if (prevText) {
      try { prev = JSON.parse(prevText); } catch (e) { return fail("previous file is not JSON"); }
      if (h.prev !== shaHex(prevText)) return fail("the hash chain is broken (prev isn't the previous file's sha256)");
      if (h.n !== prev.n + 1) return fail("hours must be consecutive");
      if (prev.kind === "live" && h.kind === "rebuilt") return fail("a rebuilt hour can't follow a live one");
      // the previous hour's tail is exactly this hour's first blocks
      const t = prev.tail, k = t.sig.length;
      for (let i = 0; i < k; i++) {
        if (prev.addrs[t.sig[i]] !== h.addrs[h.sig[i]] || t.ids[i] !== h.ids[i] || t.burns[i] !== h.burns[i]) return fail(`block ${h.from + i} differs from the previous hour's tail`);
      }
      const mine = h.events.filter((e) => e[0] <= prev.anchor.at).map((e) => JSON.stringify(e)).join("|");
      if (mine !== t.events.map((e) => JSON.stringify(e)).join("|")) return fail("the events after the previous anchor differ from its tail");
    } else if (h.prev !== "") return fail("the first file must have an empty prev");
    // balances: previous anchor + changes = this anchor
    const bal = h.anchor.bal, addrs = Object.keys(bal);
    const signers = new Set(h.sig.map((i) => h.addrs[i]));
    for (const s of signers) if (!(s in bal)) return fail(`signer ${s} has no anchor`);
    for (const s of h.tail.sig.map((i) => h.addrs[i])) if (!(s in bal)) return fail(`signer ${s} has no anchor`);
    const ds = deltasOf(h);
    if (prev) {
      for (const a of Object.keys(prev.anchor.bal)) if (!(a in bal)) return fail(`${a} was anchored before and must stay anchored`);
      const p0 = prev.anchor.at;
      for (const a of addrs) {
        if (!(a in prev.anchor.bal)) continue;   // newly anchored
        let v = BigInt(prev.anchor.bal[a]);
        for (const x of ds) if (x.a === a && x.h > p0) v += x.d;
        if (v !== BigInt(bal[a])) return fail(`${a}: the previous anchor plus the hour's changes isn't this anchor (${v} vs ${bal[a]})`);
      }
    }
    // the rebuild never goes below zero inside the hour
    for (const a of addrs) {
      let v = BigInt(bal[a]); const mine = ds.filter((x) => x.a === a).sort((p, q) => q.h - p.h);
      for (const x of mine) { v -= x.d; if (v < 0n) return fail(`${a}: the rebuild goes below zero (a missed event)`); }
    }
    const hash = shaHex(text);
    if (h.kind === "rebuilt") return { ok: true, quality: "ok", flagged: [], hash };
    // live: both nodes' effective_balance_of = the rebuild, for every anchored address
    const at = h.anchor.at, effOf = (a, H) => {
      let b = BigInt(bal[a]), recv = 0n;
      for (const x of ds) if (x.a === a) { if (x.h >= H) b -= x.d; else if (x.h >= H - DELAY + 1) recv += x.inc; }
      const e = b - recv; return e > 0n ? e : 0n;
    };
    const missed = [], rule = { next: true, head: true };
    for (const a of addrs) {
      const ea = h.anchor.effA[a], eb = h.anchor.effB[a];
      if (ea === undefined || eb === undefined || ea !== eb) { missed.push(a); continue; }
      const v = BigInt(ea);
      if (v !== effOf(a, at + 1)) rule.next = false;
      if (v !== effOf(a, at)) rule.head = false;
    }
    const effAt = rule.next ? "next" : rule.head ? "head" : "";
    // D-112: a node that can't answer, two nodes that disagree, or a rebuild that matches neither rule: the hour is not ok
    if (missed.length || !effAt) return { ok: true, quality: "flagged", flagged: ["*"], hash, why: missed.length ? `effective balance missing or different on the two nodes: ${missed.join(", ")}` : "the effective balances match the rebuild at neither the next block nor the read block" };
    return { ok: true, quality: "ok", flagged: [], effAt, hash };
  }

  /** checkDay(text, prevHourText): a day file is 24 checked hours, its hashes listing each hour file's sha256. */
  function checkDay(text, prevHourText) {
    let d; try { d = JSON.parse(text); } catch (e) { return fail("not JSON"); }
    if (canon(d) !== text) return fail("not in canonical form");
    if (Object.keys(d).join() !== "v,n,from,to,hashes,hours" || d.v !== VERSION) return fail("fields must be v, n, from, to, hashes, hours");
    if (!Number.isSafeInteger(d.n) || d.from !== d.n * DAY || d.to !== d.from + DAY - 1) return fail("from/to must be day n");
    if (!Array.isArray(d.hours) || d.hours.length !== 24 || !Array.isArray(d.hashes) || d.hashes.length !== 24) return fail("a day holds 24 hours");
    let prev = prevHourText || "", flagged = [];
    for (let i = 0; i < 24; i++) {
      const t = canon(d.hours[i]);
      if (d.hours[i].n !== d.n * 24 + i) return fail(`hour ${i} is not block-hour ${d.n * 24 + i}`);
      if (shaHex(t) !== d.hashes[i]) return fail(`hour ${i}: its sha256 isn't the one listed`);
      const r = checkHour(prev, t); if (!r.ok) return fail(`hour ${i}: ${r.why}`);
      if (r.quality === "flagged") flagged.push({ n: d.hours[i].n, flagged: r.flagged });
      prev = t;
    }
    return { ok: true, flagged, last: prev };
  }

  /** A ruler timeline (vhp-ruler.js ledger input) from consecutive checked hours (objects, oldest first).
   *  Flagged hours become `bad` ranges; rebuilt hours `rebuilt` ranges (D-112). The anchors are the last hour's. */
  function timelineFrom(hours, checks) {
    if (!hours.length) throw new Error("no hours");
    const signers = [], ids = [], deltas = [], bad = [], rebuilt = [];
    hours.forEach((h, i) => {
      if (i && h.n !== hours[i - 1].n + 1) throw new Error(`hours ${hours[i - 1].n} and ${h.n} aren't consecutive`);
      for (const s of h.sig) signers.push(h.addrs[s]);
      ids.push(...h.ids);
      deltas.push(...deltasOf(h, i === hours.length - 1));
      if (h.kind === "rebuilt") rebuilt.push({ h0: h.from, h1: h.to });
      const c = checks && checks[i];
      if (c && c.quality === "flagged") {
        if (c.flagged.includes("*")) bad.push({ h0: h.from, h1: h.to });
        else for (const a of c.flagged) bad.push({ h0: h.from, h1: h.to, a });
      }
    });
    const last = hours[hours.length - 1], anchors = {};
    for (const [a, v] of Object.entries(last.anchor.bal)) anchors[a] = { h: last.anchor.at, v: BigInt(v) };
    return { from: hours[0].from, to: last.to, signers, ids, deltas, anchors, bad, rebuilt };
  }

  /** makeHour: the canonical text of block-hour n.
   *  blocks: one per height from n × 1,200 to anchor.at: { s: signer, id, burn } (burn: BigInt or decimal text);
   *  events: the other VHP changes of those blocks: { h, k: "m" | "t" | "b", f, t, v };
   *  anchor: { at, id, bal, effA, effB } (objects addr → BigInt or text; effA/effB empty on a rebuilt hour). */
  function makeHour({ n, prevText, kind, blocks, events, anchor }) {
    const from = n * HOUR, to = from + HOUR - 1, at = anchor.at;
    if (blocks.length !== at - from + 1) throw new Error(`makeHour needs the blocks ${from} … ${at}`);
    const names = new Set();
    for (const b of blocks) names.add(b.s);
    for (const e of events) { if (e.f) names.add(e.f); if (e.t) names.add(e.t); }
    for (const a of Object.keys(anchor.bal)) names.add(a);
    const addrs = [...names].sort((x, y) => (x < y ? -1 : 1)), ix = new Map(addrs.map((a, i) => [a, i]));
    const part = (lo, hi) => {
      const bs = blocks.slice(lo - from, hi - from + 1);
      const ev = events.filter((e) => e.h >= lo && e.h <= hi).sort((p, q) => p.h - q.h).map((e) => [e.h, e.k, e.f || "", e.t || "", String(e.v)]);
      return { sig: bs.map((b) => ix.get(b.s)), ids: bs.map((b) => b.id), burns: bs.map((b) => String(b.burn)), events: ev };
    };
    const sorted = (o) => Object.fromEntries(Object.keys(o || {}).sort().map((k) => [k, String(o[k])]));
    const main = part(from, to);
    const h = { v: VERSION, n, from, to, prev: prevText ? shaHex(prevText) : "", kind, addrs, sig: main.sig, ids: main.ids,
      burns: main.burns, events: main.events, tail: part(to + 1, at),
      anchor: { at, id: anchor.id, bal: sorted(anchor.bal), effA: sorted(anchor.effA), effB: sorted(anchor.effB) } };
    return canon(h);
  }
  /** makeDay: the day file for day n from its 24 hour files' texts. */
  function makeDay(n, hourTexts) {
    if (hourTexts.length !== 24) throw new Error("a day holds 24 hours");
    return canon({ v: VERSION, n, from: n * DAY, to: n * DAY + DAY - 1, hashes: hourTexts.map(shaHex), hours: hourTexts.map((t) => JSON.parse(t)) });
  }

  root.KVhpData = { HOUR, DAY, VERSION, canon, shaHex, checkHour, checkDay, deltasOf, timelineFrom, makeHour, makeDay };
})(typeof window !== "undefined" ? window : globalThis);
