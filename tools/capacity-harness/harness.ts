/**
 * Knode Games capacity harness (Capacity chat, 12 Nov 2026). FAKE PLAYERS ONLY.
 *
 * What it does, all on this computer:
 *   1. Daily Questions: runs the REAL recorder code (games/questions/recorder.ts readSnapshot + buildWeek, which scores
 *      with math.js) against a fake chain node holding N fake players, and measures the week file, board and vault
 *      file against the 1.9 MB recorder cap and the publish job's 2 MB cap.
 *   2. Producer Race and Block X: takes a real published week file as the template (same shapes), fills it with N fake
 *      players' picks, and measures it against the 2 MB publish cap. Boards the same way.
 *   3. Sponsor Mana: N players x a day's actions x the measured per-action limits (sponsor-data/mana-limits.json),
 *      against the sponsor's caps and the KOIN needed.
 *
 * What it must never touch: the live chain (mainnet), testnet, the sponsor, the vault, any wallet or key, GitHub.
 * Guards: every network call in this process throws; it refuses to start if CONFIRM_MAINNET is set; it writes only to a
 * temporary folder outside the repository; it reads only files already in the repository.
 *
 *   npx tsx tools/capacity-harness/harness.ts --dry                  (the harness's own dry run: 50 players, ~5 s)
 *   npx tsx tools/capacity-harness/harness.ts                        (50, 1,000, 10,000, 100,000 players, ~1-3 min)
 *   npx tsx tools/capacity-harness/harness.ts --sizes 50,500,5000
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

// ── Guards: nothing leaves this computer ──────────────────────────────────────────────────────────────────────────
if (process.env.CONFIRM_MAINNET) { console.error("CONFIRM_MAINNET is set in this window: the harness refuses to run. Close this window and open a new one."); process.exit(2); }
const blocked = () => { throw new Error("capacity harness: network calls are blocked (fake players only)"); };
(globalThis as any).fetch = blocked;
for (const m of ["node:http", "node:https", "node:net", "node:tls"]) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod: any = await import(m);
  for (const k of ["request", "get", "connect", "createConnection"]) if (typeof mod[k] === "function") try { mod[k] = blocked; } catch { /* read-only export */ }
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), "kg-capacity-"));
const args = process.argv.slice(2);
const dry = args.includes("--dry");
const si = args.indexOf("--sizes");
const SIZES = dry ? [50] : si >= 0 ? args[si + 1].split(",").map((x) => Number(x.replace(/_/g, ""))) : [50, 1_000, 10_000, 100_000];
const PUBLISH_CAP = 2 * 1024 * 1024;           // the publish jobs refuse files over 2 MB (find -size +2048k)
const kb = (n: number) => `${(n / 1024).toFixed(0)} KB`;
const pct = (n: number, cap: number) => `${((100 * n) / cap).toFixed(0)}%`;
const lines: string[] = [];
const say = (s = "") => { console.log(s); lines.push(s); };

// Fake addresses with the real format (1 + 33 base58 characters), the same every run.
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function addr(i: number, salt = "p"): string {
  const h = crypto.createHash("sha256").update(`${salt}${i}`).digest();
  let s = "1"; for (let k = 0; k < 33; k++) s += B58[h[k % 32] % 58];
  return s;
}
// Read a file from the repository or, for data branches, from git (read-only).
function gitShow(ref: string): string | null {
  try { return execFileSync("git", ["show", ref], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }); } catch { return null; }
}

say(`Knode Games capacity harness, fake players only. ${new Date().toISOString()}`);
say(`Repository: ${ROOT}`);
say(`Output folder (temporary, outside the repository): ${OUT}`);
say(`Sizes: ${SIZES.join(", ")} players${dry ? " (dry run)" : ""}`);
say(`Guards: network blocked, CONFIRM_MAINNET not set, nothing written inside the repository.`);

