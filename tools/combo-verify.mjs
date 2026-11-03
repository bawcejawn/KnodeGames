/**
 * COMBO CARD VERIFY JOB (Repo Lens fix-check 3 FC3-3). Runs between the recorder and the publish job, in a job of its
 * own with no write token and no installed packages (plain `node`, this repository's own files only), so a bad npm
 * package in the record job can't reach it. For every day file the record run wants to publish it confirms, from the
 * chain (two nodes) and the published race-data and Block X files:
 *   - a slot fixed for the first time holds exactly the cards the Picks contract has for it (who, legs, time,
 *     changes), read on both nodes once the day is irreversibly over on both;
 *   - every card that turns final is what bot/games/combo-score.mjs (the recorder's own scoring) gives for it: its
 *     price card, results, worths (Block X with the VHP moved in, read here on both nodes), points and settled time;
 *   - a new Vault file: the published board's stake flags for that week (staked; free = never staked that week, for
 *     the Free play prize, D-081) are the Vault's own, read on both nodes.
 * It writes the names and sha256 of the day files it confirms; the publish job publishes no other day file.
 *
 *   node tools/combo-verify.mjs <incoming combo/> <published combo/> <race-data/> <published blockx/> <out file>
 *   env: RPC, RPC_CHECK (the two nodes), CHECK_NOW_MS (tests: the clock).
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { makeScorer, blockTargets, clearFiles } from "../bot/games/combo-score.mjs";
import { scoringVhpMoves, NonCanonicalTransfer, MOVE_MARGIN, decodeBase58, encodeBase58 } from "../bot/games/vhp-inflows.mjs";
const M = globalThis.KRaceMath, C = globalThis.KCombo;

const MAINNET_VHP = "12Y5vW6gk8GceH53YfRkRre2Rrcsgw7Naq";   // common.ts MAINNET_VHP (a test checks they match)
const LIST_PICKS = 2118033200;
const HOUR = 3600000, BEHIND_MS = 30 * 60000;
const isAddr = (a) => typeof a === "string" && /^1[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(a);
const load = (f) => { try { return fs.lstatSync(f).isFile() ? JSON.parse(fs.readFileSync(f, "utf8")) : null; } catch { return null; } };
const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");

/** A JSON-RPC node with nothing but fetch. call(method, params) as koilib's Provider.call. */
export function rpcNode(url) {
  let id = 0;
  return {
    url,
    async call(method, params) {
      for (let tries = 1; ; tries++) {
        try {
          const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }) });
          const j = await r.json();
          if (j.error) throw new Error(`${method}: ${JSON.stringify(j.error).slice(0, 200)}`);
          return j.result;
        } catch (e) {
          if (tries >= 3) throw e;
          await new Promise((res) => setTimeout(res, 2000 * tries));
        }
      }
    },
  };
}

// ── protobuf, just what list_picks needs (picks/assembly/proto/picks.proto) ──
const varint = (n) => { const o = []; let v = BigInt(n); do { let x = Number(v & 0x7fn); v >>= 7n; if (v) x |= 0x80; o.push(x); } while (v); return o; };
/** list_picks_arguments { game = 1; round = 2; start_after = 3 (address bytes); limit = 4 }. */
export function encodeListPicks(game, round, startAfter, limit) {
  const b = [0x08, ...varint(game), 0x10, ...varint(round)];
  if (startAfter) { const a = decodeBase58(startAfter); b.push(0x1a, ...varint(a.length), ...a); }
  b.push(0x20, ...varint(limit));
  return Buffer.from(b).toString("base64url");
}
function fields(buf) {
  const out = []; let i = 0;
  const vint = () => { let r = 0n, sh = 0n; for (let k = 0; k < 10; k++) { if (i >= buf.length) throw new Error("cut short"); const x = buf[i++]; r |= BigInt(x & 0x7f) << sh; if (!(x & 0x80)) return r; sh += 7n; } throw new Error("varint"); };
  while (i < buf.length) {
    const tag = vint(), f = Number(tag >> 3n), w = Number(tag & 7n);
    if (w === 0) out.push([f, vint()]);
    else if (w === 2) { const n = Number(vint()); if (i + n > buf.length) throw new Error("length"); out.push([f, buf.subarray(i, i + n)]); i += n; }
    else if (w === 1) i += 8; else if (w === 5) i += 4; else throw new Error("wire type");
  }
  return out;
}
/** list_picks_result { repeated pick_row rows = 1 } with pick_row { player = 1; pick_object pick = 2 } and
 *  pick_object { producers = 1; number = 2; height = 3; time = 4; changes = 5; repeated leg legs = 6 },
 *  leg { code = 1; round = 2; producer = 3 }. */
