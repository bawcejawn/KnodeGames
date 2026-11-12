# Knode Games — Contract Standard

> **Purpose:** what every Knode Games contract folder (`game/` the vault, `desk/`, `sponsor/`, `picks/`, `race/`, and any future one) must contain, and the rules for changing a contract. Contracts are tier 1: they hold or control tokens (`../platform/REPO_MAP.md`).
> **Decision:** D-157 (owner, 5 Nov 2026). **Last updated:** 2026-11-05 (first written).

## 1. Folder (true for all five today)
`assembly/` (code and `__tests__/`) · `abi/` · `scripts/` · `koinos/` · `asconfig.json` · `as-pect.*` · `package.json` · `README.md`.

## 2. Required, and where each contract stands (5 Nov)
| Required | vault (`game/`) | desk | sponsor | picks | race |
|---|---|---|---|---|---|
| `README.md` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `SECURITY.md`: current threats, what stops each, which test proves it | ⚠️ v4-era | ⚠️ v1-era | ❌ | ❌ | ❌ |
| one current ABI in `abi/` | ⚠️ duplicate `kpred-v6` | ✅ | ✅ | ✅ | ⚠️ three files |
| a storage-compatibility test and `test-fixtures/` of the live build | ✅ | ✅ | ❌ | ❌ | ❌ |
| a row in `../platform/CONTRACTS.md` | ✅ | ✅ | ✅ | ✅ | ✅ |
| a release tag for the live build (ARCHITECTURE A5) | ❌ | ❌ | ❌ | ❌ | ❌ |

## 3. Rules for any contract change
1. The owner is the cold key; every code change has a timelock (48 h) or a written exception (Race picks: its own key, retired from use).
2. Build from a commit that will be tagged (`<contract>-<version>`); Repo Lens on that exact build; fix every finding in one pass (D-140); fix-check GO.
3. Announce, wait, upload; check the hash on chain; pin the matching withdrawals-only build (the vault).
4. The records PR: the deployment file, `CONTRACTS.md`, `CALENDAR.md`.
5. A game never adds a contract without an owner decision (`NEW_GAME.md`).
