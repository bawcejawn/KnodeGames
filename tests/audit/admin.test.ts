// The local admin page: values are checked, nothing can be sent without the same preview first, and only this
// computer, with the session key, from the page itself, can use it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import { ACTIONS, AREAS, KINDS, commandFor } from "../../admin/actions.ts";

const A = (id: string) => ACTIONS.find((a) => a.id === id)!;

test("values must match exactly; nothing can smuggle in an option such as --send", () => {
  assert.deepEqual(commandFor(A("void"), { id: "12", reason: "wrong window" }), { argv: ["void", "12", "wrong", "window"] });
  assert.ok("error" in commandFor(A("void"), { id: "12", reason: "x --send" }));
  assert.ok("error" in commandFor(A("void"), { id: "12", reason: "--send" }));
  assert.ok("error" in commandFor(A("void"), { id: "-1", reason: "" }));
  assert.ok("error" in commandFor(A("desk-fee"), { percent: "11" }));
  assert.ok("error" in commandFor(A("set-operator"), { address: "1abc --send" }));
  assert.ok("error" in commandFor(A("desk-withdraw"), { token: "koin", amount: "-5" }));
  assert.deepEqual(commandFor(A("desk-withdraw"), { token: "vhp", amount: "1.5" }), { argv: ["withdraw", "vhp", "1.5"] });
  for (const a of ACTIONS) for (const t of a.args) assert.ok(t !== "--send", `${a.id}: --send is added only by the server`);
});

// Owner, 2026-10-29: "every action … clearly identified what its for, game, purpose": every control is complete.
test("every control names its area, kind, purpose, signer and effect; areas are complete; ids are unique", () => {
  const ids = new Set<string>();
  for (const a of ACTIONS) {
    assert.ok(!ids.has(a.id), `${a.id}: duplicate id`); ids.add(a.id);
    assert.ok(AREAS.some((x) => x.id === a.area), `${a.id}: unknown area ${a.area}`);
    assert.ok(a.kind in KINDS, `${a.id}: unknown kind ${a.kind}`);
    for (const f of ["label", "what", "signer"] as const) assert.ok(String(a[f] ?? "").trim().length >= 3, `${a.id}: ${f} is empty`);
    assert.ok(["none", "chain", "files"].includes(a.effect), `${a.id}: effect`);
    if (a.effect === "none") assert.equal(a.sends, false, `${a.id}: read-only never sends`);
    if (a.effect === "chain") assert.ok(a.sends && a.timing, `${a.id}: a chain change sends and says when it takes effect`);
    if (a.effect === "chain") assert.ok(!/^Nobody/.test(a.signer), `${a.id}: a chain change names its signer`);
    assert.equal(a.args.includes("--testnet"), AREAS.find((x) => x.id === a.area)!.status === "testnet", `${a.id}: testnet actions live in testnet areas only`);
    for (const p of a.params ?? []) if (p.value !== undefined && !p.choices) assert.ok(p.pattern.test(p.value), `${a.id}: default ${p.value} fails its own check`);
  }
  for (const ar of AREAS) {
    assert.ok(ar.what.length > 10, `${ar.id}: what`);
    if (ar.status === "planned") assert.ok(ar.later, `${ar.id}: a planned area says what comes later`);
    else assert.ok(ACTIONS.some((a) => a.area === ar.id), `${ar.id}: a live area has controls`);
  }
});

