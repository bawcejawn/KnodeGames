// Repo Lens #G-2 (vault-bundle-2 @ c1afe015). Place in tests/audit/. Run: node --import tsx --test tests/audit/repolens-g2.test.mjs
// G2-2: the F9-1 rows' quoted phrases must appear in the bot's own code, so a reworded alert fails here instead of
//       silently losing its ALERTS.md row (the F9-1 test in alert-summary.test.mjs uses copied lines and can't see drift).
// G2-1: docs/UPGRADE-V61.md's D8-6 check must use the label `status` prints now ("vault week N").
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const code = ["bot/bot.ts", "bot/vault.ts"].map(read).join("\n");

test("G2-2: every quoted piece (16+ chars) of the F9-1 rows appears in the bot's code", () => {
  const starts = ["the question file no longer matches", "its VHP readings are not the list", "its VHP readings are an older list",
    "the question file was not generated", "The pool's last block is unknown", "already has N points on chain"];
  const rows = read(".ai/platform/ALERTS.md").split("\n").filter((l) => l.startsWith("|") && starts.some((s) => l.includes(s)));
  assert.ok(rows.length >= 4, `expected the F9-1 rows, found ${rows.length}`);
  let checked = 0;
  for (const row of rows) {
    const cell = row.split("|")[1];
    for (const q of cell.match(/"([^"]+)"/g) ?? []) {
      for (let piece of q.slice(1, -1).split("…")) {
        piece = piece.trim().replace(/\bN\b/g, "").trim();
        for (const part of piece.split(/\s{2,}/)) {
          if (part.length < 16) continue;
          checked++;
          assert.ok(code.includes(part), `ALERTS.md quotes "${part}", which is no longer in bot/bot.ts or bot/vault.ts`);
        }
      }
    }
  }
  assert.ok(checked >= 7, `checked only ${checked} phrases`);
});

test("G2-1: the v6.1 runbook's status check uses the new week label", () => {
  const doc = read("docs/UPGRADE-V61.md");
  assert.doesNotMatch(doc, /60 from Week 5 \(stored rule 5\)/, "status now prints '60 from vault week 4 (stored rule 5)'");
});
