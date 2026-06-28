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

# Reuse the installed app by default (fast local runs from editor Run button).
# Set E2E_FRESH=1 for a full delete+reinstall (CI / first install).
REUSE_FLAG=()
if [[ "${E2E_FRESH:-}" != "1" ]]; then
  REUSE_FLAG=(--reuse)
fi

exec pnpm exec detox test --configuration ios.sim.debug "${REUSE_FLAG[@]}" "${ARGS[@]}"
