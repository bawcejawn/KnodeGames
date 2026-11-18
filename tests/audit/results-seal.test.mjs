// Audit AB-058 (Audit Bot, 16 Nov 2026): the publish jobs seal the vault results files and boards they publish, and the
// vault bot checks the seal. Run: node --import tsx --test tests/audit/results-seal.test.mjs (needs openssl 3 and git).
//   1. Every data-branch publish job runs kit/publish/results-seal.sh byte for byte, just before it writes its tree, with
//      RESULTS_SEAL_KEY and its own branch.
//   2. The shell seals exactly this run's own results files, RELEASE files and boards (never a file someone else put on
//      the branch), and bot/vault.ts's sealProblem accepts what it wrote; a changed byte, another key, another path or
//      a missing seal is refused.
//   3. Without RESULTS_SEAL_KEY it seals nothing and says so.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const SEAL = fs.readFileSync(path.join(ROOT, "kit/publish/results-seal.sh"), "utf8").replace(/\n$/, "");
const { tsImport } = await import("tsx/esm/api");
const V = await tsImport("../../bot/vault.ts", import.meta.url);
const JOBS = { "race.yml": ["publish", "race-data"], "games.yml": ["publish", "games-data"], "golf.yml": ["publish", "games-data"],
  "combo.yml": ["publish", "games-data"], "kit-games.yml": ["publish-kit", "games-data"] };

test("every data-branch publish job seals with kit/publish/results-seal.sh, byte for byte, right before it writes its tree", () => {
  for (const [f, [job, branch]] of Object.entries(JOBS)) {
    const y = fs.readFileSync(path.join(ROOT, ".github/workflows", f), "utf8");
    const lines = y.split("\n");
    const at = lines.findIndex((l) => l.trim() === SEAL.split("\n")[0]);
    assert.ok(at > 0, `${f}: no results-seal block`);
    const ind = lines[at].length - lines[at].trimStart().length;
    const block = SEAL.split("\n").map((l) => (l ? " ".repeat(ind) + l : l)).join("\n");
    assert.equal(y.split(block).length - 1, 1, `${f}: the block must be kit/publish/results-seal.sh exactly, once`);
    const after = lines.slice(at + SEAL.split("\n").length).find((l) => l.trim());
    assert.equal(after.trim(), "tree=$(git write-tree)", `${f}: the seal must come right before the tree is written`);
    const jobText = y.slice(y.indexOf(`\n  ${job}:\n`));
    assert.match(jobText, /\n          RESULTS_SEAL_KEY: \$\{\{ secrets\.RESULTS_SEAL_KEY \}\}\n/, `${f}: the key reaches the step`);
    assert.match(jobText, new RegExp(`\\n          SEAL_BRANCH: ${branch}\\n`), `${f}: its own branch`);
  }
});

const key = () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return { pem: privateKey.export({ type: "pkcs8", format: "pem" }), pub: publicKey.export({ type: "spki", format: "der" }).toString("base64") };
};
/** A scratch publish: the branch's index already holds `staged` (path → text); the run's own files are `own`.
 *  `parentFiles` (Repo Lens L2-1): the branch's last commit; it is read into the index first and named in $parent,
 *  as the publish jobs do. */
