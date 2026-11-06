// The rendered workflow (tools/kit-render-workflows.mjs): the committed games.yml equals what the kit renders; its
// publish job embeds kit/publish/check.inline.mjs byte for byte and imports nothing else; the embedded copy RUNS and
// gives the same verdicts as the kit's file; the hand-written Block X jobs are untouched; the shell parses.
import test from "node:test";
const NO_BASH = process.platform === "win32" ? "runs bash (the CI runner is Linux)" : false;
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { renderAll, kitGames } from "../../tools/kit-render-workflows.mjs";
import YAML from "yaml";
import { inlineScript, renderJobs, BEGIN, END, HEREDOC, TRAILER, RECORD_TIMEOUT_MIN, SETUP_MIN, LEGACY_WAIT_MAX_MIN } from "../publish/render.mjs";
import { canon, boardOf, tally, FRESH_MS, MAX_BEHIND_MS } from "../publish/check.inline.mjs";
import { validateManifest, BUDGET_MAX } from "../../tools/game-manifest.mjs";
import { dataFolder } from "../recorder/manifest.ts";
import { makeWeek } from "../testing/weekfile.ts";
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
  const j = makeWeek({ game: 250, week: 4, start: at(4), end: at(5), state: "pending", seenAt: now, rounds: [["q00000001", at(4), 0, "s", [[A, 1, at(4) + 1]]], ["q00000002", at(4, 1), 0, "s", [[A, 1, at(4, 1) + 1]]]], players: [[A, "200000000", "200000000", 0]] });
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
});

/** Two kit games on one branch, rendered and PARSED as YAML (duplicate keys refused) (KC-4, KC-13, KC-14, KC-24). */
const TWO = (() => {
  const cfg = exampleCfg();
  const block = renderJobs({ branch: "games-data", script: "export function main() {}\n", games: [
    { slug: "kit-example", name: "Kit Example", enabledVar: "KIT_EXAMPLE_ENABLED", cfg },
    { slug: "kit-other", name: "Kit Other (2)", enabledVar: "KIT_OTHER_ENABLED", cfg: { ...cfg, slug: "kit-other", game: 251 } }] });
  return YAML.parse(`jobs:\n  publish:\n    runs-on: ubuntu-latest\n    steps: [{ run: "true" }]\n${block}`, { uniqueKeys: true }).jobs;
})();

test("render: one record job per kit game, each with its own timeout, artifact and variable (KC-4, KC-13)", () => {
  assert.deepEqual(Object.keys(TWO).sort(), ["kit-alerts", "publish", "publish-kit", "record-kit-example", "record-kit-other"]);
  for (const [slug, v] of [["kit-example", "KIT_EXAMPLE"], ["kit-other", "KIT_OTHER"]]) {
    const j = TWO[`record-${slug}`];
    assert.equal(j["timeout-minutes"], RECORD_TIMEOUT_MIN);
    assert.equal(j.if, `\${{ vars.${v}_ENABLED == 'true' && github.ref == 'refs/heads/main' }}`);
    assert.deepEqual(j.permissions, { contents: "read" });
    const upl = j.steps.find((s: any) => String(s.uses).startsWith("actions/upload-artifact@"));
    assert.equal(upl.with.name, `kit-games-data-${slug}`, "its own artifact");
    const rec = j.steps.find((s: any) => s.id === "rec");
    assert.match(rec.run, new RegExp(`rc=0; npm run kit -- ${slug} \\|\\| rc=\\$\\?`), "the exit code is captured, never fatal under bash -e (NK-1)");
    assert.equal(upl.if, "${{ steps.rec.outputs.rc == '0' || steps.rec.outputs.rc == '1' }}", "a run that wrote files (0 or 1) uploads them");
    assert.equal(rec.env[`${v}_RELEASE`], `\${{ vars.${v}_RELEASE }}`);
  }
  // A game's budget fits its job (NK-15): budgets.ms (≤ 20 min), a last read's retries (6 tries: ~4.1 min) and setup.
  assert.ok(BUDGET_MAX.ms / 60000 + 4.1 + SETUP_MIN <= RECORD_TIMEOUT_MIN);
  // …and the publish check's freshness window covers the chain lag plus every job publish-kit waits for (NK-11).
  assert.ok(RECORD_TIMEOUT_MIN <= LEGACY_WAIT_MAX_MIN && FRESH_MS >= MAX_BEHIND_MS + (LEGACY_WAIT_MAX_MIN + 5) * 60000);
});

