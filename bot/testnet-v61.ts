/**
 * testnet-v61: measures a 60-question week on the vault v6.1 build (Repo Lens #B-4, V61-B1), in one command.
 *
 * On the Koinos Foundation testnet (test KOIN only) it deploys a FRESH copy of the v6.1 release build (the audited
 * 399171a2…; a fresh deployment allows 60 questions from week 0), runs one 45-minute week with 60 questions, and
 * measures the Mana (rc_used) of:
 *   - answer no. 1, no. 30 and no. 60 of player A, and no. 30 of player B (B answers 30);
 *   - the 61st question being refused;
 *   - close_week, settle for A (60 answers) and B (30), and finalize_week.
 *
 *   npm run bot -- testnet-v61           runs (or carries on from where it stopped), then writes testnet-v61/report.md
 *   npm run bot -- testnet-v61 status    what the run has done so far
 *
 * The funder is the testnet-v6 run's throwaway testnet wallet (testnet-v6/keys.json). Everything else lives in
 * testnet-v61/. It never reads .env, never touches mainnet, and refuses to run unless the node answers with the
 * testnet's chain id. Test KOIN is worthless; nothing needs returning.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Provider, Signer, Contract, Transaction, utils } from "koilib";
import { KoinosChain, loadAbi, showKoin, toSat } from "./chain.ts";
import { tokenAbi } from "./token-abi.ts";

const RPC = "https://testnet.koinosfoundation.org";
const CHAIN_ID = "EiAIKVvm6-V2qmsmUvPJy09vCCLbtn9lHFpwrJbcTIEWRQ==";
const KOIN = "1FaSvLjQJsCJKq5ybmGsMMQs8RQYyVv8ju";
const WASM = "game/build/release/contract.wasm";
const V61_SHA = "399171a28956ee236d6b41b5779bcda4e2fe18cdc5560ccbfc380c9cf3d9fced";
const DIR = "testnet-v61";
const VHP = 100_000_000n;
const MIN = 60_000;
const WEEK = 45 * MIN, CLOSE = 3 * MIN, SETTLE = 10 * MIN, LOCK = 2 * MIN;
const N = 60;                     // questions in the measured week
const LOCK_AT = 32 * MIN;         // answers close 32 minutes into the week
const BATCH = 10;                 // questions posted (and resolved) per transaction

const log = (...a: any[]) => console.log(...a);
const file = (n: string) => path.join(DIR, n);
const readJ = (p: string, d: any) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : d);
const writeJ = (n: string, v: any) => { fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(file(n), JSON.stringify(v, null, 2) + "\n"); };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type State = { contract?: string; uploaded?: boolean; genesis?: number; funded?: boolean; staked?: boolean; posted?: number;
  windowEnd?: number; refused61?: string; answeredA?: number; answeredB?: number; resolved?: number; closed?: boolean;
  settled?: boolean; finalized?: boolean; caps?: string; m: Record<string, { rc: string; note: string }>; done?: boolean };

export async function testnetV61(args: string[]) {
  fs.mkdirSync(DIR, { recursive: true });
  const provider = new Provider([RPC]);
  const cid: any = await provider.call("chain.get_chain_id", {});
  if (cid?.chain_id !== CHAIN_ID) throw new Error(`${RPC} is not the Koinos Foundation testnet (chain id ${cid?.chain_id}). Stopping.`);

  const fund = readJ("testnet-v6/keys.json", null);
  if (!fund?.funder) throw new Error("testnet-v6/keys.json (the testnet funder) not found: run npm run bot -- testnet-v6 first.");
  let keys = readJ(file("keys.json"), null);
  if (!keys) {
    const rnd = () => utils.toHexString(crypto.randomBytes(32));
    keys = { note: "TESTNET ONLY: throwaway keys for npm run bot -- testnet-v61. Worthless; never use them on mainnet.",
      contract: Signer.fromSeed(rnd()).getPrivateKey("wif", true), playerSeed: rnd() };
    writeJ("keys.json", keys);
  }
  const funder = Signer.fromWif(fund.funder), contractKey = Signer.fromWif(keys.contract);
  funder.provider = provider; contractKey.provider = provider;
  const [A, B] = ["A", "B"].map((n) => { const s = Signer.fromSeed(`${keys.playerSeed} player ${n}`); s.provider = provider; return s; });
  const koin = new Contract({ id: KOIN, abi: tokenAbi as any, provider });
  const bal = async (a: string) => BigInt(((await (koin.functions as any).balance_of({ owner: a })).result?.value) ?? 0);
  const st: State = readJ(file("state.json"), { m: {} });
  const save = () => writeJ("state.json", st);
  const C = contractKey.getAddress();

  log(`Testnet         ${RPC}`);
  log(`Funder wallet   ${funder.getAddress()}   holds ${showKoin(await bal(funder.getAddress()))} test KOIN`);
  log(`Vault (test)    ${C}${st.uploaded ? "" : "  (not deployed yet)"}`);
  if (args[0] === "status") { log(JSON.stringify(st, null, 2)); return; }
  if (st.done) { log(`This run is finished; its report is ${DIR}/report.md. Delete the ${DIR} folder to run it again.`); return; }

  if (!fs.existsSync(WASM)) throw new Error(`${WASM} not found: in the game folder run npm test (it builds), then try again.`);
  const wasm = fs.readFileSync(WASM);
  const sha = crypto.createHash("sha256").update(wasm).digest("hex");
  if (sha !== V61_SHA) throw new Error(`${WASM} is ${sha}, not the audited v6.1 build ${V61_SHA}.`);
  const chain = new KoinosChain(RPC, C);
  const chainTime = async () => Number(((await provider.getHeadInfo()) as any).head_block_time);
  const height = async () => Number(((await provider.getHeadInfo()) as any).head_topology.height);
  const waitUntil = async (t: number, what: string) => {
    for (;;) { const now = await chainTime(); if (now >= t) return; log(`  … waiting ${Math.ceil((t - now) / 1000)} s for ${what}`); await sleep(Math.min(60_000, t - now + 3000)); }
  };
  const send = async (who: Signer, calls: any[], what: string, rcLimitKoin = 5) => {
    const r = await chain.send(calls, [who], { rcLimitKoin });
    if (!r.ok) throw new Error(`${what} failed: ${r.error}`);
    return r;
  };
  const note = (key: string, rc: string | undefined, text: string) => { st.m[key] = { rc: String(rc ?? "0"), note: text }; save(); log(`  measured ${key}: ${showKoin(rc)} Mana`); };
  const transfer = (to: string, value: bigint) => ({ contract: KOIN, abi: tokenAbi, method: "transfer", args: { from: funder.getAddress(), to, value: String(value) } });
  const approve = (owner: string, value: bigint) => ({ contract: KOIN, abi: tokenAbi, method: "approve", args: { owner, spender: C, value: String(value) } });

  // 1. upload and init
  if (!st.uploaded) {
    log("\n1. Uploading a fresh v6.1 vault to the testnet …");
    const abi = loadAbi();
    const c = new Contract({ id: C, abi, provider, signer: contractKey, bytecode: new Uint8Array(wasm) });
    const { operation } = await c.deploy({ abi: JSON.stringify(abi), authorizesCallContract: true, authorizesTransactionApplication: true, authorizesUploadContract: true, onlyOperation: true } as any);
    const mana = BigInt(await provider.getAccountRc(funder.getAddress()));
    const limit = (mana * 9n) / 10n < toSat(60) ? (mana * 9n) / 10n : toSat(60);
    const tx = new Transaction({ signer: funder, provider, options: { payer: funder.getAddress(), payee: funder.getAddress(), rcLimit: limit.toString() } });
    await tx.pushOperation(operation);
    await tx.prepare();
    let t: any = tx.transaction;
    t = await funder.signTransaction(t);
    t = await contractKey.signTransaction(t);
    const { receipt, transaction } = await provider.sendTransaction(t);
    if ((receipt as any)?.reverted) throw new Error(`upload reverted: ${JSON.stringify((receipt as any).logs)}`);
    await transaction.wait("byBlock", 300_000);
    st.uploaded = true; st.contract = C; save();
    note("upload", (receipt as any).rc_used, `uploading the ${(wasm.length / 1024).toFixed(1)} KB v6.1 contract`);
  }
  if (!st.genesis) {
    const genesis = Math.ceil(((await chainTime()) + 7 * MIN) / MIN) * MIN;
    const init = { owner: funder.getAddress(), operator: funder.getAddress(), seed_owner: funder.getAddress(), genesis_time: String(genesis),
      week_length: String(WEEK), close_delay: String(CLOSE), settle_length: String(SETTLE), timelock_length: String(LOCK), min_stake: String(VHP), max_sponsor_rc: "0" };
    const r = await chain.send([{ method: "init", args: init }], [funder, contractKey], { rcLimitKoin: 5 });
    if (!r.ok) throw new Error(`init failed: ${r.error}`);
    st.genesis = genesis; save();
    log(`  initialised: 45-minute weeks from ${new Date(genesis).toISOString()}`);
  }
  const G = st.genesis!;

  // 2. test KOIN for the vault's Mana and the two players; each stakes 1 KOIN (burned into VHP) before week 0
  if (!st.funded) {
    log("\n2. Test KOIN to the vault and two players …");
    await send(funder, [transfer(C, 10n * VHP), transfer(A.getAddress(), 10n * VHP), transfer(B.getAddress(), 8n * VHP)], "fund");
    st.funded = true; save();
  }
  if (!st.staked) {
    for (const p of [A, B]) await send(p, [approve(p.getAddress(), VHP), { method: "deposit_koin", args: { from: p.getAddress(), amount: String(VHP) } }], "stake", 2);
    st.staked = true; save();
  }

  // 3. 60 questions in week 0, then the 61st is refused
  await waitUntil(G + MIN, "week 0 to start");
  const s0 = await chain.read("get_state", {});
  st.caps = `week ${s0.week}: questions_cap ${s0.questions_cap}, questions_cap_next ${s0.questions_cap_next}`; save();
  log(`  ${st.caps}`);
  const lock = G + LOCK_AT;
  const qArgs = (ws: number) => ({ k: 2, lock_time: String(lock), window_start: String(ws), window_end: String(ws + 20), params_hash: "0x" + "ab".repeat(32) });
  if ((st.posted ?? 0) < N) {
    log(`\n3. Posting ${N} questions …`);
    const ws = (await height()) + Math.ceil((lock - (await chainTime())) / 2800) + 20;
    st.windowEnd = ws + 20; save();
    while ((st.posted ?? 0) < N) {
      const n = Math.min(BATCH, N - (st.posted ?? 0));
      const r = await send(funder, Array.from({ length: n }, () => ({ method: "post_question", args: qArgs(ws) })), "post questions", 10);
      if (!st.m.post10) note("post10", r.rcUsed, "posting 10 questions in one transaction");
      st.posted = (st.posted ?? 0) + n; save();
    }
  }
  if (!st.refused61) {
    const r = await chain.send([{ method: "post_question", args: qArgs(st.windowEnd! - 20) }], [funder], { rcLimitKoin: 2 });
    st.refused61 = r.ok ? "NOT REFUSED (unexpected)" : String(r.error).slice(0, 300); save();
    log(`  the 61st question: ${r.ok ? "accepted (unexpected!)" : "refused"}`);
  }

  // 4. answers: A answers all 60 (measured 1st, 30th, 60th), B answers 30 (measured 30th)
  log("\n4. Answers …");
  // The measured answers (A's 1st, 30th and 60th, B's 30th) go alone in their transaction; the others in batches of 10,
  // so 90 answers fit in the answer window.
  const ans = (p: Signer, id: number, option: number) => ({ method: "answer", args: { player: p.getAddress(), question_id: id, option } });
  const answerAll = async (p: Signer, name: "A" | "B", total: number, measured: number[], option: (i: number) => number) => {
    const key = name === "A" ? "answeredA" : "answeredB";
    while ((st[key] ?? 0) < total) {
      const i = st[key] ?? 0;
      if (measured.includes(i + 1)) {
        const r = await send(p, [ans(p, i, option(i))], `${name} answer ${i + 1}`, 2);
        note(`answer${name}${i + 1}`, r.rcUsed, `player ${name}'s answer no. ${i + 1} (alone in its transaction)`);
        st[key] = i + 1; save();
        continue;
      }
      const next = Math.min(total, i + 10, ...measured.filter((m) => m - 1 > i).map((m) => m - 1));
      await send(p, Array.from({ length: next - i }, (_, j) => ans(p, i + j, option(i + j))), `${name} answers ${i + 1}–${next}`, 1.5);
      st[key] = next; save();
    }
  };
  await answerAll(A, "A", N, [1, 30, 60], () => 1);
  await answerAll(B, "B", 30, [30], (i) => i % 2);

  // 5. resolve all 60 once their blocks are final
  log("\n5. Resolving …");
  for (;;) { const h = await height(); if (h > st.windowEnd! + 62) break; log(`  … waiting for block ${st.windowEnd! + 63} (now ${h})`); await sleep(30_000); }
  while ((st.resolved ?? 0) < N) {
    const from = st.resolved ?? 0, n = Math.min(BATCH, N - from);
    const r = await send(funder, Array.from({ length: n }, (_, j) => ({ method: "resolve_question", args: { id: from + j, outcome: 1, data_hash: "0x" + "cd".repeat(32) } })), "resolve", 10);
    if (!st.m.resolve10) note("resolve10", r.rcUsed, "resolving 10 questions in one transaction");
    st.resolved = from + n; save();
  }

  // 6. close, settle (60 and 30 answers), finalize
  log("\n6. Close, settle, finalize …");
  // A week closes at the later of (its end + close delay) and (its last result + close delay).
  const lastRes = Number((await chain.read("get_week", { week: "0" })).week?.last_resolved_time ?? 0);
  await waitUntil(Math.max(G + WEEK, lastRes) + CLOSE + 5000, "week 0's close time");
  if (!st.closed) { const r = await send(funder, [{ method: "close_week", args: { week: "0" } }], "close week 0", 10); note("close", r.rcUsed, "close_week of a 60-question week"); st.closed = true; save(); }
  if (!st.settled) {
    const ra = await send(A, [{ method: "settle", args: { player: A.getAddress(), week: "0" } }], "settle A", 2);
    note("settleA60", ra.rcUsed, "settle for player A (60 answers)");
    const rb = await send(B, [{ method: "settle", args: { player: B.getAddress(), week: "0" } }], "settle B", 2);
    note("settleB30", rb.rcUsed, "settle for player B (30 answers)");
    st.settled = true; save();
  }
  const wk = (await chain.read("get_week", { week: "0" })).week;
  await waitUntil(Number(wk.settle_end) + 5000, "the settle window to end");
  if (!st.finalized) { const r = await send(funder, [{ method: "finalize_week", args: { week: "0" } }], "finalize", 10); note("finalize", r.rcUsed, "finalize_week (2 players, 60 points max)"); st.finalized = true; save(); }

  const fin = (await chain.read("get_week", { week: "0" })).week;
  const pa = (await chain.read("get_player", { player: A.getAddress(), week: "0" })).entry;
  const pb = (await chain.read("get_player", { player: B.getAddress(), week: "0" })).entry;
  const row = (k: string) => `| ${st.m[k]?.note ?? k} | ${st.m[k] ? showKoin(st.m[k].rc) : "—"} |`;
  const report = [
    "# Vault v6.1 testnet measurement: a 60-question week (V61-B1)", "",
    `Run ${new Date().toISOString()} on ${RPC}, a fresh copy of the release build \`${V61_SHA.slice(0, 8)}…\` at \`${C}\`.`,
    `${st.caps}. Week 0 holds ${fin?.questions} questions; max points ${fin?.max_points}; A has ${pa?.points} points (${pa?.answers?.length} answers), B ${pb?.points} (${pb?.answers?.length}).`,
    `The 61st question: ${st.refused61}`, "",
    "| Call | Mana used (rc_used) |", "|---|---|",
    ...["answerA1", "answerA30", "answerA60", "answerB30", "settleA60", "settleB30", "close", "finalize", "post10", "resolve10", "upload"].map(row), "",
    "Limits these must fit: sponsored answer and settle 1 Mana (the sponsor's per-transaction limit), the bot's settle 2 Mana.",
    "Paid with the players' own Mana; a sponsored call adds the sponsor's own check on top of this.", "",
  ].join("\n");
  fs.writeFileSync(file("report.md"), report);
  st.done = true; save();
  log("\n" + report);
}
