/**
 * Prices measured calls at MAINNET's current resource prices (Repo Lens #D-8, D8-1). Read-only: no key, nothing sent.
 *
 *   npx tsx tools/mainnet-mana.ts docs/testnet-v61-units.json
 *
 * The file lists calls measured on the testnet with their resource units (compute ticks, disk bytes, network bytes;
 * written by `npm run bot -- testnet-v61-d8`). Units don't depend on the network; prices do. This reads mainnet's prices
 * (chain.get_resource_limits) and prints each call's Mana = ticks × compute price + disk × disk price + network × network
 * price, next to the limit it must fit (limitOf).
 * The node: $env:RPC if set, else https://koinos.armana.io. It checks the chain id is mainnet's.
 */
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { Provider } from "koilib";

const MAINNET_CHAIN_ID = "EiBZK_GGVP0H_fXVAM3j6EAuz3-B-l3ejxRSewi7qIBfSA==";
const SAT = 100_000_000;

export type Prices = { compute: bigint; disk: bigint; network: bigint };
export type Call = { key: string; note: string; compute: string; disk: string; network: string; rc?: string };

/** Mana (in satoshi) a call with these units costs at these prices. Exported for the tests. */
export function manaOf(c: Pick<Call, "compute" | "disk" | "network">, p: Prices): bigint {
  return BigInt(c.compute) * p.compute + BigInt(c.disk) * p.disk + BigInt(c.network) * p.network;
}

/** The limit a call must fit, in Mana, if it has one (owner, 4 Nov: every call must fit its limit).
 *  Paid by the Mana sponsor (keys ending in "Sp"), the per-action limits the owner chose on 4 Nov (per transaction 2.4):
 *    an answer 1.2, a claim 2.0, a stake (approve + deposit_to) 2.4, a withdrawal 1.55.
 *  Paid from the player's own Mana (wallet.js, audit BX-10): an answer or settle 1; a stake, withdrawal or claim 10.
 *  The bot's close, results, seal and finalize: 2 (bot/chain.ts). Testnet batches and the upload: none. */
export function limitOf(key: string): number | null {
  if (key.endsWith("Sp")) {
    if (/^answer/.test(key)) return 1.2;
    if (/^claim/.test(key)) return 2.0;
    if (/^deposit/.test(key)) return 2.4;
    if (/^withdraw/.test(key)) return 1.55;
    return null;
  }
  if (/^answer|^firstAnswer|^settle/.test(key)) return 1;
  if (/^deposit|^withdraw|^claim/.test(key)) return 10;
  if (/^close|^postResults|^seal|^finalize/.test(key)) return 2;
  return null;
}

const fmt = (sat: bigint) => (Number(sat) / SAT).toFixed(4);

async function main() {
  const f = process.argv[2];
  if (!f || !fs.existsSync(f)) throw new Error("Give the units file, e.g. npx tsx tools/mainnet-mana.ts docs/testnet-v61-units.json");
  const units = JSON.parse(fs.readFileSync(f, "utf8"));
  const rpc = process.env.RPC || "https://koinos.armana.io";
  const provider = new Provider([rpc]);
  if ((await provider.getChainId()) !== MAINNET_CHAIN_ID) throw new Error(`${rpc} is not Koinos mainnet. Stopping.`);
  const d: any = ((await provider.call("chain.get_resource_limits", {})) as any)?.resource_limit_data ?? {};
  const p: Prices = { compute: BigInt(d.compute_bandwidth_cost ?? 0), disk: BigInt(d.disk_storage_cost ?? 0), network: BigInt(d.network_bandwidth_cost ?? 0) };
  if (!p.compute && !p.disk && !p.network) throw new Error(`${rpc} returned no resource prices. Try again, or set $env:RPC to another mainnet node.`);
  console.log(`Mainnet prices now (${rpc}): compute ${p.compute}, disk ${p.disk}, network ${p.network} (satoshi of Mana per unit)`);
  console.log(`Units from ${f} (${units.run ?? "?"}, build ${String(units.build ?? "?").slice(0, 8)}…, ${units.games ?? "?"} games)\n`);
  let over = 0, half = 0;
  for (const c of units.calls as Call[]) {
    const m = manaOf(c, p), lim = limitOf(c.key);
    const share = lim ? Number(m) / (lim * SAT) : null;
    if (share !== null && share > 1) over++;
    if (share !== null && share > 0.5) half++;
    console.log(`${fmt(m).padStart(9)} Mana  ${lim ? `(${(share! * 100).toFixed(0)}% of ${lim})`.padEnd(14) : "".padEnd(14)} ${c.note}`);
  }
  let tight = 0;
  for (const c of units.calls as Call[]) { const lim = limitOf(c.key); if (lim && Number(manaOf(c, p)) * 1.25 > lim * SAT) tight++; }
  console.log(over ? `\n✖ ${over} call(s) are OVER their limit.`
    : tight ? `\n⚠ ${tight} call(s) fit, but with less than 25% room for prices to rise.`
    : "\n✔ Every call fits its limit with at least 25% room for prices to rise.");
  if (half && !over) console.log(`  (${half} use more than half of their limit.)`);
  console.log("Paste this output to the Vault chat.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main().catch((e) => { console.error(`\nStopped: ${e.message ?? e}`); process.exitCode = 1; });
