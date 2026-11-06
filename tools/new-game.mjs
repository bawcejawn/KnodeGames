// Copy the game template into games/<slug>/ and fill in the first values (D-157, .ai/standards/NEW_GAME.md):
//   npm run game:new -- <slug> --id <vault game id> --name "<Display name>"
// It only creates files on this computer; it never touches the chain, GitHub or another game's files.
import fs from "node:fs";
import path from "node:path";
import { ROOT, RESERVED_IDS, listManifests, readManifest } from "./game-manifest.mjs";

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--id") out.id = Number(argv[++i]);
    else if (a === "--name") out.name = argv[++i];
    else out._.push(a);
  }
  return out;
}

export function newGame(slug, id, name, root = ROOT) {
  if (!/^[a-z][a-z0-9-]{1,23}$/.test(slug || "")) throw new Error("slug: lower-case letters, digits and dashes, 2–24 long");
  if (!Number.isInteger(id) || id < 1 || id > 255) throw new Error("--id: the vault game id, a whole number 1–255");
  if (!name || name.trim().length < 3) throw new Error("--name: the game's display name");
  if (RESERVED_IDS[id] && RESERVED_IDS[id] !== slug) throw new Error(`id ${id} belongs to "${RESERVED_IDS[id]}" (.ai/platform/PLATFORM.md)`);
  for (const f of listManifests(root)) {
    const m = readManifest(f);
    if (m.vaultGameId === id && m.slug !== slug) throw new Error(`id ${id} is used by games/${m.slug}`);
  }
  const dest = path.join(root, "games", slug);
  if (fs.existsSync(dest)) throw new Error(`games/${slug} already exists: nothing changed`);
  const src = path.join(root, "templates", "game");
  const title = name.trim().replace(/[^A-Za-z0-9]+/g, "");
  const fill = (s) => s.replaceAll("{{slug}}", slug).replaceAll("{{id}}", String(id))
    .replaceAll("{{name}}", name.trim()).replaceAll("{{Title}}", title);
  const copy = (from, to) => {
    fs.mkdirSync(to, { recursive: true });
    for (const e of fs.readdirSync(from, { withFileTypes: true })) {
      const a = path.join(from, e.name), b = path.join(to, e.name.replaceAll("SLUG", slug));
      if (e.isDirectory()) copy(a, b);
      else fs.writeFileSync(b, fill(fs.readFileSync(a, "utf8")));
    }
  };
  copy(src, dest);
  // The template is valid JSON with quoted placeholders; the id is known now, so store it as a number.
  const mf = path.join(dest, "game.json");
  const m = JSON.parse(fs.readFileSync(mf, "utf8"));
  m.vaultGameId = id;
  fs.writeFileSync(mf, JSON.stringify(m, null, 2) + "\n");
  return dest;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = args(process.argv.slice(2));
  try {
    const dest = newGame(a._[0], a.id, a.name);
    console.log(`Created ${path.relative(ROOT, dest)}/. Next: fill every {{…}} in game.json, then npm run game:check -- ${a._[0]}`);
  } catch (e) {
    console.error(`✖ ${e.message}`);
    process.exit(1);
  }
}
