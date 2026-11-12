// Shared Game Kit: a game's settings, from its manifest (games/<slug>/game.json, schema tools/game-manifest.mjs)
// and the vault's clock from game-data/deployment.json. One schema; the publish job's config is rendered from these.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateManifest, duplicateKeys } from "../../tools/game-manifest.mjs";
import { DATA_BRANCHES } from "../publish/check.inline.mjs";
import type { KitGameCfg } from "./runtime.ts";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function readDeployment(root = ROOT): any {
  const p = path.join(root, "game-data/deployment.json");
  return JSON.parse(fs.readFileSync(fs.existsSync(p) ? p : path.join(ROOT, "game-data/deployment.json"), "utf8"));
}

/** The folder a game's files go in on its data branch ("games-data:questions/vault" → branch games-data, folder questions). */
export function dataFolder(m: any): { branch: string; folder: string } {
  const r = /^([a-z0-9-]+):([a-z0-9-]+)\/vault$/.exec(String(m.data?.vaultFolder ?? ""));
  if (!r) throw new Error(`${m.slug}: data.vaultFolder must be "<branch>:<folder>/vault"`);
  if (!DATA_BRANCHES.includes(r[1])) throw new Error(`${m.slug}: the data branch must be one of ${DATA_BRANCHES.join(", ")} (KC-23)`);
  if (m.data.board !== `${r[1]}:${r[2]}/board.json`) throw new Error(`${m.slug}: data.board must be "${r[1]}:${r[2]}/board.json" (next to its vault folder)`);
  if (r[2] !== m.slug) throw new Error(`${m.slug}: the data folder must be named after the slug`);
  return { branch: r[1], folder: r[2] };
}

export function loadManifest(slug: string, root = ROOT): any {
  const text = fs.readFileSync(path.join(root, "games", slug, "game.json"), "utf8");
  const dup = duplicateKeys(text);
  if (dup.length) throw new Error(`games/${slug}/game.json repeats a key (${dup.join(", ")}): JSON keeps the last one silently (KC-26)`);
  const m = JSON.parse(text);
  const probs = validateManifest(m, { kit: true });
  if (probs.length) throw new Error(`games/${slug}/game.json: ${probs.join("; ")}`);
  if (m.slug !== slug) throw new Error(`games/${slug}/game.json has slug "${m.slug}"`);
  return m;
}

/** The payout-deciding fields, as vaultGames.<id>.kit pins them (keys in this order). */
export const payoutPin = (m: any) => ({
  payoutRule: m.payoutRule, vaultValues: m.vaultValues, entry: { minRounds: m.entry.minRounds, minPoints: m.entry.minPoints },
  sundayFunRound: m.week.sundayFunRound, roundsCorrectable: m.roundsCorrectable === true, liveWeek: m.liveWeek === true,
});

/** The kit's config for one game. */
export function kitConfig(m: any, dep = readDeployment()): KitGameCfg {
  dataFolder(m);
  const genesis = Number(dep.genesisTime), weekMs = Number(dep.weekLength);
  if (!(genesis > 0 && weekMs > 0)) throw new Error("game-data/deployment.json has no genesisTime / weekLength");
  const vg = dep.vaultGames?.[String(m.vaultGameId)];
  // vaultGames.<id> is the Vault chat's (game 1's lands with v6.1, PR #114). When it's there it must agree.
  if (vg && vg.results !== m.data.vaultFolder) throw new Error(`vaultGames.${m.vaultGameId}.results is "${vg.results}", game.json says "${m.data.vaultFolder}"`);
  if (vg && Number(vg.minPts ?? 0) !== m.minPts) throw new Error(`vaultGames.${m.vaultGameId}.minPts (${vg.minPts ?? 0}) isn't game.json's minPts (${m.minPts})`);
  // KC-26: once the vault pays a game (vaultGames.<id> exists), the fields that decide who gets paid are pinned there
  // too, so a one-line game.json edit can't change payouts; changing one is a deployment change with its own review.
  if (vg) {
    const want = payoutPin(m), got = vg.kit;
    if (!got) throw new Error(`vaultGames.${m.vaultGameId} has no "kit" pin: add ${JSON.stringify(want)} (KC-26)`);
    if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`vaultGames.${m.vaultGameId}.kit is ${JSON.stringify(got)}, game.json says ${JSON.stringify(want)} (KC-26)`);
  }
  return {
    slug: m.slug, game: m.vaultGameId, genesis, weekMs,
    sundayFunRound: m.week.sundayFunRound, payoutRule: m.payoutRule, vaultValues: m.vaultValues,
    entry: { minRounds: m.entry.minRounds, minPoints: m.entry.minPoints }, minPts: m.minPts, rowCap: m.rowCap,
    liveWeek: m.liveWeek === true, roundsCorrectable: m.roundsCorrectable === true, budgets: m.budgets,
    maxRoundPoints: m.maxRoundPoints ?? 1000000,
    ...(m.inputsFile === true ? { inputsFile: true, inputsLeadMs: (m.inputsLeadHours ?? 48) * 3600000 } : {}),
    ...(m.vhpData === true ? { vhpData: true } : {}),
  };
}

/** The publish job's per-game config (what check.inline.mjs reads from KIT_GAMES). */
export function publishConfig(m: any, dep = readDeployment()) {
  const c = kitConfig(m, dep);
  return { slug: c.slug, game: c.game, genesis: c.genesis, weekMs: c.weekMs, sundayFunRound: c.sundayFunRound, payoutRule: c.payoutRule, vaultValues: c.vaultValues, entry: c.entry, minPts: c.minPts, rowCap: c.rowCap, maxRoundPoints: c.maxRoundPoints, liveWeek: c.liveWeek, roundsCorrectable: c.roundsCorrectable, ...(c.inputsFile ? { inputsFile: true } : {}), ...(c.vhpData ? { vhpData: true } : {}) };
}