function publish(own, staged, env, parentFiles) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "seal-"));
  const IN = path.join(dir, "incoming"), work = path.join(dir, "work"), tmp = path.join(dir, "tmp");
  fs.mkdirSync(work); fs.mkdirSync(tmp);
  for (const [p, t] of Object.entries(own)) { fs.mkdirSync(path.dirname(path.join(IN, p)), { recursive: true }); fs.writeFileSync(path.join(IN, p), t); }
  const git = (...a) => execFileSync("git", a, { cwd: work, encoding: "utf8", input: a.includes("--stdin") ? a.input : undefined });
  git("init", "-q");
  let parent = "";
  if (parentFiles) {
    for (const [p, t] of Object.entries(parentFiles)) {
      const blob = execFileSync("git", ["hash-object", "-w", "--stdin"], { cwd: work, input: t, encoding: "utf8" }).trim();
      git("update-index", "--add", "--cacheinfo", `100644,${blob},${p}`);
    }
    const tree = git("write-tree").trim();
    parent = execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "commit-tree", tree, "-m", "branch"], { cwd: work, encoding: "utf8" }).trim();
    git("read-tree", parent);
  }
  for (const [p, t] of Object.entries(staged)) {
    const blob = execFileSync("git", ["hash-object", "-w", "--stdin"], { cwd: work, input: t, encoding: "utf8" }).trim();
    git("update-index", "--add", "--cacheinfo", `100644,${blob},${p}`);
  }
  const r = spawnSync("bash", ["-e", "-c", `parent=${JSON.stringify(parent)}\n${SEAL}`], { cwd: work, encoding: "utf8", env: { ...process.env, IN, RUNNER_TEMP: tmp, ...env } });
  const files = Object.fromEntries(git("ls-files").split("\n").filter(Boolean).map((p) => [p, execFileSync("git", ["show", `:${p}`], { cwd: work, encoding: "utf8" })]));
  return { r, files, tmp };
}
const readerOf = (branch, files) => (spec) => {
  const p = spec.slice(branch.length + 1);
  if (!spec.startsWith(`${branch}:`) || !(p in files)) return { state: "missing" };
  try { return { state: "ok", data: JSON.parse(files[p]), raw: files[p] }; } catch { return { state: "error", error: "bad JSON" }; }
};

const W5 = JSON.stringify({ game: 7, week: 5, final: true, rows: [{ player: "1PWeFG4pPtjZZoYvcmGb6mYhMYJjnkHrmz", points: 3 }], first: [], second: [] }) + "\n";
const BOARD = JSON.stringify({ lastWeek: { week: 5, rows: [{ a: "1PWeFG4pPtjZZoYvcmGb6mYhMYJjnkHrmz", pts: 9, place: 1, ranked: true }] } }) + "\n";
const RELEASE = JSON.stringify({ week: 5, released: true }) + "\n";
const FORGED = JSON.stringify({ game: 7, week: 6, final: true, rows: [{ player: "12Y5vW6gk8GceH53YfRkRre2Rrcsgw7Naq", points: 255 }] }) + "\n";

