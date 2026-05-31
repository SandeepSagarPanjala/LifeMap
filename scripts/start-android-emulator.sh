#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/android-env.sh
source "$ROOT/scripts/android-env.sh"

AVD_NAME="${1:-LifeMap_Emulator}"

if ! avdmanager list avd | grep -q "Name: $AVD_NAME"; then
  echo "AVD '$AVD_NAME' not found. Create one with avdmanager or pass a different name."
  exit 1
fi

echo "Starting adb server..."
adb start-server

echo "Launching emulator '$AVD_NAME' (leave this terminal open)..."
exec emulator -avd "$AVD_NAME"
