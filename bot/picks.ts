/**
 * KNODEGAMES PICKS TOOL: put the Picks contract (picks/) on chain, register Who Signs Block X, and run tests on the
 * Koinos testnet. Every command that sends is a dry run (it only shows what it would do) unless you add --send.
 * Add --testnet to work on the Koinos Foundation testnet (keys in .env.testnet, settings in testnet/blockx.json).
 * Without it, the command is for MAINNET (keys in .env, settings in picks-data/deployment.json), and a mainnet send also
 * needs --mainnet on the command line (and CONFIRM_MAINNET=yes in .env), so a forgotten --testnet never reaches mainnet.
 *
 *   npm run picks -- keys [--testnet]                make PICKS_WIF (the contract's own new wallet) if it is missing
 *   npm run picks -- build-testnet --testnet         build the testnet version (audited code, test owner, 10-min waits)
 *   npm run picks -- status [--testnet]              the contract on chain: code, overrides, owner, games, announcements
 *   npm run picks -- upload [--testnet] [--send]     put the contract on the PICKS_WIF wallet, all three overrides ON
 *   npm run picks -- announce <id> [--testnet] [--send]   announce a game (owner's key); it can be applied after the wait
 *   npm run picks -- apply <id> [--testnet] [--send]      put an announced game in force (any key; the tool uses OWNER_WIF)
 *   npm run picks -- pause <id> [--testnet] [--send]      switch a game off at once (owner's key)
 *   npm run picks -- owner-propose <address> [--testnet] [--send]   hand the contract to a new owner, step 1 (owner's key;
 *                                                   refuses while a game announcement or an upgrade is waiting)
 *   npm run picks -- owner-accept [--testnet] [--send]   step 2, from 48 h to 7 days later, signed by NEW_OWNER_WIF
 *   npm run picks -- owner-cancel [--testnet] [--send]   withdraw a proposal that hasn't been accepted (owner's key)
 *   npm run picks -- owner-sync [--testnet]          read the owner on both nodes and write it into the deployment file
 *                                                   (no transaction): after an accept whose read-back didn't agree in time
 *   npm run picks -- lock-test <id> --testnet --send      send one pick per block across a target's lock, report each
 *   npm run picks -- mana-test <id> --testnet --send      send 1, 3 and 7 picks in one transaction each, report the Mana
 *
 * Keys come from the root .env / .env.testnet (never GitHub, never printed):
 *   PICKS_WIF   a brand-new wallet that becomes the Picks contract. Needed for the upload only; once uploaded, the
 *               contract decides for its own account (it refuses to move anything or pay Mana; new code needs the
 *               owner's key and the timelock), so this key has no power left. Never send it KOIN: it would be stuck.
 *   PAYER_WIF   pays the upload's Mana (both sign the upload). Default: OPERATOR_WIF (the bot wallet, which holds KOIN).
 *   OWNER_WIF   the KnodeGames owner (mainnet: 1635QUr…H717; testnet: the test owner from npm run bot -- keys --testnet).
 *   PLAYER_WIF  testnet only: the test player for lock-test and mana-test.
 *   NEW_OWNER_WIF  owner-accept only: the proposed new owner's key (put it in .env for that one command, then take it
 *               out). That wallet pays its own Mana for the accept, so it needs a little KOIN.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { Signer, Provider, Contract, Transaction, utils } from "koilib";
import { showKoin, toSat } from "./chain.ts";
import { contractMetadata } from "./chaincheck.ts";
import { isMainnet, TESTNET } from "./bot.ts";
await import("../blockx-math.js");
const X: any = (globalThis as any).KBlockX;

const E = process.env;
const log = (...a: any[]) => console.log(...a);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isAddr = (a: unknown): a is string => typeof a === "string" && /^1[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(a);
const sha256hex = (b: Uint8Array) => crypto.createHash("sha256").update(b).digest("hex");
const readJson = (f: string, d: any = null) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : d);
const writeJson = (f: string, v: any) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(v, null, 2) + "\n"); };

/** The audited Picks build (picks/README.md "Build"; audit + fix-check 2026-10-27). Mainnet upload refuses any other. */
export const PICKS_SHA256 = "700c296a1064b904299c156061d6caf8fcabd0b1765968903f29d89d2426c594";
/** The owner built into the audited code (before any handover). After a handover the owner is read from
 *  picks-data/deployment.json ("owner"), and every owner command checks it against the chain (R-BX-3, D-096). */
export const MAINNET_OWNER = "1635QUrBNDp7WqmFkRvrkGwjJXTtFvH717";
/** The mainnet owner this tool works for: the deployment file's "owner" once it has one, else the built-in owner. */
export function mainnetOwner(st: any = readJson(MAINNET_STATE)): string { return isAddr(st?.owner) ? st.owner : MAINNET_OWNER; }
export const MAINNET_CHAIN_ID = "EiBZK_GGVP0H_fXVAM3j6EAuz3-B-l3ejxRSewi7qIBfSA==";
const MAINNET_RPCS = ["https://koinos.armana.io", "https://api.koinosblocks.com"];
/** Audit BX-9/BX-20: the second, independent mainnet node every on-chain check also asks (RPC_CHECK overrides). */
const MAINNET_CHECK_RPC = () => E.RPC_CHECK && E.RPC_CHECK !== "off" ? E.RPC_CHECK : "https://api.koinosblocks.com";
/** Audit BX-21: the Picks ABI the owner calls are encoded with (picks/abi/picks.koilib.json, from the audited build). */
export const PICKS_ABI_SHA256 = "8efa3ad40d3d0bd9a3bfe22533fa2f9ca14445174095c66d3d34b1fc88e0a1ff";
const ABI_FILE = "picks/abi/picks.koilib.json";
const MAINNET_WASM = "picks/build/release/contract.wasm";
const TESTNET_WASM = "picks/build/testnet/contract.wasm", TESTNET_MANIFEST = "picks/build/testnet/manifest.json";
const MAINNET_STATE = path.join("picks-data", "deployment.json");
const TESTNET_CONFIG = path.join("testnet", "blockx.json");
/** Mainnet games this tool may register: Who Signs Block X, exactly as in claude/builds/03-block-x-plan.md. */
// R-BX-25: game 12 is hourly Block X (a target every 1,200 blocks) from Mon 16 Nov 2026; game 2 stops at that switch
// (its round size can never change on the contract, sameShape). `npm run picks -- announce 12`, then `apply 12` 48 h later.
/** Producer Bracket, Picks game 9 (owner 11 Nov; the Bracket chat's settings, claude/bracket/TO-LIBRARY-AND-BLOCKX-BRACKET-2026-11-11.md):
 *  a NUMBER game (the pick is a bit mask over up to 32 seeds, 0 … 2^31 − 1), locked by TIME (ms). One round a week whose target
 *  is Tuesday 00:00 UTC; picks lock 5 minutes before it and open 46 hours before it (Sunday 02:00 UTC, after the seeding).
 *  The SHAPE (id, kind, list_size, number range, lock_mode, round_size, round_offset) can never change once applied. */
const DAY_MS = 86400000, WEEK_MS = 7 * DAY_MS;
export const BRACKET_GAME = Object.freeze({ id: 9, name: "Producer Bracket", kind: 3, round: WEEK_MS, offset: (X.GENESIS + DAY_MS) % WEEK_MS,
  lead: 5 * 60000, ahead: 46 * 3600000, numberMax: 2 ** 31 - 1, picksPerDay: 20, maxChanges: 20 });
/** Fantasy, Picks games 4 and 5 (the Fantasy chat's values, claude/fantasy/TO-BLOCKX-PICKS-GAMES-4-5-VALUES-2026-11-12.md;
 *  the same as its testnet registration, fantasy-math.js games(); the owner confirms the shapes). Both TIME-locked, one
 *  round a UTC day (round = day number; the target is 00:00 UTC), locking 5 minutes before (Fantasy's lock block
 *  L = blockAt(target − lead) − 1 relies on exactly 5 minutes) and opening 7 days ahead. The SHAPE never changes. */
export const FANTASY_TEAM_GAME = Object.freeze({ id: 4, name: "Fantasy Producers", kind: 2, listSize: 5, lockMode: 2, round: DAY_MS, offset: 0,
  lead: 5 * 60000, ahead: 7 * DAY_MS, picksPerDay: 20, maxChanges: 20 });
export const FANTASY_RIVAL_GAME = Object.freeze({ id: 5, name: "Weekly Rival", kind: 1, listSize: 1, lockMode: 2, round: DAY_MS, offset: 0,
  lead: 5 * 60000, ahead: 7 * DAY_MS, picksPerDay: 10, maxChanges: 5 });
const MAINNET_GAMES: any[] = [{ ...X.MAINNET_GAME, name: "Who Signs Block X" }, { ...X.MAINNET_HOURLY, name: "Who Signs Block X (hourly)" }, BRACKET_GAME, FANTASY_TEAM_GAME, FANTASY_RIVAL_GAME];
/** The picks per wallet per day and changes per pick the Picks contract allows at most. */
const MAX_PICKS_PER_DAY = 50, MAX_CHANGES = 50;

const loadAbi = () => {
  if (!fs.existsSync(ABI_FILE)) throw new Error(`${ABI_FILE} not found: in the picks folder run npm ci --ignore-scripts, npm test`);
  const raw = fs.readFileSync(ABI_FILE);
  if (sha256hex(raw) !== PICKS_ABI_SHA256) throw new Error(`${ABI_FILE} is not the audited Picks ABI (sha256 ${sha256hex(raw)}). Restore it: git checkout -- ${ABI_FILE}`);
  return JSON.parse(raw.toString("utf8"));
};
const need = (k: string) => { if (!E[k]) throw new Error(`${k} is missing from ${TESTNET ? ".env.testnet" : ".env"} (npm run picks -- keys${TESTNET ? " --testnet" : ""})`); return E[k]!; };

