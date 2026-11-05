// The conformance suite (GAME_KIT.md §5) passes the kit-example fixture end to end, and catches a module that reads
// the clock, randomness, the network or the environment, or that guesses a result it hasn't seen.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { conformance, staticChecks, trapped } from "../testing/conformance.ts";
import { EXAMPLE_ROOT } from "../testing/example/index.ts";

test("conformance: the kit-example fixture passes every check, end to end through the publish check", async () => {
  const res = await conformance("kit-example", EXAMPLE_ROOT);
  const bad = res.filter((r) => !r.pass).map((r) => r.msg);
  assert.deepEqual(bad, []);
  assert.ok(res.some((r) => /goes final/.test(r.msg)) && res.some((r) => /PENDING/.test(r.msg)));
});

test("conformance: forbidden sources are caught statically", () => {
  for (const src of [
    `import fs from "node:fs";`, `import { Provider } from "koilib";`, `const x = process.env.RPC;`, `const t = Date.now();`,
    `const t = new Date();`, `Math.random()`, `await fetch("https://x")`, `fs.writeFileSync("a", "b")`, `tx.sign(key)`,
  ]) assert.ok(staticChecks(src).some((c) => !c.pass), src);
  assert.ok(staticChecks(`const d = dayOf(round.locksAt);`).every((c) => c.pass));
});

test("conformance: the clock, randomness, network and environment are trapped at run time, and restored", async () => {
  await assert.rejects(trapped(() => Date.now()), /Date\.now/);
  await assert.rejects(trapped(() => Math.random()), /Math\.random/);
  await assert.rejects(trapped(() => (globalThis as any).fetch("x")), /fetch/);
  await assert.rejects(trapped(() => process.env.RPC), /process\.env\.RPC/);
  assert.ok(Date.now() > 0 && Math.random() >= 0 && typeof process.env === "object");
});

test("conformance: a module that guesses an undecided result fails", async () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "kit-conf-"));
  fs.cpSync(path.join(EXAMPLE_ROOT, "games"), path.join(d, "games"), { recursive: true });
  const rec = path.join(d, "games/kit-example/recorder.ts");
  // Make paths absolute (the copy lives outside the repo) and make resultOf guess "option 1" when undecided.
  const kitDir = path.resolve(EXAMPLE_ROOT, "../..");
  let src = fs.readFileSync(rec, "utf8").replace(/"\.\.\/\.\.\/\.\.\/\.\.\//g, `"${kitDir}/`);
  src = src.replace("if (!q || q[1] === 0) return PENDING;", "if (!q) return PENDING; if (q[1] === 0) return 1;");
  fs.writeFileSync(rec, src);
  const sample = path.join(d, "games/kit-example/tests/sample.ts");
  fs.writeFileSync(sample, fs.readFileSync(sample, "utf8").replace(/"(\.\.\/)+/g, (m) => `"${path.resolve(EXAMPLE_ROOT, "games/kit-example/tests", m.slice(1))}/`));
  const res = await conformance("kit-example", d);
  assert.ok(res.some((r) => !r.pass && /PENDING/.test(r.msg)), res.filter((r) => !r.pass).map((r) => r.msg).join("; "));
});
