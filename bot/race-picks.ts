/**
 * PRODUCER RACE PICKS TOOL: put the race picks contract (race/) on chain and run it. Every command that sends is a dry
 * run (it only shows what it would do) unless you add --send.
 *
 *   npm run racepicks -- status                  the contract right now: code, settings, today's picks for a wallet
 *   npm run racepicks -- upload [--send]         put the contract on the race wallet (RACE_WIF), no overrides
 *   npm run racepicks -- setup [--send]          the first settings, signed by the race wallet's own key: owner = the
 *                                                Knode owner, picks ON, 5 picks per wallet per day
 *   npm run racepicks -- enable|disable [--send] switch picks on or off (owner's key: OWNER_WIF)
 *   npm run racepicks -- limit <1-20> [--send]   picks per wallet per day (owner's key)
 *   npm run racepicks -- owner <new> [--confirm <new>] [--send]
 *                                                hand the contract's settings to a new owner wallet (I-077, D-096).
 *                                                One step and immediate on chain, so the tool asks for the address
 *                                                twice, proves you hold the new key (NEW_OWNER_WIF), keeps every
 *                                                other setting, and reads the result back on both nodes.
 *
 * Keys come from the root .env (never GitHub):
 *   RACE_WIF    a brand-new wallet that becomes the race contract. Its key is needed for the upload and the first
 *               setup only (and future upgrades). The contract holds no funds and never pays Mana.
 *   OWNER_WIF   the race contract's CURRENT owner (as read from the chain): changes the settings after the first
 *               setup. For an owner change: the old owner's key.
 *   NEW_OWNER_WIF  owner change only: the new owner's key, for that one command, so the tool can check the new address
 *               really is a wallet you hold. Nothing is signed with it. Take it out of .env afterwards.
 * The Mana for players' picks is paid by the Knode Mana sponsor (sponsor v2: npm run sponsor -- config --send once
 * race-data/deployment.json exists).
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Signer, Provider, Contract, Transaction, utils } from "koilib";
import { KoinosChain, showKoin, toSat } from "./chain.ts";
import { contractMetadata } from "./chaincheck.ts";
import { isMainnet, pinDeployment, PINNED_MAINNET } from "./bot.ts";

const E = process.env;
const log = (...a: any[]) => console.log(...a);
const WASM = "race/build/release/contract.wasm";
const ABI_FILE = "race/abi/race.koilib.json";
const STATE = path.join("race-data", "deployment.json");
const GAME_DEP = path.join("game-data", "deployment.json");
/** The audited race build (race/README.md "Build"; audit 2026-10-27, AUDIT-2026-10-27-race-picks.md (owner's private records)).
 *  upload refuses any other wasm. */
export const RACE_SHA256 = "61e8f21230e8b4bdb165bacfe7281517a5adf78f6c6b1b8a0d84ce41537afac5";
export const DEFAULT_PICKS_PER_DAY = 5;
/** The race picks contract on mainnet (uploaded 27 Oct 2026). Like PINNED_MAINNET in bot/bot.ts: on mainnet the tool
 *  only signs for this address, whatever race-data/deployment.json says (RACE_CONTRACT_ADDRESS for a deliberate move). */
export const RACE_PINNED_MAINNET = "1EN7xU8R9tQXjHvrX79qZvvvGkkKWVnB5K";

