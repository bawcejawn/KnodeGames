# BEGIN results-seal (audit AB-058: kit/publish/results-seal.sh, the same lines in every publish job; docs/ops/RESULTS-SEAL.md)
# Seals each vault results file, RELEASE file and board this run publishes: an Ed25519 signature over
# "knodegames-results-v1\n<branch>:<path>\n" and the file's exact bytes, in <path>.seal next to it. Only files whose
# staged copy is this run's own ($IN) are sealed, so a file someone else put on the branch is never sealed here.
if [ -n "${RESULTS_SEAL_KEY:-}" ]; then
  (umask 077 && printf '%s\n' "$RESULTS_SEAL_KEY" > "$RUNNER_TEMP/seal.pem")
  while IFS= read -r -d '' f; do
    rel="${f#"$IN"/}"
    [[ "$rel" =~ (^|/)(board|vault/(RELEASE-)?W[0-9]+)\.json$ ]] || continue
    [ "$(git rev-parse -q --verify ":$rel" || true)" = "$(git hash-object "$f")" ] || continue
    # Repo Lens L2-1: bytes the branch already holds were not produced by this run (a recorder copied them forward):
    # they keep the seal they have, if any, and are never sealed here.
    [ -z "${parent:-}" ] || [ "$(git rev-parse -q --verify "$parent:$rel" || true)" != "$(git hash-object "$f")" ] || continue
    { printf 'knodegames-results-v1\n%s:%s\n' "$SEAL_BRANCH" "$rel"; cat "$f"; } > "$RUNNER_TEMP/seal.msg"
    sig=$(openssl pkeyutl -sign -inkey "$RUNNER_TEMP/seal.pem" -rawin -in "$RUNNER_TEMP/seal.msg" | base64 -w0 || true)
    if [ -z "$sig" ]; then rm -f "$RUNNER_TEMP/seal.pem"; echo "::error::could not seal $rel (check the RESULTS_SEAL_KEY secret)"; exit 1; fi
    printf '{"v":1,"sig":"%s"}\n' "$sig" > "$RUNNER_TEMP/seal.json"
    git update-index --add --cacheinfo 100644 "$(git hash-object -w "$RUNNER_TEMP/seal.json")" "$rel.seal"
  done < <(find "$IN" -type f -name '*.json' -print0 | sort -z)
  rm -f "$RUNNER_TEMP/seal.pem" "$RUNNER_TEMP/seal.msg" "$RUNNER_TEMP/seal.json"
else
  echo "::warning::RESULTS_SEAL_KEY is not set: results files and boards go out unsealed (the vault bot holds unsealed weeks once deployment.json has resultsSealKey)."
fi
# END results-seal
