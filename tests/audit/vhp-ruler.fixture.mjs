// Shared fixtures for the VHP ruler tests: the library loaded in a sandbox, a copy of the VHP contract's balance code,
// and a generator of a random chain written as vhp-data hour files (with exact effective balances for the anchors).
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

export const APP = path.resolve(process.env.APP || ".");
const box = { window: {} };
vm.runInNewContext(fs.readFileSync(`${APP}/vhp-ruler.js`, "utf8") + "\n" + fs.readFileSync(`${APP}/vhp-data.js`, "utf8"), box);
export const R = box.window.KRuler, D = box.window.KVhpData;
export const PY = (code, input) => execFileSync("python3", ["-I", "-B", "-c", `import sys, json; sys.path.insert(0, ${JSON.stringify(APP)}); import vhp_ruler as V\n${code}`], { encoding: "utf8", input, maxBuffer: 1 << 30 });
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const toJson = (x) => JSON.stringify(x, (k, v) => (typeof v === "bigint" ? v.toString() : v));

/** the VHP contract's balance snapshots (koinos-contracts-as contracts/vhp Vhp.ts), arithmetic only */
export class ContractBalance {
  constructor(cur) { this.cur = cur; this.past = []; }
  trim(h) { if (this.past.length <= 1) return; const limit = h < 20 ? 0 : h - 20; while (this.past.length > 1 && this.past[1].h <= limit) this.past.shift(); }
  increase(h, v) {
    this.trim(h);
    if (this.past.length === 0) this.past.push({ h: h - 1, b: this.cur });
    this.cur += v;
    const last = this.past[this.past.length - 1];
    if (last.h !== h) this.past.push({ h, b: this.cur }); else last.b = this.cur;
  }
  decrease(h, v) { this.trim(h); this.cur -= v; for (const p of this.past) p.b = p.b < v ? 0n : p.b - v; }
  effective(h) { if (this.past.length === 0) return this.cur; const copy = new ContractBalance(this.cur); copy.past = this.past.map((p) => ({ ...p })); copy.trim(h); return copy.past[0].b; }
}

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export const addr = (i) => "1Prod" + B58[Math.floor(i / 58) % 58] + B58[i % 58] + "abcdefghijkmnopqrstuvwxy";
export const OUTSIDE = "1Wa22et" + "abcdefghijkmnopqrstuvwxy";
export const blockId = (h) => "0x1220" + crypto.createHash("sha256").update(`block ${h}`).digest("hex");

/** A random chain of `hours` block-hours starting at block-hour n0, written as vhp-data files.
 *  Each block burns ~4.08 VHP from its signer (picked in proportion to effective VHP); some blocks also carry a mint
 *  or a transfer out to an outside wallet. Each hour's anchor block is `lag` blocks after it (or after the last hour
 *  of a group of `share` late hours); each address is read at its own block up to it, with exact effective balances
 *  from the contract copy at the block after its read. Returns { texts, n0, eff(h) per producer, producers }. */
