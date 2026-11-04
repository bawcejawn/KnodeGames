/* stake.html: the staking hub, in three plain parts (owner, 2026-11-03: "clear and easy to understand exactly what I'm
   doing, where I'm staked and how much"):
     1. Your stake: the total staked, what's in the wallet, and rewards ready to claim (one Claim button).
     2. Where you're staked: one row per game holding your VHP: how much, whether it's earning this week or from which
        Monday, and Add · Withdraw · Move · Claim right on the row.
     3. Stake in a game: the games you're not in yet, each with one Stake button.
   Every action opens one small step-by-step box under its game: the amount, then a sentence saying exactly what will
   happen ("You'll stake 10 VHP in Producer Race. Your stake there becomes 30 VHP. It starts earning Mon 9 Nov."), then the
   button. Every transaction is built by stake-panel.js (KStake.send) and signed in the player's own wallet; this file
   builds none. Everything on screen is built with textContent. */
(() => {
  "use strict";
  const K = window.KStake;
  const $ = (id) => document.getElementById(id);
  if (!K || !K.overview || !$("hub")) return;
  const F = K.fmt, UNIT = 100000000n;
  const PAGES = { 1: "index.html#play", 2: "blockx.html", 3: "survivor.html", 4: "fantasy.html", 6: "golf.html", 7: "race.html", 8: "combo.html", 9: "bracket.html", 13: "lastnode.html" };
  const Q = 1;   // Daily Questions: staked on its own page (its own contract calls); shown here with a link

  function el(tag, attrs = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") n.className = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) n.append(kid.nodeType ? kid : String(kid));
    return n;
  }
  const vhp = (u) => `${F.amount(u)} VHP`;
  const pct = (x) => (x <= 0 ? "0%" : x < 0.001 ? "less than 0.1%" : `${(x * 100).toLocaleString("en-US", { maximumFractionDigits: x < 0.1 ? 1 : 0 })}%`);
  const sum = (list, f) => list.reduce((t, x) => t + f(x), 0n);
  const rewardOf = (g) => sum(g.claims, (c) => c.reward);

  // open: { id, mode: "stake" | "withdraw" | "move", token, value, to }; done: the last success, shown as a receipt.
  const S = { data: null, open: null, busy: false, note: "", noteCls: "", done: null, showClaims: false };
  const W = () => K.wallet();
  const me = () => { const w = W(); return w && w.address && w.kind !== "guest" ? w.address : null; };
  const nextMonday = () => F.weekDate(S.data.config, S.data.week + 1n);

  let gen = 0;   // only the latest load may show (a slow one from before the wallet connected never overwrites it)
  async function load() {
    const my = ++gen;
    try {
      const d = await K.overview(me());
      if (my !== gen) return;
      S.data = d;
    } catch {
      if (my !== gen) return;
      S.data = S.data || { live: false, error: true };
    }
    render();
  }

  function say(text, cls = "") { S.note = text; S.noteCls = cls; render(); }

  /** Send one action. receipt: { head, lines } shown after it lands. */
  async function run(action, a, receipt) {
    if (S.busy) return;
    S.busy = true; S.done = null; say(`Step 2 of 2: confirm in ${W() && W().label ? W().label() : "your wallet"}…`);
    try {
      const id = await K.send(action, a);
      S.open = null; S.note = "";
      S.done = { ...receipt, pending: !id };
    } catch (e) {
      S.note = K.sayError(e); S.noteCls = "bad";
    }
    S.busy = false;
    await load();
    const r = $("hub-receipt"); if (r && r.scrollIntoView) r.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  const openBox = (g, mode) => { S.open = { id: g.id, mode, token: "VHP", value: "", to: null }; S.note = ""; S.done = null; render(); };

  // ── the step-by-step box for one game: Stake (add), Withdraw or Move ──
  function form(g, mode) {
    const d = S.data, others = d.games.filter((x) => x.active && x.id !== g.id && x.id !== Q);
    const f = S.open;
    const bal = d.wallet ? (f.token === "KOIN" ? d.wallet.koin : d.wallet.vhp) : 0n;
    const most = mode === "stake" ? (bal / UNIT) * UNIT : g.mine;   // stakes are whole numbers
    const input = el("input", { class: "hub-amt", id: "hub-amt", inputmode: mode === "stake" ? "numeric" : "decimal", autocomplete: "off", placeholder: "0", value: f.value || "", "aria-describedby": "hub-review" });
    const units = () => F.toUnits(input.value);
    const set = (v) => { f.value = v; input.value = v; check(); };
    const chips = mode === "stake"
      ? [["1", 1n], ["10", 10n], ["100", 100n]].filter(([, n]) => n * UNIT <= most).map(([t, n]) => [t, F.exact(n * UNIT)]).concat(most > 0n ? [["Max", F.exact(most)]] : [])
      : [["25%", F.exact((most / 4n / 100000n) * 100000n)], ["50%", F.exact((most / 2n / 100000n) * 100000n)], ["All", F.exact(most)]].filter(([, v]) => v !== "0");
    const go = el("button", { class: "btn btn-primary hub-go", type: "button" });
    const review = el("div", { class: "hub-review", id: "hub-review", role: "status" });
    const toName = () => (d.games.find((x) => x.id === f.to) || {}).name;
    function check() {
      f.value = input.value;
      const u = units();
      let bad = "";
      if (!input.value.trim()) bad = " ";
      else if (!u) bad = "Enter an amount, like 5 or 2.5.";
      else if (mode === "stake" && !/^[1-9]\d*$/.test(input.value.trim())) bad = "Stakes are whole numbers (1, 2, 3 …).";
      else if (mode === "stake" && u > bal) bad = `You only have ${F.exact(bal)} ${f.token} in your wallet.`;
      else if (mode !== "stake" && u > g.mine) bad = `You only have ${vhp(g.mine)} staked in ${g.name}.`;
      else if (mode === "move" && !f.to) bad = "Pick the game to move it to.";
      // I-028: taking a staked wallet below the minimum mid-week loses this week's share and free prize (peak_stake).
      const drop = !bad && u && mode !== "stake" && g.staked && g.mine - u < d.min
        ? `Heads up: this leaves less than ${F.exact(d.min)} VHP in ${g.name}, so you get no share of its rewards this week and no free prize.` : "";
      let lines = [];
      if (!bad && u) {
        const amt = `${F.exact(u)} ${mode === "stake" ? f.token : "VHP"}`;
        if (mode === "stake") lines = [
          `You'll stake ${amt} in ${g.name}${f.token === "KOIN" ? " (your KOIN is burned into VHP 1:1)" : ""}.`,
          `Your stake in ${g.name} becomes ${vhp(g.mine + u)}: ${pct(Number(((g.mine + u) * 1000000n) / (g.total + u)) / 1e6)} of the game.`,
          `It starts earning ${nextMonday()}. You can withdraw any time.`];
        else if (mode === "withdraw") lines = [
          `You'll take ${amt} out of ${g.name}, straight back to your wallet, right now.`,
          g.mine - u > 0n ? `${vhp(g.mine - u)} stays staked in ${g.name}.` : `Nothing stays staked in ${g.name}.`, drop];
        else lines = [
          `You'll move ${amt} from ${g.name} to ${toName()}. No tokens leave the vault.`,
          `It starts earning in ${toName()} ${nextMonday()}. You pay this one's Mana yourself.`, drop];
      }
      review.replaceChildren(...(bad.trim() ? [el("p", { class: "bad" }, bad)] : lines.filter(Boolean).map((t) => el("p", { class: t === drop ? "warn" : null }, t))));
      review.hidden = !bad.trim() && !lines.length;
      go.textContent = !bad && u ? ({ stake: `Stake ${F.exact(u)} ${f.token}`, withdraw: `Withdraw ${F.exact(u)} VHP`, move: `Move ${F.exact(u)} VHP` })[mode] : ({ stake: "Stake", withdraw: "Withdraw", move: "Move" })[mode];
      go.disabled = !!bad || S.busy;
    }
    input.addEventListener("input", check);
    go.addEventListener("click", () => {
      const u = units(), amt = F.exact(u);
      if (mode === "stake") run("stake", { game: g.id, units: u, koin: f.token === "KOIN" },
        { head: `Staked ${amt} ${f.token} in ${g.name}`, lines: [`It starts earning ${nextMonday()}.`] });
      else if (mode === "withdraw") run("withdraw", { game: g.id, units: u },
        { head: `Withdrew ${amt} VHP from ${g.name}`, lines: ["It's back in your wallet."] });
      else run("move", { game: g.id, to: f.to, units: u },
        { head: `Moved ${amt} VHP from ${g.name} to ${toName()}`, lines: [`It starts earning there ${nextMonday()}.`] });
    });
    const title = ({ stake: g.mine > 0n ? `Add to ${g.name}` : `Stake in ${g.name}`, withdraw: `Withdraw from ${g.name}`, move: `Move stake out of ${g.name}` })[mode];
    const have = mode === "stake" ? `In your wallet: ${F.amount(bal)} ${f.token}` : `Staked here: ${vhp(g.mine)}`;
    const box = el("div", { class: "hub-form", role: "group", "aria-label": title },
      el("div", { class: "hub-form-head" }, el("b", {}, title), el("button", { class: "hub-x", type: "button", "aria-label": "Close", onclick: () => { S.open = null; render(); } }, "✕")),
      mode === "stake" && d.wallet && d.wallet.koin > 0n ? el("div", { class: "seg", role: "radiogroup", "aria-label": "Pay with" },
        el("span", { class: "muted" }, "Pay with"),
        ...["VHP", "KOIN"].map((t) => el("button", { type: "button", role: "radio", class: f.token === t ? "on" : null, "aria-checked": String(f.token === t),
          onclick: () => { f.token = t; f.value = ""; render(); } }, t))) : null,
      mode === "move" ? el("div", { class: "hub-to" }, el("span", { class: "muted" }, "Move to"),
        ...others.map((x) => el("button", { type: "button", class: `chip${f.to === x.id ? " on" : ""}`, "aria-pressed": String(f.to === x.id), onclick: () => { f.to = x.id; render(); } }, x.name))) : null,
      el("label", { class: "hub-step", for: "hub-amt" }, el("span", {}, "Step 1: how much?"), el("small", { class: "muted" }, have)),
      el("div", { class: "hub-amt-row" }, el("div", { class: "hub-amt-wrap" }, input, el("span", { class: "hub-unit" }, mode === "stake" ? f.token : "VHP")),
        ...chips.map(([t, v]) => el("button", { type: "button", class: "chip", onclick: () => set(v) }, t))),
      review,
      el("div", { class: "hub-form-actions" }, go, el("button", { class: "btn btn-ghost", type: "button", onclick: () => { S.open = null; render(); } }, "Cancel")));
    check();
    setTimeout(() => { if (document.activeElement === document.body || !document.activeElement) input.focus({ preventScroll: true }); }, 0);
    return box;
  }

  /** "Earning this week" / "Starts earning Mon 9 Nov" / both, in plain words. */
  function status(g) {
    if (!g.active) return ["stopped", "This game has stopped: withdraw any time"];
    if (g.staked && g.pending > 0n) return ["on", `Earning this week · ${vhp(g.pending)} more starts ${g.pendingFrom}`];
    if (g.staked) return ["on", "Earning this week"];
    if (g.mine > 0n) return ["wait", `Starts earning ${g.pendingFrom || nextMonday()}`];
    return ["", ""];
  }

  /** A game you hold VHP in. */
  function stakedRow(g) {
    const d = S.data, open = S.open && S.open.id === g.id ? S.open.mode : null, reward = rewardOf(g), [cls, text] = status(g);
    const b = (mode, label) => el("button", { type: "button", class: `btn btn-small ${open === mode ? "btn-primary" : "btn-ghost"}`, disabled: S.busy, "aria-expanded": String(open === mode), onclick: () => (open === mode ? (S.open = null, render()) : openBox(g, mode)) }, label);
    const canMove = d.games.some((x) => x.active && x.id !== g.id && x.id !== Q);
    return el("li", { class: `hub-row mine ${cls}`, id: `g${g.id}` },
      el("div", { class: "hub-row-main" },
        el("div", { class: "hub-row-name" }, el("a", { href: PAGES[g.id] || "games.html" }, g.name),
          el("span", { class: `hub-status ${cls}` }, el("i", { "aria-hidden": "true" }), text)),
        el("div", { class: "hub-row-amt" }, el("b", {}, vhp(g.mine)), el("small", { class: "muted" }, `${pct(g.share)} of ${vhp(g.total)}`))),
      g.id === Q
        ? el("div", { class: "hub-btns" }, el("a", { class: "btn btn-small btn-ghost", href: PAGES[Q] }, "Add, withdraw or claim on Daily Questions →"))
        : el("div", { class: "hub-btns" },
          g.active && !d.paused ? b("stake", "+ Add") : null,
          b("withdraw", "Withdraw"),
          canMove ? b("move", "Move") : null,
          reward > 0n ? el("button", { type: "button", class: "btn btn-small btn-tang", disabled: S.busy, onclick: () => claim(g.claims.map((c) => ({ g, ...c }))) }, `Claim ${vhp(reward)}`) : null),
      open ? form(g, open) : null);
  }

  /** A game you're not in yet. */
  function otherRow(g) {
    const d = S.data, open = S.open && S.open.id === g.id ? S.open.mode : null, reward = rewardOf(g), who = me();
    return el("li", { class: "hub-row", id: `g${g.id}` },
      el("div", { class: "hub-row-main" },
        el("div", { class: "hub-row-name" }, el("a", { href: PAGES[g.id] || "games.html" }, g.name),
          el("small", { class: "muted" }, g.last != null ? `Last week paid ${F.amount(g.last)} VHP per 100 staked` : g.id === Q ? "Stake on its own page" : "New: no full week paid yet")),
        el("div", { class: "hub-row-amt" }, el("b", {}, vhp(g.total)), el("small", { class: "muted" }, "staked by everyone"))),
      who ? el("div", { class: "hub-btns" },
        g.id === Q ? el("a", { class: "btn btn-small btn-ghost", href: PAGES[Q] }, "Stake on Daily Questions →")
          : g.active && !d.paused ? el("button", { type: "button", class: `btn btn-small ${open ? "btn-primary" : "btn-ghost"}`, disabled: S.busy, "aria-expanded": String(!!open), onclick: () => (open ? (S.open = null, render()) : openBox(g, "stake")) }, "Stake") : null,
        reward > 0n ? el("button", { type: "button", class: "btn btn-small btn-tang", disabled: S.busy, onclick: () => claim(g.claims.map((c) => ({ g, ...c }))) }, `Claim ${vhp(reward)}`) : null) : null,
      open ? form(g, open) : null);
  }

  /** Claim up to 10 rewards in one transaction. */
  function claim(list) {
    const first = list.slice(0, 10), total = sum(first, (c) => c.reward);
    const games = [...new Set(first.map((c) => c.g.name))];
    run("claim", { claims: first.map((c) => ({ game: c.g.id, week: c.week })) },
      { head: `Claimed ${vhp(total)}`, lines: [`From ${games.join(", ")}. It's in your wallet.`, list.length > 10 ? `${list.length - 10} more to claim: tap Claim again.` : ""] });
  }

  function summary() {
    const d = S.data, w = W(), who = me();
    if (!who) return el("div", { class: "hub-connect" },
      el("div", {},
        el("b", {}, w && w.kind === "guest" ? "Guests play free." : "See and manage your stakes"),
        el("p", { class: "muted" }, w && w.kind === "guest" ? "To stake, connect a Koinos wallet (Kondor or KOIN Vault)." : "Connect your wallet to see where you're staked, how much, and your rewards."),
        el("ol", { class: "hub-how3" }, el("li", {}, "Pick a game"), el("li", {}, "Stake VHP (it starts earning next Monday)"), el("li", {}, "Claim your rewards each week"))),
      el("button", { type: "button", class: "btn btn-primary", onclick: () => w && w.connect && w.connect() }, "Connect wallet"));
    const mine = d.games.filter((g) => g.mine > 0n), staked = sum(d.games, (g) => g.mine);
    const all = d.games.flatMap((g) => g.claims.map((c) => ({ g, ...c }))), reward = sum(all, (c) => c.reward);
    const earning = sum(d.games.filter((g) => g.staked), (g) => g.mine - g.pending);
    return el("section", { class: "hub-sum", "aria-label": "Your stake" },
      el("div", { class: "hub-sum-main" },
        el("small", {}, "You have staked"),
        el("b", { class: "hub-big" }, vhp(staked)),
        el("span", { class: "muted" }, mine.length ? `in ${mine.length} game${mine.length === 1 ? "" : "s"}${earning > 0n && earning < staked ? ` · ${vhp(earning)} earning this week` : ""}` : "Nothing staked yet: pick a game below.")),
      el("div", { class: "hub-sum-side" },
        el("div", {}, el("small", {}, "In your wallet"), el("b", {}, vhp(d.wallet ? d.wallet.vhp : 0n)),
          d.wallet && d.wallet.koin > 0n ? el("small", { class: "muted" }, `+ ${F.amount(d.wallet.koin)} KOIN`) : el("small", { class: "muted" }, "ready to stake")),
        el("div", { class: reward > 0n ? "has" : null }, el("small", {}, "Rewards to claim"), el("b", {}, vhp(reward)),
          reward > 0n ? el("button", { type: "button", class: "btn btn-small btn-tang", disabled: S.busy, onclick: () => claim(all) }, all.length > 10 ? "Claim (10 at a time)" : "Claim all")
            : el("small", { class: "muted" }, `Next payout ${nextMonday()}`))),
      reward > 0n ? el("button", { type: "button", class: "hub-link", "aria-expanded": String(S.showClaims), onclick: () => { S.showClaims = !S.showClaims; render(); } }, S.showClaims ? "Hide reward details" : `See the ${all.length} reward${all.length === 1 ? "" : "s"}`) : null,
      reward > 0n && S.showClaims ? el("ul", { class: "hub-claims" }, ...all.map((c) => el("li", {},
        el("span", {}, el("b", {}, c.g.name), el("small", { class: "muted" }, `week of ${F.weekDate(d.config, c.week).replace(/^\w+ /, "")}`)),
        el("b", {}, vhp(c.reward)),
        el("button", { type: "button", class: "btn btn-small btn-ghost", disabled: S.busy, onclick: () => claim([c]) }, "Claim")))) : null);
  }

  function render() {
    const d = S.data, who = me();
    $("hub-loading").hidden = !!d;
    if (!d) return;
    $("soon").hidden = d.live || !!d.error;
    $("hub-err").hidden = !d.error;
    $("hub").hidden = !d.live;
    if (!d.live) return;
    const byTotal = (a, b) => (b.id === Q) - (a.id === Q) || Number(b.total - a.total);
    const mine = who ? d.games.filter((g) => g.mine > 0n).sort((a, b) => Number(b.mine - a.mine)) : [];
    const rest = d.games.filter((g) => !mine.includes(g) && (g.active || g.id === Q)).sort(byTotal);
    $("hub-top").replaceChildren(...[
      summary(),
      S.done ? el("div", { class: "hub-receipt", id: "hub-receipt", role: "status" },
        el("b", {}, `✓ ${S.done.head}${S.done.pending ? " (sent: it may take a minute to show)" : ""}`),
        ...S.done.lines.filter(Boolean).map((t) => el("p", {}, t)),
        el("button", { type: "button", class: "hub-x", "aria-label": "Close", onclick: () => { S.done = null; render(); } }, "✕")) : null,
      S.note ? el("p", { class: `hub-note ${S.noteCls}`, role: "status" }, S.note) : null,
      d.paused ? el("p", { class: "hub-note bad" }, "New stakes are paused right now. Withdrawals and claims always work.") : null].filter(Boolean));
    $("hub-body").replaceChildren(
      ...(mine.length ? [el("h2", {}, "Where you're staked"), el("ul", { class: "hub-list" }, ...mine.map(stakedRow))] : []),
      el("h2", {}, mine.length ? "Stake in another game" : "Pick a game to stake in"),
      el("p", { class: "muted hub-sub" }, `At least ${F.exact(d.min)} VHP in a game makes you a staked player there. A new stake starts earning the next Monday.`),
      el("ul", { class: "hub-list" }, ...rest.map(otherRow)));
  }

  // #g7 (from a game page's status bar): open that game's Stake box.
  function fromHash() {
    const m = /^#g(\d{1,3})$/.exec(location.hash);
    if (!m || !S.data || !S.data.live) return;
    const g = S.data.games.find((x) => x.id === Number(m[1]));
    if (!g) return;
    if (me() && g.id !== Q && !S.open) S.open = { id: g.id, mode: g.active ? "stake" : "withdraw", token: "VHP", value: "", to: null };
    render();
    const n = $(`g${g.id}`); if (n && n.scrollIntoView) n.scrollIntoView({ block: "center" });
  }
  window.addEventListener("hashchange", fromHash);
  if (W() && W().subscribe) W().subscribe(() => { S.open = null; S.note = ""; S.done = null; load(); });
  // The wallet needs the game's settings (network, chain id, Mana sponsor) to send from this page, as the game pages do.
  (async () => {
    const lib = window.koilib || window.koinos || window, w = W();
    try {
      const dep = await fetch("./game-data/deployment.json", { cache: "no-cache" }).then((r) => r.json());
      if (w && w.init && lib.Provider) w.init({ provider: new lib.Provider([dep.rpc || "https://koinos.armana.io"]), chainId: dep.chainId, payer: dep.payer, sponsor: dep.sponsor });
    } catch { /* the header's defaults (own Mana) */ }
  })();
  K.badge($("q-badge"), { game: 1, href: "index.html#play" });
  load().then(fromHash);
  setInterval(() => { if (!document.hidden && !S.open && !S.busy) load(); }, 60000);
})();
