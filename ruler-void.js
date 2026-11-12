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
  /** The Ruler's outcome for one pick ([wallet, producer, ...]) in an ON week: win / show / loss / void / waiting.
   *  null when the file isn't ON: the W file's own flags decide then. The same rule as bot/race-ruler.ts ruledResult:
   *  a void producer is a loss; when no producer counted (no placings) the race is void and NO pick scores (picks are
   *  never returned, owner 12 Nov); a 2nd or 3rd scores a show only if that producer signed at least 1 block (D-033);
   *  no Ruler result for the race yet means waiting. Repo Lens #G-28 G28-1. */
  function ruledPick(entry, file, pick) {
    if (!file || file.mode !== "on" || !Array.isArray(pick)) return null;
    if (!entry || typeof entry.card !== "string" || !entry.card || !Array.isArray(entry.placings)) return { outcome: "waiting" };
    const pl = entry.placings;
    if (!pl.length) return { outcome: "void" };
    if (pick[1] === pl[0]) return { outcome: "win", place: 1 };
    let card; try { card = JSON.parse(entry.card); } catch { return { outcome: "waiting" }; }
    const row = (card.producers || []).find((p) => p && p.a === pick[1]);
    const i = pl.indexOf(pick[1]);
    if ((i === 1 || i === 2) && Number(row && row.signed) >= 1) return { outcome: "show", place: i + 1 };
    return { outcome: "loss" };
  }
  const api = { rulerVoids, ruledPick };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.KRulerVoid = api;
})(typeof window !== "undefined" ? window : globalThis);
