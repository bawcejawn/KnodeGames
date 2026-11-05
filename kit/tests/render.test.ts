// The rendered workflow (tools/kit-render-workflows.mjs): the committed games.yml equals what the kit renders; its
// publish job embeds kit/publish/check.inline.mjs byte for byte and imports nothing else; the embedded copy RUNS and
// gives the same verdicts as the kit's file; the hand-written Block X jobs are untouched; the shell parses.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { renderAll, kitGames } from "../../tools/kit-render-workflows.mjs";
import { inlineScript, BEGIN, END, HEREDOC, TRAILER } from "../publish/render.mjs";
import { weekHash, canon, boardOf, tally } from "../publish/check.inline.mjs";
import { exampleCfg, EXAMPLE_ROOT } from "../testing/example/index.ts";
import { at, HOUR } from "../testing/fake-clock.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("render: every committed kit workflow is exactly what the kit renders (run npm run kit:render)", () => {
  for (const r of renderAll(ROOT)) assert.equal(r.now, r.want, `${r.file} differs from the kit's render`);
});

test("render: kit-core ships no kit game, so games.yml is main's, unchanged (D-160)", () => {
  assert.deepEqual(kitGames(ROOT), []);
  const main = spawnSync("git", ["show", "origin/main:.github/workflows/games.yml"], { cwd: ROOT, encoding: "utf8" });
  if (main.status === 0) assert.equal(fs.readFileSync(path.join(ROOT, ".github/workflows/games.yml"), "utf8"), main.stdout);
});

/** A repo-shaped temp root: today's games.yml and deployment.json, with the kit-example fixture as its one kit game. */
const FIX = (() => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "kit-render-root-"));
  fs.mkdirSync(path.join(d, ".github/workflows"), { recursive: true });
  fs.copyFileSync(path.join(ROOT, ".github/workflows/games.yml"), path.join(d, ".github/workflows/games.yml"));
  fs.cpSync(path.join(ROOT, "kit"), path.join(d, "kit"), { recursive: true });
  fs.mkdirSync(path.join(d, "game-data")); fs.copyFileSync(path.join(ROOT, "game-data/deployment.json"), path.join(d, "game-data/deployment.json"));
  fs.cpSync(path.join(EXAMPLE_ROOT, "games"), path.join(d, "games"), { recursive: true });
  const [r] = renderAll(d);
  fs.writeFileSync(r.file, r.want);
  return { root: d, yml: r.want, again: renderAll(d)[0] };
})();
const yml = FIX.yml;

test("render: rendering twice changes nothing (the block sits between its markers)", () => {
  assert.equal(FIX.again.now, FIX.again.want);
});

/** The embedded script, de-indented, as the shell feeds it to node. */
function embedded(): string {
  const lines = yml.split("\n");
  const a = lines.findIndex((l) => l.includes(`<<'${HEREDOC}'`));
  const b = lines.findIndex((l, i) => i > a && l.trim() === HEREDOC);
  assert.ok(a > 0 && b > a, "the heredoc is there");
  return lines.slice(a + 1, b).map((l) => l.replace(/^ {10}/, "")).join("\n") + "\n";
}

test("render: the publish job runs check.inline.mjs byte for byte, which imports only node:fs/path/crypto", () => {
  const src = fs.readFileSync(path.join(ROOT, "kit/publish/check.inline.mjs"), "utf8");
  assert.equal(embedded(), src + TRAILER);
  assert.equal(inlineScript(pathToFileURL(ROOT + "/")), src + TRAILER);
  const imports = [...src.matchAll(/^\s*import\s.*from\s+["']([^"']+)["']/gm)].map((m) => m[1]).sort();
  assert.deepEqual(imports, ["node:crypto", "node:fs", "node:path"]);
  assert.ok(!src.includes("${{"), "no Actions expression inside the script");
});

