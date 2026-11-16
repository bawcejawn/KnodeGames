/* node.html: the page script (moved out of the HTML so the Content-Security-Policy can refuse inline scripts). */
(() => {
  "use strict";
  const lib = window.koilib || window.koinos || window;
  const RPC = "https://koinos.armana.io";
  const KOIN = "19GYjDBVXU7keLbYvMLazsGQn3GTWHjHkK";
  const VHP = "12Y5vW6gk8GceH53YfRkRre2Rrcsgw7Naq";
  const EXPLORER = "https://koinosscan.com/address/";
  const POB = "159myq5YUhhoVWu3wsHKHiJYKPKGUrGiyv"; // Koinos Proof-of-Burn system contract (mainnet)
  const RAW = "https://raw.githubusercontent.com/bawcejawn/KnodeGames/";   // data-source.js sends these to the mirror
  const UNIT = 1e8, MAX_BLOCKS = 201600, WORKERS = 6, REORG = 60, STORE = "nd-blocks-v2";
  const NAMES = { "1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr": "Knode Games pool" };
  const QUICK = [["Knode Games pool", "1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr"]];
  try { localStorage.removeItem("nd-blocks-v1"); } catch {}

  const provider = new lib.Provider([RPC]);
  const types = { nested: { t: { nested: {
    balance_of_arguments: { fields: { owner: { type: "bytes", id: 1, options: { "(koinos.btype)": "ADDRESS" } } } },
    balance_of_result: { fields: { value: { type: "uint64", id: 1, options: { jstype: "JS_STRING" } } } },
    mint_event: { fields: { to: { type: "bytes", id: 1, options: { "(koinos.btype)": "ADDRESS" } }, value: { type: "uint64", id: 2, options: { jstype: "JS_STRING" } } } },
    get_public_key_arguments: { fields: { producer: { type: "bytes", id: 1, options: { "(koinos.btype)": "ADDRESS" } } } },
    get_public_key_result: { fields: { value: { type: "bytes", id: 1 } } },
    burn_event: { fields: { from: { type: "bytes", id: 1, options: { "(koinos.btype)": "ADDRESS" } }, value: { type: "uint64", id: 2, options: { jstype: "JS_STRING" } } } },
  } } } };
  const ser = new lib.Serializer(types);
  const balanceAbi = { methods: { balance_of: { entry_point: 0x5c721497, argument: "t.balance_of_arguments", return: "t.balance_of_result", read_only: true } }, koilib_types: types };
  const koinToken = new lib.Contract({ id: KOIN, provider, abi: balanceAbi });
  const pob = new lib.Contract({ id: POB, provider, abi: { methods: { get_public_key: { entry_point: 0x96634f68, argument: "t.get_public_key_arguments", return: "t.get_public_key_result", read_only: true } }, koilib_types: types } });
  const vhpToken = new lib.Contract({ id: VHP, provider, abi: { methods: { balance_of: { entry_point: 0x5c721497, argument: "t.balance_of_arguments", return: "t.balance_of_result", read_only: true } }, koilib_types: types } });

  // ── helpers ──
  const $ = (id) => document.getElementById(id);
  const el = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); for (const c of kids) if (c != null) e.append(c); return e; };
  const fmt = (n, d = 0) => (Number.isFinite(n) ? Number(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }) : "—");
  const sig = (n) => (!Number.isFinite(n) ? "—" : n >= 100 ? fmt(n, 0) : n >= 10 ? fmt(n, 1) : fmt(n, 2));
  // Producer names (names.js): "Name · 1Abc12…wxyz", or the short address.
  const short = (a) => (window.KNames ? window.KNames.of(a) : NAMES[a] || a.slice(0, 6) + "…" + a.slice(-4));
  const dur = (ms) => { const s = ms / 1000; return s < 120 ? `${fmt(s, s < 10 ? 1 : 0)} s` : s < 5400 ? `${Math.round(s / 60)} min` : s < 172800 ? `${(s / 3600).toFixed(1)} h` : `${(s / 86400).toFixed(1)} days`; };
  const isAddr = (a) => /^1[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(a);
  const say = (t) => { $("status").textContent = t; };
  const progress = (f) => { $("bar").hidden = f == null; if (f != null) $("bar").firstElementChild.style.width = `${Math.round(f * 100)}%`; };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const lastMondayUtc = () => { const d = new Date(); const day = (d.getUTCDay() + 6) % 7; return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day); };
  /** The count a Poisson(mean) stays at or below with probability p. */
  function poissonQ(mean, p) {
    if (!(mean > 0)) return 0;
    if (mean > 300) { const z = p < 0.5 ? -1.2816 : 1.2816; return Math.max(0, Math.round(mean + z * Math.sqrt(mean))); }
    let k = 0, pk = Math.exp(-mean), cum = pk;
    while (cum < p && k < 10000) { k++; pk *= mean / k; cum += pk; }
    return k;
  }

  // ── blocks kept in this browser: signer index, timestamp and transaction count per height ──
  let B = null; // { from, top, signers, sig, ts, ntx }
  const sIdx = new Map();
  function loadStore() {
    try {
      const r = JSON.parse(localStorage.getItem(STORE) || "null");
      if (!r || !r.sig || r.sig.length !== r.dts.length || r.sig.length !== r.ntx.length) return null;
      const ts = new Array(r.dts.length); let t = r.t0;
      for (let i = 0; i < ts.length; i++) { t += r.dts[i]; ts[i] = t; }
      return { from: r.from, top: r.from + r.sig.length - 1, signers: r.signers, sig: r.sig, ts, ntx: r.ntx };
    } catch { return null; }
  }
  function saveStore() {
    try {
      const dts = new Array(B.ts.length); let prev = B.ts[0];
      for (let i = 0; i < B.ts.length; i++) { dts[i] = B.ts[i] - prev; prev = B.ts[i]; }
      localStorage.setItem(STORE, JSON.stringify({ from: B.from, signers: B.signers, sig: B.sig, t0: B.ts[0], dts, ntx: B.ntx }));
    } catch { /* storage full or blocked: still works, just re-reads next time */ }
  }
  function signerIndex(a) { let i = sIdx.get(a); if (i === undefined) { i = B.signers.length; B.signers.push(a); sIdx.set(a, i); } return i; }

  /** Read blocks a..b into flat arrays: newest first, several requests at once, oversized requests split. */
  async function readRange(a, b, headId, note) {
    const n = b - a + 1, signers = new Array(n), ts = new Array(n), ntx = new Array(n);
    const queue = []; for (let e = b; e >= a; e -= 200) queue.push([Math.max(a, e - 199), e]);
    let done = 0;
    const worker = async () => {
      while (queue.length) {
        const [s, e] = queue.shift();
        let res = null;
        for (let tries = 0; ; tries++) {
          try { res = await provider.call("block_store.get_blocks_by_height", { head_block_id: headId, ancestor_start_height: String(s), num_blocks: e - s + 1, return_block: true, return_receipt: false }); break; }
          catch (err) {
            if (e - s >= 50) { const m = Math.floor((s + e) / 2); queue.push([s, m], [m + 1, e]); break; }
            if (tries >= 4) throw err;
            await sleep(700 * (tries + 1));
          }
        }
        if (!res) continue;
        let got = 0;
        for (const it of res.block_items || []) {
          const i = Number(it.block_height) - a;
          if (i < 0 || i >= n || signers[i] !== undefined) continue;
          signers[i] = it.block.header.signer; ts[i] = Number(it.block.header.timestamp); ntx[i] = (it.block.transactions || []).length; got++;
        }
        if (got === 0) throw new Error(`no blocks returned at ${s}`);
        let k = s; while (k <= e && signers[k - a] !== undefined) k++;
        if (k <= e) queue.push([k, e]); // the node sent fewer than asked: get the rest
        done += got; progress(Math.min(1, done / n)); say(`${note} ${fmt(done)} of ${fmt(n)} blocks…`);
      }
    };
    await Promise.all(Array.from({ length: WORKERS }, worker));
    return { signers, ts, ntx };
  }

  /** The bot publishes the last two days of blocks every hour as one file (branch blocks-data). One download instead
   *  of ~144 requests to the public node. It is only used if a random sample of its blocks matches the chain. */
  const SNAPSHOT = "https://raw.githubusercontent.com/bawcejawn/KnodeGames/blocks-data/recent-blocks.json";
  async function loadSnapshot(needFrom, top, headId) {
    try {
      say("Loading recent blocks…");
      const r = await (await fetch(SNAPSHOT, { cache: "no-cache" })).json();
      const n = r && Array.isArray(r.sig) ? r.sig.length : 0;
      if (!n || r.v !== 1 || r.dts.length !== n || r.ntx.length !== n || r.top !== r.from + n - 1 || r.from > needFrom || r.top > top) return null;
      if (!r.signers.every(isAddr) || !r.sig.every((i) => Number.isInteger(i) && i >= 0 && i < r.signers.length)) return null;
      const ts = new Array(n); let t = r.t0;
      for (let i = 0; i < n; i++) { t += r.dts[i]; ts[i] = t; }
      // Spot-check 8 random blocks (older than the newest 60, which can still change) against the chain.
      const picks = Array.from({ length: 8 }, () => r.from + Math.floor(Math.random() * Math.max(1, n - REORG)));
      const ok = await Promise.all(picks.map(async (h) => {
        const res = await provider.call("block_store.get_blocks_by_height", { head_block_id: headId, ancestor_start_height: String(h), num_blocks: 1, return_block: true, return_receipt: false });
        const it = (res.block_items || [])[0];
        return it && Number(it.block_height) === h && it.block.header.signer === r.signers[r.sig[h - r.from]] && Number(it.block.header.timestamp) === ts[h - r.from];
      }));
      if (!ok.every(Boolean)) return null;
      return { from: r.from, top: r.top, signers: r.signers.slice(), sig: r.sig.slice(), ts, ntx: r.ntx.slice() };
    } catch { return null; }
  }

  async function ensureBlocks(needFrom, head) {
    const top = Number(head.head_topology.height), headId = head.head_topology.id;
    needFrom = Math.max(needFrom, top - MAX_BLOCKS + 1);
    if (!B) B = loadStore();
    // Nothing (or too little) kept in this browser: start from the bot's snapshot when it is good.
    if (!B || B.from > needFrom || B.top < top - 1200) { const snap = await loadSnapshot(needFrom, top, headId); if (snap && (!B || snap.top > B.top || snap.from < B.from)) B = snap; }
    sIdx.clear(); if (B) B.signers.forEach((a, i) => sIdx.set(a, i));
    if (!B || B.top < needFrom - 1 || B.top > top || B.sig.length === 0) { B = { from: top + 1, top, signers: [], sig: [], ts: [], ntx: [] }; sIdx.clear(); }
    else { // the newest ~60 blocks can still change: re-read them
      const keep = Math.max(0, B.sig.length - REORG);
      B.sig.length = keep; B.ts.length = keep; B.ntx.length = keep; B.top = B.from + keep - 1;
    }
    if (B.top < top) {
      const a = B.sig.length ? B.top + 1 : needFrom, r = await readRange(a, top, headId, "Reading new blocks:");
      if (B.sig.length === 0) B.from = a;
      for (let i = 0; i < r.signers.length; i++) { B.sig.push(signerIndex(r.signers[i])); B.ts.push(r.ts[i]); B.ntx.push(r.ntx[i]); }
      B.top = top;
    }
    if (needFrom < B.from) {
      const r = await readRange(needFrom, B.from - 1, headId, "Reading older blocks:");
      B.sig = r.signers.map(signerIndex).concat(B.sig); B.ts = r.ts.concat(B.ts); B.ntx = r.ntx.concat(B.ntx); B.from = needFrom;
    }
    const cut = B.sig.length - MAX_BLOCKS;
    if (cut > 0) { B.sig.splice(0, cut); B.ts.splice(0, cut); B.ntx.splice(0, cut); B.from += cut; }
    progress(null);
    saveStore();
  }

  // ── network block reward (median of the latest blocks; read once) ──
  let rewardCache = null;
  async function networkReward(head) {
    if (rewardCache) return rewardCache;
    const h = Number(head.head_topology.height), N = 40;
    const res = await provider.call("block_store.get_blocks_by_height", { head_block_id: head.head_topology.id, ancestor_start_height: String(h - N + 1), num_blocks: N, return_block: true, return_receipt: true });
    const nets = [];
    for (const it of res.block_items || []) {
      const signer = it.block.header.signer; let mint = 0, burn = 0;
      for (const ev of (it.receipt && it.receipt.events) || []) {
        try {
          if (ev.source === KOIN && /mint/i.test(ev.name || "")) { const d = await ser.deserialize(ev.data, "t.mint_event"); if (d.to === signer) mint += Number(d.value) / UNIT; }
          else if (ev.source === VHP && /burn/i.test(ev.name || "")) { const d = await ser.deserialize(ev.data, "t.burn_event"); if (d.from === signer) burn += Number(d.value) / UNIT; }
        } catch { /* not a token event we know */ }
      }
      if (mint > 0) nets.push(mint - burn);
    }
    if (!nets.length) return NaN;
    nets.sort((x, y) => x - y);
    return (rewardCache = nets[Math.floor(nets.length / 2)]);
  }

  const bal = new Map();
  async function vhpOf(a) {
    const hit = bal.get(a);
    if (hit && Date.now() - hit.at < 300000) return hit.v;
    const r = await vhpToken.functions.balance_of({ owner: a });
    const v = Number((r.result && r.result.value) || 0) / UNIT;
    bal.set(a, { v, at: Date.now() }); return v;
  }

  // ── the node checklist and the games (owner, 14 Nov 2026) ──
  /** The producer key registered for the address in the PoB contract: "" = none, null = couldn't read. */
  async function keyOf(a) {
    try { const r = await pob.functions.get_public_key({ producer: a }); const v = r && r.result && r.result.value; return v ? String(v) : ""; } catch { return null; }
  }
  /** KOIN held by the address (its Mana pays for signing blocks); null = couldn't read. */
  async function koinOf(a) {
    try { const r = await koinToken.functions.balance_of({ owner: a }); return Number((r.result && r.result.value) || 0) / UNIT; } catch { return null; }
  }
  const WEEK_MS = 6048e5, WEEK3 = Date.UTC(2026, 10, 9);   // vault week 3 = Mon 9 Nov 2026 00:00 UTC
  const vaultWeek = (t) => 3 + Math.floor((t - WEEK3) / WEEK_MS);
  async function getJson(url) { try { const r = await fetch(url, { cache: "no-cache" }); return r.ok ? await r.json() : null; } catch { return null; } }
  /** This producer in this week's Race results (the Ruler's places in a Ruler week, else steps) and Fantasy price list. */
  async function gamesOf(a, now) {
    const w = vaultWeek(now), pad = String(w).padStart(3, "0");
    const [wf, rf, fx] = await Promise.all([getJson(`${RAW}race-data/W${pad}.json`), getJson(`${RAW}race-data/R${pad}.json`), getJson(`${RAW}games-data/fantasy/inputs/W${w}.json`)]);
    let race = null;
    if (wf && wf.v === 1 && wf.week === w && Array.isArray(wf.races)) {
      const ruled = !!(rf && rf.v === 1 && rf.week === w && rf.mode === "on" && Array.isArray(rf.races));
      const order = [];
      if (ruled) { for (const e of rf.races) if (e && Array.isArray(e.placings) && e.placings.length) order.push(e.placings); }
      else for (const r of wf.races) if (r && r.result && r.result.final && Array.isArray(r.result.standings) && r.result.standings.length) order.push(r.result.standings.map((x) => x && x.a));
      const places = order.map((o) => o.indexOf(a)).filter((i) => i >= 0);
      race = { ruled, races: order.length, in: places.length, wins: places.filter((i) => i === 0).length, top3: places.filter((i) => i < 3).length };
    }
    let fantasy = null;
    if (fx && fx.week === w && fx.data && Array.isArray(fx.data.pool)) { const e = fx.data.pool.find((x) => x && x.a === a); fantasy = { listed: !!e, price: e ? e.price : null, form: e ? e.form : null, budget: fx.data.budget }; }
    return { w, race, fantasy, bracket: await bracketOf(a, w) };
  }
  /** This producer in the Producer Bracket (Bracket chat's rule, claude/bracket/TO-HUB-BRACKET-FILE-SHAPE-2026-11-14.md §3):
      only W<week>.json's seeding and results; the ruler/ files are never read (a shadow week's trial isn't a result).
      The next week's bracket is seeded on Sunday, so it wins once it has a seeding. null = nothing to show. */
  async function bracketOf(a, w) {
    const BM = window.KBracketMath; if (!BM || !BM.ROUND_NAMES) return null;
    const file = (x) => getJson(`${RAW}games-data/bracket/W${String(x).padStart(3, "0")}.json`);
    const [cur, next] = await Promise.all([file(w), file(w + 1)]);
    const ok = (j, x) => j && j.week === x && typeof j.status === "string";
    const j = ok(next, w + 1) && next.seeding && next.seeding.size ? next : ok(cur, w) ? cur : null;
    if (!j) return null;
    const when = j === next ? "next week" : "this week";
    if (j.status === "void" || j.status === "none") return { text: `Producer Bracket: no Bracket ${when}.` };
    const sd = j.seeding;
    if (!sd || !sd.size || !Array.isArray(sd.seeds)) return { text: `Producer Bracket: ${when}'s seeding isn't out yet.` };
    const k = sd.seeds.indexOf(a) + 1;
    if (!k) return Array.isArray(sd.out) && sd.out.includes(a) ? { text: `Producer Bracket ${when}: in the field, not seeded.` } : null;
    const names = BM.ROUND_NAMES[sd.size] || [], res = j.results, rounds = res && Array.isArray(res.rounds) ? res.rounds : [];
    for (let r = 0; r < rounds.length; r++) if (!rounds[r].includes(k)) return { seed: k, out: true, text: `Producer Bracket ${when}: seed #${k}, knocked out in the ${names[r] || `round ${r + 1}`}.` };
    if (res && res.done && rounds.length) return { seed: k, champ: true, text: `Producer Bracket ${when}: seed #${k}, champion!` };
    return { seed: k, text: `Producer Bracket ${when}: seed #${k}, still in (${names[rounds.length] || "next round"}).` };
  }
  /** Is the address a smart contract (a pool, a vault) rather than a personal wallet? { contract, abi } or null. */
  async function metaOf(a) {
    try { const r = await provider.call("contract_meta_store.get_contract_meta", { contract_id: a }); const m = r && r.meta; return { contract: !!(m && (m.hash || m.abi)), abi: m && m.abi ? String(m.abi) : "" }; } catch { return null; }
  }
  const VAULTS = { "1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr": "the Knode Games vault" };
  /** The longest stretch between a producer's own blocks in [from, now] (ms), and what is usual for `exp` expected blocks. */
  const longestGap = (ts, from, now) => { let g = 0, prev = from; for (const t of ts) { g = Math.max(g, t - prev); prev = t; } return Math.max(g, now - prev); };
  const usualGap = (span, exp) => (exp >= 3 ? (span / exp) * (Math.log(exp) + 0.5772) : NaN);
  /** Blocks by hour of the day (the viewer's own clock), against the expected count per hour. */
  function hours(mineTs, expPerHourOfDay, spanH) {
    const show = spanH >= 47;
    $("hours-card").hidden = false;
    const axis = document.querySelector("#hours-card .axis");
    if (!show) {
      // Owner, 16 Nov (H-B8): the card looked dead on the 24-hour window. Offer the longer windows right here.
      if (axis) axis.hidden = true;
      $("hours-sub").textContent = "A day is too short to see a pattern. See whether quiet spells fall at the same time each day:";
      $("hours").replaceChildren(el("div", { class: "nd-quick hours-pick" }, ...[["86400", "Last 3 days"], ["201600", "Last 7 days"]].map(([v, label]) => {
        const b = el("button", { type: "button" }, label); b.onclick = () => { $("win").value = v; $("win").dispatchEvent(new Event("change")); }; return b; })));
      $("hours-note").textContent = ""; return;
    }
    if (axis) axis.hidden = false;
    const c = new Array(24).fill(0); for (const t of mineTs) c[new Date(t).getHours()]++;
    const max = Math.max(1, expPerHourOfDay * 1.5, ...c), W = 960, H = 120, bw = W / 24;
    const ns = "http://www.w3.org/2000/svg", svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("preserveAspectRatio", "none"); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", "Blocks by hour of the day, with the expected level");
    c.forEach((n, h) => {
      const bh = n ? Math.max(4, (n / max) * (H - 6)) : 2, r = document.createElementNS(ns, "rect");
      r.setAttribute("x", h * bw + bw * 0.12); r.setAttribute("width", bw * 0.76); r.setAttribute("y", H - bh); r.setAttribute("height", bh); r.setAttribute("rx", 2);
      r.setAttribute("fill", n ? "var(--violet)" : "var(--line)");
      const t = document.createElementNS(ns, "title"); t.textContent = `${String(h).padStart(2, "0")}:00: ${n} block${n === 1 ? "" : "s"}`; r.append(t); svg.append(r);
    });
    if (expPerHourOfDay > 0) { const y = H - (expPerHourOfDay / max) * (H - 6), l = document.createElementNS(ns, "line"); l.setAttribute("x1", 0); l.setAttribute("x2", W); l.setAttribute("y1", y); l.setAttribute("y2", y); l.setAttribute("stroke", "var(--sun)"); l.setAttribute("stroke-width", 2); l.setAttribute("stroke-dasharray", "8 6"); l.setAttribute("vector-effect", "non-scaling-stroke"); svg.append(l); }
    $("hours").replaceChildren(svg);
    $("hours-sub").textContent = `Each bar is one hour of the day on your clock, added up over the window; the dashed line is the expected ${sig(expPerHourOfDay)} per hour.`;
    const empty = expPerHourOfDay >= 3 ? c.map((n, h) => (n === 0 ? h : -1)).filter((h) => h >= 0) : [];
    const hh = (h) => new Date(2026, 0, 1, h).toLocaleTimeString(undefined, { hour: "numeric" });
    $("hours-note").textContent = empty.length && empty.length < 12 ? `No blocks at all around ${empty.map(hh).join(", ")}, where about ${sig(expPerHourOfDay)} were expected each hour. Something that runs at the same time every day (a restart, a backup, a sleeping computer) may be stopping the node.` : "";
  }
  let ctx = null;   // the window last shown, for "Compare"
  const item = (cls, mark, ...kids) => el("li", { class: cls }, el("span", { class: "i", "aria-hidden": "true" }, mark), el("span", {}, ...kids));
  const link = (href, t) => el("a", { href }, t);

  // ── render ──
  const ago = (ms) => (ms < 90000 ? "just now" : `${dur(ms)} ago`);
  /** What one block paid its signer: KOIN minted to it, and the VHP burned from it (read from the block's receipt). */
  async function blockPay(height, headId, signer) {
    const res = await provider.call("block_store.get_blocks_by_height", { head_block_id: headId, ancestor_start_height: String(height), num_blocks: 1, return_block: true, return_receipt: true });
    const it = (res.block_items || [])[0]; let mint = 0, burn = 0;
    if (!it || Number(it.block_height) !== height) return null;
    for (const ev of (it.receipt && it.receipt.events) || []) {
      try {
        if (ev.source === KOIN && /mint/i.test(ev.name || "")) { const d = await ser.deserialize(ev.data, "t.mint_event"); if (d.to === signer) mint += Number(d.value) / UNIT; }
        else if (ev.source === VHP && /burn/i.test(ev.name || "")) { const d = await ser.deserialize(ev.data, "t.burn_event"); if (d.from === signer) burn += Number(d.value) / UNIT; }
      } catch { /* not an event we know */ }
    }
    return { mint, burn };
  }

  const tile = (k, v, s, cls = "") => el("div", { class: "tile" }, el("div", { class: "k" }, k), el("div", { class: `v ${cls}` }, v), s ? el("div", { class: "s" }, s) : null);

  function chart(first, last, mineTs, expPerHour, spanH) {
    const bucketH = spanH <= 30 ? 1 : spanH <= 80 ? 3 : 6;
    const size = bucketH * 3.6e6, N = Math.max(1, Math.ceil((last - first) / size));
    const counts = new Array(N).fill(0);
    for (const t of mineTs) counts[Math.min(N - 1, Math.floor((t - first) / size))]++;
    const exp = expPerHour * bucketH, max = Math.max(1, exp * 1.4, ...counts), W = 1000, H = 150, bw = W / N;
    const ns = "http://www.w3.org/2000/svg", svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("role", "img"); svg.setAttribute("aria-label", `Blocks per ${bucketH} hour${bucketH === 1 ? "" : "s"}, with the expected level`);
    counts.forEach((c, i) => {
      const h = c ? Math.max(4, (c / max) * (H - 6)) : 2, r = document.createElementNS(ns, "rect");
      r.setAttribute("x", i * bw + bw * 0.12); r.setAttribute("width", Math.max(1, bw * 0.76)); r.setAttribute("y", H - h); r.setAttribute("height", h); r.setAttribute("rx", 2);
      r.setAttribute("fill", c ? "var(--violet)" : "var(--line)");
      const t = document.createElementNS(ns, "title"); t.textContent = `${new Date(first + i * size).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}: ${c} block${c === 1 ? "" : "s"}`; r.append(t);
      svg.append(r);
    });
    if (exp > 0) {
      const y = H - (exp / max) * (H - 6), line = document.createElementNS(ns, "line");
      line.setAttribute("x1", 0); line.setAttribute("x2", W); line.setAttribute("y1", y); line.setAttribute("y2", y);
      line.setAttribute("stroke", "var(--sun)"); line.setAttribute("stroke-width", 2); line.setAttribute("stroke-dasharray", "8 6"); line.setAttribute("vector-effect", "non-scaling-stroke");
      svg.append(line);
    }
    $("chart").replaceChildren(svg);
    $("chart-sub").textContent = `Each bar is ${bucketH === 1 ? "1 hour" : `${bucketH} hours`}; the dashed line is the expected ${sig(exp)} per bar.`;
    $("ax-l").textContent = new Date(first).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  let busy = false, current = null;
  async function show(addr, mode, quiet = false) {
    if (busy) return; busy = true; current = { addr, mode };
    try {
      const head = await provider.getHeadInfo();
      const top = Number(head.head_topology.height), now = Number(head.head_block_time) || Date.now();
      const monday = lastMondayUtc();
      const n = mode === "week" ? Math.min(MAX_BLOCKS, Math.ceil((now - monday) / 3000 * 1.05) + 200) : Number(mode);
      await ensureBlocks(top - n + 1, head);
      if (!quiet) say("Reading VHP balances…");

      let i0 = Math.max(0, (top - n + 1) - B.from);
      if (mode === "week") while (i0 < B.ts.length && B.ts[i0] < monday) i0++;
      const total = B.sig.length - i0;
      if (total < 10) throw new Error("not enough blocks in this window yet");
      const t0 = B.ts[i0], t1 = B.ts[B.sig.length - 1], spanH = Math.max(0.1, (t1 - t0) / 3.6e6);
      const me = sIdx.get(addr);
      const counts = new Map(), mineTs = [], mineIdx = [];
      let maxGap = 0, empty = 0, txs = 0;
      for (let i = i0; i < B.sig.length; i++) {
        const s = B.sig[i]; counts.set(s, (counts.get(s) || 0) + 1);
        if (s === me) { mineTs.push(B.ts[i]); mineIdx.push(i); }
        if (i > i0) maxGap = Math.max(maxGap, B.ts[i] - B.ts[i - 1]);
        if (B.ntx[i] === 0) empty++; txs += B.ntx[i] || 0;
      }
      const producers = [...counts.entries()].map(([s, c]) => [B.signers[s], c]).sort((x, y) => y[1] - x[1]);
      const list = producers.map(([a]) => a); if (!list.includes(addr)) list.push(addr);
      const vals = []; for (let i = 0; i < list.length; i += 8) { vals.push(...(await Promise.all(list.slice(i, i + 8).map(vhpOf)))); }
      const vhp = new Map(list.map((a, i) => [a, vals[i]]));
      let reward = NaN; try { reward = await networkReward(head); } catch { /* shown as — */ }
      const [key, koin, kg, meta] = await Promise.all([keyOf(addr), koinOf(addr), gamesOf(addr, now), metaOf(addr)]);

      const myVhp = vhp.get(addr) || 0;
      const activeVhp = producers.reduce((s, [a]) => s + (vhp.get(a) || 0), 0) + (counts.has(me) ? 0 : myVhp);
      const share = activeVhp ? myVhp / activeVhp : 0;
      const perDay = total / spanH * 24; // network blocks a day
      const mine = mineTs.length, expWin = share * total, ofExp = expWin > 0 ? mine / expWin : NaN;
      const lastTs = mineTs[mine - 1], since = lastTs ? now - lastTs : NaN, every = share > 0 ? 8.64e7 / (share * perDay) : NaN;
      const late = lastTs ? since > every * 3 : expWin >= 3;
      const winName = $("win").selectedOptions[0].textContent.replace(/^Last /, "");
      const name = window.KNames ? window.KNames.of(addr) : NAMES[addr] ? `${NAMES[addr]} (${addr.slice(0, 6)}…${addr.slice(-4)})` : short(addr);

      const ranked = list.slice().sort((x, y) => (vhp.get(y) || 0) - (vhp.get(x) || 0) || (x < y ? -1 : 1)), rank = ranked.indexOf(addr) + 1;
      const overdue = share > 0 && late, producing = share > 0 && !late;
      const lw = winName.toLowerCase(), wlabel = mode === "week" ? "this Knode Games week" : lw;
      const apr0 = myVhp > 0 ? share * perDay * reward * 365 / myVhp * 100 : NaN;
      const hero = [el("div", {}, el("div", { class: "nm" }, name), el("div", { class: "ad mono" }, addr, " · ", el("a", { href: EXPLORER + addr, target: "_blank", rel: "noopener" }, "explorer")))];
      hero.push(el("div", { class: `pd-pill ${producing ? "good" : "bad"}` }, share <= 0 ? "No VHP: not producing" : producing ? "● Producing" : "● Quiet: check the node"));
      $("hero").replaceChildren(...hero);
      // One place per fact (owner, 14 Nov): the tiles hold the numbers; this card only speaks when something needs doing.
      const story = share <= 0
        ? [el("p", {}, `${name} has no VHP counted as producing, so the chain should not pick it to sign blocks. To produce, burn KOIN into VHP and register a producer key.`)]
        : overdue
          ? [el("p", {}, `${lastTs ? `No block for ${dur(since)}` : `No block in ${wlabel === lw ? "the last " + lw : wlabel}`}, while its VHP says about one every ${dur(every)}. If this is your node, check that it is running, in sync and using its registered producer key.`)]
          : [];
      $("story").hidden = story.length === 0;
      $("story").replaceChildren(...story);
      $("tiles").replaceChildren(
        tile("VHP producing", fmt(myVhp, 0), share > 0 ? `${fmt(share * 100, share < 0.01 ? 3 : 2)}% of the network` : "none counted"),
        tile("Rank by VHP", share > 0 ? `#${fmt(rank)}` : "–", `of ${fmt(ranked.length)} producers`),
        tile(`Blocks, ${wlabel}`, fmt(mine), expWin > 0 ? `expected ${sig(expWin)} · ${fmt(ofExp * 100, 0)}% of expected` : "no VHP, so no blocks expected"),
        tile("Last block", lastTs ? ago(since) : "none in window", Number.isFinite(every) ? `usually every ${dur(every)}` : "", late && share > 0 ? "bad" : ""),
        tile(`KOIN gained, ${wlabel}`, mine && Number.isFinite(reward) ? `≈ ${fmt(mine * reward, 1)}` : mine ? "–" : "0", mine && Number.isFinite(reward) ? `New KOIN minted to it, minus the VHP its blocks used up: ${fmt(mine)} blocks × about ${fmt(reward, 3)} each` : ""),
        tile("Yearly rate", Number.isFinite(apr0) ? `${fmt(apr0, 1)}% a year` : "–", Number.isFinite(apr0) ? "a year of KOIN gained, as a share of its VHP, if VHP stays as is" : ""),
      );
      // Node checklist: producer key, KOIN for Mana, what a burn would add, the longest quiet spell.
      const chk = [];
      if (VAULTS[addr]) chk.push(item("info", "i", `This is ${VAULTS[addr]}'s contract: the VHP players stake produces blocks here, and the node signs for it.`));
      else if (meta && meta.contract) chk.push(item("info", "i", `This address is a smart contract, not a personal wallet, so it is most likely a mining pool${/fogata|beneficiar|reburn/i.test(meta.abi) ? ", and it looks like a Fogata pool" : ""}. `, link("https://www.koinscan.io/fogata", "Mining pools on Fogata")));
      if (key === null) chk.push(item("info", "?", "Couldn't read the producer key right now. Try again in a minute."));
      else if (!key) chk.push(item("bad", "✗", "No producer key is registered for this address, so no node can sign blocks for it. ", link("producer.html", "Register a producer key")));
      else chk.push(item("ok", "✓", `Producer key registered: ${key.slice(0, 10)}…. Check that your node's key is this one.`));
      if (koin === 0) chk.push(item("bad", "✗", "No KOIN in this address. A producer needs some KOIN, for its Mana, to sign blocks."));
      else if (koin > 0) chk.push(item("ok", "✓", `${fmt(koin, koin < 10 ? 2 : 0)} KOIN in the address. Its Mana pays for signing blocks, so keep some KOIN here.`));
      if (koin > 0 && share > 0 && Number.isFinite(perDay)) {
        const amt = Math.min(1000, Math.floor(koin)), more = ((myVhp + amt) / (activeVhp + amt) - share) * perDay;
        if (amt >= 1) chk.push(item("info", "i", `Burning ${fmt(amt)} KOIN into VHP would add about ${sig(more)} blocks a day (now about ${sig(share * perDay)}). `, link("burn.html", "Burn KOIN into VHP")));
      }
      if (share > 0 && rank > 1) {
        const above = ranked[rank - 2], need = Math.max(1, Math.ceil((vhp.get(above) || 0) - myVhp + 1)), b = share * perDay;
        const plusOne = b + 1 < perDay ? Math.max(0, ((b + 1) * activeVhp / perDay - myVhp) / (1 - (b + 1) / perDay)) : NaN;
        chk.push(item("info", "i", `About ${fmt(need)} more VHP would move it up to #${fmt(rank - 1)} by VHP, past ${short(above)}.${Number.isFinite(plusOne) ? ` About ${fmt(Math.ceil(plusOne))} more VHP would add 1 block a day.` : ""}`));
      } else if (share > 0 && rank === 1) chk.push(item("info", "i", "It is #1 by VHP in this window."));
      const longest = longestGap(mineTs, t0, now), usual = usualGap(now - t0, expWin);
      if (Number.isFinite(usual)) chk.push(item(longest > usual * 2 ? "bad" : "ok", longest > usual * 2 ? "✗" : "✓", `Longest quiet spell in ${wlabel === lw ? "the last " + lw : wlabel}: ${dur(longest)}. For its size, about ${dur(usual)} is usual.`));
      else if (share > 0) chk.push(item("info", "i", "Too few blocks expected in this window to judge quiet spells. Pick a longer window."));
      $("check").replaceChildren(...chk);
      const g = [];
      if (!kg.race) g.push(item("info", "?", "Producer Race: this week's results can't be read yet. ", link("race.html", "Race page")));
      else if (!kg.race.races) g.push(item("info", "i", "Producer Race: no finished race this week yet. ", link("race.html", "Race page")));
      else g.push(item(kg.race.in ? "ok" : "info", kg.race.in ? "✓" : "i", kg.race.in
        ? `Producer Race: in ${fmt(kg.race.in)} of ${fmt(kg.race.races)} finished races this week; 1st in ${fmt(kg.race.wins)}, top 3 in ${fmt(kg.race.top3)} (${kg.race.ruled ? "the Ruler's places" : "by steps"}). `
        : `Producer Race: not placed in this week's ${fmt(kg.race.races)} finished races. `, link("race.html", "Race page")));
      if (!kg.fantasy) g.push(item("info", "i", "Fantasy Producers: this week's price list isn't out yet. ", link("fantasy.html", "Fantasy page")));
      else if (!kg.fantasy.listed) g.push(item("info", "i", "Fantasy Producers: not on this week's price list. ", link("fantasy.html", "Fantasy page")));
      else g.push(item("ok", "✓", `Fantasy Producers: price ${fmt(kg.fantasy.price)}${kg.fantasy.budget ? ` (a team's budget is ${fmt(kg.fantasy.budget)})` : ""}${Number.isFinite(kg.fantasy.form) ? `, form ${fmt(kg.fantasy.form / 100, 1)} (100 = as expected for its size)` : ""}. `, link("fantasy.html", "Fantasy page")));
      if (kg.bracket) g.push(item(kg.bracket.out ? "info" : "ok", kg.bracket.champ ? "🏆" : kg.bracket.out ? "i" : "✓", kg.bracket.text + " ", link(`bracket.html?follow=${encodeURIComponent(addr)}`, "Follow it on the Bracket")));
      $("kg").replaceChildren(...g);
      const at = Math.max(0, rank - 1), from0 = Math.max(0, Math.min(at - 3, ranked.length - 7)), near = ranked.slice(from0, from0 + 7);
      $("peers").replaceChildren(...near.map((a) => {
        const pick = el("button", { type: "button", class: "link mono", title: a }, short(a));
        pick.onclick = () => { $("addr").value = a; go(); window.scrollTo({ top: 0, behavior: "smooth" }); };
        return el("tr", { class: a === addr ? "me" : "" }, el("td", {}, String(ranked.indexOf(a) + 1)), el("td", {}, pick), el("td", { class: "r" }, fmt(vhp.get(a) || 0, 0)), el("td", { class: "r" }, fmt(counts.get(sIdx.get(a)) || 0)));
      }));
      const lastIdx = mineIdx.slice(-6).reverse();
      $("recent").replaceChildren(...(lastIdx.length ? [] : [el("tr", {}, el("td", { colspan: "5", class: "note" }, "No blocks in this window."))]));
      const pays = await Promise.all(lastIdx.map((i) => blockPay(B.from + i, head.head_topology.id, addr).catch(() => null)));
      $("recent").replaceChildren(...lastIdx.map((i, k) => {
        const p = pays[k], profit = p ? p.mint - p.burn : NaN;
        return el("tr", {}, el("td", { class: "mono" }, `#${fmt(B.from + i)}`), el("td", {}, ago(now - B.ts[i])),
          el("td", { class: "r" }, p ? fmt(p.mint, 3) : "—"), el("td", { class: "r" }, p ? fmt(p.burn, 3) : "—"), el("td", { class: `r ${profit > 0 ? "good" : profit < 0 ? "bad" : ""}` }, Number.isFinite(profit) ? fmt(profit, 3) : "—"));
      }));

      const rows = [["Next 1,000 blocks", 1000], ["Next 5,000 blocks", 5000], ["Next 10,000 blocks", 10000], ["Next 20,000 blocks", 20000],
        ["A day", perDay], ["A week", perDay * 7], ["A month", perDay * 30], ["A year", perDay * 365]];
      $("forecast").replaceChildren(...rows.map(([label, blocks]) => {
        const m = share * blocks, lo = poissonQ(m, 0.1), hi = poissonQ(m, 0.9);
        const hint = /blocks/.test(label) ? ` (~${dur(blocks / perDay * 8.64e7)})` : "";
        return el("tr", {}, el("td", {}, label, el("span", { class: "range" }, hint)), el("td", { class: "r" }, sig(m)),
          el("td", { class: "r" }, m > 0 ? (lo === hi ? fmt(lo) : `${fmt(lo)} – ${fmt(hi)}`) : "—"), el("td", { class: "r" }, sig(m * reward)));
      }));
      $("fc-sub").textContent = `${name}, if VHP stays as it is now. Knode Games' block questions use windows of 5,000–20,000 blocks.`;

      chart(t0, t1, mineTs, share * perDay / 24, spanH);
      hours(mineTs, share * (total / spanH) * (spanH / 24), spanH);
      ctx = { i0, t0, t1, now, total, spanH, perDay, activeVhp, ranked, vhp, counts, addr, name, wlabel, lw };
      if ($("cmp-addr").value.trim() && $("cmp-addr").value.trim() !== addr) compare($("cmp-addr").value.trim(), true); else $("cmp").replaceChildren();

      const shown = producers.slice(0, 60); if (!shown.some(([a]) => a === addr)) shown.push([addr, 0]);
      $("top").replaceChildren(...shown.map(([a, c]) => {
        const v = vhp.get(a), vs = v != null && activeVhp ? v / activeVhp : NaN;
        const rank = producers.findIndex(([x]) => x === a);
        const pick = el("button", { type: "button", class: "link mono", title: a }, short(a));
        pick.onclick = () => { $("addr").value = a; go(); window.scrollTo({ top: 0, behavior: "smooth" }); };
        return el("tr", { class: a === addr ? "me" : "" },
          el("td", {}, rank >= 0 ? String(rank + 1) : "–"), el("td", {}, pick),
          el("td", { class: "r" }, fmt(c)), el("td", { class: "r" }, Number.isFinite(vs) ? `${fmt(vs * 100, 2)}%` : "—"),
          el("td", { class: "r" }, Number.isFinite(vs) ? sig(vs * 10000) : "—"));
      }));

      const stat = (k, v) => el("div", {}, el("dt", {}, k), el("dd", {}, v));
      $("net").replaceChildren(
        stat("Average time between blocks", dur((t1 - t0) / (total - 1))),
        stat("Longest gap between blocks", dur(maxGap)),
        stat("Blocks with no transactions", `${fmt(empty / total * 100, 1)}%`),
        stat("Transactions per 10,000 blocks", fmt(txs / total * 10000, 0)),
        stat("Active producers", fmt(producers.length)),
        stat("Blocks a day", fmt(perDay, 0)),
      );

      say(`${name} · ${fmt(total)} blocks over ${dur(t1 - t0)}, to block #${fmt(top)}. Updated ${new Date().toLocaleTimeString()}, refreshes every 5 minutes.`);
      $("out").hidden = false;
    } catch (e) {
      progress(null);
      say(`Couldn't read the chain: ${(e && e.message) || e}. Try again in a minute.`);
    } finally { busy = false; }
  }

  // ── compare two producers (same window) ──
  async function compare(b, quiet = false) {
    if (!ctx) return;
    if (!isAddr(b)) { $("cmp-note").textContent = "That doesn't look like a Koinos address."; return; }
    if (b === ctx.addr) { $("cmp-note").textContent = "That is the producer shown above. Paste a different one."; return; }
    if (!quiet) $("cmp-note").textContent = "Reading…";
    const C = ctx, row = async (a) => {
      const v = C.vhp.has(a) ? C.vhp.get(a) : await vhpOf(a).catch(() => NaN);
      const active = C.activeVhp + (C.vhp.has(a) ? 0 : v || 0), sh = active ? (v || 0) / active : 0, si = sIdx.get(a), ts = [];
      for (let i = C.i0; i < B.sig.length; i++) if (B.sig[i] === si) ts.push(B.ts[i]);
      const exp = sh * C.total, rk = C.ranked.indexOf(a);
      const [k, m] = await Promise.all([keyOf(a), metaOf(a)]);
      return { a, v, sh, n: ts.length, exp, rk, last: ts.length ? C.now - ts[ts.length - 1] : NaN, gap: longestGap(ts, C.t0, C.now), usual: usualGap(C.now - C.t0, exp), k, pool: !!(VAULTS[a] || (m && m.contract)) };
    };
    const [A, Bq] = await Promise.all([row(C.addr), row(b)]);
    const lines = [
      ["VHP producing", (r) => fmt(r.v, 0)], ["Share of the network", (r) => `${fmt(r.sh * 100, r.sh < 0.01 ? 3 : 2)}%`],
      ["Rank by VHP", (r) => (r.rk >= 0 && r.v > 0 ? `#${fmt(r.rk + 1)}` : "–")],
      [`Blocks, ${C.wlabel}`, (r) => `${fmt(r.n)} (expected ${sig(r.exp)})`],
      ["Last block", (r) => (Number.isFinite(r.last) ? ago(r.last) : "none in window")],
      ["Longest quiet spell", (r) => `${dur(r.gap)}${Number.isFinite(r.usual) ? ` (usual ${dur(r.usual)})` : ""}`],
      ["Producer key", (r) => (r.k === null ? "couldn't read" : r.k ? "registered" : "none")],
      ["Kind of address", (r) => (r.pool ? "contract (pool or vault)" : "wallet")],
    ];
    const pick = (a) => { const x = el("button", { type: "button", class: "link mono", title: a }, short(a)); x.onclick = () => { $("addr").value = a; go(); window.scrollTo({ top: 0, behavior: "smooth" }); }; return x; };
    $("cmp").replaceChildren(el("thead", {}, el("tr", {}, el("th", {}, ""), el("th", { class: "r" }, pick(C.addr)), el("th", { class: "r" }, pick(b)))),
      el("tbody", {}, ...lines.map(([k, f]) => el("tr", {}, el("td", {}, k), el("td", { class: "r" }, f(A)), el("td", { class: "r" }, f(Bq))))));
    $("cmp-note").textContent = "";
    if (!quiet) { remember("nd-cmp", b); const q = new URLSearchParams(location.search); q.set("b", b); history.replaceState(null, "", `?${q}`); }
  }

  // ── wiring ──
  const remember = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  const recall = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  function go() {
    const a = $("addr").value.trim(), m = $("win").value;
    if (!isAddr(a)) return say("That doesn't look like a Koinos address (it starts with 1 and has 26–35 characters).");
    remember("nd-addr", a); remember("nd-win", m);
    const b = $("cmp-addr").value.trim();
    history.replaceState(null, "", `?a=${a}&w=${m}${isAddr(b) && b !== a ? `&b=${b}` : ""}`);
    show(a, m);
  }
  $("form").addEventListener("submit", (e) => { e.preventDefault(); go(); });
  $("cmp-form").addEventListener("submit", (e) => { e.preventDefault(); compare($("cmp-addr").value.trim()); });
  $("win").addEventListener("change", () => { if (isAddr($("addr").value.trim())) go(); });
  $("share").addEventListener("click", async () => { try { await navigator.clipboard.writeText(location.href); $("shared").textContent = "Link copied."; } catch { $("shared").textContent = "Copy it from the address bar."; } });
  $("quick").replaceChildren(el("span", {}, "Try:"), ...QUICK.map(([label, a]) => { const b = el("button", { type: "button" }, label); b.onclick = () => { $("addr").value = a; go(); }; return b; }));
  setInterval(() => { if (current && !document.hidden) show(current.addr, current.mode, true); }, 300000);
  const q = new URLSearchParams(location.search);
  const a0 = q.get("a") || recall("nd-addr") || QUICK[0][1], w0 = q.get("w") || recall("nd-win");
  if (w0 && [...$("win").options].some((o) => o.value === w0)) $("win").value = w0;
  const b0 = q.get("b"); if (b0 && isAddr(b0)) $("cmp-addr").value = b0;
  $("addr").value = a0; go();
})();
