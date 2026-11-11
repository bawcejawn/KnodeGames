// Shared Game Kit testing: two scriptable nodes (design §F). Each serves a "world" (the vault's state, questions and
// players) and can be told to fail a method, lag, or answer differently, so every two-node rule can be tested.
import type { KitNode } from "../recorder/nodes.ts";
import type { NodeReader } from "../recorder/types.ts";
import { GENESIS, WEEK } from "./fake-clock.ts";

export type World = {
  time: number;
  config: Record<string, string>;
  next: number;
  questions: Record<number, { week: string; outcome: number; lock_time: string }>;
  players: { address: string; entry: { stake: string; peak_stake: string; voided: boolean; answers: { question_id: number; option: number }[] } }[];
  lib?: number;
  /** The vault's game registrations (FC-26). Missing: every game is registered and earns from week 0. */
  games?: Record<number, { from_week: number; last_week_plus_one?: number; closed?: number[] } | null>;
};

export type Faults = {
  /** Throw on these methods ("get_state", "list_players", …). */
  fail?: Set<string> | string[];
  /** Change an answer before it's returned. */
  tweak?: (method: string, args: any, result: any) => any;
  /** Report this much less chain time (a lagging node). */
  lagMs?: number;
  /** Count reads here. */
  calls?: string[];
};

export function world(time: number, extra: Partial<World> = {}): World {
  return {
    time, next: 1, questions: {}, players: [],
    config: { owner: "1Owner1111111111111111111111111111", genesis_time: String(GENESIS), week_length: String(WEEK), min_stake: "100000000", q60_rule_week_plus_one: "5", v6_rule_week_plus_one: "3" },
    ...extra,
  };
}

/** One fake node serving `w` (read live, so a test can change the world between runs). */
export function fakeNode(label: string, w: () => World, f: Faults = {}): KitNode {
  const fails = new Set(f.fail ?? []);
  const vault: NodeReader = {
    label: `${label}/vault`,
    async read(method: string, args: any = {}) {
      f.calls?.push(`${label}:${method}`);
      if (fails.has(method)) throw new Error(`${label}: node down (${method})`);
      const wd = w();
      let r: any;
      if (method === "get_state") r = { time: String(wd.time - (f.lagMs ?? 0)), config: { ...wd.config }, totals: { next_question_id: wd.next } };
      else if (method === "get_question") r = wd.questions[args.id] ? { question: { ...wd.questions[args.id] } } : {};
      else if (method === "list_players") {
        const xs = [...wd.players].sort((u, v) => (u.address < v.address ? -1 : 1));
        const i = args.start ? xs.findIndex((x) => x.address === args.start) + 1 : 0;
        r = { rows: structuredClone(xs.slice(i, i + (args.limit ?? 50))) };
      } else if (method === "get_game") {
        const g = wd.games ? wd.games[args.game] : { from_week: 0 };
        r = g ? { game: { id: args.game, from_week: g.from_week, last_week_plus_one: g.last_week_plus_one ?? 0 }, week: { closed: (g.closed ?? []).includes(Number(args.week)) } } : {};
      } else throw new Error(`fake node: unexpected read ${method}`);
      return f.tweak ? f.tweak(method, args, structuredClone(r)) : r;
    },
  };
  return {
    label, vault,
    contract: () => { throw new Error("fake node: no other contracts"); },
    async head() { const wd = w(); return { height: wd.lib ?? 1000, lib: wd.lib ?? 1000, time: wd.time - (f.lagMs ?? 0) }; },
  };
}

/** Deterministic random numbers for property tests (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
