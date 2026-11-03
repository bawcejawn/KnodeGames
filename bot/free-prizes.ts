/**
 * Free-prize switches: the owner turns each game's free 2 + 1 VHP prize on or off, from the NEXT vault week on
 * (owner, 2026-11-03, D-082). Every game is added to the vault with the free prize allowed (`game-add … --free`);
 * this switch decides whether the bot posts that week's free winners. A week whose switch is off gets no winners
 * posted, so the vault sends that game's free prize back to the pool when the week finalizes (Kpred finalize: an unwon
 * prize returns to the pool). The switch can only hold back a prize the vault already allows; it can never pay more.
 *
 * The file is free-prizes.json, the only file on the `prize-settings` branch (published like names-data, with the
 * owner's own git login):
 *
 *   { "v": 1, "games": { "2": [ { "from": 3, "on": true, "set": "2026-11-03T17:00:00.000Z" } ], … } }
 *
 * Each game has a list of changes. `from` is the first vault week it applies to, `set` when it was made. A change only
 * counts if it was made before week `from` started, so a change never reaches the week in progress or a past week.
 * A game with no change that counts follows its vault registration (free prize allowed = on). No file at all (the
 * branch doesn't exist yet): every game follows its registration, as before the switch existed.
 *
 *   npm run prizes -- list                     the switches now and for next week
 *   npm run prizes -- on  <game> [--send]      free prize on from next Monday 00:00 UTC
 *   npm run prizes -- off <game> [--send]      free prize off from next Monday 00:00 UTC
 *
 * Without --send nothing is published (a preview).
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const BRANCH = "prize-settings";
export const FILE = "free-prizes.json";
/** Vault week 0 began Mon 19 Oct 2026 00:00 UTC; weeks are 7 days (the contract's genesis_time / week_length). */
export const GENESIS_MS = Date.UTC(2026, 9, 19);
export const WEEK_MS = 7 * 24 * 3_600_000;
/** The vault's game ids besides game 1 (game 1, the questions, pays its free prize on its own). */
export const GAMES: Record<string, string> = {
  "2": "Who Signs Block X", "3": "Survivor", "4": "Fantasy Producers", "6": "Block Golf", "7": "Producer Race",
  "8": "Combo Card", "9": "Producer Bracket", "13": "Last Node Standing",
};
const MAX_CHANGES = 200;

export type Change = { from: number; on: boolean; set: string };
export type Switches = { v: 1; games: Record<string, Change[]> };

export const weekOf = (t: number, genesis = GENESIS_MS, weekLen = WEEK_MS) => (t < genesis ? 0 : Math.floor((t - genesis) / weekLen));
export const weekStart = (w: number, genesis = GENESIS_MS, weekLen = WEEK_MS) => genesis + w * weekLen;
export const empty = (): Switches => ({ v: 1, games: {} });

/** Checks a switches file. Returns the reason it can't be used, or "". */
export function checkSwitches(s: any): string {
  if (!s || typeof s !== "object" || s.v !== 1 || !s.games || typeof s.games !== "object" || Array.isArray(s.games)) return "not a v1 switches file";
  for (const [id, list] of Object.entries(s.games)) {
    if (!/^[0-9]{1,3}$/.test(id) || id === "1") return `bad game id ${id}`;
    if (!Array.isArray(list) || list.length > MAX_CHANGES) return `game ${id}: changes must be a list (at most ${MAX_CHANGES})`;
    let last = -1;
    for (const c of list as any[]) {
      if (!c || !Number.isInteger(c.from) || c.from < 0 || typeof c.on !== "boolean" || typeof c.set !== "string" || !Number.isFinite(Date.parse(c.set)))
        return `game ${id}: each change needs from (a week), on (true/false) and set (a time)`;
      if (c.from < last) return `game ${id}: changes must be in week order`;
      last = c.from;
    }
  }
  return "";
}

/**
 * Is game `game`'s free prize on for vault week `w`? null = no change counts: follow the vault registration.
 * A change counts only if it was set before its week started (never reaches a week in progress or past).
 */
export function switchFor(s: Switches | null, game: number, w: number, genesis = GENESIS_MS, weekLen = WEEK_MS): boolean | null {
  const list = s?.games?.[String(game)];
  if (!Array.isArray(list)) return null;
  let on: boolean | null = null;
  for (const c of list) if (c.from <= w && Date.parse(c.set) < weekStart(c.from, genesis, weekLen)) on = c.on;
  return on;
}

/**
 * Should the bot post free winners for a season ending in week `w`? Only if the switch is on (or unset) for every
 * week of that season (a switch turned on mid-season starts with the next season). `seasonWeeks` ≥ 1.
 */
export function prizeOn(s: Switches | null, game: number, w: number, seasonWeeks = 1, genesis = GENESIS_MS, weekLen = WEEK_MS): boolean {
  const n = Math.max(1, Math.floor(seasonWeeks) || 1);
  for (let x = Math.max(0, w - n + 1); x <= w; x++) if (switchFor(s, game, x, genesis, weekLen) === false) return false;
  return true;
}

