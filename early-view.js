/* Runs first, before the page is drawn: marks which view the address asks for (#play, #leaderboard, #results, #how, or the
   welcome page by default), so styles.css can hide the other views at once and no wrong page flashes while app.js loads.
   app.js keeps this in step when you move between views. Reads the address only: no storage, no network. */
(function () {
  "use strict";
  var v = (location.hash || "").slice(1).split("/")[0];
  document.documentElement.setAttribute("data-v", ["play", "leaderboard", "results", "how", "welcome"].indexOf(v) >= 0 ? v : "welcome");
})();
