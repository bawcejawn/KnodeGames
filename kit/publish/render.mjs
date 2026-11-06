// Shared Game Kit: renders the kit games' record and publish jobs for one data branch (design §A, GAME_KIT.md §1).
// The publish job runs NO repository code: it runs kit/publish/check.inline.mjs copied here byte for byte (a heredoc),
// with the games' settings as a literal. tools/kit-render-workflows.mjs writes the result between markers in the
// workflow; a test fails if the committed workflow differs from what this renders.
import fs from "node:fs";

export const BEGIN = "  # ── BEGIN kit-rendered jobs (tools/kit-render-workflows.mjs; edit kit/, never these lines) ──";
export const END = "  # ── END kit-rendered jobs ──";
export const HEREDOC = "KIT_CHECK_INLINE";
const CHECKOUT = "actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0";
const NODE = "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0";
const UP = "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4.6.2";
const DOWN = "actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093 # v4.3.0";

/** The check script exactly as the publish job runs it: the kit's file, then one line that runs it. */
export const TRAILER = "\nmain();\n";
export function inlineScript(root) {
  const src = fs.readFileSync(new URL("kit/publish/check.inline.mjs", root), "utf8");
  if (/^\s*import\s.+from\s+["'](?!node:(fs|path|crypto)["'])/m.test(src)) throw new Error("check.inline.mjs may import only node:fs, node:path and node:crypto");
  if (src.includes("${{")) throw new Error("check.inline.mjs may not contain an Actions expression");
  if (src.split("\n").some((l) => l.trim() === HEREDOC)) throw new Error(`check.inline.mjs may not contain a line "${HEREDOC}"`);
  return src + TRAILER;
}

const ind = (s, n) => s.split("\n").map((l) => (l ? " ".repeat(n) + l : l)).join("\n");

/** A YAML-safe quoted string (names are validated too, KC-14). */
const q = (s) => JSON.stringify(String(s));
const up = (slug) => slug.toUpperCase().replace(/-/g, "_");
export const RECORD_TIMEOUT_MIN = 25;   // a game's budget is at most 20 min (tools/game-manifest.mjs BUDGET_MAX, KC-4)

/** The fetch of last run's files for ONE game (a public branch, read without a token; allow-listed names only). */
function fetchStep(branch, slug) {
  return `      - name: Take ${slug}'s last files
        run: |
          set -euo pipefail
          P="$RUNNER_TEMP/prev"; mkdir -p "$P/vault"
          if git fetch -q --depth 1 "https://github.com/\${GITHUB_REPOSITORY}.git" ${branch} 2>/dev/null; then
            { git ls-tree --name-only FETCH_HEAD:${slug} 2>/dev/null || true; } | while IFS= read -r f; do
              if [[ "$f" =~ ^(board|W[0-9]{3,4})\\.json$ ]]; then git show "FETCH_HEAD:${slug}/$f" > "$P/$f"; fi
            done
            { git ls-tree --name-only FETCH_HEAD:${slug}/vault 2>/dev/null || true; } | while IFS= read -r f; do
              if [[ "$f" =~ ^((HOLD-|RELEASE-)?W(0|[1-9][0-9]{0,3}))\\.json$ ]]; then git show "FETCH_HEAD:${slug}/vault/$f" > "$P/vault/$f"; fi
            done
          else
            set +e; git ls-remote --exit-code --heads "https://github.com/\${GITHUB_REPOSITORY}.git" refs/heads/${branch} >/dev/null 2>&1; rc=$?; set -e
            if [ "$rc" -ne 2 ]; then echo "::error::The ${branch} branch could not be fetched (git ls-remote exit $rc). Nothing recorded this run."; exit 1; fi
            echo "No ${branch} branch yet."
          fi
          touch "$P/.fetched"`;
}

/**
 * The jobs for the kit games on one branch. games: [{ slug, name, enabledVar, cfg }] (cfg = manifest.publishConfig).
 * ONE record job per game, with its own timeout and its own artifact (KC-4, KC-13): a slow or broken game stops only
 * itself, and can't write another game's files. The publish job takes each game's files only from that game's artifact.
 */
export function renderJobs({ branch, games, script }) {
  if (!games.length) return `${BEGIN}\n${END}\n`;
  if (!["games-data", "race-data", "games-data-testnet"].includes(branch)) throw new Error(`not a data branch: ${branch} (KC-23)`);
  for (const g of games) {
    if (!/^[a-z][a-z0-9-]{1,23}$/.test(g.slug)) throw new Error(`bad slug ${g.slug}`);
    if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(g.enabledVar)) throw new Error(`bad variable ${g.enabledVar}`);
    if (!/^[A-Za-z0-9][A-Za-z0-9 ()&.,!+-]{1,39}$/.test(g.name)) throw new Error(`bad name ${JSON.stringify(g.name)} (KC-14)`);
  }
  const job = (g) => `record-${g.slug}`;
  const recordJobs = games.map((g) => `  ${job(g)}:
    name: ${q(`Record ${g.name} (kit)`)}
    if: \${{ vars.${g.enabledVar} == 'true' && github.ref == 'refs/heads/main' }}
    runs-on: ubuntu-latest
    timeout-minutes: ${RECORD_TIMEOUT_MIN}
    permissions:
      contents: read
    outputs:
      rc: \${{ steps.rec.outputs.rc }}
    steps:
      - uses: ${CHECKOUT}
        with:
          ref: main
          persist-credentials: false
      - uses: ${NODE}
        with:
          node-version: 22
      - run: npm ci --no-audit --no-fund --ignore-scripts
${fetchStep(branch, g.slug)}
      - name: Record
        id: rec
        run: |
          set -uo pipefail
          O="$RUNNER_TEMP/out"; rm -rf "$O"; mkdir -p "$O"
          npm run kit -- ${g.slug}; rc=$?
          echo "rc=$rc" >> "$GITHUB_OUTPUT"
        env:
          RPC: \${{ vars.RPC || 'https://koinos.armana.io' }}
          RPC_CHECK: \${{ vars.RPC_CHECK || 'https://api.koinosblocks.com' }}
          KIT_PREV: \${{ runner.temp }}/prev
          KIT_OUT: \${{ runner.temp }}/out
          # The owner's holds (GAME_KIT.md §3): weeks kept pending, and the one-off release of a held week ("<week>:<code>").
          ${up(g.slug)}_HOLD_WEEKS: \${{ vars.${up(g.slug)}_HOLD_WEEKS }}
          ${up(g.slug)}_RELEASE: \${{ vars.${up(g.slug)}_RELEASE }}
      - uses: ${UP}
        with:
          name: kit-${branch}-${g.slug}
          path: \${{ runner.temp }}/out/
          retention-days: 1
          if-no-files-found: ignore`).join("\n\n");
  const downloads = games.map((g) => `      - uses: ${DOWN}
        continue-on-error: true
        with:
          name: kit-${branch}-${g.slug}
          path: \${{ runner.temp }}/incoming/${g.slug}`).join("\n");
  const releaseEnv = games.map((g) => `          KIT_RELEASE_${up(g.slug)}: \${{ vars.${up(g.slug)}_RELEASE }}`).join("\n");
  const kitGames = JSON.stringify(games.map((g) => g.cfg));
  const ran = games.map((g) => `needs.${job(g)}.result == 'success'`).join(" || ");
  const stopped = games.map((g) => `needs.${job(g)}.outputs.rc == '2' || needs.${job(g)}.result == 'failure' || needs.${job(g)}.result == 'cancelled'`).join(" || ");
  const owner = games.map((g) => `needs.${job(g)}.outputs.rc == '1'`).join(" || ");
  return `${BEGIN}
  # Games on the Shared Game Kit (.ai/standards/GAME_KIT.md): ${games.map((g) => g.name).join(", ")}. One record job per game
  # (its own timeout and artifact); each runs only when its own variable is on. The publish job runs no repository code.
${recordJobs}

  publish-kit:
    # After the hand-written publish job (when it runs), so the two never push ${branch} at the same time.
    needs: [${games.map(job).join(", ")}, publish]
    if: \${{ always() && github.ref == 'refs/heads/main' && (${ran}) }}
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      contents: write         # push the ${branch} branch (never main)
    steps:
${downloads}
      - uses: ${NODE}
        with:
          node-version: 22
      - name: Check and push the kit games' files (no repository code)
        env:
          GH_TOKEN: \${{ github.token }}
          IN: \${{ runner.temp }}/incoming
          LIST: \${{ runner.temp }}/kit-publish.txt
          KIT_GAMES: '${kitGames}'
          CHECK_NOW_MS: ""      # the job's own clock, always (KC-29)
          # The owner's releases, read by the check itself: a recorder run can't release its own hold (KC-3).
${releaseEnv}
        run: |
          set -euo pipefail
          if [ ! -d "$IN" ]; then echo "Nothing to publish."; exit 0; fi
          remote="https://x-access-token:\${GH_TOKEN}@github.com/\${GITHUB_REPOSITORY}.git"
          PUB=$(mktemp -d)
          git init -q work && cd work
          git config user.name "knode-games-bot"; git config user.email "knode-games-bot@users.noreply.github.com"
          parent=""
          if git fetch -q --depth 1 "$remote" ${branch} 2>/dev/null; then
            parent=$(git rev-parse FETCH_HEAD); git read-tree FETCH_HEAD
            for g in ${games.map((g) => g.slug).join(" ")}; do
              mkdir -p "$PUB/$g/vault"
              { git ls-tree --name-only "$parent:$g" 2>/dev/null || true; } | while IFS= read -r f; do
                if [[ "$f" =~ ^(board|W[0-9]{3,4})\\.json$ ]]; then git show "$parent:$g/$f" > "$PUB/$g/$f"; fi
              done
              { git ls-tree --name-only "$parent:$g/vault" 2>/dev/null || true; } | while IFS= read -r f; do
                if [[ "$f" =~ ^((HOLD-|RELEASE-)?W(0|[1-9][0-9]{0,3}))\\.json$ ]]; then git show "$parent:$g/vault/$f" > "$PUB/$g/vault/$f"; fi
              done
            done
          else
            set +e; git ls-remote --exit-code --heads "$remote" refs/heads/${branch} >/dev/null 2>&1; rc=$?; set -e
            if [ "$rc" -ne 2 ]; then echo "::error::The ${branch} branch could not be fetched (git ls-remote exit $rc): nothing published."; exit 1; fi
            git read-tree --empty
          fi
          # The kit's publish check, inline (kit/publish/check.inline.mjs byte for byte): it judges every file against the
          # published copy and this job's own clock, and lists only what may be published.
          node --input-type=module - "$IN" "$PUB" "$LIST" <<'${HEREDOC}'
${ind(script, 10).replace(/\n$/, "")}
          ${HEREDOC}
          while IFS= read -r name; do
            [[ "$name" =~ ^[a-z][a-z0-9-]{1,23}/((board|W[0-9]{3,4})|vault/(HOLD-|RELEASE-)?W(0|[1-9][0-9]{0,3}))\\.json$ ]] || { echo "::error::bad name from the check: $name"; exit 1; }
            h=$(git hash-object -w "$IN/$name")
            git update-index --add --cacheinfo "100644,$h,$name"
          done < "$LIST"
          tree=$(git write-tree)
          if [ -n "$parent" ] && [ "$tree" = "$(git rev-parse "$parent^{tree}")" ]; then echo "No changes."
          else
            commit=$(git commit-tree "$tree" \${parent:+-p "$parent"} -m "kit: record $(date -u +%Y-%m-%dT%H:%MZ)")
            git push -q "$remote" "$commit:refs/heads/${branch}"
            echo "Published $(wc -l < "$LIST") file(s) to ${branch}."
          fi
          if [ -f "$LIST.alert" ]; then echo "::error::Some kit files were held (see above): the rest was published."; exit 1; fi
      # Fail the run AFTER publishing, so the owner gets an email (KC-28: the two cases say different things).
      - name: Alert on a kit recorder that stopped
        if: \${{ always() && (${stopped}) }}
        run: |
          echo "::error::A kit game's recorder stopped (or its job failed or timed out): nothing from that game was recorded this run. See its record job."
          exit 1
      - name: Alert on a kit recorder that needs the owner
        if: \${{ always() && (${owner}) }}
        run: |
          echo "::error::A kit game's recorder raised an alert that needs the owner (see its record job). Its files were checked and published as usual."
          exit 1
${END}
`;
}
