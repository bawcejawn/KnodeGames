# Knode Games — Game Standard

> Purpose: Every Knode Games game must meet this before launch.
> Applies to: all games in `.ai/games/`
> Last updated: {{TBD: YYYY-MM-DD}}

## Required Spec File
Each game gets `.ai/games/<game-name>.md` with these sections:
1. Summary (one paragraph)
2. Type: Staked / Free play / Both
3. How to play (player's view, step by step)
4. Schedule: {{TBD: rounds, lock times, time zone}}
5. Scoring rules
6. Rewards & prizes (link to VAULT_STANDARD)
7. Leaderboard (link to LEADERBOARD_STANDARD)
8. Contract(s) and versions
9. Bot / automation involved
10. Owning chat and files it owns
11. Open questions

## Rules Every Game Follows
- **Staking:** {{TBD: minimum stake, multi-game staking rules}}
- **Free play:** {{TBD}}
- **Fees:** {{TBD}}
- **Timing:** {{TBD: e.g. how far ahead picks can be made}}
- **Fairness / anti-abuse:** {{TBD}}
- **Labels & naming:** {{TBD}}
- **Isolation:** {{TBD: games must not affect each other's funds or contracts}}

## Testing & Audit Gate
- [ ] {{TBD: testing requirement}}
- [ ] {{TBD: audit requirement}}
- [ ] {{TBD: sign-off by owner}}

## Game Spec Template
<!-- Copy into .ai/games/<game-name>.md -->
    # {{Game Name}}
    Status: {{planned / testing / live / retired}}
    Type: {{Staked / Free play / Both}}
    Owner chat: {{TBD}}
    ## Summary
    ## How to Play
    ## Schedule
    ## Scoring
    ## Rewards
    ## Leaderboard
    ## Contracts
    ## Automation
    ## Open Questions
