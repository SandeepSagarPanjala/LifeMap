#!/usr/bin/env bash
# Jest Runner → Detox adapter. Strips duplicate -c flags and normalizes file paths.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ARGS=()
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
    --)
      continue
      ;;
  esac

  normalized="${arg//\\./.}"
  if [[ "$normalized" == "$ROOT/"* ]]; then
    normalized="${normalized#"$ROOT"/}"
  fi
  ARGS+=("$normalized")
done

exec pnpm exec detox test --configuration ios.sim.debug "${ARGS[@]}"
