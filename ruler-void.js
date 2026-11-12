/* Knode Games: reads one race's VHP-ruler entry (race-data R<week>.json) and says which producers were void.
   Pure: no network, no storage, no HTML. The entry's `card` is a JSON string; producers[j].void is true or false. */
(function (root) {
  "use strict";
  const ADDR = /^[1-9A-HJ-NP-Za-km-z]{25,40}$/;
  /** { has, shadow, wholeVoid, voids } for one race entry (or file + entry). Anything unreadable gives has:false. */
  function rulerVoids(entry, file) {
    const none = { has: false, shadow: false, wholeVoid: false, voids: [] };
    if (!entry || typeof entry.card !== "string" || !entry.card) return none;
    let card;
    try { card = JSON.parse(entry.card); } catch { return none; }
    if (!card || !Array.isArray(card.producers)) return none;
    const voids = card.producers.filter((p) => p && p.void === true && typeof p.a === "string" && ADDR.test(p.a)).map((p) => p.a);
    return {
      has: true,
      shadow: entry.shadow === true || !!(file && file.shadow === true),
      wholeVoid: Array.isArray(entry.placings) && entry.placings.length === 0,
      voids,
    };
  }
  const api = { rulerVoids };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.KRulerVoid = api;
})(typeof window !== "undefined" ? window : globalThis);
