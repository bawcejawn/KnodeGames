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

/**
 * The jobs for the kit games on one branch. games: [{ slug, name, enabledVar, cfg }] (cfg = manifest.publishConfig).
 * The record job runs if ANY game's variable is on; each game's step runs only when its own variable is on.
 */
export function renderJobs({ branch, games, script }) {
  if (!games.length) return `${BEGIN}\n${END}\n`;
  const anyOn = games.map((g) => `vars.${g.enabledVar} == 'true'`).join(" || ");
  const names = (slug) => `^(board|W[0-9]{3})\\.json$`;
  const fetchLines = games.map((g) => `            P="$RUNNER_TEMP/prev/${g.slug}"; mkdir -p "$P/vault"
            { git ls-tree --name-only FETCH_HEAD:${g.slug} 2>/dev/null || true; } | while IFS= read -r f; do
              if [[ "$f" =~ ${names(g.slug)} ]]; then git show "FETCH_HEAD:${g.slug}/$f" > "$P/$f"; fi
            done
            { git ls-tree --name-only FETCH_HEAD:${g.slug}/vault 2>/dev/null || true; } | while IFS= read -r f; do
              if [[ "$f" =~ ^((HOLD-|RELEASE-)?W[0-9]{1,4})\\.json$ ]]; then git show "FETCH_HEAD:${g.slug}/vault/$f" > "$P/vault/$f"; fi
            done
            touch "$P/.fetched"`).join("\n");
  const emptyLines = games.map((g) => `              mkdir -p "$RUNNER_TEMP/prev/${g.slug}/vault"; touch "$RUNNER_TEMP/prev/${g.slug}/.fetched"`).join("\n");
  const recordSteps = games.map((g) => {
    const up = g.slug.toUpperCase().replace(/-/g, "_");
    return `      - name: Record ${g.name} (kit)
        id: ${g.slug}
        if: \${{ vars.${g.enabledVar} == 'true' }}
        continue-on-error: true
        run: |
          set -euo pipefail
          O="$RUNNER_TEMP/kit-out/${g.slug}"; rm -rf "$O"; mkdir -p "$O"
          npm run kit -- ${g.slug}
        env:
          RPC: \${{ vars.RPC || 'https://koinos.armana.io' }}
          RPC_CHECK: \${{ vars.RPC_CHECK || 'https://api.koinosblocks.com' }}
          KIT_PREV: \${{ runner.temp }}/prev/${g.slug}
          KIT_OUT: \${{ runner.temp }}/kit-out/${g.slug}
          # The owner's holds (GAME_KIT.md §3): weeks kept pending, and the one-off release of a held week ("<week>:<code>").
          ${up}_HOLD_WEEKS: \${{ vars.${up}_HOLD_WEEKS }}
          ${up}_RELEASE: \${{ vars.${up}_RELEASE }}`;
  }).join("\n");
  const outputs = games.map((g) => `      ${g.slug}: \${{ steps.${g.slug}.outcome }}`).join("\n");
  const failed = games.map((g) => `needs.record-kit.outputs.${g.slug} == 'failure'`).join(" || ");
  const kitGames = JSON.stringify(games.map((g) => g.cfg));
  return `${BEGIN}
  # Games on the Shared Game Kit (.ai/standards/GAME_KIT.md): ${games.map((g) => g.name).join(", ")}. Each game's recorder
  # step is independent (RECORDER §6.5) and runs only when its own variable is on. The publish job runs no repository code.
  record-kit:
    if: \${{ (${anyOn}) && github.ref == 'refs/heads/main' }}
    runs-on: ubuntu-latest
    timeout-minutes: 30
    permissions:
      contents: read
    outputs:
${outputs}
    steps:
      - uses: ${CHECKOUT}
        with:
          ref: main
          persist-credentials: false
      - uses: ${NODE}
        with:
          node-version: 22
      - run: npm ci --no-audit --no-fund --ignore-scripts
      # Last run's files (a public branch, read without a token): only allow-listed names. A fetch that fails for any
      # reason but "no such branch" stops the run; the recorder refuses to write without the .fetched mark.
      - name: Take the kit games' last files
        run: |
          set -euo pipefail
          if git fetch -q --depth 1 "https://github.com/\${GITHUB_REPOSITORY}.git" ${branch} 2>/dev/null; then
${fetchLines}
          else
            set +e; git ls-remote --exit-code --heads "https://github.com/\${GITHUB_REPOSITORY}.git" refs/heads/${branch} >/dev/null 2>&1; rc=$?; set -e
            if [ "$rc" -eq 2 ]; then
              echo "No ${branch} branch yet."
${emptyLines}
            else echo "::error::The ${branch} branch could not be fetched (git ls-remote exit $rc). Nothing recorded this run."; exit 1; fi
          fi
${recordSteps}
      - uses: ${UP}
        with:
          name: kit-${branch}
          path: \${{ runner.temp }}/kit-out/
          retention-days: 1
          if-no-files-found: ignore

  publish-kit:
    # After the hand-written publish job (when it runs), so the two never push ${branch} at the same time.
    needs: [record-kit, publish]
    if: \${{ always() && needs.record-kit.result == 'success' && github.ref == 'refs/heads/main' }}
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      contents: write         # push the ${branch} branch (never main)
    steps:
      - uses: ${DOWN}
        continue-on-error: true
        with:
          name: kit-${branch}
          path: \${{ runner.temp }}/incoming
      - uses: ${NODE}
        with:
          node-version: 22
      - name: Check and push the kit games' files (no repository code)
        env:
          GH_TOKEN: \${{ github.token }}
          IN: \${{ runner.temp }}/incoming
          LIST: \${{ runner.temp }}/kit-publish.txt
          KIT_GAMES: '${kitGames}'
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
                if [[ "$f" =~ ^(board|W[0-9]{3})\\.json$ ]]; then git show "$parent:$g/$f" > "$PUB/$g/$f"; fi
              done
              { git ls-tree --name-only "$parent:$g/vault" 2>/dev/null || true; } | while IFS= read -r f; do
                if [[ "$f" =~ ^((HOLD-|RELEASE-)?W[0-9]{1,4})\\.json$ ]]; then git show "$parent:$g/vault/$f" > "$PUB/$g/vault/$f"; fi
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
            [[ "$name" =~ ^[a-z][a-z0-9-]{1,23}/((board|W[0-9]{3})|vault/(HOLD-|RELEASE-)?W[0-9]{1,4})\\.json$ ]] || { echo "::error::bad name from the check: $name"; exit 1; }
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
      # A recorder that failed (or held something) fails the run AFTER publishing, so the owner gets an email.
      - name: Alert on a kit recorder failure
        if: \${{ always() && (${failed}) }}
        run: |
          echo "::error::A kit game's recorder failed this run (see the record-kit job). Its files from this run weren't published."
          exit 1
${END}
`;
}
