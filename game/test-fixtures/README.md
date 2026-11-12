# Test fixtures

`kpred-live-test-build.wasm` is the **test build** (simulated token ledger, `BUILD_FOR_TESTING=1`) of the game contract
exactly as it runs on mainnet today: source at commit `1c25791`, whose release build has the live sha256
`917708a7c567d9642a7a2f121c34fbc70200909787208705fc3aa5a2b1e6433a` (game-data/deployment.json).

- sha256 of the fixture: `cce79208d9ba41c369cccb4361c60835033c3891721591bf840ed385871396f3`
- made with: `git checkout 1c25791 -- game/assembly && cd game && npm run build:sim && cp build/sim/contract.wasm test-fixtures/kpred-live-test-build.wasm`

`scripts/storage-compat.test.ts` lets this code write a realistic game history, then swaps in the new code on the same
storage (as an upgrade does) and checks that every stored value reads back unchanged. Never deploy this file: it is a
test build.

`kpred-v5-test-build.wasm` is the **test build** of game v5: the source on `main` at commit `43151ea`, whose release build
has the scheduled v5 sha256 `c17066ae988d204fd43d43f662ad87fcdc38170419943c20b5164a5bd34dd784` (checked when the fixture was
made). `scripts/storage-compat-v6.test.ts` uses it for the v5 → v6 (KnodeGames vault) upgrade test.

- sha256 of the fixture: `4196491d71d54740eb2351016ea8ab572acab8bf972a67d7b44404c6f1c9a145`
- made with: `git worktree add ../v5 43151ea && cd ../v5/game && npm ci && npm run build:sim && cp build/sim/contract.wasm <repo>/game/test-fixtures/kpred-v5-test-build.wasm`

`kpred-v6-test-build.wasm` is the **test build** of the live vault, game v6: the source on `main` at commit `f3a7cb1`,
whose release build has the live sha256 `eed38f7ce130d9d2e0dfafa8ddd5c4a6f383e2c7ce12ab87b02c584f43920b3d` (checked
when the fixture was made, 4 Nov 2026). `scripts/storage-compat-v61.test.ts` uses it for the v6 → v6.1 (doubled
Questions) upgrade test.

- sha256 of the fixture: `0f943f5fa5654f884f191873bcb73931318c1a7f3cddeddd85de9c6b096d20c6`
- made with: `git worktree add ../v6 f3a7cb1 && cd ../v6/game && npm ci && npm run build:sim && cp build/sim/contract.wasm <repo>/game/test-fixtures/kpred-v6-test-build.wasm`
