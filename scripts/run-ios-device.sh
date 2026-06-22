#!/usr/bin/env bash
set -euo pipefail

# Physical iPhone — update if you rename the device or switch phones
DEVICE_UDID="${IOS_DEVICE_UDID:-00008140-000C75AC3C88801C}"
DEVICE_NAME="${IOS_DEVICE_NAME:-SandY Earth 🌎}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if xcrun xctrace list devices 2>/dev/null | grep -q "$DEVICE_UDID"; then
  exec react-native run-ios --udid "$DEVICE_UDID" --extra-params "-allowProvisioningUpdates" "$@"
fi

echo "Device UDID $DEVICE_UDID not found. Trying name: $DEVICE_NAME"
exec react-native run-ios --device "$DEVICE_NAME" --extra-params "-allowProvisioningUpdates" "$@"