const sha256hex = (b: Uint8Array) => crypto.createHash("sha256").update(b).digest("hex");
const readJson = (f: string, d: any = null) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : d);
const writeJson = (f: string, v: any) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(v, null, 2) + "\n"); };
const need = (k: string) => { if (!E[k]) throw new Error(`${k} is missing from .env`); return E[k]!; };
const loadAbi = () => {
  if (!fs.existsSync(ABI_FILE)) throw new Error(`${ABI_FILE} not found: in the race folder run npm ci --ignore-scripts, npm test`);
  return JSON.parse(fs.readFileSync(ABI_FILE, "utf8"));
};
function game() {
  const g = readJson(GAME_DEP);
  if (!g?.contract || !g?.owner) throw new Error(`${GAME_DEP} is needed.`);
  const rpc = E.RPC ?? g.rpc ?? "https://koinos.armana.io";
  pinDeployment("game", g, rpc, GAME_DEP);
  return { g, rpc };
}
/** The race wallet: a brand-new wallet, never one of the other Knode wallets. */
function raceKey(provider: Provider) {
  const s = Signer.fromWif(need("RACE_WIF"));
  s.provider = provider;
  const { g } = game();
  const a = s.getAddress();
  const taken: Record<string, string> = { [g.contract]: "the game contract", [g.owner]: "the owner wallet", [g.operator]: "the bot wallet", [PINNED_MAINNET.sponsor]: "the Mana sponsor", [PINNED_MAINNET.koin]: "KOIN", [PINNED_MAINNET.vhp]: "VHP" };
  if (taken[a]) throw new Error(`RACE_WIF is ${taken[a]}'s key. The race contract needs a brand-new wallet of its own.`);
  const st = readJson(STATE);
  if (st?.contract && st.contract !== a) throw new Error(`RACE_WIF belongs to ${a}, but ${STATE} says the race contract is ${st.contract}.`);
  return s;
}
/** The key that may change the settings: the race contract's owner as the chain reports it (WALLETS.md §8: not
 *  game-data/deployment.json, whose owner moves with the vault and may differ from the Race picks owner). */
function ownerKey(provider: Provider, contractOwner: string) {
  const s = Signer.fromWif(need("OWNER_WIF"));
  s.provider = provider;
  if (s.getAddress() !== contractOwner) throw new Error(`OWNER_WIF belongs to ${s.getAddress()}, but the race contract's owner on chain is ${contractOwner}. Put that wallet's key in .env as OWNER_WIF.`);
  return s;
}
/** The race contract's address. On mainnet only the pinned one (a changed deployment file can't redirect a signed
 *  owner transaction to a look-alike contract). */
export function raceAddressFor(rpc: string, dep: any = readJson(STATE), env: NodeJS.ProcessEnv = E): string | null {
  const a = dep?.contract ?? (env.RACE_WIF ? Signer.fromWif(env.RACE_WIF).getAddress() : null);
  if (a && isMainnet(rpc)) {
    const want = env.RACE_CONTRACT_ADDRESS ?? RACE_PINNED_MAINNET;
    if (a !== want) throw new Error(`${STATE} names the race contract ${a}, not ${want}. If that change is intended, set RACE_CONTRACT_ADDRESS (and update RACE_PINNED_MAINNET in bot/race-picks.ts).`);
  }
  return a;
}
const raceAddress = () => raceAddressFor(game().rpc);
async function read(provider: Provider, id: string, method: string, args: any = {}) {
  const c = new Contract({ id, abi: loadAbi(), provider });
  return ((await (c.functions as any)[method](args)).result) ?? {};
}