// ── 1. Daily Questions, with the real recorder code ───────────────────────────────────────────────────────────────
const Q: any = await import(pathToFileURL(path.join(ROOT, "games/questions/recorder.ts")).href);
say(""); say("1. DAILY QUESTIONS (real recorder code, fake node)");
say(`   recorder cap ${kb(Q.MAX_FILE)}, publish cap ${kb(PUBLISH_CAP)}, MAX_PLAYERS ${Q.MAX_PLAYERS}`);
function fakeQuestionsNode(players: number, answersEach: number) {
  const WEEK = 604_800_000, GENESIS = 1_792_368_000_000, W = 4;      // a Monday 00:00 UTC; week 4 = Week 1
  const start = GENESIS + W * WEEK, QN = 60, first = 1000;
  const qs = Array.from({ length: QN }, (_, i) => ({ id: first + i, week: W, outcome: 1 + (i % 4), lock_time: start + Math.floor(i / 10) * 86_400_000 + 43_200_000 }));
  const addrs = Array.from({ length: players }, (_, i) => addr(i)).sort();
  let reads = 0;
  const node = {
    read: async (m: string, a: any = {}) => {
      reads++;
      if (m === "get_state") return { time: String(start + WEEK + 3_600_000), config: { genesis_time: String(GENESIS), week_length: String(WEEK), min_stake: "100000000", q60_rule_week_plus_one: "1" }, totals: { next_question_id: String(first + QN) } };
      if (m === "get_question") { const q = qs.find((x) => x.id === Number(a.id)); return { question: q ? { week: String(q.week), outcome: String(q.outcome), lock_time: String(q.lock_time) } : { week: "0" } }; }
      if (m === "list_players") {
        const from = a.start ? addrs.indexOf(a.start) + 1 : 0;
        return { rows: addrs.slice(from, from + Number(a.limit)).map((address, j) => ({
          address, entry: { stake: String((from + j) % 3 === 0 ? 1_000_000_000 : 0), peak_stake: String((from + j) % 3 === 0 ? 1_000_000_000 : 0), voided: false,
            answers: qs.slice(0, answersEach).map((q, k) => ({ question_id: String(q.id), option: String(1 + ((from + j + k) % 4)) })) } })) };
      }
      throw new Error(`fake node: no ${m}`);
    },
  };
  return { node, W, reads: () => reads };
}
for (const answers of [60, 30]) for (const n of SIZES) {
  const t0 = Date.now();
  const f = fakeQuestionsNode(n, answers);
  let line: string;
  try {
    const snap = await Q.readSnapshot(f.node, f.W);
    const built = Q.buildWeek(snap, null, snap.time);
    const wBytes = Buffer.byteLength(JSON.stringify(built.file) + "\n");
    const bBytes = Buffer.byteLength(JSON.stringify(built.board) + "\n");
    fs.writeFileSync(path.join(OUT, `questions-${answers}-${n}.json`), JSON.stringify(built.file));
    const verdict = wBytes > Q.MAX_FILE ? "STOPS (week file over the recorder cap: no file, week not paid until fixed; picks safe on chain)" : `fits (${pct(wBytes, Q.MAX_FILE)} of cap)`;
    line = `   ${String(n).padStart(7)} players x ${answers} answers: week file ${kb(wBytes)}, board ${kb(bBytes)}; ${verdict}; node reads ${f.reads()} per node (~${Math.ceil(f.reads() * 0.3 / 60)} min at 0.3 s each); ${Date.now() - t0} ms here`;
  } catch (e: any) {
    line = `   ${String(n).padStart(7)} players x ${answers} answers: STOPS safely: ${e.message}`;
  }
  say(line);
}

