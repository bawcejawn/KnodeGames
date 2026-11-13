/* The Ecosystem page: Koinos apps and sites, read from ads.json ("ecosystem", then "featured" is shown in its own block
   in the page). Only https links; every value goes in as text. No wallet, no storage, no other network. */
(function () {
  "use strict";
  const grid = document.getElementById("eco-grid");
  if (!grid) return;
  const https = (u) => { try { const x = new URL(String(u)); return x.protocol === "https:" ? x.href : null; } catch { return null; } };
  const item = (h) => {
    const a = document.createElement("a"), b = document.createElement("b"), s = document.createElement("span");
    a.className = "eco-item"; a.href = https(h.link); a.target = "_blank"; a.rel = "noopener";
    b.textContent = String(h.name); s.textContent = String(h.tagline || "");
    a.append(b, s); return a;
  };
  fetch("ads.json", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then((ads) => {
    const list = (Array.isArray(ads.ecosystem) ? ads.ecosystem : []).filter((h) => h && h.name && https(h.link));
    if (!list.length) { const p = document.createElement("p"); p.className = "muted"; p.textContent = "The list could not be loaded. Please try again later."; grid.replaceChildren(p); return; }
    grid.replaceChildren(...list.map(item));
  });
})();