// ═══════════════════════════════ the network ═══════════════════════════════
type Net = { testnet: boolean; rpc: string[]; chainId: string | null; owner: string; picks: string | null; games: any[]; cfg: any; nextOwner?: string | null };
/** Where this command works. Testnet: testnet/blockx.json. Mainnet: picks-data/deployment.json and the audited facts. */
export function network(testnet = TESTNET): Net {
  if (testnet) {
    const cfg = readJson(TESTNET_CONFIG);
    if (!cfg || cfg.network !== "koinos-foundation-testnet") throw new Error(`${TESTNET_CONFIG} is missing or not a testnet config.`);
    if (cfg.chainId === MAINNET_CHAIN_ID) throw new Error(`${TESTNET_CONFIG} names the MAINNET chain id. Refusing.`);
    // Repo Lens #D-12 F-3: after a testnet handover the owner is the config's "owner" (written by owner-accept / owner-sync).
    const owner = isAddr(cfg.owner) ? cfg.owner : readJson(TESTNET_MANIFEST)?.owner ?? (E.OWNER_WIF ? Signer.fromWif(E.OWNER_WIF).getAddress() : "");
    return { testnet: true, rpc: [E.TESTNET_RPC || cfg.rpc], chainId: cfg.chainId ?? null, owner, picks: isAddr(cfg.picks) ? cfg.picks : null, games: cfg.games, cfg, nextOwner: isAddr(cfg.nextOwner) ? cfg.nextOwner : null };
  }
  const st = readJson(MAINNET_STATE);
  // Audit BX-47: one primary node only (koilib would quietly fall back to the second, which is the check node).
  return { testnet: false, rpc: [E.RPC || MAINNET_RPCS[0]], chainId: MAINNET_CHAIN_ID, owner: mainnetOwner(st), picks: isAddr(st?.contract) ? st.contract : null, games: MAINNET_GAMES, cfg: st, nextOwner: isAddr(st?.nextOwner) ? st.nextOwner : null };
}
/** A provider for the network, after checking the node is on the expected chain (never sign for the wrong one). */
async function connect(net: Net) {
  const p = new Provider(net.rpc);
  const id = await p.getChainId();
  if (net.testnet && id === MAINNET_CHAIN_ID) throw new Error(`The node ${net.rpc[0]} is on MAINNET, but this is a --testnet command. Nothing was sent.`);
  if (net.chainId && id !== net.chainId) throw new Error(`The node ${net.rpc[0]} is on chain ${id}, expected ${net.chainId}. Nothing was sent.`);
  if (!net.testnet && !isMainnet(net.rpc[0])) throw new Error("This is a mainnet command, but the node looks like a testnet one. Add --testnet, or fix RPC in .env.");
  return { p, chainId: id };
}
/** A mainnet send needs --mainnet on the command line every time (review 2026-10-28: CONFIRM_MAINNET=yes is already in
 *  .env from npm run bot -- keys, so a forgotten --testnet must not be enough to reach mainnet), plus CONFIRM_MAINNET. */
export function mainnetGuard(net: { testnet: boolean }, send: boolean, argv = process.argv) {
  if (!send || net.testnet) return;
  if (!argv.includes("--mainnet")) throw new Error("This would send to MAINNET. Did you mean --testnet? For mainnet, add --mainnet to the command. Nothing was sent.");
  if (E.CONFIRM_MAINNET !== "yes") throw new Error("MAINNET: add CONFIRM_MAINNET=yes to .env first.");
}

// ═══════════════════════════════ keys ═══════════════════════════════
function signerOf(k: string, p: Provider) { const s = Signer.fromWif(need(k)); s.provider = p; return s; }
/** The contract's own wallet: brand-new, never the owner or player. */
function picksKey(net: Net, p: Provider) {
  const s = signerOf("PICKS_WIF", p), a = s.getAddress();
  const taken: Record<string, string> = { [net.owner]: "the owner wallet", [MAINNET_OWNER]: "the mainnet owner", [mainnetOwner()]: "the mainnet owner", "1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr": "the game contract",
    "1EN7xU8R9tQXjHvrX79qZvvvGkkKWVnB5K": "the race contract", "1ByDDSBUzy5zkRceELc54Jh8i41yNRoKt8": "the Mana sponsor", "1FKTpXBhhHEbu5vVchM8UsVbAvPArJsRmR": "Knode Swap" };
  if (E.PLAYER_WIF) taken[Signer.fromWif(E.PLAYER_WIF).getAddress()] = "the test player";
  const mainPicks = readJson(MAINNET_STATE)?.contract;
  if (net.testnet && isAddr(mainPicks)) taken[mainPicks] = "the MAINNET Picks contract";
  if (taken[a]) throw new Error(`PICKS_WIF is ${taken[a]}'s key. The Picks contract needs a brand-new wallet of its own.`);
  if (net.picks && net.picks !== a) throw new Error(`PICKS_WIF belongs to ${a}, but the settings say the Picks contract is ${net.picks}.`);
  return s;
}
function ownerKey(net: Net, p: Provider) {
  const s = signerOf("OWNER_WIF", p);
  if (s.getAddress() !== net.owner) throw new Error(`OWNER_WIF belongs to ${s.getAddress()}, not the Picks owner ${net.owner}.`);
  return s;
}
/** keys: add PICKS_WIF to the env file if it is missing. Prints the address, never the key. */
function keys() {
  const file = path.resolve(TESTNET ? ".env.testnet" : ".env");
  let text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  if (/^PICKS_WIF=/m.test(text)) { log(`PICKS_WIF already exists in ${file}: ${Signer.fromWif(text.match(/^PICKS_WIF=(.*)$/m)![1].trim()).getAddress()}`); return; }
  const wif = Signer.fromSeed(crypto.randomBytes(32).toString("hex")).getPrivateKey("wif");
  text = (text.trim() ? text.replace(/\s*$/, "\n") : "") + `PICKS_WIF=${wif}\n`;
  fs.writeFileSync(file, text, { mode: 0o600 });
  try { fs.chmodSync(file, 0o600); } catch {}
  log(`Added PICKS_WIF (new) to ${file}. The Picks contract will live at:\n  ${Signer.fromWif(wif).getAddress()}`);
  log("Don't send KOIN to this address: once the contract is uploaded it refuses to move anything out of its own account,");
  log("so anything sent there stays there for good. The upload's Mana is paid by another wallet (PAYER_WIF, else OPERATOR_WIF).");
  if (!TESTNET) log("Write its recovery key down offline (it is only needed for the upload, but keep it until the upload is checked).");
}

// ═══════════════════════════════ reads ═══════════════════════════════
async function read(p: Provider, id: string, method: string, args: any = {}) {
  const c = new Contract({ id, abi: loadAbi(), provider: p });
  return ((await (c.functions as any)[method](args)).result) ?? {};
}

async function status() {
  const net = network();
  if (!net.picks) { log(`No Picks contract yet. Run: npm run picks -- keys${TESTNET ? " --testnet" : ""}, then upload.`); return; }
  const { p, chainId } = await connect(net);
  log(`Picks ${net.picks} on ${net.testnet ? "the Koinos TESTNET" : "MAINNET"} (${net.rpc[0]}, chain ${chainId})`);
  const m = await contractMetadata(p, net.picks);
  if (!m.exists) { log("  Contract       not uploaded yet (npm run picks -- upload)"); return; }
  const want = net.testnet ? readJson(TESTNET_MANIFEST)?.sha256 : PICKS_SHA256;
  const have = m.hash.replace(/^0x1220/, "");
  log(`  Code           sha256 ${have} ${have === want ? "✔ (the expected build)" : "⚠ NOT the expected build " + want}`);
  log(`  Overrides      ${m.call && m.tx && m.upload ? "✔ all three ON (the contract decides for its own account)" : "⚠ NOT all on: the upload key still controls it. Do not announce games."}`);
  try { const n = await assertAuditedContract(net, p); log(`  Checked on     ${n} node${n > 1 ? "s (both agree)" : " (the testnet has one public node)"} ✔`); }
  catch (e) { log(`  ⚠ ${(e as Error).message}`); }
  const cfg = await read(p, net.picks, "get_config");
  log(`  Owner          ${cfg.owner}${cfg.owner === net.owner ? " ✔" : " ⚠ not " + net.owner + " (the settings' owner): fix picks-data/deployment.json"}`);
  if (cfg.pending_owner) { const eta = Number(cfg.pending_owner_eta ?? 0); log(`  Handover       proposed to ${cfg.pending_owner}: it can accept from ${new Date(eta).toISOString()} until ${new Date(eta + 7 * 86400000).toISOString()}${Date.now() >= eta + 7 * 86400000 ? " (EXPIRED: propose again)" : ""}`); }
  if (cfg.upgrade_eta && cfg.upgrade_eta !== "0") log(`  Upgrade        announced: ${cfg.upgrade_hash}, from ${new Date(Number(cfg.upgrade_eta)).toISOString()}`);
  const games = (await read(p, net.picks, "list_games")).games ?? [];
  log(`  Games          ${games.length ? "" : "none yet (npm run picks -- announce 2)"}`);
  for (const g of games) log(Number(g.lock_mode) === 2
    ? `    ${g.id} ${g.name}: ${g.enabled ? "ON" : "off"}, kind ${g.kind}, a round every ${Number(g.round_size) / 3600000} h (offset ${g.round_offset} ms), locks ${Number(g.lead) / 60000} min before, opens ${Number(g.ahead) / 3600000} h ahead, ${g.max_picks_per_day} picks a day, ${g.max_changes} changes`
    : `    ${g.id} ${g.name}: ${g.enabled ? "ON" : "off"}, every ${g.round_size} blocks, locks ${g.lead} before, opens ${g.ahead} ahead, ${g.max_picks_per_day} picks a day, ${g.max_changes} changes`);
  const pend = (await read(p, net.picks, "list_pending", { limit: 50 })).pending ?? [];
  for (const x of pend) log(`  Announced      game ${x.game?.id} (${x.game?.name}): can be applied from ${new Date(Number(x.eta)).toISOString()}${Date.now() >= Number(x.eta) ? " — ready now: npm run picks -- apply " + x.game?.id : ""}`);
  log(`  Mana           contract wallet ${showKoin(await p.getAccountRc(net.picks))}`);
}

