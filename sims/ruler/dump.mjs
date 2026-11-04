// Turns the history the simulations workflow prints into its log ("DUMP <i> <chunk>" lines, REAL=1 run) back into a
// ruler timeline, so the simulations and any check can be re-run anywhere on the same real data.
//   node sims/ruler/dump.mjs <job-log.txt> <out-timeline.json>
import fs from "node:fs";
import zlib from "node:zlib";
import crypto from "node:crypto";
export function fromLog(text) {
  const parts = [], m = /DUMP (\d+) ([A-Za-z0-9+/=]+)\s*$/;
  let n = null;
  for (const line of text.split("\n")) {
    const e = /DUMP END (\d+) (\d+)/.exec(line); if (e) { n = Number(e[1]); continue; }
    const x = m.exec(line); if (x) parts[Number(x[1])] = x[2];
  }
  if (n === null || parts.length !== n || parts.some((p) => !p)) throw new Error(`the log holds ${parts.filter(Boolean).length} of ${n} parts`);
  return JSON.parse(zlib.gunzipSync(Buffer.from(parts.join(""), "base64")).toString("utf8"));
}
export function timelineOf(d) {
  const sig = Buffer.from(d.sig, "base64"), signers = Array.from(sig, (i) => d.signers[i]), burns = d.burns.split(",");
  if (signers.length !== d.to - d.from + 1 || burns.length !== signers.length) throw new Error("bad dump");
  const deltas = [];
  signers.forEach((a, i) => deltas.push({ h: d.from + i, a, d: -BigInt(burns[i]), inc: 0n }));
  d.tail.sig.forEach((a, i) => deltas.push({ h: d.to + 1 + i, a, d: -BigInt(d.tail.burns[i]), inc: 0n }));
  for (const [h, k, f, t, v] of d.events) { const x = BigInt(v); if (k !== "m") deltas.push({ h, a: f, d: -x, inc: 0n }); if (k !== "b") deltas.push({ h, a: t, d: x, inc: x }); }
  const anchors = Object.fromEntries(Object.entries(d.anchor.bal).map(([a, v]) => [a, { h: d.anchor.at, v: BigInt(v) }]));
  // real ids for the race seeds (the last block of each hour and the seed blocks); the rest synthetic, labelled
  const ids = signers.map((_, i) => "0x1220" + crypto.createHash("sha256").update(`synthetic ${d.from + i}`).digest("hex"));
  for (const [h, id] of Object.entries(d.seedIds)) ids[Number(h) - d.from] = id;
  const moves = d.events.flatMap(([h, k, f, t]) => [f, t].filter(Boolean).map((a) => [h, a]));   // non-burn VHP changes
  return { from: d.from, to: d.to, signers, ids, deltas, anchors, moves, synthetic: "ids except race seeds" };
}
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const tl = timelineOf(fromLog(fs.readFileSync(process.argv[2], "utf8")));
  fs.writeFileSync(process.argv[3], JSON.stringify(tl, (k, v) => (typeof v === "bigint" ? v.toString() : v)));
  console.log(`${tl.to - tl.from + 1} blocks, ${tl.deltas.length} VHP changes, ${Object.keys(tl.anchors).length} anchors`);
}
