/* names.html: get a Koinos @name. The player connects their own wallet (wallet.js: Kondor or KOIN Vault), types a
   name, sees at once whether the Koinos Nicknames contract would accept it (verify_valid_name, a read), and creates
   it with one transaction from that wallet (Nicknames mint, the player's own Mana; the Mana sponsor never pays for
   it). The contract, the recipient and the Mana limit are fixed here. Names are only ever set as textContent.
   "Your @names" lists the wallet's names (get_tokens_by_address) with "Make main" (set_main_token: the name Knode Games
   and other apps show) and "Remove" (burn, asked twice), each one transaction from that wallet, its own Mana. */
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
  const S = { who: "", current: "", mine: [], checked: "", ok: false, minting: false, busy: false, confirm: "", seq: 0 };
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
  async function showWallet() {
    const w = W(), a = w && w.address;
    S.who = a && w.kind !== "guest" ? a : "";
    $("connect").hidden = !!S.who;
    if (!a) { say("who", "Connect your wallet to start."); return check(); }
    if (w.kind === "guest") { say("who", "Guest wallets can't hold an @name. Connect Kondor or KOIN Vault (the button above, or Connect wallet)."); $("connect").hidden = false; return check(); }
    say("who", `${K.short(a)} connected. Checking for an @name…`);
    await readMine(a);
    renderMine();
    check();
  }
  /** The wallet's main @name and every @name it holds (at most 20 shown). */
  async function readMine(a) {
    try {
      const f = await nick();
      const t = (await f.get_main_token({ value: a })).result;
      S.current = t && t.token_id ? hexName(t.token_id) : "";
      const l = (await f.get_tokens_by_address({ address: a, limit: 20 })).result;
      S.mine = ((l && l.token_ids) || []).map(hexName).filter((n) => typeof n === "string" && n.length);
      if (S.current && !S.mine.includes(S.current)) S.mine.unshift(S.current);
    } catch { S.current = S.current || ""; }
  }
  function renderMine() {
    const a = S.who, box = $("mine");
    if (!box) return;
    if (!a) { box.replaceChildren(); return; }
    say("who", S.current ? `${K.short(a)} is @${S.current}.` : S.mine.length ? `${K.short(a)} has an @name but no main one yet: tap Make main.` : `${K.short(a)} has no @name yet.`, S.current ? "good" : "");
    box.replaceChildren(...(S.mine.length ? [el("p", { class: "help", style: "margin:10px 0 6px" }, "Your @names. The main one is what Knode Games and other Koinos apps show."),
      el("ul", { class: "mine" }, ...S.mine.map((n) => el("li", {},
        el("b", {}, `@${n}`),
        n === S.current ? el("span", { class: "main-tag" }, "Main") : el("button", { type: "button", class: "btn btn-small btn-primary", disabled: S.busy || null, onclick: () => makeMain(n) }, "Make main"),
        el("button", { type: "button", class: "btn btn-small btn-ghost", disabled: S.busy || null, onclick: () => remove(n) }, S.confirm === n ? `Tap again to remove @${n} for good` : "Remove"))))] : []));
  }
  /** Send one Nicknames call from the wallet, then wait until the chain shows the result (done() true). */
  async function act(label, call, args, done, what) {
    const w = W(), who = S.who;
    if (S.busy || !w || !who) return false;
    S.busy = true; S.confirm = ""; renderMine();
    try {
      say("mine-msg", `Confirm “${label}” in your wallet…`);
      const op = (await (await nick())[call](args, { onlyOperation: true })).operation;
      await w.send(label, [op]);
      say("mine-msg", "Sent. Waiting for the next block…");
      for (let i = 0; i < 8; i++) { if (await done().catch(() => false)) return true; await wait(5000); }
      say("mine-msg", "Sent, but it isn't confirmed yet. Reload this page in a minute.", "bad");
      return false;
    } catch (e) {
      say("mine-msg", sendError(e, what), "bad");
      return false;
    } finally {
      S.busy = false;
      await readMine(who); renderMine();
    }
  }
  async function makeMain(n) {
    const who = S.who;
    const ok = await act(`make @${n} my main @name`, "set_main_token", { token_id: nickHex(n) },
      async () => { const t = (await (await nick()).get_main_token({ value: who })).result; return !!(t && t.token_id && hexName(t.token_id) === n); }, "change it");
    if (ok) { if (K.setLocal) K.setLocal(who, n); say("mine-msg", `Done: @${n} is your main @name. Knode Games shows it within the hour (on this device, now).`, "good"); }
  }
  async function remove(n) {
    if (S.confirm !== n) { S.confirm = n; renderMine(); setTimeout(() => { if (S.confirm === n) { S.confirm = ""; renderMine(); } }, 8000); return; }
    const who = S.who;
    const ok = await act(`remove @${n}`, "burn", { token_id: nickHex(n) },
      async () => { const r = (await (await nick()).get_address({ value: n }).catch(() => null)); return !(r && r.result && r.result.value === who); }, "remove it");
    if (ok) say("mine-msg", `Done: @${n} is removed. Anyone can create it again.`, "good");
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
        $("nick-mint").disabled = !S.who || S.minting;
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
    if (S.minting || !S.ok || S.checked !== n || !who || !w) return;
    S.minting = true; $("nick-mint").disabled = true;
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
          if (K.setLocal) K.setLocal(who, n);   // show it on this device at once; everyone else within the hour
          say("nick-msg", `Done! You're @${n} on Koinos. It shows on every Knode Games page within the hour.`, "good");
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
      S.minting = false; $("nick-mint").disabled = !S.ok || !S.who;
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