// ═══════════════════════════════ upload ═══════════════════════════════
/** The build to upload and why it is the right one. Exported for the tests. */
export function uploadBuild(testnet: boolean, files = { mainnet: MAINNET_WASM, testnet: TESTNET_WASM, manifest: TESTNET_MANIFEST }) {
  if (!testnet) {
    if (!fs.existsSync(files.mainnet)) throw new Error(`${files.mainnet} not found: in the picks folder run npm ci --ignore-scripts, npm test`);
    const wasm = fs.readFileSync(files.mainnet), h = sha256hex(wasm);
    if (h !== PICKS_SHA256) throw new Error(`${files.mainnet} is not the audited Picks build (sha256 ${h}, expected ${PICKS_SHA256}). Rebuild: cd picks, npm ci --ignore-scripts, npm test (best in a clean copy with no .env).`);
    return { wasm, sha256: h, what: "the audited mainnet build" };
  }
  const man = readJson(files.manifest);
  if (!man || !fs.existsSync(files.testnet)) throw new Error("No testnet build yet: npm run picks -- build-testnet --testnet");
  const wasm = fs.readFileSync(files.testnet), h = sha256hex(wasm);
  if (man.auditedSha256 !== PICKS_SHA256) throw new Error(`The testnet build was made from ${man.auditedSha256}, not the audited ${PICKS_SHA256}. Rebuild it.`);
  if (man.sha256 !== h) throw new Error("The testnet build doesn't match its manifest. Rebuild it: npm run picks -- build-testnet --testnet");
  if (h === PICKS_SHA256) throw new Error("The testnet build is the mainnet build (its owner would be the mainnet owner). Rebuild it.");
  return { wasm, sha256: h, what: `the testnet build (audited code, owner ${man.owner}, waits of ${man.timelockMs / 60000} min)` };
}

/** The upload transaction: the Picks wallet signs the upload (all three overrides on), another wallet signs to pay
 *  the Mana. Exported for the tests (with a nonce given, it needs no node until it is sent). */
export async function uploadTx(p: Provider, s: Signer, payer: Signer, wasm: Uint8Array, abi: any, chainId: string, rc: bigint, nonce?: string) {
  const A = s.getAddress();
  const c = new Contract({ id: A, abi, provider: p, signer: s, bytecode: new Uint8Array(wasm) });
  const { operation } = await c.deploy({ abi: JSON.stringify(abi), authorizesCallContract: true, authorizesTransactionApplication: true, authorizesUploadContract: true, onlyOperation: true } as any);
  const tx = new Transaction({ signer: s, provider: p, options: { payer: payer.getAddress(), chainId, rcLimit: rc.toString(), ...(nonce ? { nonce } : {}) } });
  await tx.pushOperation(operation);
  await tx.prepare();
  await tx.sign();                                    // the Picks wallet authorizes the upload
  await payer.signTransaction(tx.transaction as any); // the payer authorizes paying its Mana
  return tx;
}

async function upload(send: boolean) {
  const net = network();
  mainnetGuard(net, send);
  const { p, chainId } = await connect(net);
  const s = picksKey(net, p), A = s.getAddress();
  const b = uploadBuild(net.testnet);
  const m = await contractMetadata(p, A);
  if (m.exists) throw new Error(`${A} already has a contract (sha256 ${m.hash}). See npm run picks -- status.`);
  // Audit BX-22: the Picks wallet must be brand new and empty: once uploaded it can never move anything out.
  const koinId = net.testnet ? net.cfg?.koin : "19GYjDBVXU7keLbYvMLazsGQn3GTWHjHkK";
  const held = koinId ? BigInt(((await (new Contract({ id: koinId, abi: utils.tokenAbi, provider: p }).functions as any).balanceOf({ owner: A })).result?.value) ?? "0") : 0n;
  const used = BigInt(await p.getNonce(A).catch(() => 0));
  if (held > 0n) throw new Error(`The Picks wallet ${A} holds ${showKoin(held)} KOIN. Once uploaded it could never move it out. Use a brand-new, empty wallet (delete PICKS_WIF from the env file and run keys again), or move the KOIN out first.`);
  if (used > 0n) throw new Error(`The Picks wallet ${A} has already sent transactions. Use a brand-new wallet.`);
  const abi = loadAbi();
  // The Mana is paid by another wallet, so the Picks wallet never needs KOIN (anything it held would be stuck there).
  const payerKey = E.PAYER_WIF ? "PAYER_WIF" : "OPERATOR_WIF";
  if (!E[payerKey]) throw new Error(`${payerKey} is missing from ${net.testnet ? ".env.testnet" : ".env"}: the wallet that pays the upload's Mana.`);
  const payer = signerOf(payerKey, p), PA = payer.getAddress();
  if (PA === A) throw new Error(`${payerKey} is the Picks wallet itself; use another wallet to pay the Mana.`);
  const have = BigInt(await p.getAccountRc(PA));
  // Mainnet storage costs far more Mana than the testnet's (2026-10-30: two mainnet sends with a 17-Mana limit were
  // refused "insufficient rc" with 103 Mana in the payer wallet; nothing was charged). The same estimate as the sponsor
  // upload on mainnet: 1.2 Mana per KB + 10 (about 49 for 31.9 KB). The testnet upload of 31.9 KB used 2.8.
  const needRc = toSat(Math.ceil(b.wasm.length / 1024 * (net.testnet ? 0.35 : 1.2) + (net.testnet ? 5 : 10)));
  log(`Picks wallet       ${A}${net.testnet ? "  (testnet)" : "   ⚠ MAINNET"}  (send it no KOIN)`);
  log(`Code               ${b.what}, ${(b.wasm.length / 1024).toFixed(1)} KB, sha256 ${b.sha256}`);
  log(`Overrides          all three ON: it refuses to move anything or pay Mana; new code only by the owner after the wait`);
  log(`Mana paid by       ${PA} (${payerKey}): has ${showKoin(have)}, the upload may use up to ${showKoin(needRc)} (Mana not used is not charged)`);
  // Audit BX-34: the transaction uses the payer's nonce. If the payer is the hourly bot's wallet (OPERATOR_WIF), a bot
  // transaction at the same moment can take that nonce and this upload is refused (nothing happens; run it again).
  if (payerKey === "OPERATOR_WIF") log(`                   (tip: set PAYER_WIF to a wallet the hourly bot doesn't use, so their nonces can't collide)`);
  if (have < needRc) throw new Error(`${PA} needs at least ${showKoin(needRc)} Mana; it has ${showKoin(have)}. Send it ${net.testnet ? "test KOIN (faucet)" : "KOIN"} first.`);
  if (!send) { log("\nDry run only. Nothing was sent. Run again with --send to upload."); return; }
  const tx = await uploadTx(p, s, payer, b.wasm, abi, chainId, needRc);
  const receipt: any = await tx.send();
  if (receipt?.reverted) throw new Error(`upload reverted: ${JSON.stringify(receipt.logs)}`);
  await tx.wait("byBlock", 300_000).catch(() => { throw new Error("Sent but not confirmed within 5 minutes. Check npm run picks -- status in a few minutes."); });
  // Audit BX-9/BX-20: the code and all three overrides, confirmed on two nodes on mainnet, before anything else.
  try { await assertAuditedContract({ testnet: net.testnet, picks: A, cfg: net.cfg }, p, contractMetadata, b.sha256); }
  catch (e) { throw new Error(`Uploaded, but not as expected: ${(e as Error).message} Do not announce games; check npm run picks -- status.`); }
  const rec = { contract: A, wasmSha256: b.sha256, uploadTx: tx.transaction?.id, uploadedAt: new Date().toISOString() };
  if (net.testnet) writeJson(TESTNET_CONFIG, { ...net.cfg, chainId, picks: A, picksSha256: b.sha256, vhp: net.cfg.vhp ?? (await findVhp(p)) ?? null, uploadTx: rec.uploadTx, uploadedAt: rec.uploadedAt });
  else writeJson(MAINNET_STATE, { network: "mainnet", rpc: net.rpc[0], ...rec });
  log(`✔ uploaded (Mana used ${showKoin(receipt?.rc_used)}). Saved ${net.testnet ? TESTNET_CONFIG : MAINNET_STATE} (public; commit it). Next: npm run picks -- announce 2${net.testnet ? " --testnet" : ""}`);
}
/** The VHP token on a testnet: the contract whose burn event every block has (the block reward burns VHP). */
async function findVhp(p: Provider): Promise<string | null> {
  try {
    const head: any = await p.getHeadInfo();
    const h = Number(head.head_topology.height);
    const res: any = await p.call("block_store.get_blocks_by_height", { head_block_id: head.head_topology.id, ancestor_start_height: String(Math.max(1, h - 20)), num_blocks: 20, return_block: false, return_receipt: true });
    const burn = new Map<string, number>();
    for (const it of res.block_items ?? []) for (const ev of it.receipt?.events ?? []) if (/burn/i.test(ev.name ?? "")) burn.set(ev.source, (burn.get(ev.source) ?? 0) + 1);
    const koin = readJson(TESTNET_CONFIG)?.koin;
    for (const [id] of [...burn.entries()].sort((a, b) => b[1] - a[1])) {
      if (id === koin || !isAddr(id)) continue;
      const sym: any = await p.call("chain.read_contract", { contract_id: id, entry_point: 0xb76a7ca1, args: "" }).catch(() => null);   // symbol()
      const txt = sym?.result ? Buffer.from(utils.decodeBase64url(sym.result)).toString("utf8") : "";
      if (/VHP/.test(txt)) return id;
    }
    return null;
  } catch { return null; }
}

