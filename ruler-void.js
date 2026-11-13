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
  /** Repo Lens #G-28 G28-1: how the board pays a race in a week the ruler is ON for, so the pages say the same.
      null = not a ruler-scored race (no file, off or shadow: the race's own standings stand). Otherwise
      { pending: true } while the ruler's card hasn't come in, or { pending: false, placings, first, shows, standings }:
      1st = placings[0]; a show = the ruler's 2nd or 3rd with at least one block signed (G15-1); an empty field
      (every producer void) means no pick scores. A pick on a voided producer is a loss (it is never in placings). */
  function ruledOutcome(entry, file) {
    if (!file || file.mode !== "on" || file.shadow === true) return null;
    if (!entry || typeof entry.card !== "string" || !entry.card || !Array.isArray(entry.placings)) return { pending: true };
    let card;
    try { card = JSON.parse(entry.card); } catch { return { pending: true }; }
    const signed = new Map((card && Array.isArray(card.producers) ? card.producers : []).filter((q) => q && typeof q.a === "string").map((q) => [q.a, q.signed]));
    const placings = entry.placings.filter((a) => typeof a === "string" && ADDR.test(a));
    const shows = placings.slice(1, 3).filter((a) => Number.isInteger(signed.get(a)) && signed.get(a) >= 1);
    return { pending: false, placings, first: placings[0] || null, shows, standings: placings.map((a) => ({ a })) };
  }
  /** One pick's outcome on a ruled race: { win, show } for the picked producer. */
  function ruledPick(o, producer) {
    if (!o || o.pending) return { win: false, show: false };
    const win = !!o.first && producer === o.first;
    return { win, show: !win && o.shows.includes(producer) };
  }
  const api = { rulerVoids, ruledOutcome, ruledPick };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.KRulerVoid = api;
})(typeof window !== "undefined" ? window : globalThis);
