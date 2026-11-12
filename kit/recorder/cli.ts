// Shared Game Kit: run one game's recorder (games.yml calls this once per kit game, every hour).
//   npm run kit -- <slug>        RPC, RPC_CHECK, KIT_PREV (last run's files), KIT_OUT, <SLUG>_HOLD_WEEKS, <SLUG>_RELEASE
// Read-only on the chain; holds no key; writes files only to KIT_OUT. Exit 1 after writing when anything needs the
// owner (so the workflow's alert step emails them), exit 2 on a stop (nothing written).
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { koinosNode, abiHasConfigField } from "./nodes.ts";
import { kitConfig, loadManifest, readDeployment } from "./manifest.ts";
import { runGame } from "./runtime.ts";
import { print } from "./alerts.ts";

export async function main(argv = process.argv.slice(2), env = process.env): Promise<number> {
  const slug = argv[0];
  if (!slug || !/^[a-z][a-z0-9-]{1,23}$/.test(slug)) { console.error("Usage: npm run kit -- <slug>"); return 2; }
  const out = env.KIT_OUT || `${slug}-out`;
  const clear = () => { fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true }); };
  // Everything, the manifest and the module import included, is inside the try: a throw anywhere is a stop (exit 2,
  // nothing written), never exit 1's "needs the owner; files were published" (#B-12 NK-14).
  try {
    const m = loadManifest(slug);
    const dep = readDeployment();
    const cfg = kitConfig(m, dep);
    const rpc = env.RPC || dep.rpc, check = env.RPC_CHECK;
    if (!check || check === rpc) { console.error("::error::two different nodes are required (RPC and RPC_CHECK): RECORDER §2.1"); clear(); return 2; }
    const ids = { vault: dep.contract, picks: dep.sponsor?.picks, racepicks: dep.sponsor?.race };
    const nodes = [await koinosNode("rpc", rpc, ids), await koinosNode("rpc_check", check, ids)] as const;
    // A field the vault ABI doesn't know is silently dropped by the decoder: game 1's rule week would read as "not set"
    // and the recorder would quietly record nothing. Fail loudly instead until the v6.1 ABI is in (PR #114).
    if (m.picks?.contract === "vault" && !abiHasConfigField("q60_rule_week_plus_one")) { console.error("::error::game/abi/kpred.koilib.json predates v6.1 (no q60_rule_week_plus_one): the vault-answers source can't tell a shared-rules week. Update the ABI (PR #114) first."); clear(); return 2; }
    const { game } = await import(new URL(`../../games/${slug}/recorder.ts`, import.meta.url).href);
    const up = slug.toUpperCase().replace(/-/g, "_");
    const prev = env.KIT_PREV || `${slug}-prev`;
    fs.mkdirSync(out, { recursive: true });
    // Other kit games this one reads (manifest `published`): their last-run folders, fetched by the workflow.
    const published: Record<string, { dir: string; cfg: any }> = {};
    for (const other of (m.published ?? []) as string[]) {
      const oc = kitConfig(loadManifest(other), dep);
      published[other] = { dir: env[`KIT_PUBLISHED_${other.toUpperCase().replace(/-/g, "_")}`] || `${other}-published`, cfg: { game: oc.game, genesis: oc.genesis, weekMs: oc.weekMs, sundayFunRound: oc.sundayFunRound, inputsFile: oc.inputsFile } };
    }
    const rv = (env[`${up}_RESET_FROM_WEEK`] ?? "").trim();
    if (rv && !/^(0|[1-9][0-9]{0,3})$/.test(rv)) throw new Error(`${up}_RESET_FROM_WEEK must be a week number`);
    const r = await runGame(game, cfg, { nodes: [nodes[0], nodes[1]], prev, out, holdWeeks: env[`${up}_HOLD_WEEKS`], release: env[`${up}_RELEASE`], wallNow: Date.now, published, resetFromWeek: rv ? Number(rv) : undefined, vhpDir: env.KIT_VHP_DATA || undefined });
    print(r.alerts, slug);
    console.log(`done: ${r.state}; wrote ${r.written.length} file(s)`);
    return r.alerts.errors.length ? 1 : 0;
  } catch (e) {
    console.log(`::error::${slug}: ${(e as Error)?.message ?? e}. Nothing recorded this run; the next run tries again.`);
    clear();
    return 2;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) process.exit(await main());
