#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/android-env.sh
source "$ROOT/scripts/android-env.sh"

cd "$ROOT"
exec react-native run-android "$@"
