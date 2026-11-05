// Source helper "vault-stakes": a game's stakes for a week, from the vault's own rule (RECORDER §2.4–2.5).
// Ported from Block X's vaultReader (bot/games/blockx.ts, audits BX-61, BX-63, BX-82): get_state once (an answer
// without the owner is no answer), the v6 rule gate (v6_rule_week_plus_one), then get_game_player per wallet for THIS
// game and week: week_stake (what counts, 0 = voided or none) and the peak. Read only after the week has ended.
// Game 1 (Daily Questions) does not use this: its stakes come with its answers (vault-answers, the contract's qEntry).
import { clockFromState } from "../clock.ts";
import { pool } from "../nodes.ts";
import type { NodeReader, StakeView } from "../types.ts";

export const READS_AT_ONCE = 8;

export type StakesRead = { live: boolean; min: string; stakes: Map<string, StakeView> };

export async function readVaultStakes(node: NodeReader, game: number, wallets: string[], week: number, now: number): Promise<StakesRead> {
  if (game === 1) throw new Error("game 1's stakes come from its answers (vault-answers), not get_game_player");
  const st = await node.read("get_state", {});
  if (!st?.config?.owner) throw new Error("no answer reading the vault's state (no owner in it)");
  const { clock, minFor, config } = clockFromState(st);
  if (now < clock.span(week).end) throw new Error(`stakes for week ${week} are read only after the week has ended (RECORDER §2.5)`);
  const live = Number(config.v6_rule_week_plus_one ?? 0) > 0;
  const stakes = new Map<string, StakeView>();
  let min = minFor(week);
  if (!live) return { live, min: String(min), stakes };
  if (min <= 0n) min = 100000000n;
  const got = await pool([...new Set(wallets)].sort(), READS_AT_ONCE, async (a) => {
    const r = await node.read("get_game_player", { player: a, game, week: String(week) });
    const e = r?.entry;
    const act = BigInt(r?.active_stake ?? "0");
    const peak = e ? [BigInt(e.peak_stake ?? "0"), BigInt(e.stake ?? "0")].reduce((x, y) => (y > x ? y : x)) : act;
    const ws = BigInt(r?.week_stake ?? "0");
    return [a, { stake: String(ws), peak: String(peak), voided: !!e?.voided }] as [string, StakeView];
  });
  for (const [a, v] of got) stakes.set(a, v);
  return { live, min: String(min), stakes };
}
