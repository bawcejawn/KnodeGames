// Source "vault-answers": Daily Questions (game 1) answers, outcomes and stakes, read from the vault (I-101, D-116).
// Ported from PR #203 (games/questions/recorder.ts: readSnapshot, listPlayers, clockOf), logic unchanged:
//   - the week's questions: get_question walking down from next_question_id while the question's week ≥ w;
//   - every player's entry for the week: list_players, 50 a page; a repeated address or a runaway listing stops;
//   - stakes from the entry itself (stake, peak_stake, voided), exactly what the contract's qEntry checks for game 1.
// The kit reads this on both nodes and requires the two to be identical.
import { clockFromState } from "../clock.ts";
import { isAddr } from "../../publish/check.inline.mjs";
import type { NodeReader, Pick, SourceRead, StakeView } from "../types.ts";

export const PAGE = 50;
export const MAX_PLAYERS = 20000;
export const MAX_QUESTIONS_BACK = 400;

export type Question = [id: number, outcome: number, lockTime: number];
export type AnswerPick = { option: number };
export type QuestionsInputs = { active: boolean; questions: Question[] };

/** The round id for question `id` (zero-padded, so ids sort as numbers). */
export const roundId = (id: number) => `q${String(id).padStart(8, "0")}`;
export const questionOf = (round: string) => Number(round.slice(1));

/** v6.1 (Kpred qShared / v61Rule): week w of game 1 is paid from a results file. */
export function sharedWeek(config: any, w: number): boolean {
  const q60 = Number(config?.q60_rule_week_plus_one ?? 0);
  return q60 > 0 && w + 1 >= q60;
}

async function listPlayers(node: NodeReader, week: number): Promise<any[]> {
  const rows: any[] = [], seen = new Set<string>();
  let start = "";
  for (;;) {
    const page = (await node.read("list_players", { limit: PAGE, week: String(week), ...(start ? { start } : {}) })).rows ?? [];
    if (!Array.isArray(page)) throw new Error("list_players gave no rows list");
    for (const r of page) {
      if (!isAddr(r?.address)) throw new Error("list_players gave a row without an address");
      if (seen.has(r.address)) throw new Error(`list_players repeated ${r.address}: stopping`);
      seen.add(r.address); rows.push(r);
    }
    if (rows.length > MAX_PLAYERS) throw new Error(`list_players returned more than ${MAX_PLAYERS} rows: stopping`);
    if (page.length < PAGE) return rows;
    start = page[page.length - 1].address;
  }
}

const num = (x: any) => Number(x ?? 0);
const big = (x: any) => BigInt(x ?? 0);

/** One node's view of week `week`. `any`: read even if the week isn't a shared-rules week (the dry-run look). */
export async function readVaultAnswers(node: NodeReader, week: number, any = false): Promise<SourceRead<AnswerPick, QuestionsInputs>> {
  const st = await node.read("get_state", {});
  const { minFor, config } = clockFromState(st);
  const active = sharedWeek(config, week);
  const picks = new Map<string, Pick<AnswerPick>[]>();
  const stakes = new Map<string, StakeView>();
  const min = String(minFor(week));
  if (!active && !any) return { picks, stakes, min, inputs: { active: false, questions: [] } };
  const next = num(st?.totals?.next_question_id);
  if (!(next > 0)) throw new Error("get_state has no next_question_id");
  const questions: Question[] = [];
  // Walk down from the newest question; stop at the first one from an earlier week (ids rise with the weeks).
  for (let id = next - 1, steps = 0; id >= 1; id--, steps++) {
    if (steps > MAX_QUESTIONS_BACK) throw new Error(`more than ${MAX_QUESTIONS_BACK} questions read back to that week: stopping`);
    const q = (await node.read("get_question", { id })).question;
    if (!q) throw new Error(`get_question ${id} is empty`);
    const qw = num(q.week);
    if (qw < week) break;
    if (qw === week) questions.push([id, num(q.outcome), num(q.lock_time)]);
  }
  questions.sort((a, b) => a[0] - b[0]);
  const ids = new Set(questions.map((q) => q[0]));
  for (const q of questions) picks.set(roundId(q[0]), []);
  const missing = new Set<number>();
  for (const r of await listPlayers(node, week)) {
    const e = r.entry;
    if (!e || !Array.isArray(e.answers) || !e.answers.length) continue;
    stakes.set(r.address, { stake: String(big(e.stake)), peak: String(big(e.peak_stake)), voided: !!e.voided });
    for (const x of e.answers) {
      const qid = num(x.question_id);
      if (!ids.has(qid)) { missing.add(qid); continue; }
      picks.get(roundId(qid))!.push({ wallet: r.address, round: roundId(qid), pick: { option: num(x.option) }, at: 0 });
    }
  }
  // A read that missed a question must never be scored (#203: "answers to questions not read").
  if (missing.size) throw new Error(`answers to questions not read for week ${week}: ${[...missing].sort((a, b) => a - b).slice(0, 10).join(", ")}`);
  for (const xs of picks.values()) xs.sort((a, b) => (a.wallet < b.wallet ? -1 : a.wallet > b.wallet ? 1 : 0));
  return { picks, stakes, min, inputs: { active: true, questions } };
}
