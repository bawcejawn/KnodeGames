/**
 * Producer key backups (R-VAULT-10): shows the PUBLIC key of each backed-up block-producer key and checks it against
 * the key registered on chain (Proof-of-Burn) and in the records. Read-only: nothing is sent, and a private key is
 * never printed (only the public key, which is safe to share).
 *
 *   npx tsx tools/producer-keys.ts <backup folder>     the folder node\backup-producer-keys.ps1 wrote
 *                                                       (game\private.key, desk\private.key, personal\private.key)
 *   npx tsx tools/producer-keys.ts --file <key file>   one key file: its public key only (no chain read)
 *   npx tsx tools/producer-keys.ts --restore-check <key file> <producer>
 *                                                       before a restore (node\setup-node.ps1 -RestoreKey): exit 0 if the
 *                                                       key is the one registered for <producer>, 1 if not, 2 if unreadable
 *
 * The node: $env:RPC if set, else https://koinos.armana.io (mainnet only; the chain id is checked).
 * The personal producer: $env:PERSONAL_PRODUCER if set, else the owner's address in KEYS_AND_ROLES.md.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Provider, Signer, Contract } from "koilib";
import { pobAbi } from "../bot/token-abi.ts";

const MAINNET_CHAIN_ID = "EiBZK_GGVP0H_fXVAM3j6EAuz3-B-l3ejxRSewi7qIBfSA==";
const MAINNET_POB = "159myq5YUhhoVWu3wsHKHiJYKPKGUrGiyv";
const PERSONAL = "1DAHmrQJMAbn4FmMMrew78wPUizjVdbBrd";
export const NODES = ["game", "desk", "personal"] as const;
export type NodeName = (typeof NODES)[number];

/** The public key (base64url, as Proof-of-Burn stores it) of a producer key file's contents. Never echoes the input. */
export function publicKeyOf(raw: string): string {
  const s = raw.trim();
  let signer: Signer;
  if (/^[5KL][1-9A-HJ-NP-Za-km-z]{50,51}$/.test(s)) signer = Signer.fromWif(s);
  else if (/^(0x)?[0-9a-fA-F]{64}$/.test(s)) signer = new Signer({ privateKey: s.replace(/^0x/, "") });
  else throw new Error("not in a key format this tool knows (WIF or 64 hex characters). Do NOT paste the file's contents anywhere; tell the Vault chat.");
  const pk: any = (signer as any).publicKey;
  const bytes: Uint8Array = typeof pk === "string" ? Buffer.from(pk.replace(/^0x/, ""), "hex") : pk;
  return Buffer.from(bytes).toString("base64url");
}

/** Which producer each node produces for, and the key the records expect (if they record one). */
export function producers(root = process.cwd(), env = process.env): Record<NodeName, { producer: string; recorded: string }> {
  const read = (f: string) => { try { return JSON.parse(fs.readFileSync(path.join(root, f), "utf8")); } catch { return {}; } };
  const game = read("game-data/deployment.json"), desk = read("desk-data/deployment.json");
  return {
    game: { producer: String(game.contract ?? ""), recorded: String(game.producerKey ?? "") },
    desk: { producer: String(desk.contract ?? ""), recorded: String(desk.producerKey ?? "") },
    personal: { producer: String(env.PERSONAL_PRODUCER || PERSONAL), recorded: "" },
  };
}

export type Row = { node: NodeName; file: string; publicKey?: string; registered?: string; recorded?: string; ok: boolean; note: string };

