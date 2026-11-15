// Repo Lens #G-43 (Hub): the admin page's Golf apply card and its GitHub-variable step name the real window, in ET.
// Applying game 6 before Sun 15 Nov 7:00 PM ET lands in vault week 3's neighbour and makes Golf earn in practice Week 1:
// it cannot be undone, so the card must not say "before Sunday 4 PM PT".
import test from "node:test";
import assert from "node:assert/strict";
import { ACTIONS, AREAS } from "../../admin/actions.ts";

test("G43: the Golf apply card gives the real window in ET, not the old PT line", () => {
  const a = ACTIONS.find((x) => x.id === "golf-game-apply")!;
  assert.match(a.when!, /after Sun 15 Nov 7 PM ET, before Sat 21 Nov 3:16 PM ET/);
  assert.match(a.when!, /BEFORE the one it should earn from/);
  assert.doesNotMatch(a.when!, /Sunday 4 PM PT|before Sunday/);
});
test("G43: the GOLF_STAKED_FROM_WEEK step uses the vault week 4 → 5 example and ET, not the old 7 Nov line", () => {
  const steps = AREAS.find((x) => x.id === "golf")!.guides![0].steps.join(" ");
  assert.match(steps, /apply in vault week 4 it is 5/); assert.match(steps, /Sunday 7:57 PM ET/);
  assert.doesNotMatch(steps, /Sat 7 Nov|PST/);
});