export function decodeListPicks(b64) {
  const rows = [];
  for (const [f, v] of fields(Buffer.from(b64 ?? "", "base64"))) {
    if (f !== 1) continue;
    let player = "", pick = null;
    for (const [g, w] of fields(v)) { if (g === 1) player = encodeBase58(w); if (g === 2) pick = w; }
    const card = { player, legs: [], time: 0, height: 0, changes: 0 };
    for (const [g, w] of fields(pick ?? Buffer.alloc(0))) {
      if (g === 3) card.height = Number(w); else if (g === 4) card.time = Number(w); else if (g === 5) card.changes = Number(w);
      else if (g === 6) { const l = { code: 0, round: 0, producer: "" }; for (const [h, x] of fields(w)) { if (h === 1) l.code = Number(x); if (h === 2) l.round = Number(x); if (h === 3) l.producer = encodeBase58(x); } card.legs.push(l); }
    }
    rows.push(card);
  }
  return rows;
}
async function chainCards(node, contract, round) {
  const out = []; let after = null;
  for (let page = 0; page < 1000; page++) {
    const r = await node.call("chain.read_contract", { contract_id: contract, entry_point: LIST_PICKS, args: encodeListPicks(C.GAME_ID, round, after, 100) });
    const rows = decodeListPicks(r?.result);
    for (const x of rows) if (isAddr(x.player)) out.push(x);
    if (!rows.length) return out;
    after = rows[rows.length - 1].player;
  }
  throw new Error(`slot ${round}: more than 100,000 cards`);
}
async function headOf(node) {
  const h = await node.call("chain.get_head_info", {});
  const lib = Number(h.last_irreversible_block);
  const res = await node.call("block_store.get_blocks_by_height", { head_block_id: h.head_topology.id, ancestor_start_height: String(lib), num_blocks: 1, return_block: true, return_receipt: false });
  const it = res?.block_items?.[0];
  if (!it || Number(it.block_height) !== lib) throw new Error(`block ${lib} not returned`);
  return { id: String(h.head_topology.id), height: Number(h.head_topology.height), time: Number(h.head_block_time), lib, libTime: Number(it.block.header.timestamp) };
}

// ── day files ──
const partOf = (f) => { const m = /^D([0-9]{5})(?:-([0-9]{1,3}))?\.json$/.exec(f); return m ? [Number(m[1]), Number(m[2] ?? 0)] : null; };
/** A day's parts merged by slot (exactly the parts part 0 names), or null. */
function dayOf(dir, day) {
  const p0 = load(path.join(dir, `D${String(day).padStart(5, "0")}.json`));
  if (!p0) return [];
  if (!Number.isInteger(p0.parts) || p0.parts < 1 || p0.parts > 1000) return null;
  const merged = new Map();
  for (let k = 0; k < p0.parts; k++) {
    const j = k ? load(path.join(dir, `D${String(day).padStart(5, "0")}-${k}.json`)) : p0;
    if (!j || !Array.isArray(j.slots)) return null;
    for (const s of j.slots) {
      if (!s || !Number.isInteger(s.round) || !Array.isArray(s.cards)) return null;
      const m = merged.get(s.round);
      if (m) { m.cards.push(...s.cards); m.fixed = m.fixed && s.fixed === true; } else merged.set(s.round, { round: s.round, fixed: s.fixed === true, cards: [...s.cards] });
    }
  }
  return [...merged.values()];
}
const chainKey = (c) => JSON.stringify([c.player, c.legs.map((l) => (Array.isArray(l) ? [l[0], l[1], l[2]] : [l.code, l.round, l.producer])), c.time, c.changes]);

