// The game manifest (games/<slug>/game.json): the one place a game's settings live (D-157,
// .ai/standards/NEW_GAME.md). This file is the schema and its checker. No dependencies, no network,
// nothing sent anywhere: it only reads files.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(fileURLToPath(new URL("../", import.meta.url)));   // a real path on Windows too

// Vault game ids already in use or reserved (.ai/platform/PLATFORM.md games table).
export const RESERVED_IDS = { 1: "questions", 2: "blockx", 3: "survivor", 4: "fantasy", 5: "fantasy-rival",
  6: "golf", 7: "race", 8: "combo", 9: "bracket", 13: "lastnode" };

export const SPONSOR_TX_CAP = 2.4; // Mana per sponsored transaction (D-131, .ai/platform/SPONSOR.md)
export const STATUSES = ["building", "review", "live", "paused"];
export const KINDS = ["staked", "free"];
export const PICKS_CONTRACTS = ["picks", "racepicks", "vault", "none"];
// Shared Game Kit (D-158, GAME_KIT.md §4): who gets paid, and how the vault file carries points.
export const PAYOUT_RULES = ["legacy-tied-whole", "d152"];
export const VAULT_VALUES = ["dense255", "points"];
export const BUDGET_KEYS = ["reads", "ms", "atOnce", "tries"];

const SLUG = /^[a-z][a-z0-9-]{1,23}$/;
const PLACEHOLDER = /\{\{[^}]*\}\}/;

/** Problems with one manifest object (empty list = valid). `opts.template` allows {{placeholders}}. */
export function validateManifest(m, opts = {}) {
  const p = [];
  const need = (cond, msg) => { if (!cond) p.push(msg); };
  if (!opts.template && PLACEHOLDER.test(JSON.stringify(m))) p.push("still has {{placeholders}}: fill every value");
  if (opts.template) return p;
  need(m && typeof m === "object" && !Array.isArray(m), "the manifest must be a JSON object");
  if (p.length) return p;
  need(m.schema === 1, "schema must be 1");
  need(typeof m.slug === "string" && SLUG.test(m.slug), "slug: lower-case letters, digits and dashes, 2–24 long, starting with a letter");
  need(typeof m.name === "string" && m.name.trim().length >= 3, "name: the game's display name");
  if (opts.kit) need(typeof m.name === "string" && NAME_RE.test(m.name), "name: one plain line of letters, digits, spaces and ( ) & . , ! + - (it's rendered into the workflow, KC-14)");
  need(Number.isInteger(m.vaultGameId) && m.vaultGameId >= 1 && m.vaultGameId <= 255, "vaultGameId: a whole number 1–255");
  if (Number.isInteger(m.vaultGameId) && RESERVED_IDS[m.vaultGameId] && RESERVED_IDS[m.vaultGameId] !== m.slug)
    p.push(`vaultGameId ${m.vaultGameId} belongs to "${RESERVED_IDS[m.vaultGameId]}"`);
  need(Array.isArray(m.kinds) && m.kinds.length > 0 && m.kinds.every((k) => KINDS.includes(k)), `kinds: a list from ${KINDS.join(", ")}`);
  need(Array.isArray(m.kinds) && m.kinds.includes("free"), "kinds must include \"free\": every game has Free play (D-081)");
  need(Number.isInteger(m.seasonWeeks) && m.seasonWeeks >= 1 && m.seasonWeeks <= 4, "seasonWeeks: 1–4");
  need(m.freePrizeDefault === "on" || m.freePrizeDefault === "off", "freePrizeDefault: \"on\" or \"off\" (FREE_PRIZE_SWITCH.md)");
  need(STATUSES.includes(m.status), `status: one of ${STATUSES.join(", ")}`);
  const pk = m.picks || {};
  need(PICKS_CONTRACTS.includes(pk.contract), `picks.contract: one of ${PICKS_CONTRACTS.join(", ")}`);
  if (pk.contract === "picks") need(Number.isInteger(pk.gameId) && pk.gameId >= 1, "picks.gameId: the game's id on the Picks contract");
  const sp = m.sponsor || {};
  need(Array.isArray(sp.actions), "sponsor.actions: the player actions the sponsor pays for (may be empty)");
  if (Array.isArray(sp.actions)) for (const a of sp.actions) {
    need(typeof a.name === "string" && a.name.length > 0, "sponsor.actions[].name");
    need(typeof a.manaLimit === "number" && a.manaLimit > 0 && a.manaLimit <= SPONSOR_TX_CAP,
      `sponsor action "${a.name}": manaLimit must be above 0 and at most ${SPONSOR_TX_CAP} (D-131)`);
  }
  const wk = m.week || {};
  need(wk.standard === "WEEK_CYCLE", "week.standard must be \"WEEK_CYCLE\" (D-134)");
  need(typeof wk.sundayFunRound === "boolean", "week.sundayFunRound: true or false (D-129; a false needs an owner decision)");
  need(wk.finalNotBefore === "Mon 00:00 UTC", "week.finalNotBefore must be \"Mon 00:00 UTC\" (D-125)");
  const d = m.data || {};
  need(typeof d.board === "string" && d.board.endsWith("board.json"), "data.board: where board.json is published");
  need(typeof d.vaultFolder === "string" && d.vaultFolder.length > 0, "data.vaultFolder: where the weekly vault files are published");
  const wf = m.workflow || {};
  need(typeof wf.file === "string" && /^[a-z0-9-]+\.yml$/.test(wf.file), "workflow.file: the recorder workflow (e.g. games.yml)");
  need(typeof wf.enabledVar === "string" && /^[A-Z][A-Z0-9_]{1,63}$/.test(wf.enabledVar), "workflow.enabledVar: the repo variable that turns the recorder on (at most 64 characters, as the kit's render allows; NK-20)");
  need(typeof wf.prizesFromVar === "string" && /^[A-Z][A-Z0-9_]+$/.test(wf.prizesFromVar), "workflow.prizesFromVar: the repo variable for the first paid week");
  need(typeof m.page === "string" && /^[a-z0-9-]+\.html$/.test(m.page), "page: the page's file name (e.g. blockx.html)");
  need(typeof m.rulesDoc === "string" && m.rulesDoc.startsWith(".ai/games/") && m.rulesDoc.endsWith(".md"), "rulesDoc: .ai/games/<Game>.md");
  need(typeof m.ownerChat === "string" && m.ownerChat.length > 0, "ownerChat: the chat that owns the game's files");
  // The kit's fields (GAME_KIT.md §4): checked whenever any is present, and required for a game whose recorder is a kit
  // GameModule (game:check passes opts.kit). A game still on its old recorder (Daily Questions until its port, D-160)
  // may leave them out.
  if (opts.kit || KIT_FIELDS.some((f) => m[f] !== undefined)) checkKitFields(m, need);
  return p;
}

