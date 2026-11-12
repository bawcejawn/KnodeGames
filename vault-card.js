/* Knode Games: "The Knode vault" card (owner, 12 Nov: "VHP funds earning ... needs a better home"). One card for the whole
   platform, not for one game: all staked VHP, how it is split across the games, the block rewards the vault has made
   this week, and the time left. It reads stats.json (the hourly public summary, via stats.js): no chain reads, no
   wallet, nothing stored. `rewards` is shown only once the stats file carries it (s.rewards.soFar, VHP after the 5% fee).
   Every value is checked and drawn with textContent. */
(() => {
  "use strict";
  const num = (n) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n < 1e12;
  const fmt = (n, d = 0) => Number(n).toLocaleString(undefined, { maximumFractionDigits: d });
  const vhp = (n) => (n >= 10000 ? fmt(Math.round(n)) : fmt(n, n < 100 ? 2 : 0));
  const left = (ms) => { const m = Math.max(1, Math.round(ms / 60000)), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60); return d ? `${d}d ${h}h` : h ? `${h}h ${m % 60}m` : `${m}m`; };
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const weekName = (s) => (window.KWeeks && s.week && Number.isInteger(s.week.vault) ? window.KWeeks.label(s.week.vault) : window.KWeeks && s.week ? window.KWeeks.label(window.KWeeks.of(s.week.start)) : "This week");

  /** What the card shows, from a checked stats file: { week, staked, games, rewards, blocks, endsAt } or null. */
  function model(s, now = Date.now()) {
    if (!s || !s.staked || !num(s.staked.total) || !s.week) return null;
    const games = (s.staked.games || []).filter((g) => g && num(g.vhp) && g.vhp > 0 && typeof g.name === "string").sort((a, b) => b.vhp - a.vhp);
    const fresh = now < s.week.end && now - Date.parse(s.updated) < 6 * 3600000;   // last week's or an old figure is never shown as this week's
    const r = fresh && s.rewards && num(s.rewards.soFar) && (s.rewards.week === undefined || s.rewards.week === (s.week.vault ?? s.rewards.week)) ? s.rewards.soFar : null;
    return { week: weekName(s), staked: s.staked.total, games, rewards: r, blocks: s.blocks && Number.isInteger(s.blocks.vault24h) ? s.blocks.vault24h : null, endsAt: now < s.week.end ? s.week.end : null, updated: s.updated };
  }
  function stat(value, label, sub) { const d = el("div", "vc-stat"); d.append(el("b", null, value), el("span", null, label)); if (sub) d.append(el("small", null, sub)); return d; }

  /** Draw the card into `box`. Returns false (and hides the box) when there is nothing true to show. */
  function draw(box, s, now = Date.now()) {
    if (!box) return false;
    const m = model(s, now);
    if (!m || !(m.staked > 0)) { box.hidden = true; return false; }
    const head = el("div", "vc-head");
    const img = el("img", "vc-blocky"); img.src = "media/blocky-happy.svg"; img.alt = ""; img.width = 56; img.height = 56;
    const t = el("div", "vc-title"); t.append(el("h2", null, "The Knode vault"), el("p", null, "All staked VHP sits in one vault that makes blocks for every game."));
    head.append(img, t, el("span", "vc-week", m.week));
    const stats = el("div", "vc-stats");
    stats.append(stat(`${vhp(m.staked)} VHP`, "staked, all games"));
    stats.append(m.rewards === null ? stat("Counting…", "block rewards this week", "shown here once the hourly update carries it")
      : stat(`${vhp(m.rewards)} VHP`, "block rewards this week so far", "after the flat 5% fee, shared by stake"));
    if (m.endsAt) stats.append(stat(left(m.endsAt - now), "left in the week", "rewards are shared when it closes"));
    if (m.blocks !== null) stats.append(stat(fmt(m.blocks), "blocks made, last 24 h", "they fund the rewards"));
    const split = el("div", "vc-split");
    split.append(el("h3", null, "How it is shared: each game's part of the stake"));
    const bar = el("div", "vc-bar"); bar.setAttribute("role", "img");
    const total = m.games.reduce((t2, g) => t2 + g.vhp, 0) || 1, legend = el("ul", "vc-legend");
    m.games.forEach((g, i) => {
      const share = g.vhp / total, seg = el("i", `vc-seg c${i % 8}`); seg.style.flexGrow = String(Math.max(share, 0.01));
      bar.append(seg);
      const li = el("li"); const dot = el("span", `vc-dot c${i % 8}`); dot.setAttribute("aria-hidden", "true");
      li.append(dot, el("span", "vc-gn", g.name), el("b", null, `${share < 0.01 ? "<1" : fmt(share * 100, share < 0.1 ? 1 : 0)}%`), el("small", null, `${vhp(g.vhp)} VHP`));
      legend.append(li);
    });
    bar.setAttribute("aria-label", m.games.map((g) => `${g.name} ${fmt((g.vhp / total) * 100, 1)}%`).join(", "));
    split.append(bar, legend);
    const foot = el("p", "vc-foot", "Each week's rewards, after the flat 5% fee, pay the free-game prizes (2 VHP and 1 VHP) first, then are split across the staked games by each game's share of the stake. Your VHP is never spent: you can withdraw it any time.");
    box.replaceChildren(head, stats, m.games.length ? split : el("span"), foot);
    box.hidden = false;
    return true;
  }
  async function mount(id) {
    const box = document.getElementById(id);
    if (!box || !window.KStats || !window.KStats.load) return;
    draw(box, await window.KStats.load());
  }
  window.KVaultCard = { model, draw, mount };
  const start = () => { mount("vault-card"); };
  if (typeof document !== "undefined") { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start(); }
})();
