/* producer.html: the page script (moved out of the HTML so the Content-Security-Policy can refuse inline scripts). */
(async () => {
  "use strict";
  const lib = window.koilib || window.koinos || window;
  const RPC = "https://koinos.armana.io";
  const POB = "159myq5YUhhoVWu3wsHKHiJYKPKGUrGiyv"; // Koinos Proof-of-Burn system contract (mainnet)
  const ABI = {
    methods: {
      register_public_key: { entry_point: 0x53192be1, argument: "pob.register_public_key_arguments", return: "pob.register_public_key_result", read_only: false },
    },
    koilib_types: { nested: { pob: { nested: {
      register_public_key_arguments: { fields: {
        producer: { type: "bytes", id: 1, options: { "(koinos.btype)": "ADDRESS" } },
        public_key: { type: "bytes", id: 2 } } },
      register_public_key_result: { fields: {} },
    } } } },
  };
  const $ = (id) => document.getElementById(id);
  const say = (t) => { $("msg").textContent = t; };
  const provider = new lib.Provider([RPC]);
  let account = null;

  function keyBytesOk(k) {
    try {
      const b = atob(k.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((k.length + 3) % 4));
      return b.length === 33 && (b.charCodeAt(0) === 2 || b.charCodeAt(0) === 3);
    } catch { return false; }
  }

  const W = window.KWallet;
  // The Mana sponsor pays for registering a node key (owner, 5 Nov 2026), through the site's shared payer flow: the
  // sponsor pays only when game-data/deployment.json lists PoB in sponsor.covers and the sponsor says it would pay;
  // otherwise the wallet pays its own Mana, as before. Same settings as the game pages (chain id pinned).
  let dep = null;
  try { const r = await fetch("game-data/deployment.json", { cache: "no-cache" }); if (r.ok) dep = await r.json(); } catch { /* the wallet pays its own Mana */ }
  W.init({ provider, chainId: dep && dep.chainId, payer: dep && dep.payer, sponsor: dep && dep.sponsor, toast: (t) => say(t), onChange: (addr) => {
    account = addr;
    $("addr").value = addr || "";
    $("connect").textContent = addr ? "Disconnect" : "Connect wallet";
    $("send").disabled = !addr;
    say(addr ? `Connected with ${W.label()}. Check the address above is the one your node produces for, paste the public key, then Register.` : "Not connected.");
  } });
  $("connect").onclick = async () => {
    if (account) return W.disconnect();
    try { await W.connect(); } catch (e) { say(String(e.message || e)); }
  };

  $("send").onclick = async () => {
    const key = $("key").value.trim();
    if (!account) return say("Connect a wallet first.");
    if (W.kind === "guest") return say("A guest account can't run a node. Connect the Kondor or KOIN Vault wallet that holds your VHP.");
    if (!keyBytesOk(key)) return say("That isn't a node PUBLIC key (33 bytes, base64url, starts with A). Copy it again from your node's public.key (Run a node, step 6).");
    try {
      const pob = new lib.Contract({ id: POB, abi: ABI, provider });
      const { operation } = await pob.functions.register_public_key({ producer: account, public_key: key }, { onlyOperation: true });
      say(`Confirm in ${W.label()}…`);
      const id = await W.send("register this node key", [operation]);
      say(id ? "Done. The key becomes active in about a minute.\nTransaction: " + id : "Sent, not yet seen in a block. Check your wallet's history in a minute.");
    } catch (e) {
      const m = String(e.message || e);
      say(/reject|denied|cancel/i.test(m) ? `Cancelled in ${W.label()}.` : "Not sent: " + m.slice(0, 300));
    }
  };
})();
