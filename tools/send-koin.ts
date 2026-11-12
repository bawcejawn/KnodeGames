/**
 * Send a little KOIN from the CURRENT owner wallet to a NEW wallet of yours (one-off, for the wallet moves in
 * docs/WALLETS.md: the new owner needs KOIN so it has Mana for its accept steps).
 *
 *   npx tsx tools/send-koin.ts --to <address> --confirm <address> --amount <KOIN>          dry run: shows the plan
 *   npx tsx tools/send-koin.ts --to <address> --confirm <address> --amount <KOIN> --send   sends it
 *
 * Safety:
 * - It sends ONLY from the owner wallet 1635QU…H717 (OWNER_WIF in .env must be that wallet's key; the key is never
 *   printed). It prints the entry name, never a key.
 * - The address must be typed twice (--to and --confirm) and both must match exactly.
 * - It refuses the platform's contracts and token addresses, any address that has contract code on chain, and the
 *   sender itself: KOIN sent to a contract can be stuck (docs/WALLETS.md §4).
 * - At most 20 KOIN per send. Mainnet only (pinned chain id). A dry run unless --send; a send also needs
 *   CONFIRM_MAINNET=yes in .env.
 * - The node: $env:RPC if set, else RPC= in .env, else https://koinos.armana.io.
 */
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { Signer, Provider, Contract, utils } from "koilib";
import { tokenAbi } from "../bot/token-abi.ts";

export const FROM = "1635QUrBNDp7WqmFkRvrkGwjJXTtFvH717";        // the current owner wallet (and Desk treasury)
const KOIN = "19GYjDBVXU7keLbYvMLazsGQn3GTWHjHkK";
const MAINNET_CHAIN_ID = "EiBZK_GGVP0H_fXVAM3j6EAuz3-B-l3ejxRSewi7qIBfSA==";
export const MAX_KOIN = 20n * 100_000_000n;
const RC_LIMIT = 100_000_000n;                                   // at most 1 KOIN of Mana for the transfer (it costs ~0.2)
/** Never a destination: the platform's contracts and the tokens. */
export const REFUSED: Record<string, string> = {
  "1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr": "the vault (game contract)", "1FKTpXBhhHEbu5vVchM8UsVbAvPArJsRmR": "the Swap Desk contract",
  "1LmgqBGctL9F2YkyjTXgieTXwnYHh8Y6Pm": "the Picks contract", "1EN7xU8R9tQXjHvrX79qZvvvGkkKWVnB5K": "the Race picks contract",
  "1ByDDSBUzy5zkRceELc54Jh8i41yNRoKt8": "the Mana sponsor", [KOIN]: "the KOIN token", "12Y5vW6gk8GceH53YfRkRre2Rrcsgw7Naq": "the VHP token",
  "159myq5YUhhoVWu3wsHKHiJYKPKGUrGiyv": "the PoB contract", [FROM]: "the sender itself",
};
const ADDRESS = /^1[1-9A-HJ-NP-Za-km-z]{25,34}$/;

/** Checks the command line. Returns the plan, or throws with the reason. Exported for the tests. */
export function plan(argv: string[]): { to: string; amount: bigint; send: boolean } {
  const arg = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const to = arg("--to") ?? "", confirm = arg("--confirm") ?? "", amt = arg("--amount") ?? "";
  if (!ADDRESS.test(to)) throw new Error("--to must be a Koinos address (starts with 1).");
  if (confirm !== to) throw new Error("--confirm must be exactly the same address as --to (type or paste it a second time).");
  if (REFUSED[to]) throw new Error(`${to} is ${REFUSED[to]}: never send KOIN there.`);
  const m = /^(\d{1,3})(?:\.(\d{1,8}))?$/.exec(amt);
  if (!m) throw new Error("--amount must be KOIN, for example 10 or 2.5.");
  const amount = BigInt(m[1]) * 100_000_000n + BigInt((m[2] ?? "").padEnd(8, "0"));
  if (amount <= 0n || amount > MAX_KOIN) throw new Error("--amount must be more than 0 and at most 20 KOIN.");
  return { to, amount, send: argv.includes("--send") };
}

function readEnv(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

async function main() {
  const p = plan(process.argv.slice(2));
  const env = readEnv(".env");
  if (!env.OWNER_WIF) throw new Error("OWNER_WIF is not in .env. Run this in C:\\kprediction with the current owner key in .env.");
  const signer = Signer.fromWif(env.OWNER_WIF);
  if (signer.getAddress() !== FROM) throw new Error(`OWNER_WIF belongs to ${signer.getAddress()}, not the current owner wallet ${FROM}. Nothing was sent.`);
  const rpc = process.env.RPC || env.RPC || "https://koinos.armana.io";
  const provider = new Provider([rpc]);
  if ((await provider.getChainId()) !== MAINNET_CHAIN_ID) throw new Error(`${rpc} is not Koinos mainnet. Stopping.`);
  signer.provider = provider;
  // A contract account can't be checked by name alone: refuse anything with code on chain.
  // (Fail closed: if the node can't answer, nothing is sent.)
  let meta: any;
  try { meta = await provider.call("contract_meta_store.get_contract_meta", { contract_id: p.to }); }
  catch (e: any) { throw new Error(`Couldn't check whether ${p.to} is a contract (${e?.message ?? e}). Nothing was sent.`); }
  if (meta?.meta && Object.keys(meta.meta).length) throw new Error(`${p.to} is a contract (it has code on chain): never send KOIN there. Nothing was sent.`);
  const koin = new Contract({ id: KOIN, abi: tokenAbi as any, provider, signer });
  const bal = async (who: string) => BigInt((await (koin.functions as any).balance_of({ owner: who })).result?.value ?? 0);
  const fromKoin = await bal(FROM), toKoin = await bal(p.to), mana = BigInt(await provider.getAccountRc(FROM));
  const fmt = (n: bigint) => utils.formatUnits(n.toString(), 8);
  console.log(`From  ${FROM} (OWNER_WIF): ${fmt(fromKoin)} KOIN, ${fmt(mana)} Mana`);
  console.log(`To    ${p.to}: ${fmt(toKoin)} KOIN now`);
  console.log(`Plan: send ${fmt(p.amount)} KOIN. Check the FULL "To" address above against your wallet before sending.`);
  if (p.amount + RC_LIMIT > mana) throw new Error("The owner wallet's Mana is too low for this amount (a KOIN transfer needs Mana at least equal to the amount). Nothing was sent.");
  if (!p.send) { console.log("\nDry run: nothing was sent. If everything above is right, run the same command with --send."); return; }
  if (env.CONFIRM_MAINNET !== "yes") throw new Error("MAINNET: add CONFIRM_MAINNET=yes to .env first.");
  const { transaction, receipt } = await (koin.functions as any).transfer({ from: FROM, to: p.to, value: p.amount.toString() }, { payer: FROM, rcLimit: RC_LIMIT.toString() });
  if (receipt?.reverted) throw new Error("The transfer was reverted: nothing moved.");
  console.log(`Sent: transaction ${transaction?.id}`);
  await transaction?.wait("byBlock", 60_000);
  console.log(`Included. ${p.to} now holds ${fmt(await bal(p.to))} KOIN. Check it on https://koinosscan.com/tx/${transaction?.id}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main().catch((e) => { console.error(`\nStopped: ${e.message ?? e}`); process.exitCode = 1; });
