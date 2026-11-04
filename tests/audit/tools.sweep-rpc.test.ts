// tools/sweep-old-bot.ts (I-078): the node comes from $env:RPC, then RPC= in .env, then Armana; never api.koinos.io by default.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("sweep-old-bot: honours $env:RPC and defaults to Armana", () => {
  const src = fs.readFileSync(new URL("../../tools/sweep-old-bot.ts", import.meta.url), "utf8");
  assert.match(src, /const rpc = process\.env\.RPC \|\| env\.RPC \|\| "https:\/\/koinos\.armana\.io";/);
  assert.doesNotMatch(src, /\|\| "https:\/\/api\.koinos\.io"/);
});
