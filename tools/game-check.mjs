// Check one game against the Game Standard (D-157, .ai/standards/NEW_GAME.md):
//   npm run game:check -- <slug>
// Read-only: it reads files in this repo and prints ✔ / ✖ lines. Exit code 1 if anything required fails.
import fs from "node:fs";
import path from "node:path";
import { ROOT, validateManifest, readManifest, listManifests, crossCheck } from "./game-manifest.mjs";

export const REQUIRED_FILES = ["game.json", "README.md", "SECURITY.md", "math.js", "recorder.ts", "tests"];

export function checkGame(slug, root = ROOT) {
  const res = [];
  const ok = (pass, msg, required = true) => res.push({ pass, msg, required });
  const dir = path.join(root, "games", slug);
  if (!fs.existsSync(dir)) { ok(false, `games/${slug}/ exists (create it with npm run game:new)`); return res; }
  for (const f of REQUIRED_FILES) ok(fs.existsSync(path.join(dir, f)), `games/${slug}/${f} exists`);
  let m = null;
  try { m = readManifest(path.join(dir, "game.json")); } catch (e) { ok(false, `game.json is valid JSON (${e.message})`); return res; }
  const probs = validateManifest(m);
  if (probs.length) for (const p of probs) ok(false, `game.json: ${p}`);
  else ok(true, "game.json follows the schema");
  const entries = listManifests(root).map((file) => ({ file, m: readManifest(file) }));
  for (const p of crossCheck(entries)) ok(false, p);
  if (m.rulesDoc) ok(fs.existsSync(path.join(root, m.rulesDoc)), `rules doc ${m.rulesDoc} exists`);
  const wc = fs.existsSync(path.join(root, ".ai/standards/WEEK_CYCLE.md")) ? fs.readFileSync(path.join(root, ".ai/standards/WEEK_CYCLE.md"), "utf8") : "";
  ok(wc.includes(m.name || "\u0000"), `WEEK_CYCLE.md §4 has a row for "${m.name}"`, m.status !== "building");
  const tests = path.join(dir, "tests");
  ok(fs.existsSync(tests) && fs.readdirSync(tests).some((f) => /\.test\.(mjs|ts)$/.test(f)), "tests/ has at least one test file");
  const live = m.status === "live" || m.status === "review";
  if (live) {
    let gj = null;
    try { gj = JSON.parse(fs.readFileSync(path.join(root, "games.json"), "utf8")); } catch {}
    const entry = gj && Array.isArray(gj.games) ? gj.games.find((g) => g.href && g.href.startsWith(m.page)) : null;
    ok(!!entry, `games.json lists ${m.page}`);
    ok(fs.existsSync(path.join(root, m.page)) || fs.existsSync(path.join(dir, m.page)), `page ${m.page} exists`);
  }
  return res;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const slug = process.argv[2];
  if (!slug) { console.error("Usage: npm run game:check -- <slug>"); process.exit(1); }
  const res = checkGame(slug);
  for (const r of res) console.log(`${r.pass ? "✔" : r.required ? "✖" : "•"} ${r.msg}`);
  const bad = res.filter((r) => !r.pass && r.required).length;
  console.log(bad ? `\n${bad} required check(s) failed.` : "\nAll required checks passed.");
  process.exit(bad ? 1 : 0);
}
