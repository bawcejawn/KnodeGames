# Knode Games — Launch Board

> **Purpose:** one page showing where every game stands on its way to launch, and what moves it to the next stage. It is the one home for **each game's launch stage**; the detail stays in each game's file (`../games/`), the steps in `ROADMAP.md`, the work in `CHAT_REQUESTS.md` and the owner's steps in `TODOS.md`.
> **Last updated:** Thu 5 Nov 2026 ~18:30 UTC (games 2 and 7 applied, #196; branch tips of #186, #187, #188). Whole system at a glance: [`../../STATUS.md`](../../STATUS.md).
> **Focus (D-113, 4 Nov; D-142, 5 Nov):** core first, and **Fantasy, Block Golf and Bracket reactivated as the next three launches** — no additional game launches until the Vault, sponsor, Questions upgrade, VHP ruler and repo cleanup are done; the paused games keep their stage. **Next three launches (D-142):** Fantasy, Block Golf, Bracket; then Last Node, Survivor, Combo.
> **Update rule:** change a game's row when its stage changes (in the same PR as the change, or at session-end filing). Check this page in every weekly review.

## The five stages

| Stage | Means | Moves on when |
|---|---|---|
| **Not Started** | Nothing built yet, or only a plan | Building begins on a branch |
| **In Progress** | Its chat is building or fixing | The chat's work is done and pushed |
| **Blocked** | Its next step waits on someone other than its own chat: an owner run or decision, an audit, another chat, or a chain timelock | The blocker clears (named in the row) |
| **Ready For Testing** | Built and audited; waiting on a real trial (testnet season, practice weeks, a full test week) | The trial passes |
| **Ready For Launch** | Every `../standards/GO_LIVE_CHECKLIST.md` item done; only the launch steps are left (announce, apply, merge, switch on) | It launches; the row then says **Live** in the "Live now" column |

A game that is already live for players but not yet paying keeps its row on the **paying** launch (the last step to finish).

## Board — all games

| # | Game | Stage | Live now | Next step to move on | Who | Target | Detail |
|---|---|---|---|---|---|---|---|
| 1 | **Daily Questions** | ✅ **Live** | **Live and paying** (Vault v6, since 2 Nov) | Two rounds a day from Mon 9 (#98, #119, #122, #125, #126 ✅). Vault v6.1: announce Thu 5, upload Mon 9; 60 a week and the shared rules from **Mon 16** (D-130); Questions side ✅ #152 merged 5 Nov | Owner, Vault + Questions chats | Rule week Mon 16 Nov | `../games/Questions.md` |
| 2 | **Who Signs Block X** | ✅ **Live → paying from Week 1** | Live; **applied in the vault 5 Nov, from week 3**; weekly rhythm, final Mon 00:00 (#175), Results tab (#143), finals locked (#159) | Owner: `PRIZES_FROM_WEEK = 3`; first paid week closes Mon 16 Nov | Owner | Pays from Mon 9 Nov | `../games/BlockX.md` |
| 7 | **Producer Race** | ✅ **Live → paying from Week 1** | Live; **applied in the vault 5 Nov, from week 3**; weekly rhythm (#149, #155), payout safety (#133) | Left: gaps I-086, I-037 (PR #182, Repo Lens next) | Race chat | Pays from Mon 9 Nov | `../games/ProducerRace.md` |
| 3 | **Survivor** | **Blocked** (⏸ paused, D-113) | No | Owner runs Repo Lens pass 4 on `a8a1979` (or newer); then fixes, fix-check, a testnet season, game 3 registration, merge (I-050, R-SV-2) | Owner → Survivor chat | **slipped** (D-113: core first); new date after the core work | `../games/Survivor.md` |
| 9 | **Producer Bracket** | **Audit (fix-check)** (▶ reactivated, D-142) | No | draft PR #186 (`kg-09-bracket` @ `8d3d942`): D-153 shape (max 32), every #E-3 finding fixed; next: Repo Lens fix-check → sponsor row for game 9 → Picks announce + `game-add 9` | Bracket chat, owner | after its fix-check | `../games/ProducerBracket.md` |
| 6 | **Block Golf** | **In Progress** (▶ reactivated 5 Nov, D-142) | No (`games.json` "soon") | PR #187 (`golf-v2` @ `6ce7b5d`) built and tested (site root, weekly rhythm, Free board); Repo Lens → I-098 / I-099 → merge → `GOLF_ENABLED` (practice) → `game-add 6` / apply (staked) | Golf chat, owner | First paying week: the Monday after its `game-apply` | `../games/BlockGolf.md` |
| 4–5 | **Fantasy Producers** | **In Progress** (▶ reactivated 5 Nov, D-142) | No | PR #188 (`fantasy` @ `a60da0b`): gate, Free board, weekly rhythm done; next RECORDER_STANDARD §4.1 / §4.2 → one Repo Lens fix-check → a full test week → sponsor row for games 4 / 5 → register | Fantasy chat, owner | after its test week | `../games/FantasyProducers.md` |
| 13 | **Last Node Standing** | **Blocked** (⏸ paused, D-113) | No | Owner runs Repo Lens round 3 (`claude/lastnode/FIXCHECK-3-PROMPT.md`, `adf95be` or newer); then the round-3 fixes, the lower entry bar (R-LN-4), the release marker (R-LN-3) | Owner → Last Node chat | None set | `../games/LastNodeStanding.md` |
| 8 | **Combo Card** | **Blocked** (⏸ paused, D-113) | No | Owner runs Repo Lens fix-check 4 (`claude/audit-combo-fixcheck4-prompt.md`); then the Picks v2 (CARD) upgrade, the 0.25 Mana pick row, a testnet rehearsal (R-CO-2) | Owner → Combo chat | Last in the launch line | `../games/ComboCard.md` |

**Count:** Live and paying 1 · Ready For Launch 2 · Ready For Testing 1 · In Progress 1 · Blocked 4 · Not Started 0 (games).

## Shared pieces the games depend on

| Piece | Stage | Next step | Who | Needed by |
|---|---|---|---|---|
| **VHP ruler v2** (D-110 – D-128) | **In Progress** (✅ on `main`, #163; off until turned on) | Owner turns the recorder on, data only (D-128); library designs §16; all 11 simulations must pass before anything pays (D-111) | VHP Ruler chat, owner | Race first, then Bracket, Block X, later Survivor seasons |
| **Mana sponsor v3** (`b84e1add`) | ✅ Live (cap 2.4, D-131) | Measure the first real sponsored stake / claim / withdraw and tighten rows (R-BX-18) | Block X chat | Guest play in every game |
| **Free-prize switch** (D-082) | **Blocked** | Owner sets the starting values (ON 2, 7, 9, 13; OFF 3, 4, 6, 8) and the `prize-settings` ruleset | Owner | First free prizes, week of 9 Nov |
| **Wallet moves** (`docs/WALLETS.md`) | **In Progress** (Race picks done 4 Nov) | Vault and Desk, Fri 6 – Tue 10 Nov; Picks later (D-106) | Owner + Vault chat | Safety before prizes grow |
| **Vault v6.1: 60 questions + Questions on the shared rules + the bot closes weeks** (PR #114; D-116, D-127, D-130) | **Ready For Launch** (Repo Lens #E-16 GO) | Announce Thu 5 Nov (current owner) → upload Mon 9 from 9:00 AM PT → pin + handover 4a → rule week Mon 16 | Owner, Vault chat | 60 a week; Questions like every game |
| **Picks v2** (CARD type) | **Not Started** | Schedule after Combo's fix-check 4 (D-060) | Combo chat, owner | Combo Card |
| **Full platform audit** (D-102) | **Not Started** | Only once every game is confidently ready (I-002) | Owner | Before the big launch |

## What would move the most rows

1. **The owner's Repo Lens runs** (`AUDITS.md` §2): Race #182, Hub #181, Run a Node #173 / #179, Vault #178 / #177, Golf #187, Fantasy #188, Bracket #186. Later (paused games, D-113): Survivor, Last Node and Combo are each waiting on one audit run (I-065).
2. ✅ `game-apply 2` and `game-apply 7` done (5 Nov): two paying games from Week 1. Next: **the v6.1 announce** starts the last vault upgrade before the rule week.
3. **Settling the vault-value rule** (255 places) unblocks part of the Bracket and protects Survivor and the Race (I-086).