// ═══════════════════════════════ games ═══════════════════════════════
/** The game_config the contract takes for a Block X game (one producer, locked by block height). Exported for the tests. */
export function buildGameConfig(g: any, enabled = true) {
  if (g.kind === 3) return bracketConfig(g, enabled);
  if (g.lockMode === 2) return timeListConfig(g, enabled);
  X.forGame(g);   // the contract's own limits for a height game (lead ≥ 100, ahead > lead, ...)
  if (typeof g.name !== "string" || !g.name || Buffer.byteLength(g.name) > 40) throw new Error("A game needs a name of 1 to 40 bytes.");
  if (!(g.id >= 1 && g.id < 128)) throw new Error("Game ids are 1 to 127.");
  if (!(g.picksPerDay >= 1 && g.picksPerDay <= MAX_PICKS_PER_DAY)) throw new Error("Picks per day must be 1 to 50.");
  if (!(g.maxChanges >= 0 && g.maxChanges <= MAX_CHANGES)) throw new Error("Changes must be 0 to 50.");
  return { id: g.id, name: g.name, kind: 1, list_size: 1, number_min: "0", number_max: "0", lock_mode: 1, round_size: String(g.round), round_offset: String(g.offset),
    lead: String(g.lead), ahead: String(g.ahead), max_picks_per_day: g.picksPerDay, max_changes: g.maxChanges, enabled };
}
/** The Bracket's number game (kind 3, time lock). Every limit the contract's checkGame applies, plus the Bracket's own pins. */
function bracketConfig(g: any, enabled: boolean) {
  const ok = (c: boolean, why: string) => { if (!c) throw new Error(`Bracket game: ${why}.`); };
  if (typeof g.name !== "string" || !g.name || Buffer.byteLength(g.name) > 40) throw new Error("A game needs a name of 1 to 40 bytes.");
  ok(g.id >= 1 && g.id < 128, "game ids are 1 to 127");
  ok(Number.isSafeInteger(g.round) && Number.isSafeInteger(g.offset) && g.round >= 1 && g.offset >= 0 && g.offset < g.round, "round_size at least 1 and above round_offset");
  ok(Number.isSafeInteger(g.lead) && g.lead >= 300000, "lead at least 5 minutes");
  ok(Number.isSafeInteger(g.ahead) && g.ahead > g.lead && g.ahead <= 35 * DAY_MS, "ahead above lead and at most 35 days");
  // The Bracket's own rule (bot/games/bracket.ts gameProblem): picks open no earlier than the seeding, Sunday 00:00 UTC.
  ok(g.ahead <= 2 * DAY_MS, "ahead at most 48 hours (picks can't open before the seeding)");
  ok(Number.isSafeInteger(g.numberMax) && g.numberMax >= 0 && g.numberMax <= 2 ** 31 - 1, "number_max 0 to 2^31 − 1 (32 seeds)");
  if (!(g.picksPerDay >= 1 && g.picksPerDay <= MAX_PICKS_PER_DAY)) throw new Error("Picks per day must be 1 to 50.");
  if (!(g.maxChanges >= 0 && g.maxChanges <= MAX_CHANGES)) throw new Error("Changes must be 0 to 50.");
  return { id: g.id, name: g.name, kind: 3, list_size: 0, number_min: "0", number_max: String(g.numberMax), lock_mode: 2, round_size: String(g.round), round_offset: String(g.offset),
    lead: String(g.lead), ahead: String(g.ahead), max_picks_per_day: g.picksPerDay, max_changes: g.maxChanges, enabled };
}
/** Repo Lens #G-7 (G7-1): the announced game must be exactly the game this tool would announce, field by field, before an
 *  apply. A field the chain leaves out is its zero value ("", 0, "0", false). null = they match; otherwise why not. */
export function pendingProblem(pend: any, g: any): string | null {
  if (pend == null) return "nothing is announced for this game";
  const want: any = buildGameConfig(g);
  for (const k of Object.keys(want)) {
    const w = want[k];
    const zero = typeof w === "boolean" ? false : typeof w === "number" ? 0 : k === "name" ? "" : "0";
    const h = pend[k] ?? zero;
    const same = typeof w === "boolean" ? Boolean(h) === w : typeof w === "number" ? Number(h) === w : String(h) === w;
    if (!same) return `the announced ${k} is ${h}, this tool's is ${w}`;
  }
  return null;
}
/** A TIME-locked one-pick (kind 1) or list (kind 2) game, as Fantasy's: every limit the contract's checkGame applies. */
function timeListConfig(g: any, enabled: boolean) {
  const ok = (c: boolean, why: string) => { if (!c) throw new Error(`Game ${g.id}: ${why}.`); };
  if (typeof g.name !== "string" || !g.name || Buffer.byteLength(g.name) > 40) throw new Error("A game needs a name of 1 to 40 bytes.");
  ok(g.id >= 1 && g.id < 128, "game ids are 1 to 127");
  ok(g.kind === 1 ? g.listSize === 1 : g.kind === 2 && Number.isInteger(g.listSize) && g.listSize >= 2 && g.listSize <= 10, "a one-pick game has list_size 1, a list game 2 to 10");
  ok(Number.isSafeInteger(g.round) && Number.isSafeInteger(g.offset) && g.round >= 1 && g.offset >= 0 && g.offset < g.round, "round_size at least 1 and above round_offset");
  ok(Number.isSafeInteger(g.lead) && g.lead >= 300000, "lead at least 5 minutes");
  ok(Number.isSafeInteger(g.ahead) && g.ahead > g.lead && g.ahead <= 35 * DAY_MS, "ahead above lead and at most 35 days");
  if (!(g.picksPerDay >= 1 && g.picksPerDay <= MAX_PICKS_PER_DAY)) throw new Error("Picks per day must be 1 to 50.");
  if (!(g.maxChanges >= 0 && g.maxChanges <= MAX_CHANGES)) throw new Error("Changes must be 0 to 50.");
  return { id: g.id, name: g.name, kind: g.kind, list_size: g.listSize, number_min: "0", number_max: "0", lock_mode: 2, round_size: String(g.round), round_offset: String(g.offset),
    lead: String(g.lead), ahead: String(g.ahead), max_picks_per_day: g.picksPerDay, max_changes: g.maxChanges, enabled };
}
/** The next few rounds of a time-locked game, for the announce dry run: target, opens, locks (all UTC). */
export function timeRounds(g: { round: number; offset: number; lead: number; ahead: number }, now: number, n = 3) {
  const out: { round: number; target: string; opens: string; locks: string }[] = [];
  for (let r = Math.floor((now - g.offset) / g.round); out.length < n; r++) {
    const t = r * g.round + g.offset;
    if (t - g.lead <= now) continue;
    out.push({ round: r, target: new Date(t).toISOString(), opens: new Date(t - g.ahead).toISOString(), locks: new Date(t - g.lead).toISOString() });
  }
  return out;
}
function gameOf(net: Net, id: number) {
  const g = net.games.find((x) => x.id === id);
  if (!g) throw new Error(`Game ${id} is not one this tool registers on ${net.testnet ? "the testnet (testnet/blockx.json)" : "mainnet (Who Signs Block X is game 2, hourly game 12; Producer Bracket game 9; Fantasy games 4 and 5)"}.`);
  return g;
}
async function sendCall(net: Net, p: Provider, chainId: string, signer: Signer, method: string, args: any, rcKoin = 2) {
  const c = new Contract({ id: net.picks!, abi: loadAbi(), provider: p, signer });
  const { operation } = await (c.functions as any)[method](args, { onlyOperation: true });
  return sendOps(p, chainId, signer, [operation], rcKoin);
}
/** A nonce as the chain encodes it: koinos.chain.value_type with uint64_value (field 5, a varint), base64url. */
export function encodeNonce(n: number): string {
  const b: number[] = [0x28];
  let v = BigInt(n);
  do { let x = Number(v & 0x7fn); v >>= 7n; if (v > 0n) x |= 0x80; b.push(x); } while (v > 0n);
  return utils.encodeBase64url(new Uint8Array(b));
}
type SendOpts = { nonce?: number; wait?: boolean };
/** Send operations from one signer who pays its own Mana; report the block it landed in. With a nonce and wait false
 *  it only submits (for a pick per block, lock-test); call waitFor afterwards. Exported for the tests. */
