// tools/capacity-harness/filesize.mjs: the file sizer used for "before / after" of any game file format.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

test("FS-1 bytes a player and players that fit, from a sample file; nothing written", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kgfs-"));
  const f = path.join(dir, "W.json");
  const sample = { week: 4, cards: "x".repeat(10_000), races: [{ picks: [["1KoinosNodeA9xQ2sPp3rX7mW1vD4k8Lz", "1MbsVfNw6yzQqA8499d8KQj8qdLyRs8CzW", 1]] }, { picks: [] }] };
  fs.writeFileSync(f, JSON.stringify(sample));
  const before = fs.readdirSync(dir);
  const out = execFileSync(process.execPath, ["tools/capacity-harness/filesize.mjs", "--file", f, "--rows", "races[*].picks", "--each", "2", "--sizes", "1000"], { encoding: "utf8" });
  assert.match(out, /fixed part 10 KB/);
  const per = Number(out.match(/(\d+) bytes a player/)[1]);
  assert.ok(per > 150 && per < 200, `per player ${per}`);   // two rows of ~90 bytes
  const fit = Number(out.match(/fits under 2 MB: about ([\d,]+)/)[1].replace(/,/g, ""));
  assert.ok(Math.abs(fit - Math.floor((2 * 1024 * 1024 - 10_000) / per)) < 200, `fit ${fit}`);
  assert.deepEqual(fs.readdirSync(dir), before);
});

test("FS-2 a path with no rows is refused with a clear message", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kgfs-"));
  const f = path.join(dir, "W.json");
  fs.writeFileSync(f, JSON.stringify({ races: [] }));
  assert.throws(() => execFileSync(process.execPath, ["tools/capacity-harness/filesize.mjs", "--file", f, "--rows", "races[*].picks"], { encoding: "utf8", stdio: "pipe" }), /no rows found/);
});
