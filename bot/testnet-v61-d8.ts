/**
 * testnet-v61-d8: the two measurements Repo Lens #D-8 asks for before the v6.1 upload (R-VAULT-11), in one command.
 *
 * On the Koinos Foundation testnet (test KOIN only) it deploys a FRESH copy of the v6.1 release build 399171a2… with
 * 13 games registered (each with a stake), runs a 90-minute week 0 with 60 questions, then measures:
 *   D8-2  a returning player's FIRST answer of week 1 (after D-116 there is no settle step; owner 4 Nov: a player's
 *         action never closes a week, the bot does):
 *         - C answers after week 0's close time: the answer must leave week 0 open (it would cost ~0.7 Mana more);
 *         - the bot's close_week (13 games), then A's first answer;
 *   plus each player's answers no. 1/30/60, game 1's results, seal, finalize and claim, a stake and a withdrawal.
 *   D8-1  every measured call's resource units (compute ticks, disk bytes, network bytes) and transaction id, written
 *         to testnet-v61-d8/units.json, so `npx tsx tools/mainnet-mana.ts <file>` can price them at mainnet's
 *         current resource prices (read-only, on the owner's PC).
 *
 *   npm run bot -- testnet-v61-d8           runs (or carries on), then writes testnet-v61-d8/report.md and units.json
 *   npm run bot -- testnet-v61-d8 status
 *
 * The funder is the testnet-v6 run's throwaway testnet wallet (testnet-v6/keys.json). It never reads .env, never
 * touches mainnet, and refuses to run unless the node answers with the testnet's chain id.
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
const V61_SHA = "11043e1fde1d8d7dbac75e9e5e788d058a7116b0dab6149fc09ecdc7b1c4258b";
const DIR = "testnet-v61-d8";
const VHP = 100_000_000n;
const MIN = 60_000;
const WEEK = 90 * MIN, CLOSE = 3 * MIN, SETTLE = 10 * MIN, LOCK = 2 * MIN;
const N = 60, LOCK_AT = 65 * MIN, BATCH = 10;   // four players × 60 answers need about 40 minutes on the testnet

const log = (...a: any[]) => console.log(...a);
const file = (n: string) => path.join(DIR, n);
const readJ = (p: string, d: any) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : d);
const writeJ = (n: string, v: any) => { fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(file(n), JSON.stringify(v, null, 2) + "\n"); };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type M = { rc: string; compute: string; disk: string; network: string; tx: string; note: string };
type State = { contract?: string; uploaded?: boolean; genesis?: number; funded?: boolean; gamesProposed?: boolean; gamesApplied?: boolean;
  staked?: boolean; posted?: number; windowEnd?: number; refused61?: string; answered: Record<string, number>; resolved?: number;
  rewards?: boolean; w1posted?: boolean; w1question?: number; closeAnswer?: boolean; closed?: boolean; settleAnswer?: boolean; settled?: boolean;
  finalized?: boolean; moneyMeasured?: boolean; notes?: string[]; caps?: string; m: Record<string, M>; done?: boolean };

export async function testnetV61D8(args: string[]) {
  fs.mkdirSync(DIR, { recursive: true });
  const provider = new Provider([RPC]);
  const cid: any = await provider.call("chain.get_chain_id", {});
  if (cid?.chain_id !== CHAIN_ID) throw new Error(`${RPC} is not the Koinos Foundation testnet (chain id ${cid?.chain_id}). Stopping.`);
  const fund = readJ("testnet-v6/keys.json", null);
  if (!fund?.funder) throw new Error("testnet-v6/keys.json (the testnet funder) not found.");
  let keys = readJ(file("keys.json"), null);
  if (!keys) {
    const rnd = () => utils.toHexString(crypto.randomBytes(32));
    keys = { note: "TESTNET ONLY: throwaway keys for npm run bot -- testnet-v61-d8. Worthless; never use them on mainnet.",
      contract: Signer.fromSeed(rnd()).getPrivateKey("wif", true), playerSeed: rnd() };
    writeJ("keys.json", keys);
  }
  const funder = Signer.fromWif(fund.funder), contractKey = Signer.fromWif(keys.contract);
  funder.provider = provider; contractKey.provider = provider;
  const P: Record<string, Signer> = Object.fromEntries(["A", "B", "C", "D"].map((n) => { const s = Signer.fromSeed(`${keys.playerSeed} player ${n}`); s.provider = provider; return [n, s]; }));
  const koin = new Contract({ id: KOIN, abi: tokenAbi as any, provider });
  const bal = async (a: string) => BigInt(((await (koin.functions as any).balance_of({ owner: a })).result?.value) ?? 0);
  const st: State = readJ(file("state.json"), { m: {}, answered: {} });
  st.answered ??= {};
  const save = () => writeJ("state.json", st);
  const C = contractKey.getAddress();
  log(`Testnet         ${RPC}`);
  log(`Funder wallet   ${funder.getAddress()}   holds ${showKoin(await bal(funder.getAddress()))} test KOIN`);
  log(`Vault (test)    ${C}${st.uploaded ? "" : "  (not deployed yet)"}`);
  if (args[0] === "status") { log(JSON.stringify(st, null, 2)); return; }
  if (st.done) { log(`This run is finished; see ${DIR}/report.md.`); return; }

  const wasm = fs.readFileSync(WASM);
  const sha = crypto.createHash("sha256").update(wasm).digest("hex");
  if (sha !== V61_SHA) throw new Error(`${WASM} is ${sha}, not the audited v6.1 build ${V61_SHA}.`);
  const chain = new KoinosChain(RPC, C);
  const head = async () => (await provider.getHeadInfo()) as any;
  const chainTime = async () => Number((await head()).head_block_time);
  const height = async () => Number((await head()).head_topology.height);
  const waitUntil = async (t: number, what: string) => {
    for (;;) { const now = await chainTime(); if (now >= t) return; log(`  … waiting ${Math.ceil((t - now) / 1000)} s for ${what}`); await sleep(Math.min(60_000, t - now + 3000)); }
  };
  /** Sends and returns the receipt (rc and resource units). Mempool "pending resources": wait and retry. */
  /** The funder's own Mana ran low after the uploads: its calls are paid by whichever test player has the most Mana. */
  const payerFor = async (who: Signer): Promise<Signer> => {
    if (who !== funder) return who;
    const own = BigInt(await provider.getAccountRc(funder.getAddress()));
    if (own > toSat(2)) return funder;
    let best = funder, bestMana = own;
    for (const n of ["B", "D", "C", "A"]) { const m = BigInt(await provider.getAccountRc(P[n].getAddress())); if (m > bestMana) { best = P[n]; bestMana = m; } }
    return best;
  };
  const sendR = async (who: Signer, calls: any[], what: string, rcLimitKoin = 3): Promise<any> => {
    for (let attempt = 1; ; attempt++) {
      try {
        const payer = await payerFor(who);
        const mana = BigInt(await provider.getAccountRc(payer.getAddress()));
        const cap = toSat(rcLimitKoin), limit = (mana * 95n) / 100n < cap ? (mana * 95n) / 100n : cap;
        const tx = new Transaction({ signer: who, provider, options: { payer: payer.getAddress(), payee: who.getAddress(), rcLimit: limit.toString() } });
        for (const c of calls) await tx.pushOperation(await chain.op(c));
        await tx.prepare();
        let t: any = await who.signTransaction(tx.transaction!);
        if (payer !== who) t = await payer.signTransaction(t);
        const { receipt, transaction } = await provider.sendTransaction(t);
        if ((receipt as any)?.reverted) throw new Error(`reverted: ${JSON.stringify((receipt as any).logs)}`);
        await transaction.wait("byBlock", 180_000);
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
  const transfer = (to: string, value: bigint) => ({ contract: KOIN, abi: tokenAbi, method: "transfer", args: { from: funder.getAddress(), to, value: String(value) } });
  const approve = (owner: string, value: bigint) => ({ contract: KOIN, abi: tokenAbi, method: "approve", args: { owner, spender: C, value: String(value) } });

  // 1. upload and init
  if (!st.uploaded) {
    log("\n1. Uploading a fresh v6.1 vault …");
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
    note("upload", { ...(receipt as any), id: t.id }, `uploading the ${(wasm.length / 1024).toFixed(1)} KB v6.1 contract`);
  }
  if (!st.genesis) {
    const genesis = Math.ceil(((await chainTime()) + 9 * MIN) / MIN) * MIN;
    const init = { owner: funder.getAddress(), operator: funder.getAddress(), seed_owner: funder.getAddress(), genesis_time: String(genesis),
      week_length: String(WEEK), close_delay: String(CLOSE), settle_length: String(SETTLE), timelock_length: String(LOCK), min_stake: String(VHP), max_sponsor_rc: "0" };
    const r = await chain.send([{ method: "init", args: init }], [funder, contractKey], { rcLimitKoin: 5 });
    if (!r.ok) throw new Error(`init failed: ${r.error}`);
    st.genesis = genesis; save();
    log(`  initialised: 90-minute weeks from ${new Date(genesis).toISOString()}`);
  }
  const G = st.genesis!, weekEnd = (w: number) => G + (w + 1) * WEEK;

  // 2. money, 13 games, stakes (players in game 1; the funder 1 KOIN in each of games 2–13), all before week 0
  if (!st.funded) {
    log("\n2. Test KOIN to the vault and four players …");
    await sendR(funder, [transfer(C, 10n * VHP), ...["A", "B", "C", "D"].map((n) => transfer(P[n].getAddress(), 6n * VHP))], "fund", 3);
    st.funded = true; save();
  }
  if (!st.gamesProposed) {
    log("  announcing games 2–13 …");
    const calls = [];
    for (let id = 2; id <= 13; id++) calls.push({ method: "propose_game", args: { game: id, name: `Test game ${id}`, staked: true, free_prize: true, season_weeks: 1 } });
    for (let i = 0; i < calls.length; i += 6) await sendR(funder, calls.slice(i, i + 6), "propose games", 5);
    st.gamesProposed = true; save();
  }
  if (!st.gamesApplied) {
    const eta = Math.max(...((await chain.read("list_games", {})).proposals ?? []).map((p: any) => Number(p.eta ?? 0)));
    await waitUntil(eta + 5000, "the games' 2-minute notice");
    const calls = [];
    for (let id = 2; id <= 13; id++) calls.push({ method: "apply_game", args: { game: id } });
    for (let i = 0; i < calls.length; i += 6) await sendR(funder, calls.slice(i, i + 6), "apply games", 5);
    st.gamesApplied = true; save();
  }
  if (!st.staked) {
    log("  stakes …");
    for (const n of ["A", "B", "C", "D"]) await sendR(P[n], [approve(P[n].getAddress(), VHP), { method: "deposit_to", args: { game: 1, from: P[n].getAddress(), amount: String(VHP), koin: true } }], `stake ${n}`, 2);
    for (let id = 2; id <= 13; id += 4)
      await sendR(funder, [2, 3, 4, 5].filter((j) => id + j - 2 <= 13).flatMap((j) => [approve(funder.getAddress(), VHP), { method: "deposit_to", args: { from: funder.getAddress(), game: id + j - 2, amount: String(VHP), koin: true } }]), "stake games", 5);
    st.staked = true; save();
  }

  // 3. week 0: 60 questions; the 61st refused
  await waitUntil(G + MIN, "week 0 to start");
  if (!st.caps) { const s0 = await chain.read("get_state", {}); st.caps = `week ${s0.week}: questions_cap ${s0.questions_cap}, questions_cap_next ${s0.questions_cap_next}`; save(); }
  log(`  ${st.caps}`);
  const lock0 = G + LOCK_AT;
  const qArgs = (lock: number, ws: number) => ({ k: 2, lock_time: String(lock), window_start: String(ws), window_end: String(ws + 20), params_hash: "0x" + "ab".repeat(32) });
  if ((st.posted ?? 0) < N) {
    log(`\n3. Posting ${N} questions …`);
    const ws = (await height()) + Math.ceil((lock0 - (await chainTime())) / 2800) + 20;
    st.windowEnd = ws + 20; save();
    while ((st.posted ?? 0) < N) {
      const n = Math.min(BATCH, N - (st.posted ?? 0));
      const r = await sendR(funder, Array.from({ length: n }, () => ({ method: "post_question", args: qArgs(lock0, ws) })), "post", 3);
      if (!st.m.post10) note("post10", r, "posting 10 questions in one transaction");
      st.posted = (st.posted ?? 0) + n; save();
    }
  }
  if (!st.refused61) {
    try { await sendR(funder, [{ method: "post_question", args: qArgs(lock0, st.windowEnd! - 20) }], "61st", 2); st.refused61 = "NOT REFUSED (unexpected)"; }
    catch (e: any) { st.refused61 = String(e.message).slice(0, 300); }
    save(); log(`  the 61st question: ${st.refused61}`);
  }

  // 4. answers: A, C, D all 60 (A's 1st/30th/60th measured alone), B 30 (its 30th measured)
  log("\n4. Answers …");
  const ans = (n: string, id: number, option: number) => ({ method: "answer", args: { player: P[n].getAddress(), question_id: id, option } });
  const answerAll = async (n: string, total: number, measured: number[], option: (i: number) => number) => {
    // A batch that timed out may still have been mined: count the player's week-0 answers on chain first.
    const onChain = ((await chain.read("get_player", { player: P[n].getAddress(), week: "0" })).entry?.answers ?? []).length;
    if (onChain > (st.answered[n] ?? 0)) { st.answered[n] = onChain; save(); }
    while ((st.answered[n] ?? 0) < total) {
      const i = st.answered[n] ?? 0;
      if (measured.includes(i + 1)) {
        note(`answer${n}${i + 1}`, await sendR(P[n], [ans(n, i, option(i))], `${n} answer ${i + 1}`, 1.5), `player ${n}'s answer no. ${i + 1} of week 0 (alone)`);
        st.answered[n] = i + 1; save(); continue;
      }
      const next = Math.min(total, i + BATCH, ...measured.filter((m) => m - 1 > i).map((m) => m - 1));
      await sendR(P[n], Array.from({ length: next - i }, (_, j) => ans(n, i + j, option(i + j))), `${n} answers ${i + 1}–${next}`, 1.5);
      st.answered[n] = next; save();
    }
  };
  await answerAll("A", N, [1, 30, 60], () => 1);
  await answerAll("C", N, [], () => 1);
  await answerAll("D", N, [], (i) => (i < 45 ? 1 : 0));
  await answerAll("B", 30, [30], (i) => i % 2);

  // 5. resolve once final; stand-in rewards for the week
  log("\n5. Resolving …");
  for (;;) { const h = await height(); if (h > st.windowEnd! + 62) break; log(`  … waiting for block ${st.windowEnd! + 63} (now ${h})`); await sleep(30_000); }
  while ((st.resolved ?? 0) < N) {
    // A batch that timed out may still have been mined: skip questions the chain already shows as resolved.
    while ((st.resolved ?? 0) < N && Number((await chain.read("get_question", { id: String(st.resolved ?? 0) })).question?.outcome ?? 0) !== 0) {
      st.resolved = (st.resolved ?? 0) + 1; save();
    }
    if ((st.resolved ?? 0) >= N) break;
    const from = st.resolved ?? 0, n = Math.min(BATCH, N - from);
    const r = await sendR(funder, Array.from({ length: n }, (_, j) => ({ method: "resolve_question", args: { id: from + j, outcome: 1, data_hash: "0x" + "cd".repeat(32) } })), "resolve", 3);
    if (!st.m.resolve10) note("resolve10", r, "resolving 10 questions in one transaction");
    st.resolved = from + n; save();
  }
  if (!st.rewards) { await sendR(funder, [transfer(C, 5n * VHP)], "rewards", 2); st.rewards = true; save(); }

  // 6. week 1: one question, posted before week 0's close time (so posting doesn't close week 0)
  const lastRes = Number((await chain.read("get_week", { week: "0" })).week?.last_resolved_time ?? 0);
  const closeAt = Math.max(weekEnd(0), lastRes) + CLOSE;
  if (!st.w1posted) {
    await waitUntil(weekEnd(0) + 15_000, "week 1 to start");
    if ((await chainTime()) >= closeAt - 20_000) throw new Error("Too late to post week 1's question before week 0's close time; start over.");
    const lock1 = closeAt + 10 * MIN;
    const ws = (await height()) + Math.ceil((lock1 - (await chainTime())) / 2800) + 20;
    const r = await sendR(funder, [{ method: "post_question", args: qArgs(lock1, ws) }], "post week 1", 3);
    const w0 = (await chain.read("get_week", { week: "0" })).week;
    if (w0?.closed) throw new Error("Posting week 1's question closed week 0: the with-close measurement is lost; start over.");
    st.w1posted = true; st.w1question = N; save();
    log(`  week 1's question posted (${showKoin(r.rc_used)} Mana); week 0 still open`);
  }

  // 7. D8-2: C's first answer of week 1 is the first action after week 0's close time. Owner 4 Nov: it must NOT close
  //    week 0 (that cost ~0.7 Mana more than the answer); the bot's close_week does, and is measured on its own.
  log("\n7. The returning players' first answers of week 1 …");
  await waitUntil(closeAt + 5000, "week 0's close time");
  st.notes ??= [];
  if (!st.closeAnswer) {
    note("firstAnswerDue", await sendR(P.C, [ans("C", st.w1question!, 1)], "C first answer week 1", 3),
      "C's first answer of week 1, sent after week 0 was due to close (it must leave the close to the bot)");
    const closed = !!(await chain.read("get_week", { week: "0" })).week?.closed;
    st.notes.push(closed ? "⚠ C's answer CLOSED week 0: player actions must not close weeks." : "✔ C's answer left week 0 open (due, not closed): the close is the bot's.");
    log(`  ${st.notes[st.notes.length - 1]}`);
    st.closeAnswer = true; save();
  }
  if (!st.closed) {
    if (!(await chain.read("get_week", { week: "0" })).week?.closed)
      note("closeWeek13", await sendR(funder, [{ method: "close_week", args: { week: "0" } }], "close week 0", 3), "the bot's close_week for week 0 (13 games)");
    st.closed = true; save();
  }
  if (!st.settleAnswer) {
    note("firstAnswerSettle", await sendR(P.A, [ans("A", st.w1question!, 1)], "A first answer week 1", 3),
      "A's first answer of week 1 (week 0 already closed; no settle step under the shared rules)");
    st.settleAnswer = true; save();
  }
  // 8. Game 1's week 0 paid like every game (D-116): the operator posts the points from the answers, seals, finalizes; A claims.
  if (!st.settled) {
    note("postResults4", await sendR(funder, [{ method: "post_results", args: { game: 1, week: "0", rows: [
      { player: P.A.getAddress(), points: 60 }, { player: P.C.getAddress(), points: 60 }, { player: P.D.getAddress(), points: 45 }, { player: P.B.getAddress(), points: 15 }] } }], "post results", 3),
      "posting game 1's results for 4 players");
    note("seal", await sendR(funder, [{ method: "seal_results", args: { game: 1, week: "0" } }], "seal", 3), "sealing game 1's week");
    st.settled = true; save();
  }
  const gw0 = (await chain.read("get_game", { game: 1, week: "0" })).week;
  await waitUntil(Number(gw0.seal_time) + 2 * CLOSE + 5000, "the correction window after the seal");
  if (!st.finalized) {
    note("finalizeGame", await sendR(funder, [{ method: "finalize_game_week", args: { game: 1, week: "0" } }], "finalize game week", 3), "finalize_game_week for game 1 (4 players)");
    note("claimGame", await sendR(P.A, [{ method: "claim_game", args: { game: 1, week: "0", player: P.A.getAddress() } }], "claim A", 2), "A's claim_game for game 1");
    st.finalized = true; save();
  }
  // 9. A stake and a withdrawal in game 1, as the Stake page sends them (approve + deposit_to in one transaction).
  if (!st.moneyMeasured) {
    note("depositTo1", await sendR(P.B, [approve(P.B.getAddress(), VHP), { method: "deposit_to", args: { game: 1, from: P.B.getAddress(), amount: String(VHP), koin: true } }], "stake B", 3),
      "B's stake in game 1 (approve + deposit_to, 1 KOIN)");
    note("withdrawFrom1", await sendR(P.D, [{ method: "withdraw_from", args: { game: 1, to: P.D.getAddress(), amount: String(VHP) } }], "withdraw D", 3),
      "D's withdrawal from game 1 (withdraw_from, 1 VHP)");
    st.moneyMeasured = true; save();
  }

  // 8. report and units
  const fin = (await chain.read("get_game", { game: 1, week: "0" })).week;
  const order = ["answerA1", "answerA30", "answerA60", "answerB30", "firstAnswerDue", "firstAnswerSettle", "depositTo1", "withdrawFrom1", "claimGame",
    "closeWeek13", "postResults4", "seal", "finalizeGame", "post10", "resolve10", "upload"];
  const units = { run: new Date().toISOString(), rpc: RPC, contract: C, build: V61_SHA, games: 13,
    calls: order.filter((k) => st.m[k]).map((k) => ({ key: k, ...st.m[k] })) };
  writeJ("units.json", units);
  const report = [
    "# Vault v6.1 testnet measurement for Repo Lens #D-8 (D8-1 units, D8-2 first answer of the week)", "",
    `Run ${units.run} on ${RPC}: a fresh copy of \`${V61_SHA.slice(0, 8)}…\` at \`${C}\`, 13 games registered, each with a stake.`,
    `${st.caps}. Game 1's week 0: bucket ${showKoin(fin?.bucket)}, max points ${fin?.max_points}, ${fin?.eligible_players} posted, ${fin?.winners} winner(s). The 61st question: ${st.refused61}`, "",
    ...(st.notes ?? []), "",
    "| Call | Testnet Mana | Compute (ticks) | Disk (bytes) | Network (bytes) | Transaction |", "|---|---|---|---|---|---|",
    ...units.calls.map((c) => `| ${c.note} | ${showKoin(c.rc)} | ${Number(c.compute).toLocaleString("en-US")} | ${c.disk} | ${c.network} | \`${c.tx}\` |`), "",
    "Mainnet Mana: `npx tsx tools/mainnet-mana.ts docs/testnet-v61-units.json` (read-only) prices these units at mainnet's current resource prices.", "",
  ].join("\n");
  fs.writeFileSync(file("report.md"), report);
  st.done = true; save();
  log("\n" + report);
}
