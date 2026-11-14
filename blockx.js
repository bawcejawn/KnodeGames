/* Who Signs Block X: the game page. One script for two pages:
 *   blockx.html          Koinos MAINNET: the live game (Picks game 2).
 *   blockx-testnet.html  the Koinos Foundation TESTNET (<meta name="kg-network" content="testnet">): test KOIN only,
 *                        settings from testnet/blockx.json, its own wallet (testnet-wallet.js), its own data branch.
 * It reads the chain's head block, the handicap card (mainnet: the Producer Race recorder's; testnet: the Block X
 * recorder's own), the recorder's results and leaderboard, and your picks from the Picks contract. It sends one thing:
 * a pick you confirm in your wallet. The scoring is blockx-math.js, the same file the recorder uses. */
(() => {
  "use strict";
  const X = window.KBlockX, M = window.KRaceMath;
  if (!X || !M || typeof document === "undefined" || !document.getElementById("targets")) return;

  const lib = window.koilib || window.koinos || window;
  const MAINNET_CHAIN_ID = "EiBZK_GGVP0H_fXVAM3j6EAuz3-B-l3ejxRSewi7qIBfSA==";
  const meta = document.querySelector('meta[name="kg-network"]');
  const TESTNET = !!(meta && meta.getAttribute("content") === "testnet");
  const ROOT = new URL("./", location.href);
  const NAMES = { "1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr": "Knode pool", "1FKTpXBhhHEbu5vVchM8UsVbAvPArJsRmR": "Knode Swap" };

  const $ = (id) => document.getElementById(id);
  const el = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (v == null) continue; if (k === "text") e.textContent = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); } for (const c of kids) if (c != null) e.append(c); return e; };
  const isAddr = (a) => typeof a === "string" && /^1[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(a);
  // Producer and player nicknames (D-078): names.js (KNames.of: the name with the short address, never the name
  // alone). Without it (the testnet page doesn't load it), the short address.
  const nameOf = (a) => (!isAddr(a) ? "–" : window.KNames && typeof window.KNames.of === "function" ? window.KNames.of(a) : NAMES[a] || a.slice(0, 5) + "…" + a.slice(-4));
  const fmt = (n, d = 0) => Number(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
  const pts = (h) => fmt(h / 100, 2);
  const clock = (t) => new Date(t).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const dayTime = (t) => new Date(t).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
  const dur = (ms) => { const m = Math.max(0, Math.ceil(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min` : `${m} min`; };
  const say = (t) => { $("status").textContent = t; $("status").hidden = !t; };
  async function fetchJson(url) { const r = await fetch(url, { cache: "no-cache" }); if (!r.ok) throw new Error(String(r.status)); return r.json(); }

  // ── the network ──
  // NET: { rpc, data (this game's data folder), cards ("race" | "self"), game settings, picks contract, wallet, words }
  let NET = null, G = X, provider = null, W = null;
  // R-BX-25: mainnet Block X is game 2 (every 2,400 blocks) until Mon 9 Nov 2026 00:00 UTC, then hourly game 12 (every
  // 1,200). PERIOD is the shown game's weeks; VAULT_GAME is the vault game for stakes (2 throughout).
  let PERIOD = { from: -Infinity, to: Infinity }, VAULT_GAME = X.VAULT_GAME;
  async function setupNet() {
    if (!TESTNET) {
      let picks = null;
      try { const d = await fetchJson(new URL("picks-data/deployment.json", ROOT)); if (isAddr(d.contract)) picks = d.contract; } catch { /* not live yet */ }
      NET = { rpc: Math.random() < 0.5 ? ["https://koinos.armana.io", "https://api.koinosblocks.com"] : ["https://api.koinosblocks.com", "https://koinos.armana.io"], data: "https://raw.githubusercontent.com/bawcejawn/KnodeGames/games-data/blockx/", raceData: "https://raw.githubusercontent.com/bawcejawn/KnodeGames/race-data/",
        cards: "race", picks, explorer: "https://koinosscan.com/address/", chainId: MAINNET_CHAIN_ID,
        prize: "1st and 2nd at the end of the week win the free-play prize (2 and 1 VHP, from Week 1, the week of Mon 16 Nov)." };
      // The game whose weeks contain now, or the one the #game-N link asks for; both as tabs around the switch.
      const now = Date.now(), want = /^#game-(\d+)$/.exec(location.hash);
      const games = X.MAINNET_SCHEDULE.map((e) => ({ ...e.game, ...X.periodOf(e), name: e.game.id === X.MAINNET_HOURLY.id ? `Hourly (from ${new Date(X.periodOf(e).from).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })})` : "Every 2 hours" }));
      const game = games.find((g) => want && g.id === Number(want[1])) || games.find((g) => now >= g.from && now < g.to) || games[0];
      G = X.forGame(game);
      PERIOD = { from: game.from, to: game.to };
      const sw = X.periodOf(X.MAINNET_SCHEDULE[1]).from;
      if (now >= sw - 2 * X.DAY && now < sw + 7 * X.DAY) { NET.games = games; renderGameTabs(); }
      fillWords();
      provider = new lib.Provider(NET.rpc);
      W = window.KWallet || null;
      return;
    }
    const cfg = await fetchJson(new URL("testnet/blockx.json", ROOT));
    if (!cfg || cfg.network !== "koinos-foundation-testnet" || cfg.chainId === MAINNET_CHAIN_ID) throw new Error("This page's testnet settings are missing or name mainnet.");
    const want = /^#game-(\d+)$/.exec(location.hash), games = Array.isArray(cfg.games) ? cfg.games : [];
    const game = games.find((g) => want && g.id === Number(want[1])) || games[0];
    G = X.forGame(game);
    VAULT_GAME = G.GAME_ID;
    // On the owner's own computer (npm run testnet-site), the recorder's files in testnet-data/ on that computer.
    const local = location.hostname === "localhost" || location.hostname === "127.0.0.1";
    const data = local ? new URL(`testnet-data/blockx-${game.id}/`, ROOT).href : `${cfg.data}blockx-${game.id}/`;
    NET = { rpc: [cfg.rpc], data, cards: "self", picks: isAddr(cfg.picks) ? cfg.picks : null, explorer: null, chainId: cfg.chainId,
      faucet: cfg.faucet, games, game, prize: "Test prizes only: on the testnet nothing is paid, and nothing here counts on mainnet." };
    provider = new lib.Provider(NET.rpc);
    const id = await provider.getChainId();
    if (id === MAINNET_CHAIN_ID || (NET.chainId && id !== NET.chainId)) throw new Error("The node isn't the testnet in this page's settings.");
    NET.chainId = NET.chainId || id;
    W = window.KTestWallet || null;
    if (W) W.init({ provider, chainId: NET.chainId, picks: NET.picks, sponsor: isAddr(cfg.sponsor) ? cfg.sponsor : null });   // sponsor v3 trial
    // The page's fixed wording, for this game's own settings (the fast game has a target every 300 blocks).
    fillWords();
    renderGameTabs();
  }
  /** The page's fixed wording, for the shown game's own settings (Repo Lens #E-23 L-2: open targets, picks a day, the
   *  multiplier's cap). The testnet's fast game has a target every 300 blocks. */
  function fillWords() {
    const mins = Math.round(G.ROUND * X.BLOCK_MS / 60000), about = mins >= 90 ? `about every ${Math.round(mins / 60)} hours` : `about every ${mins} minutes`;
    const words = { every: `Every ${G.ROUND.toLocaleString("en-US")} blocks (${about})`, round: G.ROUND.toLocaleString("en-US"), about, perday: String(G.PICKS_PER_DAY),
      changes: String(G.MAX_CHANGES), changesw: G.MAX_CHANGES === 1 ? "once" : `up to ${G.MAX_CHANGES} times`,
      open: String(Math.floor((G.AHEAD - G.LEAD) / G.ROUND)), cap: String(X.capAt(Math.min(Math.max(Date.now(), PERIOD.from), PERIOD.to - 1))) };   // B14-5: a past game's own cap
    for (const e of document.querySelectorAll("[data-bx]")) { const w = words[e.getAttribute("data-bx")]; if (w) e.textContent = w; }
  }
  /** Testnet: one button per game in the settings (the real settings, and the fast test game). */
  function renderGameTabs() {
    const box = $("game-tabs");
    if (!box || !NET.games) return;
    box.hidden = NET.games.length < 2;
    box.replaceChildren(...NET.games.map((g) => el("a", { href: `#game-${g.id}`, class: "btn" + (g.id === G.GAME_ID ? "" : " ghost"), "aria-current": g.id === G.GAME_ID ? "page" : null, text: g.name })));
    window.addEventListener("hashchange", () => location.reload());
  }

  let head = null;                 // { height, time }
  let card = null, cardAt = 0;     // the handicap card in force now
  let picksContract = null, myPicks = new Map(), usage = null, sending = false;
  let weeks = new Map(), board = null;
  const drafts = new Map();
  const me = () => (W && W.address) || null;

  async function readHead() {
    const prev = head ? head.height : 0;
    // Capacity A4: on mainnet, the live file from our own node (fresh, checked by data-source.js) gives the head and the
    // chain strip without asking a node. Block counts and the strip only: cards and scores come from the game files.
    const lv = !TESTNET && window.KGData ? await window.KGData.live() : null;
    if (lv) {
      head = { height: lv.head.height, time: lv.head.time, id: lv.head.id, seenAt: Date.now() };
      if ($("chain") && head.height !== prev) {
        const got = lv.blocks.slice(-24).filter((b) => isAddr(b.signer)).map((b) => ({ h: b.h, signer: b.signer }));
        if (got.length) { recent = got; renderChain(prev); if (!card) renderTargets(true); }
      }
      return head;
    }
    const h = await provider.getHeadInfo();
    head = { height: Number(h.head_topology.height), time: Number(h.head_block_time), id: h.head_topology.id, seenAt: Date.now() };
    if ($("chain") && head.height !== prev) readRecent(prev).catch(() => {});
    return head;
  }
  // The chain strip: who signed the latest blocks (one read of up to 24 blocks per new head).
  let recent = [];   // [{ h, signer }], oldest first
  async function readRecent(prev) {
    const n = 24, from = Math.max(1, head.height - n + 1);
    const r = await provider.call("block_store.get_blocks_by_height", { head_block_id: head.id, ancestor_start_height: String(from), num_blocks: n, return_block: true, return_receipt: false });
    const got = ((r && r.block_items) || []).map((it) => ({ h: Number(it.block_height), signer: String(it.block && it.block.header && it.block.header.signer || "") })).filter((b) => isAddr(b.signer));
    if (got.length) { recent = got; renderChain(prev); if (!card) renderTargets(true); }
  }
  /** One colour per producer, from its address, the same everywhere on the page. */
  function colorOf(a) {
    let x = 2166136261;
    for (let i = 0; i < (a || "").length; i++) { x ^= a.charCodeAt(i); x = Math.imul(x, 16777619) >>> 0; }
    const hues = [152, 12, 205, 268, 330, 100, 180, 230, 295, 350];   // none near the sun-yellow target tile
    return `hsl(${hues[x % hues.length] + ((x >>> 8) % 14) - 7} ${58 + ((x >>> 12) % 18)}% ${46 + ((x >>> 16) % 12)}%)`;
  }
  const dot = (a, cls = "bx-dot") => { const d = el("span", { class: cls, "aria-hidden": "true" }); d.style.setProperty("--c", colorOf(a)); return d; };
  function renderChain(prev) {
    const box = $("chain");
    if (!box) return;
    box.replaceChildren(...recent.map((b) => { const t = dot(b.signer, "bx-blk" + (prev && b.h > prev ? " new" : "")); t.title = `Block ${fmt(b.h)} · ${nameOf(b.signer)}`; return t; }));
  }
  const about = (h) => X.aboutTime(h, head.height, head.time);
  /** R-BX-25: only rounds inside the shown game's weeks, 10 minutes clear of either edge (a block can land a little early
   *  or late; one that lands in the other game's weeks isn't scored). */
  const inPlay = (r) => { const t = about(G.target(r)); return t >= PERIOD.from + 10 * 60000 && t < PERIOD.to - 10 * 60000; };
  const offer = () => G.offerRounds(head.height).filter(inPlay);

  // ── the producers and their multipliers ──
  async function loadCard() {
    const now = Date.now();
    try {
      if (NET.cards === "self") {
        const j = await fetchJson(NET.data + "cards.json");
        const cs = j && j.v === 1 && Array.isArray(j.cards) ? j.cards.filter((c) => c && Number.isFinite(c.at) && Array.isArray(c.field)) : [];
        const c = cs.sort((a, b) => b.at - a.at)[0];
        if (c) { card = c; cardAt = c.at; }
        return;
      }
      const ra = M.raceAt(now), w = M.weekOf(ra.start);
      const wf = await fetchJson(`${NET.raceData}W${String(w).padStart(3, "0")}.json`);
      const race = wf && Array.isArray(wf.races) ? wf.races.find((r) => r && r.id === ra.id) : null;
      const c = race && Array.isArray(race.cards) ? M.cardForLeg(race.cards, M.legOf(ra.start, now, M.legsOf(race.cards))) : null;
      if (c && Array.isArray(c.field) && c.field.length) { card = c; cardAt = now; }
    } catch { /* keep the last card */ }
  }
  function producers() {
    // Audit BX-24: on mainnet, pick only from the handicap card (the recorder scores from it); no card, no chips.
    if (!card && !TESTNET) return [];
    if (!card) {
      // Testnet: no handicap card yet (the recorder's first run): offer the producers seen signing just now, multiplier unknown.
      const seen = new Map(); for (const b of recent) seen.set(b.signer, (seen.get(b.signer) || 0) + 1);
      const tot = recent.length || 1;
      return [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([a, n]) => ({ a, share: n / tot, mult: null }));
    }
    const { m } = X.vhpOf(card), tot = [...m.values()].reduce((s, v) => s + v, 0);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([a, v]) => ({ a, share: tot ? v / tot : 0, mult: X.multiplier(card, a, Date.now()) }));
  }

  // ── the Picks contract ──
  async function setupPicks() {
    if (!NET.picks) return;
    const abi = await fetchJson(new URL("picks/abi/picks.koilib.json", ROOT));
    const c = new lib.Contract({ id: NET.picks, abi, provider });
    // R-BX-25: the hourly game (12) may not be on the contract yet (announced, then applied 48 h later): until it is,
    // its tab shows the targets with "Picks open soon" instead of offering picks the contract would refuse.
    if (!TESTNET) {
      let on = false;
      // (A failed read keeps picks on, as before: the contract refuses a pick for a game it doesn't have anyway.)
      try { const g = (await c.functions.get_game({ game: G.GAME_ID })).result; on = !!(g && g.game && g.game.enabled); } catch { on = true; }
      if (!on) return;
    }
    picksContract = c;
    if (!TESTNET && W) {
      let dep = null;
      try { dep = await fetchJson(new URL("game-data/deployment.json", ROOT)); } catch { /* the wallet keeps its defaults */ }
      W.init({ provider, chainId: dep && dep.chainId, payer: dep && dep.payer, sponsor: dep && dep.sponsor, onChange: () => loadMine() });
    }
    $("picks-soon").hidden = true;
    loadMine();
  }
  async function loadMine() {
    if (!picksContract || !head) { renderTargets(true); return; }
    const who = me();
    myPicks = new Map(); usage = null;
    if (who) {
      const rounds = G.openRounds(head.height).filter(inPlay);
      try {
        const got = await Promise.all(rounds.map((r) => picksContract.functions.get_pick({ game: G.GAME_ID, round: String(r), player: who })
          .then((x) => [r, x.result && x.result.pick && Array.isArray(x.result.pick.producers) ? x.result.pick : null])));
        for (const [r, p] of got) if (p) myPicks.set(r, p);
        usage = (await picksContract.functions.get_usage({ game: G.GAME_ID, player: who })).result || null;
      } catch { /* shown as unknown */ }
    }
    renderTargets(true);
  }

  // ── the stage (the next target) and the open targets ──
  const multText = (m) => (m == null ? "×?" : `×${fmt(m, 2)}`);
  const shareText = (x) => `${fmt(x * 100, x < 0.01 ? 2 : 0)}%`;
  /** Seconds until a height, from the head and ~3 s a block, counting down between heads. */
  const secsTo = (h) => Math.max(0, Math.round(((h - head.height) * X.BLOCK_MS - (Date.now() - head.seenAt)) / 1000));
  const mmss = (t) => { const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), x = t % 60; return h ? `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}` : `${m}:${String(x).padStart(2, "0")}`; };
  function renderStage() {
    if (!head || !$("stage")) return;
    const rounds = offer(), r = rounds[0];
    if (r == null) return;
    const x = G.target(r), lock = G.lockHeight(r), mine = myPicks.get(r), mineP = mine && mine.producers && mine.producers[0];
    $("head-num").textContent = fmt(head.height);
    $("head-line").textContent = `target block ${fmt(x)} · about ${clock(about(x))}`;
    $("gap-num").textContent = fmt(Math.max(0, x - head.height));
    $("x-num").textContent = fmt(x);
    const left = secsTo(lock);
    $("lock-clock").textContent = mmss(left);
    const line = $("lock-line");
    line.replaceChildren(...[el("b", { id: "lock-clock", text: mmss(left) }), `until picks lock for block ${fmt(x)}`,
      mineP ? el("span", { class: "mine", text: `Your pick: ${nameOf(mineP)}` }) : null].filter(Boolean));
    const span = G.ROUND, done = Math.min(span, Math.max(0, head.height - (lock - span)));
    $("lock-bar").style.setProperty("--p", `${(done / span) * 100}%`);
    $("cta").textContent = mineP ? "Change your pick" : "Pick who signs it";
  }
  let targetsKey = "";
  function renderTargets(force = false) {
    if (!head) return;
    renderStage();
    const list = $("targets");
    // D-129 (WEEK_CYCLE.md §2): Sunday (UTC) targets are fun rounds, offered and scored for Today and All time, never
    // the week. (One due in Saturday's last 10 minutes may slip past midnight, so it says so too.)
    const funAt = (r) => X.restDay(about(G.target(r)));
    // Repo Lens #E-18 F-1: one due in Saturday's last 10 minutes may land either side of midnight.
    const edgeAt = (r) => { const t = about(G.target(r)); return !X.restDay(t) && X.restDay(t + 10 * 60000); };
    const who = me(), rounds = offer(), ps = producers(), funs = rounds.filter((r) => funAt(r) || edgeAt(r)).length;
    const key = JSON.stringify([who, W && W.kind, rounds[0], funs, sending, !!picksContract, cardAt, ps.map((p) => p.a).join(), usage && usage.picks_today, [...myPicks.entries()].map(([r, p]) => [r, p.producers && p.producers[0], p.changes]), [...drafts.entries()]]);
    if (!force && key === targetsKey && list.childElementCount) { updateTimes(); return; }
    targetsKey = key;
    const max = usage ? Number(usage.max_picks_per_day) || G.PICKS_PER_DAY : G.PICKS_PER_DAY, used = usage ? Number(usage.picks_today) || 0 : 0;
    $("picks-left").textContent = usage ? `${Math.max(0, max - used)} of ${max} picks left today` : "";
    renderYou();
    const whoLine = $("picks-who");
    whoLine.replaceChildren();
    if (!card && ps.length) whoLine.append("Showing the producers signing right now. Multipliers appear with the first handicap card (the recorder takes one within the hour).");
    if (!card && !TESTNET && picksContract && rounds.length) whoLine.append("Picks open when the next handicap card is published (within the hour).");
    if (funs) whoLine.append(el("span", { class: "bx-rest", text: " Sunday is review day: results are checked and paid from Monday. Sunday (UTC) targets are fun rounds: they count on Today and All time, not the week." }));
    // R-BX-25: once the every-2-hours game's last target has passed, point to the hourly game.
    const ended = PERIOD.to !== Infinity && about(head.height) >= PERIOD.to - 10 * 60000 - G.LEAD * X.BLOCK_MS;
    if (!picksContract || !rounds.length) { list.replaceChildren(el("div", { class: "bx-empty" }, !picksContract ? "Picks open soon." : ended ? el("span", {}, `Block X is hourly from ${new Date(X.periodOf(X.MAINNET_SCHEDULE[1]).from).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}: `, el("a", { href: `#game-${X.MAINNET_HOURLY.id}`, text: "pick the hourly targets" }), ".") : "No target is open right now.")); return; }
    const cards = rounds.map((r, i) => {
      const h = G.target(r), mine = myPicks.get(r), mineP = mine && mine.producers && mine.producers[0];
      const choice = drafts.get(r) || mineP || null;
      const noChanges = mine && Number(mine.changes) >= G.MAX_CHANGES;
      const chips = el("div", { class: "bx-chips", role: "radiogroup", "aria-label": `Who signs block ${fmt(h)}` },
        ...(ps.length ? ps : []).map((p) => el("button", { type: "button", class: "bx-chip" + (p.a === mineP ? " picked" : ""), role: "radio", "aria-checked": String(p.a === choice), "data-chip": `${r}:${p.a}`, disabled: sending || noChanges ? "" : null,
          onclick: () => choose(r, p.a) },
          dot(p.a), el("span", { class: "bx-name", text: nameOf(p.a) }), el("span", { class: "bx-share", text: shareText(p.share) }), el("span", { class: "bx-mult", text: multText(card ? X.multiplier(card, p.a, about(h)) : p.mult) }))));
      if (!ps.length) chips.append(el("div", { class: "bx-empty", text: "Loading producers…" }));
      const changed = choice && choice !== mineP;
      const btn = el("button", { type: "button", class: "bx-lockin", onclick: () => (who ? sendPick(r, choice) : startPlaying()) },
        !who ? (TESTNET ? "Play free to pick" : "Connect to pick") : mineP && !changed ? "Picked" : mineP ? "Change pick" : "Lock in pick");
      if (who && (sending || !changed || used >= max || noChanges)) btn.disabled = true;
      const foot = el("div", { class: "bx-t-foot" },
        mineP ? el("span", { class: "bx-yours", text: `Yours: ${nameOf(mineP)}${noChanges ? " (no changes left)" : ""}` }) : el("span", { text: who && used >= max ? "Today's picks are used up" : choice ? `${nameOf(choice)} · about ${multText(card ? X.multiplier(card, choice, about(h)) : ps.find((p) => p.a === choice)?.mult)} if right` : "Choose a producer", title: "By the current handicap card. The card taken at or before the lock decides the score." }), btn);
      return el("article", { class: "bx-t" + (i === 0 ? " first" : "") + (mineP ? " mine" : ""), id: `t-${r}` },
        el("div", { class: "bx-t-top" }, el("b", { text: `Block ${fmt(h)}` }), el("span", { "data-h": String(h), class: "bx-eta", text: etaText(r) }), i === 0 ? el("em", { text: "Next up" }) : null,
          funAt(r) ? el("em", { class: "bx-fun", title: "Sunday (UTC): counts on Today and All time, not the week", text: "Fun round · not the week" })
            : edgeAt(r) ? el("em", { class: "bx-fun", title: "Due just before Sunday 00:00 UTC: if its block lands on Sunday, it counts on Today and All time, not the week", text: "May fall on Sunday: then a fun round" }) : null),
        chips, foot);
    });
    // The soonest few, then the rest on request (6 on a wide screen, 3 on a phone).
    const few = matchMedia("(max-width: 760px)").matches ? 3 : 6;
    if (!showAll && cards.length > few) {
      cards.length = few;
      cards.push(el("button", { type: "button", class: "btn ghost bx-more", onclick: () => { showAll = true; renderTargets(true); } }, `Show all ${rounds.length} open targets`));
    }
    list.replaceChildren(...cards);
    renderQueue();
  }
  let showAll = false;
  const etaText = (r) => `about ${clock(about(G.target(r)))} · locks in ${dur(secsTo(G.lockHeight(r)) * 1000)}`;
  // Owner, 5 Nov: "after they select the producer it gives a pop up to pick them or x out and select another".
  // Tapping a producer opens one small box: the pick, what it scores, and two buttons (Pick / Choose another).
  function choose(r, a) {
    if (!me()) { drafts.set(r, a); startPlaying(); return; }
    drafts.set(r, a); renderTargets(true);
    const chip = document.querySelector(`[data-chip="${r}:${a}"]`); if (chip) chip.focus();   // the box returns focus here
    const mine = myPicks.get(r), mineP = mine && mine.producers && mine.producers[0];
    if (sending || a === mineP) return;
    const h = G.target(r), mult = card ? X.multiplier(card, a, about(h)) : null;
    const pick = el("button", { class: "btn", type: "button", onclick: () => { closeModal(); sendPick(r, a); } }, mineP ? "Change my pick" : "Pick");
    const other = el("button", { class: "btn ghost", type: "button", onclick: () => { drafts.delete(r); renderTargets(true); closeModal(); } }, "Choose another");
    const add = batchOn() ? el("button", { class: "btn ghost", type: "button", onclick: () => { queue.set(r, a); closeModal(); renderQueue(); } }, "Add to my picks") : null;
    pickModal("info", `${nameOf(a)} for block ${fmt(h)}?`, [
      el("p", {}, "About ", el("b", { text: dayTime(about(h)) }), ` · scores ${multText(mult)} if right`),
      ...(mineP ? [`Your pick now: ${nameOf(mineP)}. You can change it once.`] : []),
    ], add ? [pick, add, other] : [pick, other]);
    // The ✕ in the corner, as well as a tap outside, closes it to choose another.
    const box = modal && modal.querySelector(".pk-box");
    if (box) box.prepend(el("button", { type: "button", class: "pk-x", "aria-label": "Close and choose another", onclick: () => { drafts.delete(r); renderTargets(true); closeModal(); } }, "✕"));
    pick.focus();
  }
  function updateTimes() {
    if (!head) return;
    renderStage();
    document.querySelectorAll("#targets [data-h]").forEach((n) => { const h = Number(n.dataset.h); const r = G.roundOf(h); if (r != null) n.textContent = etaText(r); });
  }
  // ── you: picks left, this week's points and place, Mana ──
  let mana = null;
  function renderYou() {
    const box = $("you"), who = me();
    if ($("steps")) $("steps").hidden = !!who;
    if (!box) return;
    box.hidden = !who;
    if (!who) return;
    const max = usage ? Number(usage.max_picks_per_day) || G.PICKS_PER_DAY : G.PICKS_PER_DAY, used = usage ? Number(usage.picks_today) || 0 : 0;
    $("you-left").textContent = usage ? String(Math.max(0, max - used)) : "–";
    const rows = (board && board.week && board.week.rows) || [], mine = rows.find((x) => x.a === who);
    $("you-pts").textContent = mine ? fmt(mine.points, 2) : "0.00";
    // Audit BX-14: the place on the player's own board (Staked or Free play), not the combined list.
    $("you-rank").textContent = mine ? `#${mine.boardPlace || mine.place} ${mine.ranked ? "Staked" : "Free"}` : "–";
    $("you-mana").textContent = mana == null ? "–" : fmt(mana, 2);
  }
  async function readMana() {
    const who = me();
    if (!who || !provider) { mana = null; return; }
    try { mana = Number(BigInt(await provider.getAccountRc(who))) / 1e8; } catch { /* keep */ }
    renderYou(); renderWallet();
  }
  // ── the wallet button, and "Play free" ──
  const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  function renderWallet() {
    const b = $("wallet-btn");
    if (!b || !W) return;
    const who = me();
    b.className = "bx-wallet" + (who ? " on" : "");
    b.replaceChildren(...(who ? [dot(who), nameOf(who)] : [TESTNET ? "Play free" : "Connect wallet"]));
  }
  function walletMenu() {
    const who = me();
    if (!who) { startPlaying(); return; }
    pickModal("info", W.kind === "test" ? "Your Test wallet" : "Your wallet", [
      el("p", { class: "mono", text: who }),
      mana != null ? `Test Mana: ${fmt(mana, 2)} (a pick uses about 0.05)` : "",
      TESTNET && NET.faucet ? el("p", {}, "More test KOIN: send ", el("b", { text: "/faucet <your address>" }), " to ", el("a", { href: NET.faucet, target: "_blank", rel: "noopener noreferrer", text: "the faucet bot" }), ".") : null,
    ].filter(Boolean), [
      el("button", { class: "btn", type: "button", onclick: () => copy(who) }, "Copy address"),
      el("button", { class: "btn ghost", type: "button", onclick: () => { closeModal(); W.disconnect(); } }, "Disconnect"),
      okBtn("Close")]);
  }
  async function startPlaying() {
    if (!W) return;
    if (!TESTNET) { W.connect(); return; }
    if (W.address) return;
    if (!W.quick) { W.connect(); return; }
    // Kondor installed: offer it next to Play free (most testers just want Play free).
    if (window.kondor && !startPlaying.chose) {
      pickModal("info", "Play on the testnet", ["Play free makes a Test wallet in this browser with test KOIN. Or use Kondor switched to the testnet."],
        [el("button", { class: "btn", type: "button", onclick: () => { startPlaying.chose = true; closeModal(); startPlaying().finally(() => { startPlaying.chose = false; }); } }, "Play free"),
         el("button", { class: "btn ghost", type: "button", onclick: () => { closeModal(); W.connect(); } }, "Use Kondor")]);
      return;
    }
    let who;
    try { who = W.quick(); } catch (e) { pickModal("bad", "Couldn't make a wallet", [String((e && e.message) || e), "Try Kondor instead."], [el("button", { class: "btn", type: "button", onclick: () => { closeModal(); W.connect(); } }, "Use Kondor"), okBtn("OK")]); return; }
    // The sponsor v3 trial: a new Test wallet needs no test KOIN, the test sponsor pays (docs/blockx/SPONSOR-TESTNET.md).
    if (W.sponsor) {
      pickModal("ok", "You're in", ["Your Test wallet is ready. It has no test KOIN on purpose: the test Mana sponsor pays for your picks."], [el("button", { class: "btn", type: "button", onclick: () => { closeModal(); goPick(); } }, "Pick now")]);
      return;
    }
    if (!isLocal) { fundHelp(who); return; }
    pickModal("busy", "Adding test KOIN…", ["Your wallet is ready. The test server is sending it 5 test KOIN (enough for about 100 picks)."]);
    try {
      const r = await fetch("/api/fund", { method: "POST", headers: { "Content-Type": "application/json", "X-KG-Testnet": "fund" }, body: JSON.stringify({ address: who }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `the test server answered ${r.status}`);
      await readMana();
      pickModal("ok", "You're in", ["Your Test wallet has test KOIN. Pick who signs the next target."], [el("button", { class: "btn", type: "button", onclick: () => { closeModal(); goPick(); } }, "Pick now")]);
    } catch (e) { fundHelp(who, String((e && e.message) || e)); }
  }
  function fundHelp(who, why) {
    pickModal("info", "One more step: test KOIN", [
      why ? `Couldn't add test KOIN automatically: ${why}` : "Your wallet is ready in this browser. It needs free test KOIN to pay for picks.",
      el("p", {}, "In Telegram, send ", el("b", { text: `/faucet ${who}` }), " to ", NET.faucet ? el("a", { href: NET.faucet, target: "_blank", rel: "noopener noreferrer", text: "@KoinosTestnetFaucetBot" }) : "@KoinosTestnetFaucetBot", "."),
    ], [el("button", { class: "btn", type: "button", onclick: () => copy(`/faucet ${who}`) }, "Copy the message"), okBtn("Done")]);
  }
  function goPick() {
    const t = document.querySelector("#targets .bx-t");
    if (!t) return;
    t.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    const c = t.querySelector(".bx-chip:not([disabled])"); if (c) c.focus({ preventScroll: true });
  }
  function copy(text) {
    try { navigator.clipboard.writeText(text).then(() => say("Address copied."), () => say(text)); } catch { say(text); }
  }

  // ── the pick pop-up: wallet → sent → confirmed on the chain ──
  let modal = null;
  let modalBack = null;   // Repo Lens #E-23 I-4: focus goes back to what opened the box
  function pickModal(state, title, lines = [], actions = []) {
    if (!modal || modal.hidden) modalBack = document.activeElement;
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
  function closeModal() {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    const back = modalBack; modalBack = null;
    // A redrawn list replaces the chip: find it again by its round and producer.
    const el2 = back && back.isConnected ? back : back && back.dataset && back.dataset.chip ? document.querySelector(`[data-chip="${back.dataset.chip}"]`) : null;
    if (el2 && typeof el2.focus === "function") el2.focus();
  }
  document.addEventListener("keydown", (e) => {
    if (!modal || modal.hidden) return;
    if (e.key === "Escape" && !modal.querySelector(".pk-spin")) { closeModal(); return; }
    // Tab stays inside the box while it is open (E-23 I-4).
    if (e.key === "Tab") {
      // Repo Lens #B-14 B14-2: only while this box is the top one. A wallet box (KOIN Vault's Approve, .kw-back) or
      // another dialog on top keeps its own Tab order.
      const act = document.activeElement, inOther = act && act.closest && act.closest('[aria-modal="true"]');
      if (document.querySelector(".kw-back") || (inOther && inOther !== modal)) return;   // wallet.js removes it on close
      const f = [...modal.querySelectorAll("button, a[href], input, select, textarea")].filter((x) => !x.disabled);
      if (!f.length) { e.preventDefault(); return; }
      const i = f.indexOf(document.activeElement), next = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i < 0 || i === f.length - 1 ? 0 : i + 1);
      e.preventDefault(); f[next].focus();
    }
  });
  const okBtn = (text = "Done") => el("button", { class: "btn", type: "button", onclick: closeModal }, text);

  // "Send my picks" (Capacity, 13 Nov): only while the wallet reports batch settings (sponsor "batch" row, from the testnet
  // numbers). Until then nothing here shows and every pick goes one by one, as before.
  const queue = new Map();   // round -> producer, waiting to be sent together
  const batchOn = () => !!(W && typeof W.batchReady === "function" && W.batchReady() && typeof W.sendBatch === "function");
  function renderQueue() {
    let bar = $("bx-queue");
    if (!bar) { const list = $("targets"); if (!list || !list.parentNode) return; bar = el("div", { id: "bx-queue", class: "bx-queue", role: "status" }); list.parentNode.insertBefore(bar, list); }
    for (const r of [...queue.keys()]) if (!offer().includes(r)) queue.delete(r);
    if (!batchOn() || !queue.size) { bar.hidden = true; bar.replaceChildren(); return; }
    bar.hidden = false;
    bar.replaceChildren(el("span", { text: `${queue.size} pick${queue.size === 1 ? "" : "s"} ready to send together.` }),
      el("button", { class: "btn", type: "button", disabled: sending || undefined, onclick: sendQueue }, `Send my ${queue.size} pick${queue.size === 1 ? "" : "s"}`),
      el("button", { class: "btn ghost", type: "button", disabled: sending || undefined, onclick: () => { queue.clear(); renderQueue(); renderTargets(true); } }, "Clear"));
  }
  async function sendQueue() {
    const who = me();
    if (!who || !picksContract || sending || !queue.size || !batchOn()) return;
    try { await readHead(); } catch { /* use the last head */ }
    const used = usage ? Number(usage.picks_today) || 0 : 0, max = usage ? Number(usage.max_picks_per_day) || G.PICKS_PER_DAY : G.PICKS_PER_DAY;
    const open = (r) => G.lockHeight(r) - head.height > 20;
    const mineSame = (r) => { const m = myPicks.get(r); return !!(m && m.producers && m.producers[0] === queue.get(r)); };
    const rounds = [...queue.keys()].filter((r) => open(r) && !mineSame(r)).slice(0, 10);
    if (!rounds.length) { queue.clear(); renderQueue(); return pickModal("info", "Nothing to send", ["Those picks have locked or are already yours."], [okBtn("OK")]); }
    if (used + rounds.length > max) return pickModal("info", "Not enough picks left today", [`You have ${Math.max(0, max - used)} left today and ${rounds.length} waiting. Clear some, or send fewer.`], [okBtn("OK")]);
    sending = true; renderTargets(true); renderQueue();
    const wallet = W.kind === "guest" ? "your guest wallet" : W.label ? W.label() : "your wallet";
    pickModal("busy", W.kind === "guest" || W.kind === "test" ? "Sending your picks…" : `Confirm in ${wallet}`, [`${rounds.length} pick${rounds.length === 1 ? "" : "s"} in one go.`, "Free when the Knode Mana sponsor can pay; if it can't, your wallet asks to use your own Mana."]);
    try {
      const ops = [];
      for (const r of rounds) { const { operation } = await picksContract.functions.pick({ player: who, game: G.GAME_ID, round: String(r), producers: [queue.get(r)], number: "0" }, { onlyOperation: true }); operation.__round = r; ops.push(operation); }
      // Dropped right before signing: any round that locked while the box was open.
      try { await readHead(); } catch { /* use the last head */ }
      const res = await W.sendBatch(`${rounds.length} Block X picks`, ops.map((o) => { const { __round, ...op } = o; return Object.defineProperty(op, "__round", { value: __round, enumerable: false }); }), { stillOpen: (o) => open(o.__round) });
      for (const r of rounds) { queue.delete(r); drafts.delete(r); }
      pickModal("ok", "Picks sent", [`${res.sent} pick${res.sent === 1 ? "" : "s"} sent${res.dropped ? `; ${res.dropped} locked while you were choosing, so they were left out` : ""}. This list updates by itself.`], [okBtn()]);
    } catch (e) {
      const m = String((e && e.message) || e);
      const msg = /PICKS: this round is locked|locked/i.test(m) ? "Nothing was saved; a round had locked. Try again."
        : /reject|denied|cancel/i.test(m) ? "Cancelled in your wallet. Nothing was sent."
        : `Not sent: ${m.slice(0, 200)}`;
      pickModal(/Cancelled/.test(msg) ? "info" : "bad", /Cancelled/.test(msg) ? "Cancelled" : "Picks not sent", [msg], [okBtn("OK")]);
    } finally { sending = false; await loadMine(); renderQueue(); }
  }

  async function sendPick(r, producer) {
    const who = me();
    if (!who || !picksContract || sending) return;
    const h = G.target(r);
    if (!isAddr(producer)) return pickModal("info", "Choose a producer first", ["Pick who you think signs the block, then press Pick."], [okBtn("OK")]);
    const mine = myPicks.get(r);
    if (mine && mine.producers && mine.producers[0] === producer) return pickModal("info", "That is already your pick", [`${nameOf(producer)} for block ${fmt(h)}.`], [okBtn("OK")]);
    try { await readHead(); } catch { /* use the last head */ }
    if (!(G.lockHeight(r) - head.height > 20)) return pickModal("bad", "Too close to the lock", [`Block ${fmt(h)} locks in a few minutes. Pick a later one.`], [okBtn("OK")]);
    sending = true; renderTargets(true);
    const mult = X.multiplier(card, producer, about(h));   // the cap of the target's own week (×3 before Mon 9 Nov, ×5 from then)
    const what = `${nameOf(producer)} signs block ${fmt(h)} (about ${dayTime(about(h))})`;
    const wallet = W.kind === "guest" ? "your guest wallet" : W.label ? W.label() : "your wallet";
    // Audit BX-12: say who really pays on this wallet.
    const mana = TESTNET ? "Testnet: your wallet pays a little test Mana."
      : W.kind === "guest" ? "Free: the Knode Mana sponsor pays the Mana."
      : W.kind === "vault" ? "KOIN Vault chooses who pays the Mana for this pick."
      : "Free when the Knode Mana sponsor can pay; if it can't, your wallet asks to use your own Mana.";
    pickModal("busy", W.kind === "guest" || W.kind === "test" ? "Sending your pick…" : `Confirm in ${wallet}`, [what, `Scores ×${fmt(mult, 2)} if right.`, mana]);
    try {
      const { operation } = await picksContract.functions.pick({ player: who, game: G.GAME_ID, round: String(r), producers: [producer], number: "0" }, { onlyOperation: true });
      const id = await W.send(`pick ${nameOf(producer)} for block ${fmt(h)}`, [operation]);
      pickModal("busy", "Sent. Checking the chain…", [what]);
      let onChain = false;
      for (let t = 0; t < 10 && !onChain; t++) {
        try { const x = await picksContract.functions.get_pick({ game: G.GAME_ID, round: String(r), player: who }); onChain = !!(x.result && x.result.pick && x.result.pick.producers && x.result.pick.producers[0] === producer); } catch { /* again */ }
        if (!onChain) await new Promise((res) => setTimeout(res, 3000));
      }
      drafts.delete(r);
      if (onChain) pickModal("ok", "Pick confirmed", [el("p", {}, "Your pick: ", el("b", { text: nameOf(producer) }), ` for block ${fmt(h)}.`),
        `It locks ${G.LEAD} blocks (about ${Math.round(G.LEAD * 3 / 60)} minutes) before the block. Until then you can change it ${G.MAX_CHANGES === 1 ? "once" : `up to ${G.MAX_CHANGES} times`} (a change counts toward today's ${G.PICKS_PER_DAY}).`,
        id ? el("p", { class: "ago mono", text: `Transaction ${String(id).slice(0, 18)}…` }) : null].filter(Boolean), [okBtn()]);
      else pickModal("info", "Sent, not seen on the chain yet", ["Your wallet sent it. It usually shows within a minute; this list updates by itself."], [okBtn("OK")]);
    } catch (e) {
      const m = String((e && e.message) || e);
      // The Picks contract's own messages (picks/assembly/Picks.ts) only: the Mana sponsor and the wallet use some of the
      // same words ("used up", "closed"), and their reason is shown as they give it.
      const why = /PICKS: this round is locked/i.test(m) ? `That block is locked: picks close ${G.LEAD} blocks before it.`
        : /PICKS: this round is not open yet/i.test(m) ? "That block isn't open yet."
        : /PICKS: today's picks for this game are used up/i.test(m) ? `Today's ${G.PICKS_PER_DAY} picks are used up (changes count). More after 00:00 UTC.`
        : /PICKS: this pick can't be changed again/i.test(m) ? `That pick has been changed ${G.MAX_CHANGES === 1 ? "once" : `${G.MAX_CHANGES} times`} already: it can't be changed again.`
        : /PICKS: that is already your pick/i.test(m) ? "That is already your pick."
        : /PICKS: this game is closed/i.test(m) ? "This game is switched off right now."
        : /pending account resources|insufficient.*(rc|mana|resources)/i.test(m) ? "Your Mana is still held by your last pick. It frees up within a few minutes of each pick; try again in a minute."
        : /no test Mana yet/i.test(m) ? m
        : /reject|denied|cancel/i.test(m) ? "Cancelled in your wallet. Nothing was sent."
        : `Not sent: ${m.slice(0, 200)}`;
      pickModal(/Cancelled/.test(why) ? "info" : "bad", /Cancelled/.test(why) ? "Cancelled" : "Pick not sent", [why], [okBtn("OK")]);
    } finally { sending = false; await loadMine(); }
  }

  // ── results and the leaderboard (the recorder's files) ──
  const lb = window.KBoard ? window.KBoard.create($("bx-board"), {
    label: "Block X leaderboard",
    columns: [{ key: "points", label: "Points" }, { key: "correct", label: "Right" }, { key: "picks", label: "Picks", wide: true }, { key: "days", label: "Days", wide: true }],
    summary: (r) => `${fmt(r.points, 2)} pts · ${r.correct} right`,
    scored: (r) => r.pts > 0,
    link: (a) => (NET && NET.explorer ? NET.explorer + a : null),
    name: nameOf,
    unranked: "The Staked board is for wallets with at least 1 VHP staked in Block X that week (holding VHP, or a stake in another game, doesn't count).",
    free: { show: 6, prize: "" },
    // Audit BX-14: medals follow the prize rule (picks on 3+ days, a point, ties share): last week's from the recorder's
    // frozen prize list, this week's as they stand now.
    freeWinners: (part, rows, weekly) => {
      const m = new Map();
      if (!weekly) return m;
      if (part && Array.isArray(part.prizes) && part.final) { for (const p of part.prizes) m.set(p.player, Math.min(2, Number(p.place) || 2)); return m; }
      const ok = rows.filter((r) => r.days >= 3 && r.pts > 0);
      let place = 0;
      ok.forEach((r, i) => { const p = ok[i - 1]; if (!p || p.pts !== r.pts || p.correct !== r.correct || p.lastCorrect !== r.lastCorrect) place = i + 1; if (place <= 2) m.set(r.a, place); });
      return m;
    },
  }) : null;
  /** The recorder's rows carry points in hundredths (pts); the board shows them as points. */
  const withPoints = (b) => {
    if (!b) return b;
    const fix = (part) => (part && Array.isArray(part.rows) ? { ...part, rows: part.rows.map((r) => ({ ...r, points: (Number(r.pts) || 0) / 100 })) } : part);
    return { ...b, today: fix(b.today), week: fix(b.week), lastWeek: fix(b.lastWeek), allTime: fix(b.allTime) };
  };
  async function loadResults() {
    const wNow = M.weekOf(Date.now());
    for (const w of [wNow - 1, wNow]) {
      if (w < 0) continue;
      try { const j = await fetchJson(`${NET.data}W${String(w).padStart(3, "0")}.json`); if (j && j.v === 1 && j.week === w && Array.isArray(j.targets)) weeks.set(w, j); } catch { /* none yet */ }
    }
    try { const b = await fetchJson(NET.data + "board.json"); if (b && b.v === 1) board = withPoints(b); } catch { /* none yet */ }
    renderResults(); renderBoard();
    loadRuler().catch(() => {});
  }
  // ── the VHP ruler (owner, 11 Nov 2026): X<week>-<d>.json, one entry per target ──
  // Shown only when this week (or the one before) is in shadow or on: "from Monday …" (the switch's week), and the
  // latest targets' ruler scores (marked "trial: counts for nothing" in the shadow week). In an ON week the cap reads ×120.
  async function loadRuler() {
    const now = Date.now(), wNow = M.weekOf(now), files = [];
    try { const ix = await fetchJson(NET.data + "index.json"); if (ix && typeof ix === "object" && "rulerFrom" in ix) rulerFromIdx = ix.rulerFrom; } catch { /* keep */ }
    const modeAt = (w, fileMode) => (rulerFromIdx === undefined ? fileMode : rulerFromIdx === null || w < rulerFromIdx - 1 ? "off" : w < rulerFromIdx ? "shadow" : "on");
    for (const w of [wNow - 1, wNow]) {
      if (w < 0) continue;
      const days = w === wNow ? Math.floor((now - M.weekStart(w)) / 86400000) + 1 : 7;
      for (let d = Math.max(0, days - 2); d < days; d++) {
        try { const j = await fetchJson(`${NET.data}X${String(w).padStart(3, "0")}-${d}.json`); if (j && j.v === 1 && j.week === w && j.day === d && Array.isArray(j.targets)) files.push(j); } catch { /* none */ }
      }
    }
    const cur = files.filter((j) => j.week === wNow).pop() || files[files.length - 1];
    // G49-3: the banner follows the switch as the recorder last used it (an allowed unset or move takes it down at once)
    const curMode = modeAt(wNow, cur ? cur.mode : "off"), from = rulerFromIdx === undefined ? cur && cur.rulerFrom : rulerFromIdx;
    if (curMode === "off" || !Number.isInteger(from)) { $("ruler-box").hidden = true; rulerOn = new Map(); renderResults(); renderMults(); return; }
    $("ruler-box").hidden = false;
    const mon = new Date(M.weekStart(from)).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
    $("ruler-when").textContent = curMode === "on"
      ? `Who Signs Block X is scored by the VHP ruler from ${mon} (00:00 UTC). It replaces the ×5 cap.`
      : `Who Signs Block X switches to the VHP ruler on ${mon} (00:00 UTC). This week the ruler runs beside the game as a trial: its scores below count for nothing.`;
    if (curMode === "on") for (const e of document.querySelectorAll('[data-bx="capx"]')) e.textContent = "×120";
    // Repo Lens #G-35 G35-4: in an ON week a pick's points are the ruler's (the W file keeps the old-rule points).
    rulerOn = new Map();
    for (const j of files) if (modeAt(j.week, j.mode) === "on" && j.mode === "on") for (const e of j.targets) rulerOn.set(e.height, e);
    renderResults(); renderMults();
    const rows = files.flatMap((j) => j.targets.map((e) => ({ ...e, shadow: j.shadow }))).sort((a, b) => b.height - a.height).slice(0, 8);
    $("ruler-list").replaceChildren(...rows.map((e) => {
      const what = e.void ? "void: no pick on it counts" : e.card ? `${nameOf(e.signer)} signed: a right pick scores ×${(e.points / 100).toFixed(2)}` : "the ruler's score comes in once the block's data is in";
      return el("div", { class: "bx-row" }, el("b", { text: `Block ${fmt(e.height)}` }), el("span", { text: ` ${what}${e.shadow ? " (trial)" : ""}` }));
    }));
  }
  /** Repo Lens #G-35 G35-4: a pick's points as the page shows them: the ruler entry's in an ON week (undefined: not
   *  scored by the ruler yet), else the week file's. */
  let rulerOn = new Map();
  // Repo Lens #G-49 G49-3: the ruler switch as the recorder last used it (index.json rulerFrom): undefined = not known
  // (an older index.json; then a week is ON when the page has any ON entry), null = unset, N = on from vault week N.
  let rulerFromIdx;
  const weekOn = (t) => (rulerFromIdx === undefined ? rulerOn.size > 0 : rulerFromIdx !== null && Number.isFinite(t.time) && M.weekOf(t.time) >= rulerFromIdx);
  const shownPts = (t, p) => {
    const e = rulerOn.get(t.height);
    if (!e) return weekOn(t) ? undefined : p[3];   // an ON-week target the page has no ruler entry for: "…", never old-rule points
    if (!e.card && !e.void) return undefined;
    return !e.void && p[1] === e.signer ? e.points : 0;
  };
  function renderResults() {
    const all = [...weeks.values()].flatMap((w) => w.targets).filter((t) => t && Number.isInteger(t.height)).sort((a, b) => b.height - a.height).slice(0, 8);
    $("results-box").hidden = !all.length;
    const who = me();
    $("res-rows").replaceChildren(...all.map((t) => {
      const p = who && Array.isArray(t.picks) ? t.picks.find((x) => x[0] === who) : null;
      const pp = p ? shownPts(t, p) : 0, right = p && pp > 0;
      const signer = t.signer ? (NET.explorer ? el("a", { href: NET.explorer + t.signer, target: "_blank", rel: "noopener noreferrer", text: nameOf(t.signer) }) : el("span", { text: nameOf(t.signer) })) : el("span", { text: "–" });
      const sp = (t.picks || []).map((x) => shownPts(t, x));
      const crowd = t.void ? "void" : sp.some((x) => x === undefined) ? "being scored by the ruler" : `${sp.filter((x) => x > 0).length} of ${sp.length} right`;
      return el("div", { class: "bx-res-row" },
        el("span", { class: "h", text: fmt(t.height) }),
        el("span", { class: "who" }, t.signer ? dot(t.signer) : null, signer, el("span", { class: "note", text: crowd })),
        el("span", { class: "you" + (p ? (right ? " ok" : " no") : ""), text: !p ? "" : pp === undefined ? "…" : right ? `+${pts(pp)}` : "✗" }));
    }));
  }
  function renderBoard() {
    if (!board || !lb) { $("board-box").hidden = true; return; }
    $("board-box").hidden = false;
    lb.setMe(me() || "");
    lb.set(board);
    renderYou();
    const lw = board.lastWeek, prizes = lw && lw.final && Array.isArray(lw.prizes) ? lw.prizes : [];
    $("prize-line").textContent = prizes.length
      ? `${TESTNET ? "Test prizes" : "Prizes"} for week ${lw.week + 1}: ${prizes.map((p) => `${nameOf(p.player)} ${fmt(p.vhp, p.vhp % 1 ? 2 : 0)} VHP`).join(", ")}.${TESTNET ? " Nothing is paid on the testnet." : ""}`
      : NET.prize;
  }
  function onWallet() { renderWallet(); loadMine(); renderBoard(); renderResults(); readMana(); readStake(); }

  // ── your stake in Block X (the Knode Games vault, v6; owner 2026-10-28: every game takes stakes) ──
  // Read-only here. The Stake / Withdraw / Move buttons are the site's shared stake panel (window.KStake, from the hub),
  // mounted below the boards for game 2 once the vault is live; nothing here signs a stake.
  let vault = null, vaultCfg = null;
  // Audit BX-61: just enough of the vault's get_state (same entry point in v5 and v6) to see whether v6 is live and its
  // minimum stake, so the v6 ABI file is only fetched once v6 is live (the recorder does the same).
  const U64 = (id) => ({ type: "uint64", id, options: { jstype: "JS_STRING" } });
  const STATE_ABI = {
    methods: { get_state: { entry_point: 1023583049, argument: "kpred.get_state_arguments", return: "kpred.get_state_result", read_only: true } },
    koilib_types: { nested: { kpred: { nested: {
      get_state_arguments: { fields: {} },
      get_state_result: { fields: { config: { type: "config_object", id: 1 } } },
      config_object: { fields: { min_stake: U64(9), min_stake_next: U64(13), min_stake_next_week: U64(14), v6_rule_week_plus_one: U64(21) } },
    } } } },
  };
  /** The vault's minimum stake for a week (bot/games/blockx.ts minStakeFor; 1 VHP when unset). */
  function minStakeFor(cfg, week) {
    const next = BigInt((cfg && cfg.min_stake_next) || "0"), from = Number((cfg && cfg.min_stake_next_week) || 0);
    const m = next > 0n && week >= from ? next : BigInt((cfg && cfg.min_stake) || "0");
    return m > 0n ? m : 100000000n;
  }
  async function setupStake() {
    if (TESTNET) return;
    // The site's shared stake panel (stake-panel.js, Hub chat): Stake / Withdraw / Move / Claim for game 2. It stays
    // hidden until the vault (v6) is live and Block X has a stake bucket.
    // The Hub's staked / free status bar at the top of the page (links to stake.html#g2); the full panel stays lower.
    if (window.KStake && typeof window.KStake.badge === "function" && $("stake-badge")) window.KStake.badge($("stake-badge"), { game: VAULT_GAME });
    if (window.KStake && typeof window.KStake.mount === "function" && $("blockx-stake")) window.KStake.mount($("blockx-stake"), { game: VAULT_GAME });
    try {
      const dep = await fetchJson(new URL("game-data/deployment.json", ROOT));
      if (!dep || !isAddr(dep.contract)) return;
      const st = await new lib.Contract({ id: dep.contract, abi: STATE_ABI, provider }).functions.get_state({});
      if (!(Number(st?.result?.config?.v6_rule_week_plus_one || 0) > 0)) return;   // the vault isn't live yet
      const abi = await fetchJson(new URL("game/abi/kpred-v6.koilib.json", ROOT));
      vault = new lib.Contract({ id: dep.contract, abi, provider });
      vaultCfg = st.result.config;
      readStake();
    } catch { /* no vault: the boards still work */ }
  }
  async function readStake() {
    const box = $("stake-mine");
    if (!box) return;
    const who = me();
    if (!vault || !who) { box.hidden = true; return; }
    try {
      const week = M.weekOf(Date.now());
      const r = (await vault.functions.get_game_player({ player: who, game: VAULT_GAME, week: String(week) })).result || {};
      const now = Number(r.week_stake || 0) / 1e8, pend = Number(r.player?.pending || 0) / 1e8;
      // Audit BX-64: the recorder's rule (bot/games/blockx.ts vaultView/stakedSet): the most staked here this week (the
      // entry's peak_stake, else the active stake) at least the vault's minimum for the week.
      const e = r.entry, big = (x) => BigInt(x || "0");
      const peak = e ? [big(e.peak_stake), big(e.stake)].reduce((x, y) => (y > x ? y : x)) : big(r.active_stake);
      const staked = peak >= minStakeFor(vaultCfg, week);
      box.textContent = `Your stake in Block X: ${fmt(now, 2)} VHP this week${pend ? `, plus ${fmt(pend, 2)} VHP from next week` : ""}. ${staked ? "You're on the Staked board." : "You play on the Free play board."}`;
      box.hidden = false;
    } catch { box.hidden = true; }
  }

  function renderMults() {
    const ps = producers();
    $("mult-sub").textContent = rulerOn.size
      ? "This week the VHP ruler scores every target: each target's multiplier is in \"Measured by the VHP ruler\" below (capped at ×120). The table shows the old handicap card, for reference only."
      : card
      ? `Share of blocks each producer should sign, from the handicap card of ${dayTime(card.at || cardAt)}, and what a right pick on it scores now. Each target is scored with the card taken at or before its lock.`
      : `Waiting for the ${NET.cards === "self" ? "recorder's first handicap card (it takes one within the hour)" : "race recorder's card"}.`;
    const top = Math.max(0.0001, ...ps.map((p) => p.share));
    $("mult-rows").replaceChildren(...(card ? ps : []).map((p) => {
      const bar = el("span", { class: "bx-mbar" }, el("i")); bar.style.setProperty("--c", colorOf(p.a)); bar.firstChild.style.setProperty("--w", `${(p.share / top) * 100}%`);
      return el("div", { class: "bx-mrow" }, dot(p.a),
        NET.explorer ? el("a", { href: NET.explorer + p.a, target: "_blank", rel: "noopener noreferrer", class: "bx-name", text: nameOf(p.a) }) : el("span", { class: "bx-name", text: nameOf(p.a) }),
        bar, el("span", { class: "bx-mult", text: `${shareText(p.share)} · ${multText(p.mult)}` }));
    }));
  }

  // ── start ──
  (async () => {
    try { await setupNet(); }
    catch (e) { say(TESTNET ? `Testnet settings problem: ${String((e && e.message) || e)}` : "Couldn't load the game settings."); return; }
    $("game-rules").textContent = `A target every ${fmt(G.ROUND)} blocks (${(() => { const m = Math.round(G.ROUND * X.BLOCK_MS / 60000); return m >= 90 ? `about ${Math.round(m / 60)} hours` : `about ${m} minutes`; })()}). Picks lock ${G.LEAD} blocks before it. ${G.PICKS_PER_DAY} picks a day, ${G.MAX_CHANGES === 1 ? "1 change" : `${G.MAX_CHANGES} changes`} per pick.`;
    if (W && W.subscribe) W.subscribe(onWallet);
    if ($("wallet-btn")) $("wallet-btn").addEventListener("click", walletMenu);
    if ($("cta")) $("cta").addEventListener("click", () => (me() ? goPick() : startPlaying()));
    renderWallet(); readMana();
    // Names arrive once per page (names.json): redraw everything that shows a producer or a player.
    if (window.KNames && typeof window.KNames.onChange === "function") window.KNames.onChange(() => {
      for (const f of [() => renderChain(), () => renderTargets(true), renderMults, renderResults, renderBoard, renderWallet]) { try { f(); } catch { /* not loaded yet: drawn later */ } }
    });
    const picksReady = setupPicks().catch(() => {});
    setupStake();
    try { await readHead(); say(""); } catch { say("Couldn't reach the Koinos network. Trying again in a moment…"); }
    await loadCard(); renderMults();
    await picksReady; renderTargets(true);
    loadResults();
    setInterval(() => { if (!document.hidden) readHead().then(() => { say(""); renderTargets(); }).catch(() => say("Reconnecting to the Koinos network…")); }, 6000);
    setInterval(() => { if (!document.hidden) loadCard().then(renderMults); }, 600000);
    setInterval(() => { if (!document.hidden) loadResults(); }, TESTNET ? 120000 : 300000);
    setInterval(() => { if (!document.hidden && picksContract) loadMine(); }, 60000);
    setInterval(() => { if (!document.hidden) renderStage(); }, 1000);
    setInterval(updateTimes, 15000);
    setInterval(() => { if (!document.hidden) readMana(); }, 30000);
  })();
})();