export const KIT_FIELDS = ["payoutRule", "vaultValues", "minPts", "rowCap", "entry", "budgets", "liveWeek", "roundsCorrectable", "maxRoundPoints", "inputsFile", "inputsLeadHours", "published"];
/** Budget ceilings: a game's whole run must fit its own record job (25 min, KC-4). */
export const BUDGET_MAX = { reads: 200000, ms: 20 * 60000, atOnce: 16, tries: 6 };
/** A game's name is rendered into its workflow: one plain line (KC-14). */
export const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 ()&.,!+-]{1,39}$/;
function checkKitFields(m, need) {
  need(PAYOUT_RULES.includes(m.payoutRule), `payoutRule: one of ${PAYOUT_RULES.join(", ")} (a migration keeps the game's current rule, D-158)`);
  need(VAULT_VALUES.includes(m.vaultValues), `vaultValues: one of ${VAULT_VALUES.join(", ")} ("points" only where the vault takes real points, game 1)`);
  if (m.payoutRule === "d152") need(m.vaultValues === "dense255", "payoutRule d152 needs vaultValues \"dense255\" (a tie split across the line needs its own value)");
  need(Number.isInteger(m.minPts) && m.minPts >= 0, "minPts: the vault file's points floor (0 = none; must match vaultGames.<id>.minPts)");
  need(Number.isInteger(m.rowCap) && m.rowCap >= 0, "rowCap: the most board rows (0 = no cap; over it board.json keeps the ranked rows and the best others)");
  const en = m.entry || {};
  // minPoints 0 would post 0-point staked rows that the contract counts in its 30% (Repo Lens #B-11 KC-2).
  need(Number.isInteger(en.minRounds) && en.minRounds >= 1 && Number.isInteger(en.minPoints) && en.minPoints >= 1,
    "entry: { minRounds ≥ 1, minPoints ≥ 1 }, the rounds and points a wallet needs to be ranked");
  if (m.budgets !== undefined) {
    const b = m.budgets;
    need(b && typeof b === "object" && !Array.isArray(b) && Object.keys(b).every((k) => BUDGET_KEYS.includes(k) && Number.isInteger(b[k]) && b[k] > 0 && b[k] <= BUDGET_MAX[k]),
      `budgets: optional whole numbers above 0 for ${BUDGET_KEYS.join(", ")}, at most ${JSON.stringify(BUDGET_MAX)} (KC-4)`);
  }
  if (m.maxRoundPoints !== undefined) need(Number.isInteger(m.maxRoundPoints) && m.maxRoundPoints >= 1 && m.maxRoundPoints <= 1000000, "maxRoundPoints: a whole number from 1 to 1,000,000");
  for (const f of ["liveWeek", "roundsCorrectable", "inputsFile"]) if (m[f] !== undefined) need(typeof m[f] === "boolean", `${f}: true or false`);
  // FC-9: the inputs file is made this many hours before the week opens (default 48 = Saturday 00:00 UTC), at most
  // 4 days (#G-13 G13-2: a longer lead could see weeks that still change before the recount).
  if (m.inputsLeadHours !== undefined) need(m.inputsFile === true && Number.isInteger(m.inputsLeadHours) && m.inputsLeadHours >= 1 && m.inputsLeadHours <= 96, "inputsLeadHours: 1–96, only with inputsFile: true");
  // Phase 1 item 6: other kit games whose published final weeks this game reads (ctx.published.games).
  if (m.published !== undefined) need(Array.isArray(m.published) && m.published.length <= 4 && m.published.every((x) => typeof x === "string" && /^[a-z][a-z0-9-]{1,23}$/.test(x) && x !== m.slug) && new Set(m.published).size === m.published.length, "published: up to 4 other kit games' slugs");
}

