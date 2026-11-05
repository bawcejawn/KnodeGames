// Shared Game Kit: the vault's results file (VAULT §6; D-082): vault/W<week>.json, written once, only for a final week,
// only inside the vault's 3-day window; `first` / `second` always filled from the Free board (never a staked wallet).
import { tally, vaultFileOf } from "../publish/check.inline.mjs";
import type { VaultFile } from "./types.ts";

export function vaultFileFor(j: any, cfg: any, now: number, due: number): VaultFile | null {
  if (j.state !== "final") return null;
  if (now < j.end || now >= due) return null;
  const f = vaultFileOf(j, tally(j, cfg)) as VaultFile;
  const staked = new Set(f.rows.map((r) => r.player));
  if ([...f.first, ...f.second].some((a) => staked.has(a))) throw new Error(`week ${j.week}: a staked wallet among the free winners`);
  return f;
}
