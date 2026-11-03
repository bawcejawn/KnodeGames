# Fantasy Producers (game 4) and Weekly Rival (game 5)

> **Sources:** `.ai/archive/CHAT_KNOWLEDGE.md` (Fantasy Producers chat), `DECISIONS.md` (D-059), the repo (branch `fantasy`). **Last updated:** 2026-11-02.
> **Legend:** ✅ verified · 💬 from a chat · 👤 owner · ❓ unknown

## Purpose
Fantasy football for block producers: draft five producers under a salary cap, captain one, and score daily on how reliably they sign their blocks. Weekly Rival adds a friendly head-to-head challenge on top. It must feel inviting, professional and fun, and explain every number in plain words (D-059).

## Gameplay
- **Team (game 4):** pick 5 different producers from the week's price list, costing **100 or less**; the first is captain (×2). A team carries on until changed. **One change a day:** swap one producer, or move the captain. Picks lock 5 minutes before each UTC day; teams can be planned up to 7 days ahead. A team that breaks a rule is ignored and the previous team plays. Late joiners score 0 for earlier days. 💬
- **Prices:** 20 + 1.5 × (form − median form), clamped 8–40, from the 7 days before; published with its sha256 on **Saturday 00:00 UTC** and never remade. Each week starts fresh; last week's team carries into Monday only if it fits the new prices. The pool is the race field when the list is made. 💬
- **Weekly Rival (game 5):** one challenge a week, changeable until the week's first lock; anyone can challenge you. 💬
- **Page:** a scoreboard with a lineup-lock countdown, tabs (My team, Players, My week, Rival, League, Help), your five as shirts on a pitch with the captain up front, planning buttons, a Players list with Steady/Swingy labels, a podium, and a 4-step guide. 💬
- Why picking late gives no edge: prices are fixed first, expected blocks follow VHP hourly, picks lock 5 minutes before the day, and node health is public. 💬

## Scoring
- Each day a producer scores **100 × blocks signed ÷ blocks expected, at most 130**; the captain counts double. A week's score is the sum of its 7 days. 💬
- A week is final 12 h after it ends, once all 7 days, the rivals and stakes are read (FX-1); a day is final only when every hour with blocks has a race card (FX-5). 💬
- **Rival:** a match counts only if both players had a team all 7 days and both are staked; records keep challenges made and received apart. An all-time table (total, weeks played, best week). 💬

## Rewards
- **Staked:** the top 30% of Fantasy stakers with ≥ 1 point share Fantasy's part of the vault's weekly reward. Vault points: 255 for the best week, one less per lower distinct score, never below 1, ranked among stakers only. 💬
- **Free play:** **yes, standings only** — a Free play board, **no free VHP prize** until the owner switches it on (D-081, 3 Nov; was staked-only, D-071). The branch has no free board yet — the Fantasy chat must add one. 👤
- **Weekly Rival and the all-time table:** records only, no prize. 💬

## Dependencies
- **Picks contract:** register games 4 (list of 5, daily rounds) and 5 (one address, weekly) — 48 h wait. 💬
- Race cards with enough samples (the VHP sampler, I-059); Fantasy currently also uses flagged low-sample cards (I-062). 💬
- Recorder `bot/games/fantasy.ts` + `fantasy-math.js`, published by `games.yml` behind `FANTASY_ENABLED` (it never blocks Block X); files up to 8 MB. 💬
- Vault v6: game 4 staked; results `games-data:fantasy/vault/W<week>.json` ✅ (C-22 resolved).

## Current status (2 Nov)
Branch `fantasy` @ `2bee805` ✅ — pushed, **not merged, nothing deployed**; testnet practice deployed (Picks copy `1DZX8RV…`). The owner's practice run stopped mid-week on 29 Oct; no full test week yet. Repo Lens fix-check package ready, not yet run. Tests: 522 pass, 1 fail (a `picks` issue).

## Known issues (I-062)
- BX-38 race cards use the highest VHP over 6 h, so a producer whose VHP drops scores under 100 for up to 6 h; flagged low-sample cards still used — decide with the owner.
- Small producers swing (e.g. Knode Swap priced at the 40 cap); the price formula needs a real-data simulation.
- Live race cards sometimes arrive ~28 minutes late — check day finality copes.
- `site.mobile-nav.test.mjs` fails on `picks` (Block X fix).
- FX-1 to FX-10 and later work not yet independently checked.

## Future plans
Fix-check → fixes → real-data simulation → a full test week and roll into week 2 → register games 4 and 5 (48 h) → merge, `FANTASY_ENABLED=true`, menus and SEO, remove `noindex`; first price list the Saturday before the launch Monday. Open question for the owner: a Telegram reminder as well as the on-page one? Producer names are shared across games (Koinos @names, D-030).