export async function sendOps(p: Provider, chainId: string, signer: Signer, ops: any[], rcKoin = 2, o: SendOpts = {}) {
  const mana = BigInt(await p.getAccountRc(signer.getAddress()));
  const cap = toSat(rcKoin), limit = (mana * 95n) / 100n < cap ? (mana * 95n) / 100n : cap;
  const tx = new Transaction({ signer, provider: p, options: { payer: signer.getAddress(), chainId, rcLimit: limit.toString(), ...(o.nonce !== undefined ? { nonce: encodeNonce(o.nonce) } : {}) } });
  for (const op of ops) await tx.pushOperation(op);
  try {
    const receipt: any = await tx.send();
    if (receipt?.reverted) return { ok: false, error: `reverted: ${JSON.stringify(receipt.logs ?? [])}`, rcUsed: String(receipt?.rc_used ?? 0), txId: tx.transaction?.id, tx };
    if (o.wait === false) return { ok: true, rcUsed: String(receipt?.rc_used ?? 0), txId: tx.transaction?.id, tx };
    const w: any = await tx.wait("byBlock", 120_000).catch(() => null);
    return { ok: !!w, error: w ? undefined : "sent, not seen in a block within 2 minutes", rcUsed: String(receipt?.rc_used ?? 0), txId: tx.transaction?.id, block: w ? Number(w.blockNumber) : undefined };
  } catch (e) {
    return { ok: false, error: String((e as Error).message ?? e).slice(0, 300) };
  }
}

/** Audit BX-19: before the owner key signs anything for the Picks contract, check on chain that the address named in
 *  the settings holds exactly the expected build (mainnet: the audited one; testnet: the manifest's build) with all
 *  three overrides on. A wrong or edited deployment file can't make the owner sign for another contract. */
/** Audit BX-47: two node addresses are the same node when they match after trimming case and trailing slashes. */
export const sameNode = (a: string, b: string) => a.trim().toLowerCase().replace(/\/+$/, "") === b.trim().toLowerCase().replace(/\/+$/, "");
export async function assertAuditedContract(net: { testnet: boolean; picks: string | null; cfg?: any; rpc?: string[] }, p: Provider, meta = contractMetadata, want?: string, checkNodes?: Provider[]) {
  if (!net.picks) throw new Error("No Picks contract yet.");
  want = want ?? (net.testnet ? (readJson(TESTNET_MANIFEST)?.sha256 ?? net.cfg?.picksSha256) : PICKS_SHA256);
  if (!want) throw new Error("No expected build for the testnet Picks contract (picks/build/testnet/manifest.json).");
  // Audit BX-9/BX-20: on mainnet a second, independent node must say the same (the testnet has one public node).
  // Audit BX-47: it must be a different node from the first, and on the mainnet chain too.
  let extra = checkNodes;
  if (!extra && !net.testnet) {
    const url = MAINNET_CHECK_RPC();
    if ((net.rpc ?? MAINNET_RPCS).slice(0, 1).some((u) => sameNode(u, url))) throw new Error(`RPC_CHECK (${url}) is the same node as RPC: the check needs a second, independent node. Nothing was signed.`);
    const cp = new Provider([url]);
    // (Tests pass their own `meta` and no network: the chain id is checked on real runs.)
    if (meta === contractMetadata && (await cp.getChainId()) !== MAINNET_CHAIN_ID) throw new Error(`The check node ${url} is not on Koinos mainnet. Nothing was signed.`);
    extra = [cp];
  }
  const nodes = [p, ...(extra ?? [])];
  for (const [i, node] of nodes.entries()) {
    const where = nodes.length > 1 ? ` (node ${i + 1} of ${nodes.length})` : "";
    const m = await meta(node, net.picks);
    if (!m.exists) throw new Error(`${net.picks} has no contract on chain${where}. Nothing was signed.`);
    const have = String(m.hash).replace(/^0x1220/, "");
    if (have !== want) throw new Error(`${net.picks} holds code ${have}${where}, not the expected Picks build ${want}. Nothing was signed.`);
    if (!(m.call && m.tx && m.upload)) throw new Error(`${net.picks} does not have all three overrides on${where}. Nothing was signed.`);
  }
  return nodes.length;
}

async function announce(id: number, send: boolean) {
  const net = network();
  mainnetGuard(net, send);
  if (!net.picks) throw new Error("No Picks contract yet (npm run picks -- upload).");
  const { p, chainId } = await connect(net);
  await assertAuditedContract(net, p);
  const g = gameOf(net, id), cfg = buildGameConfig(g);
  const s = ownerKey(net, p);
  await ownerViews(net, p);   // R-BX-3: the settings' owner is the owner on chain, on both nodes
  const wait = net.testnet ? (readJson(TESTNET_MANIFEST)?.timelockMs ?? 600000) / 60000 + " minutes" : "48 hours";
  log(`Announce game ${id} "${g.name}" on ${net.testnet ? "the testnet" : "MAINNET"} (owner ${s.getAddress()}):`);
  if (g.kind === 3 || g.lockMode === 2) {
    log(g.kind === 3 ? `  SHAPE (never changes): kind 3 (number), list_size 0, numbers 0 … ${g.numberMax}, lock by TIME, round ${g.round} ms (${g.round / DAY_MS} days), offset ${g.offset} ms`
      : `  SHAPE (never changes): kind ${g.kind} (${g.kind === 1 ? "one pick" : "a list"}), list_size ${g.listSize}, lock by TIME, round ${g.round} ms (${g.round / DAY_MS} days), offset ${g.offset} ms`);
    log(`  lead ${g.lead} ms (${g.lead / 60000} min), ahead ${g.ahead} ms (${g.ahead / 3600000} h)`);
    for (const x of timeRounds(g, Date.now())) log(`    round ${x.round}: opens ${x.opens}, locks ${x.locks}, target ${x.target}`);
  } else log(`  one producer per target; a target every ${g.round} blocks; locks ${g.lead} blocks before; opens ${g.ahead} ahead (${X.forGame(g).openRounds(g.ahead * 10).length} targets open at a time)`);
  log(`  exact config sent: ${JSON.stringify(cfg)}`);
  log(`  ${g.picksPerDay} picks a day per wallet, ${g.maxChanges} changes per pick. It can be applied ${wait} after it is announced (anyone may apply it).`);
  if (!send) { log("\nDry run only. Nothing was sent. Add --send to send it."); return; }
  const r = await sendCall(net, p, chainId, s, "announce_game", { game: cfg });
  log(r.ok ? `✔ announced (Mana used ${showKoin(r.rcUsed)}, block ${r.block}). Then: npm run picks -- apply ${id}${net.testnet ? " --testnet" : ""} --send` : `✖ ${r.error}`);
  if (!r.ok) process.exitCode = 1;
}
async function apply(id: number, send: boolean) {
  const net = network();
  mainnetGuard(net, send);
  if (!net.picks) throw new Error("No Picks contract yet.");
  const { p, chainId } = await connect(net);
  await assertAuditedContract(net, p);
  const pend = (await read(p, net.picks, "get_game", { game: id })).pending;
  if (!pend) throw new Error(`Nothing is announced for game ${id}.`);
  const why = pendingProblem(pend.game, gameOf(net, id));
  if (why) throw new Error(`Game ${id}: ${why}. Nothing was sent.`);
  const eta = Number(pend.eta);
  log(`Apply game ${id} "${pend.game?.name}": announced, can be applied from ${new Date(eta).toISOString()}${Date.now() < eta ? ` (in ${Math.ceil((eta - Date.now()) / 60000)} min)` : " ✔ now"}`);
  if (!send) { log("\nDry run only. Nothing was sent. Add --send to send it."); return; }
  const r = await sendCall(net, p, chainId, ownerKey(net, p), "apply_game", { game: id });
  log(r.ok ? `✔ game ${id} is in force (Mana used ${showKoin(r.rcUsed)})` : `✖ ${r.error}`);
  if (!r.ok) process.exitCode = 1;
}
async function pause(id: number, send: boolean) {
  const net = network();
  mainnetGuard(net, send);
  if (!net.picks) throw new Error("No Picks contract yet.");
  const { p, chainId } = await connect(net);
  await assertAuditedContract(net, p);
  const g = (await read(p, net.picks, "get_game", { game: id })).game;
  if (!g) throw new Error(`Game ${id} isn't registered.`);
  const off = { ...g, enabled: false };
  log(`Switch game ${id} "${g.name}" OFF at once (picks already made stay recorded; switching it on again needs an announcement and the wait).`);
  if (!send) { log("\nDry run only. Nothing was sent. Add --send to send it."); return; }
  const r = await sendCall(net, p, chainId, ownerKey(net, p), "tighten_game", { game: off });
  log(r.ok ? `✔ game ${id} is off` : `✖ ${r.error}`);
  if (!r.ok) process.exitCode = 1;
}

/** tighten (capacity, owner 12 Nov): the game made STRICTER at once, with no 48 h wait (the contract's tighten_game: fewer
 *  picks a day, fewer changes, a longer lead, a shorter ahead). Anything not stricter is refused here, as the contract
 *  would. The shape and the name never change. Returns the new config and what changed. */
