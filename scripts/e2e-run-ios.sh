#!/usr/bin/env bash
# Jest Runner → Detox adapter. Strips duplicate -c flags and normalizes file paths.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TEST_FILES=()
skip_next=0

for arg in "$@"; do
  if [[ "$skip_next" -eq 1 ]]; then
    skip_next=0
    continue
  fi
  case "$arg" in
    -c|--config)
      skip_next=1
      continue
      ;;
    # Jest Runner -t patterns contain regex like (\s.*)? that break Detox's shell
    # invocation. Our e2e files are small — run the whole file instead.
    -t|--testNamePattern)
      skip_next=1
      continue
      ;;
    --)
      continue
      ;;
  esac

  normalized="$(printf '%s' "$arg" | sed -e 's#\\/#/#g' -e 's#\\\.#.#g' -e 's#^\./##')"
  if [[ "$normalized" == "$ROOT/"* ]]; then
    normalized="${normalized#"$ROOT"/}"
  fi

  if [[ "$normalized" =~ ^e2e/.+\.test\.js$ ]]; then
    TEST_FILES+=("$normalized")
  fi
done

if [[ ${#TEST_FILES[@]} -eq 0 ]]; then
  echo "e2e-run-ios: no e2e test file in args — pass e2e/**/*.test.js" >&2
  exit 1
fi

detox_args=(test --configuration ios.sim.debug)
if [[ "${E2E_FRESH:-}" != "1" ]]; then
  detox_args+=(--reuse)
fi
detox_args+=("${TEST_FILES[@]}")

exec pnpm exec detox "${detox_args[@]}"
