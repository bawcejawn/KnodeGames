// Writes Daily Questions' parts check into the publish job of .github/workflows/games.yml (the job runs no repository
// code): kit/parts/parts.inline.mjs and games/questions/parts.inline.mjs, byte for byte, as base64 data: modules, then
// one line that runs the check. Run after any change to either file:
//   node tools/questions-parts-embed.mjs            write the block
//   node tools/questions-parts-embed.mjs --check    exit 1 if the committed block differs (games/questions/tests/parts.test.ts too)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const BEGIN = "          # ── BEGIN questions-parts (tools/questions-parts-embed.mjs; edit games/questions/parts.inline.mjs or kit/parts, never these lines) ──";
export const END = "          # ── END questions-parts ──";
// Every module specifier in the file (`from "x"` in any import or export, a bare `import "x"`, split over lines or
// not) must be node:fs, node:path or node:crypto (Repo Lens #H-2, I-1).
const SPECIFIERS = /(?:\bfrom\s*|\bimport\s*)["']([^"']+)["']/g;
const allowedOnly = (src) => [...src.matchAll(SPECIFIERS)].every((m) => /^node:(fs|path|crypto)$/.test(m[1]));

/** The block as it must stand in games.yml. */
export { allowedOnly };
export function block(root = ROOT) {
  const kit = fs.readFileSync(path.join(root, "kit/parts/parts.inline.mjs"), "utf8");
  const q = fs.readFileSync(path.join(root, "games/questions/parts.inline.mjs"), "utf8");
  for (const [n, src] of [["kit/parts/parts.inline.mjs", kit], ["games/questions/parts.inline.mjs", q]]) {
    if (!allowedOnly(src) || /\bimport\s*\(/.test(src) || /\brequire\s*\(/.test(src)) throw new Error(`${n} may import only node:fs, node:path and node:crypto`);
  }
  const b64 = (s) => Buffer.from(s, "utf8").toString("base64");
  return [
    BEGIN,
    `          node --input-type=module - "$IN/questions" "$PUB/questions" "$DEC" "$HELD" <<'QPARTS' || QPARTS_FAILED=1`,
    `          globalThis.__KITPARTS = await import("data:text/javascript;base64,${b64(kit)}");`,
    `          const Q = await import("data:text/javascript;base64,${b64(q)}");`,
    `          Q.main(process.argv.slice(2));`,
    `          QPARTS`,
    END,
  ].join("\n");
}

/** games.yml with the block written in place of the old one. */
export function render(text, root = ROOT) {
  const a = text.indexOf(BEGIN), b = text.indexOf(END);
  if (a < 0 || b < a || text.indexOf(BEGIN, a + 1) >= 0) throw new Error("games.yml: needs exactly one questions-parts block");
  return text.slice(0, a) + block(root) + text.slice(b + END.length);
}

if (import.meta.url === `file://${process.argv[1]}` || fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? "")) {
  const f = path.join(ROOT, ".github/workflows/games.yml");
  const text = fs.readFileSync(f, "utf8"), want = render(text);
  if (process.argv.includes("--check")) {
    if (want !== text) { console.error("games.yml: the questions-parts block is out of date: run node tools/questions-parts-embed.mjs"); process.exit(1); }
    console.log("questions-parts block up to date");
  } else if (want !== text) { fs.writeFileSync(f, want); console.log("games.yml: questions-parts block written"); }
  else console.log("questions-parts block up to date");
}
