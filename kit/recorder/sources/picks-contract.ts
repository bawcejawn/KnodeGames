// Source "picks-contract": picks from the Picks contract 1LmgqB… (Block X, Fantasy, Bracket; later Survivor, Combo,
// Last Node). Ported from Block X's readPicks (bot/games/blockx.ts): list_picks 100 a page, keep going until an EMPTY
// page (audit BX-18: never assume the contract's page size), a runaway listing stops. Picks are passed through as the
// contract returns them; the game's module reads its own pick shape.
import { isAddr } from "../../publish/check.inline.mjs";
import type { NodeReader, Pick } from "../types.ts";

export const PAGE = 100;
export const MAX_PAGES = 1000;

export type RawPick = { producers?: string[]; time?: string | number; [k: string]: unknown };

export async function readPicksContract(node: NodeReader, game: number, round: number): Promise<Pick<RawPick>[]> {
  const out: Pick<RawPick>[] = [];
  const seen = new Set<string>();
  let after: string | undefined;
  for (let page = 0; ; page++) {
    if (page >= MAX_PAGES) throw new Error(`picks for game ${game} round ${round}: more than ${MAX_PAGES} pages: stopping`);
    const r = await node.read("list_picks", { game, round: String(round), ...(after ? { start_after: after } : {}), limit: PAGE });
    const rows = r?.rows ?? [];
    if (!Array.isArray(rows)) throw new Error("list_picks gave no rows list");
    if (!rows.length) break;
    for (const x of rows) {
      if (!isAddr(x?.player)) throw new Error("list_picks gave a row without a player address");
      if (seen.has(x.player)) throw new Error(`list_picks repeated ${x.player}: stopping`);
      seen.add(x.player);
      out.push({ wallet: x.player, round: String(round), pick: x.pick ?? {}, at: Number(x.pick?.time ?? 0) });
    }
    after = rows[rows.length - 1].player;
  }
  return out.sort((a, b) => (a.wallet < b.wallet ? -1 : 1));
}
