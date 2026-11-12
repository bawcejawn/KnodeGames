// Writes the kit games' jobs into their workflows (Shared Game Kit, D-158): every games/<slug>/game.json whose recorder
// is a kit GameModule, grouped by workflow file and data branch. The publish job embeds kit/publish/check.inline.mjs
// byte for byte (it runs no repository code). Run after any change to kit/publish/ or a kit game's manifest:
//   npm run kit:render            write the workflows
//   npm run kit:render -- --check exit 1 if a committed workflow differs (the test kit/tests/render.test.ts does the same)
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT, listManifests, readManifest, validateManifest, duplicateKeys } from "./game-manifest.mjs";
import { renderJobs, inlineScript, rulerPy, BEGIN, END, LEGACY_WAIT_MAX_MIN } from "../kit/publish/render.mjs";
import { publishConfig, dataFolder, readDeployment } from "../kit/recorder/manifest.ts";

/** The kit games, by workflow file: [{ file, branch, games }]. */
export function kitGames(root = ROOT) {
  const dep = readDeployment(root);
  const by = new Map();
  for (const file of listManifests(root)) {
    const rec = path.join(path.dirname(file), "recorder.ts");
    if (!fs.existsSync(rec) || !/GameModule/.test(fs.readFileSync(rec, "utf8"))) continue;
    // A kit game is validated in kit mode before anything of it is rendered (KC-14, KC-25, KC-26).
    const dup = duplicateKeys(fs.readFileSync(file, "utf8"));
    if (dup.length) throw new Error(`${path.relative(root, file)} repeats a key: ${dup.join(", ")}`);
    const m = readManifest(file);
    const probs = validateManifest(m, { kit: true });
    if (probs.length) throw new Error(`${path.relative(root, file)}: ${probs.join("; ")}`);
    const { branch } = dataFolder(m);
    const key = `${m.workflow.file}|${branch}`;
    if (!by.has(key)) by.set(key, { file: m.workflow.file, branch, games: [] });
    by.get(key).games.push({ slug: m.slug, name: m.name, enabledVar: m.workflow.enabledVar, cfg: publishConfig(m, dep), published: m.published ?? [] });
  }
  for (const v of by.values()) {
    v.games.sort((a, b) => (a.slug < b.slug ? -1 : 1));
    // ctx.published reads other kit games on the same data branch only (one fetch per branch, read-only).
    for (const g of v.games) for (const o of g.published) if (!v.games.some((x) => x.slug === o)) throw new Error(`${g.slug}: published lists "${o}", which isn't a kit game on ${v.branch}`);
  }
  // One kit block per workflow file: two data branches in one file would render two blocks, the second replacing the
  // first (#B-12 NK-16).
  const files = new Map();
  for (const v of by.values()) {
    if (files.has(v.file)) throw new Error(`${v.file}: kit games on two data branches (${files.get(v.file)}, ${v.branch}); one workflow file takes one branch`);
    files.set(v.file, v.branch);
  }
  return [...by.values()];
}

/** The hand-written jobs publish-kit waits for must exist and finish in time (NK-11, NK-16): a `publish` job, and the
 *  `record` and `publish` jobs' timeouts together at most LEGACY_WAIT_MAX_MIN. Outside the kit block only. */
export function checkHost(text, file) {
  const a = text.indexOf(BEGIN), b = text.indexOf(END);
  const host = a >= 0 && b > a ? text.slice(0, a) + text.slice(b + END.length) : text;
  const job = (name) => {
    const m = new RegExp(`^  ${name}:\\n((?:    .*\\n|\\s*\\n)*)`, "m").exec(host);
    if (!m) return null;
    const t = /^    timeout-minutes:\s*([0-9]+)\s*$/m.exec(m[1]);
    return t ? Number(t[1]) : Infinity;
  };
  const rec = job("record"), pub = job("publish");
  if (pub === null) throw new Error(`${file}: no publish job for the kit's publish job to wait on`);
  const wait = (rec ?? 0) + pub;
  if (wait > LEGACY_WAIT_MAX_MIN) throw new Error(`${file}: its record and publish jobs may take ${wait} min, more than the ${LEGACY_WAIT_MAX_MIN} the kit's publish check allows for (NK-11)`);
}

/** The workflow text with its kit block rendered (inserted at the end of the file the first time). */
export function renderWorkflow(text, block) {
  const a = text.indexOf(BEGIN), b = text.indexOf(END);
  if (a >= 0 && b > a) return text.slice(0, a) + block + text.slice(b + END.length + 1);
  if (a >= 0 || b >= 0) throw new Error("the kit block's markers are broken");
  return text.replace(/\n*$/, "\n\n") + block;
}

export function renderAll(root = ROOT) {
  const script = inlineScript(pathToFileURL(root.endsWith("/") ? root : root + "/"));
  return kitGames(root).map(({ file, branch, games }) => {
    const p = path.join(root, ".github/workflows", file);
    const now = fs.readFileSync(p, "utf8");
    checkHost(now, file);
    return { file: p, now, want: renderWorkflow(now, renderJobs({ branch, games, script, ruler: games.some((g) => g.cfg.vhpData) ? rulerPy(pathToFileURL(root.endsWith("/") ? root : root + "/")) : null })) };
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const check = process.argv.includes("--check");
  let bad = 0;
  for (const r of renderAll()) {
    if (r.now === r.want) { console.log(`✔ ${path.relative(ROOT, r.file)} is up to date`); continue; }
    if (check) { console.log(`✖ ${path.relative(ROOT, r.file)} differs from what the kit renders: run npm run kit:render`); bad++; }
    else { fs.writeFileSync(r.file, r.want); console.log(`wrote ${path.relative(ROOT, r.file)}`); }
  }
  process.exit(bad ? 1 : 0);
}
