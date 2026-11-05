// Shared Game Kit: a game's settings, from its manifest (games/<slug>/game.json, schema tools/game-manifest.mjs)
// and the vault's clock from game-data/deployment.json. One schema; the publish job's config is rendered from these.
import fs from "node:fs";
import path from "node:path";
import { validateManifest } from "../../tools/game-manifest.mjs";
import type { KitGameCfg } from "./runtime.ts";

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");

export function readDeployment(root = ROOT): any {
  const p = path.join(root, "game-data/deployment.json");
  return JSON.parse(fs.readFileSync(fs.existsSync(p) ? p : path.join(ROOT, "game-data/deployment.json"), "utf8"));
}

/** The folder a game's files go in on its data branch ("games-data:questions/vault" → branch games-data, folder questions). */
export function dataFolder(m: any): { branch: string; folder: string } {
  const r = /^([a-z0-9-]+):([a-z0-9-]+)\/vault$/.exec(String(m.data?.vaultFolder ?? ""));
  if (!r) throw new Error(`${m.slug}: data.vaultFolder must be "<branch>:<folder>/vault"`);
  if (m.data.board !== `${r[1]}:${r[2]}/board.json`) throw new Error(`${m.slug}: data.board must be "${r[1]}:${r[2]}/board.json" (next to its vault folder)`);
  if (r[2] !== m.slug) throw new Error(`${m.slug}: the data folder must be named after the slug`);
  return { branch: r[1], folder: r[2] };
}

export function loadManifest(slug: string, root = ROOT): any {
  const m = JSON.parse(fs.readFileSync(path.join(root, "games", slug, "game.json"), "utf8"));
  const probs = validateManifest(m, { kit: true });
  if (probs.length) throw new Error(`games/${slug}/game.json: ${probs.join("; ")}`);
  if (m.slug !== slug) throw new Error(`games/${slug}/game.json has slug "${m.slug}"`);
  return m;
}

/** The kit's config for one game. */
export function kitConfig(m: any, dep = readDeployment()): KitGameCfg {
  dataFolder(m);
  const genesis = Number(dep.genesisTime), weekMs = Number(dep.weekLength);
  if (!(genesis > 0 && weekMs > 0)) throw new Error("game-data/deployment.json has no genesisTime / weekLength");
  const vg = dep.vaultGames?.[String(m.vaultGameId)];
  // vaultGames.<id> is the Vault chat's (game 1's lands with v6.1, PR #114). When it's there it must agree.
  if (vg && vg.results !== m.data.vaultFolder) throw new Error(`vaultGames.${m.vaultGameId}.results is "${vg.results}", game.json says "${m.data.vaultFolder}"`);
  if (vg && Number(vg.minPts ?? 0) !== m.minPts) throw new Error(`vaultGames.${m.vaultGameId}.minPts (${vg.minPts ?? 0}) isn't game.json's minPts (${m.minPts})`);
  return {
    slug: m.slug, game: m.vaultGameId, genesis, weekMs,
    sundayFunRound: m.week.sundayFunRound, payoutRule: m.payoutRule, vaultValues: m.vaultValues,
    entry: { minRounds: m.entry.minRounds, minPoints: m.entry.minPoints }, minPts: m.minPts, rowCap: m.rowCap,
    liveWeek: m.liveWeek === true, roundsCorrectable: m.roundsCorrectable === true, budgets: m.budgets,
  };
}

/** The publish job's per-game config (what check.inline.mjs reads from KIT_GAMES). */
export function publishConfig(m: any, dep = readDeployment()) {
  const c = kitConfig(m, dep);
  return { slug: c.slug, game: c.game, genesis: c.genesis, weekMs: c.weekMs, sundayFunRound: c.sundayFunRound, payoutRule: c.payoutRule, vaultValues: c.vaultValues, entry: c.entry, liveWeek: c.liveWeek, roundsCorrectable: c.roundsCorrectable };
}
