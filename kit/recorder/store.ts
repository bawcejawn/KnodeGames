// Shared Game Kit: the files (RECORDER §3.3–3.4, §4.7, §6.7).
// Last run's files come from the data branch the workflow fetched. A run that couldn't see them must not write
// (it could rewrite a published week): the workflow marks a good fetch with `.fetched`. A file that is there but
// can't be read stops the run; it's never treated as "nothing yet".
import fs from "node:fs";
import path from "node:path";
import { canon, pad3, weekShape } from "../publish/check.inline.mjs";

export const MAX_WRITE_BYTES = 1_900_000;   // under the publish job's 2 MB cap
export const FETCHED_MARK = ".fetched";

export type GameCfg = { game: number; genesis: number; weekMs?: number; sundayFunRound: boolean; maxRoundPoints?: number; inputsFile?: boolean };

export class Prev {
  private constructor(readonly dir: string, private readonly files: Map<string, any>) {}

  /** The last run's files for one game. Throws if the fetch mark is missing or a present file can't be read. */
  static load(dir: string, cfg: GameCfg): Prev {
    if (!fs.existsSync(path.join(dir, FETCHED_MARK))) throw new Error(`${dir}/${FETCHED_MARK} is missing: the last run's files weren't fetched, refusing to write (it could rewrite a published week)`);
    const files = new Map<string, any>();
    const take = (rel: string) => {
      const raw = fs.readFileSync(path.join(dir, rel), "utf8");
      let v: any;
      try { v = JSON.parse(raw); } catch { throw new Error(`last run's ${rel} can't be read: refusing to write`); }
      if (canon(v) !== raw) throw new Error(`last run's ${rel} isn't in the recorders' own form: refusing to write`);
      if (/^W[0-9]{3,4}\.json$/.test(rel)) {
        const why = weekShape(v, rel, cfg);
        if (why) throw new Error(`last run's ${rel} isn't a kit week file (${why}): refusing to write`);
      }
      files.set(rel, v);
    };
    for (const f of fs.readdirSync(dir).sort()) if (/^(board|alltime|W([0-9]{3}|[1-9][0-9]{3}))\.json$/.test(f)) take(f);
    const vd = path.join(dir, "vault");
    if (fs.existsSync(vd)) for (const f of fs.readdirSync(vd).sort()) if (/^(HOLD-|RELEASE-)?W(0|[1-9][0-9]{0,3})\.json$/.test(f)) take(`vault/${f}`);
    const id = path.join(dir, "inputs");
    if (fs.existsSync(id)) for (const f of fs.readdirSync(id).sort()) if (/^W(0|[1-9][0-9]{0,3})\.json$/.test(f)) take(`inputs/${f}`);
    return new Prev(dir, files);
  }

  week(w: number): any | null { return this.files.get(`W${pad3(w)}.json`) ?? null; }
  vault(w: number): any | null { return this.files.get(`vault/W${w}.json`) ?? null; }
  holdFile(w: number): any | null { return this.files.get(`vault/HOLD-W${w}.json`) ?? null; }
  releaseFile(w: number): any | null { return this.files.get(`vault/RELEASE-W${w}.json`) ?? null; }
  board(): any | null { return this.files.get("board.json") ?? null; }
  /** The week's published inputs file (FC-9), parsed. */
  inputs(w: number): any | null { return this.files.get(`inputs/W${w}.json`) ?? null; }
  alltime(): any | null { return this.files.get("alltime.json") ?? null; }
  /** Every published final week file, in week order. */
  finals(): any[] {
    return [...this.files.entries()].filter(([k, v]) => /^W[0-9]{3,4}\.json$/.test(k) && v.state === "final").map(([, v]) => v).sort((a, b) => a.week - b.week);
  }
  names(): string[] { return [...this.files.keys()]; }
}

/** Writes one game's files for this run, in the recorders' own form, under the size cap. */
export class Out {
  readonly written: string[] = [];
  constructor(readonly dir: string) { fs.mkdirSync(path.join(dir, "vault"), { recursive: true }); }
  write(rel: string, v: unknown) {
    if (!/^(board\.json|alltime\.json|W([0-9]{3}|[1-9][0-9]{3})\.json|vault\/(HOLD-|RELEASE-)?W(0|[1-9][0-9]{0,3})\.json|inputs\/W(0|[1-9][0-9]{0,3})\.json)$/.test(rel)) throw new Error(`the kit never writes ${rel}`);
    if (rel.startsWith("inputs/")) fs.mkdirSync(path.join(this.dir, "inputs"), { recursive: true });
    const s = canon(v);
    if (Buffer.byteLength(s) > MAX_WRITE_BYTES) throw new Error(`${rel} would be over ${MAX_WRITE_BYTES} bytes: stopping (RECORDER §6.7)`);
    fs.writeFileSync(path.join(this.dir, rel), s);
    this.written.push(rel);
  }
  /** Copy a write-once file forward byte for byte. */
  copy(rel: string, v: unknown) { this.write(rel, v); }
}
