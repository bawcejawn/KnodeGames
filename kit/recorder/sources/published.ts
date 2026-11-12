// Source "published": another game's FINAL published week files (Block Golf's holes are other games' weekly boards).
// Only a week file that is in the kit's shape, in the recorders' exact bytes, and final is ever returned; a pending or
// unreadable one is "not yet" (never a guess). The folder is the other game's last-run copy the workflow fetched.
import fs from "node:fs";
import path from "node:path";
import { canon, pad3, weekShape } from "../../publish/check.inline.mjs";

export type PublishedWeek = { state: "final"; file: any } | { state: "not-yet"; why: string };

export function readPublishedFinal(dir: string, cfg: { game: number; genesis: number; weekMs?: number; sundayFunRound: boolean; inputsFile?: boolean }, week: number): PublishedWeek {
  const name = `W${pad3(week)}.json`, p = path.join(dir, name);
  if (!fs.existsSync(p)) return { state: "not-yet", why: `${name} is not published` };
  const raw = fs.readFileSync(p, "utf8");
  let j: any;
  try { j = JSON.parse(raw); } catch { return { state: "not-yet", why: `${name} is not JSON` }; }
  if (canon(j) !== raw) return { state: "not-yet", why: `${name} is not in the recorders' own form` };
  const why = weekShape(j, name, cfg);
  if (why) return { state: "not-yet", why: `${name}: ${why}` };
  if (j.state !== "final") return { state: "not-yet", why: `${name} is not final` };
  return { state: "final", file: j };
}

/** Every FINAL week file in another game's last-run folder, by week (ctx.published.games; Phase 1 item 6). A file that
 *  isn't a final kit week file is left out (never a guess). */
export function readPublishedFinals(dir: string, cfg: { game: number; genesis: number; weekMs?: number; sundayFunRound: boolean; inputsFile?: boolean }): Record<number, any> {
  const out: Record<number, any> = {};
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir).sort()) {
    const m = /^W([0-9]{3}|[1-9][0-9]{3})\.json$/.exec(f);
    if (!m) continue;
    const r = readPublishedFinal(dir, cfg, Number(m[1]));
    if (r.state === "final") out[Number(m[1])] = r.file;
  }
  return out;
}
