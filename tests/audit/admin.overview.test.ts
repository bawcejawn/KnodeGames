// The admin page must cover everything (owner, 12 Nov 2026): every game, every stake and prize control, and every
// GitHub switch a workflow reads. These tests fail when something is added to the platform without a card here.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ACTIONS, AREAS, commandFor } from "../../admin/actions.ts";
import { GAMES, VARIABLES, VARIABLES_URL, STANDARD_STEPS, LAUNCH } from "../../admin/switches.ts";

const A = (id: string) => ACTIONS.find((a) => a.id === id)!;

test("every game in the vault's game list is on the admin page, with its own area", () => {
  const dep = JSON.parse(fs.readFileSync("game-data/deployment.json", "utf8"));
  const ids = Object.keys(dep.vaultGames).map(Number).sort((a, b) => a - b);
  assert.deepEqual(GAMES.map((g) => g.id).sort((a, b) => a - b), ids, "GAMES must list exactly the vault's games");
  for (const g of GAMES) {
    assert.equal(g.name, dep.vaultGames[g.id].name, `game ${g.id}: name matches deployment.json`);
    const area = AREAS.find((x) => x.id === g.area);
    assert.ok(area, `game ${g.id}: area ${g.area} exists`);
    assert.equal(area!.gameId, g.id, `game ${g.id}: its area carries the same game id`);
    assert.ok(g.season >= 1 && g.season <= 12);
    assert.ok(LAUNCH.some((l) => l.game === g.id && l.steps.length > 0), `game ${g.id}: has launch steps`);
    for (const st of LAUNCH.find((l) => l.game === g.id)!.steps) if (st.check) assert.ok(A(st.check)?.sends === false, `game ${g.id}: step check ${st.check} is a read-only button`);
  }
  for (const st of STANDARD_STEPS) if (st.check) assert.equal(A(st.check)?.sends, false);
  // Every area that carries a game id is in GAMES (no game with controls but missing from the glance table).
  for (const ar of AREAS) if (ar.gameId) assert.ok(GAMES.some((g) => g.id === ar.gameId), `${ar.id}: game ${ar.gameId} is in GAMES`);
});

test("every game can be staked on, stopped and have its free prize switched, from one place, with the game fixed", () => {
  for (const g of GAMES) {
    const base = { game: String(g.id), name: g.name, season: String(g.season) };
    for (const id of ["prizes-on", "prizes-off"]) {
      const r = commandFor(A(id), base);
      assert.ok("argv" in r, `${id} for game ${g.id}: ${JSON.stringify(r)}`);
      assert.deepEqual((r as any).argv, [id === "prizes-on" ? "on" : "off", String(g.id)]);
    }
    if (!g.addable) { assert.equal(g.id, 1, "only game 1 is never added"); continue; }
    const add = commandFor(A("vault-game-add"), base), apply = commandFor(A("vault-game-apply"), base), stop = commandFor(A("vault-game-stop"), base);
    assert.deepEqual((add as any).argv, ["game-add", String(g.id), g.name, "--staked", "--free", "--season", String(g.season)], `game ${g.id} add`);
    assert.deepEqual((apply as any).argv, ["game-apply", String(g.id)]);
    assert.deepEqual((stop as any).argv, ["game-stop", String(g.id)]);
  }
  // The cards the page opens for a game are the vault's: they need a preview and name their signer.
  for (const id of ["vault-game-add", "vault-game-apply", "vault-game-stop", "prizes-on", "prizes-off"]) {
    const a = A(id); assert.ok(a.sends && a.signer && a.what, id);
    assert.ok((a.params ?? []).some((p) => p.name === "game"), `${id} takes the game id (the page fixes it per game)`);
  }
  // The planned free-prize switch follows the owner's current decisions: the Vault chat's list of 3 Nov (D-081), with the
  // Bracket changed to OFF on 11 Nov (Repo Lens G30-1). Game 13 (Last Node) is ON in every doc; the stored switch is the
  // thing to check (the glance table flags any difference).
  assert.deepEqual(GAMES.filter((g) => g.freePrize === "on").map((g) => g.id), [1, 2, 7, 13]);
  assert.deepEqual(GAMES.filter((g) => g.freePrize === "off").map((g) => g.id), [3, 4, 6, 8, 9]);
  const bracket = LAUNCH.find((l) => l.game === 9)!.steps.map((x) => x.text).join(" ");
  assert.match(bracket, /free prize OFF first/); assert.doesNotMatch(bracket, /free prize ON/i);
  assert.match(bracket, /vault week 4.*Mon 16 to Sun 22 Nov/);
});

