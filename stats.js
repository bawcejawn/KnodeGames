/* Live stats (owner, 5 Nov: "build the live stats panel"): reads stats.json, the hourly public summary the stats
   workflow publishes on the stats-data branch (bot/stats.ts), and draws
     - a strip on the home page's first screen (#stats-strip): up to 3 short facts, only ones that read well (launch
       UI research item 18: a small count like "14 players" can put people off, so it waits until it's persuasive);
     - the full panel on the games page (#stats-panel): every number, and last week's top 3 in each game.
   One small file for every visitor: no chain reads (a marketing burst must not hit the public node, I-006).
   Read-only, no storage. Every value is checked (the same rules as bot/stats.ts checkStats and the publish job) and
   drawn with textContent; addresses go through names.js when the page loads it. */
(() => {
  "use strict";
  const URL_ = "https://raw.githubusercontent.com/bawcejawn/KnodeGames/stats-data/stats.json";
  const ADDR = /^1[1-9A-HJ-NP-Za-km-z]{25,34}$/;
  const STALE_MS = 6 * 3600000;          // older than this: the strip hides, the panel says when it was updated
  // The strip shows a number only once it reads well (research item 18).
  const MIN = { staked: 1000, players: 20, plays: 100 };

  // Game names: the same rule as bot/stats.ts BAD_NAME and the publish job (Repo Lens C9-5).
  const BAD_NAME = /[<>\u0000-\u001f\u007f-\u009f\u00a0\u00ad\u034f\u115f\u1160\u180e\u3000\ufff9-\ufffb\u061c\u200b-\u200f\u2028-\u202e\u2060-\u2069\ufeff\u3164]/;
  const int = (n) => Number.isInteger(n) && n >= 0 && n < 1e9;
  const num = (n) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n < 1e12;
  /** The file's shape, or null. */
  function check(s, now = Date.now()) {
    if (!s || s.v !== 1 || typeof s.updated !== "string" || s.updated.length > 40 || !Number.isFinite(Date.parse(s.updated))) return null;
    if (Date.parse(s.updated) - now > 10 * 60000) return null;                         // dated in the future (C9-3)
    if (!s.week || !Number.isInteger(s.week.start) || !Number.isInteger(s.week.end) || s.week.end <= s.week.start) return null;
    const p = s.players, pl = s.plays, st = s.staked, t = s.today, top = s.top;
    if (!p || !int(p.week) || !int(p.lastWeek) || !int(p.allTime)) return null;
    if (!pl || !["answers", "racePicks", "blockxPicks", "total"].every((k) => int(pl[k]))) return null;
    if (!st || !num(st.total) || !Array.isArray(st.games) || st.games.length > 20) return null;
    for (const g of st.games) if (!g || !int(g.id) || typeof g.name !== "string" || !g.name || g.name.length > 40 || BAD_NAME.test(g.name) || !num(g.vhp)) return null;
    if (!s.blocks || !(s.blocks.vault24h === null || int(s.blocks.vault24h))) return null;
    if (!t || !int(t.open) || !int(t.answers) || !(t.closes === null || (Number.isInteger(t.closes) && t.closes > 1.6e12 && t.closes < 4e12))) return null;
    if (!top) return null;
    for (const k of ["questions", "race", "blockx"]) {
      if (!Array.isArray(top[k]) || top[k].length > 5) return null;
      for (const r of top[k]) if (!r || !ADDR.test(r.a) || !int(r.pts) || !int(r.place) || r.place < 1 || r.place > 3) return null;
    }
    return s;
  }
  let loaded = null;
  /** The checked stats, or null (not published yet, unreachable, or not the right shape). One fetch per page. */
  function load() {
    if (!loaded) loaded = (async () => {
      try {
        const r = await fetch(URL_, { cache: "no-cache" });
        if (!r.ok) return null;
        const len = Number(r.headers && r.headers.get && r.headers.get("content-length"));
        if (len > 65536) return null;                                                       // before downloading it (C9-6)
        const text = await r.text();
        if (text.length > 65536) return null;
        return check(JSON.parse(text));
      } catch { return null; }
    })();
    return loaded;
  }

  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const fmt = (n, d = 0) => Number(n).toLocaleString(undefined, { maximumFractionDigits: d });
  const vhpText = (n) => (n >= 10000 ? fmt(Math.round(n)) : fmt(n, n < 100 ? 2 : 0));
  const ago = (iso, now) => {
    const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
    return m < 2 ? "just now" : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
  };
  const left = (ms) => { const m = Math.max(1, Math.round(ms / 60000)), h = Math.floor(m / 60); return h ? `${h}h ${m % 60}m` : `${m}m`; };
  const who = (a) => (window.KNames && typeof window.KNames.of === "function" ? window.KNames.of(a) : `${a.slice(0, 6)}…${a.slice(-4)}`);

  /** "this week", or once its week is over (the file not yet replaced), "the week just ended" (Repo Lens #C-9 fix-check). */
  const weekWord = (s, now) => (now >= s.week.end ? "the week just ended" : "this week");
  /** The strip's facts, strongest first: [value, label]. Free prizes always qualify. */
  function stripFacts(s, now = Date.now()) {
    const out = [];
    if (s.staked.total >= MIN.staked) out.push([`${vhpText(s.staked.total)} VHP`, "staked in the prize vault"]);
    if (s.players.week >= MIN.players) out.push([fmt(s.players.week), "players this week"]);
    if (s.plays.total >= MIN.plays) out.push([fmt(s.plays.total), "answers and picks this week"]);
    if (s.today.closes && s.today.closes > now && s.today.open > 0) out.push([`${s.today.open} open`, `question${s.today.open === 1 ? "" : "s"}, answers close in ${left(s.today.closes - now)}`]);
    out.push(["2 + 1 VHP", "free prizes every week"]);
    return out.slice(0, 3);
  }
  async function strip(box) {
    if (!box) return;
    const s = await load(), now = Date.now();
    // Hidden when old, or once its week is over: "players this week" must not carry into a new week (C9-3).
    if (!s || now - Date.parse(s.updated) > STALE_MS || now >= s.week.end) { box.hidden = true; return; }
    box.replaceChildren(...stripFacts(s, now).map(([v, l]) => { const f = el("span", "stats-fact"); f.append(el("b", null, v), " ", el("span", null, l)); return f; }));
    box.hidden = false;
  }

  const tile = (v, l, sub) => { const t = el("div", "stats-tile"); t.append(el("b", null, v), el("span", null, l)); if (sub) t.append(el("small", null, sub)); return t; };
  function topList(title, rows, unit) {
    const box = el("div", "stats-top");
    box.append(el("h3", null, title));
    if (!rows.length) { box.append(el("p", "stats-none", "No points scored last week.")); return box; }
    const ol = el("ol");
    for (const r of rows) {
      const li = el("li");
      li.append(el("span", "stats-place", `#${r.place}`), el("span", "stats-who", who(r.a)), el("span", "stats-pts", `${fmt(r.pts)} ${unit}${r.pts === 1 ? "" : "s"}`));
      ol.append(li);
    }
    box.append(ol);
    return box;
  }
  async function panel(box) {
    if (!box) return;
    const s = await load(), now = Date.now();
    if (!s) { box.hidden = true; return; }
    const head = el("div", "stats-head");
    head.append(el("h2", null, "Knode Games right now"), el("small", null, `Updated ${ago(s.updated, now)}`));
    const tiles = el("div", "stats-tiles");
    tiles.append(
      tile(fmt(s.players.week), `players ${weekWord(s, now)}`, `${fmt(s.players.lastWeek)} the week before · ${fmt(s.players.allTime)} wallets all time`),
      tile(fmt(s.plays.total), `answers and picks ${weekWord(s, now)}`, `${fmt(s.plays.answers)} answers · ${fmt(s.plays.racePicks)} race picks · ${fmt(s.plays.blockxPicks)} Block X picks`),
      tile(`${vhpText(s.staked.total)} VHP`, "staked in the prize vault", s.staked.games.length ? s.staked.games.map((g) => `${g.name} ${vhpText(g.vhp)}`).join(" · ") : null),
      tile("2 + 1 VHP", "free prizes every week", "for the 2 best free players"),
    );
    if (s.blocks.vault24h !== null) tiles.append(tile(fmt(s.blocks.vault24h), "blocks made by the prize vault", "in the last 24 hours: they fund the prizes"));
    if (s.today.closes && s.today.closes > now) tiles.append(tile(`${fmt(s.today.open)} open`, `question${s.today.open === 1 ? "" : "s"}, answers close in ${left(s.today.closes - now)}`, `${fmt(s.today.answers)} answers so far`));
    const tops = el("div", "stats-tops");
    tops.append(topList("Daily Questions", s.top.questions, "point"), topList("Producer Race", s.top.race, "point"), topList("Who Signs Block X", s.top.blockx, "point"));
    const lw = el("h3", "stats-lw", "Last week's top 3");
    box.replaceChildren(head, tiles, lw, tops);
    if (now >= s.week.end) box.append(el("p", "stats-none", "These are last week's numbers: this week's appear within the hour."));
    else if (now - Date.parse(s.updated) > STALE_MS) box.append(el("p", "stats-none", "These numbers are more than 6 hours old; they refresh every hour when the update runs."));
    box.hidden = false;
    if (!box.dataset.named && window.KNames && typeof window.KNames.onChange === "function") { box.dataset.named = "1"; window.KNames.onChange(() => panel(box)); }
  }

  window.KStats = { load, check, stripFacts, strip, panel, URL: URL_, MIN };
  const start = () => { strip(document.getElementById("stats-strip")); panel(document.getElementById("stats-panel")); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