/** Confirm the incoming day files. o: { incoming, published, race, blockx, p, check, picks, now, vhp, vhpMovesOf }.
 *  Returns { approved: [{ name, sha256 }], problems: [{ day, why, alert }] }. Exported for the tests. */
export async function verify(o) {
  clearFiles();
  const now = o.now ?? Date.now();
  const names = fs.existsSync(o.incoming) ? fs.readdirSync(o.incoming).filter((f) => partOf(f)) : [];
  const days = [...new Set(names.map((f) => partOf(f)[0]))].sort((a, b) => a - b);
  const approved = [], problems = [];
  // The chain, once, only if some day needs it.
  let ctx = null, chainWhy = "";
  const chain = async () => {
    if (ctx || chainWhy) return ctx;
    try {
      if (!o.p || !o.check) throw new Error("two nodes are needed");
      const a = await headOf(o.p), b = await headOf(o.check);
      const head = { height: Math.min(a.height, b.height), time: Math.min(a.time, b.time), lib: Math.min(a.lib, b.lib), libTime: Math.min(a.libTime, b.libTime) };
      if (now - head.time > BEHIND_MS) throw new Error(`a node's head is ${Math.round((now - head.time) / 60000)} minutes behind this job's clock`);
      if (head.time > now + 10 * 60000) throw new Error("the nodes' time is ahead of this job's clock");
      const ids = new Map([[o.p, a.id], [o.check, b.id]]);
      const reads = o.vhpMovesOf ?? ((node, who, from, to) => scoringVhpMoves(node, ids.get(node), o.vhp ?? MAINNET_VHP, who, from, to));
      const cache = new Map();
      const movedInto = (who, from, to) => {
        const k = `${who}|${from}|${to}`;
        if (!cache.has(k)) cache.set(k, (async () => {
          const one = async (n) => { try { return await reads(n, who, from, to); } catch (e) { return e; } };
          const x = await one(o.p), y = await one(o.check), nc = (v) => v instanceof NonCanonicalTransfer || v?.constructor?.name === "NonCanonicalTransfer";
          if (nc(x) && nc(y)) return { nonCanonical: String(x.message).slice(0, 120) };
          if (nc(x) !== nc(y)) return { hold: `only one node reports a non-standard VHP transfer to ${who}` };
          for (const v of [x, y]) if (v instanceof Error) return { hold: `VHP moved into ${who} could not be read: ${String(v.message).slice(0, 120)}` };
          return { moved: x > y ? x : y };
        })());
        return cache.get(k);
      };
      const w = M.weekOf(head.time);
      const targets = blockTargets(o.blockx, [w - 2, w - 1, w, w + 1].filter((x) => x >= 0));
      const scorer = makeScorer({ race: o.race, targets, head, agreed: true, movedInto, problems: [], errors: [], moveMargin: MOVE_MARGIN });
      ctx = { head, scorer };
    } catch (e) { chainWhy = String(e.message ?? e); }
    return ctx;
  };
  for (const day of days) {
    const files = names.filter((f) => partOf(f)[0] === day);
    const mine = dayOf(o.incoming, day), pub = dayOf(o.published, day);
    let why = "", alert = true;
    if (!mine) why = "its parts can't be read";
    else if (!pub) why = "the published day can't be read";
    else {
      const old = new Map(pub.map((s) => [s.round, s]));
      for (const s of mine) {
        const was = old.get(s.round);
        const newFinal = s.cards.filter((c) => c && c.state === "final" && !(was?.cards ?? []).some((x) => x.player === c.player && x.state === "final"));
        const newlyFixed = s.fixed && !(was && was.fixed);
        if (!newFinal.length && !newlyFixed) continue;
        const k = await chain();
        if (!k) { why = `it can't be confirmed this run (${chainWhy})`; alert = false; break; }
        if (newlyFixed) {
          if (k.head.libTime < (day + 1) * M.DAY) { why = `slot ${s.round} is fixed, but the day isn't irreversibly over on both nodes`; break; }
          let a, b;
          try { a = await chainCards(o.p, o.picks, s.round); b = await chainCards(o.check, o.picks, s.round); }
          catch (e) { why = `slot ${s.round}'s cards can't be read on both nodes (${String(e.message).slice(0, 120)})`; alert = false; break; }
          const set = (x) => JSON.stringify(x.map(chainKey).sort());
          if (set(a) !== set(b)) { why = `the two nodes disagree about slot ${s.round}'s cards`; alert = false; break; }
          if (set(a) !== set(s.cards)) { why = `slot ${s.round} doesn't hold exactly the cards the Picks contract has for it`; break; }
        }
        for (const c of newFinal) {
          const v = await k.scorer.recheck(c, day, true);
          if (v?.forged) { why = `the new final card of ${c.player} in slot ${s.round} isn't what its sources give (${v.forged})`; break; }
          if (v?.unchecked) { why = `the new final card of ${c.player} in slot ${s.round} can't be confirmed this run (${v.unchecked})`; alert = false; break; }
        }
        if (why) break;
      }
    }
    if (why) problems.push({ day, why, alert });
    else for (const f of files) approved.push({ name: f, sha256: sha(path.join(o.incoming, f)) });
  }
  // A new Vault file (D-081): the publish job judges it against the PUBLISHED board, whose stake flags (staked, and
  // free = never staked that week) only the recorder set. Here they are read again from the Vault on both nodes, for
  // every row of that week with a point; the file is confirmed only if every flag is the chain's.
  const vdir = path.join(o.incoming, "vault");
  for (const f of fs.existsSync(vdir) ? fs.readdirSync(vdir).filter((x) => /^W[0-9]+\.json$/.test(x)) : []) {
    if (fs.existsSync(path.join(o.published, "vault", f))) continue;            // write-once: the publish job skips it
    const name = `vault/${f}`, week = Number(f.slice(1, -5)), board = load(path.join(o.published, "board.json"));
    const rows = board?.lastWeek?.week === week && Array.isArray(board.lastWeek.rows) ? board.lastWeek.rows.filter((r) => r && Number(r.pts) >= C.MIN_WEEK_PTS) : null;
    if (!rows) { problems.push({ day: null, file: name, why: `${name}: the published board doesn't show week ${week} yet`, alert: false }); continue; }
    try {
      if (!o.p || !o.check || !o.vault) throw new Error("two nodes and the Vault's address are needed");
      const views = [];
      for (const n of [o.p, o.check]) views.push(await vaultView(n, o.vault, rows.map((r) => r.a), week));
      const [a, b] = views;
      if (!a.live || !b.live || a.min !== b.min) throw new Error("the Vault v6 isn't live on both nodes, or they disagree about its minimum");
      const flags = (v, x) => { const p = v.players.get(x); return p ? { staked: p.week > 0n && p.week >= v.min, free: !(p.peak >= v.min) } : null; };
      const bad = rows.find((r) => { const x = flags(a, r.a), y = flags(b, r.a); return !x || !y || x.staked !== y.staked || x.free !== y.free || r.staked !== x.staked || (r.free !== x.free && !(r.staked === true && r.free === false)); });
      if (bad) { problems.push({ day: null, file: name, why: `${name}: the published board's stake flags for ${bad.a} aren't the Vault's (two nodes)`, alert: true }); continue; }
      approved.push({ name, sha256: sha(path.join(vdir, f)) });
    } catch (e) { problems.push({ day: null, file: name, why: `${name} can't be confirmed this run (${String(e.message ?? e).slice(0, 160)})`, alert: false }); }
  }
  return { approved, problems };
}