test("every GitHub variable a workflow reads has a card, and every card is real", () => {
  const dir = ".github/workflows";
  const used = new Set<string>();
  for (const f of fs.readdirSync(dir)) if (/\.ya?ml$/.test(f)) for (const m of fs.readFileSync(path.join(dir, f), "utf8").matchAll(/vars\.([A-Z][A-Z0-9_]+)/g)) used.add(m[1]);
  const listed = new Set(VARIABLES.map((v) => v.name));
  assert.equal(listed.size, VARIABLES.length, "no variable twice");
  const missing = [...used].filter((n) => !listed.has(n));
  assert.deepEqual(missing, [], `workflows read these variables but the admin page has no card: ${missing.join(", ")}`);
  const unknown = [...listed].filter((n) => !used.has(n));
  assert.deepEqual(unknown, [], `the admin page lists variables no workflow reads: ${unknown.join(", ")}`);
  for (const v of VARIABLES) {
    assert.match(v.name, /^[A-Z][A-Z0-9_]+$/);
    for (const f of ["format", "what", "when"] as const) assert.ok(v[f].trim().length >= 5, `${v.name}: ${f}`);
    for (const g of v.games) assert.ok(GAMES.some((x) => x.id === g), `${v.name}: game ${g} exists`);
  }
});

test("PRIZES_FROM_WEEK says what really happens when it is unset (Repo Lens G30-2)", () => {
  const v = VARIABLES.find((x) => x.name === "PRIZES_FROM_WEEK")!;
  assert.match(v.note!, /NEVER leave it unset or mistyped/); assert.match(v.note!, /held.*staked results.*3 days.*rolls over/);
  assert.match(v.when, /never unset it/); assert.doesNotMatch(v.note! + v.what, /prize text stays off/);
});

test("switches that cannot be undone say so, and the Ruler and hold switches are on the page for their games", () => {
  const V = (n: string) => VARIABLES.find((v) => v.name === n)!;
  assert.match(V("GOLF_STAKED_FROM_WEEK").note!, /PERMANENT/);
  assert.deepEqual(V("GOLF_STAKED_FROM_WEEK").games, [6]);
  assert.deepEqual(V("RACE_RULER_FROM_WEEK").games, [7]); assert.match(V("RACE_RULER_FROM_WEEK").when, /Week 1.*16 Nov.*week 4/);
  assert.deepEqual(V("BRACKET_RULER_FROM_WEEK").games, [9]);
  for (const n of ["GOLF_HOLD_WEEKS", "RACE_HOLD_WEEKS", "QUESTIONS_HOLD", "BLOCKX_RELEASE", "BRACKET_RELEASE"]) assert.ok(V(n), n);
  // The Golf area's hand-written guide and the catalog agree on the names.
  const golf = AREAS.find((a) => a.id === "golf")!.guides![0].steps.join(" ");
  for (const n of ["GOLF_ENABLED", "GOLF_STAKED_FROM_WEEK", "GOLF_HOLD_WEEKS"]) { assert.ok(golf.includes(n), n); assert.ok(V(n).games.includes(6)); }
  assert.match(VARIABLES_URL, /^https:\/\/github\.com\/bawcejawn\/KnodeGames\/settings\/variables\/actions$/);
});

test("the page never holds or asks for a key or a token", () => {
  const blob = JSON.stringify({ GAMES, VARIABLES, STANDARD_STEPS, LAUNCH });
  assert.doesNotMatch(blob, /[0-9A-Za-z]{50,}/, "no long key-like strings in the catalog");
  assert.doesNotMatch(blob, /_WIF\b|PRIVATE|password|secret/i);
  const page = fs.readFileSync("admin/index.html", "utf8");
  assert.doesNotMatch(page, /type="password"|name="token"|ghp_|github_pat_/);
  // Switches are set on GitHub by the owner: the page only opens the link (the same allow-list check as every guide).
  assert.match(page, /GUIDE_URL/);
  assert.match(page, /switchGuide/);
  // The glance screen only runs read-only checks by itself.
  for (const id of ["glance-vault", "glance-prizes", "glance-questions", "glance-picks", "glance-race", "glance-golf", "switches-prizes"]) {
    const a = A(id); assert.equal(a.sends, false, id); assert.equal(a.effect, "none", id); assert.equal(a.area, id.startsWith("switches") ? "switches" : "glance");
  }
  const checks = page.match(/const CHECKS = \[([^\]]+)\]/)![1].match(/"([^"]+)"/g)!.map((x) => x.replace(/"/g, ""));
  for (const id of checks) assert.equal(A(id).sends, false, `Check everything runs only read-only buttons (${id})`);
  assert.match(page, /send: false \}\)/, "Check everything never sends");
});

