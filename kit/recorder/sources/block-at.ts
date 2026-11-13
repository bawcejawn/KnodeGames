// Shared Game Kit source (G7, Fantasy's UTC days): the first block whose time is at or after a UTC time (ms), on
// IRREVERSIBLE blocks only, so the answer never changes. The same binary search as the Race recorder's heightAt
// (bot/race.ts), with a downward doubling search for its lower bound. The kit runs it on both nodes, pinned to the lower
// of their last irreversible blocks, and requires the same height from both (#G-41 G41-4); every block read is charged
// to the run's budget and a failed read is a ReadFailed (G41-1, G41-2). A game gets it as ctx.blockAt(ms) in inputsFor
// and as part of resultOf's fourth argument (not in roundsFor, which is synchronous).
import { NotYet } from "../types.ts";
import type { KitNode } from "../nodes.ts";

/** Most block reads one search may take (a 30-day look-back needs about 2 × 20). */
export const MAX_READS = 80;
const STEP0 = 1200;

/** The first height h ≤ lib with time(h) ≥ ms. NotYet while the last irreversible block is still before ms. */
export async function blockAt(node: KitNode, ms: number, lib?: number, memo = new Map<number, number>()): Promise<number> {
  if (!Number.isSafeInteger(ms) || ms <= 0) throw new Error(`blockAt needs a time in ms, got ${ms}`);
  if (!node.blockTime) throw new Error(`${node.label} can't read block times (blockAt)`);
  const top = lib ?? (await node.head()).lib;
  let reads = 0;
  const t = async (h: number) => {
    const hit = memo.get(h);
    if (hit !== undefined) return hit;
    if (++reads > MAX_READS) throw new Error(`blockAt(${new Date(ms).toISOString()}): more than ${MAX_READS} block reads`);
    const v = await node.blockTime!(h);
    memo.set(h, v);
    return v;
  };
  if ((await t(top)) < ms) throw new NotYet(`not yet: the last irreversible block (${top}) is before ${new Date(ms).toISOString()}`);
  // lower bound: a height whose time is before ms (or 1), doubling down from the top
  let step = STEP0, lo = Math.max(1, top - step);
  while (lo > 1 && (await t(lo)) >= ms) { step *= 2; lo = Math.max(1, top - step); }
  if (lo === 1 && (await t(1)) >= ms) return 1;
  // invariant: t(lo) < ms ≤ t(hi)
  let hi = top;
  while (hi - lo > 1) {
    const m = Math.floor((lo + hi) / 2);
    if ((await t(m)) < ms) lo = m; else hi = m;
  }
  return hi;
}

/** ctx.blockAt for one node and one run: memoized by time, and every search pinned to the same irreversible block. */
export function blockAtFor(node: KitNode, lib: number) {
  const memo = new Map<number, number>(), done = new Map<number, Promise<number>>();
  return (ms: number): Promise<number> => {
    let p = done.get(ms);
    if (!p) { p = blockAt(node, ms, lib, memo); done.set(ms, p); }
    return p;
  };
}

/** The last block that can hold a pick for a TIME-locked Picks round (Block X chat, 12 Nov; picks/assembly/Picks.ts
 *  126–133: a pick is accepted only while its block's time < target − lead): the block just before the first block at or
 *  after the lock time. `lockMs` = target − lead, in ms. */
export async function lastPickBlock(blockAt: (ms: number) => Promise<number>, lockMs: number): Promise<number> {
  return (await blockAt(lockMs)) - 1;
}
