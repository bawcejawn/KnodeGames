/* Fantasy Producers: the game page (Koinos MAINNET, Picks games 4 and 5), on the Shared Game Kit's files.
 *
 * Reads (games-data branch, fantasy/ folder, written by the kit's recorder and checked by its publish job):
 *   inputs/W<w>.json   the week's write-once price list (published Saturday 00:00 UTC before the week; FC-9)
 *   W<NNN>.json        the week: players, each day's points per player, the carried teams (`next`), Weekly Rival (`extras`)
 *   board.json         the Staked / Free play board of the latest week
 *   alltime.json       every final week, added up
 * and your picks from the Picks contract. It sends two things, each confirmed in your wallet: your team for a day
 * (Picks game 4, round = the UTC day number) and your rival challenge for a week (Picks game 5, round = that week's
 * Monday day number). The rules are games/fantasy/math.js, the same file the recorder uses. Everything on screen is
 * built with textContent: no HTML strings. Points in the files are hundredths (15000 = 150.00); shown as points. */
import * as F from "./games/fantasy/math.js";

const $ = (id) => document.getElementById(id);
if (typeof document !== "undefined" && $("fx-slots")) start();

function start() {
  "use strict";
  const lib = window.koilib || window.koinos || window;
  const ROOT = new URL("./", location.href);
  const DATA = "https://raw.githubusercontent.com/bawcejawn/KnodeGames/games-data/fantasy/";
  const RPC = ["https://koinos.armana.io", "https://api.koinosblocks.com"];
  const DAY = F.DAY, LEAD = 300000, GAME = F.GAMES.team, RIVAL = F.GAMES.rival;
  let GENESIS = window.KWeeks ? window.KWeeks.GENESIS_MS : 1792368000000, WEEK = 7 * DAY;
  /** Knode's own nodes: in the pool like any other producer, and marked (owner decision 27 Oct). */
  const NAMES = { "1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr": "Knode pool", "1FKTpXBhhHEbu5vVchM8UsVbAvPArJsRmR": "Knode Swap" };

  // ── small helpers ──
  const el = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (v == null) continue; if (k === "text") e.textContent = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); } for (const c of kids) if (c != null && c !== false) e.append(c); return e; };
  const isAddr = F.isAddr;
  const nameOf = (a) => (!isAddr(a) ? "–" : window.KNames && typeof window.KNames.of === "function" ? window.KNames.of(a) : NAMES[a] || a.slice(0, 5) + "…" + a.slice(-4));
  const fmt = (n, d = 0) => (n == null || !Number.isFinite(Number(n)) ? "–" : Number(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }));
  const pts = (h) => (h == null ? null : h / 100);                       // hundredths → points
  const when = (t) => new Date(t).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
  const hm = (t) => new Date(t).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const dur = (ms) => { const m = Math.max(0, Math.ceil(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min` : `${m} min`; };
  const clock = (ms) => { const t = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), x = t % 60; return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}`; };
  const say = (t) => { $("status").textContent = t; $("status").hidden = !t; };
  const same = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i]);
  const WL = (w) => (window.KWeeks ? window.KWeeks.label(w) : `Week ${w - 3}`);
  async function fetchJson(url) { const r = await fetch(url, { cache: "no-cache" }); if (!r.ok) throw new Error(String(r.status)); return r.json(); }
  function colorOf(a) {
    let x = 2166136261;
    for (let i = 0; i < (a || "").length; i++) { x ^= a.charCodeAt(i); x = Math.imul(x, 16777619) >>> 0; }
    const hues = [152, 12, 205, 268, 330, 100, 180, 230, 295, 350];
    return `hsl(${hues[x % hues.length] + ((x >>> 8) % 14) - 7} ${58 + ((x >>> 12) % 18)}% ${46 + ((x >>> 16) % 12)}%)`;
  }
  /** A producer's kit: a shirt in its own colour with a two-letter monogram (SVG built node by node). */
  const SVG = "http://www.w3.org/2000/svg";
  const sv = (tag, attrs) => { const e = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
  const initials = (a) => (!isAddr(a) ? "?" : NAMES[a] ? NAMES[a].split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() : a.slice(1, 3).toUpperCase());
  function kit(a, cls = "") {
    const box = el("span", { class: `fx-kit ${cls}`.trim(), "aria-hidden": "true" });
    box.style.setProperty("--c", colorOf(a));
    const s = sv("svg", { viewBox: "0 0 64 60", focusable: "false" });
    s.append(sv("path", { class: "body", d: "M21 3 9 9 2 24l10 5 3-6v34h34V23l3 6 10-5-7-15-12-6c-2 5-6 8-11 8s-9-3-11-8Z" }),
      sv("path", { class: "trim", d: "M21 3c2 5 6 8 11 8s9-3 11-8l-3-1c-1 4-4 6-8 6s-7-2-8-6Z" }),
      sv("path", { class: "sleeve", d: "M2 24l10 5 1.6-3.2L4 21Zm60 0-10 5-1.6-3.2L60 21Z" }));
    const t = sv("text", { x: "32", y: "42", "text-anchor": "middle" }); t.textContent = initials(a);
    s.append(t); box.append(s);
    return box;
  }
  const nameCell = (a) => el("span", { class: "fx-name" }, kit(a, "sm"), el("span", { class: "nm", text: nameOf(a) }), NAMES[a] ? el("span", { class: "fx-own", title: "One of Knode's own nodes", text: "Knode" }) : null);

  // ── the clock (vault weeks; Monday to Saturday play, Sunday the fun round) ──
  const weekStart = (w) => GENESIS + w * WEEK;
  const weekOf = (t) => Math.floor((t - GENESIS) / WEEK);
  const dayNo = (t) => Math.floor(t / DAY);
  const dayStart = (d) => d * DAY;
  const lockOfDay = (d) => dayStart(d) - LEAD;
  const isPlayDay = (d) => { const o = dayStart(d) - weekStart(weekOf(dayStart(d))); return o >= 0 && o < F.PLAY_DAYS * DAY; };
  const playDays = (w) => F.weekDays(weekStart(w)).slice(0, F.PLAY_DAYS).map(dayNo);
  const sheetTime = (w) => weekStart(w) - 2 * DAY;                    // Saturday 00:00 UTC before the week

  // ── network and wallet ──
  let provider = null, W = null, picks = null, PICKS = null;
  const me = () => (W && W.address) || null;
  async function setupNet() {
    let dep = null, gd = null;
    try { dep = await fetchJson(new URL("picks-data/deployment.json", ROOT)); } catch { /* not live yet */ }
    try { gd = await fetchJson(new URL("game-data/deployment.json", ROOT)); } catch { /* defaults */ }
    if (gd && Number(gd.genesisTime) > 0) GENESIS = Number(gd.genesisTime);
    if (gd && Number(gd.weekLength) > 0) WEEK = Number(gd.weekLength);
    PICKS = dep && isAddr(dep.contract) ? dep.contract : null;
    provider = new lib.Provider(RPC);
    W = window.KWallet || null;
    if (window.KStake && typeof window.KStake.mount === "function" && $("fantasy-stake")) window.KStake.mount($("fantasy-stake"), { game: GAME });
    if (window.KStake && typeof window.KStake.badge === "function" && $("stake-badge")) window.KStake.badge($("stake-badge"), { game: GAME });
    if (W && W.init && PICKS) W.init({ provider, chainId: gd && gd.chainId, payer: gd && gd.payer, sponsor: gd && gd.sponsor, onChange: () => refreshMine() });
    if (PICKS) {
      const abi = await fetchJson(new URL("picks/abi/picks.koilib.json", ROOT));
      picks = new lib.Contract({ id: PICKS, abi, provider });
    }
  }

  // ── the kit's files ──
  const files = { board: null, alltime: null, weeks: new Map(), lists: new Map() };
  const pad = (w) => String(w).padStart(3, "0");
  async function loadFiles() {
    const wNow = weekOf(Date.now());
    const get = async (name) => { try { return await fetchJson(DATA + name); } catch { return null; } };
    const [board, alltime] = await Promise.all([get("board.json"), get("alltime.json")]);
    files.board = board && board.v === 1 ? board : null;
    files.alltime = alltime && alltime.v === 1 ? alltime : null;
    await Promise.all([wNow - 1, wNow, wNow + 1].filter((w) => w >= 0).map(async (w) => {
      const [wf, inp] = await Promise.all([get(`W${pad(w)}.json`), get(`inputs/W${w}.json`)]);
      if (wf && wf.week === w && wf.start === weekStart(w)) files.weeks.set(w, wf); else files.weeks.delete(w);
      if (inp && inp.week === w && inp.data && inp.data.start === weekStart(w) && Array.isArray(inp.data.pool)) files.lists.set(w, inp.data); else files.lists.delete(w);
    }));
  }
  const listOf = (w) => files.lists.get(w) || null;
  /** A wallet's points per day of a week, from the week file: Map(day number → hundredths), and whether the day is decided. */
  function daysOf(wf, who) {
    const out = new Map();
    if (!wf || !who) return out;
    const idx = (wf.players || []).findIndex((p) => p[0] === who);
    for (const r of wf.rounds || []) {
      const [, day, , status, rows] = r;
      const x = idx >= 0 ? (rows || []).find((q) => q[0] === idx) : null;
      out.set(dayNo(day), { status, points: status === "s" ? (x ? x[1] : 0) : null });
    }
    return out;
  }
  /** The team a wallet carries into week w (when it fits w's list): the previous week's final `next`; while that week
   *  isn't final yet, its Saturday team as the page works it out (`saturday`, from your picks), else its pending `next`. */
  function carriedInto(w, who, saturday = null) {
    const prev = files.weeks.get(w - 1), list = listOf(w);
    const fromFile = prev && Array.isArray(prev.next) ? (prev.next.find((x) => x[0] === who) || [])[1] : null;
    const t = prev && prev.final ? fromFile && fromFile.t : saturday || (fromFile && fromFile.t);
    return Array.isArray(t) && list && F.checkTeam(t, list).ok ? t : null;
  }

  // ── your picks (Picks contract) ──
  async function getPick(game, round) {
    const who = me();
    if (!who || !picks) return null;
    try { const x = await picks.functions.get_pick({ game, round: String(round), player: who }); const l = x.result && x.result.pick && x.result.pick.producers; return Array.isArray(l) && l.length ? l : null; } catch { return null; }
  }
  /** The next day you can still pick for (its lock at least a minute away). */
  function targetDay(now = Date.now()) { let d = dayNo(now); while (!isPlayDay(d) || lockOfDay(d) - now < 60000) d++; return d; }
  /** The days you can plan now: up to 7 days ahead, play days only, in weeks whose price list is out. */
  function plannable(now = Date.now()) { const td = targetDay(now), out = []; for (let d = td; d < td + 7; d++) if (isPlayDay(d) && listOf(weekOf(dayStart(d)))) out.push(d); return out; }
  /** The week whose Monday is still open for a rival challenge. */
  function rivalWeek(now = Date.now()) { let w = weekOf(now) + 1; while (lockOfDay(dayNo(weekStart(w))) - now < 60000) w++; return w; }

  let mine = { td: null, sd: null, tw: null, open: [], saved: null, inForce: null, monday: false, carried: null, teams: new Map(), later: [], rivalNow: null, rivalNext: null, rw: null };
  let draft = [], draftFor = null, selDay = null;
  /** Your teams day by day for week w: picks applied with the game's own rules (math.js nextTeam). */
  async function teamsOf(w, saturday = null) {
    const list = listOf(w), out = new Map(), notes = new Map(), picked = new Map();
    if (!list || !me()) return { out, notes, picked };
    let cur = carriedInto(w, me(), saturday);
    const ds = playDays(w), got = await Promise.all(ds.map((d) => getPick(GAME, d)));
    ds.forEach((d, i) => {
      if (got[i]) picked.set(d, got[i]);
      const r = F.nextTeam(cur, got[i], list, i === 0);
      if (r.note) notes.set(d, r.note);
      cur = r.team || null; out.set(d, cur);
    });
    return { out, notes, picked };
  }
  async function refreshMine() {
    const now = Date.now(), td = targetDay(now), open = plannable(now);
    if (selDay !== null && !open.includes(selDay)) selDay = null;
    const sd = selDay ?? td, tw = weekOf(dayStart(sd));
    const next = { td, sd, tw, open, saved: null, inForce: null, monday: false, carried: null, teams: new Map(), notes: new Map(), planned: new Set(), later: [], rivalNow: null, rivalNext: null, rw: rivalWeek(now) };
    if (me() && picks) {
      try {
        const wNow = weekOf(now), cw = await teamsOf(wNow);
        // Planning next week: this week's Saturday team carries into its Monday if it fits the new list.
        const sat = tw > wNow ? cw.out.get(playDays(wNow)[F.PLAY_DAYS - 1]) || null : null;
        const t = tw === wNow ? cw : await teamsOf(tw, sat), ds = playDays(tw), i = ds.indexOf(sd);
        next.saved = t.picked.get(sd) || null;
        for (const d of t.picked.keys()) next.planned.add(d);
        next.carried = carriedInto(tw, me(), sat);
        next.monday = i === 0;
        next.inForce = i > 0 ? t.out.get(ds[i - 1]) || null : next.carried;
        next.later = [...t.notes].filter(([d]) => d > sd).map(([day, note]) => ({ day, note }));
        next.teams = cw.out; next.notes = cw.notes;
        const rv = async (w) => { const l = await getPick(RIVAL, dayNo(weekStart(w))); return l && isAddr(l[0]) ? l[0] : null; };
        [next.rivalNow, next.rivalNext] = await Promise.all([rv(wNow), rv(next.rw)]);
      } catch (e) { say(`Couldn't read your picks: ${String((e && e.message) || e).slice(0, 120)}`); }
    }
    const fresh = draftFor !== `${me()}|${sd}`;
    mine = next;
    if (fresh) { draft = [...(next.saved || next.inForce || [])]; draftFor = `${me()}|${sd}`; }
    render();
  }

  // ── the team sheet ──
  const priceMap = (l) => new Map((l ? l.pool : []).map((p) => [p.a, p.price]));
  const formOfA = (l, a) => { const p = l && l.pool.find((x) => x.a === a); return p ? p.form : null; };
  function add(a) { if (draft.includes(a) || draft.length >= F.TEAM) return; draft.push(a); render(); }
  function remove(a) { draft = draft.filter((x) => x !== a); render(); }
  function captain(a) { if (!draft.includes(a)) return; draft = [a, ...draft.filter((x) => x !== a)]; render(); }
  function sheetWait() {
    const t = sheetTime(mine.tw);
    return Date.now() < t ? `The price list for ${WL(mine.tw)} comes out ${when(t)}. Teams can be saved from then.` : "Waiting for the recorder to publish the price list (it checks every hour).";
  }
  /** What the draft would do, in words, and whether it can be saved. */
  function verdict() {
    const l = listOf(mine.tw);
    if (!l) return { ok: false, text: "" };
    if (!me()) return { ok: false, text: "Connect a wallet to save a team." };
    if (draft.length < F.TEAM) return { ok: false, text: `Add ${F.TEAM - draft.length} more producer${F.TEAM - draft.length > 1 ? "s" : ""}.` };
    const c = F.checkTeam(draft, l);
    if (!c.ok) return { ok: false, bad: true, text: `Can't save: ${c.why}.` };
    if (mine.saved && same(mine.saved, draft)) return { ok: false, text: "This is your saved team." };
    if (mine.monday || !mine.inForce) {
      if (mine.monday && !mine.saved && mine.carried && same(mine.carried, draft)) return { ok: false, text: "No change: last week's team fits the new prices and carries on." };
      return { ok: true, text: `${mine.monday ? "New week: pick any team that fits." : "Your first team."} Cost ${c.cost} of ${l.budget}.` };
    }
    const n = F.changes(mine.inForce, draft);
    if (n > 1) return { ok: false, bad: true, text: `That's ${n} changes from the team before. One a day: a swap, or moving the captain. Undo ${n - 1}.` };
    if (n === 0 && !mine.saved && same(mine.inForce, draft)) return { ok: false, text: "No change: the team carries on." };
    const outs = mine.inForce.filter((a) => !draft.includes(a)), ins = draft.filter((a) => !mine.inForce.includes(a));
    const what = outs.length ? `${nameOf(outs[0])} out, ${nameOf(ins[0])} in${draft[0] === ins[0] ? " as captain" : ""}` : draft[0] !== mine.inForce[0] ? `captain's armband to ${nameOf(draft[0])}` : "same producers, new order";
    return { ok: true, text: `Your one change: ${what}. Cost ${c.cost}.` };
  }
  const dayLabel = (d) => new Date(dayStart(d)).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  function renderPlan() {
    const box = $("fx-plan");
    box.hidden = !mine.open || mine.open.length < 2;
    box.replaceChildren(el("span", { class: "lbl", text: "Plan:" }), ...(mine.open || []).map((d) => el("button", { type: "button", "aria-pressed": String(d === mine.sd),
      title: d === mine.td ? "the next day you can change" : "plan ahead: you can still change it until its own lock",
      onclick: () => { selDay = d === mine.td ? null : d; draftFor = null; refreshMine(); } },
      el("span", { class: "d", text: dayLabel(d) }), el("span", { class: "s", text: mine.planned && mine.planned.has(d) ? "team set" : d === mine.td ? "next up" : "not set" }))));
  }
  function renderRule() {
    const r = $("fx-rule"), l = listOf(mine.tw);
    r.className = "fx-rule";
    if (!l || !me()) { r.hidden = true; return; }
    r.hidden = false;
    if (mine.monday || !mine.inForce) { r.replaceChildren(el("b", { text: mine.monday ? "New week: free changes." : "First team: free changes." }), " Pick any five that fit the budget. After this, it's one change a day."); return; }
    const n = draft.length === F.TEAM ? F.changes(mine.inForce, draft) : Math.min(2, F.TEAM - draft.filter((a) => mine.inForce.includes(a)).length);
    if (n > 1) r.classList.add("bad");
    r.replaceChildren(el("span", { class: "fx-pips", "aria-hidden": "true" }, el("i", { class: n >= 1 ? "on" : "" })),
      el("b", { text: n === 0 ? "1 change left" : n === 1 ? "Change used" : `${n} changes: 1 too many` }), " for this day. A change is swapping one producer, or moving the C (a producer you bring in may take the C as part of its swap).");
  }
  function renderSheet() {
    const l = listOf(mine.tw), now = Date.now(), lock = lockOfDay(mine.sd);
    renderPlan();
    $("fx-for").replaceChildren(`Team for ${when(dayStart(mine.sd))}`, el("span", { class: "fx-for-s", text: `${WL(mine.tw)}${mine.sd !== mine.td ? " · planning ahead" : ""}` }));
    $("fx-lock").replaceChildren(el("span", { text: "Locks in" }), el("b", { text: dur(lock - now) }), el("span", { text: `at ${hm(lock)}, plays from ${hm(dayStart(mine.sd))}` }));
    renderRule();
    const price = priceMap(l);
    $("fx-slots").replaceChildren(...Array.from({ length: F.TEAM }, (_, i) => {
      const a = draft[i];
      if (!a) return el("div", { class: `fx-slot p${i}` }, el("button", { type: "button", class: "fx-open", disabled: l ? null : "", onclick: pickFromList },
        el("span", { class: "fx-kit ghost", "aria-hidden": "true", text: "+" }), el("span", { class: "who", text: i === 0 ? "Add your captain" : "Add a producer" }), el("span", { class: "meta", text: i === 0 ? "scores ×2" : "from the players list" })));
      const f = formOfA(l, a);
      const slot = el("div", { class: `fx-slot p${i} filled` + (i === 0 ? " cap" : "") },
        el("span", { class: "fx-kitwrap" }, kit(a), i === 0 ? el("span", { class: "fx-band", title: "Captain: scores double", text: "C" }) : null),
        el("span", { class: "who", text: nameOf(a) }),
        el("span", { class: "meta" }, el("b", { text: price.has(a) ? String(price.get(a)) : "–" }), ` cost · form ${fmt(pts(f), 0)}`),
        el("span", { class: "acts" },
          i === 0 ? el("span", { class: "fx-capt", text: "Captain ×2" }) : el("button", { type: "button", "aria-label": `Make ${nameOf(a)} captain`, onclick: () => captain(a) }, "Make C"),
          el("button", { type: "button", class: "x", "aria-label": `Remove ${nameOf(a)}`, onclick: () => remove(a) }, "✕")));
      slot.style.setProperty("--c", colorOf(a));
      return slot;
    }));
    const budget = l ? l.budget : F.BUDGET, spent = draft.reduce((t, a) => t + (price.get(a) || 0), 0);
    $("fx-spent").textContent = String(spent); $("fx-budget").textContent = String(budget);
    $("fx-left").textContent = spent <= budget ? `${budget - spent} left` : `${spent - budget} over`;
    $("fx-bar").classList.toggle("over", spent > budget);
    $("fx-bar").firstElementChild.style.setProperty("--p", `${Math.min(100, (spent / budget) * 100)}%`);
    const v = verdict(), chk = $("fx-check");
    chk.textContent = !l ? sheetWait() : v.text;
    chk.className = "fx-check" + (v.bad ? " bad" : v.ok ? " ok" : "");
    $("fx-save").disabled = sending || !picks || (me() ? !v.ok : false);
    $("fx-save").textContent = !me() ? "Connect to save" : mine.saved ? "Save new team" : "Save team";
    $("fx-reset").hidden = same(draft, mine.saved || mine.inForce || []);
    if (mine.later && mine.later.length) { chk.className = "fx-check bad"; chk.textContent = `${v.text ? v.text + " " : ""}Your planned team for ${mine.later.map((x) => dayLabel(x.day)).join(", ")} would be ignored as things stand (${mine.later[0].note.replace(/^ignored: /, "")}). Open that day and save it again.`; }
    $("fx-saved").replaceChildren(...(mine.saved ? ["Saved for this day: ", el("b", { text: mine.saved.map(nameOf).join(", ") })]
      : mine.monday && !mine.carried && me() ? [el("b", { text: "No team carries into this week." }), " Save one, or you score nothing until you do."]
      : mine.inForce ? ["No new team saved: the team before carries on."] : me() ? ["You have no team yet."] : []));
  }
  function pickFromList() {
    const q = $("fx-q"), box = $("pool-box");
    if (box) box.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    if (q) setTimeout(() => q.focus({ preventScroll: true }), 350);
  }

  // ── the price list ──
  let sortBy = "price";
  function renderPool() {
    const l = listOf(mine.tw) || listOf(weekOf(Date.now()));
    const tbody = $("fx-pool").querySelector("tbody");
    if (!l) { tbody.replaceChildren(); $("pool-sub").textContent = ""; $("pool-note").textContent = sheetWait(); return; }
    const key = { price: (r) => -r.price, value: (r) => -((r.form ?? 0) / r.price), form: (r) => -(r.form ?? -1), history: (r) => -r.days }[sortBy];
    const rows = [...l.pool].sort((a, b) => key(a) - key(b) || (a.a < b.a ? -1 : 1));
    const q = ($("fx-q") && $("fx-q").value.trim().toLowerCase()) || "";
    const shown = q ? rows.filter((r) => r.a.toLowerCase().includes(q) || nameOf(r.a).toLowerCase().includes(q)) : rows;
    const full = draft.length >= F.TEAM, price = priceMap(l), spent = draft.reduce((t, a) => t + (price.get(a) || 0), 0);
    const meter = (h) => { const v = pts(h), m = el("span", { class: "fx-meter" + (v == null ? "" : v >= 103 ? " hi" : v < 90 ? " lo" : "") }, el("i"), el("b", { text: v == null ? "–" : fmt(v, 0) })); m.firstChild.style.setProperty("--p", `${v == null ? 0 : Math.max(4, Math.min(100, (v / 150) * 100))}%`); return m; };
    tbody.replaceChildren(...shown.map((r) => {
      const on = draft.includes(r.a), fits = spent + r.price <= l.budget;
      const btn = on ? el("button", { type: "button", class: "rm", "aria-label": `Remove ${nameOf(r.a)}`, onclick: () => remove(r.a) }, "Remove")
        : el("button", { type: "button", class: fits ? null : "over", "aria-label": `Add ${nameOf(r.a)}`, onclick: () => add(r.a), disabled: full || l !== listOf(mine.tw) ? "" : null,
            title: full ? "Your team has 5: remove one first" : fits ? null : "Over the budget with your other picks" }, full || fits ? "Add" : "Add (over)");
      const little = r.days < F.FORM_DAYS;
      return el("tr", { class: on ? "on" : null },
        el("td", {}, el("span", { class: "fx-prod" }, nameCell(r.a), little ? el("span", { class: "fx-steady s0", title: "Its form is from fewer than 7 days, so its price is less certain" }, el("i"), `Little history · ${r.days} of 7 days`) : null)),
        el("td", { class: "num" }, el("span", { class: "fx-price", text: String(r.price) })), el("td", { class: "fx-td-form" }, meter(r.form)),
        el("td", { class: "num hide-sm", text: `${r.days} / ${F.FORM_DAYS}` }), el("td", { class: "num" }, btn));
    }));
    if (!shown.length) tbody.replaceChildren(el("tr", {}, el("td", { colspan: "5", class: "fx-none", text: `No producer matches "${q}".` })));
    $("pool-sub").textContent = `${l.pool.length} producers to choose from. ${full ? "Your team is full: remove one to add another." : `You have ${Math.max(0, l.budget - spent)} left to spend.`}`;
    const w = weekOf(l.start);
    $("pool-note").textContent = `Prices are fixed for ${WL(w)}: published once before it started and never changed. Form is from ${dayLabel(dayNo(F.formDays(l.start)[0] ))} to ${dayLabel(dayNo(F.formDays(l.start)[F.FORM_DAYS - 1]))}; the pool is every producer past the VHP Ruler's form gate.${w !== mine.tw ? ` ${WL(mine.tw)}'s list comes out ${when(sheetTime(mine.tw))}.` : ""}`;
  }

  // ── your week ──
  function renderWeek() {
    const now = Date.now(), wNow = weekOf(now), today = dayNo(now), who = me(), wf = files.weeks.get(wNow);
    const scores = daysOf(wf, who), days = F.weekDays(weekStart(wNow)).map(dayNo);
    $("week-sub").textContent = `${WL(wNow)}: ${dayLabel(dayNo(weekStart(wNow)))} to ${dayLabel(dayNo(weekStart(wNow)) + 6)} (UTC days; Sunday is the fun round)`;
    let total = 0;
    $("fx-days").replaceChildren(...days.map((d, i) => {
      const fun = i === F.PLAY_DAYS, team = mine.teams.get(fun ? days[F.PLAY_DAYS - 1] : d) || null, s = scores.get(d), note = mine.notes && mine.notes.get(d);
      const score = s && s.points != null ? s.points : null;
      if (score != null && !fun) total += score;
      const label = new Date(dayStart(d)).toLocaleString(undefined, { weekday: "short", timeZone: "UTC" });
      const tile = el("div", { class: "fx-day" + (d === today ? " now" : "") + (d > today ? " later" : ""), title: team ? team.map(nameOf).join(", ") : "" },
        el("span", { class: "dl", text: fun ? `${label} · fun` : label }), el("span", { class: "bar", "aria-hidden": "true" }, el("i")),
        el("b", { text: score == null ? (d > today ? "" : s && s.status === "p" ? "…" : "–") : fmt(pts(score), 0) }),
        el("span", { class: "cap", text: s && s.status === "p" && d <= today ? "being checked" : team ? `C ${nameOf(team[0])}` : d > today ? "to come" : "no team" }),
        note ? el("span", { class: "warn", text: note }) : null);
      tile.querySelector(".bar i").style.setProperty("--p", `${score == null ? 0 : Math.max(3, Math.min(100, (pts(score) / 900) * 100))}%`);
      return tile;
    }));
    const row = who && files.board && files.board.lastWeek && files.board.lastWeek.week === wNow ? files.board.lastWeek.rows.find((x) => x.a === who) : null;
    $("you").hidden = !who;
    $("you-pts").textContent = fmt(pts(total), 0);
    $("you-rank").textContent = row ? `#${row.place} ${row.board === "staked" ? "Staked" : "Free play"}` : "–";
    const t = scores.get(today);
    $("you-today").textContent = t && t.points != null ? fmt(pts(t.points), 0) : "–";
    $("you-rival").textContent = mine.rivalNow ? nameOf(mine.rivalNow) : "none";
    $("week-note").textContent = !who ? "Connect a wallet to see your week." : "A day counts once its blocks are irreversible, its ruler card is checked, and two nodes agree; until then it shows “being checked”. Sunday's fun round counts on Today and All time, not the week.";
  }

  // ── the league (board.js, D-081): board.json is the latest week; alltime.json every final week ──
  let lb = null;
  function boardData() {
    const b = files.board && files.board.lastWeek, at = files.alltime;
    const row = (x) => ({ a: x.a, pts: pts(x.pts), boardPlace: x.place, ranked: x.board === "staked", earns: 0 });
    const week = b ? { week: b.week, start: b.start, rows: b.rows.map(row) } : null;
    const allTime = at ? { rows: (at.rows || []).map((x, i) => ({ a: x.a, pts: pts(x.pts), weeks: x.weeks, boardPlace: i + 1, ranked: true })) } : null;
    return { week: b && !b.final ? week : null, lastWeek: b && b.final ? week : null, allTime };
  }
  function renderLeague() {
    if (!window.KBoard || !$("fx-board")) return;
    if (!lb) {
      lb = window.KBoard.create($("fx-board"), {
        label: "Fantasy Producers leaderboard", hide: ["today"],
        columns: [{ key: "pts", label: "Points", d: 1 }],
        summary: (r) => `${fmt(r.pts, 0)} pts`, scored: (r) => r.pts > 0, name: nameOf,
        unranked: "The Staked board is for wallets with at least 1 VHP staked in Fantasy that week (holding VHP, or a stake in another game, doesn't count).",
        free: { show: 6, prize: "No VHP prize on Free play for now." },
      });
    }
    lb.set(boardData()); lb.setMe(me() || "");
  }

  // ── Weekly Rival (records only) ──
  function renderRival() {
    const who = me(), wNow = weekOf(Date.now()), wf = files.weeks.get(wNow), match = $("fx-match");
    const ptsOf = (a) => { const r = files.board && files.board.lastWeek && files.board.lastWeek.week === wNow ? files.board.lastWeek.rows.find((x) => x.a === a) : null; return r ? r.pts : 0; };
    if (!who) match.replaceChildren(el("p", { class: "note", text: "Connect a wallet to see your rival." }));
    else if (mine.rivalNow) {
      const pa = ptsOf(who), pz = ptsOf(mine.rivalNow);
      match.replaceChildren(el("div", { class: "fx-vs" + (pa > pz ? " lead" : pa < pz ? " trail" : "") },
        el("div", { class: "side" }, kit(who), el("span", { class: "nm", text: "You" }), el("b", { text: fmt(pts(pa), 0) })),
        el("span", { class: "mid", text: "vs" }),
        el("div", { class: "side r" }, kit(mine.rivalNow), el("span", { class: "nm", text: nameOf(mine.rivalNow) }), el("b", { text: fmt(pts(pz), 0) }))),
        el("p", { class: "note", text: pa === pz ? "Level so far this week." : `${pa > pz ? "You lead" : "You trail"} by ${fmt(pts(Math.abs(pa - pz)), 0)}. It counts if you are both staked in Fantasy and both score.` }));
    } else match.replaceChildren(el("div", { class: "fx-vs empty" }, el("p", { text: "No rival this week. Challenge someone below for next week." })));
    // Your record over the weeks loaded (records only).
    let won = 0, lost = 0, drawn = 0;
    for (const f of files.weeks.values()) for (const [a, b, , r] of (f.extras && f.extras.rival) || []) {
      if (a !== who && b !== who) continue;
      if (r === "d") drawn++; else if ((r === "a") === (a === who)) won++; else lost++;
    }
    $("fx-rec").replaceChildren(el("div", {}, el("b", { text: `${won}–${lost}–${drawn}` }), "won–lost–drawn (recent weeks)"));
    $("ch-title").textContent = `Challenge someone for ${WL(mine.rw)}`;
    const sel = $("fx-rival-pick"), opts = new Set();
    for (const r of (files.board && files.board.lastWeek && files.board.lastWeek.rows) || []) if (r.a !== who) opts.add(r.a);
    const keep = sel.value;
    sel.replaceChildren(el("option", { value: "", text: opts.size ? "Choose a player…" : "No players yet: paste an address" }), ...[...opts].map((a) => el("option", { value: a, text: nameOf(a) })));
    if (opts.has(keep)) sel.value = keep;
    $("fx-rival-send").disabled = sending || !picks || !who;
    $("rival-note").textContent = !picks ? "Challenges open when the Picks games are live." : mine.rivalNext ? `Your challenge for ${WL(mine.rw)}: ${nameOf(mine.rivalNext)}. You can change it until ${when(lockOfDay(dayNo(weekStart(mine.rw))))}.` : `Locks ${when(lockOfDay(dayNo(weekStart(mine.rw))))}.`;
    void wf;
  }

  // ── sending ──
  let sending = false, modal = null;
  function pop(state, title, lines = [], actions = []) {
    if (!modal) { modal = el("div", { class: "fx-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "fx-m-title" }); modal.addEventListener("click", (e) => { if (e.target === modal && !modal.querySelector(".fx-spin")) closePop(); }); document.body.append(modal); }
    const icon = { busy: el("span", { class: "fx-spin", "aria-hidden": "true" }), ok: el("span", { class: "fx-big ok", text: "✓" }), bad: el("span", { class: "fx-big bad", text: "✗" }), info: el("span", { class: "fx-big", text: "ℹ" }) }[state];
    modal.replaceChildren(el("div", { class: "fx-box" }, icon, el("h3", { id: "fx-m-title", text: title }), ...lines.map((l) => (typeof l === "string" ? el("p", { text: l }) : l)), actions.length ? el("div", { class: "acts" }, ...actions) : null));
    modal.hidden = false;
    const b = modal.querySelector("button"); if (b) b.focus();
  }
  function closePop() { if (modal) modal.hidden = true; }
  const okBtn = (t = "Done") => el("button", { class: "btn btn-primary", type: "button", onclick: closePop }, t);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && modal && !modal.hidden && !modal.querySelector(".fx-spin")) closePop(); });
  function why(e) {
    const m = String((e && e.message) || e);
    return /locked/i.test(m) ? "That one has locked: picks close 5 minutes before the day."
      : /not open yet/i.test(m) ? "That isn't open yet."
      : /used up/i.test(m) ? "Today's picks are used up. More after 00:00 UTC."
      : /already your pick/i.test(m) ? "That is already your pick."
      : /closed|switched off/i.test(m) ? "This game is switched off right now."
      : /pending account resources|insufficient.*(rc|mana|resources)/i.test(m) ? "Your Mana is still held by your last transaction. Try again in a minute."
      : /reject|denied|cancel/i.test(m) ? "Cancelled in your wallet. Nothing was sent."
      : `Not sent: ${m.slice(0, 200)}`;
  }
  async function confirmPick(game, round, list) {
    for (let t = 0; t < 10; t++) { if (same(await getPick(game, round), list)) return true; await new Promise((r) => setTimeout(r, 3000)); }
    return false;
  }
  async function saveTeam() {
    if (!me()) { if (W && W.connect) W.connect(); else say("Connect a wallet first."); return; }
    const v = verdict();
    if (!v.ok || sending || !picks) return;
    const d = mine.sd, list = [...draft];
    if (lockOfDay(d) - Date.now() < 60000) { pop("bad", "Too close to the lock", ["That day locks in under a minute. Try again for the next one."], [okBtn("OK")]); selDay = null; await refreshMine(); return; }
    sending = true; render();
    const what = `C ${nameOf(list[0])}, ${list.slice(1).map(nameOf).join(", ")}`;
    pop("busy", W.kind === "guest" ? "Saving your team…" : `Confirm in ${W.label ? W.label() : "your wallet"}`, [`For ${when(dayStart(d))}: ${what}.`, "Free: the Knode Mana sponsor pays the Mana."]);
    try {
      const { operation } = await picks.functions.pick({ player: me(), game: GAME, round: String(d), producers: list, number: "0" }, { onlyOperation: true });
      const id = await W.send(`Fantasy team for ${when(dayStart(d))}`, [operation]);
      pop("busy", "Sent. Checking the chain…", [what]);
      const ok = await confirmPick(GAME, d, list);
      draftFor = null;
      await refreshMine();
      pop(ok ? "ok" : "info", ok ? "Team saved" : "Sent, not seen yet", [ok ? `It plays from ${when(dayStart(d))} and carries on until you change it. You can change it until ${when(lockOfDay(d))}.` : "Your wallet sent it. It usually shows within a minute.",
        id ? el("p", { class: "mono", text: `Transaction ${String(id).slice(0, 18)}…` }) : null].filter(Boolean), [okBtn()]);
    } catch (e) { const w = why(e); pop(/Cancelled/.test(w) ? "info" : "bad", /Cancelled/.test(w) ? "Cancelled" : "Team not saved", [w], [okBtn("OK")]); }
    finally { sending = false; await refreshMine(); }
  }
  async function sendRival() {
    if (!me()) { if (W && W.connect) W.connect(); return; }
    const typed = $("fx-rival-addr").value.trim(), target = typed || $("fx-rival-pick").value;
    if (!isAddr(target)) { pop("info", "Choose a rival", ["Choose a player from the list, or paste a Koinos wallet address."], [okBtn("OK")]); return; }
    if (target === me()) { pop("info", "Not yourself", ["Choose someone else to challenge."], [okBtn("OK")]); return; }
    if (target === mine.rivalNext) { pop("info", "Already your challenge", [`${nameOf(target)} for ${WL(mine.rw)}.`], [okBtn("OK")]); return; }
    if (sending || !picks) return;
    const rw = mine.rw, round = dayNo(weekStart(rw));
    sending = true; render();
    pop("busy", W.kind === "guest" ? "Sending your challenge…" : `Confirm in ${W.label ? W.label() : "your wallet"}`, [`You challenge ${nameOf(target)} for ${WL(rw)}.`]);
    try {
      const { operation } = await picks.functions.pick({ player: me(), game: RIVAL, round: String(round), producers: [target], number: "0" }, { onlyOperation: true });
      await W.send(`Weekly Rival: challenge ${nameOf(target)}`, [operation]);
      const ok = await confirmPick(RIVAL, round, [target]);
      $("fx-rival-addr").value = "";
      pop(ok ? "ok" : "info", ok ? "Challenge sent" : "Sent, not seen yet", [ok ? `${nameOf(target)} is your rival for ${WL(rw)}. It counts if you are both staked in Fantasy and both score.` : "It usually shows within a minute."], [okBtn()]);
    } catch (e) { const w = why(e); pop(/Cancelled/.test(w) ? "info" : "bad", /Cancelled/.test(w) ? "Cancelled" : "Challenge not sent", [w], [okBtn("OK")]); }
    finally { sending = false; await refreshMine(); }
  }

  // ── the hero and the rest ──
  function renderHero() {
    const now = Date.now(), lock = lockOfDay(mine.td), l = listOf(mine.tw), v = verdict();
    $("fx-kick").textContent = clock(lock - now);
    $("fx-kick-s").textContent = `at ${hm(lock)}. The day starts ${hm(dayStart(mine.td))}.`;
    $("fx-weekline").textContent = `Fantasy Producers · ${WL(weekOf(now))}`;
    let step, act = null;
    if (!picks) step = "Teams open when the Picks games are live. You can look around meanwhile.";
    else if (!me()) step = "Connect a wallet to pick your team.";
    else if (!l) step = sheetWait();
    else if (draft.length < F.TEAM) { step = `Add ${F.TEAM - draft.length} more producer${F.TEAM - draft.length > 1 ? "s" : ""} to your team.`; act = ["Go to players", pickFromList]; }
    else if (v.ok) { step = "Your lineup is ready. Save it before the lock."; act = ["Go to save", () => $("fx-save").scrollIntoView({ block: "center" })]; }
    else if (v.bad) step = v.text;
    else if (mine.saved) step = `You're set for ${when(dayStart(mine.sd))}. Plan a later day or challenge a rival.`;
    else step = mine.inForce ? "Your team plays on. You may make 1 change for the next day (swap a producer or move the C), or leave it." : v.text;
    $("fx-next").replaceChildren(el("span", { class: "fx-next-l", text: "Your move" }), el("span", { class: "fx-next-t", text: step }), act ? el("button", { type: "button", onclick: act[1] }, act[0]) : "");
  }
  function render() { if (mine.td == null) return; renderHero(); renderSheet(); renderPool(); renderWeek(); renderLeague(); renderRival(); }
  const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* fine */ } } };
  function setupGuide() {
    const g = $("fx-guide"), lg = $("fx-legend");
    if (g) {
      g.hidden = store.get("fx-guide") === "hidden";
      $("fx-guide-x").addEventListener("click", () => { g.hidden = true; store.set("fx-guide", "hidden"); });
      $("fx-guide-show").addEventListener("click", () => { g.hidden = false; store.set("fx-guide", ""); g.scrollIntoView({ block: "start" }); });
    }
    if (lg) { if (store.get("fx-legend") === "closed") lg.open = false; lg.addEventListener("toggle", () => store.set("fx-legend", lg.open ? "" : "closed")); }
  }

  (async () => {
    try { await setupNet(); } catch { say("Couldn't load the game settings."); }
    $("fx-save").addEventListener("click", saveTeam);
    $("fx-reset").addEventListener("click", () => { draft = [...(mine.saved || mine.inForce || [])]; render(); });
    $("fx-rival-send").addEventListener("click", sendRival);
    $("fx-q").addEventListener("input", renderPool);
    setupGuide();
    for (const b of document.querySelectorAll("[data-sort]")) b.addEventListener("click", () => { sortBy = b.dataset.sort; for (const x of document.querySelectorAll("[data-sort]")) x.setAttribute("aria-pressed", String(x === b)); renderPool(); });
    if (window.KNames && typeof window.KNames.onChange === "function") window.KNames.onChange(() => { lb = null; render(); });
    if (W && W.subscribe) W.subscribe(() => { draftFor = null; refreshMine(); });
    await loadFiles();
    mine.td = targetDay(); mine.sd = mine.td; mine.tw = weekOf(dayStart(mine.td)); mine.rw = rivalWeek();
    say(!PICKS ? "Teams open when the Knode Games Picks games are live. Until then you can watch the price list and the league." : "");
    await refreshMine();
    setInterval(() => { if (!document.hidden) renderSheet(); }, 15000);
    setInterval(() => { if (!document.hidden && mine.td != null) $("fx-kick").textContent = clock(lockOfDay(mine.td) - Date.now()); }, 1000);
    setInterval(() => { if (!document.hidden) loadFiles().then(refreshMine); }, 300000);
    setInterval(() => { if (!document.hidden && mine.td !== targetDay()) { draftFor = null; refreshMine(); } }, 20000);
  })();
}
