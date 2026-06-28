#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

UI_DIR="__UI__"

resolve_maestro() {
  if command -v maestro >/dev/null 2>&1; then
    command -v maestro
    return 0
  fi

  local candidates=(
    "${MAESTRO_HOME:+$MAESTRO_HOME/bin/maestro}"
    "${HOME}/.maestro/bin/maestro"
  )

  for candidate in "${candidates[@]}"; do
    if [[ -n "$candidate" && -x "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  return 1
}

find_main_flow() {
  local flow_id="$1"
  find "$UI_DIR" -name "${flow_id}.yaml" ! -path '*/subflows/*' ! -path '*/shared/*' -print -quit
}

list_main_flows() {
  find "$UI_DIR" -name '*.yaml' ! -path '*/subflows/*' ! -path '*/shared/*' | sort
}

MAESTRO_BIN="$(resolve_maestro || true)"

if [[ -z "$MAESTRO_BIN" ]]; then
  cat >&2 <<'EOF'
Maestro CLI is not installed.

Install (macOS / Linux):
  curl -Ls "https://get.maestro.mobile.dev" | bash

If you already installed it, add this to your shell profile (~/.zshrc):
  export PATH="$HOME/.maestro/bin:$PATH"

Then build and install the app on a simulator or device, for example:
  pnpm ios:sim

Run all flows:
  bash scripts/run-automation.sh

Run one flow:
  bash scripts/run-automation.sh smoke
EOF
  exit 1
fi

FLOW_FILTER="${1:-}"

MAESTRO_ARGS=()
if [[ -n "${MAESTRO_DEVICE:-}" ]]; then
  MAESTRO_ARGS+=(--device "$MAESTRO_DEVICE")
fi

# Real iPhone (one-time, before first device run):
#   maestro driver-setup --apple-team-id=SRTH66N3SH
# LifeMap's team id is in ios/LifeMap.xcodeproj (DEVELOPMENT_TEAM).
# Then list devices: xcrun xctrace list devices
# Run on phone: MAESTRO_DEVICE=<udid> bash scripts/run-automation.sh smoke

if [[ -n "$FLOW_FILTER" ]]; then
  FLOW_PATH="$(find_main_flow "$FLOW_FILTER")"
  if [[ -z "$FLOW_PATH" ]]; then
    echo "Unknown flow id: ${FLOW_FILTER}" >&2
    exit 1
  fi
  if ((${#MAESTRO_ARGS[@]} > 0)); then
    "$MAESTRO_BIN" test "${MAESTRO_ARGS[@]}" "$FLOW_PATH"
  else
    "$MAESTRO_BIN" test "$FLOW_PATH"
  fi
else
  FLOW_PATHS=()
  while IFS= read -r flow_path; do
    FLOW_PATHS+=("$flow_path")
  done < <(list_main_flows)
  if ((${#MAESTRO_ARGS[@]} > 0)); then
    "$MAESTRO_BIN" test "${MAESTRO_ARGS[@]}" "${FLOW_PATHS[@]}"
  else
    "$MAESTRO_BIN" test "${FLOW_PATHS[@]}"
  fi
fi
