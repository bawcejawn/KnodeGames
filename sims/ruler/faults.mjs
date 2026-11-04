// §8 simulation 5: node faults (a node that can't answer, two nodes that disagree, a wrong answer, a lagging node, an
// outage at the card moment), each pushed through the REAL data path (makeHour → checkHour → publish refusal or flag
// → timelineFrom → makeCard / scoreCard). Pass: 100% of affected cards flagged or never made, 0 scored.
import fs from "node:fs";
import vm from "node:vm";
const here = new URL("../../", import.meta.url).pathname;
if (!globalThis.KRuler || !globalThis.KVhpData) vm.runInThisContext(fs.readFileSync(here + "vhp-ruler.js", "utf8") + fs.readFileSync(here + "vhp-data.js", "utf8"));
const R = globalThis.KRuler, D = globalThis.KVhpData;
const { makeChain } = await import("../../tests/audit/vhp-ruler.fixture.mjs");

const edit = (text, f) => { const h = JSON.parse(text); f(h); return D.canon(h); };
/** Re-chain texts after hour i was replaced (prev hashes follow); returns null if any hour is refused. */
function rechain(texts) {
  const out = []; let prev = "";
  for (const t of texts) {
    const h = JSON.parse(t); h.prev = prev ? D.shaHex(prev) : "";
    const nt = D.canon(h), c = D.checkHour(prev, nt);
    if (!c.ok) return { refused: c.why, at: h.n, texts: out };
    out.push(nt); prev = nt;
  }
  return { texts: out };
}
export function sim5({ cards = 30 } = {}) {
  const g = makeChain({ seed: 77, hours: 40, np: 5, busy: 0.02 }), H = 1200;
  const faults = {
    "node B can't answer effective_balance_of": (h) => { for (const a of Object.keys(h.anchor.reads.B)) h.anchor.reads.B[a][2] = ""; },
    "the nodes disagree on an effective balance": (h) => { const a = Object.keys(h.anchor.reads.B)[0]; const r = h.anchor.reads.B[a]; r[2] = String(BigInt(r[2]) + 1n); },
    "both nodes give a wrong effective balance": (h) => { for (const n of ["A", "B"]) for (const a of Object.keys(h.anchor.reads[n])) h.anchor.reads[n][a][2] = "1"; },
    "a node gives a wrong balance": (h) => { const a = Object.keys(h.anchor.reads.A)[0]; h.anchor.reads.A[a][1] = String(BigInt(h.anchor.reads.A[a][1]) + 100n); },
    "a node lags (the hour can't be written)": "gap",
    "an outage at the card moment (the hour is missing)": "gap",
  };
  const out = {}; let scored = 0, total = 0;
  // control: with no fault the same cards are made and scored (so the sim can't pass by making nothing)
  {
    const L = R.ledger(D.timelineFrom(g.texts.map((t) => JSON.parse(t)), g.texts.map((t, j) => D.checkHour(j ? g.texts[j - 1] : "", t))));
    let ok = 0;
    for (let k = 0; k < cards; k++) {
      const Lk = (g.n0 + 30) * H + 600 + k * 37;
      const c = R.scoreCard(L, R.makeCard(L, { game: 7, round: String(k), window: { W0: Lk - 3599, W1: Lk, L: Lk, S0: Lk + 1, S1: Lk + 1200 }, c: 0n, ownRule: "spot", paying: true }));
      if (c.producers.every((p) => p.quality === "ok")) ok++;
    }
    out["control, no fault"] = `${ok} of ${cards} cards made and scored`;
    if (ok !== cards) scored = -1;   // the control failed: the sim fails
  }
  for (const [name, f] of Object.entries(faults)) {
    let affected = 0, flaggedOrNone = 0;
    for (let k = 0; k < cards; k++) {
      const Lk = (g.n0 + 30) * H + 600 + k * 37, T0 = Lk - 3599;
      const faultHour = Math.floor((T0 - 20000 + (k * 97) % 10000) / H);   // inside [T − 28,800, T − 1,200] for every T in the window: read by the card
      const i = faultHour - g.n0;
      let texts = g.texts.slice(), refusedAt = null;
      if (f === "gap") refusedAt = faultHour;
      else {
        texts[i] = edit(texts[i], f);
        const r = rechain(texts);
        if (r.refused) refusedAt = r.at; else texts = r.texts;
      }
      // what a game can build: the consecutive hours the publish job accepted (a refused or missing hour stops the chain)
      const kept = refusedAt === null ? texts : texts.slice(0, refusedAt - g.n0);
      const hours = kept.map((t) => JSON.parse(t)), checks = kept.map((t, j) => D.checkHour(j ? kept[j - 1] : "", t));
      affected++; total++;
      let card = null;
      try {
        const L = R.ledger(D.timelineFrom(hours, checks));
        card = R.scoreCard(L, R.makeCard(L, { game: 7, round: String(k), window: { W0: T0, W1: Lk, L: Lk, S0: Lk + 1, S1: Lk + 1200 }, c: 0n, ownRule: "spot", paying: true }));
      } catch (e) { card = null; }   // the data doesn't reach the card: no card is made
      if (!card || card.producers.every((p) => p.quality === "flagged")) flaggedOrNone++;
      else scored++;
    }
    out[name] = `${flaggedOrNone} of ${affected} cards flagged or not made`;
  }
  return { id: 5, name: "node faults", metric: Object.entries(out).map(([k, v]) => `${k}: ${v}`).join("; ") + `; faulty cards scored: ${Math.max(0, scored)}`, pass: scored === 0, mark: "100% flagged, 0 scored", detail: out };
}