test("the publish shell seals this run's results, RELEASE and board files, and the vault bot accepts exactly those", () => {
  const k = key();
  const own = { "vault/W5.json": W5, "vault/RELEASE-W5.json": RELEASE, "board.json": BOARD, "races.json": "{}\n", "vault/W6.json": "{\"other\":1}\n" };
  // The branch already holds a forged W6 (someone pushed it): the run's own W6 differs, so its staged copy isn't the run's.
  const staged = { "vault/W5.json": W5, "vault/RELEASE-W5.json": RELEASE, "board.json": BOARD, "races.json": "{}\n", "vault/W6.json": FORGED };
  const { r, files, tmp } = publish(own, staged, { RESULTS_SEAL_KEY: k.pem, SEAL_BRANCH: "race-data" });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(Object.keys(files).filter((p) => p.endsWith(".seal")).sort(), ["board.json.seal", "vault/RELEASE-W5.json.seal", "vault/W5.json.seal"],
    "only this run's own results, RELEASE and board files are sealed (never the forged W6, never other files)");
  assert.deepEqual(fs.readdirSync(tmp), [], "the key and scratch files are removed");
  const read = readerOf("race-data", files);
  for (const p of ["vault/W5.json", "vault/RELEASE-W5.json", "board.json"]) assert.equal(V.sealProblem(read, `race-data:${p}`, read(`race-data:${p}`), k.pub), "", p);
  // The forged W6 has no seal; a changed byte, another key, or the same seal under another path are refused.
  assert.match(V.sealProblem(read, "race-data:vault/W6.json", read("race-data:vault/W6.json"), k.pub), /no seal/);
  const changed = { ...files, "vault/W5.json": W5.replace("\"points\":3", "\"points\":4") };
  assert.match(V.sealProblem(readerOf("race-data", changed), "race-data:vault/W5.json", readerOf("race-data", changed)("race-data:vault/W5.json"), k.pub), /doesn't match/);
  assert.match(V.sealProblem(read, "race-data:vault/W5.json", read("race-data:vault/W5.json"), key().pub), /doesn't match/);
  const moved = { "x/vault/W5.json": files["vault/W5.json"], "x/vault/W5.json.seal": files["vault/W5.json.seal"] };
  assert.match(V.sealProblem(readerOf("games-data", moved), "games-data:x/vault/W5.json", readerOf("games-data", moved)("games-data:x/vault/W5.json"), k.pub), /doesn't match/);
});

test("without RESULTS_SEAL_KEY the publish shell seals nothing and warns", () => {
  const { r, files } = publish({ "vault/W5.json": W5 }, { "vault/W5.json": W5 }, { RESULTS_SEAL_KEY: "", SEAL_BRANCH: "race-data" });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /::warning::RESULTS_SEAL_KEY is not set/);
  assert.deepEqual(Object.keys(files), ["vault/W5.json"]);
});

test("a key that can't sign stops the publish (nothing goes out half sealed)", () => {
  const { r } = publish({ "vault/W5.json": W5 }, { "vault/W5.json": W5 }, { RESULTS_SEAL_KEY: "not a key", SEAL_BRANCH: "race-data" });
  assert.notEqual(r.status, 0);
  assert.match(r.stdout, /::error::could not seal vault\/W5\.json/);
});

// ── Repo Lens #L-2 L2-1 (17 Nov 2026): a recorder that copies a published file forward must not get it sealed ──
test("L2-1: a results file the branch already holds (copied forward by the recorder) is never sealed by this run", () => {
  const k = key();
  // A forger pushed a final W5 to the branch; the Race / kit recorders copy published final files forward unchanged,
  // so this run's $IN holds the same bytes, and read-tree stages them.
  const branch = { "vault/W5.json": FORGED, "board.json": BOARD };
  const { r, files } = publish({ "vault/W5.json": FORGED, "board.json": BOARD + " " }, { "board.json": BOARD + " " }, { RESULTS_SEAL_KEY: k.pem, SEAL_BRANCH: "race-data" }, branch);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!("vault/W5.json.seal" in files), "the copied-forward file stays unsealed");
  assert.ok("board.json.seal" in files, "the board this run rebuilt (new bytes) is sealed");
});

test("L2-1: a file sealed earlier and copied forward keeps its old seal, which still checks", () => {
  const k = key();
  const first = publish({ "vault/W5.json": W5 }, { "vault/W5.json": W5 }, { RESULTS_SEAL_KEY: k.pem, SEAL_BRANCH: "race-data" });
  const branch = { "vault/W5.json": W5, "vault/W5.json.seal": first.files["vault/W5.json.seal"] };
  const { r, files } = publish({ "vault/W5.json": W5 }, {}, { RESULTS_SEAL_KEY: k.pem, SEAL_BRANCH: "race-data" }, branch);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(files["vault/W5.json.seal"], first.files["vault/W5.json.seal"], "the old seal is kept (read-tree)");
  const read = readerOf("race-data", files);
  assert.equal(V.sealProblem(read, "race-data:vault/W5.json", read("race-data:vault/W5.json"), k.pub), "");
});

test("L2-1: a new results file this run writes (not on the branch yet) is sealed, with a parent commit present", () => {
  const k = key();
  const { r, files } = publish({ "vault/W5.json": W5 }, { "vault/W5.json": W5 }, { RESULTS_SEAL_KEY: k.pem, SEAL_BRANCH: "race-data" }, { "races.json": "{}\n" });
  assert.equal(r.status, 0, r.stderr);
  assert.ok("vault/W5.json.seal" in files);
});