export const TIGHTEN_FLAGS: Record<string, string> = { "--per-day": "max_picks_per_day", "--changes": "max_changes", "--lead": "lead", "--ahead": "ahead" };
export function tightenConfig(g: any, want: Record<string, number>) {
  const n = { ...g }, changed: string[] = [];
  for (const [k, v] of Object.entries(want)) {
    if (!Object.values(TIGHTEN_FLAGS).includes(k)) throw new Error(`tighten can't change ${k}.`);
    if (!Number.isSafeInteger(v) || v < 0) throw new Error(`${k} must be a whole number.`);
    const cur = Number(g[k]);
    const stricter = k === "lead" ? v >= cur : v <= cur;
    if (!stricter) throw new Error(`${k} ${v} isn't stricter than ${cur}: loosening needs an announcement and the 48 h wait.`);
    if (v !== cur) changed.push(`${k} ${cur} → ${v}`);
    n[k] = typeof g[k] === "string" ? String(v) : v;
  }
  if (Number(n.max_picks_per_day) < 1) throw new Error("max_picks_per_day must stay at least 1 (use pause to stop a game).");
  if (!(Number(n.ahead) > Number(n.lead))) throw new Error("ahead must stay above lead.");
  if (!changed.length) throw new Error("Nothing to tighten: give at least one stricter value (--per-day, --changes, --lead, --ahead).");
  return { config: n, changed };
}
async function tighten(id: number, want: Record<string, number>, send: boolean) {
  const net = network();
  mainnetGuard(net, send);
  if (!net.picks) throw new Error("No Picks contract yet.");
  const { p, chainId } = await connect(net);
  await assertAuditedContract(net, p);
  const g = (await read(p, net.picks, "get_game", { game: id })).game;
  if (!g) throw new Error(`Game ${id} isn't registered.`);
  const { config, changed } = tightenConfig(g, want);
  log(`Tighten game ${id} "${g.name}" at once (no wait): ${changed.join(", ")}.`);
  log("  Picks already made stay recorded. Loosening it again needs an announcement and the 48 h wait.");
  const pend = (await read(p, net.picks, "list_pending", { limit: 50 })).pending?.find((x: any) => Number(x.game?.id) === id);
  if (pend) log(`  ⚠ Game ${id} has an announcement pending: the contract CANCELS it when the game is tightened (audit P-2).`);
  if (!send) { log("\nDry run only. Nothing was sent. Add --send to send it."); return; }
  const r = await sendCall(net, p, chainId, ownerKey(net, p), "tighten_game", { game: config });
  log(r.ok ? `✔ game ${id} tightened` : `✖ ${r.error}`);
  if (!r.ok) process.exitCode = 1;
}

// ═══════════════════════════════ owner handover (R-BX-3, D-096; docs/blockx/OWNER-HANDOVER-PLAN.md) ═══════════════════════════════
/** Addresses that can never become the Picks owner: Knode contracts and wallets with another job. */
export const NOT_AN_OWNER: Record<string, string> = {
  "1Mpmf2ERhjYpX7CCiM11WERuM4j17uT1sr": "the game / vault contract", "1EN7xU8R9tQXjHvrX79qZvvvGkkKWVnB5K": "the race contract",
  "1ByDDSBUzy5zkRceELc54Jh8i41yNRoKt8": "the Mana sponsor", "1FKTpXBhhHEbu5vVchM8UsVbAvPArJsRmR": "Knode Swap",
  "1LmgqBGctL9F2YkyjTXgieTXwnYHh8Y6Pm": "the Picks contract", "12Y5vW6gk8GceH53YfRkRre2Rrcsgw7Naq": "the VHP token", "19GYjDBVXU7keLbYvMLazsGQn3GTWHjHkK": "the KOIN token",
};
/** What the contract holds about its owner, read on one node. */
export type OwnerView = { owner: string; pending: string | null; eta: number; upgradeHash: string | null; upgradeEta: number; announced: { id: number; name: string }[] };
export async function readOwnerView(p: Provider, picks: string, readFn = read): Promise<OwnerView> {
  const cfg = await readFn(p, picks, "get_config");
  const pend = (await readFn(p, picks, "list_pending", { limit: 50 })).pending ?? [];
  return {
    owner: String(cfg.owner ?? ""), pending: isAddr(cfg.pending_owner) ? cfg.pending_owner : null, eta: Number(cfg.pending_owner_eta ?? 0),
    upgradeHash: cfg.upgrade_hash && Number(cfg.upgrade_eta ?? 0) > 0 ? String(cfg.upgrade_hash) : null, upgradeEta: Number(cfg.upgrade_eta ?? 0),
    announced: pend.map((x: any) => ({ id: Number(x.game?.id), name: String(x.game?.name ?? "") })),
  };
}
/** Both nodes must give the same answer, and the owner must be the one the tool works for (the deployment file's). */
export function agreeOwnerViews(views: OwnerView[], fileOwner: string): OwnerView {
  const a = views[0];
  for (const [i, v] of views.entries()) if (JSON.stringify(v) !== JSON.stringify(a)) throw new Error(`The two nodes disagree about the Picks owner settings (node ${i + 1}: ${JSON.stringify(v)}). Nothing was signed.`);
  if (a.owner !== fileOwner) throw new Error(`The Picks owner on chain is ${a.owner}, but the settings (picks-data/deployment.json "owner", else the built-in owner) say ${fileOwner}. Fix the file to match the chain first. Nothing was signed.`);
  return a;
}
/** Why the handover must wait: anything the accept would throw away. */
export function waitingOnContract(v: OwnerView): string[] {
  const out: string[] = [];
  for (const g of v.announced) out.push(`game ${g.id} (${g.name}) is announced and not applied yet: apply it first (npm run picks -- apply ${g.id}), or the handover would throw it away`);
  if (v.upgradeHash) out.push(`a code upgrade (${v.upgradeHash}) is scheduled: upload and clear it first, or the handover would throw it away`);
  return out;
}
/** owner-propose's checks. Returns the lines to show; throws when it must not be sent. */
/** An address in groups of 4, so it can be compared by eye with the wallet's own screen (Repo Lens #D-12 F-1). */
export const groups4 = (a: string) => a.replace(/(.{4})/g, "$1 ").trim();
export function planPropose(v: OwnerView, signer: string, next: string, now: number, extraTaken: Record<string, string> = {}, pinned: string | null = null): string[] {
  if (!isAddr(next) || !utils.isChecksumAddress(next)) throw new Error(`${next} is not a valid Koinos address. Nothing was signed.`);
  // Repo Lens #D-12 F-1: only the planned new owner, pinned by a reviewed pull request ("nextOwner" in the deployment
  // file), so a swapped or mistaken address that passes the checksum can't be proposed.
  if (!pinned) throw new Error(`No planned new owner is set: add "nextOwner": "<address>" to the deployment file (picks-data/deployment.json, testnet: testnet/blockx.json) by a pull request first. Nothing was signed.`);
  if (next !== pinned) throw new Error(`${next} is not the planned new owner ${pinned} ("nextOwner" in the deployment file). Nothing was signed.`);
  if (signer !== v.owner) throw new Error(`OWNER_WIF is ${signer}, not the owner on chain ${v.owner}. Nothing was signed.`);
  if (next === v.owner) throw new Error(`${next} is already the owner. Nothing was signed.`);
  const taken = { ...NOT_AN_OWNER, ...extraTaken };
  if (taken[next]) throw new Error(`${next} is ${taken[next]}: the owner must be a wallet of its own. Nothing was signed.`);
  const w = waitingOnContract(v);
  if (w.length) throw new Error(`Not now: ${w.join("; ")}. Nothing was signed.`);
  const open = now + 48 * 3600000, close = open + 7 * 86400000;
  return [
    ...(v.pending ? [`⚠ this replaces the waiting proposal to ${v.pending}`] : []),
    `Propose ${next} as the new Picks owner (signed by the owner ${v.owner}).`,
    `  Check it against the new owner's wallet screen, 4 at a time: ${groups4(next)}`,
    `  The new owner can accept from about ${new Date(open).toISOString()} (48 h) until ${new Date(close).toISOString()} (7 days after that).`,
    `  Accepting clears any game announcement or upgrade still waiting then (games in force, like game 2, are not affected).`,
  ];
}
/** owner-accept's checks (chain time `now`). */
export function planAccept(v: OwnerView, key: string, now: number): string[] {
  if (!v.pending) throw new Error("No new owner is proposed (npm run picks -- owner-propose <address> first). Nothing was signed.");
  if (key !== v.pending) throw new Error(`NEW_OWNER_WIF is ${key}, but the proposed owner is ${v.pending}. Nothing was signed.`);
  if (now < v.eta) throw new Error(`Too early: the new owner can accept from ${new Date(v.eta).toISOString()} (in ${Math.ceil((v.eta - now) / 60000)} min). Nothing was signed.`);
  if (now >= v.eta + 7 * 86400000) throw new Error(`The proposal expired at ${new Date(v.eta + 7 * 86400000).toISOString()}: propose again. Nothing was signed.`);
  // (Repo Lens #D-12 Info: not in the last hour, so a transaction can't land just after the expiry and revert.)
  if (now >= v.eta + 7 * 86400000 - 3600000) throw new Error(`The proposal expires at ${new Date(v.eta + 7 * 86400000).toISOString()}, less than an hour from now: too close to send. Cancel and propose again. Nothing was signed.`);
  const w = waitingOnContract(v);
  if (w.length) throw new Error(`Not now: ${w.join("; ")}. Nothing was signed.`);
  return [`Accept: ${key} becomes the Picks owner (was ${v.owner}). Window ${new Date(v.eta).toISOString()} → ${new Date(v.eta + 7 * 86400000).toISOString()} ✔`];
}
/** owner-cancel's checks. */
export function planCancel(v: OwnerView, signer: string): string[] {
  if (signer !== v.owner) throw new Error(`OWNER_WIF is ${signer}, not the owner on chain ${v.owner}. Nothing was signed.`);
  if (!v.pending) throw new Error("No proposal is waiting. Nothing to cancel.");
  return [`Cancel the proposal to ${v.pending} (signed by the owner ${v.owner}).`];
}
/** The owner settings on both nodes (mainnet) or the one public testnet node, agreed and matching the file. */
async function ownerViews(net: Net, p: Provider): Promise<OwnerView> {
  const nodes = [p];
  if (!net.testnet) {
    const url = MAINNET_CHECK_RPC();
    if (sameNode(net.rpc[0], url)) throw new Error(`RPC_CHECK (${url}) is the same node as RPC: the check needs a second, independent node. Nothing was signed.`);
    const cp = new Provider([url]);
    if ((await cp.getChainId()) !== MAINNET_CHAIN_ID) throw new Error(`The check node ${url} is not on Koinos mainnet. Nothing was signed.`);
    nodes.push(cp);
  }
  const views = [];
  for (const n of nodes) views.push(await readOwnerView(n, net.picks!));
  return agreeOwnerViews(views, net.owner);
}
const chainNow = async (p: Provider) => Number((await p.getHeadInfo()).head_block_time);
/** Repo Lens #D-12 F-2: poll until both nodes agree (`tries` × `waitMs`); also returns the primary's last view. */
export async function readBack(both: () => Promise<OwnerView>, primary: () => Promise<OwnerView>, tries = 12, waitMs = 5000): Promise<{ agreed: OwnerView | null; primary: OwnerView | null }> {
  for (let i = 0; i < tries; i++) {
    try { return { agreed: await both(), primary: null }; } catch { /* a node behind: try again */ }
    if (i < tries - 1) await sleep(waitMs);
  }
  return { agreed: null, primary: await primary().catch(() => null) };
}
/** Write the owner into the deployment file (mainnet) or the testnet config. */
function saveOwner(net: Net, owner: string, checked: boolean, tx: string | null) {
  const file = net.testnet ? TESTNET_CONFIG : MAINNET_STATE;
  const st = readJson(file) ?? {};
  const out: any = { ...st, owner, ownerSince: new Date().toISOString(), ownerTx: tx ?? st.ownerTx ?? null };
  if (checked) delete out.ownerChecked; else out.ownerChecked = false;
  if (out.nextOwner === owner) delete out.nextOwner;   // done: the next handover needs a new reviewed pin
  writeJson(file, out);
}
/** What owner-sync would write: the owner both nodes agree on, or why not. Exported for the tests. */
export function syncPlan(views: OwnerView[], fileOwner: string): { owner: string; change: boolean } {
  const a = views[0];
  for (const [i, v] of views.entries()) if (v.owner !== a.owner) throw new Error(`The nodes disagree about the owner (node ${i + 1}: ${v.owner}, node 1: ${a.owner}). Try again in a few minutes. Nothing was written.`);
  if (!isAddr(a.owner)) throw new Error("The contract shows no owner. Nothing was written.");
  return { owner: a.owner, change: a.owner !== fileOwner };
}
/** owner-sync: read the owner on both nodes and write it into the deployment file when they agree (no transaction). */
async function ownerSync() {
  const net = network();
  if (!net.picks) throw new Error("No Picks contract yet.");
  const { p } = await connect(net);
  await assertAuditedContract(net, p);
  const nodes = [p];
  if (!net.testnet) { const url = MAINNET_CHECK_RPC(); if (sameNode(net.rpc[0], url)) throw new Error(`RPC_CHECK (${url}) is the same node as RPC.`); nodes.push(new Provider([url])); }
  const views = [];
  for (const n of nodes) views.push(await readOwnerView(n, net.picks));
  const plan = syncPlan(views, net.owner);
  const checkedFlag = (net.testnet ? readJson(TESTNET_CONFIG) : readJson(MAINNET_STATE))?.ownerChecked === false;
  if (!plan.change && !checkedFlag) { log(`The file already names ${plan.owner}, the owner on ${nodes.length > 1 ? "both nodes" : "the node"} ✔. Nothing to write.`); return; }
  saveOwner(net, plan.owner, true, null);
  log(`✔ wrote the owner ${plan.owner} (${nodes.length > 1 ? "both nodes agree" : "read on the node"}) into ${net.testnet ? TESTNET_CONFIG : MAINNET_STATE}${net.testnet ? "" : ": open a pull request to main with that file"}.`);
}