export function makeChain(opts = {}) {
  const { seed = 1, hours = 30, np = 5, n0 = 33500, lag = 25, rebuiltHours = 0, busy = 0.01, share = 1 } = opts;
  const r = rng(seed), H = D.HOUR, from = n0 * H, top = (n0 + hours) * H - 1 + lag;
  const ps = Array.from({ length: np }, (_, i) => addr(i));
  const bal = ps.map((_, i) => BigInt(Math.floor(1e13 * (0.5 + r() * (i + 1)))));
  const con = bal.map((b) => new ContractBalance(b));
  const blocks = [], events = [], effAt = new Map(), balAfter = new Map();
  for (let h = from; h <= top + 1; h++) {
    const effs = con.map((c) => c.effective(h)); effAt.set(h, effs);
    if (h > top) break;
    let tot = 0n; for (const e of effs) tot += e;
    let pick = (BigInt(Math.floor(r() * 1e9)) * tot) / 1000000000n, s = 0;
    for (; s < np - 1; s++) { if (pick < effs[s]) break; pick -= effs[s]; }
    const burn = 408000000n + BigInt(Math.floor(r() * 9000));
    con[s].decrease(h, burn); bal[s] -= burn;
    blocks.push({ s: ps[s], id: blockId(h), burn });
    if (r() < busy) {
      const i = Math.floor(r() * np);
      if (r() < 0.6) { const v = BigInt(1 + Math.floor(r() * 3e12)); con[i].increase(h, v); bal[i] += v; events.push({ h, k: "m", f: "", t: ps[i], v }); }
      else { const v = BigInt(Math.floor(r() * Number(bal[i] / 3n))); con[i].decrease(h, v); bal[i] -= v; events.push({ h, k: "t", f: ps[i], t: OUTSIDE, v }); }
    }
    balAfter.set(h, [...bal]);
  }
  const texts = [];
  let prev = "";
  for (let k = 0; k < (opts.write ?? hours); k++) {
    const n = n0 + k, hf = n * H;
    // late runs: hours k … k + share − 1 all take the read made after the last of them
    const g = Math.floor(k / share) * share, last = Math.min(hours - 1, g + share - 1);
    const at = (n0 + last) * H + H - 1 + lag, kind = k < rebuiltHours ? "rebuilt" : "live";
    const b = balAfter.get(at), reads = { A: {}, B: {} };
    if (kind === "live") ps.forEach((a, i) => {
      const rh = at - (i % (lag + 1));   // each address read at its own block, between the hour's end and `at`
      reads.A[a] = reads.B[a] = [rh, balAfter.get(rh)[i], effAt.get(rh + 1)[i]];
    });
    const anchor = { at, id: blockId(at), bal: Object.fromEntries(ps.map((a, i) => [a, b[i]])), reads };
    const t = D.makeHour({ n, prevText: prev, kind, blocks: blocks.slice(hf - from, at - from + 1), events: events.filter((x) => x.h >= hf && x.h <= at), anchor });
    texts.push(t); prev = t;
  }
  return { texts, n0, ps, eff: (a, h) => effAt.get(h)[ps.indexOf(a)], raw: { from, top, blocks, events, balAfter, effAt, ps } };
}

/** A simulated node over a makeChain() chain: serves blocks up to its irreversible block (head − 60) and answers reads
 *  at its head, which moves on one block per read (so every address is read at its own block, as on mainnet). */
export class FakeNode {
  constructor(raw, { name = "A", head, step = 1, tamper = {} } = {}) { Object.assign(this, { raw, name, headH: head, step, tamper }); }
  async head() { const h = this.headH; this.headH += 10; return { height: h, id: blockId(h), lib: h - 60 }; }   // time passes
  async blockId(h) { return this.tamper.idAt === h ? blockId(-h) : blockId(h); }
  async blocks(from, to) {
    if (to > this.headH - 60) throw new Error(`${this.name}: block ${to} isn't irreversible yet`);
    const out = [];
    for (let h = from; h <= to; h++) {
      const b = this.raw.blocks[h - this.raw.from];
      const events = this.raw.events.filter((e) => e.h === h).map((e) => ({ h, k: e.k, f: e.f, t: e.t, v: String(e.v) }));
      out.push({ h, id: this.tamper.idAt === h ? blockId(-h) : b.id, s: b.s, burn: String(this.tamper.burnAt === h ? b.burn + 1n : b.burn), events });
    }
    return out;
  }
  async read(a) {
    const i = this.raw.ps.indexOf(a), h = this.headH;
    const r = { h, id: blockId(h), bal: String(this.raw.balAfter.get(h)[i]), eff: this.tamper.noEff ? "" : String(this.raw.effAt.get(h + 1)[i]) };
    this.headH += this.step;
    return r;
  }
}
