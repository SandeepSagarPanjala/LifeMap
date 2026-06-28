#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

missing=0

require_cmd() {
  if command -v "$1" >/dev/null 2>&1; then
    echo "ok  $1"
    return
  fi
  echo "MISSING  $1 — $2"
  missing=1
}

echo "Checking iOS Detox prerequisites..."
echo

require_cmd xcodebuild "Install Xcode and open it once."
require_cmd xcrun "Comes with Xcode command line tools."
require_cmd applesimutils "brew tap wix/brew && brew trust wix/brew && brew install applesimutils"

if ! xcrun simctl list devices available 2>/dev/null | grep -q "iPhone 17 Pro"; then
  echo "WARN  iPhone 17 Pro simulator not found — install in Xcode > Settings > Platforms, or edit .detoxrc.js device type."
fi

framework_root="$HOME/Library/Detox/ios/framework"
if ! find "$framework_root" -name Detox.framework -print -quit 2>/dev/null | grep -q .; then
  echo "MISSING  Detox.framework — run: pnpm e2e:setup:ios"
  missing=1
else
  echo "ok  Detox.framework"
fi

app_binary="ios/build/Build/Products/Debug-iphonesimulator/LifeMap.app"
if [[ ! -d "$app_binary" ]]; then
  echo "WARN  $app_binary not built yet — run: pnpm e2e:build:ios"
else
  echo "ok  LifeMap.app (debug simulator build)"
fi

echo
if [[ "$missing" -ne 0 ]]; then
  echo "Fix the MISSING items above, then run: pnpm e2e:test:ios"
  exit 1
fi

echo "Prerequisites look good. Run: pnpm e2e:test:ios"
