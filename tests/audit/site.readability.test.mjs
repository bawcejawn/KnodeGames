// Readability fixes from the launch UI research (claude/hub/UI-RESEARCH-2026-11-05.md, items 1-3): small labels at least
// 13 px and every one of them at least 4.5:1 contrast (WCAG AA) in light AND dark mode, worked out from the site's own
// colour tokens, so a later token or rule change can't quietly make one unreadable again.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const APP = process.env.APP || ".";
const css = fs.readFileSync(`${APP}/styles.css`, "utf8"), games = fs.readFileSync(`${APP}/games.html`, "utf8");
const tokens = (block) => Object.fromEntries([...block.matchAll(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})/g)].map((m) => [m[1], m[2]]));
const light = tokens(css.slice(css.indexOf(":root {"), css.indexOf("@media (prefers-color-scheme: dark)")));
const dark = { ...light, ...tokens(css.slice(css.indexOf(':root[data-theme="dark"] {'), css.indexOf("}", css.indexOf(':root[data-theme="dark"] {')))) };
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; const [r, g, b] = c.map(f); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
/** A CSS colour value: var(--x), a hex, or color-mix(in srgb, A n%, B). */
function colour(v, T) {
  v = v.trim();
  const mix = v.match(/^color-mix\(in srgb, (.+?) (\d+)%, (.+)\)$/);
  if (mix) { const a = colour(mix[1], T), b = colour(mix[3], T), t = Number(mix[2]) / 100; return a.map((x, i) => Math.round(x * t + b[i] * (1 - t))); }
  const vr = v.match(/^var\(--([a-z0-9-]+)\)$/); if (vr) return rgb(T[vr[1]]);
  if (/^#[0-9A-Fa-f]{6}$/.test(v)) return rgb(v);
  throw new Error(`can't read colour ${v}`);
}
const rule = (src, sel) => { const i = src.indexOf(`${sel} {`); assert.ok(i >= 0, `rule ${sel}`); return src.slice(i, src.indexOf("}", i)); };
const prop = (r, p) => (r.match(new RegExp(`(?:^|[;{ ])${p}:\\s*([^;]+);`)) || [])[1];

const cases = [
  [css, ".tier-Easy"], [css, ".tier-Medium"], [css, ".tier-Hard"],
  [games, ".pill.free"], [games, ".pill.soon"], [games, ".pill.staked"],
  [css, ".welcome-steps li > span"], [css, ".welcome-steps li.last > span"],
];
test("small labels and the welcome step numbers are at least 4.5:1 in light and dark mode", () => {
  for (const [src, sel] of cases) for (const [name, T] of [["light", light], ["dark", dark]]) {
    const r = rule(src, sel), fg = colour(prop(r, "color"), T), bg = colour(prop(r, "background"), T), c = ratio(fg, bg);
    assert.ok(c >= 4.5, `${sel} in ${name} mode: ${c.toFixed(2)}:1`);
  }
});
test("small labels are at least 13 px", () => {
  assert.match(prop(rule(games, ".pill"), "font-size"), /^1[3-9]px$/);
  const t = Number(prop(rule(css, ".tier"), "font-size").replace("rem", "")); assert.ok(t * 16 >= 13, `.tier ${t}rem`);
  assert.match(prop(rule(games, ".g-line"), "font-size"), /^1[6-9]px$/, "game card text 16 px");
});