// ── the Vault v6 (game/abi/kpred-v6.koilib.json), just what the stake flags need ──
const GET_STATE = 1023583049, GET_GAME_PLAYER = 267077419;
const u64 = (fs_, f) => { const x = fs_.find(([g]) => g === f); return x ? BigInt(x[1]) : 0n; };
/** As blockx.ts vaultView: live (v6_rule_week_plus_one), the week's minimum, and each wallet's week_stake and peak. */
export async function vaultView(node, vault, who, week) {
  const st = await node.call("chain.read_contract", { contract_id: vault, entry_point: GET_STATE, args: "" });
  const cfgB = fields(Buffer.from(st?.result ?? "", "base64")).find(([f]) => f === 1)?.[1];
  if (!cfgB) throw new Error("no answer reading the Vault's state");
  const cfg = fields(cfgB);
  if (!cfg.some(([f]) => f === 1)) throw new Error("no owner in the Vault's state");
  const next = u64(cfg, 13), from = Number(u64(cfg, 14));
  let min = next > 0n && week >= from ? next : u64(cfg, 9);
  const live = u64(cfg, 21) > 0n;
  if (min <= 0n) min = 100000000n;
  const players = new Map();
  if (!live) return { live, min, players };
  for (const x of new Set(who)) {
    const a = decodeBase58(x);
    const args = Buffer.from([0x0a, ...varint(a.length), ...a, 0x10, ...varint(C.GAME_ID), 0x18, ...varint(week)]).toString("base64url");
    const r = await node.call("chain.read_contract", { contract_id: vault, entry_point: GET_GAME_PLAYER, args });
    if (!r || !("result" in r)) throw new Error(`no answer reading ${x}'s stake`);
    const g = fields(Buffer.from(r.result ?? "", "base64"));
    const entry = g.find(([f]) => f === 2)?.[1];
    const act = u64(g, 3), wk = u64(g, 4);
    let peak = act;
    if (entry) { const e = fields(entry); const ps = u64(e, 7), sk = u64(e, 1); peak = ps > sk ? ps : sk; }
    players.set(x, { week: wk, peak });
  }
  return { live, min, players };
}

