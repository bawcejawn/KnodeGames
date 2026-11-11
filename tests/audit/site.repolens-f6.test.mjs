// Repo Lens #F-6: harness copied from tests/audit/site.test-week-practice.test.mjs (PR #114 @ 5e7d3fa9).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { webcrypto, createHash } from "node:crypto";

const APP = process.env.APP || ".";
const src = fs.readFileSync(`${APP}/app.js`, "utf8");
const END = /\r?\n  start\(\);\r?\n\}\)\(\);\s*$/;
assert.match(src, END, "site/app.js ends with start(); })();");
const patched = src.replace(END, "\n  globalThis.__T = { S, loadQuestions, questionCard, renderResults, paramsHashOf };\n})();\n");

// ── fake DOM ──
function mk(tag) {
  let text = "";
  const e = {
    tag, nodeType: 1, attrs: {}, on: {}, children: [], hidden: false, style: {}, dataset: {}, value: "", className: "",
    setAttribute(k, v) { this.attrs[k] = String(v); }, removeAttribute(k) { delete this.attrs[k]; }, getAttribute(k) { return this.attrs[k] ?? null; },
    addEventListener(t, f) { this.on[t] = f; }, append(...k) { this.children.push(...k); }, replaceChildren(...k) { this.children = k; text = ""; },
    remove() {}, focus() {}, showModal() {}, querySelector: () => mk("div"), querySelectorAll: () => [],
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  };
  Object.defineProperty(e, "textContent", { get: () => text + e.children.map(textOf).join(""), set: (v) => { text = String(v); e.children = []; } });
  Object.defineProperty(e, "nextElementSibling", { get: () => mk("span") });
  return e;
}
const textOf = (n) => (n == null ? "" : typeof n === "string" ? n : n.textContent);
const walk = (n, out = []) => { if (n && typeof n === "object") { out.push(n); for (const c of n.children || []) walk(c, out); } return out; };
const optButtons = (card) => walk(card).filter((n) => n.tag === "button" && /\bopt\b/.test(n.className));
const byClass = (root, cls) => walk(root).filter((n) => typeof n.className === "string" && n.className.split(/\s+/).includes(cls));

function harness() {
  const els = new Map();
  const files = new Map();             // "./game-data/<path>" -> JSON text
  const chain = new Map();             // question id -> { params_hash, outcome } ; null = read fails
  const store = new Map();
  const ctx = {
    document: {
      querySelector: (s) => { if (!els.has(s)) els.set(s, mk("div")); return els.get(s); },
      querySelectorAll: () => [], createElement: mk, getElementById: () => null, head: mk("head"), body: mk("body"),
    },
    location: { pathname: "/", search: "", hash: "", href: "https://knode.test/" },
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    crypto: webcrypto, TextEncoder, Uint8Array,
    fetch: async (url) => {
      const t = files.get(String(url));
      if (t === undefined) return { ok: false, status: 404, json: async () => { throw new Error("404"); } };
      return { ok: true, status: 200, json: async () => JSON.parse(t) };
    },
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    console: { log() {}, warn() {}, error() {}, info() {}, debug() {} },
  };
  ctx.window = ctx; ctx.addEventListener = () => {}; ctx.scrollTo = () => {};
  vm.createContext(ctx);
  vm.runInContext(patched, ctx);
  const T = ctx.__T;
  // uint32 arguments are encoded with >>> 0, as protobufjs does for get_question's id.
  T.S.game = { functions: { get_question: async ({ id }) => {
    const q = chain.get(Number(id) >>> 0);
    if (q === null) throw new Error("rpc down");
    return { result: q ? { question: { params_hash: q.params_hash, outcome: q.outcome ?? 0, ...(q.facts ?? {}) } } : {} };
  } } };
  const publish = (questions, raw) => {
    files.set("./game-data/index.json", JSON.stringify({ days: ["questions/W001-D2.json"] }));
    files.set("./game-data/questions/W001-D2.json", raw ?? JSON.stringify({ week: 1, day: 2, questions }));
  };
  return { T, S: T.S, chain, publish, $: ctx.document.querySelector };
}

