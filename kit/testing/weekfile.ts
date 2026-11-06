// Shared Game Kit testing: build a week file (kit format v2) from rows written by wallet address, the way a test reads
// best: rounds [[id, day, fun, status, [[wallet, points, at], …]], …], players [[wallet, stake, peak, voided], …].
import { weekHash } from "../publish/check.inline.mjs";

export type AddrRound = [string, number, 0 | 1, "s" | "v" | "p", [string, number, number?][]];
export type Player = [string, string, string, 0 | 1];

export function makeWeek(o: { game: number; week: number; start: number; end: number; min?: string; state: "open" | "pending" | "final"; seenAt: number; rounds: AddrRound[]; players: Player[] }): any {
  const players = o.players.slice().sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const idx = new Map(players.map((p, i) => [p[0], i]));
  const rounds = o.rounds.slice().sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([id, day, fun, st, rows]) => [id, day, fun, st,
    rows.map(([a, p, at]) => { if (!idx.has(a)) throw new Error(`${a} is not a player`); const pts = st === "s" ? p : 0; return pts > 0 ? [idx.get(a), pts, at && at > 0 ? at : day + 1] : [idx.get(a), 0]; })
      .sort((x, y) => x[0] - y[0])]);
  const j: any = { v: 2, game: o.game, week: o.week, start: o.start, end: o.end, min: o.min ?? "100000000", state: o.state, seen: { hash: "", at: o.seenAt }, rounds, players };
  j.seen.hash = weekHash(j);
  return j;
}

/** Re-hash after editing a week file in place. */
export const rehash = (j: any) => { j.seen.hash = weekHash(j); return j; };
