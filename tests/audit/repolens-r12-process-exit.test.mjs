// Repo Lens RV-1 (round 12): a node that accepts a connection and never answers keeps a recorder alive after its work is
// done (withRetry stops waiting, but the request stays open), so that hour's files are never uploaded. Both recorders
// now exit when their work resolves.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const APP = process.env.APP || ".";

test("RV-1: race.ts (run and --sample) and blockx.ts exit as soon as their work resolves", () => {
  for (const f of ["bot/race.ts", "bot/games/blockx.ts"]) {
    const src = fs.readFileSync(path.resolve(APP, f), "utf8");
    const entry = src.slice(src.lastIndexOf("if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)"));
    assert.match(entry, /\)\.then\(\(\) => process\.exit\(process\.exitCode \?\? 0\), \(e\) => \{/, `${f}: exits on success too`);
  }
});

test("RV-1: the mechanism, with the repository's own withRetry against a node that never answers", async () => {
  const hung = net.createServer(() => { /* accept, never answer */ });
  await new Promise((r) => hung.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${hung.address().port}/`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rv1-"));
  const common = path.resolve(APP, "common.ts");
  const script = (exit) => `
    import { withRetry } from ${JSON.stringify(common)};
    const work = async () => { try { await withRetry("read", () => fetch(${JSON.stringify(url)}), 1, 300); } catch { /* gave up: the run goes on */ } };
    work()${exit ? ".then(() => process.exit(process.exitCode ?? 0), () => process.exit(1))" : ""};`;
  const runFor = (exit) => new Promise((resolve) => {
    const f = path.join(dir, `${exit ? "with" : "without"}.mts`); fs.writeFileSync(f, script(exit));
    const c = spawn(process.execPath, ["--import", "tsx", f], { cwd: APP, stdio: "ignore" });
    const kill = setTimeout(() => { c.kill(); resolve("still alive"); }, 8000);
    c.on("exit", () => { clearTimeout(kill); resolve("exited"); });
  });
  try {
    assert.equal(await runFor(false), "still alive", "without the exit, the open request keeps the process alive");
    assert.equal(await runFor(true), "exited", "with it, the process ends when the work is done");
  } finally { hung.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});
