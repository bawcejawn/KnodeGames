// Shared Game Kit: two-node reads (RECORDER §2.1–2.3, §2.6).
// Every value that decides a result is read on BOTH nodes and must agree. A failed read stops the step: it is never
// "zero" or "not staked". Reads are bounded per run (budgets) and retried only on network errors.
// Read-only by construction: nothing here holds a key, signs or sends.
import fs from "node:fs";
import { canon } from "../publish/check.inline.mjs";
import type { NodeReader } from "./types.ts";

/** A node as the kit sees it: the vault, other contracts by name, and the head. */
export interface KitNode {
  readonly label: string;
  /** Reads on the vault contract. */
  readonly vault: NodeReader;
  /** Reads on another contract ("picks", "racepicks"). */
  contract(name: "picks" | "racepicks"): NodeReader;
  /** Head height, last irreversible block, and the head block's time (ms). */
  head(): Promise<{ height: number; lib: number; time: number }>;
}

export class ReadFailed extends Error {
  constructor(readonly node: string, readonly what: string, cause: unknown) {
    super(`${node}: ${what}: ${(cause as Error)?.message ?? String(cause)}`);
  }
}
export class Disagree extends Error {
  constructor(readonly what: string, readonly a: unknown, readonly b: unknown) {
    super(`the two nodes disagree on ${what}`);
  }
}
export class OutOfBudget extends Error {
  constructor(readonly what: string) { super(`read budget used up (${what}); the next run continues`); }
}

/** Read budgets (game.json `budgets` overrides). Block X's REVERIFY limits are the defaults (BX-63, B3-2, L-1). */
export type Budgets = { reads: number; ms: number; atOnce: number; tries: number };
export const DEFAULT_BUDGETS: Budgets = { reads: 40000, ms: 22 * 60000, atOnce: 8, tries: 4 };

/** Counts reads and time against a budget; throws OutOfBudget before a read once either is used up. */
export class Budget {
  private n = 0;
  private readonly t0: number;
  constructor(readonly b: Budgets = DEFAULT_BUDGETS, private readonly clock: () => number = Date.now) { this.t0 = clock(); }
  take(what: string) {
    if (++this.n > this.b.reads) throw new OutOfBudget(`${what}: more than ${this.b.reads} reads`);
    if (this.clock() - this.t0 > this.b.ms) throw new OutOfBudget(`${what}: over ${Math.round(this.b.ms / 60000)} min`);
  }
  get used() { return this.n; }
}

/** A reader that charges every read to the budget and wraps failures as ReadFailed (never a value). */
export function budgeted(r: NodeReader, budget: Budget): NodeReader {
  return {
    label: r.label,
    async read(method: string, args?: unknown) {
      budget.take(`${r.label} ${method}`);
      try {
        const v = await r.read(method, args);
        if (v === undefined || v === null) throw new Error("no answer");
        return v;
      } catch (e) {
        if (e instanceof OutOfBudget || e instanceof ReadFailed) throw e;
        throw new ReadFailed(r.label, method, e);
      }
    },
  };
}

/** Canonical equality (the default `same`). */
export const sameJson = (a: unknown, b: unknown) => canon(toJson(a)) === canon(toJson(b));
/** Maps, Sets and BigInts in a stable JSON form (maps by sorted key). */
export function toJson(v: unknown): unknown {
  if (typeof v === "bigint") return v.toString();
  if (v instanceof Map) return [...v.entries()].map(([k, x]) => [toJson(k), toJson(x)]).sort((p, q) => (JSON.stringify(p[0]) < JSON.stringify(q[0]) ? -1 : 1));
  if (v instanceof Set) return [...v].map(toJson).sort();
  if (Array.isArray(v)) return v.map(toJson);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map((k) => [k, toJson((v as any)[k])]));
  return v;
}

/** Read the same thing on both nodes; the answer only if they agree (RECORDER §2.1). */
export async function agree<T>(what: string, a: () => Promise<T>, b: () => Promise<T>, same: (x: T, y: T) => boolean = sameJson): Promise<T> {
  const [x, y] = await Promise.all([a(), b()]);
  if (!same(x, y)) throw new Disagree(what, x, y);
  return x;
}

/** Runs fn over items, at most `limit` at a time. */
export async function pool<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i]); } };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return out;
}

// ───────────────────────── a real node (koilib, read-only) ─────────────────────────
const NETWORK = /fetch failed|ECONN|ETIMEDOUT|EAI_AGAIN|socket|network|50[234]|429|timeout|no answer within/i;

/** Retries network errors only (a contract's refusal would be refused again), with a per-call time limit. */
export async function withRetries<T>(label: string, fn: () => Promise<T>, tries: number, timeoutMs = 30000, sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))): Promise<T> {
  for (let i = 1; ; i++) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const limit = new Promise<never>((_, rej) => { timer = setTimeout(() => rej(new Error(`no answer within ${timeoutMs / 1000} s`)), timeoutMs); });
      return await Promise.race([fn(), limit]);
    } catch (e) {
      const msg = (e as Error)?.message ?? String(e);
      if (!NETWORK.test(msg) || i >= tries) throw new Error(`${label}: ${msg}`);
      await sleep(1000 * 2 ** i);
    } finally { clearTimeout(timer); }
  }
}

const ROOT = new URL("../../", import.meta.url);
const abiOf = (rel: string) => JSON.parse(fs.readFileSync(new URL(rel, ROOT), "utf8"));
export const ABI_FILES = { vault: "game/abi/kpred.koilib.json", picks: "picks/abi/picks.koilib.json", racepicks: "race/abi/race.koilib.json" } as const;

/** A read-only mainnet/testnet node. `ids`: the contracts by name (from game-data/deployment.json). */
export async function koinosNode(label: string, rpc: string, ids: { vault: string; picks?: string; racepicks?: string }, tries = DEFAULT_BUDGETS.tries): Promise<KitNode> {
  const { Provider, Contract } = await import("koilib");
  const provider = new Provider([rpc]);
  const reader = (name: keyof typeof ABI_FILES, id: string | undefined): NodeReader => {
    if (!id) throw new Error(`no ${name} contract id in game-data/deployment.json`);
    const c = new Contract({ id, abi: abiOf(ABI_FILES[name]), provider });
    return {
      label: `${label}/${name}`,
      async read(method: string, args: unknown = {}) {
        const fn = (c.functions as any)[method];
        if (typeof fn !== "function") throw new Error(`the ${name} ABI has no ${method}`);
        const r: any = await withRetries(`${label} ${name}.${method}`, () => fn(args), tries);
        if (!r || !("result" in r)) throw new Error("no answer");
        return r.result ?? {};
      },
    };
  };
  const vault = reader("vault", ids.vault);
  return {
    label, vault,
    contract: (name) => reader(name, ids[name]),
    async head() {
      const h: any = await withRetries(`${label} head`, () => provider.getHeadInfo(), tries);
      return { height: Number(h.head_topology?.height ?? 0), lib: Number(h.last_irreversible_block ?? 0), time: Number(h.head_block_time ?? 0) };
    },
  };
}

/** True when the vault ABI file can decode a config field (a field the ABI doesn't know is silently dropped). */
export function abiHasConfigField(field: string): boolean {
  return fs.readFileSync(new URL(ABI_FILES.vault, ROOT), "utf8").includes(`"${field}"`);
}
