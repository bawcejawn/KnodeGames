// Source "race-picks": picks from the Race picks contract 1EN7xU… (Producer Race, game 7). Ported from bot/race.ts
// readPicks: list_picks by race number, 100 a page until an empty page; a repeated wallet or a runaway listing stops.
import { isAddr } from "../../publish/check.inline.mjs";
import type { NodeReader, Pick } from "../types.ts";

export const PAGE = 100;
export const MAX_PAGES = 1000;

export async function readRacePicks(node: NodeReader, race: number): Promise<Pick<Record<string, unknown>>[]> {
  const out: Pick<Record<string, unknown>>[] = [];
  const seen = new Set<string>();
  let after: string | undefined;
  for (let page = 0; ; page++) {
    if (page >= MAX_PAGES) throw new Error(`picks for race ${race}: more than ${MAX_PAGES} pages: stopping`);
    const r = await node.read("list_picks", { race: String(race), ...(after ? { start_after: after } : {}), limit: PAGE });
    const rows = r?.rows ?? [];
    if (!Array.isArray(rows)) throw new Error("list_picks gave no rows list");
    if (!rows.length) break;
    for (const x of rows) {
      if (!isAddr(x?.player)) throw new Error("list_picks gave a row without a player address");
      if (seen.has(x.player)) throw new Error(`list_picks repeated ${x.player}: stopping`);
      seen.add(x.player);
      out.push({ wallet: x.player, round: String(race), pick: x.pick ?? {}, at: Number(x.pick?.time ?? 0) });
    }
    after = rows[rows.length - 1].player;
  }
  return out.sort((a, b) => (a.wallet < b.wallet ? -1 : 1));
}
