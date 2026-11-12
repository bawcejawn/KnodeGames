/* names.html: get a Koinos @name. The player connects their own wallet (wallet.js: Kondor or KOIN Vault), types a
   name, sees at once whether the Koinos Nicknames contract would accept it (verify_valid_name, a read), and creates
   it with one transaction from that wallet (Nicknames mint, the player's own Mana; the Mana sponsor never pays for
   it). The contract, the recipient and the Mana limit are fixed here. Names are only ever set as textContent.
   "Your @names" lists the wallet's names (get_tokens_by_address) with "Make main" (set_main_token: the name Knode Games
   and other apps show) and "Remove" (burn, asked twice), each one transaction from that wallet, its own Mana.
   The list belongs to the wallet it was read for (S.mineOf): it is cleared at once on a wallet switch, a read that
   finishes for another wallet is dropped, and a button only acts while that wallet is still the connected one. A change
   is "Done" only when a read that succeeded shows it on chain; a failed read means "not confirmed yet" (Repo Lens C-5). */
(() => {
  "use strict";
  const K = window.KNames, R = K && K.rules;
  const lib = window.koilib || window.koinos || window;
  const $ = (id) => document.getElementById(id);
  if (!K || !$("nick")) return;

  const NICKNAMES = "1KD9Es7LBBjA1FY3ViCgQJ7e6WH1ipKbhz";   // the Koinos Nicknames contract
  const W = () => window.KWallet;
  const say = (id, text, cls) => { const e = $(id); e.textContent = text || ""; e.className = `msg${cls ? ` ${cls}` : ""}`; };
  const nickHex = (n) => "0x" + Array.from(new TextEncoder().encode(n), (b) => b.toString(16).padStart(2, "0")).join("");
  const nickOf = () => $("nick").value.trim().toLowerCase().replace(/^@/, "");
  // busy: one lock for Create, Make main and Remove (one wallet prompt at a time). mine: [{ n, hex }], hex exactly as the
  // contract listed it (sent back as is, Repo Lens C5-10). gen: bumped on every wallet change (stale reads are dropped).
  const S = { who: "", current: "", mine: [], mineOf: "", checked: "", ok: false, busy: false, confirm: "", armedAt: 0, seq: 0, gen: 0 };
  const TAP_GAP_MS = 600;   // "Tap again" counts only this long after the first tap: a double click never burns (C5-4)
  const hexName = (h) => new TextDecoder().decode(lib.utils.toUint8Array(String(h).replace(/^0x/, "")));
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k === "class") n.className = v; else if (k.startsWith("on")) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? "" : v); }
    for (const c of kids.flat()) if (c != null && c !== false) n.append(c);
    return n;
  };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  /** The wallet's own words for a failed send, in plain language. */
  function sendError(e, what) {
    const m = String((e && e.message) || e);
    return /reject|denied|cancel/i.test(m) ? "Cancelled in your wallet. Nothing was sent."
      : /pending account resources/i.test(m) ? "Your Mana is still busy with your last transaction. Wait a minute and try again."
      : /mana|rc_limit|insufficient/i.test(m) ? "Your wallet doesn't have enough Mana right now. Mana comes from the KOIN in your wallet and refills by itself; try again later."
      : `Couldn't ${what}: ${reason(e)}`;
  }

  let contract = null;
  async function nick(signer) {
    if (!contract) {
      const dep = await fetch("./game-data/deployment.json", { cache: "no-cache" }).then((r) => r.json()).catch(() => ({}));
      contract = new lib.Contract({ id: NICKNAMES, abi: lib.utils.nicknamesAbi, provider: new lib.Provider([dep.rpc || "https://koinos.armana.io"]) });
    }
    return contract.functions;
  }
  /** The contract's own words for why a name can't be used (or null when it's available). */
  function reason(e) {
    const m = String((e && e.message) || e || "");
    const j = /"message"\s*:\s*"([^"]{3,140})"/.exec(m);
    const t = (j ? j[1] : m.replace(/^Error:\s*/, "")).trim();
    return t && t.length <= 160 && !/[{}<>]/.test(t) ? t.charAt(0).toUpperCase() + t.slice(1) + (/[.!?]$/.test(t) ? "" : ".") : "That name can't be used.";
  }

  // ── 1. the wallet ──
  /** The connected wallet, when it can hold an @name (not a guest). */
  const liveWho = () => { const w = W(); return w && w.address && w.kind !== "guest" ? w.address : ""; };
  async function showWallet() {
    const w = W(), a = w && w.address;
    const who = liveWho();
    if (who !== S.who || S.mineOf !== who) { S.gen++; S.mine = []; S.current = ""; S.mineOf = ""; S.confirm = ""; say("mine-msg", ""); }
    S.who = who;
    renderMine();   // never leave another wallet's names (or a guest's empty buttons) on screen (C5-3, C5-5)
    $("connect").hidden = !!S.who;
    if (!a) { say("who", "Connect your wallet to start."); return check(); }
    if (w.kind === "guest") { say("who", "Guest wallets can't hold an @name. Connect Kondor or KOIN Vault (the button above, or Connect wallet)."); $("connect").hidden = false; return check(); }
    say("who", `${K.short(a)} connected. Checking for an @name…`);
    const got = await readMine(a);
    if (got === null) say("who", `${K.short(a)} connected. Couldn't read its @names right now: reload the page in a minute.`, "bad");
    else renderMine();
    check();
  }
  /** Reads a wallet's main @name and every @name it holds (at most 20), without changing the page.
   *  Returns { current, mine } or null when the chain couldn't be read. */
  async function readNames(a) {
    try {
      const f = await nick();
      const t = (await f.get_main_token({ value: a })).result;
      const l = (await f.get_tokens_by_address({ address: a, limit: 20 })).result;
      const mine = ((l && l.token_ids) || []).map((h) => ({ n: hexName(h), hex: String(h) })).filter((x) => typeof x.n === "string" && x.n.length);
      const current = t && t.token_id ? hexName(t.token_id) : "";
      if (current && !mine.some((x) => x.n === current)) mine.unshift({ n: current, hex: String(t.token_id) });
      return { current, mine };
    } catch { return null; }
  }
  /** Reads the list for wallet a and keeps it only if a is still the connected wallet (C5-3). A failed read clears it. */
  async function readMine(a) {
    const gen = S.gen, got = await readNames(a);
    if (gen !== S.gen || liveWho() !== a) return undefined;   // the wallet changed meanwhile: drop it
    S.mine = got ? got.mine : []; S.current = got ? got.current : ""; S.mineOf = got ? a : "";
    return got;
  }
  /** True only when wallet a is connected and the list on screen was read for it. */
  const listIsFor = (a) => !!a && S.mineOf === a && liveWho() === a;
  function renderMine() {
    const a = S.who, box = $("mine");
    if (!box) return;
    if (!listIsFor(a)) { box.replaceChildren(); return; }
    say("who", S.current ? `${K.short(a)} is @${S.current}.` : S.mine.length ? `${K.short(a)} has an @name but no main one yet: tap Make main.` : `${K.short(a)} has no @name yet.`, S.current ? "good" : "");
    box.replaceChildren(...(S.mine.length ? [el("p", { class: "help", style: "margin:10px 0 6px" }, "Your @names. The main one is what Knode Games and other Koinos apps show."),
      el("ul", { class: "mine" }, ...S.mine.map((x) => el("li", {},
        el("b", {}, `@${x.n}`),
        x.n === S.current ? el("span", { class: "main-tag" }, "Main") : el("button", { type: "button", class: "btn btn-small btn-primary", disabled: S.busy || null, onclick: () => makeMain(x, a) }, "Make main"),
        el("button", { type: "button", class: "btn btn-small btn-ghost", disabled: S.busy || null, onclick: () => remove(x, a) }, S.confirm === x.hex ? `Tap again to remove @${x.n} for good` : "Remove"))))] : []));
  }
  /** Does wallet a still hold this name? true / false, or null when the chain couldn't be read. */
  async function holds(a, x) {
    try {
      const l = (await (await nick()).get_tokens_by_address({ address: a, limit: 100 })).result;
      return ((l && l.token_ids) || []).some((h) => String(h).toLowerCase() === x.hex.toLowerCase());
    } catch { return null; }
  }
  /** Is the name gone from the chain? true only when a read succeeded and said it doesn't exist (or points nowhere). */
  async function gone(x) {
    try {
      const r = (await (await nick()).get_address({ value: x.n })).result;
      return !(r && r.value);
    } catch (e) { return /does not exist|not exist|not found/i.test(String((e && e.message) || e)); }
  }
  /** Send one Nicknames call from wallet who (the one whose list was tapped), then wait until a successful read shows
   *  the result (done() true). Before sending, the name must still be that wallet's (re-read now). */
  async function act(who, x, label, call, args, done, what) {
    const w = W();
    if (S.busy || !w || !listIsFor(who)) return false;
    S.busy = true; S.confirm = ""; renderMine();
    try {
      const own = await holds(who, x);
      if (!listIsFor(who)) return false;
      if (own === null) { say("mine-msg", "Couldn't check your @names right now. Nothing was sent; try again in a minute.", "bad"); return false; }
      if (!own) { say("mine-msg", `@${x.n} isn't in this wallet any more. Nothing was sent.`, "bad"); return false; }
      say("mine-msg", `Confirm “${label}” in your wallet…`);
      const op = (await (await nick())[call](args, { onlyOperation: true })).operation;
      if (!listIsFor(who)) { say("mine-msg", "Your wallet changed. Nothing was sent.", "bad"); return false; }
      await w.send(label, [op]);
      say("mine-msg", "Sent. Waiting for the next block…");
      for (let i = 0; i < 8; i++) { if (await done().catch(() => false)) return true; await wait(5000); }
      say("mine-msg", "Sent, but it isn't confirmed yet. Check your wallet, then reload this page in a minute.", "bad");
      return false;
    } catch (e) {
      say("mine-msg", sendError(e, what), "bad");
      return false;
    } finally {
      S.busy = false;
      await readMine(who); renderMine(); check();
    }
  }
  async function makeMain(x, who) {
    const ok = await act(who, x, `make @${x.n} my main @name`, "set_main_token", { token_id: x.hex },
      async () => { const t = (await (await nick()).get_main_token({ value: who })).result; return !!(t && t.token_id && String(t.token_id).toLowerCase() === x.hex.toLowerCase()); }, "change it");
    if (ok && liveWho() === who) { if (K.setLocal) K.setLocal(who, x.n); say("mine-msg", `Done: @${x.n} is your main @name. Knode Games usually shows it within the hour (on this device, now).`, "good"); }
  }
  async function remove(x, who) {
    if (S.busy || !listIsFor(who)) return;
    if (S.confirm !== x.hex) {
      S.confirm = x.hex; S.armedAt = Date.now(); renderMine();
      setTimeout(() => { if (S.confirm === x.hex) { S.confirm = ""; renderMine(); } }, 8000);
      return;
    }
    if (Date.now() - S.armedAt < TAP_GAP_MS) return;   // the second click of a double click (C5-4)
    // Done only when a read that worked shows the name gone from this wallet AND from the chain (C5-2).
    const ok = await act(who, x, `remove @${x.n}`, "burn", { token_id: x.hex },
      async () => (await holds(who, x)) === false && (await gone(x)), "remove it");
    if (ok && liveWho() === who) {
      if (K.clearLocal) K.clearLocal(who, x.n);   // the header stops showing it now (C5-7)
      say("mine-msg", `Done: @${x.n} is removed. Anyone can create it again.`, "good");
    }
  }
  $("connect").addEventListener("click", () => { const w = W(); if (w && w.connect) w.connect(); });
  if (W() && W().subscribe) W().subscribe(() => showWallet());

  // ── 2. the name: checked as you type ──
  let timer = null;
  function check() {
    clearTimeout(timer);
    const n = nickOf(), my = ++S.seq;
    S.ok = false; S.checked = "";
    $("nick-mint").textContent = n ? `Create @${n}` : "Create @name";
    $("nick-mint").disabled = true;
    if (!n) return say("nick-msg", "");
    if (!/^[a-z][a-z0-9.-]{2,31}$/.test(n)) return say("nick-msg", "3 to 32 characters: lowercase letters, numbers, dots and dashes, starting with a letter.", "bad");
    if (!R.okNick(n)) return say("nick-msg", "That one imitates Knode Games or Koinos, or looks like an address. Pick another.", "bad");
    say("nick-msg", "Checking…");
    timer = setTimeout(async () => {
      try {
        // Valid names come back as "@name is available"; anything else is refused with the contract's reason.
        const v = (await (await nick()).verify_valid_name({ value: n })).result;
        if (my !== S.seq) return;
        const text = String((v && v.value) || "");
        if (!/is available$/.test(text)) return say("nick-msg", text || "That name can't be used.", "bad");
        S.ok = true; S.checked = n;
        say("nick-msg", `✓ @${n} is available.${S.who ? "" : " Connect your wallet to create it."}`, "good");
        $("nick-mint").disabled = !S.who || S.busy;
      } catch (e) {
        if (my !== S.seq) return;
        say("nick-msg", reason(e), "bad");
      }
    }, 350);
  }
  $("nick").addEventListener("input", check);

  // ── 3. create it ──
  $("nick-mint").addEventListener("click", async () => {
    const w = W(), n = nickOf(), who = S.who;
    if (S.busy || !S.ok || S.checked !== n || !who || !w) return;
    S.busy = true; $("nick-mint").disabled = true; renderMine();   // one lock for Create, Make main and Remove (C5-6)
    try {
      say("nick-msg", `Confirm “Create @${n}” in your wallet…`);
      const op = (await (await nick()).mint({ to: who, token_id: nickHex(n) }, { onlyOperation: true })).operation;
      const id = await w.send(`create @${n}`, [op]);
      say("nick-msg", "Sent. Waiting for the next block…");
      // Only the chain says whether it worked: who owns @name now?
      let owner = null;
      for (let i = 0; i < 6 && owner !== who; i++) {
        try { owner = (await (await nick()).get_address({ value: n })).result?.value || null; } catch { owner = null; }
        if (owner !== who) await new Promise((r) => setTimeout(r, 5000));
      }
      if (owner === who) {
        $("nick").value = ""; S.ok = false;
        await readMine(who);
        if (S.current === n) {
          if (K.setLocal) K.setLocal(who, n);   // show it on this device at once; everyone else usually within the hour
          say("nick-msg", `Done! You're @${n} on Koinos. Knode Games pages usually show it within the hour.`, "good");   // C5-8: only wallets the bot looks up
        } else {
          // Minting doesn't change a wallet's main @name (I-020): offer it right here.
          say("nick-msg", `Created @${n}. Your main @name is still @${S.current || "none"}: tap Make main next to @${n} below to show it instead.`, "good");
        }
        renderMine(); check();
      } else {
        say("nick-msg", id ? "Sent, but it isn't confirmed yet. Check your wallet in a minute before trying again." : "Not confirmed yet. Check your wallet before trying again.", "bad");
      }
    } catch (e) {
      const m = String((e && e.message) || e);
      say("nick-msg", /reject|denied|cancel/i.test(m) ? "Cancelled in your wallet. Nothing was sent."
        : /pending account resources/i.test(m) ? "Your Mana is still busy with your last transaction. Wait a minute and try again."
        : /mana|rc_limit|insufficient/i.test(m) ? "Your wallet doesn't have enough Mana right now. Mana comes from the KOIN in your wallet and refills by itself; try again later."
        : `Couldn't create it: ${reason(e)}`, "bad");
    } finally {
      S.busy = false; $("nick-mint").disabled = !S.ok || !S.who; renderMine();
    }
  });

  // The wallet needs a network to send from this page (its own Mana: the Mana sponsor never pays for an @name).
  (async () => {
    const w = W();
    try {
      const dep = await fetch("./game-data/deployment.json", { cache: "no-cache" }).then((r) => r.json());
      if (w && w.init && lib.Provider) w.init({ provider: new lib.Provider([dep.rpc || "https://koinos.armana.io"]), chainId: dep.chainId });
    } catch { /* the header's defaults */ }
  })();
  K.load();
  showWallet();
})();