const A = "14f34kUNZugf2DK4hPJGy4AkmBM7Y4pvVu", B = "1G2QjRtNwEfqGwX7SMD8LNjWgJdWA7XtSU";
/** A question as the bot releases it (hashRule 2: wording hashed), before it gets its chain id. */
function released(n = 1, { hashRule = 2, lockIn = 86400000 } = {}) {
  const q = {
    id: `W001-D2-${n}`, date: "W001-D2", week: 1, day: 2, tier: "Easy", template: "E2s",
    releaseHeight: 40500000, lockHeight: 40514700, lockTime: Date.now() + lockIn,
    title: "Head-to-head with spread",
    text: `Producer ${A}'s blocks minus producer ${B}'s blocks, between block 40,514,701 and block 40,524,700: will the difference be more than 298?`,
    subjects: [A, B], unit: "count", windowStart: 40514701 + n, windowEnd: 40524700 + n, thresholds: [298],
    options: [{ index: 0, label: "No — 298 or less", min: null, max: 298 }, { index: 1, label: "Yes — 299 or more", min: 299, max: null }],
  };
  if (hashRule != null) q.hashRule = hashRule;
  return q;
}
/** Posts q as the contract stores it: its fingerprint plus the lock time, window and option count it enforces. */
const factsOf = (q) => ({ k: (q.options || []).length, lock_time: String(q.lockTime ?? 0), window_start: String(q.windowStart ?? 0), window_end: String(q.windowEnd ?? 0) });
async function post(h, id, q, outcome = 0) { h.chain.set(id, { params_hash: await h.T.paramsHashOf(structuredClone(q)), outcome, facts: factsOf(q) }); }
const qOf = (h, id) => h.S.questions.find((q) => Number(q.chainId) === id);

async function practice({ testWeeks, chainHash, fileResult = { option: 1, value: "412", dataHash: "ab".repeat(32) } }) {
  const h = harness();
  h.S.dep = { vaultTestWeeks: testWeeks };
  const q = released(1, { lockIn: -86400000 });
  await post(h, 5, q, 1000);
  h.chain.get(5).facts.data_hash = chainHash;
  h.publish([{ ...structuredClone(q), chainId: 5, result: fileResult }]);
  await h.T.loadQuestions();
  h.S.height = q.windowEnd + 1000;
  h.T.renderResults();
  const list = h.$("#results-list");
  return { letters: byClass(list, "res-letter").map(textOf), warn: byClass(list, "q-warn").map(textOf), badge: byClass(list, "badge-practice").map(textOf) };
}

// Repo Lens #F-6 F6-3 (Low): the chain's data_hash is the hash of the window's blocks only (resolver.ts dataHashOf);
// it does not cover the option. A file edited to another option, with the real data_hash kept, still matches.
test("F6-3 (Low): an edited file that keeps the real data_hash but changes the option is not shown as practice", async () => {
  // Vault chat: the chain now carries the practice hash (sha256 of data_hash + ":practice:" + option), as the report's fix
  // proposes, so the control posts that; the edited file keeps the same chain hash.
  const H = "0x" + createHash("sha256").update(`${"ab".repeat(32)}:practice:1`).digest("hex");
  const real = await practice({ testWeeks: [1], chainHash: H, fileResult: { option: 1, value: "412", dataHash: "ab".repeat(32) } });
  assert.deepEqual(real.letters, ["B"], "control: the bot's real answer (B) is shown");
  const edited = await practice({ testWeeks: [1], chainHash: H, fileResult: { option: 0, value: "412", dataHash: "ab".repeat(32) } });
  assert.deepEqual(edited.letters, [], `an edited option must not be shown as the practice answer; shown: ${JSON.stringify(edited.letters)}`);
});