function request(port: number, path: string, opts: { method?: string; host?: string; key?: string; origin?: string; body?: any } = {}) {
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    const data = opts.body ? JSON.stringify(opts.body) : undefined;
    const req = http.request({ host: "127.0.0.1", port, path, method: opts.method ?? "GET",
      headers: { host: opts.host ?? `127.0.0.1:${port}`, ...(opts.key ? { "x-admin-key": opts.key } : {}), ...(opts.origin ? { origin: opts.origin } : {}), ...(data ? { "content-type": "application/json" } : {}) } }, (res) => {
      let b = ""; res.on("data", (c) => (b += c)); res.on("end", () => { let j: any = b; try { j = JSON.parse(b); } catch {} resolve({ status: res.statusCode!, body: j }); });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

test("the server: this computer only, the session key, the page's own origin, preview before send", async () => {
  const port = 18000 + Math.floor(Math.random() * 1000);
  const child = spawn(process.execPath, ["--import", "tsx", "admin/server.ts"], { env: { ...process.env, ADMIN_PORT: String(port), ADMIN_NO_BROWSER: "1" } });
  let out = "";
  child.stdout.on("data", (b) => (out += b));
  try {
    for (let i = 0; i < 100 && !/#([0-9a-f]{48})/.test(out); i++) await new Promise((r) => setTimeout(r, 100));
    const key = out.match(/#([0-9a-f]{48})/)![1];
    assert.match(out, new RegExp(`http://127\\.0\\.0\\.1:${port}/#`));
    assert.equal((await request(port, "/", {})).status, 200);
    assert.equal((await request(port, "/api/actions", { host: "evil.example" })).status, 403, "DNS rebinding: wrong Host");
    assert.equal((await request(port, "/api/actions", {})).status, 401, "no key");
    assert.equal((await request(port, "/api/actions", { key: "0".repeat(48) })).status, 401, "wrong key");
    assert.equal((await request(port, "/api/actions", { key: "\u00e9".repeat(48) })).status, 401, "a non-ASCII key is refused (audit L-10)");
    assert.equal((await request(port, "/api/actions", { key })).status, 200, "and the server is still up");
    assert.equal((await request(port, "/api/actions", { key, origin: "https://evil.example" })).status, 403, "another website");
    const list = await request(port, "/api/actions", { key });
    assert.equal(list.status, 200);
    assert.ok(Array.isArray(list.body.actions) && list.body.actions.length >= 30);
    assert.ok(Array.isArray(list.body.areas) && list.body.kinds.check);
    assert.ok(list.body.actions.every((a: any) => !("pattern" in a) && a.command.startsWith("npm run ")));
    const send = await request(port, "/api/run", { method: "POST", key, body: { action: "pause", values: { state: "on" }, send: true } });
    assert.equal(send.status, 409, "a send without a preview is refused");
    assert.match(send.body.error, /preview it first/);
    const ro = await request(port, "/api/run", { method: "POST", key, body: { action: "chain-check", values: {}, send: true } });
    assert.equal(ro.status, 400, "a read-only action can never send");
    const bad = await request(port, "/api/run", { method: "POST", key, body: { action: "void", values: { id: "1", reason: "--send" } } });
    assert.equal(bad.status, 400);
  } finally { child.kill(); }
});

// ── Block Golf (the Golf chat's spec, claude/golf/TO-HUB-ADMIN-GOLF.md) ──
import fs from "node:fs";
test("Block Golf: live, its controls in order with game 6 fixed, status read-only, the GitHub switches as a guided card", () => {
  const area = AREAS.find((x) => x.id === "golf")!;
  assert.equal(area.status, "live"); assert.equal(area.gameId, 6); assert.equal(area.docs, "docs/GOLF.md");
  assert.match(area.contract!, /No contract.*golf\.yml.*games-data\/golf/);
  const golf = ACTIONS.filter((a) => a.area === "golf").map((a) => a.id);
  assert.deepEqual(golf, ["golf-status", "golf-games", "golf-prize-off", "golf-game-add", "golf-game-apply", "golf-game-stop", "golf-game-correct", "golf-game-void"]);
  const st = A("golf-status");
  assert.equal(st.sends, false); assert.equal(st.effect, "none"); assert.equal(st.tool, "golf"); assert.deepEqual(st.args, ["status"]);
  assert.deepEqual(A("golf-prize-off").args, ["off", "6"]); assert.equal(A("golf-prize-off").step, 1);
  assert.deepEqual(A("golf-game-add").args, ["game-add", "6", "Block Golf", "--staked", "--free", "--season", "1"]); assert.equal(A("golf-game-add").step, 2);
  assert.deepEqual(A("golf-game-apply").args, ["game-apply", "6"]); assert.equal(A("golf-game-apply").step, 3);
  assert.deepEqual(A("golf-games").args, ["games"]); assert.equal(A("golf-games").sends, false);
  for (const id of golf) {
    const a = A(id);
    assert.ok(!(a.params ?? []).some((p) => p.name === "game"), `${id}: game 6 is fixed, not a box`);
    const r = commandFor(a, { week: "3", player: "1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr", points: "0" });
    assert.ok("argv" in r, `${id}: ${JSON.stringify(r)}`);
    if (a.args.some((x) => /^game-|^off$/.test(x))) assert.equal((r as any).argv[1], "6", `${id} acts on game 6`);
  }
  assert.match(A("golf-prize-off").when!, /same week as step 2, or earlier/);
  // The switches can't be set from the page: a guided card with a button to GitHub's variables page.
  const g = area.guides!;
  assert.equal(g.length, 1); assert.equal(g[0].steps.length, 4);
  assert.equal(g[0].link.url, "https://github.com/bawcejawn/KnodeGames/settings/variables/actions");
  for (const [i, v] of [[0, /GOLF_ENABLED = true/], [1, /GOLF_STAKED_FROM_WEEK.*Monday 00:57 UTC.*Never change it/], [2, /GOLF_HOLD_WEEKS.*Thursday 00:00 UTC/], [3, /GOLF_ENABLED to false/]] as const) assert.match(g[0].steps[i], v);
  const server = fs.readFileSync("admin/server.ts", "utf8");
  assert.match(server, /tool === "golf" \? "bot\/games\/golf\.ts"/);
});
test("guided cards: text only, and the button opens only this repository's GitHub pages", () => {
  const page = fs.readFileSync("admin/index.html", "utf8");
  const re = new RegExp(page.match(/const GUIDE_URL = \/(.+)\/;/)![1]);
  assert.ok(re.test("https://github.com/bawcejawn/KnodeGames/settings/variables/actions"));
  for (const bad of ["https://evil.example/", "https://github.com/someone/else", "javascript:alert(1)", "https://github.com/bawcejawn/KnodeGames.evil.com/x", "https://github.com/bawcejawn/KnodeGames/x?y=\"z"]) assert.ok(!re.test(bad), bad);
  assert.match(page, /ok \? el\("a", \{ class: "btn guide-link", href: g\.link\.url, target: "_blank", rel: "noopener noreferrer" \}/);
  for (const a of AREAS) for (const gd of a.guides ?? []) assert.ok(re.test(gd.link.url), `${a.id}: ${gd.link.url}`);
});
