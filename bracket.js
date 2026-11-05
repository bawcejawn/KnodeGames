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
  const say = (t) => { $("status").textContent = t; $("status").hidden = !t; };
  async function fetchJson(url) { const r = await fetch(url, { cache: "no-cache" }); if (!r.ok) throw new Error(String(r.status)); return r.json(); }
  const me = () => (W && W.address) || null;

  // ── state ──
  const weeks = new Map();          // week → recorder file
  let board = null, form = new Map(), view = null, round = 0;
  let picksContract = null, mine = null, sending = false;
  let draft = null, draftWeek = null; // winner seeds per round for the bracket being filled in

  // ── data ──
  async function loadWeeks() {
    const now = Date.now(), w = BM.weekOf(now);
    await Promise.all([w - 1, w, w + 1].filter((x) => x >= 1).map(async (x) => {
      try { const j = await fetchJson(`${DATA}W${String(x).padStart(3, "0")}.json`); if (valid(j, x)) weeks.set(x, j); } catch { /* not yet */ }
    }));
    try { const b = await fetchJson(DATA + "board.json"); if (b && b.v === 1) board = b; } catch { /* not yet */ }
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
    if (weeks.get(w)) return w;
    return next ? w + 1 : w;
  }
  const wf = () => weeks.get(view);
  /** The round being played (or last played) in the shown week; 0 before its first round's day. */
  function currentRound() {
    const s = wf() && wf().seeding; if (!s || !s.size) return 0;
    return Math.max(0, Math.min(BM.roundsOf(s.size) - 1, Math.floor((Date.now() - BM.roundDay(view, 0, s.size)) / BM.DAY)));
  }
  const seeding = () => (wf() && wf().seeding && wf().seeding.size ? wf().seeding : null);
  const isOpen = () => !!seeding() && Date.now() < BM.lockTime(view) && !(wf().picks);

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
    // the week line
    const lines = [];
    if (!w && view) lines.push(now < BM.seedTime(view) ? `The next bracket is seeded ${dayTime(BM.seedTime(view))} (in ${dur(BM.seedTime(view) - now)}).` : "Waiting for the recorder…");
    else if (w && (w.status === "none" || w.status === "void")) lines.push(`Week ${view + 1}: no bracket. ${w.void || ""}`);
    else if (s && isOpen()) lines.push(`Week ${view + 1}: ${s.size}-producer bracket. Picks lock ${dayTime(BM.lockTime(view))} (in ${dur(BM.lockTime(view) - now)}).`);
    else if (s && w.status === "final") lines.push(`Week ${view + 1}: final.`);
    else if (s && now >= BM.weekStart(view + 1) - BM.DAY) lines.push(`Week ${view + 1}: in review (Sunday is review day: results are checked and paid from Monday).`);
    else if (s) { const r = currentRound(), d0 = BM.roundDay(view, 0, s.size); lines.push(`Week ${view + 1}: locked. ${now < d0 ? `${BM.ROUND_NAMES[s.size][0]} starts ${dayName(d0)} 00:00 UTC.` : `${BM.ROUND_NAMES[s.size][r]} today (UTC).`}`); }
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
  async function chainNow() {
    try { const h = await provider.getHeadInfo(); const t = Number(h && h.head_block_time); if (Number.isFinite(t) && t > 0) return t; } catch { /* below */ }
    return Date.now();
  }
  function review() {
    const n = draftNumber(), who = me(), s = seeding();
    if (n === null || !who || !picksContract || !s) return;
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
    const n = frozen.n, wk = frozen.week, summary = () => summaryOf(n, s);
    sending = true; render();
    const wallet = W.kind === "guest" ? "your guest wallet" : W.label ? W.label() : "your wallet";
    pop("busy", W.kind === "guest" ? "Sending your bracket…" : `Confirm in ${wallet}`, [...summary(), "The Knode Games Mana sponsor pays the Mana."]);
    try {
      const { operation } = await picksContract.functions.pick({ player: frozen.account, game: BM.GAME_ID, round: String(BM.picksRound(wk)), producers: [], number: String(n) }, { onlyOperation: true });
      const id = await W.send(`your bracket for week ${wk + 1}`, [operation]);
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
      const why = /locked/i.test(m) ? "Brackets are locked: they close Monday 23:55 UTC."
        : /not open yet/i.test(m) ? "Picks for this week aren't open yet (they open at the seeding, Sunday 00:00 UTC)."
        : /used up/i.test(m) ? "Today's picks are used up. More after 00:00 UTC."
        : /changed again/i.test(m) ? `This bracket has been changed ${BM.MAX_CHANGES} times already.`
        : /already your pick/i.test(m) ? "That is already your bracket."
        : /reject|denied|cancel/i.test(m) ? "Cancelled in your wallet. Nothing was sent."
        : `Not sent: ${m.slice(0, 200)}`;
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
    g.font = "400 34px system-ui, sans-serif"; g.fillText(`Knode Games · week ${view + 1} · ${s.size} producers`, 64, 176);
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
      const file = new File([blob], `knodegames-bracket-week${view + 1}.png`, { type: "image/png" });
      try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: "My Producer Bracket" }); return; } } catch { /* fall back to a download */ }
      const a = el("a", { href: URL.createObjectURL(blob), download: file.name });
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    }, "image/png");
  }

  // ── leaderboard (shared component) ──
  const lb = window.KBoard ? window.KBoard.create($("bk-board"), {
    label: "Bracket leaderboard", hide: ["today"],
    // Staked: wallets with 1 VHP or more staked in the Bracket that week (the Vault's player rule); Free play: the rest
    free: { show: 6, prize: "Weekly free-play prize: tied for 1st share all 3 VHP; otherwise 2 VHP to 1st and 1 VHP shared by those tied 2nd (up to 10 a place)." },
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
  function renderBoard() { if (lb && board) { $("board-box").hidden = false; lb.setMe(me() || ""); lb.set(board); } }

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