async function main() {
  const [incoming, published, race, blockx, outFile] = process.argv.slice(2);
  if (!outFile) throw new Error("usage: node tools/combo-verify.mjs <incoming combo/> <published combo/> <race-data/> <blockx/> <out file>");
  const dep = load(new URL("../picks-data/deployment.json", import.meta.url));
  const picks = isAddr(dep?.contract) ? dep.contract : null;
  const gdep = load(new URL("../game-data/deployment.json", import.meta.url));
  const vault = isAddr(gdep?.contract) ? gdep.contract : null;
  const p = process.env.RPC ? rpcNode(process.env.RPC) : null, check = process.env.RPC_CHECK ? rpcNode(process.env.RPC_CHECK) : null;
  if (p && check && p.url.replace(/\/+$/, "").toLowerCase() === check.url.replace(/\/+$/, "").toLowerCase()) throw new Error("RPC and RPC_CHECK are the same node");
  const r = await verify({ incoming, published, race, blockx, p, check, picks, vault, now: Number(process.env.CHECK_NOW_MS) || undefined });
  for (const x of r.problems) console.log(`${x.alert ? "::error::" : "::warning::"}${x.day === null ? "" : `day ${x.day}: `}${x.why}; held`);
  fs.writeFileSync(outFile, r.approved.map((x) => `${x.name} ${x.sha256}\n`).join(""));
  console.log(`${r.approved.length} day file(s) confirmed, ${r.problems.length} day(s) held.`);
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) main().catch((e) => { console.log(`::error::verify: ${e.message ?? e}`); process.exit(1); });