/** Checks each node's backed-up key. `registeredKey(producer)` reads Proof-of-Burn (or a stub in the tests). */
export async function checkBackup(folder: string, registeredKey: (producer: string) => Promise<string>, root = process.cwd(), env = process.env): Promise<Row[]> {
  const who = producers(root, env);
  const rows: Row[] = [];
  for (const node of NODES) {
    const file = path.join(folder, node, "private.key");
    if (!fs.existsSync(file)) { rows.push({ node, file, ok: false, note: "no backup of this node in the folder" }); continue; }
    let publicKey = "";
    try { publicKey = publicKeyOf(fs.readFileSync(file, "utf8")); }
    catch (e: any) { rows.push({ node, file, ok: false, note: `the file can't be read as a key: ${e.message}` }); continue; }
    let registered = "";
    try { registered = who[node].producer ? await registeredKey(who[node].producer) : ""; }
    catch (e: any) { rows.push({ node, file, publicKey, ok: false, note: `couldn't read the registered key (${e?.message ?? e}); run again` }); continue; }
    const recorded = who[node].recorded;
    const ok = !!registered && registered === publicKey && (!recorded || recorded === publicKey);
    const note = !registered ? `no key is registered for ${who[node].producer}`
      : registered !== publicKey ? `NOT the registered key (${registered}): this backup can't produce for ${who[node].producer}`
      : recorded && recorded !== publicKey ? `matches the chain, but the records say ${recorded}`
      : "matches the key registered on chain";
    rows.push({ node, file, publicKey, registered, recorded, ok, note });
  }
  return rows;
}

/** Before a restore (Repo Lens #F-8 F8-7): is this key file the one registered on chain for `producer`? */
export async function restoreCheck(file: string, producer: string, registeredKey: (producer: string) => Promise<string>): Promise<{ ok: boolean; publicKey: string; registered: string }> {
  const publicKey = publicKeyOf(fs.readFileSync(file, "utf8"));
  const registered = await registeredKey(producer);
  return { ok: !!registered && registered === publicKey, publicKey, registered };
}

async function mainnetPob() {
  const rpc = process.env.RPC || "https://koinos.armana.io";
  const provider = new Provider([rpc]);
  if ((await provider.getChainId()) !== MAINNET_CHAIN_ID) throw new Error(`${rpc} is not Koinos mainnet. Stopping.`);
  const pob = new Contract({ id: MAINNET_POB, abi: pobAbi as any, provider });
  return async (producer: string) => String(((await (pob.functions as any).get_public_key({ producer })).result ?? {}).value ?? "");
}

async function main() {
  const a = process.argv.slice(2);
  if (a[0] === "--restore-check") {
    if (!a[1] || !fs.existsSync(a[1]) || !a[2]) { console.error("Give the key file and the producer: --restore-check <file> <producer>"); process.exitCode = 2; return; }
    let r;
    try { r = await restoreCheck(a[1], a[2], await mainnetPob()); }
    catch (e: any) { console.error(`Couldn't check the key: ${e?.message ?? e}`); process.exitCode = 2; return; }
    console.log(`Public key of the file (safe to share): ${r.publicKey}\nRegistered for ${a[2]}: ${r.registered || "none"}`);
    console.log(r.ok ? "✔ the key is the one registered on chain" : "✖ NOT the registered key: this file can't produce for that producer");
    process.exitCode = r.ok ? 0 : 1;
    return;
  }
  if (a[0] === "--file") {
    if (!a[1] || !fs.existsSync(a[1])) throw new Error("Give the key file: npx tsx tools/producer-keys.ts --file <path>");
    console.log(`Public key (safe to share): ${publicKeyOf(fs.readFileSync(a[1], "utf8"))}`);
    return;
  }
  const folder = a[0];
  if (!folder || !fs.existsSync(folder)) throw new Error("Give the backup folder: npx tsx tools/producer-keys.ts <folder>");
  const rows = await checkBackup(folder, await mainnetPob());
  console.log("Producer key backup (public keys only; safe to share):\n");
  for (const r of rows) console.log(`${r.ok ? "✔" : "✖"} ${r.node.padEnd(8)} ${r.publicKey ?? "-"}\n    ${r.note}`);
  const bad = rows.filter((r) => !r.ok).length;
  console.log(bad ? `\n✖ ${bad} node(s) need a look (above). Paste this output (never a key file) to the Vault chat.` : "\n✔ Every backed-up key is the one registered on chain.");
  process.exitCode = bad ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main().catch((e) => { console.error(`\nStopped: ${e.message ?? e}`); process.exitCode = 1; });
