// Writes the kit games' jobs into their workflows (Shared Game Kit, D-158): every games/<slug>/game.json whose recorder
// is a kit GameModule, grouped by workflow file and data branch. The publish job embeds kit/publish/check.inline.mjs
// byte for byte (it runs no repository code). Run after any change to kit/publish/ or a kit game's manifest:
//   npm run kit:render            write the workflows
//   npm run kit:render -- --check exit 1 if a committed workflow differs (the test kit/tests/render.test.ts does the same)
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT, listManifests, readManifest } from "./game-manifest.mjs";
import { renderJobs, inlineScript, BEGIN, END } from "../kit/publish/render.mjs";
import { publishConfig, dataFolder, readDeployment } from "../kit/recorder/manifest.ts";

/** The kit games, by workflow file: [{ file, branch, games }]. */
export function kitGames(root = ROOT) {
  const dep = readDeployment(root);
  const by = new Map();
  for (const file of listManifests(root)) {
    const m = readManifest(file);
    const rec = path.join(path.dirname(file), "recorder.ts");
    if (!fs.existsSync(rec) || !/GameModule/.test(fs.readFileSync(rec, "utf8"))) continue;
    const { branch } = dataFolder(m);
    const key = `${m.workflow.file}|${branch}`;
    if (!by.has(key)) by.set(key, { file: m.workflow.file, branch, games: [] });
    by.get(key).games.push({ slug: m.slug, name: m.name, enabledVar: m.workflow.enabledVar, cfg: publishConfig(m, dep) });
  }
  for (const v of by.values()) v.games.sort((a, b) => (a.slug < b.slug ? -1 : 1));
  return [...by.values()];
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
    return { file: p, now, want: renderWorkflow(now, renderJobs({ branch, games, script })) };
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
