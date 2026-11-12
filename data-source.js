// Capacity (Capacity chat, Nov 2026): where pages get published game files and the live block strip.
// Loaded first on every page, before any script that fetches data. docs/capacity/README.md explains it all.
//
// MIRROR: when on, a page's request for a published game file on GitHub
//   https://raw.githubusercontent.com/bawcejawn/KnodeGames/<branch>/<file>.json
// goes to the same file on our Cloudflare mirror https://data.knodegames.com/<branch>/<file>.json (byte for byte the
// same file, kept 5 minutes like GitHub's). If the mirror fails, the page asks GitHub exactly as before and leaves the
// mirror alone for 10 minutes. Nothing else is touched: chain calls, wallets, same-site files and every other address
// go straight through.
// LIVE: when on, KGData.live() gives the "latest blocks" file https://live.knodegames.com/live.json (written every few
// seconds from the owner's own node), or null if it's off, older than 20 seconds, or can't be read; pages then read the
// chain as before. Live block strip and block counts only: scores, cards and voids come only from the published game
// files (Ruler chat, 12 Nov).
// Both switches stay off until the owner has checked each Cloudflare step (docs/capacity/OWNER-STEPS.md).
(function () {
  "use strict";
  var ON = { mirror: false, live: false };
  var RAW = "https://raw.githubusercontent.com/bawcejawn/KnodeGames/";
  var MIRROR = "https://data.knodegames.com/";
  var LIVE = "https://live.knodegames.com/live.json";
  var BRANCHES = { "games-data": 1, "race-data": 1, "blocks-data": 1, "names-data": 1, "stats-data": 1, "prize-settings": 1 };
  var FRESH_MS = 20000, SKIP_MS = 600000, LIVE_REUSE_MS = 3000;
  var mirrorDownUntil = 0, liveDownUntil = 0, liveAt = 0, liveP = null, liveVal = null;
  var realFetch = typeof window.fetch === "function" ? window.fetch.bind(window) : null;

  // The mirror address for a GitHub raw game-file URL, or null if it isn't one.
  function mirrorUrl(url) {
    if (typeof url !== "string" || url.indexOf(RAW) !== 0) return null;
    var rest = url.slice(RAW.length).split("#")[0].split("?")[0];
    var branch = rest.split("/")[0];
    if (!BRANCHES[branch] || !/\.json$/.test(rest) || rest.indexOf("..") >= 0 || rest.indexOf("//") >= 0) return null;
    return MIRROR + rest;
  }

  if (ON.mirror && realFetch) {
    window.fetch = function (input, init) {
      var url = typeof input === "string" ? input : (input && typeof input.url === "string" ? input.url : null);
      var alt = Date.now() >= mirrorDownUntil ? mirrorUrl(url) : null;
      if (!alt) return realFetch(input, init);
      return realFetch(alt, init).then(function (r) {
        if (r.ok || r.status === 404) return r;
        mirrorDownUntil = Date.now() + SKIP_MS;
        return realFetch(input, init);
      }, function () {
        mirrorDownUntil = Date.now() + SKIP_MS;
        return realFetch(input, init);
      });
    };
  }

  function isAddr(a) { return typeof a === "string" && /^1[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(a); }
  function goodLive(o, now) {
    if (!o || o.v !== 1 || !o.head || !Array.isArray(o.blocks) || !o.blocks.length) return false;
    if (!(now - o.at < FRESH_MS && o.at - now < FRESH_MS)) return false;
    var last = o.blocks[o.blocks.length - 1];
    if (!last || last.h !== o.head.height) return false;
    for (var i = 0; i < o.blocks.length; i++) if (!isAddr(o.blocks[i].signer) || !Number.isSafeInteger(o.blocks[i].h)) return false;
    return true;
  }
  // { v, at, head: { height, id, time }, blocks: [{ h, signer, time }] oldest first } or null.
  function live() {
    var now = Date.now();
    if (!ON.live || !realFetch || now < liveDownUntil) return Promise.resolve(null);
    if (liveVal && now - liveAt < LIVE_REUSE_MS) return Promise.resolve(goodLive(liveVal, now) ? liveVal : null);
    if (liveP) return liveP;
    liveP = realFetch(LIVE, { cache: "no-cache", credentials: "omit" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (o) {
      liveAt = Date.now();
      if (goodLive(o, liveAt)) { liveVal = o; return o; }
      liveVal = null; liveDownUntil = Date.now() + 60000;   // old or broken: read the chain for a minute, then look again
      return null;
    }, function () { liveDownUntil = Date.now() + 60000; return null; }).then(function (v) { liveP = null; return v; });
    return liveP;
  }

  window.KGData = { on: { mirror: ON.mirror, live: ON.live }, mirrorUrl: mirrorUrl, live: live };
})();