/** The settings to send. Exported for the tests. */
export function buildRaceConfig(owner: string, enabled: boolean, perDay: number) {
  if (!/^1[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(owner)) throw new Error("The owner must be a Koinos address.");
  // v2 (D-153): 0 = no per-game limit (the Mana sponsor's daily limit is the cap). The v1 contract refuses 0.
  if (!Number.isInteger(perDay) || perDay < 0 || perDay > 20) throw new Error("Picks per day must be a whole number from 0 (no limit) to 20.");
  return { owner, enabled, max_picks_per_day: perDay };
}

async function status() {
  const { g, rpc } = game();
  const A = raceAddress();
  if (!A) { log("No race contract yet: create a new wallet, put its key in .env as RACE_WIF, then: npm run racepicks -- upload"); return; }
  const provider = new Provider([rpc]);
  log(`Producer Race picks ${A} on ${rpc}${isMainnet(rpc) ? " (mainnet)" : ""}`);
  const m = await contractMetadata(provider, A);
  if (!m.exists) { log("  Contract       not uploaded yet (npm run racepicks -- upload)"); return; }
  const st = readJson(STATE);
  log(`  Code           sha256 ${m.hash.replace(/^0x1220/, "")}${st?.wasmSha256 && m.hash.endsWith(st.wasmSha256) ? " (as uploaded)" : ""}`);
  log(`  Overrides      ${m.tx || m.call || m.upload ? "SOME ON (must all be off!)" : "none (as it should be)"}`);
  const cfg = await read(provider, A, "get_config");
  log(`  Owner          ${cfg.owner ?? "not set (npm run racepicks -- setup)"}${cfg.owner && cfg.owner !== g.owner ? "  (not the vault owner in game-data/deployment.json)" : ""}`);
  log(`  Picks          ${cfg.enabled ? "ON" : "off"}, ${Number(cfg.max_picks_per_day ?? 0) === 0 ? "no per-game limit (v2)" : `${cfg.max_picks_per_day} per wallet per day`}`);
}

async function upload(send: boolean) {
  const { rpc } = game();
  const mainnet = isMainnet(rpc);
  if (send && mainnet && E.CONFIRM_MAINNET !== "yes") throw new Error("MAINNET: add CONFIRM_MAINNET=yes to .env first.");
  const provider = new Provider([rpc]);
  const s = raceKey(provider);
  const A = s.getAddress();
  if (!fs.existsSync(WASM)) throw new Error(`${WASM} not found: in the race folder run npm ci && npm test`);
  const wasm = fs.readFileSync(WASM);
  if (!RACE_SHA256) throw new Error("The race contract has not been audited yet: upload is locked until RACE_SHA256 is set to the audited build.");
  if (sha256hex(wasm) !== RACE_SHA256) throw new Error(`${WASM} is not the audited race build (sha256 ${sha256hex(wasm)}, expected ${RACE_SHA256}). Rebuild: cd race, npm ci --ignore-scripts, npm test.`);
  const abi = loadAbi();
  const have = BigInt(await provider.getAccountRc(A));
  const needRc = toSat(Math.ceil(wasm.length / 1024 * 1.2 + 10));
  log(`Race wallet        ${A}${mainnet ? "   ⚠ MAINNET" : ""}`);
  log(`Code               ${WASM}, ${(wasm.length / 1024).toFixed(1)} KB, sha256 ${sha256hex(wasm)}`);
  log(`Overrides          none: it never pays Mana; settings and upgrades stay with keys`);
  log(`Mana               has ${showKoin(have)}, the upload needs about ${showKoin(needRc)}`);
  if (have < needRc) throw new Error(`Send at least ${showKoin(needRc - have + toSat(5))} more KOIN to ${A} first (its KOIN is its Mana; you can move it out again afterwards).`);
  if (!send) { log("\nDry run only. Nothing was sent. Run again with --send to upload."); return; }
  const c = new Contract({ id: A, abi, provider, signer: s, bytecode: new Uint8Array(wasm) });
  const { operation } = await c.deploy({ abi: JSON.stringify(abi), authorizesCallContract: false, authorizesTransactionApplication: false, authorizesUploadContract: false, onlyOperation: true } as any);
  const tx = new Transaction({ signer: s, provider, options: { payer: A, rcLimit: (needRc * 13n / 10n < have * 95n / 100n ? needRc * 13n / 10n : have * 95n / 100n).toString() } });
  await tx.pushOperation(operation);
  const receipt: any = await tx.send();
  if (receipt?.reverted) throw new Error(`upload reverted: ${JSON.stringify(receipt.logs)}`);
  await tx.wait("byBlock", 300_000).catch(() => { throw new Error("Sent but not confirmed within 5 minutes. Check status in a few minutes."); });
  const after = await contractMetadata(provider, A);
  const bad: string[] = [];
  if (after.hash.replace(/^0x1220/, "") !== RACE_SHA256) bad.push(`code on chain is ${after.hash}`);
  if (after.tx || after.call || after.upload) bad.push("an authority override is ON (all must be off)");
  if (bad.length) throw new Error(`Uploaded, but the race contract is not as expected: ${bad.join("; ")}. Do not set it up; check npm run racepicks -- status.`);
  writeJson(STATE, { network: mainnet ? "mainnet" : "testnet", rpc, contract: A, wasmSha256: sha256hex(wasm), uploadTx: tx.transaction?.id, uploadedAt: new Date().toISOString() });
  log(`✔ uploaded (Mana used ${showKoin(receipt?.rc_used)}). Saved ${STATE} (public; commit it). Next: npm run racepicks -- setup --send`);
}

async function setConfig(send: boolean, change: (cur: any) => { enabled: boolean; perDay: number }, firstSetup: boolean) {
  const { g, rpc } = game();
  if (send && isMainnet(rpc) && E.CONFIRM_MAINNET !== "yes") throw new Error("MAINNET: add CONFIRM_MAINNET=yes to .env first.");
  const provider = new Provider([rpc]);
  const A = raceAddress();
  if (!A) throw new Error("No race contract yet (npm run racepicks -- upload --send).");
  const cur = await read(provider, A, "get_config").catch(() => ({} as any));
  if (firstSetup && cur.owner) throw new Error(`Already set up (owner ${cur.owner}). Use enable, disable or limit.`);
  if (!firstSetup && !cur.owner) throw new Error("Not set up yet: npm run racepicks -- setup --send");
  const { enabled, perDay } = change(cur);
  // After the first setup the owner stays exactly as it is on chain: on/off and the daily limit never move it.
  const config = buildRaceConfig(firstSetup ? g.owner : cur.owner, enabled, perDay);
  const signer = firstSetup ? raceKey(provider) : ownerKey(provider, cur.owner);
  log(`To the race contract ${A}, signed by ${firstSetup ? "the race wallet (first setup)" : `its owner ${cur.owner}`}:`);
  log(`  owner ${config.owner}; picks ${enabled ? "ON" : "off"}; ${perDay} per wallet per day`);
  if (!send) { log("\nDry run only. Nothing was sent. Add --send to send it."); return; }
  const chain = new KoinosChain(rpc, signer.getAddress());
  const r = await chain.send([{ contract: A, abi: loadAbi(), method: "set_config", args: { config } }], [signer], { payer: signer.getAddress(), rcLimitKoin: 2 });
  log(r.ok ? `✔ done (Mana used ${showKoin(r.rcUsed)})  transaction ${r.txId}` : `✖ ${r.error}`);
  if (!r.ok) process.exitCode = 1;
}

// ═══════════════════════════════ owner change (I-077, D-096) ═══════════════════════════════

/** Wallets that must never become the Race picks owner: contracts and tokens (no one can sign for them), the bot and
 *  the sponsor (hot keys). Exported for the tests. */
export function forbiddenOwners(g: any, race: string, picks?: string | null): Record<string, string> {
  const t: Record<string, string> = {
    [race]: "the race contract itself", [PINNED_MAINNET.game]: "the vault (game contract)", [PINNED_MAINNET.desk]: "the Swap Desk contract",
    [PINNED_MAINNET.sponsor]: "the Mana sponsor", [PINNED_MAINNET.koin]: "the KOIN token", [PINNED_MAINNET.vhp]: "the VHP token", [PINNED_MAINNET.pob]: "the PoB contract",
  };
  if (g?.contract) t[g.contract] = "the vault (game contract)";
  if (g?.operator) t[g.operator] = "the bot wallet (operator, a hot key on GitHub)";
  if (g?.seedOwner) t[g.seedOwner] = "the seed owner wallet (it has its own job)";
  if (picks) t[picks] = "the Picks contract";
  return t;
}

export type OwnerPlanInput = {
  cur: any;                    // get_config read from the chain now
  next: string;                // the new owner, as typed
  confirm?: string;            // the same address typed a second time (--confirm)
  send: boolean;
  signer?: string;             // OWNER_WIF's address
  proof?: string;              // NEW_OWNER_WIF's address
  vaultOwner?: string;         // game-data/deployment.json's owner (for information only)
  forbidden: Record<string, string>;
};

/** Checks an owner change and builds the one set_config to send: the new owner, every other setting unchanged.
 *  Throws (with a plain reason) on anything wrong. A dry run needs only a valid address; --send needs everything. */
export function planOwnerChange(p: OwnerPlanInput): { config: ReturnType<typeof buildRaceConfig>; notes: string[] } {
  const next = (p.next ?? "").trim();
  if (!p.cur?.owner) throw new Error("The race contract has no owner yet (npm run racepicks -- setup).");
  if (!next) throw new Error("Give the new owner's address: npm run racepicks -- owner <new address>");
  if (!utils.isChecksumAddress(next)) throw new Error(`${next} is not a valid Koinos address (its checksum fails). Copy it again from the wallet; don't type it by hand.`);
  if (next === p.cur.owner) throw new Error(`${next} is already the race contract's owner. Nothing to change.`);
  if (p.forbidden[next]) throw new Error(`${next} is ${p.forbidden[next]}. The owner must be a person's wallet that you hold the key for.`);
  const perDay = Number(p.cur.max_picks_per_day ?? 0);   // a 0 (no limit, v2) is left out of the answer
  const config = buildRaceConfig(next, !!p.cur.enabled, perDay);
  const notes: string[] = [];
  if (p.vaultOwner && p.vaultOwner !== next) notes.push(`⚠ ${next} is not the vault owner named in game-data/deployment.json (${p.vaultOwner}). Fine if that file hasn't been updated for the vault handover yet; otherwise stop and check.`);
  if (p.vaultOwner && p.vaultOwner === next) notes.push(`✔ ${next} is also the vault owner in game-data/deployment.json.`);
  if (p.confirm !== undefined && p.confirm.trim() !== next) throw new Error(`The two addresses differ:\n  owner   ${next}\n  confirm ${p.confirm.trim()}\nNothing was sent.`);
  if (p.proof !== undefined && p.proof !== next) throw new Error(`NEW_OWNER_WIF belongs to ${p.proof}, not ${next}. Nothing was sent: the new address must be a wallet whose key you hold.`);
  if (p.send) {
    if (p.confirm === undefined) throw new Error(`To send, type the new address a second time: --confirm ${next.slice(0, 4)}… (the whole address).`);
    if (p.proof === undefined) throw new Error("To send, put the NEW owner's key in .env as NEW_OWNER_WIF for this one command (it proves the address is yours; nothing is signed with it). Take it out again afterwards.");
    if (p.signer !== p.cur.owner) throw new Error(`OWNER_WIF belongs to ${p.signer}, but the race contract's owner on chain is ${p.cur.owner}.`);
  }
  return { config, notes };
}

/** What changeOwner needs from the outside world; replaced in the tests. */
export type OwnerDeps = {
  rpc: string; rpcCheck?: string; mainnet: boolean; race: string; g: any; picks?: string | null; env: NodeJS.ProcessEnv;
  readConfig: (rpc: string) => Promise<any>;
  /** Does this address have contract code on that node? (Repo Lens #D-5 R84-1) Throws when it can't be read. */
  hasCode: (rpc: string, address: string) => Promise<boolean>;
  send: (config: any) => Promise<{ ok: boolean; txId?: string; rcUsed?: string; error?: string }>;
  signerAddress: () => string;
  proofAddress: () => string | undefined;
  log: (...a: any[]) => void;
};

/** npm run racepicks -- owner <new> [--confirm <new>] [--send]. Returns true when the change is done and read back. */
export async function changeOwner(next: string, confirm: string | undefined, send: boolean, d: OwnerDeps): Promise<boolean> {
  if (send && d.mainnet && d.env.CONFIRM_MAINNET !== "yes") throw new Error("MAINNET: add CONFIRM_MAINNET=yes to .env first.");
  // Repo Lens #D-5 R84-2: on mainnet the owner change always needs the second node.
  if (send && d.mainnet && !d.rpcCheck) throw new Error("MAINNET: the owner change needs a second node. Set RPC_CHECK (e.g. $env:RPC_CHECK = \"https://api.koinosblocks.com\") and run it again. Nothing was sent.");
  // R-RACE-9 (Repo Lens #C-4, C4-3): a node with no race settings (a wrong race address, or a contract never set up)
  // answers {}. Say so plainly, before comparing: two empty answers would otherwise read as "NaN; NaN".
  const settingsOn = async (node: string) => {
    const c = await d.readConfig(node);
    if (!c || typeof c !== "object" || !c.owner) throw new Error(`No race settings on chain at ${node} (contract ${d.race}). Check the race contract address and the node, or run npm run racepicks -- status. Nothing was sent.`);
    return c;
  };
  const cur = await settingsOn(d.rpc);
  if (d.rpcCheck) {
    const other = await settingsOn(d.rpcCheck);
    // Repo Lens #D-5 R84-3: every setting must agree, not only the owner (a lagging node could undo a recent disable).
    for (const [k, label] of [["owner", "owner"], ["enabled", "picks on/off"], ["max_picks_per_day", "picks per day"]] as const) {
      const a = k === "enabled" ? !!cur?.[k] : k === "owner" ? cur?.[k] : Number(cur?.[k] ?? 0);
      const b = k === "enabled" ? !!other?.[k] : k === "owner" ? other?.[k] : Number(other?.[k] ?? 0);
      if (a !== b) throw new Error(`The two nodes disagree about the race contract's ${label} (${d.rpc}: ${a}; ${d.rpcCheck}: ${b}). Nothing was sent. Try again in a few minutes.`);
    }
  } else d.log("  ⚠ Only one node (RPC_CHECK is not set): the settings are not cross-checked.");
  const proof = d.proofAddress();
  const signer = send ? d.signerAddress() : undefined;
  const { config, notes } = planOwnerChange({ cur, next, confirm, send, signer, proof, vaultOwner: d.g?.owner, forbidden: forbiddenOwners(d.g, d.race, d.picks) });
  // Repo Lens #D-5 R84-1: never a contract, listed or not (its own authorize could refuse your signature for good).
  for (const node of [d.rpc, d.rpcCheck].filter(Boolean) as string[]) {
    let code: boolean;
    try { code = await d.hasCode(node, config.owner); } catch (e) { throw new Error(`Couldn't check whether ${config.owner} is a contract on ${node} (${(e as Error).message}). Nothing was sent. Try again later.`); }
    if (code) throw new Error(`${config.owner} is a contract (it has code on chain). The owner must be a person's wallet. Nothing was sent.`);
  }
  d.log(`Race picks contract ${d.race}${d.mainnet ? "   ⚠ MAINNET" : ""}`);
  d.log(`  Owner now      ${cur.owner}`);
  d.log(`  New owner      ${config.owner}`);
  d.log(`  Kept as is     picks ${config.enabled ? "ON" : "off"}, ${config.max_picks_per_day} per wallet per day`);
  d.log(`  Typed twice    ${confirm === undefined ? "not yet (add --confirm <the same address>)" : "✔ both match"}`);
  d.log(`  New key held   ${proof === undefined ? "not checked (put NEW_OWNER_WIF in .env for the send)" : "✔ NEW_OWNER_WIF is this address"}`);
  for (const n of notes) d.log(`  ${n}`);
  d.log("  This is ONE step and takes effect at once: after it, only the new owner can change the Race picks settings.");
  if (!send) { d.log("\nDry run only. Nothing was sent."); return false; }
  const r = await d.send(config);
  if (!r.ok) {
    d.log(`✖ not done: ${r.error}`);
    d.log("Don't send it again yet. Run npm run racepicks -- status in a few minutes to see who the owner is.");
    return false;
  }
  d.log(`Sent: transaction ${r.txId} (Mana used ${showKoin(r.rcUsed ?? "0")}). Reading it back…`);
  const problems: string[] = [];
  for (const node of [d.rpc, d.rpcCheck].filter(Boolean) as string[]) {
    let after: any;
    try { after = await d.readConfig(node); } catch (e) { problems.push(`${node}: couldn't read the settings (${(e as Error).message})`); continue; }
    if (after?.owner !== config.owner) problems.push(`${node}: owner reads ${after?.owner}, not ${config.owner}`);
    if (!!after?.enabled !== config.enabled) problems.push(`${node}: picks read ${after?.enabled ? "ON" : "off"}`);
    if (Number(after?.max_picks_per_day ?? 0) !== config.max_picks_per_day) problems.push(`${node}: picks per day read ${after?.max_picks_per_day}`);
  }
  if (problems.length) {
    d.log(`⚠ The read-back doesn't match yet:\n  ${problems.join("\n  ")}`);
    d.log("Don't send anything else. Wait a few minutes, then run npm run racepicks -- status and tell the Race chat what it shows.");
    return false;
  }
  d.log(`✔ Done. The race contract's owner is now ${config.owner} on ${d.rpcCheck ? "both nodes" : "the node"}; every other setting is unchanged.`);
  d.log("Next: take NEW_OWNER_WIF (and the old OWNER_WIF) out of .env.");
  return true;
}

function ownerDeps(): OwnerDeps {
  const { g, rpc } = game();
  const race = raceAddress();
  if (!race) throw new Error("No race contract yet.");
  const rpcCheck = E.RPC_CHECK && E.RPC_CHECK !== "off" && E.RPC_CHECK !== rpc ? E.RPC_CHECK : undefined;
  const provider = new Provider([rpc]);
  return {
    rpc, rpcCheck, mainnet: isMainnet(rpc), race, g, picks: readJson(path.join("picks-data", "deployment.json"))?.contract ?? null, env: E,
    readConfig: (node) => read(new Provider([node]), race, "get_config"),
    hasCode: async (node, address) => (await contractMetadata(new Provider([node]), address)).exists,
    signerAddress: () => Signer.fromWif(need("OWNER_WIF")).getAddress(),
    proofAddress: () => (E.NEW_OWNER_WIF ? Signer.fromWif(E.NEW_OWNER_WIF).getAddress() : undefined),
    send: async (config) => {
      const cur = await read(provider, race, "get_config");
      const signer = ownerKey(provider, cur.owner);
      return new KoinosChain(rpc, signer.getAddress()).send([{ contract: race, abi: loadAbi(), method: "set_config", args: { config } }], [signer], { payer: signer.getAddress(), rcLimitKoin: 2 });
    },
    log,
  };
}

/** The value after a flag (--confirm <address>), or undefined. */
export const flagValue = (a: string[], flag: string) => { const i = a.indexOf(flag); return i >= 0 && a[i + 1] && !a[i + 1].startsWith("--") ? a[i + 1] : (i >= 0 ? "" : undefined); };

async function main() {
  const [cmd = "status", ...a] = process.argv.slice(2);
  const send = a.includes("--send");
  switch (cmd) {
    case "status": return status();
    case "upload": return upload(send);
    case "setup": return setConfig(send, () => ({ enabled: true, perDay: DEFAULT_PICKS_PER_DAY }), true);
    // A 0 value (no limit, v2) is left out of the chain's answer, so a missing value is 0, never the default.
    case "enable": return setConfig(send, (c) => ({ enabled: true, perDay: Number(c.max_picks_per_day ?? 0) }), false);
    case "disable": return setConfig(send, (c) => ({ enabled: false, perDay: Number(c.max_picks_per_day ?? 0) }), false);
    case "limit": return setConfig(send, (c) => ({ enabled: !!c.enabled, perDay: Number(a[0]) }), false);
    case "owner": {
      const next = a[0] && !a[0].startsWith("--") ? a[0] : "";
      const ok = await changeOwner(next, flagValue(a, "--confirm"), send, ownerDeps());
      if (send && !ok) process.exitCode = 1;
      return;
    }
    default: throw new Error(`Unknown command "${cmd}". Commands: status, upload, setup, enable, disable, limit <n>, owner <address>`);
  }
}
if (process.argv[1] && /race-picks\.ts$/.test(process.argv[1])) {
  main().catch((e) => { console.error(`\n✖ ${e.message ?? e}`); process.exit(1); });
}
