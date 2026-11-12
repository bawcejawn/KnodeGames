/* Phone navigation: the bottom tab bar (Games · Leaders · Results · Swap · More, written by tools/site-nav.mjs) and the "More" sheet with every other page.
   Marks the tab for the page you're on, and opens/closes the sheet. No data, no storage, no network. */
/* The test week (owner, 9 Nov 2026: "Week 1 = Mon 16"): during the week of Mon 9 Nov every game page and the Stake page
   say it pays nothing. The banner shows only between these two times and is never stored or sent anywhere. */
(function () {
  "use strict";
  const FROM = Date.UTC(2026, 10, 9), UNTIL = Date.UTC(2026, 10, 16);   // Mon 9 Nov 00:00 UTC to Mon 16 Nov 00:00 UTC
  const PAGES = ["index.html", "race.html", "blockx.html", "golf.html", "games.html", "stake.html"];
  const page = location.pathname.split("/").pop() || "index.html";
  const now = Date.now();
  if (!PAGES.includes(page) || now < FROM || now >= UNTIL) return;
  const main = document.querySelector("main");
  if (!main || main.querySelector(".test-week")) return;
  const p = document.createElement("p");
  p.className = "test-week";
  p.setAttribute("role", "note");
  const b = document.createElement("b");
  b.textContent = "Test week:";
  p.append(b, " no rewards; this week's earnings go to Week 1's pool. Week 1 starts Monday 16 November.");
  main.prepend(p);
})();

(function () {
  "use strict";
  const bar = document.querySelector(".tabbar");
  const sheet = document.getElementById("more-sheet");
  if (!bar) return;
  const btn = bar.querySelector(".tb-more");

  // A link's "place": its file, plus the view for index.html (#play, #leaderboard, ...; no hash = the welcome page).
  const place = (u) => {
    const file = u.pathname.split("/").pop() || "index.html";
    if (file !== "index.html") return file;
    const view = (u.hash || "").slice(1).split("/")[0];
    return "index.html#" + (["play", "leaderboard", "results", "how", "welcome"].includes(view) ? view : "welcome");
  };

  function mark() {
    const here = place(location);
    let inSheet = false;
    document.querySelectorAll(".tabbar a, .more-panel a, .tabs a").forEach((a) => {
      const on = place(new URL(a.getAttribute("href"), location.href)) === here;
      if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
      if (on && a.closest(".more-panel")) inSheet = true;
    });
    if (btn) btn.classList.toggle("on", inSheet);
    // A dropdown is lit when the page you're on is inside it.
    document.querySelectorAll(".tabs .dd").forEach((d) => d.classList.toggle("on", !!d.querySelector('a[aria-current="page"]')));
  }

  function open(yes) {
    if (!sheet || !btn) return;
    sheet.hidden = !yes;
    btn.setAttribute("aria-expanded", String(yes));
    document.documentElement.classList.toggle("sheet-open", yes);
  }

  if (btn && sheet) {
    btn.addEventListener("click", () => open(sheet.hidden));
    // Tapping outside the panel, or any link in it, closes the sheet.
    sheet.addEventListener("click", (e) => { if (e.target === sheet || e.target.closest("a")) open(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !sheet.hidden) { open(false); btn.focus(); } });
    // Turning the phone or widening the window past the phone layout closes it too.
    window.addEventListener("resize", () => { if (!sheet.hidden && window.innerWidth > 760) open(false); });
  }

  // Top-menu dropdowns (<details>): one open at a time; an outside tap, Escape or picking a link closes them.
  const dds = [...document.querySelectorAll(".tabs .dd")];
  const closeAll = (except) => dds.forEach((d) => { if (d !== except) d.open = false; });
  dds.forEach((d) => {
    d.addEventListener("toggle", () => { if (d.open) closeAll(d); });
    d.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => { d.open = false; }));
  });
  document.addEventListener("click", (e) => { if (!e.target.closest(".tabs .dd")) closeAll(null); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && dds.some((d) => d.open)) { const o = dds.find((d) => d.open); closeAll(null); o.querySelector("summary").focus(); } });

  // Index switches views by hash; app.js also marks its own tabs, this runs after it so both agree.
  window.addEventListener("hashchange", () => setTimeout(mark, 0));
  window.addEventListener("pageshow", () => { open(false); mark(); });
  mark();
})();
