// {{name}}: scoring shared by the page and the recorder. Pure functions only: no network, no clock, no randomness.
// Keep every rule here so the page shows exactly what the recorder pays (tests/math.test.mjs).

/** Points for one pick, given the round's result. Replace with the game's rule. */
export function scorePick(pick, result) {
  return pick === result ? 1 : 0;
}