test("every command can be copied exactly as typed, and the page lists both new screens", () => {
  const page = fs.readFileSync("admin/index.html", "utf8");
  assert.match(page, /copyBtn\(\(\) => a\.command\.replace/, "every card's command has a Copy button");
  assert.match(page, /navigator\.clipboard\.writeText/);
  for (const id of ["glance", "switches"]) { const ar = AREAS.find((a) => a.id === id)!; assert.equal(ar.section, "Start here"); assert.equal(ar.status, "live"); }
  // The first two areas after the health checks, so the owner sees them before any single game.
  const order = AREAS.filter((a) => a.section === "Start here").map((a) => a.id);
  assert.deepEqual(order, ["overview", "glance", "switches"]);
});

test("the server sends the games and switches to the page", async () => {
  const { spawn } = await import("node:child_process");
  const http = await import("node:http");
  const port = 19000 + Math.floor(Math.random() * 900);
  const child = spawn(process.execPath, ["--import", "tsx", "admin/server.ts"], { env: { ...process.env, ADMIN_PORT: String(port), ADMIN_NO_BROWSER: "1" } });
  let out = ""; child.stdout.on("data", (b) => (out += b));
  try {
    for (let i = 0; i < 100 && !/#([0-9a-f]{48})/.test(out); i++) await new Promise((r) => setTimeout(r, 100));
    const key = out.match(/#([0-9a-f]{48})/)![1];
    const body: any = await new Promise((resolve, reject) => {
      http.get({ host: "127.0.0.1", port, path: "/api/actions", headers: { host: `127.0.0.1:${port}`, "x-admin-key": key } }, (res) => {
        let b = ""; res.on("data", (c) => (b += c)); res.on("end", () => resolve(JSON.parse(b)));
      }).on("error", reject);
    });
    assert.equal(body.games.length, GAMES.length);
    assert.equal(body.variables.length, VARIABLES.length);
    assert.equal(body.variablesUrl, VARIABLES_URL);
    assert.ok(body.launch.length === LAUNCH.length && body.standardSteps.length === STANDARD_STEPS.length);
  } finally { child.kill(); }
});

// The screens really draw: the page is loaded in a browser-like window against the real catalog from the real server.
test("Games at a glance and All switches draw every game and every switch, and Check everything fills the table", async () => {
  const { JSDOM } = await import("jsdom");
  const { spawn } = await import("node:child_process");
  const http = await import("node:http");
  const port = 19900 + Math.floor(Math.random() * 90);
  const child = spawn(process.execPath, ["--import", "tsx", "admin/server.ts"], { env: { ...process.env, ADMIN_PORT: String(port), ADMIN_NO_BROWSER: "1" } });
  let out = ""; child.stdout.on("data", (b) => (out += b));
  try {
    for (let i = 0; i < 100 && !/#([0-9a-f]{48})/.test(out); i++) await new Promise((r) => setTimeout(r, 100));
    const key = out.match(/#([0-9a-f]{48})/)![1];
    const cat: any = await new Promise((resolve, reject) => {
      http.get({ host: "127.0.0.1", port, path: "/api/actions", headers: { host: `127.0.0.1:${port}`, "x-admin-key": key } }, (res) => {
        let b = ""; res.on("data", (c) => (b += c)); res.on("end", () => resolve(JSON.parse(b)));
      }).on("error", reject);
    });
    const ran: string[] = [];
    const dom = new JSDOM(fs.readFileSync("admin/index.html", "utf8"), {
      url: `http://127.0.0.1:${port}/#${key}`, runScripts: "dangerously", pretendToBeVisual: true,
      beforeParse(w: any) {
        w.scrollTo = () => {};
        w.fetch = async (p: string, init: any = {}) => {
          if (p === "/api/actions") return { ok: true, status: 200, json: async () => cat };
          const body = JSON.parse(init.body); ran.push(`${body.action}:${body.send}`);
          const output = body.action === "glance-vault" ? "game 6 Block Golf: staked + free prize, from week 5\ngame 7 Producer Race: staked + free prize, from week 3\n" : body.action === "glance-prizes" ? "6 Block Golf  this week: off  next week: off\n7 Producer Race  this week: on  next week: on\n9 Producer Bracket  this week: on  next week: on\n" : "ok\n";
          return { ok: true, status: 200, json: async () => ({ command: "npm run x", code: 0, output, previewed: false }) };
        };
      },
    });
    const w: any = dom.window, doc = w.document, tick = () => new Promise((r) => setTimeout(r, 60));
    await tick(); await tick();
    const click = (re: RegExp) => { const b = [...doc.querySelectorAll(".area-btn")].find((x: any) => re.test(x.textContent)) as any; assert.ok(b, String(re)); b.click(); };
    click(/Games at a glance/);
    const main = doc.querySelector("#main") as any;
    for (const g of GAMES) assert.ok(main.textContent.includes(g.name), `glance shows ${g.name}`);
    assert.ok(main.textContent.includes("GOLF_STAKED_FROM_WEEK") && main.textContent.includes("RACE_RULER_FROM_WEEK"));
    // each game's box holds its fixed-id cards: the game box is read-only
    const golfBox = [...main.querySelectorAll("details.gbox")].find((d: any) => /^Block Golf/.test(d.querySelector("summary").textContent)) as any;
    const gameInputs = [...golfBox.querySelectorAll('input[name="game"]')];
    assert.ok(gameInputs.length >= 4 && gameInputs.every((i: any) => i.value === "6" && i.hasAttribute("readonly")), "game 6 fixed on every card");
    assert.ok(golfBox.textContent.includes("GOLF_STAKED_FROM_WEEK") && /PERMANENT/.test(golfBox.textContent));
    const survivorName = [...main.querySelectorAll("details.gbox")].find((d: any) => /^Survivor/.test(d.querySelector("summary").textContent)).querySelector('input[name="season"]') as any;
    assert.equal(survivorName.value, "2");
    assert.ok(main.querySelectorAll("button.copy").length > 20, "copy buttons everywhere");
    // Check everything: only read-only runs, and the table fills from the vault and prize output
    [...main.querySelectorAll("button")].find((b: any) => /Check everything/.test(b.textContent)).click();
    for (let i = 0; i < 20 && ran.length < 6; i++) await tick();
    await tick();
    assert.deepEqual(ran, ["glance-vault:false", "glance-prizes:false", "glance-questions:false", "glance-picks:false", "glance-race:false", "glance-golf:false"]);
    assert.match(main.querySelector("table.tbl").textContent, /staked \+ free prize, from week 5/);
    assert.match(main.querySelector("table.tbl").textContent, /this week: on\s+next week: on/);
    const row = (name: string) => ([...main.querySelectorAll("table.tbl tbody tr")].find((r: any) => r.textContent.startsWith(name)) as any).textContent;
    assert.doesNotMatch(row("Producer Race"), /DIFFERS/, "live ON matches the plan: no flag");
    assert.doesNotMatch(row("Block Golf"), /DIFFERS/, "live OFF matches the plan: no flag");
    assert.match(row("Producer Bracket"), /planned OFF[\s\S]*DIFFERS from the plan \(OFF\)/, "live ON against a plan of OFF is flagged (Repo Lens G30-1)");
    // All switches lists every variable, and the link is GitHub's variables page only
    click(/All switches/);
    for (const v of VARIABLES) assert.ok(doc.querySelector("#main").textContent.includes(v.name), `switches list ${v.name}`);
    const link = doc.querySelector("#main a.guide-link") as any;
    assert.equal(link.href, VARIABLES_URL);
    // a game's own area shows its switches
    click(/Producer Race/);
    assert.match(doc.querySelector("#main").textContent, /RACE_RULER_FROM_WEEK/);
    // search finds a switch
    const s = doc.querySelector("#search") as any; s.value = "STAKED_FROM"; s.dispatchEvent(new w.Event("input"));
    assert.match(doc.querySelector("#main").textContent, /GOLF_STAKED_FROM_WEEK/);
    w.close();
  } finally { child.kill(); }
});
