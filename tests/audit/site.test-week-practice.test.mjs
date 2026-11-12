// Owner, 10 Nov: a test week (deployment.json vaultTestWeeks) plays but pays nothing. The bot posts its questions VOID on
// chain with the practice hash of the real result (sha256 of its data_hash + ":practice:" + option, Repo Lens #F-6 F6-3);
// the page shows that real result as a practice result only when the file's result gives the same hash (#F-4 F4-1). Other weeks: a chain void stays void. Harness copied from site.results-chain.test.mjs.
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

const practiceHash = (dataHash, option) => createHash("sha256").update(`${dataHash}:practice:${option}`).digest("hex");
const REAL = "0x" + practiceHash("ab".repeat(32), 1);
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

test("test week: VOID on chain with the result's data_hash shows the real answer as practice, with no warning", async () => {
  const r = await practice({ testWeeks: [1], chainHash: REAL });
  assert.deepEqual(r.letters, ["B"]);
  assert.deepEqual(r.warn, []);
  assert.equal(r.badge.length, 1);
});

test("test week: a chain hash that isn't the file result's practice hash is not shown as practice (stays void)", async () => {
  for (const chainHash of ["0x" + "cd".repeat(32), "0x" + "ab".repeat(32)]) {   // another hash, or the bare blocks hash
  const r = await practice({ testWeeks: [1], chainHash });
  assert.deepEqual(r.letters, []);
  assert.equal(r.badge.length, 0);
  }
});

test("not a test week: a chain void stays void, whatever the file says", async () => {
  for (const testWeeks of [[3], undefined]) {
    const r = await practice({ testWeeks, chainHash: REAL });
    assert.deepEqual(r.letters, [], JSON.stringify(testWeeks));
    assert.equal(r.badge.length, 0);
  }
});