test("render: the embedded copy runs and publishes an honest pending week (as the workflow would run it)", () => {
  const cfg = exampleCfg();
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "kit-render-")), inn = path.join(d, "in"), pub = path.join(d, "pub"), list = path.join(d, "list");
  fs.mkdirSync(path.join(inn, "kit-example"), { recursive: true }); fs.mkdirSync(pub);
  const A = "1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  const now = at(5, 0, 2);
  const j: any = { v: 1, game: 250, week: 4, start: at(4), end: at(5), min: "100000000", state: "pending", seen: { hash: "", at: now }, rounds: [["q00000001", at(4), 0, "s", [[A, 1, 0]]], ["q00000002", at(4, 1), 0, "s", [[A, 1, 0]]]], players: [[A, "200000000", "200000000", 0]] };
  j.seen.hash = weekHash(j);
  fs.writeFileSync(path.join(inn, "kit-example/W004.json"), canon(j));
  fs.writeFileSync(path.join(inn, "kit-example/board.json"), canon(boardOf(j, tally(j, cfg), new Date(now).toISOString())));
  const env = { ...process.env, KIT_GAMES: yml.match(/KIT_GAMES: '(.*)'/)![1], CHECK_NOW_MS: String(now + 5 * 60000) };
  const r = spawnSync("node", ["--input-type=module", "-", inn, pub, list], { input: embedded(), encoding: "utf8", env, cwd: d });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.deepEqual(fs.readFileSync(list, "utf8").trim().split("\n").sort(), ["kit-example/W004.json", "kit-example/board.json"]);
  assert.ok(!fs.existsSync(list + ".alert"));
  void HOUR;
});

test("render: the hand-written Block X jobs are untouched, and the kit jobs sit between the markers", () => {
  const main = spawnSync("git", ["show", "origin/main:.github/workflows/games.yml"], { cwd: ROOT, encoding: "utf8" });
  if (main.status === 0) {
    const before = main.stdout.replace(/\n*$/, "\n");
    assert.ok(yml.startsWith(before), "everything before the kit block is main's games.yml unchanged");
  }
  assert.ok(yml.indexOf(BEGIN) > 0 && yml.indexOf(END) > yml.indexOf(BEGIN));
  assert.match(yml, /record-kit:[\s\S]*if: \$\{\{ \(vars\.KIT_EXAMPLE_ENABLED == 'true'\) && github\.ref == 'refs\/heads\/main' \}\}/);
  assert.match(yml, /- name: Record Kit Example \(test fixture\) \(kit\)\n\s+id: kit-example\n\s+if: \$\{\{ vars\.KIT_EXAMPLE_ENABLED == 'true' \}\}\n\s+continue-on-error: true/);
  // The publish job holds the write token: no checkout, no npm, no tsx, no repository file run.
  const pubJob = yml.slice(yml.indexOf("  publish-kit:"), yml.indexOf(END));
  for (const bad of [/actions\/checkout/, /\bnpm\b/, /\btsx\b/, /^\s+node\s+(?!--input-type=module - )/m, /\.\/kit\/|kit\/recorder/]) assert.doesNotMatch(pubJob, bad);
});

test("render: the run blocks are valid bash", () => {
  const lines = yml.slice(yml.indexOf(BEGIN)).split("\n");
  const blocks: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s+)run: \|$/.exec(lines[i]);
    if (!m) continue;
    const ind = m[1].length + 2, body: string[] = [];
    for (i++; i < lines.length && (lines[i].trim() === "" || lines[i].startsWith(" ".repeat(ind))); i++) body.push(lines[i].slice(ind));
    i--;
    blocks.push(body.join("\n").replace(/\$\{\{[^}]*\}\}/g, "X"));
  }
  assert.ok(blocks.length >= 4);
  for (const b of blocks) { const r = spawnSync("bash", ["-n"], { input: b, encoding: "utf8" }); assert.equal(r.status, 0, r.stderr + "\n" + b.slice(0, 300)); }
});
