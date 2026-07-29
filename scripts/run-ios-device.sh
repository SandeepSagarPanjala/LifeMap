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

# CoreDevice (Xcode 15+): tunnel must be connected for wireless installs.
if command -v python3 >/dev/null 2>&1; then
  if xcrun devicectl list devices --json-output /tmp/lifemap-ios-devices.json >/dev/null 2>&1; then
    if python3 - "$DEVICE_UDID" <<'PY'
import json, sys
udid = sys.argv[1]
data = json.load(open("/tmp/lifemap-ios-devices.json"))
for device in data.get("result", {}).get("devices", []):
    hardware = device.get("hardwareProperties") or {}
    connection = device.get("connectionProperties") or {}
    if hardware.get("udid") != udid:
        continue
    tunnel = connection.get("tunnelState")
    transport = connection.get("transportType")
    # USB / wired shows up as localNetwork or wired with connected tunnel.
    if tunnel == "connected":
        sys.exit(0)
    # Some hosts report wired without an explicit tunnel key.
    if transport in ("wired", "local") and tunnel != "disconnected":
        sys.exit(0)
    print(
        f"Device is paired but not ready for installs "
        f"(transport={transport}, tunnel={tunnel}).",
        file=sys.stderr,
    )
    sys.exit(2)
sys.exit(1)
PY
    then
      device_online=1
    else
      status=$?
      if [[ "$status" -eq 2 ]]; then
        device_online=0
      fi
    fi
  fi
fi

if [[ "$device_online" -ne 1 ]]; then
  cat >&2 <<EOF
iPhone is not connected for development (xcodebuild exit 70).

Fix:
  1. Unlock SandY Earth 🌎
  2. Plug in USB (more reliable after iOS 27 upgrade than wireless)
  3. Tap Trust if prompted; keep Developer Mode on
  4. Wait until this shows the phone under Devices (not Offline):
       xcrun xctrace list devices
  5. Retry: pnpm ios

Looking for UDID: $DEVICE_UDID
EOF
  exit 1
fi

# Prefer --device (physical). --udid is treated as a simulator UDID by RN CLI.
exec react-native run-ios --device "$DEVICE_UDID" --extra-params "-allowProvisioningUpdates" "$@"