test("render: the publish job takes each game's files only from that game's artifact, and reads the owner's releases itself (KC-3, KC-13, KC-29)", () => {
  const p = TWO["publish-kit"];
  assert.deepEqual(p.needs, ["record-kit-example", "record-kit-other", "publish"]);
  assert.match(p.if, /needs\.record-kit-example\.result == 'success' \|\| needs\.record-kit-other\.result == 'success'/, "runs when any one game recorded");
  assert.deepEqual(p.permissions, { contents: "write" });
  const dl = p.steps.filter((s: any) => String(s.uses).startsWith("actions/download-artifact@"));
  assert.deepEqual(dl.map((s: any) => [s.with.name, s.with.path]), [["kit-games-data-kit-example", "${{ runner.temp }}/incoming/kit-example"], ["kit-games-data-kit-other", "${{ runner.temp }}/incoming/kit-other"]]);
  const chk = p.steps.find((s: any) => /Check and push/.test(s.name));
  assert.equal(chk.env.CHECK_NOW_MS, "");
  assert.equal(chk.env.KIT_RELEASE_KIT_EXAMPLE, "${{ vars.KIT_EXAMPLE_RELEASE }}");
  assert.equal(chk.env.KIT_RELEASE_KIT_OTHER, "${{ vars.KIT_OTHER_RELEASE }}");
  // Only pinned actions; no checkout, npm, tsx or repository file in the job that holds the write token.
  for (const s of p.steps) if (s.uses) assert.match(s.uses, /^actions\/(download-artifact|setup-node)@[0-9a-f]{40}$/);
  const runs = p.steps.map((s: any) => s.run ?? "").join("\n");
  for (const bad of [/actions\/checkout/, /\bnpm\b/, /\btsx\b/, /^\s*node\s+(?!--input-type=module - )/m, /kit\/recorder/]) assert.doesNotMatch(runs, bad);
  // The alerts are their own always-run job, so they fire even when publish-kit is skipped (NK-16), and say different
  // things (KC-28).
  const a = TWO["kit-alerts"];
  assert.deepEqual(a.needs, ["record-kit-example", "record-kit-other", "publish-kit"]);
  assert.match(a.if, /^\$\{\{ always\(\) && /);
  assert.ok(a.steps.some((s: any) => /stopped/.test(s.name)) && a.steps.some((s: any) => /needs the owner/.test(s.name)));
});

test("render: a name, slug, variable or branch that isn't plain is refused (KC-14, KC-23); the manifest refuses it too", () => {
  const cfg = exampleCfg();
  const g = { slug: "kit-example", name: "Kit Example", enabledVar: "KIT_EXAMPLE_ENABLED", cfg };
  for (const bad of [{ name: "Evil\n      - name: injected\n        run: echo INJECTED" }, { name: "a: b" }, { name: "x${{ secrets.T }}" }, { slug: "Evil slug" }, { enabledVar: "X' || true" }])
    assert.throws(() => renderJobs({ branch: "games-data", script: "", games: [{ ...g, ...bad }] }), JSON.stringify(bad));
  assert.throws(() => renderJobs({ branch: "main", script: "", games: [g] }), /data branch/);
  const m = JSON.parse(fs.readFileSync(path.join(EXAMPLE_ROOT, "games/kit-example/game.json"), "utf8"));
  assert.ok(validateManifest({ ...m, name: "Evil\nname" }, { kit: true }).some((p: string) => /one plain line/.test(p)));
  assert.throws(() => dataFolder({ ...m, data: { board: "main:kit-example/board.json", vaultFolder: "main:kit-example/vault" } }), /data branch/);
});

test("render: the run blocks are valid bash", { skip: NO_BASH }, () => {
  const blocks: string[] = [];
  const all = [yml.slice(yml.indexOf(BEGIN)), ...Object.values(TWO).flatMap((j: any) => (j.steps ?? []).map((s: any) => s.run).filter(Boolean))];
  for (const text of all.slice(0, 1)) {
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const m = /^(\s+)run: \|$/.exec(lines[i]);
      if (!m) continue;
      const ind = m[1].length + 2, body: string[] = [];
      for (i++; i < lines.length && (lines[i].trim() === "" || lines[i].startsWith(" ".repeat(ind))); i++) body.push(lines[i].slice(ind));
      i--;
      blocks.push(body.join("\n"));
    }
  }
  blocks.push(...all.slice(1));
  assert.ok(blocks.length >= 8);
  for (const b of blocks) { const r = spawnSync("bash", ["-n"], { input: b.replace(/\$\{\{[^}]*\}\}/g, "X"), encoding: "utf8" }); assert.equal(r.status, 0, r.stderr + "\n" + b.slice(0, 300)); }
});
