/**
 * testnet-v61-sponsor: what the Mana sponsor's own checks add to a player's vault call (Repo Lens #E-15 W3; owner,
 * 4 Nov: every transaction must fit its Mana limit). Testnet only, throwaway keys.
 *
 * On mainnet no player pays the vault's Mana through the vault itself (max_sponsor_rc = 0): the separate Mana sponsor
 * (sponsor/, build b84e1add…) pays, and its `authorize` (caps, the player check that reads the vault) runs inside the
 * same transaction. This puts a fresh copy of that sponsor in front of the testnet-v61-d8 vault (run that first) and
 * measures, each with and without the sponsor:
 *   - an answer (C sponsored, D on its own Mana);
 *   - claim_game for game 1 (C sponsored; A's own-Mana claim is in the d8 run);
 *   - a stake (approve + deposit_to(1)) and a withdrawal (withdraw_from(1)), sponsored (the d8 run has them unsponsored).
 * The units go into testnet-v61-d8/units.json beside the d8 run's (keys ending in "Sp" are sponsored).
 *
 *   npm run bot -- testnet-v61-sponsor
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Provider, Signer, Contract, Transaction, utils } from "koilib";
import { KoinosChain, showKoin, toSat } from "./chain.ts";
import { tokenAbi } from "./token-abi.ts";

const RPC = "https://testnet.koinosfoundation.org";
const CHAIN_ID = "EiAIKVvm6-V2qmsmUvPJy09vCCLbtn9lHFpwrJbcTIEWRQ==";
const KOIN = "1FaSvLjQJsCJKq5ybmGsMMQs8RQYyVv8ju";
const VHP_TOKEN = "17n12ktwN79sR6ia9DDgCfmw77EgpbTyBi";
const SPONSOR_WASM = "sponsor/build/release/contract.wasm";
const SPONSOR_ABI = "sponsor/abi/sponsor.koilib.json";
const SPONSOR_SHA = "b84e1add3ffa14a7d1933d5ce5a4ad33caa4bca887a489f87f710b3c121c83a6";   // the mainnet rollout build
const DIR = "testnet-v61-d8";
const VHP = 100_000_000n, MIN = 60_000;

const log = (...a: any[]) => console.log(...a);
const file = (n: string) => path.join(DIR, n);
const readJ = (p: string, d: any) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : d);
const writeJ = (n: string, v: any) => fs.writeFileSync(file(n), JSON.stringify(v, null, 2) + "\n");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function testnetV61Sponsor() {
  const provider = new Provider([RPC]);
  const cid: any = await provider.call("chain.get_chain_id", {});
  if (cid?.chain_id !== CHAIN_ID) throw new Error(`${RPC} is not the Koinos Foundation testnet. Stopping.`);
  const d8 = readJ(file("state.json"), null), keys = readJ(file("keys.json"), null), fund = readJ("testnet-v6/keys.json", null);
  if (!d8?.done || !keys || !fund?.funder) throw new Error("Run npm run bot -- testnet-v61-d8 to the end first.");
  const wasm = fs.readFileSync(SPONSOR_WASM);
  if (crypto.createHash("sha256").update(wasm).digest("hex") !== SPONSOR_SHA) throw new Error(`${SPONSOR_WASM} is not the mainnet sponsor build ${SPONSOR_SHA.slice(0, 8)}… (cd sponsor; npm run build).`);
  const st = readJ(file("sponsor-state.json"), { m: {} });
  const save = () => writeJ("sponsor-state.json", st);
  if (!st.key) { st.key = Signer.fromSeed(utils.toHexString(crypto.randomBytes(32))).getPrivateKey("wif", true); st.note = "TESTNET ONLY: a throwaway sponsor key."; save(); }
  const funder = Signer.fromWif(fund.funder), spKey = Signer.fromWif(st.key);
  funder.provider = provider; spKey.provider = provider;
  const P: Record<string, Signer> = Object.fromEntries(["A", "B", "C", "D"].map((n) => { const s = Signer.fromSeed(`${keys.playerSeed} player ${n}`); s.provider = provider; return [n, s]; }));
  const V = d8.contract as string, SP = spKey.getAddress();
  const chain = new KoinosChain(RPC, V);
  const spAbi = JSON.parse(fs.readFileSync(SPONSOR_ABI, "utf8"));
  log(`Vault (test)   ${V}\nSponsor (test) ${SP}`);

  /** Sends; `sponsored`: the sponsor pays, only the player signs (as the site does). Returns the receipt. */
  const send = async (who: Signer, calls: any[], what: string, sponsored: boolean, extraSigner?: Signer): Promise<any> => {
    for (let attempt = 1; ; attempt++) {
      try {
        const payer = sponsored ? SP : who.getAddress();
        const tx = new Transaction({ signer: who, provider, options: { payer, payee: who.getAddress(), rcLimit: toSat(sponsored ? 2.5 : 3).toString() } });
        for (const c of calls) await tx.pushOperation(c.operation ?? (await chain.op(c)));
        await tx.prepare();
        let t: any = await who.signTransaction(tx.transaction!);
        if (extraSigner) t = await extraSigner.signTransaction(t);
        const { receipt, transaction } = await provider.sendTransaction(t);
        if ((receipt as any)?.reverted) throw new Error(`reverted: ${JSON.stringify((receipt as any).logs)}`);
        await transaction.wait("byBlock", 240_000);
        return { ...(receipt as any), id: t.id };
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        if (/pending account resources/i.test(msg) && attempt < 12) { await sleep(20_000); continue; }
        throw new Error(`${what} failed: ${msg}`);
      }
    }
  };
  const note = (key: string, r: any, text: string) => {
    st.m[key] = { rc: String(r.rc_used ?? 0), compute: String(r.compute_bandwidth_used ?? 0), disk: String(r.disk_storage_used ?? 0),
      network: String(r.network_bandwidth_used ?? 0), tx: String(r.id ?? ""), note: text };
    save();
    log(`  measured ${key}: ${showKoin(r.rc_used)} Mana (compute ${r.compute_bandwidth_used ?? 0}, disk ${r.disk_storage_used ?? 0}, network ${r.network_bandwidth_used ?? 0})`);
  };
  const sp = new Contract({ id: SP, abi: spAbi, provider, signer: spKey });

  // 1. The sponsor: upload (the funder pays), test KOIN for its Mana, settings.
  if (!st.uploaded) {
    log("\n1. Uploading a fresh copy of the sponsor …");
    const c = new Contract({ id: SP, abi: spAbi, provider, signer: spKey, bytecode: new Uint8Array(wasm) });
    const { operation } = await c.deploy({ abi: JSON.stringify(spAbi), authorizesCallContract: false, authorizesTransactionApplication: true, authorizesUploadContract: false, onlyOperation: true } as any);
    const tx = new Transaction({ signer: funder, provider, options: { payer: funder.getAddress(), payee: funder.getAddress(), rcLimit: toSat(20).toString() } });
    await tx.pushOperation(operation);
    await tx.prepare();
    let t: any = await funder.signTransaction(tx.transaction!);
    t = await spKey.signTransaction(t);
    const { receipt, transaction } = await provider.sendTransaction(t);
    if ((receipt as any)?.reverted) throw new Error(`sponsor upload reverted: ${JSON.stringify((receipt as any).logs)}`);
    await transaction.wait("byBlock", 300_000);
    st.uploaded = true; save();
  }
  if (!st.funded) {
    const koin = new Contract({ id: KOIN, abi: tokenAbi as any, provider });
    const { operation } = await (koin.functions as any).transfer({ from: funder.getAddress(), to: SP, value: String(40n * VHP) }, { onlyOperation: true });
    await send(funder, [{ operation }], "fund the sponsor", false);
    st.funded = true; save();
  }
  if (!st.configured) {
    log("  settings: the test vault as the game, per transaction 2.5, generous caps");
    const config = { enabled: true, game: V, desk: "1PgfDQi16onkpfoFC2Ho2euva7RQs3myXC", tokens: [VHP_TOKEN, KOIN],
      max_mana_per_tx: String(toSat(2.5)), max_mana_per_account_day: String(toSat(40)), max_mana_per_account_week: String(toSat(250)),
      max_mana_per_day: String(toSat(500)), vhp: VHP_TOKEN, min_vhp: String(VHP), max_mana_free_day: String(toSat(500)), game_has_vault: true };
    const { operation } = await (sp.functions as any).set_config({ config }, { onlyOperation: true });
    const tx = new Transaction({ signer: spKey, provider, options: { payer: SP, payee: SP, rcLimit: toSat(3).toString() } });
    await tx.pushOperation(operation);
    await tx.prepare();
    const t: any = await spKey.signTransaction(tx.transaction!);
    const { receipt, transaction } = await provider.sendTransaction(t);
    if ((receipt as any)?.reverted) throw new Error(`set_config reverted: ${JSON.stringify((receipt as any).logs)}`);
    await transaction.wait("byBlock", 240_000);
    st.configured = true; save();
  }

  // 2. A fresh question this week, answered by C (sponsored) and D (own Mana).
  if (st.question === undefined) {
    const s = await chain.read("get_state", {});
    const now = Number((await provider.getHeadInfo() as any).head_block_time);
    const h = Number((await provider.getHeadInfo() as any).head_topology.height);
    const lock = now + 20 * MIN, ws = h + Math.ceil(20 * MIN / 2800) + 20;
    const before = Number(s.totals?.next_question_id ?? 0);   // the id the next question gets
    await send(funder, [{ method: "post_question", args: { k: 2, lock_time: String(lock), window_start: String(ws), window_end: String(ws + 20), params_hash: "0x" + "ef".repeat(32) } }], "post", false);
    st.question = before; save();
    log(`  posted question ${st.question}`);
  }
  const ans = (n: string) => ({ method: "answer", args: { player: P[n].getAddress(), question_id: st.question, option: 1 } });
  if (!st.m.answerSp) note("answerSp", await send(P.C, [ans("C")], "C sponsored answer", true), "C's answer, paid by the sponsor");
  if (!st.m.answerOwn) note("answerOwn", await send(P.D, [ans("D")], "D own answer", false), "D's answer to the same question, own Mana");

  // 3. Money calls through the sponsor.
  if (!st.m.claimGameSp) note("claimGameSp", await send(P.C, [{ method: "claim_game", args: { game: 1, week: "0", player: P.C.getAddress() } }], "C sponsored claim", true),
    "C's claim_game for game 1, paid by the sponsor");
  if (!st.m.depositTo1Sp) {
    const vhpLike = new Contract({ id: KOIN, abi: tokenAbi as any, provider });
    const { operation } = await (vhpLike.functions as any).approve({ owner: P.A.getAddress(), spender: V, value: String(VHP) }, { onlyOperation: true });
    note("depositTo1Sp", await send(P.A, [{ operation }, { method: "deposit_to", args: { game: 1, from: P.A.getAddress(), amount: String(VHP), koin: true } }], "A sponsored stake", true),
      "A's stake in game 1 (approve + deposit_to, 1 KOIN), paid by the sponsor");
  }
  if (!st.m.withdrawFrom1Sp) note("withdrawFrom1Sp", await send(P.C, [{ method: "withdraw_from", args: { game: 1, to: P.C.getAddress(), amount: String(VHP) } }], "C sponsored withdrawal", true),
    "C's withdrawal from game 1 (withdraw_from, 1 VHP), paid by the sponsor");

  // 4. Into the units file beside the d8 run's.
  const units = readJ(file("units.json"), null);
  if (units) {
    const have = new Set(units.calls.map((c: any) => c.key));
    for (const k of ["answerSp", "answerOwn", "claimGameSp", "depositTo1Sp", "withdrawFrom1Sp"]) if (st.m[k] && !have.has(k)) units.calls.push({ key: k, ...st.m[k] });
    units.sponsor = { build: SPONSOR_SHA, contract: SP };
    writeJ("units.json", units);
  }
  st.done = true; save();
  log("\nDone: testnet-v61-d8/units.json now holds the sponsored calls too.");
}