/** Every games/<slug>/game.json in the repo. */
export function listManifests(root = ROOT) {
  const dir = path.join(root, "games");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory())
    .map((e) => path.join(dir, e.name, "game.json")).filter((f) => fs.existsSync(f));
}

export function readManifest(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** Keys an object repeats in a JSON text (JSON.parse keeps the last silently; KC-26). Paths like "entry.minPoints". */
export function duplicateKeys(text) {
  const out = [];
  let i = 0;
  const ws = () => { while (/\s/.test(text[i] ?? "")) i++; };
  const str = () => { const s0 = i; i++; while (i < text.length && text[i] !== '"') { if (text[i] === "\\") i++; i++; } i++; return JSON.parse(text.slice(s0, i)); };
  const val = (p) => {
    ws();
    if (text[i] === "{") {
      i++; const seen = new Set(); ws();
      if (text[i] === "}") { i++; return; }
      for (;;) { ws(); const k = str(); if (seen.has(k)) out.push(p ? `${p}.${k}` : k); seen.add(k); ws(); i++; val(p ? `${p}.${k}` : k); ws(); if (text[i++] === "}") return; }
    }
    if (text[i] === "[") {
      i++; ws(); if (text[i] === "]") { i++; return; }
      for (let n = 0; ; n++) { val(`${p}[${n}]`); ws(); if (text[i++] === "]") return; }
    }
    if (text[i] === '"') { str(); return; }
    while (i < text.length && !/[,\]}\s]/.test(text[i])) i++;
  };
  try { JSON.parse(text); val(""); } catch { return []; }
  return out;
}

/** Problems across all manifests (duplicate slugs or ids, folder name = slug). */
export function crossCheck(entries) {
  const p = [];
  const seenSlug = new Map(), seenId = new Map();
  for (const { file, m } of entries) {
    const folder = path.basename(path.dirname(file));
    if (m.slug !== folder) p.push(`${file}: slug "${m.slug}" must match its folder "${folder}"`);
    if (seenSlug.has(m.slug)) p.push(`slug "${m.slug}" used twice`);
    if (seenId.has(m.vaultGameId)) p.push(`vaultGameId ${m.vaultGameId} used by "${seenId.get(m.vaultGameId)}" and "${m.slug}"`);
    seenSlug.set(m.slug, file); seenId.set(m.vaultGameId, m.slug);
  }
  return p;
}
