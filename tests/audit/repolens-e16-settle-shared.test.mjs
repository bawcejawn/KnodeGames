// Repo Lens #E-16 N-1: the bot's settle pass must skip the question game's shared-rules weeks (v6.1, D-116).
// Those weeks have no settle step: the vault refuses every settle for them, so sending one only spends the bot's Mana.
// Static check of bot/bot.ts (it never runs the bot). Fails at 5a10d93; passes once the skip is back.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const src = fs.readFileSync(path.join(root, "bot", "bot.ts"), "utf8");

function body(name) {
  const at = src.indexOf(`async function ${name}(`);
  assert.ok(at >= 0, `${name} not found in bot/bot.ts`);
  const open = src.indexOf("{", src.indexOf(")", at));
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return src.slice(open, i + 1);
  }
  throw new Error(`${name}: unbalanced braces`);
}

test("Repo Lens #E-16 N-1: settlePass skips shared-rules weeks before sending any settle", () => {
  const b = body("settlePass");
  const loop = b.indexOf("for (let w = st.weeksFinalized");
  assert.ok(loop >= 0, "settlePass's week loop not found");
  const firstSend = b.indexOf('method: "settle"', loop);
  assert.ok(firstSend > loop, "settlePass sends no settle");
  const skip = b.slice(loop, firstSend).search(/sharedRulesWeek\s*\(\s*st\.c\s*,\s*w\s*\)\s*\)\s*continue/);
  assert.ok(skip >= 0, "settlePass must `continue` past a week where sharedRulesWeek(st.c, w) is true, before its first settle (both the staked and the free-player settles are inside the loop)");
});

test("Repo Lens #E-16 N-1: sharedRulesWeek is still exported by bot/vault.ts and imported by bot/bot.ts", () => {
  const vault = fs.readFileSync(path.join(root, "bot", "vault.ts"), "utf8");
  assert.match(vault, /export function sharedRulesWeek\s*\(/);
  assert.match(src, /import\s*\{[^}]*\bsharedRulesWeek\b[^}]*\}\s*from\s*"\.\/vault\.ts"/);
});
