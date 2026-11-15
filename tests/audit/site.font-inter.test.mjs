// Owner, 14 Nov 2026: one easy-to-read font everywhere: Inter (was Atkinson Hyperlegible, Bricolage Grotesque, Archivo).
// Run: node --test tests/audit/site.font-inter.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const APP = fileURLToPath(new URL("../..", import.meta.url));
const read = (f) => fs.readFileSync(path.join(APP, f), "utf8");
const pages = fs.readdirSync(APP).filter((f) => f.endsWith(".html"));
const INTER = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap";

test("every page that uses the site styles loads Inter, and nothing names the old fonts", () => {
  for (const f of pages) {
    const h = read(f);
    if (h.includes('href="styles.css"')) assert.ok(h.includes(INTER), `${f}: Inter link`);
    assert.doesNotMatch(h, /Atkinson|Bricolage|Archivo/, f);
  }
  for (const f of ["styles.css", "fantasy.css", "extras.js"]) assert.doesNotMatch(read(f), /Atkinson|Bricolage|Archivo/, f);
});

test("the three font settings are Inter first", () => {
  const css = read("styles.css");
  for (const v of ["--display", "--body", "--num"]) assert.match(css, new RegExp(`${v}: "Inter", `), v);
});
