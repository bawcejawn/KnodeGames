/* run-node.html: the "Run a node" guide.
   - Picks the visitor's computer (Windows / Mac / Linux) and shows only those commands.
   - Fills the producer ADDRESS (public, never a key) into the commands on screen.
   - Copy buttons and tick-boxes.
   This page reads nothing from and sends nothing to any chain or server. The only thing kept is in this browser's own
   storage (computer choice, address, ticks), and the page works the same when storage is blocked. */
(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const KEY = "kg-run-node-v1";
  const SLOT = "YOUR_PRODUCER_ADDRESS";
  // A Koinos address: base58, starts with 1, 26–35 characters. A private key (WIF) starts with 5, K or L and is longer.
  const ADDR_RE = /^1[1-9A-HJ-NP-Za-km-z]{25,34}$/;
  const KEYLIKE_RE = /^(5|K|L)[1-9A-HJ-NP-Za-km-z]{50,51}$|^(0x)?[0-9a-fA-F]{64}$/;

  let state = { os: "", addr: "", checks: {} };
  try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s && typeof s === "object") state = { ...state, ...s, checks: { ...(s.checks || {}) } }; } catch { /* storage blocked: start fresh */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* fine without it */ } };

  // ---------- computer ----------
  function guessOs() {
    const p = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent || "";
    if (/win/i.test(p)) return "win";
    if (/mac/i.test(p)) return "mac";
    if (/linux|x11|cros/i.test(p) && !/android/i.test(navigator.userAgent || "")) return "linux";
    return "win";
  }
  function setOs(os) {
    if (!["win", "mac", "linux"].includes(os)) os = "win";
    state.os = os; save();
    document.body.setAttribute("data-rn-os", os);
    for (const b of $$(".rn-os-b")) b.setAttribute("aria-pressed", String(b.dataset.pick === os));
  }
  for (const b of $$(".rn-os-b")) b.addEventListener("click", () => setOs(b.dataset.pick));

  // ---------- address ----------
  const input = $("#rn-addr"), msg = $("#rn-addr-msg");
  function setAddr(raw, fromTyping) {
    const v = String(raw || "").trim();
    if (KEYLIKE_RE.test(v)) {
      input.value = "";
      state.addr = ""; save();
      msg.textContent = "That looks like a PRIVATE key. Don't paste it anywhere. It was not kept. If it's your wallet's key, move your funds to a new wallet.";
      msg.className = "rn-addr-msg rn-bad";
      paint("");
      return;
    }
    const ok = ADDR_RE.test(v);
    state.addr = ok ? v : ""; save();
    if (!v) { msg.textContent = "Your public address only. Never a private key."; msg.className = "rn-addr-msg muted"; }
    else if (ok) { msg.textContent = "Filled into every command below."; msg.className = "rn-addr-msg rn-good"; }
    else if (fromTyping) { msg.textContent = "A Koinos address starts with 1 and is 26–35 letters and numbers. Copy it from your wallet."; msg.className = "rn-addr-msg rn-bad"; }
    paint(state.addr);
  }
  function paint(addr) {
    for (const s of $$(".rn-addr")) { s.textContent = addr || SLOT; s.classList.toggle("rn-addr-set", !!addr); }
    for (const h of $$(".rn-addr-hint")) h.hidden = !!addr;
  }
  input.addEventListener("input", () => setAddr(input.value, true));

  // ---------- copy ----------
  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); return true; } catch { /* fall back */ }
    try {
      const ta = document.createElement("textarea");
      ta.value = t; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch { return false; }
  }
  for (const b of $$(".rn-copy")) {
    b.addEventListener("click", async () => {
      const code = b.closest(".rn-cmd").querySelector("code");
      if (code.querySelector(".rn-addr") && !state.addr) {
        b.textContent = "Type your address at the top first";
        setTimeout(() => { b.textContent = "Copy"; }, 2600);
        input.focus();
        return;
      }
      const ok = await copyText(code.textContent);
      b.textContent = ok ? "Copied ✓" : "Select and copy by hand";
      setTimeout(() => { b.textContent = "Copy"; }, 1800);
    });
  }

  // ---------- ticks ----------
  const boxes = $$("input[data-check]");
  function count() {
    const done = $$('input[data-check^="step-"]').filter((x) => x.checked).length;
    $("#rn-count").textContent = `${done} of 10 steps done`;
    $("#rn-bar").style.width = `${done * 10}%`;
    for (const x of $$('input[data-check^="step-"]')) x.closest(".rn-step").classList.toggle("rn-is-done", x.checked);
  }
  for (const x of boxes) {
    x.checked = !!state.checks[x.dataset.check];
    x.addEventListener("change", () => { if (x.checked) state.checks[x.dataset.check] = 1; else delete state.checks[x.dataset.check]; save(); count(); });
  }
  $("#rn-reset").addEventListener("click", () => { state.checks = {}; save(); for (const x of boxes) x.checked = false; count(); });

  setOs(state.os || guessOs());
  input.value = state.addr || "";
  setAddr(state.addr, false);
  count();
})();
