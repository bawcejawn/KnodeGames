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

export class Replay {
  readonly root: string;
  readonly pub: string;
  constructor(readonly m: GameModule<any, any, any>, readonly cfg: KitGameCfg, root?: string) {
    this.root = root ?? fs.mkdtempSync(path.join(os.tmpdir(), "kit-replay-"));
    this.pub = path.join(this.root, "pub");
    fs.mkdirSync(path.join(this.pub, "vault"), { recursive: true });
  }
  /** One hour: the recorder on these nodes, then the publish check at the job's clock `jobNow`. */
  async hour(nodes: [KitNode, KitNode], jobNow: number, env: { holdWeeks?: string; release?: string } = {}): Promise<Hour> {
    const prev = fs.mkdtempSync(path.join(this.root, "prev-"));
    fs.cpSync(this.pub, prev, { recursive: true });
    fs.writeFileSync(path.join(prev, ".fetched"), "");
    const out = fs.mkdtempSync(path.join(this.root, "out-"));
    let result: RunResult | undefined, error: string | undefined;
    try { result = await runGame(this.m, this.cfg, { nodes, prev, out, ...env, log: () => {} }); }
    catch (e) { error = (e as Error).message; fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out); }
    const r = checkGame(this.cfg, out, this.pub, jobNow);
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
