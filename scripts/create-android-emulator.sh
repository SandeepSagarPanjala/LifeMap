#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/android-env.sh
source "$ROOT/scripts/android-env.sh"

AVD_NAME="${1:-LifeMap_Emulator}"
DEVICE="${2:-pixel_7_pro}"
SYSTEM_IMAGE="${3:-system-images;android-36;google_apis;arm64-v8a}"

if avdmanager list avd | grep -q "Name: $AVD_NAME"; then
  echo "AVD '$AVD_NAME' already exists. Delete it first:"
  echo "  avdmanager delete avd -n $AVD_NAME"
  exit 1
fi

echo "Creating AVD '$AVD_NAME' ($DEVICE, $SYSTEM_IMAGE)..."
echo "no" | avdmanager create avd -n "$AVD_NAME" -k "$SYSTEM_IMAGE" -d "$DEVICE" --force

echo ""
echo "Done. Launch with:"
echo "  pnpm android:emulator"
echo "  # or: pnpm android:emulator -- $AVD_NAME"
