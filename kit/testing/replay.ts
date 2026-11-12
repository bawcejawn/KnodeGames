// Shared Game Kit testing: run hour after hour as the workflow would — the recorder reads the PUBLISHED folder as its
// last run, writes its files, the publish check (the same file the workflow inlines) judges them with the job's own
// clock, and only what it lists is published (write-once files never replaced). Also used to replay a game's history.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkGame } from "../publish/check.inline.mjs";
import { runGame, type KitGameCfg, type RunResult } from "../recorder/runtime.ts";
import type { KitNode } from "../recorder/nodes.ts";
import type { GameModule } from "../recorder/types.ts";

export type Hour = { result?: RunResult; error?: string; published: string[]; held: { name: string; why: string; alert: boolean }[] };

/** The JS twin of the publish job's card rebuild (render.mjs KIT_CARDS_PY): every card listed in a new W / inputs file,
 *  rebuilt from the ledger; the sha256 values that match. */
export async function rebuiltCards(out: string, pub: string, L: any): Promise<Set<string>> {
  const { vhpFor } = await import("../recorder/sources/vhp-ruler.ts");
  const { cardKey } = await import("../publish/check.inline.mjs");
  const ok = new Set<string>();
  const rels = [...(fs.existsSync(out) ? fs.readdirSync(out) : []).filter((f) => /^W[0-9]{3,4}\.json$/.test(f)),
    ...(fs.existsSync(path.join(out, "inputs")) ? fs.readdirSync(path.join(out, "inputs")).map((f) => `inputs/${f}`) : [])];
  for (const rel of rels) {
    const raw = fs.readFileSync(path.join(out, rel), "utf8"), q = path.join(pub, rel);
    if (fs.existsSync(q) && fs.readFileSync(q, "utf8") === raw) continue;
    for (const [s, h] of JSON.parse(raw).cards ?? []) {
      const used = new Map();
      try { vhpFor(L, used).card(s); } catch { continue; }
      if (used.has(h)) ok.add(cardKey(s, h));      // #G-24 G24-1: the pair, never the sha256 alone
    }
  }
  return ok;
}

export class Replay {
  readonly root: string;
  readonly pub: string;
  constructor(readonly m: GameModule<any, any, any>, readonly cfg: KitGameCfg, root?: string) {
    this.root = root ?? fs.mkdtempSync(path.join(os.tmpdir(), "kit-replay-"));
    this.pub = path.join(this.root, "pub");
    fs.mkdirSync(path.join(this.pub, "vault"), { recursive: true });
  }
  /** One hour: the recorder on these nodes, then the publish check at the job's clock `jobNow`. */
  async hour(nodes: [KitNode, KitNode], jobNow: number, env: { holdWeeks?: string; release?: string; vhpLedger?: any; cardsOk?: Set<string> | null } = {}): Promise<Hour> {
    const prev = fs.mkdtempSync(path.join(this.root, "prev-"));
    fs.cpSync(this.pub, prev, { recursive: true });
    fs.writeFileSync(path.join(prev, ".fetched"), "");
    const out = fs.mkdtempSync(path.join(this.root, "out-"));
    let result: RunResult | undefined, error: string | undefined;
    try { const { cardsOk: _c, ...run } = env; result = await runGame(this.m, this.cfg, { nodes, prev, out, ...run, log: () => {} }); }
    catch (e) { error = (e as Error).message; fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out); }
    // G3: the publish job rebuilds every new ruler card (its embedded vhp_ruler.py); here its JS twin on the same ledger.
    const cardsOk = "cardsOk" in env ? env.cardsOk ?? null : this.cfg.vhpData && env.vhpLedger ? await rebuiltCards(out, this.pub, env.vhpLedger) : null;
    // The publish job reads the owner's release variable itself (KC-3): the same value the recorder got.
    const r = checkGame(this.cfg, out, this.pub, jobNow, env.release ?? "", cardsOk);
    for (const f of r.publish) {
      const to = path.join(this.pub, f);
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(path.join(out, f), to);
    }
    return { result, error, published: r.publish, held: r.held };
  }
  read(rel: string): any { const p = path.join(this.pub, rel); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null; }
  raw(rel: string): string | null { const p = path.join(this.pub, rel); return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null; }
}
