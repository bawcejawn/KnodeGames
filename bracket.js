/* bracket.html: the Producer Bracket. It reads the bracket recorder's files (games-data/bracket: the seeding, the
   locked brackets, each hour's block counts and the leaderboards), the latest block snapshot (blocks-data) for each
   producer's recent form, and, once the KnodeGames Picks contract is live (picks-data/deployment.json), your bracket
   from the contract. It sends one thing: the bracket you confirm in your wallet, as one number.
   The rules are bracket-math.js, the same file the recorder (bot/games/bracket.ts) uses. */
(() => {
  "use strict";
  const BM = window.KBracketMath;
  if (!BM || typeof document === "undefined" || !document.getElementById("bk-rounds")) return;

  const lib = window.koilib || window.koinos || window;
  const RPC = ["https://koinos.armana.io", "https://api.koinosblocks.com"];
  const DATA = "https://raw.githubusercontent.com/bawcejawn/KnodeGames/games-data/bracket/";
  const BLOCKS = "https://raw.githubusercontent.com/bawcejawn/KnodeGames/blocks-data/recent-blocks.json";
  const EXPLORER = "https://koinosscan.com/address/";
  const SITE = "knodegames.com/bracket.html";
  // The mainnet Picks contract, pinned (Repo Lens #E-3 L-13): the page only ever signs for this one, whatever
  // picks-data/deployment.json says (wallet.js pins the same id for guest wallets).
  const PINNED_PICKS = "1LmgqBGctL9F2YkyjTXgieTXwnYHh8Y6Pm";
  const NAMES = { "1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr": "Knode Games Pool", "1FKTpXBhhHEbu5vVchM8UsVbAvPArJsRmR": "Knode Games Swap node" };
  const OWN = new Set(Object.keys(NAMES));
  const ROOT = new URL("./", location.href);   // the site is served from the repository root
  const W = window.KWallet;
  const provider = lib.Provider ? new lib.Provider(RPC) : null;

  const $ = (id) => document.getElementById(id);
  const el = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (v == null) continue; if (k === "text") e.textContent = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); } for (const c of kids) if (c != null) e.append(c); return e; };
  const isAddr = (a) => typeof a === "string" && /^1[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(a);
  // Producer and player nicknames (D-078): names.js (KNames.of), else our own two nodes' names, else a short address
  const nameOf = (a) => (!isAddr(a) ? "–" : window.KNames && typeof window.KNames.of === "function" ? window.KNames.of(a) : NAMES[a] || a.slice(0, 5) + "…" + a.slice(-4));
  const fmt = (n, d = 0) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }) : "–");
  const dayTime = (t) => new Date(t).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
  const dayName = (t) => new Date(t).toLocaleDateString(undefined, { weekday: "long", timeZone: "UTC" });
  const dur = (ms) => { const m = Math.max(0, Math.ceil(ms / 60000)), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60); return d ? `${d} d ${h} h` : h ? `${h} h ${String(m % 60).padStart(2, "0")} min` : `${m} min`; };
  // What players call a week (weeks.js, D-063): vault week 4 (Mon 16 Nov) = "Week 1"; vault week 3 = "Test week"
  const weekLabel = (w) => (w >= 4 ? `Week ${w - 3}` : w === 3 ? "Test week" : `Week of ${new Date(BM.weekStart(w)).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}`);
  const weekDate = (w) => new Date(BM.weekStart(w)).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const fullTime = (t) => new Date(t).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  // Picks game 9's `ahead` is 46 h (owner 11 Nov): target Tue 00:00 UTC − 46 h = Sun 02:00 UTC, 2 h after the seeding.
  // Before then (or while the Picks game isn't live on chain) the bracket is shown, but can't be filled in or sent.
  const PICKS_OPEN_AFTER_SEED = 2 * 3600000;
  const picksOpenAt = (w) => BM.seedTime(w) + PICKS_OPEN_AFTER_SEED;
  const say = (t) => { $("status").textContent = t; $("status").hidden = !t; };
  async function fetchJson(url) { const r = await fetch(url, { cache: "no-cache" }); if (!r.ok) throw new Error(String(r.status)); return r.json(); }
  const me = () => (W && W.address) || null;

  // ── state ──
  const weeks = new Map();          // week → recorder file
  let board = null, form = new Map(), view = null, round = 0;
  let prizesFrom;                   // index.json prizesFromWeek: the first paid week; null = none yet; undefined = not read
  let picksContract = null, mine = null, sending = false;
  let gameLive = null;              // Picks game 9 on chain: true live, false not (yet) there or paused, null unknown
  let draft = null, draftWeek = null; // winner seeds per round for the bracket being filled in

  // ── data ──
  async function loadWeeks() {
    const now = Date.now(), w = BM.weekOf(now);
    await Promise.all([w - 1, w, w + 1].filter((x) => x >= 1).map(async (x) => {
      try { const j = await fetchJson(`${DATA}W${String(x).padStart(3, "0")}.json`); if (valid(j, x)) weeks.set(x, j); } catch { /* not yet */ }
    }));
    try { const b = await fetchJson(DATA + "board.json"); if (b && b.v === 1) board = b; } catch { /* not yet */ }
    try { const j = await fetchJson(DATA + "index.json"); if (j && j.v === 1) prizesFrom = Number.isInteger(j.prizesFromWeek) && j.prizesFromWeek >= 0 ? j.prizesFromWeek : null; } catch { /* not yet */ }
  }
  /** Only well-formed files are used (the publish job checks the same shape). The version is the one the recorder
   *  writes, from the shared math file (Repo Lens #E-3 H-1). */
  function valid(j, w) {
    if (!j || j.v !== BM.FILE_V || j.week !== w || typeof j.status !== "string") return false;
    const s = j.seeding;
    if (s && !(Array.isArray(s.seeds) && s.seeds.every(isAddr) && [0, 8, 16, 32].includes(s.size) && s.seeds.length === s.size)) return false;
    if (!Array.isArray(j.days) || !Array.isArray(j.points)) return false;
    return true;
  }
  async function loadForm() {
    try {
      const b = await fetchJson(BLOCKS);
      if (!b || !Array.isArray(b.sig) || !Array.isArray(b.signers)) return;
      const n = b.sig.length, cnt = new Map();
      for (const i of b.sig) { const a = b.signers[i]; if (isAddr(a)) cnt.set(a, (cnt.get(a) || 0) + 1); }
      form = new Map([...cnt].map(([a, c]) => [a, { blocks: c, of: n }]));
    } catch { /* no form shown */ }
  }

  // ── which week the page shows ──
  function pickView() {
    const now = Date.now(), w = BM.weekOf(now);
    const next = weeks.get(w + 1);
    if (next && next.seeding && next.seeding.size && now < BM.lockTime(w + 1)) return w + 1;
    // a week with a bracket is shown; otherwise the coming week (its seeding and when picks open), owner 11 Nov
    const cur = weeks.get(w);
    return cur && cur.seeding && cur.seeding.size ? w : w + 1;
  }
  const wf = () => weeks.get(view);
  /** The round being played (or last played) in the shown week; 0 before its first round's day. */
  function currentRound() {
    const s = wf() && wf().seeding; if (!s || !s.size) return 0;
    return Math.max(0, Math.min(BM.roundsOf(s.size) - 1, Math.floor((Date.now() - BM.roundDay(view, 0, s.size)) / BM.DAY)));
  }
  const seeding = () => (wf() && wf().seeding && wf().seeding.size ? wf().seeding : null);
  const isOpen = () => !!seeding() && Date.now() >= picksOpenAt(view) && gameLive !== false && Date.now() < BM.lockTime(view) && !(wf().picks);

  // ── producers ──
  function info(seed) {
    const s = seeding(); if (!s || !seed) return null;
    const a = s.seeds[seed - 1], vhp = s.vhp[seed - 1] || 0, share = s.totalVhp > 0 ? vhp / s.totalVhp : 0;
    const f = form.get(a), exp = f ? f.of * share : 0;
    return { seed, a, vhp, share, perDay: 28800 * share, form: f && exp > 0 ? f.blocks / exp : null };
  }
  function dayIdx(r) {
    const w = wf(); if (!w || !w.days[r]) return null;
    const day = w.days[r], done = day.every(Boolean);
    return { idx: done ? BM.indexFromHours(day) : BM.indexSoFar(day.filter(Boolean)), done, hours: day.filter(Boolean).length };
  }

  // ── the bracket being filled in ──
  function startDraft(empty = false) {
    const s = seeding(); if (!s) { draft = null; return; }
    if (!empty && draftWeek === view && draft) return;
    draftWeek = view;
    const d = !empty && mine !== null ? BM.decode(mine, s.size, s.seeds.length) : null;
    draft = d ? d.rounds.map((r) => [...r]) : Array.from({ length: BM.roundsOf(s.size) }, (_, r) => new Array(s.size / 2 ** (r + 1)).fill(0));
    // byes advance by themselves
    BM.firstRound(s.size, s.seeds.length).forEach(([a, b], m) => { if (!b) draft[0][m] = a; });
  }
  /** The two seeds meeting in matchup m of round r, given the draft (0 = not decided yet). */
  function pairOf(r, m) {
    const s = seeding();
    if (r === 0) return BM.firstRound(s.size, s.seeds.length)[m];
    const a = draft[r - 1][2 * m], b = draft[r - 1][2 * m + 1];
    return a && b ? [Math.min(a, b), Math.max(a, b)] : [a || 0, b || 0].sort((x, y) => (x && y ? x - y : y - x));
  }
  function choose(r, m, seed) {
    if (!isOpen() || sending) return;
    const old = draft[r][m];
    draft[r][m] = seed;
    // a later pick that relied on the seed that just lost is cleared
    if (old && old !== seed) for (let k = r + 1, mm = m >> 1; k < draft.length; k++, mm >>= 1) if (draft[k][mm] === old) draft[k][mm] = 0;
    render();
  }
  const filled = () => draft && draft.every((r) => r.every((x) => x > 0));
  const draftNumber = () => { const s = seeding(); try { return filled() ? BM.encode(draft, s.size, s.seeds.length) : null; } catch { return null; } };
  function autoFill(kind) {
    const s = seeding(); if (!s || !isOpen()) return;
    draft = BM.play(s.size, s.seeds.length, (r, m, a, b) => (kind === "underdog" ? true : kind === "form" ? (info(b).form ?? 1) > (info(a).form ?? 1) : false)).rounds.map((x) => [...x]);
    render();
  }

  // ── picks contract ──
  async function setupPicks() {
    let pdep = null, dep = null;
    try { pdep = await fetchJson(new URL("picks-data/deployment.json", ROOT)); } catch { return; }
    if (!pdep || pdep.contract !== PINNED_PICKS || !provider) return;   // #E-3 L-13
    try { dep = await fetchJson(new URL("game-data/deployment.json", ROOT)); } catch { /* defaults */ }
    const abi = await fetchJson(new URL("picks/abi/picks.koilib.json", ROOT));
    picksContract = new lib.Contract({ id: pdep.contract, abi, provider });
    // Is Picks game 9 live? (announced but not applied yet = no game; a failed read = unknown, the chain decides)
    try { const r = await picksContract.functions.get_game({ game: BM.GAME_ID }); const g = r && r.result && r.result.game; gameLive = g ? g.enabled !== false : false; } catch { gameLive = null; }
    if (W) W.init({ provider, chainId: dep && dep.chainId, payer: dep && dep.payer, sponsor: dep && dep.sponsor, onChange: () => loadMine() });
    $("picks-soon").hidden = true;
  }
  async function loadMine() {
    // #E-3 C-2: a bracket being checked or sent is never swapped under the pop-up: an open check is closed (it was for
    // the old draft), and while a bracket is being sent nothing is reloaded (the send reloads when it's done)
    if (sending) return;
    if (checking) { checking = null; close(); }
    mine = null;
    const who = me();
    if (picksContract && who && seeding()) {
      try {
        const x = await picksContract.functions.get_pick({ game: BM.GAME_ID, round: String(BM.picksRound(view)), player: who });
        const p = x.result && x.result.pick;
        if (p && p.number !== undefined && (p.height || p.time)) mine = Number(p.number);
      } catch { /* unknown */ }
    }
    if (mine === null && wf() && wf().picks && who) { const row = wf().picks.rows.find((r) => r[0] === who); if (row) mine = row[1]; }
    draftWeek = null; startDraft(); render();
  }

  // ── drawing ──
  function render() {
    const w = wf(), s = seeding(), now = Date.now();
    renderPractice();
    // the week line
    const lines = [];
    if (!w && view) lines.push(now < BM.seedTime(view) ? `${weekLabel(view)}: the bracket is seeded ${fullTime(BM.seedTime(view))} (in ${dur(BM.seedTime(view) - now)}), and picks open ${fullTime(picksOpenAt(view))}.` : "Waiting for the recorder…");
    else if (w && (w.status === "none" || w.status === "void")) lines.push(`${weekLabel(view)}: no bracket. ${w.void || ""}`);
    else if (s && !w.picks && now < BM.lockTime(view) && now < picksOpenAt(view)) lines.push(`${weekLabel(view)}: ${s.size}-producer bracket, seeded. Picks open ${fullTime(picksOpenAt(view))} (in ${dur(picksOpenAt(view) - now)}) and lock ${fullTime(BM.lockTime(view))}.`);
    else if (s && !w.picks && now < BM.lockTime(view) && gameLive === false) lines.push(`${weekLabel(view)}: ${s.size}-producer bracket, seeded. Picks open as soon as the Bracket's Picks game is live on the chain (it isn't yet). Picks lock ${fullTime(BM.lockTime(view))}.`);
    else if (s && isOpen()) lines.push(`${weekLabel(view)}: ${s.size}-producer bracket. Picks lock ${dayTime(BM.lockTime(view))} (in ${dur(BM.lockTime(view) - now)}).`);
    else if (s && w.status === "final") lines.push(`${weekLabel(view)}: final.`);
    else if (s && now >= BM.weekStart(view + 1) - BM.DAY) lines.push(`${weekLabel(view)}: in review (Sunday is review day: results are checked and paid from Monday).`);
    else if (s) { const r = currentRound(), d0 = BM.roundDay(view, 0, s.size); lines.push(`${weekLabel(view)}: locked. ${now < d0 ? `${BM.ROUND_NAMES[s.size][0]} starts ${dayName(d0)} 00:00 UTC.` : `${BM.ROUND_NAMES[s.size][r]} today (UTC).`}`); }
    $("week-line").textContent = lines.join(" ");
    $("week-tabs").replaceChildren(...[...weeks.keys()].sort((a, b) => b - a).filter((x) => weeks.get(x).seeding).map((x) =>
      el("button", { type: "button", "aria-pressed": String(x === view), onclick: () => { view = x; round = currentRound(); draftWeek = null; loadMine(); } }, x > BM.weekOf(now) ? "Next week" : x === BM.weekOf(now) ? "This week" : "Last week")));
    $("bracket-box").hidden = !s;
    $("own-note").hidden = !(s && s.seeds.some((a) => OWN.has(a)));
    if (!s) { $("bk-rounds").replaceChildren(); $("bk-list").replaceChildren(); $("bk-actions").hidden = true; return; }
    startDraft();
    const R = BM.roundsOf(s.size);
    if (round >= R) round = 0;
    $("bk-rounds").replaceChildren(...BM.ROUND_NAMES[s.size].map((n, r) => el("button", { type: "button", "aria-pressed": String(r === round), onclick: () => { round = r; render(); } },
      el("span", { text: n }), el("small", { text: dayName(BM.roundDay(view, r, s.size)).slice(0, 3) }))));
    const open = isOpen(), res = w.results, di = dayIdx(round), byes = new Set(BM.byesOf(s.size, s.seeds.length));
    $("bk-day").textContent = `${BM.ROUND_NAMES[s.size][round]} · played ${dayName(BM.roundDay(view, round, s.size))} (UTC)${di && di.hours && !di.done ? ` · ${di.hours} of 24 hours in` : ""} · ${2 ** round} point${round ? "s" : ""} a right pick${round === R - 1 ? ", +2 for the champion" : ""}`;
    const list = [];
    const nM = s.size / 2 ** (round + 1);
    for (let m = 0; m < nM; m++) {
      const [a, b] = open || !res ? pairOf(round, m) : realPair(round, m);
      const bye = round === 0 && byes.has(m);
      const winner = res && res.rounds[round] ? res.rounds[round][m] : 0;
      const myPick = draft ? draft[round][m] : 0;
      const side = (seed) => {
        if (!seed) return el("div", { class: "bk-side tbd" }, el("span", { class: "bk-seed", text: "" }), el("span", { text: bye ? "Bye" : "Winner of the match before" }));
        const p = info(seed), ix = di && di.idx ? di.idx.get(p.a) : null, pooled = (s.pooled || []).includes(p.a);
        const cls = ["bk-side", myPick === seed ? "picked" : "", winner === seed ? "won" : "", winner && winner !== seed ? "lost" : ""].join(" ").trim();
        const meta = [`${fmt(p.share * 100, p.share < 0.01 ? 2 : 1)}% VHP`, `~${fmt(p.perDay)} blocks/day`, p.form !== null ? `recent form ${fmt(p.form * 100)}%` : null].filter(Boolean).join(" · ");
        const kids = [el("span", { class: "bk-seed", text: String(seed) }),
          el("span", { class: "bk-name" }, el("b", { text: nameOf(p.a) }), el("small", { text: meta })),
          ix && !pooled && BM.forfeits(ix, p.vhp) ? el("span", { class: "bk-ix", text: "under half", title: `Averaged ${fmt(ix.avg / 1e8)} VHP over the day, under half its seeding ${fmt(p.vhp)} VHP: it loses this matchup, unless its opponent is under half too (then the blocks decide)` })
            : ix && BM.scoreOf(ix, pooled)[1] > 0 ? el("span", { class: "bk-ix", text: `${fmt(BM.indexOf(ix, pooled) * 100, 1)}%`, title: pooled ? `${fmt(ix.blocks)} blocks; judged on its rate (the Knode Games Pool)` : `${fmt(ix.blocks)} blocks of ${fmt(ix.expected, 1)} expected` }) : null,
          myPick === seed && !bye && (open || mine !== null) ? el("span", { class: "bk-mark", text: winner ? (winner === seed ? "✓" : "✗") : "★" }) : null];
        if (open && !bye && seed) return el("button", { type: "button", class: cls, "aria-pressed": String(myPick === seed), onclick: () => choose(round, m, seed) }, ...kids);
        return el("div", { class: cls }, ...kids);
      };
      list.push(el("div", { class: "bk-match" + (bye ? " bye" : "") }, side(a), el("div", { class: "bk-vs", text: bye ? "bye" : "v" }), side(b)));
    }
    $("bk-list").replaceChildren(...list);
    // actions
    const who = me();
    $("bk-actions").hidden = !open;
    if (open) {
      const total = draft.flat().length, done = draft.flat().filter(Boolean).length;
      $("bk-progress").textContent = `${done} of ${total} picked${filled() ? " · ready" : ""}${mine !== null ? " · you have a bracket on chain" : ""}`;
      $("bk-submit").disabled = !filled() || sending || !picksContract || !who || draftNumber() === mine;
      $("bk-submit").textContent = mine !== null ? "Change my bracket" : "Submit my bracket";
      $("bk-who").textContent = !picksContract ? "" : who ? `Picking as ${nameOf(who)}${W.kind === "guest" ? " (guest: you play on the Free play board)" : ""}.` : "Connect a wallet to submit (Kondor, KOIN Vault or a guest wallet).";
    }
    $("bk-share").hidden = !(draft && filled());
    renderScore();
  }
  /** The real pair in a round once results are in (or the winners so far). */
  function realPair(r, m) {
    const s = seeding(), res = wf().results;
    if (r === 0) return BM.firstRound(s.size, s.seeds.length)[m];
    const prev = res && res.rounds[r - 1];
    if (!prev) return [0, 0];
    const a = prev[2 * m], b = prev[2 * m + 1];
    return [Math.min(a, b), Math.max(a, b)];
  }
  function renderScore() {
    const w = wf(), who = me();
    const row = w && who ? w.points.find((p) => p[0] === who) : null;
    const s = seeding();
    $("bk-score").textContent = !row ? "" : `Your bracket: ${row[1]} point${row[1] === 1 ? "" : "s"} so far, ${row[3]} right${row[2] ? ", champion right" : ""}. Most possible: ${BM.maxPoints(s.size)}.`;
  }

  // ── the confirm pop-up ──
  let modal = null;
  function pop(state, title, lines = [], actions = []) {
    if (!modal) {
      modal = el("div", { class: "pk-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "pk-m-title" });
      modal.addEventListener("click", (e) => { if (e.target === modal && !modal.querySelector(".pk-spin")) close(); });
      document.body.append(modal);
    }
    const icon = { busy: el("span", { class: "pk-spin", "aria-hidden": "true" }), ok: el("span", { class: "pk-big ok", text: "✓" }), bad: el("span", { class: "pk-big bad", text: "✗" }), info: el("span", { class: "pk-big", text: "ℹ" }) }[state];
    modal.replaceChildren(el("div", { class: `pk-box ${state}` }, icon, el("h3", { id: "pk-m-title", text: title }), ...lines.map((l) => (typeof l === "string" ? el("p", { text: l }) : l)),
      actions.length ? el("div", { class: "pk-acts" }, ...actions) : null));
    modal.hidden = false;
    setInert(true);   // #E-3 C-2: the page behind the pop-up can't be used (no account switch by keyboard)
    const btn = modal.querySelector("button"); if (btn) btn.focus();
  }
  function setInert(on) { for (const e of document.querySelectorAll("header.top, main, nav.tabbar")) { if (on) e.setAttribute("inert", ""); else e.removeAttribute("inert"); } }
  function close() { if (modal) modal.hidden = true; setInert(false); checking = null; }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && modal && !modal.hidden && !modal.querySelector(".pk-spin")) close(); });
  const btn = (text, onclick, cls = "btn") => el("button", { class: cls, type: "button", onclick }, text);

  /** What a bracket NUMBER says, for the pop-ups (#E-3 C-2: always the number being signed, never the draft). */
  function summaryOf(n, s) {
    const d = BM.decode(n, s.size, s.seeds.length), names = BM.ROUND_NAMES[s.size];
    if (!d) return [el("p", { text: "This isn't a whole bracket." })];
    const champ = d.rounds[d.rounds.length - 1][0];
    const out = [el("p", {}, "Champion: ", el("b", { text: `${champ} · ${nameOf(s.seeds[champ - 1])}` }))];
    for (let r = d.rounds.length - 2; r >= Math.max(0, d.rounds.length - 3); r--) out.push(el("p", { text: `${names[r]} winners: ${d.rounds[r].map((x) => `${x} ${nameOf(s.seeds[x - 1])}`).join(", ")}` }));
    return out;
  }
  const LOCK_MARGIN = 120000;   // too close to the lock: two minutes, by the chain's clock at send time (#E-3 L-2)
  let checking = null;          // { n, account, week, seeds } frozen when "Check your bracket" opens (#E-3 C-2)
  // fix-check RC-3: a wallet request that may still be approved (KOIN Vault keeps it open after its window closes).
  // While one is open, no other bracket is sent from this page: if the old one were approved last, it would win.
  // Fix-check 2 W-1: the lock is kept in localStorage per account and week (a reload or a second tab sees it), lasts until
  // KOIN Vault's own expiry of the request when the wallet knows it (else OPEN_REQUEST_MS), and is also set when the answer
  // to a send was lost on the network (the request or transaction may still go through). The Picks contract keeps the LAST
  // pick, so an older request approved last would replace the newer bracket.
  let openRequestUntil = 0;
  const OPEN_REQUEST_MS = 30 * 60000, OPEN_REQUEST_MAX = 2 * 3600000;
  const openKey = (a, w) => `kb-open-request:${a}:${w}`;
  function openLockUntil(a, w) {
    let t = 0;
    try { t = Number(localStorage.getItem(openKey(a, w))) || 0; } catch { /* storage blocked: the in-page lock below */ }
    return Math.max(t, openRequestUntil);
  }
  function setOpenLock(a, w, e) {
    const now = Date.now(), x = e && Number(e.openUntil);
    const until = Number.isFinite(x) && x > now ? Math.min(x, now + OPEN_REQUEST_MAX) : now + OPEN_REQUEST_MS;
    try { localStorage.setItem(openKey(a, w), String(until)); } catch { /* the in-page lock still holds */ }
    return until;
  }
  /** On a definite answer (on the chain, refused, rejected) the request can't land any more: the lock goes. */
  function clearOpenLock(a, w) {
    openRequestUntil = 0;
    try { localStorage.removeItem(openKey(a, w)); } catch { /* nothing kept */ }
  }
  async function chainNow() {
    try { const h = await provider.getHeadInfo(); const t = Number(h && h.head_block_time); if (Number.isFinite(t) && t > 0) return t; } catch { /* below */ }
    return Date.now();
  }
  function review() {
    const n = draftNumber(), who = me(), s = seeding();
    if (n === null || !who || !picksContract || !s) return;
    const lockedUntil = openLockUntil(who, view);
    if (Date.now() < lockedUntil) return pop("info", "A bracket request is still open in your wallet", [`Approve or reject it in your wallet first. If it goes through, that bracket is the one that counts; this page shows it once it's on the chain. You can send a new one after it's settled, or after ${dayTime(lockedUntil)}.`], [btn("OK", close)]);
    if (BM.lockTime(view) - Date.now() < LOCK_MARGIN) return pop("bad", "Too close to the lock", [`Brackets lock ${dayTime(BM.lockTime(view))}. This one can't make it in time.`], [btn("OK", close)]);
    const frozen = { n, account: who, week: view, seeds: s.seeds.join(","), size: s.size };
    pop("info", "Check your bracket", [...summaryOf(n, s),
      el("p", { class: "ago", text: `Sent to the chain as one number: ${n}, from ${nameOf(who)}. You can change it until ${dayTime(BM.lockTime(view))}, up to ${BM.MAX_CHANGES} times.` })],
      [btn("Back", close, "btn btn-ghost"), btn("Confirm in wallet", () => send(frozen))]);
    checking = frozen;
  }
  /** Sends exactly the bracket that was checked, from the account it was checked for, or nothing (#E-3 C-2). */
  async function send(frozen) {
    const who = me(), s = seeding();
    if (!frozen || sending) return;
    if (checking !== frozen || !who || who !== frozen.account || view !== frozen.week || !s || s.seeds.join(",") !== frozen.seeds || draftNumber() !== frozen.n || !picksContract) {
      checking = null; return pop("bad", "Your bracket changed", ["Your bracket, wallet or week changed while you were checking it. Nothing was sent: check it again."], [btn("OK", close)]);
    }
    checking = null;
    if (BM.lockTime(frozen.week) - (await chainNow()) < LOCK_MARGIN) return pop("bad", "Too close to the lock", [`Brackets lock ${dayTime(BM.lockTime(frozen.week))} by the chain's clock. Nothing was sent.`], [btn("OK", close)]);
    // Repo Lens #E-26 E26-1: checked again at Confirm, not only when the review opened: another tab may have sent since
    const lockedUntil = openLockUntil(frozen.account, frozen.week);
    if (Date.now() < lockedUntil) return pop("info", "A bracket request is still open in your wallet", [`Approve or reject it in your wallet first. If it goes through, that bracket is the one that counts; this page shows it once it's on the chain. You can send a new one after it's settled, or after ${dayTime(lockedUntil)}.`], [btn("OK", close)]);
    const n = frozen.n, wk = frozen.week, summary = () => summaryOf(n, s);
    sending = true; render();
    const wallet = W.kind === "guest" ? "your guest wallet" : W.label ? W.label() : "your wallet";
    pop("busy", W.kind === "guest" ? "Sending your bracket…" : `Confirm in ${wallet}`, [...summary(), "The Knode Games Mana sponsor pays the Mana."]);
    try {
      const { operation } = await picksContract.functions.pick({ player: frozen.account, game: BM.GAME_ID, round: String(BM.picksRound(wk)), producers: [], number: String(n) }, { onlyOperation: true });
      // #B-15 B15-4: the lock is written BEFORE the wallet is asked, so a reload or a second tab while the request
      // waits for approval (KOIN Vault, on a phone often in another app) can't send a second bracket
      openRequestUntil = setOpenLock(frozen.account, wk, null);   // localStorage, per account and week
      const id = await W.send(`your bracket for week ${wk + 1}`, [operation]);
      clearOpenLock(frozen.account, wk);
      pop("busy", "Sent. Checking the chain…", summary());
      let seen = false;
      for (let t = 0; t < 10 && !seen; t++) {
        try { const x = await picksContract.functions.get_pick({ game: BM.GAME_ID, round: String(BM.picksRound(wk)), player: frozen.account }); seen = !!(x.result && x.result.pick && Number(x.result.pick.number) === n); } catch { /* again */ }
        if (!seen) await new Promise((r) => setTimeout(r, 3000));
      }
      if (seen) pop("ok", "Bracket confirmed", [...summary(), id ? el("p", { class: "ago mono", text: `Transaction ${String(id).slice(0, 18)}…` }) : null].filter(Boolean), [btn("Done", close)]);
      else pop("info", "Sent, not seen on the chain yet", ["Your wallet sent it. It usually shows within a minute; this page updates by itself."], [btn("OK", close)]);
    } catch (e) {
      const m = String((e && e.message) || e);
      // fix-check RC-3: "still waiting" (the window was closed) and "no answer in time" mean the request may still be
      // approved in KOIN Vault: never "Cancelled … Nothing was sent"
      // (#E-26 E26-2: also any error the wallet marks as maybe open (openUntil), or a server error (5xx), whatever its text)
      const maybeOpen = !!e && typeof e === "object" && ("openUntil" in e || Number(e.status) >= 500);
      if (maybeOpen || /still waiting|no answer from koin vault|check the wallet before trying again|failed to fetch|networkerror|network error|load failed/i.test(m)) {
        openRequestUntil = setOpenLock(frozen.account, wk, e);   // localStorage, per account and week, to KOIN Vault's expiry (fix-check 2 W-1)
        return pop("info", "Still open in your wallet", [/still waiting|no answer from koin vault/i.test(m) ? "Your bracket request is still open in KOIN Vault: approve or reject it there." : "The wallet's answer was lost or failed on its side, so this bracket may still go through.",
          `Don't send another bracket until it's settled (this page waits until ${dayTime(openRequestUntil)}); it shows here once it's on the chain.`], [btn("OK", close)]);
      }
      const why = /locked/i.test(m) ? "Brackets are locked: they close Monday 23:55 UTC."
        : /not open yet/i.test(m) ? "Picks for this week aren't open yet (they open at the seeding, Sunday 00:00 UTC)."
        : /used up/i.test(m) ? "Today's picks are used up. More after 00:00 UTC."
        : /changed again/i.test(m) ? `This bracket has been changed ${BM.MAX_CHANGES} times already.`
        : /already your pick/i.test(m) ? "That is already your bracket."
        : /cancelled in koin vault|\breject(ed)?\b|denied|cancel/i.test(m) ? "Cancelled in your wallet. Nothing was sent."
        : `Not sent: ${m.slice(0, 200)}`;
      clearOpenLock(frozen.account, wk);   // a definite answer (refused, rejected, failed): this request can't land
      pop(/Cancelled/.test(why) ? "info" : "bad", /Cancelled/.test(why) ? "Cancelled" : "Bracket not sent", [why], [btn("OK", close)]);
    } finally { sending = false; await loadMine(); }
  }

  // ── share image: drawn on a canvas, saved or shared as a PNG ──
  function shareImage() {
    const s = seeding(); if (!s || !filled()) return;
    const c = document.createElement("canvas"), W1 = 1080, H1 = 1350; c.width = W1; c.height = H1;
    const g = c.getContext("2d"); if (!g) return;
    const css = getComputedStyle(document.documentElement);
    const ink = css.getPropertyValue("--ink").trim() || "#14213D", paper = css.getPropertyValue("--paper").trim() || "#FFF8EC", acc = css.getPropertyValue("--tang").trim() || "#F28C28";
    g.fillStyle = paper; g.fillRect(0, 0, W1, H1);
    g.fillStyle = ink; g.font = "800 64px system-ui, sans-serif"; g.fillText("My Producer Bracket", 64, 120);
    g.font = "400 34px system-ui, sans-serif"; g.fillText(`Knode Games · ${weekLabel(view)} · ${s.size} producers`, 64, 176);
    const champ = draft[draft.length - 1][0];
    g.fillStyle = acc; g.fillRect(64, 220, W1 - 128, 150);
    g.fillStyle = "#1b1206"; g.font = "700 34px system-ui, sans-serif"; g.fillText("🏆 Champion", 96, 280);
    g.font = "800 52px system-ui, sans-serif"; g.fillText(`${champ} · ${nameOf(s.seeds[champ - 1])}`, 96, 345);
    g.fillStyle = ink; let y = 450;
    const names = BM.ROUND_NAMES[s.size];
    for (let r = draft.length - 2; r >= 0 && y < H1 - 120; r--) {
      g.font = "700 32px system-ui, sans-serif"; g.fillText(`${names[r]} winners`, 64, y); y += 46;
      g.font = "400 28px system-ui, sans-serif";
      const items = draft[r].map((x) => `${x} ${nameOf(s.seeds[x - 1])}`);
      for (let i = 0; i < items.length && y < H1 - 120; i += 2) { g.fillText(items.slice(i, i + 2).join("     "), 84, y); y += 40; }
      y += 22;
    }
    g.font = "400 28px system-ui, sans-serif"; g.fillText(SITE, 64, H1 - 60);
    c.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `knodegames-bracket-${weekLabel(view).toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`, { type: "image/png" });
      try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: "My Producer Bracket" }); return; } } catch { /* fall back to a download */ }
      const a = el("a", { href: URL.createObjectURL(blob), download: file.name });
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    }, "image/png");
  }

  // ── leaderboard (shared component) ──
  const lb = window.KBoard ? window.KBoard.create($("bk-board"), {
    label: "Bracket leaderboard", hide: ["today"],
    // Staked: wallets with 1 VHP or more staked in the Bracket that week (the Vault's player rule); Free play: the rest
    // owner 11 Nov: the free prize is OFF for now (the recorder gives free-play medals only when game 9's switch is on)
    free: { show: 6, prize: "The Free play board pays no VHP prize for now. Players staked in the Producer Bracket share its weekly bucket." },
    unranked: "To be on the Staked board, stake at least 1 VHP in the Producer Bracket before the week starts.",
    columns: [{ key: "pts", label: "Points" }, { key: "correct", label: "Right" }],
    scored: (r) => r.pts > 0,
    summary: (r) => `${fmt(r.pts)} pts · ${fmt(r.correct)} right${r.champion ? " · champion ✓" : ""}`,
    name: nameOf, link: (a) => EXPLORER + a,
    me: (r, place) => `${place ? `You: #${place} with` : "Your bracket:"} ${fmt(r.pts)} points (${fmt(r.correct)} right${r.champion ? ", champion right" : ""}).`,
    // medals follow the recorder's `earns` (leaderboard standard §4): 1 / 2 the free prize, 3 a share of the Staked bucket
    freeWinners: (part, free, weekly) => new Map(weekly ? free.filter((r) => r.earns === 1 || r.earns === 2).map((r) => [r.a, r.earns]) : []),
    earned: (r, weekly) => weekly && r.earns === 3,
  }) : null;
  /** Owner 11 Nov: the week on show (this week or next week's picks), if before the first paid week (index.json prizesFromWeek) is practice, and the page says so. */
  function practiceText(w) {
    if (prizesFrom === undefined) return "";
    if (prizesFrom !== null && w >= prizesFrom) return "";
    return `${weekLabel(w)} is a practice week: brackets, points and both leaderboards count for fun only, and no VHP is paid for it. `
      + (prizesFrom === null ? "The first paid week will be announced here." : `Staked rewards start ${weekLabel(prizesFrom)}, the week of ${weekDate(prizesFrom)}.`);
  }
  function renderPractice() { const t = practiceText(Number.isInteger(view) ? view : BM.weekOf(Date.now())), p = $("bk-practice"); if (p) { p.textContent = t; p.hidden = !t; } }
  function renderBoard() { renderPractice(); if (lb && board) { $("board-box").hidden = false; lb.setMe(me() || ""); lb.set(board); } }

  // ── start ──
  $("bk-submit").addEventListener("click", review);
  $("bk-share").addEventListener("click", shareImage);
  $("bk-fill-chalk").addEventListener("click", () => autoFill("chalk"));
  $("bk-fill-form").addEventListener("click", () => autoFill("form"));
  $("bk-clear").addEventListener("click", () => { if (isOpen() && !sending) { startDraft(true); render(); } });
  if (W && W.subscribe) W.subscribe(() => { loadMine(); renderBoard(); });
  // the shared stake badge and panel (R-ALL-7), game 9
  if (window.KStake && typeof window.KStake.badge === "function" && $("stake-badge")) window.KStake.badge($("stake-badge"), { game: BM.GAME_ID });
  if (window.KStake && typeof window.KStake.mount === "function" && $("bracket-stake")) window.KStake.mount($("bracket-stake"), { game: BM.GAME_ID });
  if (window.KNames && typeof window.KNames.onChange === "function") window.KNames.onChange(() => { render(); renderBoard(); });
  (async () => {
    say("Loading the bracket…");
    await Promise.all([loadWeeks(), loadForm(), setupPicks().catch(() => {})]);
    view = pickView(); round = currentRound(); say("");
    await loadMine(); renderBoard();
    setInterval(() => { if (!document.hidden) loadWeeks().then(() => { render(); renderBoard(); }); }, 300000);
    setInterval(() => { if (!document.hidden) render(); }, 60000);
  })();
})();