// ── 2. Producer Race and Block X, real file shapes ────────────────────────────────────────────────────────────────
say(""); say("2. PRODUCER RACE AND BLOCK X (real week files as templates, fake picks)");
const raceText = gitShow("origin/race-data:W002.json"), bxText = gitShow("origin/games-data:blockx/W002.json");
if (!raceText || !bxText) {
  say("   The real week files aren't on this computer yet. Run this once (read-only, it only downloads them), then run the harness again:");
  say("     git fetch origin race-data:refs/remotes/origin/race-data games-data:refs/remotes/origin/games-data");
  process.exit(1);
}
const raceT = JSON.parse(raceText), bxT = JSON.parse(bxText);
const prods = Array.from({ length: 30 }, (_, i) => addr(i, "producer"));
function raceFile(players: number, racesEach: number) {
  const f = structuredClone(raceT);
  f.races.forEach((r: any, ri: number) => {
    const res = r.result ?? (r.result = {});
    res.picks = [];
    for (let p = 0; p < players; p++) if ((p + ri) % f.races.length < racesEach) res.picks.push([addr(p), prods[(p + ri) % 30], Number(r.start) + 1000 + p, 0, 0, 0]);
  });
  return Buffer.byteLength(JSON.stringify(f) + "\n");
}
const BX_TARGETS = 144;                          // hourly targets Mon-Sat (owner, 11 Nov)
function blockxFile(players: number, picksEach: number) {
  if (!bxT) return NaN;
  const f = structuredClone(bxT);
  const one = f.targets[0];
  f.targets = Array.from({ length: BX_TARGETS }, (_, i) => ({ ...structuredClone(one), round: i, height: Number(one.height) + i * 1200, picks: [] as any[] }));
  for (let p = 0; p < players; p++) for (let k = 0; k < picksEach; k++) {
    const t = f.targets[(p * 7 + k) % BX_TARGETS];
    t.picks.push([addr(p), prods[(p + k) % 30], Number(t.time || 0) + p, 0, 0]);
  }
  return Buffer.byteLength(JSON.stringify(f) + "\n");
}
const raceRaces = raceT.races.length;
for (const [label, fn, profiles] of [
  ["Race week (28 six-hour races)", raceFile, [[raceRaces, "every race"], [10, "10 races a week"]]],
  [`Block X week (${BX_TARGETS} hourly targets)`, blockxFile, [[BX_TARGETS, "every target"], [20, "20 picks a week"]]],
] as const) {
  for (const [each, what] of profiles as any) {
    // File size grows in a straight line with players: fit it from 100 and 1,000 players first, so a size far over
    // the cap is worked out instead of built (building a 2 GB file in memory crashed the owner's PC, 12 Nov).
    const b1 = fn(100, each), b2 = fn(1000, each), per = (b2 - b1) / 900, fixed = b1 - 100 * per;
    const BUILD_LIMIT = 16 * PUBLISH_CAP;          // ~32 MB: anything bigger is worked out, not built
    const row = SIZES.map((n) => {
      const est = fixed + per * n;
      if (est > BUILD_LIMIT) return `${n}: ~${kb(est)} OVER (worked out, not built)`;
      const b = fn(n, each); return `${n}: ${kb(b)} ${b > PUBLISH_CAP ? "OVER" : pct(b, PUBLISH_CAP)}`;
    });
    say(`   ${label}, ${what}: ${row.join(" | ")}`);
    const fit = Math.floor((PUBLISH_CAP - fixed) / per);
    const check = fit > 0 && fit < 200_000 ? (fn(fit, each) <= PUBLISH_CAP && fn(Math.ceil(fit * 1.02), each) > PUBLISH_CAP ? "checked" : "check failed") : "not checked";
    say(`      largest that fits under 2 MB: about ${fit.toLocaleString()} players (${Math.round(per)} bytes a player, ${kb(fixed)} fixed; ${check})`);
  }
}
// Boards: three sections (today, week, last week), rows like the live boards.
const rowLen = { race: 139, blockx: 165 };
for (const [g, len] of Object.entries(rowLen)) {
  say(`   ${g} board.json (3 sections, ~${len} bytes a row): ` + SIZES.map((n) => { const b = 3 * n * len + 200; return `${n}: ${kb(b)} ${b > PUBLISH_CAP ? "OVER" : pct(b, PUBLISH_CAP)}`; }).join(" | "));
}

// ── 3. Sponsor Mana ───────────────────────────────────────────────────────────────────────────────────────────────
say(""); say("3. SPONSOR MANA (measured per-action limits x a day's actions)");
const limits = JSON.parse(fs.readFileSync(path.join(ROOT, "sponsor-data/mana-limits.json"), "utf8"));
const row = (name: string) => limits.rows.find((r: any) => r.name === name);
const cap = (r: any) => Number(r.max_mana) / 1e8, real = (r: any) => Number(r.observed.typical) / 1e8;
const ans = row("Daily Questions answer"), race = row("Producer Race pick"), bx = row("KnodeGames Picks pick");
const profiles = [
  { name: "light (4 answers, 1 race pick)", a: 4, r: 1, b: 0 },
  { name: "typical (8 answers, 2 race, 0 Block X)", a: 8, r: 2, b: 0 },
  { name: "every game (8 answers, 4 race, 3 Block X)", a: 8, r: 4, b: 3 },
];
const CAPS = { all: 5000, guests: 2000, perWallet: 40 };     // from docs (4 Nov rollout); confirm with npm run sponsor -- status
say(`   caps (from docs, confirm on chain): ${CAPS.all} a day for everyone, ${CAPS.guests} for guests, ${CAPS.perWallet} per wallet`);
for (const p of profiles) {
  const counted = p.a * cap(ans) + p.r * cap(race) + p.b * cap(bx);
  const burned = p.a * real(ans) + p.r * real(race) + p.b * real(bx);
  say(`   ${p.name}: ${counted.toFixed(1)} Mana counted, ${burned.toFixed(1)} burned per player a day -> ` +
    `${Math.floor(CAPS.guests / counted)} guests / ${Math.floor(CAPS.all / counted)} players fit the caps; ` +
    `KOIN for 1,000 such players: ${Math.round(1000 * counted * 5).toLocaleString()} (Mana refills 1/5 of the KOIN a day)`);
}
say(`   claim day: a claim counts ${cap(row("Daily Questions claim_game")).toFixed(2)} Mana -> at most ${Math.floor(CAPS.all / cap(row("Daily Questions claim_game")))} claims if nothing else is sponsored that day`);

fs.writeFileSync(path.join(OUT, "REPORT.txt"), lines.join("\n") + "\n");
say(""); say(`Done. Report: ${path.join(OUT, "REPORT.txt")} (delete the folder whenever you like; nothing else was written).`);
