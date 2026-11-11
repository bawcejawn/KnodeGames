// Owner, 10 Nov: the bot names weeks by the vault's own number (the one in deployment.json, the contract and the
// question files: W003 = vault week 3). It used to print one higher ("Week 4" for vault week 3).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { vaultWeek } from "../../bot/bot.ts";

test("vaultWeek: the vault's own number, and a test week says so", () => {
  assert.equal(vaultWeek(3, { vaultTestWeeks: [3] }), "vault week 3 (test week)");
  assert.equal(vaultWeek(4, { vaultTestWeeks: [3] }), "vault week 4");
  assert.equal(vaultWeek(2, null), "vault week 2");
  assert.equal(vaultWeek(3, { vaultTestWeeks: "bad" }), "vault week 3", "a bad setting never breaks the status line");
});

test("no status line prints a week one higher any more", () => {
  const src = fs.readFileSync("bot/bot.ts", "utf8");
  for (const bad of [/`Week \$\{w \+ 1\}/, /60 from Week \$\{rule\}/, /`  week \$\{k \+ 1\}:/, /\(week \$\{w \+ 1\}, day/, /from week \$\{num\(settings\.min_stake_next_week\)\) \+ 1\}/, /from week \$\{s\.fromWeek \+ 1\}/])
    assert.doesNotMatch(src, bad);
});
