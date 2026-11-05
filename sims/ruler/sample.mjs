// Turns the Bracket's 8-day mainnet sample (data/bracket-vhp-sample.json.gz on kg-09-bracket) into a ruler timeline
// (the same shape vhp-data hours become: see vhp-data.js). The sample has no block ids, so ids here are SYNTHETIC
// (sha256 of the height, labelled), fine for simulations, never for a paying card.
//   node sims/ruler/sample.mjs <sample.json> <out-timeline.json>
import fs from "node:fs";
import zlib from "node:zlib";
import crypto from "node:crypto";
import vm from "node:vm";
const box = { window: {} };
vm.runInNewContext(fs.readFileSync(new URL("../../vhp-ruler.js", import.meta.url), "utf8"), box);
const R = box.window.KRuler;
export function sampleTimeline(S) {
  const VHP = S.contracts.VHP, from = S.from, to = S.top;
  const signers = S.blocks.sig.map((i) => S.blocks.signers[i]);
  const ev = [...S.events, ...S.tail].filter((e) => e.src === VHP);
  const deltas = R.vhpDeltas(ev, VHP);
  // the balance read: "before" block B means after block B − 1
  const B = S.balances.primary.before, anchors = {};
  for (const [a, v] of Object.entries(S.balances.primary.values)) anchors[a] = { h: B - 1, v: BigInt(v) };
  const ids = signers.map((_, i) => "0x1220" + crypto.createHash("sha256").update(`synthetic ${from + i}`).digest("hex"));
  return { from, to, signers, ids, deltas, anchors, synthetic: "ids" };
}
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const raw = fs.readFileSync(process.argv[2]);
  const S = JSON.parse((raw[0] === 0x1f ? zlib.gunzipSync(raw) : raw).toString("utf8"));
  const tl = sampleTimeline(S);
  fs.writeFileSync(process.argv[3], JSON.stringify(tl, (k, v) => (typeof v === "bigint" ? v.toString() : v)));
  console.log(`${tl.to - tl.from + 1} blocks, ${tl.deltas.length} VHP changes, ${Object.keys(tl.anchors).length} anchors`);
}