async function ownerPropose(next: string | undefined, send: boolean) {
  const net = network();
  mainnetGuard(net, send);
  if (!net.picks) throw new Error("No Picks contract yet.");
  if (!next) throw new Error("Usage: npm run picks -- owner-propose <new owner address> [--send --mainnet]");
  const { p, chainId } = await connect(net);
  await assertAuditedContract(net, p);
  const s = signerOf("OWNER_WIF", p);
  const v = await ownerViews(net, p);
  for (const l of planPropose(v, s.getAddress(), next, await chainNow(p), {}, net.nextOwner ?? null)) log(l);
  if (!send) { log("\nDry run only. Nothing was sent. Add --send" + (net.testnet ? "" : " --mainnet") + " to send it."); return; }
  const r = await sendCall(net, p, chainId, s, "propose_owner", { owner: next });
  log(r.ok ? `✔ proposed (Mana used ${showKoin(r.rcUsed)}, block ${r.block}). Step 2: npm run picks -- owner-accept${net.testnet ? " --testnet" : ""} (signed by the new owner) from the time above.` : `✖ ${r.error}`);
  if (!r.ok) process.exitCode = 1;
}
async function ownerCancel(send: boolean) {
  const net = network();
  mainnetGuard(net, send);
  if (!net.picks) throw new Error("No Picks contract yet.");
  const { p, chainId } = await connect(net);
  await assertAuditedContract(net, p);
  const s = signerOf("OWNER_WIF", p);
  for (const l of planCancel(await ownerViews(net, p), s.getAddress())) log(l);
  if (!send) { log("\nDry run only. Nothing was sent. Add --send" + (net.testnet ? "" : " --mainnet") + " to send it."); return; }
  const r = await sendCall(net, p, chainId, s, "propose_owner", { owner: "" });
  log(r.ok ? `✔ the proposal is withdrawn (Mana used ${showKoin(r.rcUsed)})` : `✖ ${r.error}`);
  if (!r.ok) process.exitCode = 1;
}
async function ownerAccept(send: boolean) {
  const net = network();
  mainnetGuard(net, send);
  if (!net.picks) throw new Error("No Picks contract yet.");
  const { p, chainId } = await connect(net);
  await assertAuditedContract(net, p);
  const s = signerOf("NEW_OWNER_WIF", p);
  const v = await ownerViews(net, p);
  for (const l of planAccept(v, s.getAddress(), await chainNow(p))) log(l);
  if (!send) { log("\nDry run only. Nothing was sent. Add --send" + (net.testnet ? "" : " --mainnet") + " to send it."); return; }
  const r = await sendCall(net, p, chainId, s, "accept_owner", {});
  if (!r.ok) { log(`✖ ${r.error}`); process.exitCode = 1; return; }
  log(`✔ accepted (Mana used ${showKoin(r.rcUsed)}, block ${r.block}).`);
  // Repo Lens #D-12 F-2: read it back on every node, against the NEW owner, for up to a minute (a node one block behind
  // is ordinary). If they still don't agree but the primary shows the new owner, the file is written anyway, marked
  // "ownerChecked": false, so owner commands (pause included) work with the new key; owner-sync confirms it later.
  const got = await readBack(() => ownerViews({ ...net, owner: s.getAddress() }, p), () => readOwnerView(p, net.picks!));
  if (!got.agreed && got.primary?.owner !== s.getAddress()) { log("⚠ The new owner isn't showing on the node yet. Run npm run picks -- owner-sync in a few minutes."); process.exitCode = 1; return; }
  saveOwner(net, s.getAddress(), !!got.agreed, r.txId ?? null);
  if (got.agreed) log(`✔ read back on both nodes: the owner is ${s.getAddress()}.`);
  else log(`⚠ The primary node shows the new owner ${s.getAddress()}, but the nodes didn't agree within a minute. Saved it with "ownerChecked": false. In a few minutes run: npm run picks -- owner-sync${net.testnet ? " --testnet" : ""}`);
  log(net.testnet ? `  Saved in ${TESTNET_CONFIG} ("owner").` : `  Saved in ${MAINNET_STATE} ("owner"): open a pull request to main with that file. From now on OWNER_WIF must be the new owner's key for owner commands. Take NEW_OWNER_WIF out of .env.`);
}

// ═══════════════════════════════ testnet checks ═══════════════════════════════
function testnetOnly(net: Net, what: string) { if (!net.testnet) throw new Error(`${what} is for the testnet only (add --testnet).`); }
const pickOp = async (p: Provider, picks: string, player: string, game: number, round: number, producer: string) =>
  (await (new Contract({ id: picks, abi: loadAbi(), provider: p }).functions as any).pick({ player, game, round: String(round), producers: [producer], number: "0" }, { onlyOperation: true })).operation;

/** Where a transaction ended up: the block that holds it and whether it was applied or reverted there. */
export async function findTx(p: Provider, txId: string): Promise<{ block: number; reverted: boolean; logs: string[] } | null> {
  const t: any = await p.call("transaction_store.get_transactions_by_id", { transaction_ids: [txId] }).catch(() => null);
  const bid = t?.transactions?.[0]?.containing_blocks?.[0];
  if (!bid) return null;
  const b: any = await p.call("block_store.get_blocks_by_id", { block_ids: [bid], return_block: true, return_receipt: true }).catch(() => null);
  const it = b?.block_items?.[0];
  if (!it) return null;
  const i = (it.block?.transactions ?? []).findIndex((x: any) => x.id === txId);
  const rec = it.receipt?.transaction_receipts?.[i] ?? {};
  return { block: Number(it.block_height), reverted: !!rec.reverted, logs: rec.logs ?? [] };
}

/**
 * lock-test: is the lock exactly where the design says (audit P-5)? Picks the next target X of a game whose lock is at
 * least 40 blocks away, then sends one pick per new block, from 6 blocks before the lock to 3 after, rotating between
 * four producers so each pick is a change even while the node still sees an earlier one. Afterwards it reads, from the
 * chain itself, the block each pick landed in and whether it was applied there, and the height the contract stored.
 * The design: accepted while the contract's height < X − lead, so the last block a pick can land in is X − lead − 1.
 */