/** The file with game `game` switched on or off from the week after `now`. A same-week earlier change is replaced. */
export function setSwitch(s: Switches, game: number, on: boolean, now: number): { next: Switches; from: number } {
  if (!GAMES[String(game)]) throw new Error(`Game ${game} isn't a vault game. Ids: ${Object.entries(GAMES).map(([i, n]) => `${i} ${n}`).join(", ")}.`);
  const from = weekOf(now) + 1;
  const list = (s.games[String(game)] ?? []).filter((c) => c.from < from);
  list.push({ from, on, set: new Date(now).toISOString() });
  return { next: { v: 1, games: { ...s.games, [String(game)]: list } }, from };
}

export const serialize = (s: Switches) => JSON.stringify(s, null, 1) + "\n";

// ═══════════════ reading it (the bot) and publishing it (the owner's PC) ═══════════════
function git(args: string[], input?: string): string {
  const p = spawnSync("git", args, { encoding: "utf8", input, maxBuffer: 16 * 1024 * 1024 });
  if (p.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${(p.stderr || "").trim()}`);
  return p.stdout;
}

/**
 * The switches from origin's prize-settings branch. { s: null } = the branch doesn't exist (follow registrations).
 * Throws if origin can't be reached or the file is unreadable or malformed: the bot then holds free winners (fail closed).
 */
export function readSwitches(): { s: Switches | null; base: string } {
  const heads = git(["ls-remote", "--heads", "origin", BRANCH]).trim();
  if (!heads) return { s: null, base: "" };
  git(["fetch", "-q", "origin", `+refs/heads/${BRANCH}:refs/remotes/origin/${BRANCH}`]);
  const base = git(["rev-parse", `refs/remotes/origin/${BRANCH}`]).trim();
  const s = JSON.parse(git(["show", `${base}:${FILE}`]));
  const why = checkSwitches(s);
  if (why) throw new Error(`${BRANCH}/${FILE}: ${why}`);
  return { s, base };
}

function publish(s: Switches, base: string, what: string) {
  const blob = git(["hash-object", "-w", "--stdin"], serialize(s)).trim();
  const tree = git(["mktree"], `100644 blob ${blob}\t${FILE}\n`).trim();
  const who = { GIT_AUTHOR_NAME: "knode-prizes", GIT_AUTHOR_EMAIL: "knode-prizes@users.noreply.github.com", GIT_COMMITTER_NAME: "knode-prizes", GIT_COMMITTER_EMAIL: "knode-prizes@users.noreply.github.com" };
  const p = spawnSync("git", ["commit-tree", tree, ...(base ? ["-p", base] : []), "-m", `free prizes: ${what}`], { encoding: "utf8", input: "", env: { ...process.env, ...who } });
  if (p.status !== 0) throw new Error(`git commit-tree failed: ${p.stderr}`);
  const commit = p.stdout.trim();
  // A plain push: if someone published in between, it isn't a fast-forward and git refuses it (run the command again).
  git(["push", "-q", "origin", `${commit}:refs/heads/${BRANCH}`]);
  console.log(`Published to ${BRANCH} (${commit.slice(0, 8)}).`);
}

const day = (t: number) => new Date(t).toUTCString().slice(0, 16);
const state = (v: boolean | null) => (v === null ? "on (as registered)" : v ? "on" : "off");

export function listText(s: Switches | null, now: number): string {
  const w = weekOf(now);
  const lines = [`Vault week ${w} (from ${day(weekStart(w))}). Next week ${w + 1} starts ${day(weekStart(w + 1))} 00:00 UTC.`, ""];
  for (const [id, name] of Object.entries(GAMES))
    lines.push(`  ${id.padStart(2)} ${name.padEnd(20)} this week: ${state(switchFor(s, Number(id), w)).padEnd(18)} next week: ${state(switchFor(s, Number(id), w + 1))}`);
  lines.push("", "Only games added to the vault with the free prize (game-add … --free) can pay it; the switch holds it back when off.");
  if (!s) lines.push(`No ${BRANCH} branch yet: every game follows its vault registration.`);
  return lines.join("\n");
}

async function main(argv: string[]) {
  const send = argv.includes("--send");
  const a = argv.filter((x) => x !== "--send");
  const now = Date.now();
  if (a[0] === "list" || !a[0]) { console.log(listText(readSwitches().s, now)); return; }
  if (a[0] !== "on" && a[0] !== "off") { console.log("Commands: list · on <game> [--send] · off <game> [--send]"); process.exitCode = 1; return; }
  const game = Number(a[1]);
  if (!/^[0-9]{1,3}$/.test(a[1] ?? "")) throw new Error(`Usage: npm run prizes -- ${a[0]} <game id> [--send]`);
  const { s, base } = readSwitches();
  const { next, from } = setSwitch(s ?? empty(), game, a[0] === "on", now);
  const what = `${GAMES[String(game)]} (game ${game}) free prize ${a[0]} from week ${from}`;
  console.log(`${what}: starts ${day(weekStart(from))} 00:00 UTC. This week (${from - 1}) keeps ${state(switchFor(s, game, from - 1))}.`);
  if (!send) { console.log("Preview only: nothing published. Add --send to publish."); return; }
  publish(next, base, what);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv.slice(2)).catch((e) => { console.error(e.message); process.exitCode = 1; });
