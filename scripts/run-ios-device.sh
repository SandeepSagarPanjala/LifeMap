#!/usr/bin/env bash
set -euo pipefail

# Physical iPhone — update if you rename the device or switch phones
DEVICE_UDID="${IOS_DEVICE_UDID:-00008140-000C75AC3C88801C}"
DEVICE_NAME="${IOS_DEVICE_NAME:-SandY Earth 🌎}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

device_online=0
if xcrun xctrace list devices 2>/dev/null | awk '
  /^== Devices Offline ==$/ { offline=1; next }
  /^== / { offline=0 }
  offline { next }
  { print }
' | grep -q "$DEVICE_UDID"; then
  device_online=1
fi

# CoreDevice brings the tunnel up lazily, so `list devices` can report
# tunnelState=disconnected (and xctrace can list it Offline) while the phone is
# perfectly reachable. Probe with a real request instead of trusting that field.
if xcrun devicectl device info details \
  --device "$DEVICE_UDID" --timeout 30 --quiet >/dev/null 2>&1; then
  device_online=1
elif [[ "$device_online" -eq 1 ]]; then
  echo "Device is listed but did not answer a CoreDevice request." >&2
  device_online=0
fi

if [[ "$device_online" -ne 1 ]]; then
  cat >&2 <<EOF
iPhone is not connected for development (xcodebuild exit 70).

Fix:
  1. Unlock $DEVICE_NAME
  2. Plug in USB (more reliable after iOS 27 upgrade than wireless)
  3. Tap Trust if prompted; keep Developer Mode on
  4. For wireless, keep Mac and phone on the same Wi-Fi, then check:
       xcrun devicectl device info details --device $DEVICE_UDID
     (xctrace can list the phone Offline even when it is reachable)
  5. Retry: pnpm ios

Looking for UDID: $DEVICE_UDID
EOF
  exit 1
fi

# Prefer --device (physical). --udid is treated as a simulator UDID by RN CLI.
exec react-native run-ios --device "$DEVICE_UDID" --extra-params "-allowProvisioningUpdates" "$@"