async function lockTest(id: number, send: boolean) {
  const net = network();
  testnetOnly(net, "lock-test");
  if (!net.picks) throw new Error("No Picks contract yet.");
  const { p, chainId } = await connect(net);
  const g = (await read(p, net.picks, "get_game", { game: id })).game;
  if (!g || !g.enabled) throw new Error(`Game ${id} isn't in force yet (announce, wait, apply).`);
  const G = X.forGame({ id, round: Number(g.round_size), offset: Number(g.round_offset), lead: Number(g.lead), ahead: Number(g.ahead), picksPerDay: g.max_picks_per_day, maxChanges: g.max_changes });
  if (G.MAX_CHANGES < 5) throw new Error("lock-test needs a game that allows at least 5 changes.");
  const player = signerOf("PLAYER_WIF", p), me = player.getAddress();
  // Four valid addresses to rotate between (who they are doesn't matter; a pick only has to differ from the last).
  const choices = [net.owner, net.picks, net.cfg?.koin, net.cfg?.vhp].filter((a, i, all) => isAddr(a) && all.indexOf(a) === i) as string[];
  if (choices.length < 3) throw new Error("lock-test needs testnet/blockx.json to name koin and vhp.");
  const head = async () => Number(((await p.getHeadInfo()) as any).head_topology.height);
  let h = await head();
  const r = G.openRounds(h).find((x: number) => G.lockHeight(x) - h >= 40);
  const lock = G.lockHeight(r), target = G.target(r);
  log(`lock-test on game ${id}: target block ${target}, the contract refuses picks from height ${lock} (target − ${G.LEAD}). Head now ${h}.`);
  log(`It sends one pick per block from head ${lock - 6} to ${lock + 3} (10 picks, from ${me}), about ${Math.ceil((lock - 6 - h) * 3 / 60)} min from now.`);
  if (!send) { log("\nDry run only. Nothing was sent. Add --send to run it (it costs a little test Mana)."); return; }
  // One pick per block without waiting for each to land: each gets its own nonce (only higher than the last is needed).
  let nonce = Number(await p.getNonce(me)) + 1;
  const rows: any[] = [];
  let i = 0;
  for (let at = lock - 6; at <= lock + 3; at++) {
    while ((h = await head()) < at) await sleep(500);
    const op = await pickOp(p, net.picks, me, id, r, choices[i++ % choices.length]);
    const res: any = await sendOps(p, chainId, player, [op], 1, { nonce, wait: false });
    if (res.txId) nonce++;   // sent: it uses its nonce whether it is applied or reverts in its block
    rows.push({ sentAtHead: h, sent: !!res.txId, error: res.error, txId: res.txId });
    log(`  sent at head ${h}: ${res.txId ? "taken by the node" : `refused by the node: ${String(res.error).replace(/^.*"error":"([^"]+)".*$/, "$1")}`}`);
  }
  log("\nReading where each pick landed…");
  await sleep(12000);
  for (const x of rows) if (x.txId) Object.assign(x, (await findTx(p, x.txId)) ?? { block: null });
  const stored = (await read(p, net.picks, "get_pick", { game: id, round: String(r), player: me })).pick;
  const landed = rows.filter((x) => x.block);
  const ok = landed.filter((x) => !x.reverted), bad = landed.filter((x) => x.reverted);
  log(`\nResult for target ${target} (picks are refused once the chain reaches block ${lock}):`);
  for (const x of landed) log(`  block ${x.block} (${x.block < lock ? `lock − ${lock - x.block}` : x.block === lock ? "the lock" : `lock + ${x.block - lock}`}): ${x.reverted ? `refused, ${String(x.logs?.[0] ?? "").replace(/^transaction reverted: /, "")}` : "applied"}`);
  const last = ok.sort((a, b) => b.block - a.block)[0];
  if (last && stored) {
    log(Number(stored.height) === last.block ? `  ✔ the contract stored height ${stored.height} for the last applied pick: the height of the block it landed in (as designed).`
      : `  ⚠ the last applied pick landed in block ${last.block} but the contract stored height ${stored.height}. Tell Claude.`);
  }
  if (ok.some((x) => x.block >= lock)) log("  ✖ a pick was applied at or after the lock. Stop and tell Claude.");
  else log(`  ✔ no pick was applied at or after the lock (block ${lock}).`);
  if (ok.some((x) => x.block === lock - 1)) log(`  ✔ a pick landing in block ${lock - 1} (target − ${G.LEAD + 1}) was applied: the last block a pick can land in.`);
  else log(`  · no pick happened to land in block ${lock - 1} this run, so that exact edge wasn't seen (run it again to catch it).`);
  if (bad.some((x) => x.block === lock && /locked/.test(String(x.logs)))) log(`  ✔ a pick landing in block ${lock} (the lock) was refused: "this round is locked".`);
  writeJson(path.join("testnet-data", `lock-test-${id}-${target}.json`), { game: id, target, lock, rows, stored });
}

/** mana-test: the real Mana of a pick, alone and batched (audit S3-5), to size the sponsor and the site's Mana limit. */
async function manaTest(id: number, send: boolean) {
  const net = network();
  testnetOnly(net, "mana-test");
  if (!net.picks) throw new Error("No Picks contract yet.");
  const { p, chainId } = await connect(net);
  const g = (await read(p, net.picks, "get_game", { game: id })).game;
  if (!g || !g.enabled) throw new Error(`Game ${id} isn't in force yet.`);
  const G = X.forGame({ id, round: Number(g.round_size), offset: Number(g.round_offset), lead: Number(g.lead), ahead: Number(g.ahead), picksPerDay: g.max_picks_per_day, maxChanges: g.max_changes });
  const player = signerOf("PLAYER_WIF", p), me = player.getAddress();
  const rounds = G.offerRounds(Number(((await p.getHeadInfo()) as any).head_topology.height), 60);
  if (rounds.length < 11) throw new Error("Fewer than 11 targets are open far enough from their lock; try again in a few minutes.");
  log(`mana-test on game ${id}: 1, then 3, then 7 picks in one transaction each, from ${me} (11 of today's ${G.PICKS_PER_DAY} picks).`);
  if (!send) { log("\nDry run only. Nothing was sent. Add --send to run it."); return; }
  const out: any[] = [];
  let k = 0;
  for (const n of [1, 3, 7]) {
    const ops = [];
    for (let j = 0; j < n; j++) {
      const r = rounds[k++];
      const cur = (await read(p, net.picks, "get_pick", { game: id, round: String(r), player: me })).pick;
      const producer = cur?.producers?.[0] === net.owner ? net.picks! : net.owner;   // always a change, never "already your pick"
      ops.push(await pickOp(p, net.picks, me, id, r, producer));
    }
    const res = await sendOps(p, chainId, player, ops, 5);
    out.push({ picks: n, ...res });
    log(`  ${n} pick${n > 1 ? "s" : ""}: ${res.ok ? `${showKoin(res.rcUsed)} Mana (${showKoin(BigInt(res.rcUsed ?? "0") / BigInt(n))} each)` : `failed: ${res.error}`}`);
    await sleep(4000);
  }
  writeJson(path.join("testnet-data", `mana-test-${id}.json`), { game: id, at: new Date().toISOString(), out });
  log("Saved testnet-data/mana-test-<id>.json. Send the numbers to Claude (they size the sponsor's per-pick Mana limit).");
}

function buildTestnet() {
  if (!TESTNET) throw new Error("build-testnet is for the testnet: add --testnet.");
  const owner = Signer.fromWif(need("OWNER_WIF")).getAddress();
  if (owner === MAINNET_OWNER || owner === mainnetOwner()) throw new Error("OWNER_WIF in .env.testnet is the MAINNET owner. Use a test owner (npm run bot -- keys --testnet).");
  execFileSync(process.execPath, ["scripts/build-testnet.cjs", "--owner", owner], { cwd: "picks", stdio: "inherit" });
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--testnet");
  const [cmd = "status", ...a] = args;
  const send = a.includes("--send");
  const num = () => { const n = Number(a.find((x) => /^\d+$/.test(x))); if (!Number.isInteger(n)) throw new Error(`${cmd} needs a game id, e.g. npm run picks -- ${cmd} 2`); return n; };
  switch (cmd) {
    case "keys": return keys();
    case "build-testnet": return buildTestnet();
    case "status": return status();
    case "upload": return upload(send);
    case "announce": return announce(num(), send);
    case "apply": return apply(num(), send);
    case "pause": return pause(num(), send);
    case "tighten": {
      const id = Number(a[0]);
      if (!/^\d+$/.test(a[0] ?? "")) throw new Error("tighten needs the game id first, e.g. npm run picks -- tighten 12 --per-day 24");
      const want: Record<string, number> = {};
      for (let i = 1; i < a.length; i++) if (TIGHTEN_FLAGS[a[i]]) {
        if (!/^\d+$/.test(a[i + 1] ?? "")) throw new Error(`${a[i]} needs a whole number`);
        want[TIGHTEN_FLAGS[a[i]]] = Number(a[++i]);
      }
      return tighten(id, want, send);
    }
    case "lock-test": return lockTest(num(), send);
    case "mana-test": return manaTest(num(), send);
    case "owner-propose": return ownerPropose(a.find((x) => !x.startsWith("--")), send);
    case "owner-accept": return ownerAccept(send);
    case "owner-cancel": return ownerCancel(send);
    case "owner-sync": return ownerSync();
    default: throw new Error(`Unknown command "${cmd}". Commands: keys, build-testnet, status, upload, announce <id>, apply <id>, pause <id>, tighten <id> [--per-day N] [--changes N] [--lead N] [--ahead N], lock-test <id>, mana-test <id>, owner-propose <address>, owner-accept, owner-cancel, owner-sync`);
  }
}
if (process.argv[1] && /picks\.ts$/.test(process.argv[1])) {
  main().catch((e) => { console.error(`\n✖ ${e.message ?? e}`); process.exit(1); });
}
