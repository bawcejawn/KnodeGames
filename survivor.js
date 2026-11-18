/* Survivor: the game page (Koinos MAINNET, Picks game 3), on the Shared Game Kit's files.
 *
 * Reads (games-data branch, survivor/ folder, written by the kit's recorder and checked by its publish job):
 *   W<NNN>/manifest.json + its parts   a week (KG parts v1, one part a day): each day's points per player, the producer
 *                                      each player picked (display column "pk"), the players' stakes, the carried picks
 *   W<NNN>.json                        the same week as one file (read only if a week has no parts folder)
 *   The current week is an open copy (K4, liveWeek), rewritten every hour with the days decided so far.
 * and your picks from the Picks contract. It sends one thing, confirmed in your wallet: your producer for a play day
 * (Picks game 3, round = the UTC day number). The rules are games/survivor/math.js, the same file the recorder uses.
 * A day's points are the change in a player's season standing, so a player's lives, days and score come straight from
 * the published points (math.js decodeStanding): the page never re-scores a day. Everything on screen is built with
 * textContent: no HTML strings. */
import * as S from "./games/survivor/math.js";

const isAddr = (a) => typeof a === "string" && /^1[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(a);
const pad3 = (w) => String(w).padStart(3, "0");
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// ── the kit's files, read (pure: tested in tests/audit/site.survivor-page.test.mjs on files the real kit wrote) ──

/** A KG parts v1 part's text → { part, extra, rows: [{ col: value }] } with addresses resolved. Throws on anything that
 *  isn't a kgparts v1 part (the page then shows the week as not available). */
export function decodePart(text) {
  const o = JSON.parse(text);
  if (!o || o.kgparts !== 1 || !Array.isArray(o.cols) || !Array.isArray(o.a) || !Array.isArray(o.rows)) throw new Error("not a kgparts v1 part");
  for (const a of o.a) if (!isAddr(a)) throw new Error("a part's address table holds a non-address");
  for (const c of o.cols) if (!Array.isArray(c) || !/^[a-z][a-z0-9]{0,15}$/.test(String(c[0])) || !/^[aisnbj]$/.test(String(c[1]))) throw new Error("a part column isn't a kgparts column");
  const rows = o.rows.map((r) => {
    if (!Array.isArray(r) || r.length !== o.cols.length) throw new Error("a part row has the wrong length");
    const x = Object.create(null);                       // column names come from the file: no prototype to reach
    o.cols.forEach(([n, t], i) => {
      if (t === "a") { const k = r[i]; if (!Number.isSafeInteger(k) || k < -1 || k >= o.a.length) throw new Error("bad address index"); x[n] = k === -1 ? null : o.a[k]; }
      else if (t === "j") x[n] = JSON.parse(r[i]);
      else x[n] = r[i];
    });
    return x;
  });
  return { part: o.part, extra: o.extra && typeof o.extra === "object" ? o.extra : {}, rows };
}

/** A week from its decoded parts: { week, start, state, min, players: [[a, stake, peak, voided]], rounds: [[id, day, fun,
 *  status, rows: [[a, pts]]]], pk: Map round id → Map wallet → producer, next: [[a, state]], fallbacks: [id] }. */
export function weekFromParts(parts) {
  const wk = parts.find((p) => p.part === "wk");
  if (!wk || !Array.isArray(wk.extra.head)) throw new Error("no wk part");
  const [, , week, start, , min, state] = wk.extra.head;
  const opt = typeof wk.extra.opt === "string" ? JSON.parse(wk.extra.opt) : {};
  const players = [], next = [];
  for (const p of parts.filter((q) => /^p\//.test(q.part))) {
    for (const r of p.rows) players.push([r.player, r.stake, r.peak, r.voided]);
    for (const c of Array.isArray(p.extra.next) ? p.extra.next : []) next.push([c[0], JSON.parse(c[1])]);
  }
  players.sort((a, b) => cmp(a[0], b[0]));
  const rounds = [], pk = new Map();
  for (const p of parts.filter((q) => /^d[1-7]$/.test(q.part))) {
    const meta = Array.isArray(p.extra.rounds) ? p.extra.rounds : [];
    for (const [ri, id, day, fun, status] of meta) {
      const rows = p.rows.filter((r) => r.round === ri).map((r) => [r.player, r.pts]);
      rounds.push([id, day, fun, status, rows]);
      pk.set(id, new Map(p.rows.filter((r) => r.round === ri).map((r) => [r.player, r.pk ?? null])));
    }
  }
  rounds.sort((a, b) => a[1] - b[1] || cmp(a[0], b[0]));
  const fallbacks = Array.isArray(opt.fallbacks) ? opt.fallbacks.map((f) => f[0]) : [];
  return { week, start, state, min, players, rounds, pk, next, fallbacks };
}

/** A week from the one-file form (W<NNN>.json): the same shape as weekFromParts (no pk column). */
export function weekFromFile(j) {
  if (!j || !Array.isArray(j.rounds) || !Array.isArray(j.players)) throw new Error("not a kit week file");
  const rounds = j.rounds.map(([id, day, fun, status, rows]) => [id, day, fun, status, rows.map((r) => [j.players[r[0]][0], r[1]])]);
  const fallbacks = Array.isArray(j.fallbacks) ? j.fallbacks.map((f) => f[0]) : [];
  return { week: j.week, start: j.start, state: j.state, min: j.min, players: j.players, rounds, pk: new Map(), next: Array.isArray(j.next) ? j.next : [], fallbacks };
}

/** Is a player row a counted stake (the vault's rule, as the kit's K1 reads it: peak ≥ the week's minimum, not voided)? */
const staked = (p, min) => { try { return !p[3] && BigInt(p[2]) >= BigInt(min); } catch { return false; } };
/** A part's file name as the kit writes it (never a path elsewhere). */
const PART_FILE = /^(wk|d[1-7]|p\/[0-9a-f]{1,2})\.[0-9a-f]{12}\.json$/;

/** The season so far from its weeks' files (oldest first, the season's own weeks only; the staked board is the first
 *  week's counted stakes): every player with
 *  { a, board, standing, days, lives, total, outN, log: [{ n, id, pick, what }] }, and the days decided.
 *  what: "safe" (a day played, no life lost), "life" (a life lost), "skip" (the day didn't count), "pending". */
export function seasonView(weeks) {
  const P = new Map(), boardOf = new Set();
  let decided = 0;
  const dayList = [];
  for (const wk of weeks) {
    // The staked board is the season's FIRST week's stakers (owner 16 Nov, J12-1): a later stake changes nothing.
    if (wk === weeks[0]) for (const p of wk.players) if (staked(p, wk.min)) boardOf.add(p[0]);
    const run = new Map();                             // this week's points so far
    wk.rounds.forEach(([id, day, , status, rows]) => {
      const n = dayList.length + 1;
      dayList.push({ n, id, day, status, skip: wk.fallbacks.includes(id) });
      if (status !== "s") {
        for (const [a, x] of P) if (x.outN === null) x.log.push({ n, id, pick: wk.pk.get(id)?.get(a) ?? null, what: "pending" });
        return;
      }
      decided = n;
      const skip = wk.fallbacks.includes(id);
      for (const [a, pts] of rows) {
        const sum = (run.get(a) ?? 0) + pts;
        run.set(a, sum);
        let x = P.get(a);
        // A wallet in the season always stands above 0 (its lives count); 0 points on its first row means not in it.
        if (!x) { if (sum <= 0) continue; x = { a, standing: 0, days: 0, lives: S.LIVES, total: 0, outN: null, log: [] }; P.set(a, x); }
        const was = { days: x.days, lives: x.lives };
        // The week's first play day carries the whole standing; later days add to it (math.js POINTS).
        x.standing = sum;
        const d = S.decodeStanding(x.standing);
        if (x.outN !== null) continue;
        x.days = d.days; x.lives = d.lives; x.total = d.total;
        // A day that didn't count (no ruler card) changes nobody; a board that has ended stops its players' days.
        if (!skip && d.days === was.days) continue;
        const what = skip ? "skip" : d.lives < was.lives ? "life" : "safe";
        x.log.push({ n, id, pick: wk.pk.get(id)?.get(a) ?? null, what });
        if (d.lives <= 0) x.outN = n;
      }
    });
  }
  for (const x of P.values()) x.board = boardOf.has(x.a) ? "staked" : "free";
  return { players: [...P.values()], decided, days: dayList };
}

/** One board's places (math.js rank: lasted longest, then lives, then total; equal on all three share a place). */
export const placesOf = (players, board) => S.rank(players.filter((x) => x.board === board));

// ── the page ──
const $ = (id) => (typeof document === "undefined" ? null : document.getElementById(id));
if (typeof document !== "undefined" && $("days")) start();

function start() {
  "use strict";
  const lib = window.koilib || window.koinos || window;
  const ROOT = new URL("./", location.href);
  const DATA = "https://raw.githubusercontent.com/bawcejawn/KnodeGames/games-data/survivor/";
  const RPC = "https://koinos.armana.io";
  const EXPLORER = "https://koinosscan.com/address/";
  const PRIZES_URL = "https://raw.githubusercontent.com/bawcejawn/KnodeGames/prize-settings/free-prizes.json";
  const NAMES = { "1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr": "Knode pool", "1FKTpXBhhHEbu5vVchM8UsVbAvPArJsRmR": "Knode Swap" };
  const MAX_CHANGES = 5, PICKS_PER_DAY = 20;
  const MARGIN = 2 * 60000;                     // the page offers a day only while its lock is more than 2 minutes away
  const provider = new lib.Provider([RPC]);
  const W = window.KWallet;

  const el = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (v == null) continue; if (k === "text") e.textContent = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); } for (const c of kids) if (c != null && c !== false) e.append(c); return e; };
  const nameOf = (a) => (!isAddr(a) ? "–" : window.KNames && typeof window.KNames.of === "function" ? window.KNames.of(a) : NAMES[a] || a.slice(0, 5) + "…" + a.slice(-4));
  const fmt = (n, d = 0) => Number(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
  const dayName = (day) => new Date(day).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  const addrLink = (a) => el("a", { href: EXPLORER + a, target: "_blank", rel: "noopener noreferrer", text: nameOf(a) });
  const localTime = (t) => new Date(t).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
  const dur = (ms) => { const m = Math.max(0, Math.ceil(ms / 60000)); return m >= 1440 ? `${Math.floor(m / 1440)} d ${Math.floor((m % 1440) / 60)} h` : m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min` : `${m} min`; };
  const hearts = (n) => "♥".repeat(Math.max(0, n)) + "♡".repeat(Math.max(0, S.LIVES - n));
  const say = (t) => { $("status").textContent = t; $("status").hidden = !t; };
  async function fetchJson(url) { const r = await fetch(url, { cache: "no-cache" }); if (!r.ok) throw new Error(String(r.status)); return r.json(); }
  async function fetchText(url) { const r = await fetch(url, { cache: "no-cache" }); if (!r.ok) throw new Error(String(r.status)); return r.text(); }
  const me = () => (W && W.address) || null;

  // The chain's clock decides the lock: the page keeps the largest forward difference it has seen (Repo Lens SV-A21, S3-12).
  let skew = 0;
  const now = () => Date.now() + skew;
  const todayStart = () => S.dayNo(now()) * S.DAY;

  let view = null;                 // seasonView of the current (or last) season
  let viewSeason = null;           // its number
  let producers = [];              // recent signers [{ a, blocks }]
  let switches = null;
  let picksContract = null, myPicks = new Map(), usage = null, sending = false, gameChanged = false;
  const pays = (n) => Number.isInteger(n) && S.freePrizeOn(switches, n);
  const drafts = new Map();

  /** The season to show: the one running today, else the last one that started, else none yet. */
  function seasonNow() {
    const w = S.weekOf(now());
    const s = S.seasonOfWeek(w);
    if (s) return s;
    return null;
  }

  // ── data: the season's week files ──
  async function loadWeek(w) {
    try {
      const m = await fetchJson(`${DATA}W${pad3(w)}/manifest.json`);
      if (!m || m.kgparts !== 1 || !Array.isArray(m.parts)) throw new Error("not a manifest");
      if (!m.parts.every((p) => p && PART_FILE.test(String(p.name)))) throw new Error("a part name isn't the kit's");
      const texts = await Promise.all(m.parts.map((p) => fetchText(`${DATA}W${pad3(w)}/${p.name}`)));
      return weekFromParts(texts.map(decodePart));
    } catch { /* no parts folder: the one-file form, or nothing yet */ }
    try { return weekFromFile(await fetchJson(`${DATA}W${pad3(w)}.json`)); } catch { return null; }
  }
  async function loadData() {
    try { switches = await fetchJson(PRIZES_URL); } catch { switches = null; }
    const s = seasonNow();
    if (!s) { view = null; viewSeason = null; return; }
    const weeks = [];
    for (let w = s.startWeek; w < s.startWeek + S.SEASON_WEEKS && w <= S.weekOf(now()); w++) {
      const wk = await loadWeek(w);
      if (!wk) break;
      weeks.push(wk);
    }
    view = weeks.length ? seasonView(weeks) : null;
    viewSeason = s.season;
  }

  // ── producers to pick from: who signed blocks in the last day (chain-blocks.js) ──
  async function refreshBlocks(first = false) {
    try {
      const r = await window.KBlocks.ensure(provider, { blocks: 30500, onStatus: first ? (t) => t && say(t) : null });
      const B = r.B, from = now() - S.DAY, m = new Map();
      for (let i = B.ts.length - 1; i >= 0 && B.ts[i] >= from; i--) { const a = B.signers[B.sig[i]]; m.set(a, (m.get(a) || 0) + 1); }
      producers = [...m.entries()].filter(([a]) => isAddr(a)).map(([a, blocks]) => ({ a, blocks })).sort((x, y) => y.blocks - x.blocks || cmp(x.a, y.a));
      say("");
    } catch { say("Couldn't reach the Koinos network. Trying again in a moment…"); }
  }

  // ── the Picks contract ──
  async function setupPicks() {
    let pdep = null, dep = null;
    try { pdep = await fetchJson(new URL("picks-data/deployment.json", ROOT)); } catch { return; }
    try { dep = await fetchJson(new URL("game-data/deployment.json", ROOT)); } catch { /* the wallet keeps its defaults */ }
    if (!pdep || !isAddr(pdep.contract)) return;
    const abi = await fetchJson(new URL("picks/abi/picks.koilib.json", ROOT));
    picksContract = new lib.Contract({ id: pdep.contract, abi, provider });
    // The page times the lock with its own copy of game 3's settings; if the chain's differ, picking pauses (S3-29). A
    // game 3 that isn't registered yet reads as no game: picking stays off.
    try {
      const g = ((await picksContract.functions.get_game({ game: S.GAME_ID })).result || {}).game;
      const want = { lock_mode: 2, round_size: S.DAY, round_offset: 0, lead: S.LEAD_MS, ahead: S.AHEAD_MS };
      if (!g || Object.entries(want).some(([k, v]) => Number(g[k] || 0) !== v)) gameChanged = true;
    } catch { gameChanged = true; }
    if (W) W.init({ provider, chainId: dep && dep.chainId, payer: dep && dep.payer, sponsor: dep && dep.sponsor, onChange: () => loadMine() });
    $("picks-soon").hidden = !gameChanged;
    loadMine();
  }

  /** The play days a pick can be made for now (open on the contract, more than 2 minutes before the lock). */
  function openDays() {
    const t = now(), out = [];
    for (let d = todayStart() + S.DAY; d - t <= S.AHEAD_MS; d += S.DAY) if (S.isOpen(d, t) && S.seasonDayOf(d) && S.lockTime(d) - t > MARGIN) out.push(d);
    return out;
  }
  /** The season's play days up to the last open one. */
  function seasonDaysFor(season) { return S.seasonDays(season).map((x) => x.day); }

  // mineOk: my picks were read in full for the wallet shown (Repo Lens SV-A6); a clean read in the last 3 minutes keeps
  // picking on through one bad pass. Sent picks stay in the list until a read shows them (S2-6, S3-14).
  let mineOk = false, mineWho = null, mineAt = 0, mineSeq = 0;
  const sentPicks = new Map(), unseen = new Set();
  const twice = (f) => f().catch(() => new Promise((res) => setTimeout(res, 1500)).then(f));
  async function loadMine() {
    const who = me(), seq = ++mineSeq;
    if (who !== mineWho) { myPicks = new Map(); usage = null; mineOk = false; mineAt = 0; mineWho = who; sentPicks.clear(); unseen.clear(); }
    if (picksContract && who && !gameChanged) {
      const s = seasonNow(), days = new Set([...(s ? seasonDaysFor(s.season) : []), ...openDays()]);
      for (const d of openDays()) { const sd = S.seasonDayOf(d); if (sd) for (const x of seasonDaysFor(sd.season)) days.add(x); }
      const list = [...days].filter((d) => d <= now() + S.AHEAD_MS).sort((a, b) => a - b);
      const got = await Promise.allSettled(list.map((d) => twice(() => picksContract.functions.get_pick({ game: S.GAME_ID, round: String(S.dayNo(d)), player: who }))
        .then((x) => [d, x.result && x.result.pick && Array.isArray(x.result.pick.producers) && x.result.pick.producers.length ? x.result.pick : null])));
      const use = await Promise.allSettled([twice(() => picksContract.functions.get_usage({ game: S.GAME_ID, player: who }))]);
      if (me() !== who || seq !== mineSeq) return;
      if (got.every((x) => x.status === "fulfilled") && use[0].status === "fulfilled") {
        myPicks = new Map(got.map((x) => x.value).filter(([, p]) => p));
        for (const [k, p] of sentPicks) {
          if (!k.startsWith(`${who}|`)) { sentPicks.delete(k); continue; }
          const seen = myPicks.get(p.d);
          if (seen && seen.producers[0] === p.producers[0]) { sentPicks.delete(k); unseen.delete(p.d); }
          else if (seen || S.lockTime(p.d) <= now() || Date.now() - p.at > 3 * 60000) { sentPicks.delete(k); if (!seen) unseen.add(p.d); }
          else myPicks.set(p.d, p);
        }
        usage = use[0].value.result || null;
        mineOk = true; mineAt = Date.now();
      } else mineOk = mineAt > 0 && Date.now() - mineAt < 3 * 60000;
      try {
        const h = await provider.getHeadInfo();
        const t = Number(h && h.head_block_time);
        if (t > 0 && t - Date.now() > 30000) skew = Math.max(skew, t - Date.now());
      } catch { /* the viewer's clock */ }
    }
    renderDays(true); renderStandings(); renderMine();
  }

  // ── where I stand ──
  const myRow = () => (view && me() ? view.players.find((x) => x.a === me()) || null : null);
  /** Can I pick for the play day starting at `d`? Day 1 is open to everyone; later days only to players still in whose
   *  board hasn't ended. */
  function canPickDay(d) {
    const sd = S.seasonDayOf(d);
    if (!sd) return false;
    if (sd.n === 1) return true;
    const mine = viewSeason === sd.season ? myRow() : null;
    if (mine) return mine.outN === null && !boardEnded(mine.board);
    // Not recorded yet: you're in if you picked for day 1.
    return myPicks.has(S.seasonDays(sd.season)[0].day);
  }
  /** A board ends after the day that leaves 2 or fewer of its players in (if it started with more), when none is left. */
  function boardEnded(board) {
    if (!view) return false;
    const rows = view.players.filter((x) => x.board === board);
    const left = rows.filter((x) => x.outN === null).length;
    return rows.length > 2 ? left <= 2 : rows.length > 0 && left === 0;
  }
  /** Producers I can't pick for day d: each producer counts once a season, so any other day's pick this season blocks
   *  it, except a day that didn't count (no ruler card: the pick isn't used). Safe side: an earlier pick that might not
   *  have counted still blocks, because a used producer costs a life. */
  function blockedFor(d) {
    const out = new Map(), sd = S.seasonDayOf(d);
    if (!sd) return out;
    const skipped = new Set(view && viewSeason === sd.season ? view.days.filter((x) => x.skip).map((x) => x.day) : []);
    for (const [x, p] of myPicks) {
      const sx = S.seasonDayOf(x), a = p.producers && p.producers[0];
      if (x === d || !sx || sx.season !== sd.season || !isAddr(a) || out.has(a) || skipped.has(x)) continue;
      out.set(a, `picked for ${dayName(x)}`);
    }
    return out;
  }
  /** Producers I picked for two or more days of the same season: all but one of those picks will cost a life (S2-6). */
  function doubles() {
    const seen = new Map(), out = new Set();
    for (const [d, p] of myPicks) {
      const sd = S.seasonDayOf(d), a = p.producers && p.producers[0];
      if (!sd || !a) continue;
      const k = `${sd.season}|${a}`;
      if (seen.has(k)) out.add(a); else seen.set(k, d);
    }
    return [...out];
  }

  // ── the open days ──
  let daysKey = "";
  function renderDays(force = false) {
    const list = $("days");
    if (!force && list.contains(document.activeElement) && document.activeElement.tagName === "SELECT") return;
    const who = me(), t = now(), days = openDays();
    const key = JSON.stringify([who, W && W.kind, days[0], sending, mineOk, !!picksContract, gameChanged, producers.length, usage && usage.picks_today, [...myPicks.entries()].map(([d, p]) => [d, p.producers && p.producers[0]]), view && view.decided]);
    if (!force && key === daysKey && list.childElementCount) { updateTimes(); return; }
    daysKey = key;
    const s = seasonNow(), mine = myRow();
    const first = S.weekStart(S.FIRST_WEEK);
    $("season-line").textContent = t < first ? `Season 1 starts ${dayName(first)} (practice: nothing is paid). Picks for its day 1 open ${dayName(first - S.AHEAD_MS)}.`
      : !s ? "" : mine ? (mine.outN === null ? `Season ${s.season}: you're in, ${hearts(mine.lives)} (${mine.lives} ${mine.lives === 1 ? "life" : "lives"} left).` : `Season ${s.season}: you went out on day ${mine.outN}. Season ${s.season + 1} starts ${dayName(S.weekStart(s.startWeek + S.SEASON_WEEKS))}.`)
      : `Season ${s.season}. Join season ${s.season + 1} by picking for its day 1, ${dayName(S.weekStart(s.startWeek + S.SEASON_WEEKS))}.`;
    const max = usage ? Number(usage.max_picks_per_day) || PICKS_PER_DAY : PICKS_PER_DAY, used = usage ? Number(usage.picks_today) || 0 : 0;
    $("picks-left").textContent = usage ? `${Math.max(0, max - used)} of ${max} picks left today` : "";
    const dbl = doubles();
    $("picks-who").textContent = !picksContract || gameChanged ? "" : who ? `Picking as ${nameOf(who)}${W.kind === "guest" ? " (guest)" : ""}.${mineOk ? "" : " Couldn't read your picks from the chain yet, so picking is paused; it tries again every minute."}${dbl.length ? ` Warning: you picked ${dbl.map(nameOf).join(", ")} for more than one day this season; each producer counts once, so change all but one of those picks or they cost a life.` : ""}` : "Connect a wallet to pick (Kondor, KOIN Vault or a guest wallet).";
    const rows = [];
    for (const d of days) {
      const sd = S.seasonDayOf(d), pick = myPicks.get(d), mineP = pick && pick.producers && pick.producers[0];
      const blocked = blockedFor(d);
      const when = el("div", { class: "bx-when" },
        el("b", { text: dayName(d) }),
        el("span", { class: "bx-eta", text: `Season ${sd.season} · day ${sd.n} of ${S.SEASON_DAYS}` }),
        el("span", { class: "bx-eta", "data-lock": String(S.lockTime(d)), text: `locks ${localTime(S.lockTime(d))} · in ${dur(S.lockTime(d) - t)}` }));
      let cell;
      if (!picksContract || gameChanged) cell = el("div", { class: "bx-now", text: "Picks open soon" });
      else if (who && !mineOk) cell = el("div", { class: "bx-now", text: "Couldn't read your picks from the chain yet; retrying every minute." });
      else if (!canPickDay(d)) cell = el("div", { class: "bx-now", text: `You're not in season ${sd.season} (or you're out). Join the next one by picking for its day 1.` });
      else if (!who) cell = el("div", { class: "bx-now", text: mineP ? `Your pick: ${nameOf(mineP)}` : "–" });
      else {
        const sel = el("select", { "aria-label": `Producer for ${dayName(d)}` },
          el("option", { value: "", text: !producers.length ? "Reading the producers…" : mineP ? "Change to…" : "Who stays out of the out-zone?" }),
          ...producers.map((p) => {
            const why = p.a !== mineP ? blocked.get(p.a) : null;
            const o = el("option", { value: p.a, text: `${nameOf(p.a)} · ${fmt(p.blocks)} blocks in the last day${why ? ` · ${why}` : ""}` });
            if (why) o.disabled = true;
            if (p.a === (drafts.get(d) || mineP)) o.selected = true;
            return o;
          }));
        if (!producers.length) sel.disabled = true;
        sel.addEventListener("change", () => { if (sel.value) drafts.set(d, sel.value); else drafts.delete(d); });
        const btn = el("button", { class: "btn", type: "button", onclick: () => sendPick(d, sel.value) }, mineP ? "Change" : "Pick");
        if (sending || !mineOk || used >= max || (pick && Number(pick.changes) >= MAX_CHANGES)) btn.disabled = true;
        const notes = [];
        const mineWhy = mineP ? blocked.get(mineP) : null;
        if (mineP) notes.push(el("div", { class: `bx-now${mineWhy ? " warn" : ""}`, text: `Your pick: ${nameOf(mineP)}${mineWhy ? ` (${mineWhy}: each producer counts once, so this pick costs a life; change it)` : ""}` }));
        else if (unseen.has(d)) notes.push(el("div", { class: "bx-now warn", text: "Your last pick for this day was sent but never showed on the chain: it didn't count. Pick again." }));
        else if (sd.n > 1 && d === days[0]) notes.push(el("div", { class: "bx-now warn", text: "No pick yet: a day without a pick costs a life." }));
        if (W && W.kind === "guest" && !mineP) notes.push(el("div", { class: "bx-now", text: "Guest picks use the shared free Mana pool, which can run out late in the day: pick early." }));
        notes.push(el("div", { class: "bx-now", text: "A producer with too few blocks on the day isn't in its field (the ruler's minimum), and a pick on it costs a life: pick one that signs steadily." }));
        cell = el("div", { class: "bx-pick" }, sel, btn, ...notes);
      }
      rows.push(el("div", { class: `bx-row${mineP ? " mine" : ""}` }, when, cell));
    }
    if (!rows.length) rows.push(el("div", { class: "bx-now", text: t < first ? `No play day is open yet. The first opens ${localTime(first - S.AHEAD_MS)}.` : "No play day is open right now (Sundays rest, and a new season opens 7 days ahead)." }));
    list.replaceChildren(...rows);
  }
  function updateTimes() {
    document.querySelectorAll("#days [data-lock]").forEach((n) => { const t = Number(n.dataset.lock); n.textContent = `locks ${localTime(t)} · in ${dur(t - now())}`; });
  }

  // ── the pick pop-up: wallet → sent → confirmed on the chain ──
  let modal = null;
  function pickModal(state, title, lines = [], actions = []) {
    if (!modal) {
      modal = el("div", { class: "pk-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "pk-m-title" });
      modal.addEventListener("click", (e) => { if (e.target === modal && !modal.querySelector(".pk-spin")) closeModal(); });
      document.body.append(modal);
    }
    const icon = { busy: el("span", { class: "pk-spin", "aria-hidden": "true" }), ok: el("span", { class: "pk-big ok", text: "✓" }), bad: el("span", { class: "pk-big bad", text: "✗" }), info: el("span", { class: "pk-big", text: "ℹ" }) }[state];
    modal.replaceChildren(el("div", { class: `pk-box ${state}` }, icon, el("h3", { id: "pk-m-title", text: title }), ...lines.map((l) => (typeof l === "string" ? el("p", { text: l }) : l)),
      actions.length ? el("div", { class: "pk-acts" }, ...actions) : null));
    modal.hidden = false;
    const b = modal.querySelector("button"); if (b) b.focus();
  }
  function closeModal() { if (modal) modal.hidden = true; }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && modal && !modal.hidden && !modal.querySelector(".pk-spin")) closeModal(); });
  const okBtn = (text = "Done") => el("button", { class: "btn", type: "button", onclick: closeModal }, text);

  async function sendPick(d, producer) {
    const who = me();
    if (!who || !picksContract || sending || gameChanged) return;
    if (!mineOk) return pickModal("info", "Your picks aren't loaded yet", ["The page couldn't read your earlier picks from the chain, so it can't tell which producers you've used. It tries again every minute."], [okBtn("OK")]);
    if (!isAddr(producer)) return pickModal("info", "Choose a producer first", ["Pick the producer you think stays out of the out-zone, then press Pick."], [okBtn("OK")]);
    const pick = myPicks.get(d);
    if (pick && pick.producers && pick.producers[0] === producer) return pickModal("info", "That is already your pick", [`${nameOf(producer)} for ${dayName(d)}.`], [okBtn("OK")]);
    const why = blockedFor(d).get(producer);
    if (why) return pickModal("info", "You can't use that producer again", [`${nameOf(producer)}: ${why}. Each producer once a season.`], [okBtn("OK")]);
    if (!(S.lockTime(d) - now() > MARGIN)) return pickModal("bad", "Too close to the lock", [`${dayName(d)} locks in a moment. Pick a later day.`], [okBtn("OK")]);
    if (!canPickDay(d)) return pickModal("info", "You're not in this season", ["Join the next season by picking for its day 1."], [okBtn("OK")]);
    sending = true; renderDays(true);
    const what = `${nameOf(producer)} for ${dayName(d)} (UTC)`;
    const wallet = W.kind === "guest" ? "your guest wallet" : W.label ? W.label() : "your wallet";
    pickModal("busy", W.kind === "guest" ? "Sending your pick…" : `Confirm in ${wallet}`, [what, "Free: the Knode Mana sponsor pays the Mana."]);
    try {
      const { operation } = await picksContract.functions.pick({ player: who, game: S.GAME_ID, round: String(S.dayNo(d)), producers: [producer], number: "0" }, { onlyOperation: true });
      const id = await W.send(`Survivor pick ${nameOf(producer)} for ${dayName(d)}`, [operation]);
      pickModal("busy", "Sent. Checking the chain…", [what]);
      let onChain = false;
      for (let t = 0; t < 10 && !onChain; t++) {
        try { const x = await picksContract.functions.get_pick({ game: S.GAME_ID, round: String(S.dayNo(d)), player: who }); onChain = !!(x.result && x.result.pick && x.result.pick.producers && x.result.pick.producers[0] === producer); } catch { /* again */ }
        if (!onChain) await new Promise((res) => setTimeout(res, 3000));
      }
      drafts.delete(d);
      { const p = { d, producers: [producer], changes: pick ? Number(pick.changes || 0) + 1 : 0, at: Date.now() }; myPicks.set(d, p); sentPicks.set(`${who}|${d}`, p); unseen.delete(d); mineAt = 0; }
      if (onChain) pickModal("ok", "Pick confirmed", [el("p", {}, "Your pick: ", el("b", { text: nameOf(producer) }), ` for ${dayName(d)}.`),
        `It locks at 23:55 UTC the night before (${localTime(S.lockTime(d))} your time). Until then you can change it (up to ${MAX_CHANGES} times).`,
        id ? el("p", { class: "ago mono", text: `Transaction ${String(id).slice(0, 18)}…` }) : null].filter(Boolean), [okBtn()]);
      else pickModal("info", "Sent, not seen on the chain yet", ["Your wallet sent it. It usually shows within a minute; this list updates by itself."], [okBtn("OK")]);
    } catch (e) {
      const m = String((e && e.message) || e);
      const why2 = /locked/i.test(m) ? "The chain says that day is locked (picks close at 23:55 UTC the night before, by the chain's clock). Your pick wasn't saved."
        : /not open yet/i.test(m) ? "That day isn't open yet (picks open 7 days ahead)."
        : /used up/i.test(m) ? "Today's picks are used up (changes count). More after 00:00 UTC."
        : /changed again/i.test(m) ? `That pick has been changed ${MAX_CHANGES} times already.`
        : /already your pick/i.test(m) ? "That is already your pick."
        : /reject|denied|cancel/i.test(m) ? "Cancelled in your wallet. Nothing was sent."
        : `Not sent: ${m.slice(0, 200)}`;
      pickModal(/Cancelled/.test(why2) ? "info" : "bad", /Cancelled/.test(why2) ? "Cancelled" : "Pick not sent", [why2], [okBtn("OK")]);
    } finally { sending = false; await loadMine(); }
  }

  // ── my season, day by day ──
  function renderMine() {
    const box = $("mine-box"), mine = myRow();
    if (!view || !me() || !mine) { box.hidden = true; return; }
    box.hidden = false;
    const label = { safe: "Safe", life: "Lost a life", skip: "Didn't count (no ruler card)", pending: "Waiting for the result" };
    $("mine-rows").replaceChildren(...mine.log.map((x) => el("tr", { class: x.what === "life" ? "oz" : "" },
      el("td", { class: "num", text: String(x.n) }),
      el("td", { text: dayName(view.days[x.n - 1].day) }),
      el("td", { class: "mono" }, isAddr(x.pick) ? addrLink(x.pick) : el("span", { text: x.pick === null && x.what !== "pending" ? "no pick" : "–" })),
      el("td", {}, el("span", { class: `chip ${x.what === "life" ? "bad" : x.what === "safe" ? "ok" : ""}`, text: label[x.what] })))));
  }

  // ── the season standings: two boards (owner, 30 Oct) ──
  let board = "free";
  function setBoard(b) { board = b; $("board-free").setAttribute("aria-pressed", String(b === "free")); $("board-staked").setAttribute("aria-pressed", String(b === "staked")); renderStandings(); }
  function renderStandings() {
    if (!view || !view.players.length) { $("standings-box").hidden = true; return; }
    $("standings-box").hidden = false;
    const who = me(), rows = placesOf(view.players, board);
    const inNow = view.players.filter((x) => x.outN === null).length;
    $("standings-title").textContent = `Season ${viewSeason} standings`;
    $("standings-sub").textContent = `after day ${view.decided} of ${S.SEASON_DAYS} · ${inNow} of ${view.players.length} still in · the boards are set by the season's first week and are final when that week ends`;
    $("board-note").textContent = board === "staked"
      ? `${rows.length} staked player${rows.length === 1 ? "" : "s"}. ${viewSeason === 1 ? "Season 1 is practice: nothing is paid. " : ""}Each paid week the vault pays the top 30% of that week's staked players from Survivor's bucket.`
      : pays(viewSeason) ? `${rows.length} free player${rows.length === 1 ? "" : "s"}. Free players play for the season prize.`
      : `${rows.length} free player${rows.length === 1 ? "" : "s"}. The Free play board pays no VHP for now: it's for the standings only.`;
    $("standings-rows").replaceChildren(...rows.slice(0, 100).map((x) => el("tr", { class: `${x.outN === null ? "" : "gone"} ${x.a === who ? "me" : ""}` },
      el("td", { class: "num", text: String(x.place) }),
      el("td", { class: "mono" }, addrLink(x.a)),
      el("td", { class: "lives", "aria-label": `${x.lives} lives`, text: x.outN === null ? hearts(x.lives) : `out day ${x.outN}` }),
      el("td", { class: "num", text: fmt(x.total) }),
      el("td", { class: "num hide-sm", text: String(x.days) }))));
    const mine = myRow();
    const myPlace = mine ? placesOf(view.players, mine.board).find((x) => x.a === mine.a) : null;
    $("me-line").textContent = !who ? "" : !mine ? "You're not in this season." : `You: #${myPlace.place} on the ${mine.board === "staked" ? "Staked" : "Free play"} board, ${mine.outN === null ? `${mine.lives} ${mine.lives === 1 ? "life" : "lives"} left` : `out on day ${mine.outN}`}, ${mine.days} day${mine.days === 1 ? "" : "s"} played.`;
  }

  function renderPrizeText() {
    const s = seasonNow(), n = s ? s.season : 1, on = pays(n);
    $("prize-off").hidden = on; $("prize-on").hidden = !on;
  }

  // ── start ──
  if (W && W.subscribe) W.subscribe(() => { loadMine(); });
  $("board-free").addEventListener("click", () => setBoard("free"));
  $("board-staked").addEventListener("click", () => setBoard("staked"));
  (async () => {
    const picksReady = setupPicks().catch(() => {});
    await loadData().catch(() => {});
    renderStandings(); renderMine(); renderDays(true); renderPrizeText();
    await picksReady;
    await refreshBlocks(true);
    renderDays(true);
    setInterval(() => { if (!document.hidden) refreshBlocks().then(() => renderDays()); }, 300000);
    setInterval(() => { if (!document.hidden) loadData().then(() => { renderStandings(); renderMine(); renderDays(); renderPrizeText(); }).catch(() => {}); }, 300000);
    setInterval(() => { if (!document.hidden && picksContract) loadMine(); }, 60000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden && picksContract) { if (Date.now() - mineAt > 60000) mineOk = false; loadMine(); } });
    setInterval(() => { if (!document.hidden) renderDays(); }, 15000);
  })();
}
